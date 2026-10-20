// Firefox expõe `browser` (com Promises); Chrome expõe `chrome`.
const api = globalThis.browser ?? globalThis.chrome;

const keyOf = (tabId) => `tab:${tabId}`;
const $ = (id) => document.getElementById(id);
const slider = $('slider');

let activeTab = null;

// Preferência só do popup (tema), no localStorage dele.
const prefs = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

// ---------- Volume da aba atual ----------
function show(value) {
  $('value').textContent = value;
  slider.value = value;
  slider.style.setProperty('--fill', `${(value / 600) * 100}%`);
  slider.setAttribute('aria-valuetext', `${value}%`);
  $('current').dataset.level = value > 300 ? 'loud' : value > 100 ? 'boost' : 'normal';
  for (const button of $('presets').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.value) === value));
  }
  $('hint').textContent = value > 300 ? 'Acima de 300% o som pode distorcer em alguns vídeos.' : '';
}

// Manda para o background (que guarda, atualiza o ícone e avisa a aba), no máximo a cada 60 ms.
let lastSent = 0;
let pendingTimer;
function send(value, now = false) {
  if (!activeTab || !api) return;
  clearTimeout(pendingTimer);
  const elapsed = Date.now() - lastSent;
  const go = () => {
    lastSent = Date.now();
    api.runtime.sendMessage({ type: 'volume:set', tabId: activeTab.id, value });
  };
  if (now || elapsed > 60) go();
  else pendingTimer = setTimeout(go, 60 - elapsed);
}

function setVolume(value, now) {
  show(value);
  send(value, now);
  updateBadgeInList(activeTab?.id, value);
}

slider.addEventListener('input', () => setVolume(Number(slider.value)));
slider.addEventListener('change', () => setVolume(Number(slider.value), true));
$('presets').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (button) setVolume(Number(button.dataset.value), true);
});

// ---------- Abas tocando som ----------
function label(value) {
  return `${value}%`;
}

function updateBadgeInList(tabId, value) {
  const badge = document.querySelector(`#audible-list [data-tab-id="${tabId}"] .badge`);
  if (!badge) return;
  badge.textContent = label(value);
  badge.classList.toggle('boost', value > 100);
}

// Ícone de alto-falante (com ondas ou riscado), criado sem innerHTML.
function speakerIcon(muted) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shapes = [['path', { d: 'M4 9v6h4l5 4V5L8 9H4z', fill: 'currentColor' }]];
  if (muted) shapes.push(['path', { d: 'M16 9l5 6M21 9l-5 6', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' }]);
  else shapes.push(['path', { d: 'M16 8.5a4.5 4.5 0 0 1 0 7M18.5 5.5a8.5 8.5 0 0 1 0 13', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' }]);
  for (const [tag, attrs] of shapes) {
    const el = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    svg.append(el);
  }
  return svg;
}

// Silencia/reativa a aba pelo mudo do próprio navegador (funciona em qualquer site, até com DRM).
function muteButton(tab) {
  const muted = Boolean(tab.mutedInfo?.muted);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mute';
  button.setAttribute('aria-pressed', String(muted));
  button.title = muted ? 'Reativar o som desta aba' : 'Silenciar esta aba';
  button.setAttribute('aria-label', `${button.title}: ${tab.title || 'aba'}`);
  button.append(speakerIcon(muted));
  button.addEventListener('click', async () => {
    await api.tabs.update(tab.id, { muted: !muted });
    renderAudible().catch(() => {});
  });
  return button;
}

async function renderAudible() {
  if (!api) return;
  // Abas tocando som + as silenciadas (para dar para reativar mesmo se pararem de tocar).
  const tabs = (await api.tabs.query({})).filter((t) => t.audible || t.mutedInfo?.muted);
  const stored = tabs.length ? await api.storage.session.get(tabs.map((t) => keyOf(t.id))) : {};
  const items = tabs.map((tab) => {
    const value = stored[keyOf(tab.id)] ?? 100;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'open';
    button.title = tab.title || '';

    let icon;
    if (tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)) {
      icon = document.createElement('img');
      icon.src = tab.favIconUrl;
      icon.alt = '';
    } else {
      icon = document.createElement('span');
      icon.className = 'no-icon';
    }

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = tab.title || tab.url || 'Aba';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.classList.toggle('boost', value > 100);
    badge.textContent = label(value);

    button.append(icon, title, badge);
    button.addEventListener('click', async () => {
      await api.tabs.update(tab.id, { active: true });
      await api.windows.update(tab.windowId, { focused: true });
      window.close();
    });

    const li = document.createElement('li');
    li.dataset.tabId = tab.id;
    li.classList.toggle('current-tab', tab.id === activeTab?.id);
    li.classList.toggle('muted', Boolean(tab.mutedInfo?.muted));
    li.append(button, muteButton(tab));
    return li;
  });
  $('audible-list').replaceChildren(...items);
  $('audible-empty').hidden = items.length > 0;
}

// ---------- Permissão de acesso aos sites (Firefox) ----------
const siteOrigins = () => api?.runtime?.getManifest?.().host_permissions ?? [];

async function checkSiteAccess() {
  const origins = siteOrigins();
  if (!origins.length || !api.permissions?.contains) return;
  $('access').hidden = await api.permissions.contains({ origins });
}

// O Firefox só aceita o pedido de permissão direto no clique (sem await antes).
$('grant').addEventListener('click', () => {
  api.permissions.request({ origins: siteOrigins() }).then(checkSiteAccess, checkSiteAccess);
});

// ---------- Tema ----------
// Azul-marinho do Subaru é o padrão; o botão passa por preto e claro.
const THEMES = { dark: 'Azul-marinho', black: 'Preto', light: 'Claro' };
const themeOrder = Object.keys(THEMES);
const nextTheme = (theme) => themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];

function applyTheme(theme) {
  if (!(theme in THEMES)) return;
  document.documentElement.dataset.theme = theme;
  const label = `Tema: ${THEMES[theme]} (clique para ${THEMES[nextTheme(theme)]})`;
  $('theme').title = label;
  $('theme').setAttribute('aria-label', label);
}

$('theme').addEventListener('click', () => {
  const next = nextTheme(document.documentElement.dataset.theme || 'dark');
  applyTheme(next);
  prefs.set('theme', next);
});

// ---------- Início ----------
(async () => {
  applyTheme(prefs.get('theme') || 'dark');

  if (!api?.tabs) {
    show(100); // aberto fora da extensão (só para ver o visual)
    return;
  }

  [activeTab] = await api.tabs.query({ active: true, currentWindow: true });
  $('tab-name').textContent = activeTab?.title || 'Esta aba';
  const stored = await api.storage.session.get(keyOf(activeTab.id));
  show(stored[keyOf(activeTab.id)] ?? 100);

  // Páginas do navegador e lojas de extensões não deixam extensões entrarem.
  try {
    await api.tabs.sendMessage(activeTab.id, { type: 'volume:ping' });
  } catch {
    $('current').classList.add('disabled');
    $('hint').textContent = 'Esta página não deixa extensões controlarem o som.';
  }

  checkSiteAccess().catch(() => {});
  renderAudible().catch(() => {});
  setInterval(() => renderAudible().catch(() => {}), 2000);
})();
