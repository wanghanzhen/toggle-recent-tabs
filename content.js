// 短按 (<100ms): 切换到上一个 tab
// 长按 (>100ms): 显示弹窗，可选择最近 5 个 tab

const LONG_PRESS_THRESHOLD = 100;

// 默认配置
const DEFAULT_CONFIG = {
  modifiers: { shift: true, ctrl: true, alt: true, meta: true },
  key: 'Tab'
};

// 用户配置
let shortcutConfig = { ...DEFAULT_CONFIG };

// 从 storage 加载配置
function loadConfig() {
  try {
    if (chrome.runtime?.id) {
      chrome.storage.local.get('shortcutConfig', (data) => {
        if (data.shortcutConfig) {
          shortcutConfig = data.shortcutConfig;
        }
      });
    }
  } catch (e) {
    console.log('Load config failed, using default');
  }
}

// 监听配置变化，实时更新
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.shortcutConfig) {
      shortcutConfig = changes.shortcutConfig.newValue || DEFAULT_CONFIG;
      updatePopupShortcutHint();
    }
  });
}

// 页面加载时加载配置
loadConfig();

// 状态追踪
let isModifiersPressed = false;  // 修饰键是否按下
let isKeyPressed = false;        // 配置的按键是否按下
let keyDownTime = 0;             // 按键按下的时间戳

// 弹窗相关
let popupElement = null;     // 弹窗 DOM 元素
let popupListElement = null; // 弹窗列表容器
let popupHintElement = null; // 顶部快捷键提示
let highlightedIndex = 1;    // 当前高亮的 tab 索引（默认第二个）
let recentTabsData = [];     // 最近访问的 tabs 列表

// 状态机: idle -> waiting -> popup
let state = 'idle';
let showPopupTimeout = null; // 长按检测定时器

/**
 * 判断当前是否按下了配置的所有修饰键
 */
function checkModifiersPressed(e) {
  const cfg = shortcutConfig.modifiers;
  if (cfg.shift && !e.shiftKey) return false;
  if (cfg.ctrl && !e.ctrlKey) return false;
  if (cfg.alt && !e.altKey) return false;
  if (cfg.meta && !e.metaKey) return false;
  return true;
}

function getShortcutTokens() {
  const tokens = [];
  const modifiers = shortcutConfig.modifiers || {};

  if (modifiers.shift) tokens.push('⇧');
  if (modifiers.ctrl) tokens.push('⌃');
  if (modifiers.alt) tokens.push('⌥');
  if (modifiers.meta) tokens.push('⌘');

  tokens.push(getShortcutKeyLabel(shortcutConfig.key));
  return tokens;
}

