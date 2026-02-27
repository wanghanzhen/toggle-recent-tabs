// 当前窗口的当前 tab ID
let currentTabId = null;
// 最近访问的 tab ID 列表（按访问顺序排列，最新的在前面）
let recentTabs = [];
// 最多保存最近 5 个 tab
const MAX_RECENT = 5;

// 存储键名（用于持久化数据）
const STORAGE_KEY = 'tabSwitcherData';

/**
 * 保存数据到本地存储
 */
async function saveData() {
  await chrome.storage.local.set({ currentTabId, recentTabs });
}

/**
 * 监听 tab 切换事件
 * 当用户切换到新 tab 时，更新 recentTabs 列表
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (currentTabId !== null && currentTabId !== activeInfo.tabId) {
    // 将当前 tab 加入历史列表（去重）
    recentTabs = recentTabs.filter(id => id !== activeInfo.tabId);
    recentTabs.unshift(currentTabId);
    // 限制列表长度
    if (recentTabs.length > MAX_RECENT) {
      recentTabs = recentTabs.slice(0, MAX_RECENT);
    }
  }
  currentTabId = activeInfo.tabId;
  await saveData();
});

/**
 * 监听新 tab 创建事件
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  currentTabId = tab.id;
  await saveData();
});

/**
 * 监听来自 content script 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] received:', message);
  
  // 获取最近的 tabs（当前 tab + 最近访问的 tab）
  if (message.action === 'get-recent-tabs') {
    chrome.tabs.query({ currentWindow: true }).then((tabs) => {
      const tabMap = new Map(tabs.map(t => [t.id, t]));
      // 过滤出仍然存在的 tab
      const recent = recentTabs
        .map(id => tabMap.get(id))
        .filter(t => t !== undefined);
      
      const currentTab = tabMap.get(currentTabId);
      // 组合当前 tab 和历史 tabs
      const result = [currentTab, ...recent].slice(0, MAX_RECENT);
      sendResponse(result);
    });
    return true; // 异步响应
  }
  
  // 切换到指定 tab
  if (message.action === 'switch-to-tab') {
    chrome.tabs.update(message.tabId, { active: true });
  }

  // 快速切换到上一个 tab（toggle 功能）
  if (message.action === 'toggle-previous-tab' && recentTabs.length > 0) {
    chrome.tabs.update(recentTabs[0], { active: true });
  }
});