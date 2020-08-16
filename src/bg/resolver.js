const DEFAULT_HANDSHAKE = 'https://handshake.easychain.tech'
const DEFAULT_API_KEY = 'qwerty'
const DEFAULT_DNS = 'https://dns.easychain.tech'
const DEFAULT_SIA = 'https://siasky.net'

const defaultProps = {
    dns: DEFAULT_DNS,
    handshake: DEFAULT_HANDSHAKE,
    sia: DEFAULT_SIA,
    key: DEFAULT_API_KEY
}

var props = {
    ...defaultProps
}

const getResolver = () => {
    return getOptionValue('dns', DEFAULT_DNS)
}

const getHandshake = () => {
    return getOptionValue('handshake', DEFAULT_HANDSHAKE)
}

const getHandshakeApiKey = () => {
    return getOptionValue('key', DEFAULT_API_KEY)
}

const getSiaGateway = () => {
    return getOptionValue('sia', DEFAULT_SIA)
}

const getOptionValue = (key, defaultValue) => {
    return props[key] || defaultValue
}

const fetchDns = (url, dns) => {
    const rs = syncFetch(url, {
        headers: {
            'x-dns': dns
        }
    })

    if (!rs.response) {
        return {
            Status: 5
        }
    }

    return rs.response
}

const resolveBlockchainInfo = (domain) => {
    const url = getHandshake()
    const query = { 
        "method": "getnameresource", 
        "params": [ domain ] 
    }
    const result = syncFetch(url, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa('x:' + (getHandshakeApiKey())),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(query)
    }).response
    console.log(`resolveBlockchainInfo result: ${JSON.stringify(result)}`)
    return result
}

const resolveIp = (domain, dns) => {
    console.log(`Called resolveIp for domain/dns: ${domain}/${dns}`)
    const queryUrl = `${(getResolver())}/resolve?name=${domain}`
    const result = fetchDns(queryUrl, dns)
    console.log(`resolveIp result: ${JSON.stringify(result)}`)
    const success = result.Status === 0
    if (success && result.Answer.length) {
        if (result.Answer[0].type === 5) {
            if (result.Answer[0].data === 'redirect.dns.live') {
                return {
                    type: 'redirect'
                }
            } else {
                return {
                    type: 'redirect',
                    dest: result.Answer[0].data
                }
            }
        } else {
            return {
                type: 'ip',
                data: result.Answer[0].data
            }
        }
    }
}

const resolveHash = (domain, dns) => {
    console.log(`Called resolveHash for domain/dns: ${domain}/${dns}`)
    const queryUrl = `${(getResolver())}/resolve?name=${domain}&type=TXT`
    const result = fetchDns(queryUrl, dns);
    console.log(`resolveHash result: ${JSON.stringify(result)}`)
    const success = result.Status === 0
    if (success && result.Answer.length) {
        return extractHash(result)
    }
}

const resolveRedirect = (domain, dns) => {
    console.log(`Called resolveRedirect for domain/dns: ${domain}/${dns}`)
    const queryUrl = `${(getResolver())}/resolve?name=_redirect.${domain}&type=TXT`
    const result = fetchDns(queryUrl, dns);
    console.log(`resolveRedirect result: ${JSON.stringify(result)}`)
    const success = result.Status === 0
    if (success && result.Answer.length) {
        const redirectString = decode(result.Answer[0].data[0].data)
        console.log(`resolveRedirect redirectString: ${redirectString}`)
        const redirectSegments = redirectString.split(';')
        const toSegment = redirectSegments.filter(segment => segment.startsWith('to='))[0]
        if (toSegment) {
            return toSegment.substring(3)
        }
    }
}

const extractHash = response => {
    const hashRecords = response.Answer
        .map(answer => ({
            data: decode(answer.data[0].data)
        }))
        .map(answer => ({
            provider: getProvider(answer.data),
            ...answer
        }))
        .filter(answer => answer.provider !== undefined)
    return hashRecords.length === 0 ? undefined : hashRecords[0]
}

const extractBlockchainHash = rs => {
    const hashRecords = rs.result.records
        .filter(rec => rec.type === 'TXT')
        .map(rec => ({
            data: rec.txt[0]
        }))
        .map(answer => ({
            provider: getProvider(answer.data),
            ...answer
        }))
        .filter(answer => answer.provider !== undefined)
    return hashRecords.length === 0 ? undefined : hashRecords[0]
}

