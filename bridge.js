// bridge.js - Ponte no contexto isolado para APIs da extensão
window.addEventListener('message', (event) => {
  if (!event || !event.data || typeof event.data !== 'object') return;
  const msg = event.data;

  if (msg.tipo === 'EPROC_ABRIR_INSTRUCOES') {
    chrome.runtime.sendMessage({ action: 'abrirInstrucoes' });
  } else if (msg.tipo === 'EPROC_SALVAR_STORAGE') {
    chrome.runtime.sendMessage({ action: 'salvarStorage', chave: msg.chave, dados: msg.dados });
  } else if (msg.tipo === 'EPROC_LER_STORAGE') {
    chrome.runtime.sendMessage({ action: 'lerStorage', chave: msg.chave }, (res) => {
      window.postMessage({ tipo: 'EPROC_RESPOSTA_STORAGE', chave: msg.chave, dados: res?.dados }, '*');
    });
  }
});
