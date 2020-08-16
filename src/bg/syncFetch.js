const syncFetch = (url, params) => {
    console.log(`Sync call to Fetch, url: ${url}, params: ${JSON.stringify(params)}`)
    var xhr = new XMLHttpRequest();
    const method = params.method || 'GET'
    xhr.open(method, url, false);
    if (params.headers) {
        for (var key in params.headers) {
            if (params.headers.hasOwnProperty(key)) { 
                const value = params.headers[key]
                xhr.setRequestHeader(key, value)
            }     
        }
    }
    const body = params.body || null
    xhr.send(body);

    const rs = {}
    if (xhr.responseText) {
        console.log(`Sync call to Fetch, status: ${xhr.status}, result: ${xhr.responseText}`)
        rs.response = JSON.parse(xhr.responseText)
    } else {
        console.log(`Sync call to Fetch, status: ${xhr.status}`)
    }
    rs.status = xhr.status

    return rs;
}