const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta'];

const modifierSymbols = {
  Shift: '⇧',
  Control: '⌃',
  Alt: '⌥',
  Meta: '⌘'
};

const modifierLabels = {
  Shift: 'Shift',
  Control: 'Control',
  Alt: 'Option',
  Meta: 'Command'
};

const shortcutEl = document.getElementById('shortcut');
const saveBtn = document.getElementById('saveBtn');
const msgEl = document.getElementById('msg');
const statusTextEl = document.getElementById('statusText');
const captureLabelEl = document.getElementById('captureLabel');

let config = null;

chrome.storage.local.get('shortcutConfig', (data) => {
  if (data.shortcutConfig) {
    config = data.shortcutConfig;
  }
  renderShortcut();
});

function renderShortcut() {
  const hasConfig = Boolean(config);

  shortcutEl.className = hasConfig ? 'shortcut' : 'shortcut empty';
  shortcutEl.innerHTML = hasConfig
    ? renderKeycaps(config)
    : '等待输入...';

  statusTextEl.textContent = hasConfig ? '已配置' : '就绪';
  captureLabelEl.textContent = hasConfig ? '当前快捷键' : '录入快捷键';
  saveBtn.disabled = !hasConfig;
}

function renderKeycaps(shortcutConfig) {
  const caps = [];

  if (shortcutConfig.modifiers.shift) caps.push(createKeycap(modifierSymbols.Shift, modifierLabels.Shift));
  if (shortcutConfig.modifiers.ctrl) caps.push(createKeycap(modifierSymbols.Control, modifierLabels.Control));
  if (shortcutConfig.modifiers.alt) caps.push(createKeycap(modifierSymbols.Alt, modifierLabels.Alt));
  if (shortcutConfig.modifiers.meta) caps.push(createKeycap(modifierSymbols.Meta, modifierLabels.Meta));

  const keyText = normalizeKeyLabel(shortcutConfig.key);
  caps.push(createKeycap(keyText, keyText, true));

  return caps.join('');
}

function createKeycap(symbol, label, wide = false) {
  const extraClass = wide ? ' keycap-wide' : '';
  return `<span class="keycap${extraClass}" aria-label="${escapeHtml(label)}">${escapeHtml(symbol)}</span>`;
}

function normalizeKeyLabel(key) {
  if (!key) return '按键';
  if (key.length === 1) return key.toUpperCase();

  const aliases = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
    Backspace: 'Delete',
    ' ': 'Space'
  };

  return aliases[key] || key;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('keydown', (e) => {
  e.preventDefault();

  if (MODIFIER_KEYS.includes(e.key)) return;

  const hasModifier = e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;
  if (!hasModifier) return;

  config = {
    modifiers: {
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey
    },
    key: e.key
  };

  renderShortcut();
  msgEl.textContent = '';
  statusTextEl.textContent = '已捕获';
  captureLabelEl.textContent = '快捷键预览';
});

saveBtn.addEventListener('click', () => {
  if (!config) return;

  chrome.storage.local.set({ shortcutConfig: config }, () => {
    msgEl.textContent = '已保存';
    statusTextEl.textContent = '已同步';
    setTimeout(() => window.close(), 800);
  });
});
