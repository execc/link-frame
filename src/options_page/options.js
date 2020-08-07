const DEFAULT_HANDSHAKE = 'https://handshake.easychain.tech'
const DEFAULT_DNS = 'https://dns.easychain.tech'
const DEFAULT_SIA = 'https://siasky.net'
const DEFAULT_API_KEY = 'qwerty'

function save_options() {
    var handshake = document.getElementById('handshake').value;
    var dns = document.getElementById('dns').value;
    var sia = document.getElementById('sia').value;
    var key = document.getElementById('key').value;

    chrome.storage.sync.set({
        handshake,
        dns,
        sia,
        key
    }, function () {
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function () {
            status.textContent = '';
        }, 750);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    chrome.storage.sync.get({
        handshake: DEFAULT_HANDSHAKE,
        dns: DEFAULT_DNS,
        sia: DEFAULT_SIA,
        key: DEFAULT_API_KEY
    }, function (items) {
        document.getElementById('handshake').value = items.handshake
        document.getElementById('dns').value = items.dns
        document.getElementById('sia').value = items.sia
        document.getElementById('key').value = items.key
    });
}

function reset_options() {
    chrome.storage.sync.set({
        handshake: DEFAULT_HANDSHAKE,
        dns: DEFAULT_DNS,
        sia: DEFAULT_SIA,
        key: DEFAULT_API_KEY
    }, function () {
        restore_options()

        var status = document.getElementById('status');
        status.textContent = 'Options restored to default.';
        setTimeout(function () {
            status.textContent = '';
        }, 750);
    });
}


document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('reset').addEventListener('click', reset_options);