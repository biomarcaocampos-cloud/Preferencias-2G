// background.js - Service worker para a extensão de criação de preferências
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('instrucoes.html') });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) return;

  if (request.action === 'abrirInstrucoes') {
    chrome.tabs.create({ url: chrome.runtime.getURL('instrucoes.html') });
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'salvarStorage') {
    const payload = {};
    payload[request.chave] = request.dados;
    chrome.storage.local.set(payload, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }

  if (request.action === 'lerStorage') {
    chrome.storage.local.get(request.chave, (res) => {
      sendResponse({ ok: true, dados: res ? res[request.chave] : null });
    });
    return true;
  }
});

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('instrucoes.html') });
  });
}
