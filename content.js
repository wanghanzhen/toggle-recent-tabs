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

/**
 * 创建弹窗 DOM 结构
 */
function createPopup() {
  const popup = document.createElement('div');
  popup.id = 'tab-switcher-popup';
  popup.innerHTML = `
    <style>
      #tab-switcher-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 999999;
      }
      #tab-switcher-popup .tab-list {
        background: #2d2d2d;
        border-radius: 12px;
        padding: 12px;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      #tab-switcher-popup .tab-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        gap: 12px;
      }
      #tab-switcher-popup .tab-item.highlighted {
        background: #4a9eff;
        color: white;
      }
      #tab-switcher-popup .tab-item .favicon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      #tab-switcher-popup .tab-item .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>
    <div class="tab-list"></div>
  `;
  document.body.appendChild(popup);
  return popup;
}

/**
 * 渲染 tabs 列表到弹窗中
 * @param {Array} tabs - tab 数据数组
 */
function renderTabs(tabs) {
  recentTabsData = tabs;
  if (!popupElement) return;
  
  const list = popupElement.querySelector('.tab-list');
  list.innerHTML = '';
  
  tabs.forEach((tab, index) => {
    const item = document.createElement('div');
    // 高亮当前选中的 tab
    item.className = `tab-item${index === highlightedIndex ? ' highlighted' : ''}`;
    item.innerHTML = `
      <img class="favicon" src="${tab.favIconUrl || ''}" />
      <span class="title">${tab.title || 'Untitled'}</span>
    `;
    item.addEventListener('click', () => switchToTab(index));
    list.appendChild(item);
  });
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