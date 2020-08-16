const RESOLUTION_TIMEOUT = 10000
const CONTINUE = null
const CANCEL = {
  cancel: true
}

const setProxySync = (config) => {
  chrome.proxy.settings.set({ value: config }, function () {
    console.log('Set new PAC script, length = ' + config.length);
  })
}

const pac = {
  cache: {},

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

      alert(`FindProxyForURL: url: ${url}, host: ${host}, res: ${res}`)
      return res;
    }
  },
  buildObject: function (domain, ip) {
    console.log(`buildObject: ${domain}, ${ip}`)
    pac.cache[domain] = [ip]
    return JSON.stringify(pac.cache);
  },
}

const handleOnBeforeRequest = details => {
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

  const t0 = new Date().getTime()
  const resolutionResult = resolve(name, tld)
  const t1 = new Date().getTime()
  console.log(`Resolved: ${JSON.stringify(resolutionResult)}`)
  console.log(`Resolution took ${t1 - t0}ms.`)
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

      setProxySync(config)
      console.log(`Waited to apply proxy, continuing request to ${name}...`)
      // Proxy settings is applied immediately. Just continue request as normal.
      return CONTINUE;
    }
    if (resolutionResult.kind === 'hash') {
      chrome.tabs.getSelected(null, tab => {
        chrome.tabs.update(tab.id, { url: 'loading.html' })

        let clearTime = setTimeout(() => {
          return chrome.tabs.update(tab.id, { url: '404.html' })
        }, RESOLUTION_TIMEOUT)

        const url = `https://siasky.net/${resolutionResult.hash}${domainhtml}`
        console.log(`Trying to resolve hashed url: ${url}`)

        const rs = syncFetch(url, { method: 'HEAD' });
        
        clearTimeout(clearTime);

        if (rs.status !== 200) {
          chrome.tabs.update(tab.id, { url: '404.html' })
        } else {
          chrome.tabs.update(tab.id, { url: url })
        }
      })

      // Cancel current request as we're changing tab content to resolved tab
      console.log(`Cancelling request due to SIA Redirect`)
      return CANCEL
    }

    if (resolutionResult.kind === 'redirect') {
      chrome.tabs.getSelected(null, tab => {
        chrome.tabs.update(tab.id, { url: resolutionResult.url })
      })

      // Cancel current request as we're changing tab content to resolved tab
      console.log(`Cancelling request due to Normal Redirect`)
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

chrome.proxy.onProxyError.addListener(details => {
  console.log(`Chrome proxy error: ${JSON.stringify(details)}`)
})

chrome.alarms.create({ periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener(function () {
  pac.cache = {}
  console.log('Cache cleared');
});