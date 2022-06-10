var apiKey
chrome.storage.sync.get('apiKey', function (data) {
    apiKey = data.apiKey
})