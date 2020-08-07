# Link-Frame
Link-Frame - an open resolver for Handshake domains

## Installation
1. Open Chrome -> Additional Tools -> Extensions
2. Enable Development Mode (upper right corner)
3. Click 'Load unpacked extension'
4. Point it to the folder containing this files
???
5. PROFIT!!!

## Settings
API's that are used by extension is completely configurable, so you are free to use you own Handhake node. You can set the following properties on Options page:
 - Handshake API Address - address of Handshake node (API)
 - Handshake API Key - API key for node
 - DNS Over HTTPS Address - An address of a service that performs DNS queries over HTTPS protocol. This is needed because you can not send 'true' DNS queries from browser extension.
 - SIA Gateway Address: Address of Skynet gateway

## How it works
This plugin takes advantage of a Dns-Over-Https technology. It allows to perform DNS queries using regular `fetch` API.
This plugin requires two backend services:
 - Handhake API (for obvious reasons)
 - Dns-Over-Https proxy service. Specification of this service is bellow.

Given name such as 'something.tld' this plugin will perform the following things:
1. Check that _tld_ is *not* an already registered TLD. If it is - do nothing.
2. Get on-chain DNS records for _tld_
3. Check if there is a *TXT* record corresponding to valid Sia hash. If such - redirect to Sia.
4. Read *NS* record to extract DNS service for given address
5. Perform query about _something.tld_ using Dns-Over-Https proxy to the extracted DNS server
6. Check if there is an *A* record - and if such - proxy request to this IP using Chrome Proxy API
7. Check if there is a *TXT* record corresponding to valid Sia hash. If such - redirect to Sia.

With this algorithm plugin can effectively work with both on-chain and off-chain DNS records.

*Examples:*
http://welcome.nb/ - 2nd level domain, points to IP

http://3chffffff/ - 1st level domain, points to IP

http://millsgroup/ - 1st level domain, points to SIA

http://example.example/ - 2nd level domain, points to SIA


## Dns-Over-Https proxy
The Dns-Over-Https proxy in general follows the standard https://tools.ietf.org/html/rfc8484. However, it allows for a special header, `x-dns` to be passed. This header allows caller to specify what exact DNS server should server the request.

Service is currently running on https://dns.easychain.tech, however you are free to host you own instance. 

*Example queries:*

Resolve google.ru using Google's DNS (8.8.8.8)
```
curl --location --request GET 'https://dns.easychain.tech/resolve?name=google.ru' \
--header 'x-dns: 8.8.8.8'
``` 
Resolve 3chffffff using Namebase's DNS (44.231.6.183)
```
curl --location --request GET 'https://dns.easychain.tech/resolve?name=3chffffff' \
--header 'x-dns: 44.231.6.183'
``` 
Resolve 3chffffff using Googles's DNS (8.8.8.8) - no result
```
curl --location --request GET 'https://dns.easychain.tech/resolve?name=3chffffff' \
--header 'x-dns: 44.231.6.183'
``` 