const extractBlockchainDns = rs => {
    var dnsRecords = rs.result.records
        .filter(rec => rec.type === 'GLUE4')
        .map(rec => rec.address)
    var result = dnsRecords.length === 0 ? undefined : dnsRecords[0]

    if (!result) {
        dnsRecords = rs.result.records
            .filter(rec => rec.type === 'NS')
            .map(rec => rec.ns)
        result = dnsRecords.length === 0 ? undefined : dnsRecords[0]
    }
    console.log(`extractBlockchainDns result: ${JSON.stringify(dnsRecords)}`)
    return result;
}

const resolve = (domain, tld) => {
    console.log(`Called resolve for ${domain} with tld ${tld}`)
    const info = resolveBlockchainInfo(tld)
    if (!info.result || !info.result.records) {
        console.log(`No records in blockchain for tld: ${tld}`)

        return {
            'success': false
        }
    }
    // Check for TXT records with hash first
    const blockchainHash = extractBlockchainHash(info)
    if (blockchainHash) {
        return {
            'success': true,
            'kind': 'hash',
            'name': blockchainHash.provider.name,
            'hash': blockchainHash.data
        }
    }
    const dns = extractBlockchainDns(info)
    if (dns) {
        console.log(`Got DNS from blockchain: ${dns}`)
        const ip = resolveIp(domain, dns)
        if (ip) {
            if (ip.type === 'ip') {
                return {
                    'success': true,
                    'kind': 'ip',
                    'address': ip.data
                }
            }
            if (ip.type === 'redirect') {
                if (!ip.dest) {
                    const redirectUrl = resolveRedirect(domain, dns)
                    if (redirectUrl) {
                        return {
                            'success': true,
                            'kind': 'redirect',
                            'url': redirectUrl
                        }
                    }
                } else {
                    var dest = ip.dest
                    if (!dest.startsWith('http')) {
                        dest = `http://${dest}`
                    }
                    return {
                        'success': true,
                        'kind': 'redirect',
                        'url': dest
                    }
                }
            }
        } else {
            const hash = resolveHash(domain, dns)
            if (hash) {
                return {
                    'success': true,
                    'kind': 'hash',
                    'name': hash.provider.name,
                    'hash': hash.data
                }
            }
        }
    }

    return {
        'success': false
    }
}

const decode = array => {
    var result = "";
    for (var i = 0; i < array.length; i++) {
        result += String.fromCharCode(parseInt(array[i]));
    }
    return result;
}

const getProvider = data => {
    const providers = PROVIDERS.filter(provider => provider.isProviderHash(data))
    return providers.length === 0 ? undefined : providers[0]
}

// PROVIDERS
const isSkynet = hash => {
    if (!hash || hash.length === 0) {
        return false;
    }
    return Boolean(hash.match(SKYLINK_HASH_PATTERN));
}

const PROVIDERS = [
    {
        'name': 'skynet',
        'isProviderHash': isSkynet
    }
]

const SKYLINK_HASH_PATTERN = /^[a-zA-Z0-9_-]{46}/;
// END PROVIDERS

// START PROPERTIES
const loadProperties = () => {
    chrome.storage.sync.get(defaultProps, _props => {
        props = _props
        console.log(`Loaded properties: ${JSON.stringify(props)}`)
    })
}
chrome.storage.sync.addListener(_ => {
    console.log(`Loading changed properties...`)
    loadProperties()
})
console.log(`Loading initial properties...`)
loadProperties()
// END PROPERTIES

// TEST
const TEST_DATA = 
{"Status":0,"TC":false,"RD":true,"RA":false,"AD":false,"CD":false,"Question":[{"type":16,"name":"3chffffff"}],"Answer":[{"type":16,"data":[{"type":"Buffer","data":[118,65,67,103,87,70,65,70,105,71,119,115,103,113,45,118,89,50,109,76,100,112,122,88,98,68,108,102,51,67,48,82,121,76,99,113,95,118,56,100,89,85,79,102,71,103]}],"TTL":3600,"name":"3chffffff"}],"Additional":[]}

const test = () => {
    console.log(extractHash(TEST_DATA))
}

const test2 = () => {
    const result = resolve('3chffffff')
    console.log(JSON.stringify(result))
}

//test2()
// END TEST