function getShortcutKeyLabel(key) {
  if (!key) return 'Key';
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

function updatePopupShortcutHint() {
  if (!popupHintElement) return;
  popupHintElement.textContent = getShortcutTokens().join(' ');
}

/**
 * 创建弹窗 DOM 结构
 */
function createPopup() {
  const host = document.createElement('div');
  host.id = 'tab-switcher-popup-host';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
        color-scheme: dark;
        user-select: none;
        -webkit-user-select: none;
      }
      .backdrop {
        position: fixed;
        inset: 0;
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.05), transparent 24%),
          rgba(5, 5, 5, 0.34);
        backdrop-filter: blur(8px);
      }
      .popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        width: min(560px, calc(100vw - 24px));
        z-index: 1;
        user-select: none;
        -webkit-user-select: none;
      }
      .tab-list {
        overflow: hidden;
        background:
          linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(10, 10, 10, 0.96));
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.09);
        box-shadow:
          0 18px 48px rgba(0, 0, 0, 0.46),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        font-family: "SF Pro Display", "SF Pro Text", ui-sans-serif, system-ui, sans-serif;
        backdrop-filter: blur(26px) saturate(135%);
      }
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .panel-title {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .panel-title strong {
        color: #f2f2f2;
        font-size: 13px;
        font-weight: 640;
        letter-spacing: -0.02em;
      }
      .panel-title span {
        color: #9b9b9b;
        font-size: 11px;
      }
      .panel-hint {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        color: #9b9b9b;
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .panel-body {
        padding: 8px;
      }
      .tab-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        cursor: pointer;
        color: #f2f2f2;
        transition: background 120ms ease, transform 120ms ease;
        user-select: none;
        -webkit-user-select: none;
      }
      .tab-item.highlighted {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      }
      .tab-item:hover {
        transform: translateY(-1px);
      }
      .tab-item .favicon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        border-radius: 5px;
      }
      .tab-item .favicon-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.12);
        color: #ededed;
        font-size: 10px;
        font-weight: 600;
        line-height: 1;
        text-transform: uppercase;
      }
      .tab-item.highlighted .favicon-fallback {
        background: rgba(255, 255, 255, 0.2);
      }
      .tab-copy {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
      }
      .tab-item .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        font-weight: 560;
        letter-spacing: -0.01em;
      }
      .tab-item .meta {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #8e8e8e;
        font-size: 11px;
      }
      .tab-item .index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        padding: 0 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        color: #9a9a9a;
        font-size: 11px;
        font-weight: 600;
      }
      .tab-item.highlighted .index {
        background: rgba(255, 255, 255, 0.12);
        color: #f2f2f2;
      }
    </style>
    <div class="backdrop"></div>
    <div class="popup">
      <div class="tab-list">
        <div class="panel-header">
          <div class="panel-title">
            <strong>最近标签页</strong>
            <span>松开修饰键即可确认当前选择</span>
          </div>
          <div class="panel-hint"></div>
        </div>
        <div class="panel-body"></div>
      </div>
    </div>
  `;

  popupListElement = shadowRoot.querySelector('.panel-body');
  popupHintElement = shadowRoot.querySelector('.panel-hint');
  updatePopupShortcutHint();

  const mountTarget = document.body || document.documentElement;
  mountTarget.appendChild(host);
  return host;
}

/**
 * 渲染 tabs 列表到弹窗中
 * @param {Array} tabs - tab 数据数组
 */
function renderTabs(tabs) {
  recentTabsData = tabs;
  if (!popupElement || !popupListElement) return;

  popupListElement.replaceChildren();
  
  tabs.forEach((tab, index) => {
    if (!tab) return;

    const item = document.createElement('div');
    item.className = `tab-item${index === highlightedIndex ? ' highlighted' : ''}`;

    const faviconContainer = document.createElement('div');
    faviconContainer.style.position = 'relative';
    faviconContainer.style.width = '18px';
    faviconContainer.style.height = '18px';
    faviconContainer.style.flexShrink = '0';

    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.alt = '';
    favicon.style.display = tab.favIconUrl ? 'block' : 'none';

    const fallback = document.createElement('span');
    fallback.className = 'favicon-fallback';
    fallback.textContent = getTabFallbackText(tab);
    fallback.style.display = tab.favIconUrl ? 'none' : 'inline-flex';

    favicon.onerror = () => {
      favicon.style.display = 'none';
      fallback.style.display = 'inline-flex';
    };

    if (tab.favIconUrl) {
      favicon.onload = () => {
        fallback.style.display = 'none';
      };
      favicon.src = tab.favIconUrl;
    }

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = tab.title || 'Untitled';

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = getTabMetaText(tab, index);

    const copy = document.createElement('div');
    copy.className = 'tab-copy';
    copy.appendChild(title);
    copy.appendChild(meta);

    const order = document.createElement('span');
    order.className = 'index';
    order.textContent = index === 0 ? 'Now' : String(index);

    faviconContainer.appendChild(favicon);
    faviconContainer.appendChild(fallback);
    item.appendChild(faviconContainer);
    item.appendChild(copy);
    item.appendChild(order);
    item.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      switchToTab(index);
    });
    popupListElement.appendChild(item);
  });
}

function getTabFallbackText(tab) {
  const hostname = safeParseHostname(tab?.url);
  if (hostname) {
    return hostname[0];
  }

  const title = typeof tab?.title === 'string' ? tab.title.trim() : '';
  const match = title.match(/[A-Za-z0-9\u4e00-\u9fa5]/u);
  return match ? match[0] : 'T';
}

function safeParseHostname(url) {
  if (!url) return '';

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

function getTabMetaText(tab, index) {
  const hostname = safeParseHostname(tab?.url);
  if (hostname) {
    return index === 0 ? `${hostname} · 当前标签页` : hostname;
  }

  return index === 0 ? '当前标签页' : '最近标签页';
}

/**
 * 安全发送消息到 background 脚本
 * @param {string} action - 消息 action 类型
 * @param {Object} data - 附加数据
 * @returns {Promise}
 */
function sendMessageSafe(action, data = {}) {
  return new Promise((resolve) => {
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ action, ...data }, resolve);
      } else {
        resolve(null);
      }
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * 显示 tab 选择弹窗
 */
async function showPopup() {
  if (popupElement) return;
  
  // 初始化高亮索引为 1（第二个 tab）
  highlightedIndex = 1;
  popupElement = createPopup();
  
  // 从 background 获取最近访问的 tabs
  const tabs = await sendMessageSafe('get-recent-tabs');
  if (tabs) {
    renderTabs(tabs);
  }
}

/**
 * 隐藏弹窗并重置状态
 */
function hidePopup() {
  if (popupElement) {
    popupElement.remove();
    popupElement = null;
  }
  popupListElement = null;
  popupHintElement = null;
  recentTabsData = [];
  state = 'idle';
}

/**
 * 切换到上一个 tab（快速切换）
 */
function switchToPrevious() {
  hidePopup();
  sendMessageSafe('toggle-previous-tab');
}

/**
 * 切换到指定的 tab
 * @param {number} index - tab 索引
 */
function switchToTab(index) {
  const tab = recentTabsData[index];
  if (tab) {
    hidePopup();
    sendMessageSafe('switch-to-tab', { tabId: tab.id });
  }
}

/**
 * 移动高亮位置
 * @param {number} direction - 移动方向（1 或 -1）
 */
function moveHighlight(direction) {
  highlightedIndex = (highlightedIndex + direction + recentTabsData.length) % recentTabsData.length;
  renderTabs(recentTabsData);
}

// ==================== 键盘事件监听 ====================

document.addEventListener('keydown', (e) => {
  // 追踪修饰键状态
  if (checkModifiersPressed(e)) {
    isModifiersPressed = true;
  }
  
  // 处理配置的按键
  if (e.key === shortcutConfig.key) {
    if (isModifiersPressed) {
      e.preventDefault();
      isKeyPressed = true;
      keyDownTime = Date.now();
      
      if (state === 'idle') {
        // 初始状态：开始等待，检测是否为长按
        state = 'waiting';
        showPopupTimeout = setTimeout(() => {
          // 超过阈值且仍按住，切换到弹窗状态
          if (isModifiersPressed && isKeyPressed) {
            state = 'popup';
            showPopup();
          }
        }, LONG_PRESS_THRESHOLD);
      } else if (state === 'popup' && popupElement) {
        // 弹窗状态下按配置按键，移动高亮
        moveHighlight(1);
      }
    }
  }
}, true);

document.addEventListener('keyup', (e) => {
  // 检测修饰键是否松开（任一配置的修饰键松开）
  if (e.key === 'Meta' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') {
    if (!checkModifiersPressed(e)) {
      isModifiersPressed = false;
      
      if (isKeyPressed) {
        if (state === 'popup' && popupElement) {
          // 弹窗状态：切换到高亮的 tab
          switchToTab(highlightedIndex);
        } else if (state === 'waiting') {
          // 等待状态：检查按压时长，短按则切换上一个 tab
          const pressDuration = Date.now() - keyDownTime;
          if (pressDuration < LONG_PRESS_THRESHOLD) {
            switchToPrevious();
          }
        }
        hidePopup();
      }
      isKeyPressed = false;
    }
  }
  
  // 配置的按键松开（但修饰键仍按住）
  if (e.key === shortcutConfig.key && isModifiersPressed) {
    isKeyPressed = false;
  }
}, true);

// 页面隐藏时隐藏弹窗
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hidePopup();
    isModifiersPressed = false;
    isKeyPressed = false;
  }
});
