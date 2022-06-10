window.onload = function () {
    chrome.storage.sync.get('apiKey', function(data) {
        document.getElementById('apiKeyText').value = data.apiKey
    })
}

document.getElementById('saveButton').addEventListener('click', saveAPIKey)

function saveAPIKey() {
    var apiKeyText = document.getElementById('apiKeyText').value
    console.log("save 버튼 눌림: " + apiKeyText)
    chrome.storage.sync.set({ apiKey: apiKeyText });
}