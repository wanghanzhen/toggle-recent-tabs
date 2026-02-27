const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta'];

const modifierSymbols = {
  Shift: '⇧',
  Control: '⌃',
  Alt: '⌥',
  Meta: '⌘'
};

const shortcutEl = document.getElementById('shortcut');
const saveBtn = document.getElementById('saveBtn');
const msgEl = document.getElementById('msg');

let config = null;

chrome.storage.local.get('shortcutConfig', (data) => {
  if (data.shortcutConfig) {
    config = data.shortcutConfig;
    renderShortcut();
  }
});

function renderShortcut() {
  if (!config) return;
  
  let mods = '';
  if (config.modifiers.shift) mods += modifierSymbols.Shift;
  if (config.modifiers.ctrl) mods += modifierSymbols.Control;
  if (config.modifiers.alt) mods += modifierSymbols.Alt;
  if (config.modifiers.meta) mods += modifierSymbols.Meta;
  
  const keyUpper = config.key.length === 1 ? config.key.toUpperCase() : config.key;
  
  shortcutEl.className = 'shortcut';
  shortcutEl.innerHTML = `<span class="mod">${mods}</span> <span class="key">${keyUpper}</span>`;
  saveBtn.className = 'btn active';
  saveBtn.disabled = false;
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
});

saveBtn.addEventListener('click', () => {
  if (!config) return;
  
  chrome.storage.local.set({ shortcutConfig: config }, () => {
    msgEl.textContent = '已保存';
    setTimeout(() => window.close(), 800);
  });
});