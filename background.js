// Volume Turbo — guarda o volume de cada aba e mostra o número no ícone.
// O volume vale para a aba (continua ao navegar dentro dela) e é esquecido ao fechá-la.
const api = globalThis.browser ?? globalThis.chrome;

const keyOf = (tabId) => `tab:${tabId}`;

async function getVolume(tabId) {
  const data = await api.storage.session.get(keyOf(tabId));
  return data[keyOf(tabId)] ?? 100;
}

async function showBadge(tabId, value) {
  try {
    await api.action.setBadgeText({ tabId, text: value === 100 ? '' : String(value) });
    // Cores do Subaru: amarelo no turbo, azul abaixo de 100%
    await api.action.setBadgeBackgroundColor({ tabId, color: value > 100 ? '#ffd200' : '#1e56d6' });
    await api.action.setBadgeTextColor?.({ tabId, color: value > 100 ? '#0b1a45' : '#ffffff' });
  } catch {
    // A aba pode ter sido fechada nesse meio-tempo.
  }
}

async function setVolume(tabId, value) {
  value = Math.max(0, Math.min(600, Math.round(value)));
  if (value === 100) await api.storage.session.remove(keyOf(tabId));
  else await api.storage.session.set({ [keyOf(tabId)]: value });
  await showBadge(tabId, value);
  // Todos os frames da aba (inclui vídeos incorporados de outros sites).
  try {
    await api.tabs.sendMessage(tabId, { type: 'volume:set', value });
  } catch {
    // Página sem o content script (páginas do navegador, lojas de extensões).
  }
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // A página acabou de carregar e quer saber o volume da sua aba.
  if (message?.type === 'volume:get' && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    getVolume(tabId).then((value) => {
      showBadge(tabId, value);
      sendResponse({ value });
    });
    return true; // resposta assíncrona
  }
  // O menu (popup) mudou o volume.
  if (message?.type === 'volume:set' && typeof message.tabId === 'number') {
    setVolume(message.tabId, message.value).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

api.tabs.onRemoved.addListener((tabId) => {
  api.storage.session.remove(keyOf(tabId));
});
