const DNS_OVER_HTTPS_RESOLVER = 'https://dns.easychain.tech'

const getResolver = () => {
    return DNS_OVER_HTTPS_RESOLVER
}

const fetchDns = async url => {
    return fetch(url)
            .then(rs => rs.json())
            .catch(_ => ({
                Status: 5
            }))
}

const resolveIp = async domain => {
    const queryUrl = `${getResolver()}/resolve?name=${domain}`
    const result = await fetchDns(queryUrl);
    console.log(`resolveIp result: ${JSON.stringify(result)}`)
    const success = result.Status === 0;
    if (success && result.Answer.length) {
        return result.Answer[0].data
    }
}

const resolveHash = async domain => {
    const queryUrl = `${getResolver()}/resolve?name=${domain}&type=TXT`
    const result = await fetchDns(queryUrl);
    console.log(`resolveHash result: ${JSON.stringify(result)}`)
    const success = result.Status === 0;
    if (success && result.Answer.length) {
        return extractHash(result)
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

const resolve = async domain => {
    console.log(`Called resolve for ${domain}`)
    const ip = await resolveIp(domain)
    if (ip) {
        return {
            'success': true,
            'kind': 'ip',
            'address': ip
        }
    } else {
        const hash = await resolveHash(domain)
        if (hash) {
            return {
                'success': true,
                'kind': 'hash',
                'name': hash.provider.name,
                'hash': hash.data
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

// TEST
const TEST_DATA = 
{"Status":0,"TC":false,"RD":true,"RA":false,"AD":false,"CD":false,"Question":[{"type":16,"name":"3chffffff"}],"Answer":[{"type":16,"data":[{"type":"Buffer","data":[118,65,67,103,87,70,65,70,105,71,119,115,103,113,45,118,89,50,109,76,100,112,122,88,98,68,108,102,51,67,48,82,121,76,99,113,95,118,56,100,89,85,79,102,71,103]}],"TTL":3600,"name":"3chffffff"}],"Additional":[]}

const test = () => {
    console.log(extractHash(TEST_DATA))
}

const test2 = async () => {
    const result = await resolve('3chffffff')
    console.log(JSON.stringify(result))
}

//test2()
// END TEST