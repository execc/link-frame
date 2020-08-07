const RESOLUTION_TIMEOUT = 10000
const CONTINUE = {}
const CANCEL = {
  cancel: true
}

const pac = {
  // This is stub function that is used as template for generating a real PAC script later
  //
  _scriptStub: function () {
    var cache = CACHE_HERE;
  
    function FindProxyForURL(url, host) {
      var res = 'DIRECT';
      var ips = cache[host];
  
      if (ips) {
        var pos = url.indexOf(host);
        var port;
  
        if (pos != -1) {
          port = (url.substr(pos + host.length).match(/^:(\d+)/) || [])[1];
        }
  
        var https = url.match(/^https:/i);
        var directive = https ? 'HTTPS ' : 'PROXY ';
        port = ':' + (port || (https ? 443 : 80));
        res = directive + ips.join(port + '; ' + directive) + port;
      }
  
      console.log(`FindProxyForURL: url: ${url}, host: ${host}, res: ${res}`)
      return res;
    }
  },
  buildObject: function (domain, ip) {
    // TODO: Really cache things
    console.log(`buildObject: ${domain}, ${ip}`)
    var obj = {};
    obj[domain] = [ip];
    return JSON.stringify(obj);
  },
}

const handleOnBeforeRequest = async details => {
  const urlhttpreplace = details.url.replace(/\w+?:\/\//, '')
  const url = urlhttpreplace.replace(/[\\/].*/g, '') // eslint-disable-line no-useless-escape
  let domainhtml = urlhttpreplace.match(/[\\/].*/g) // eslint-disable-line no-useless-escape
  const name = url.replace(/\/$/g, '')
  if (domainhtml === null) domainhtml = ['']

  const tld = getTLD(name);
  if (!tld || isKnownTLD(tld)) {
    // Can not determine TLD or TLD is valid top level domain - skip resolution
    //
    console.log(`Skipping resolution of known or invalid TLD: ${tld}`)
    return CONTINUE
  }

  if (name.startsWith('chrome-')) {
    // Special chrome URL - do not resolve
    //
    console.log(`Skipping resolution of chrome TLD: ${name}`)
    return CONTINUE
  }

  console.log(`Resolving data for address: ${name}`)

  const resolutionResult = await resolve(name, tld)
  console.log(`Resolved: ${JSON.stringify(resolutionResult)}`)

  if (resolutionResult.success) {
    // Found info in decentralized DNS

    if (resolutionResult.kind === 'ip') {
      const script = pac._scriptStub.toString()
        .replace(/^.*|.*$/g, '')
        .replace('CACHE_HERE', pac.buildObject(name, resolutionResult.address));

      console.log(`Generated proxy script: ${script}`);

      const config = {
        mode: 'pac_script',
        pacScript: {
          data: script,
        },
      };

      chrome.proxy.settings.set({value: config}, function () {
        console.log('Set new PAC script, length = ' + script.length); 
      });

      // Proxy settings is applied immediately. Just continue request as normal.
      return {};
    }
    if (resolutionResult.kind === 'hash') {
      chrome.tabs.getSelected(null, tab => {
        chrome.tabs.update(tab.id, { url: 'loading.html' })
    
          let clearTime = setTimeout(() => {
              return chrome.tabs.update(tab.id, { url: '404.html' })
          }, RESOLUTION_TIMEOUT)

          const url = `https://siasky.net/${resolutionResult.hash}${domainhtml}`
          console.log(`Trying to resolve hashed url: ${url}`)

          fetch(url, { method: 'HEAD' }).then(rs => {
            clearTimeout(clearTime);

            if (rs.status !== 200) {
              chrome.tabs.update(tab.id, { url: '404.html' })
            } else {
              chrome.tabs.update(tab.id, { url: url })
            }
          })
      })

      // Cancel current request as we're changing tab content to resolved tab
      return CANCEL
    }
    // Continue current request

    return CONTINUE
  } else {
    // Continue current request

    return CONTINUE
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  handleOnBeforeRequest, 
  {
    urls: [
      '<all_urls>'
    ]
  }, 
  [
    "blocking"
  ]
)