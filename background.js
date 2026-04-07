// 当前窗口的当前 tab ID
let currentTabId = null;
// 最近访问的 tab ID 列表（按访问顺序排列，最新的在前面）
let recentTabs = [];
// 最多保存最近 5 个 tab
const MAX_RECENT = 5;

// 存储键名（用于持久化数据）
const STORAGE_KEY = 'tabSwitcherData';

let initPromise = null;

function normalizeStoredState(data) {
  const stored = data?.[STORAGE_KEY];
  const nextCurrentTabId = typeof stored?.currentTabId === 'number' ? stored.currentTabId : null;
  const nextRecentTabs = Array.isArray(stored?.recentTabs)
    ? stored.recentTabs.filter(id => typeof id === 'number')
    : [];

  return {
    currentTabId: nextCurrentTabId,
    recentTabs: nextRecentTabs.slice(0, MAX_RECENT)
  };
}

/**
 * 保存数据到本地存储
 */
async function saveData() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { currentTabId, recentTabs }
  });
}

function addToRecentTabs(tabId, excludedId = null) {
  if (typeof tabId !== 'number' || tabId === excludedId) return;

  recentTabs = recentTabs.filter(id => id !== tabId && id !== excludedId);
  recentTabs.unshift(tabId);

  if (recentTabs.length > MAX_RECENT) {
    recentTabs = recentTabs.slice(0, MAX_RECENT);
  }
}

async function initializeState() {
  const storedData = await chrome.storage.local.get(STORAGE_KEY);
  const restored = normalizeStoredState(storedData);
  currentTabId = restored.currentTabId;
  recentTabs = restored.recentTabs;

  const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = focusedTabs[0] || null;
  if (activeTab && currentTabId !== activeTab.id) {
    currentTabId = activeTab.id;
  }

  await saveData();
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeState().catch((error) => {
      console.error('[background] init failed:', error);
      currentTabId = null;
      recentTabs = [];
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

async function syncWindowState(windowId, fallbackTabId = null) {
  const tabs = await chrome.tabs.query({ windowId });
  const tabMap = new Map(tabs.map(tab => [tab.id, tab]));
  const cleanedRecentTabs = recentTabs.filter(id => tabMap.has(id));
  const activeTab = tabs.find(tab => tab.active) || null;

  let nextCurrentTabId = currentTabId;
  if (!tabMap.has(nextCurrentTabId)) {
    nextCurrentTabId = activeTab?.id ?? (typeof fallbackTabId === 'number' ? fallbackTabId : null);
  }

  const didChange =
    nextCurrentTabId !== currentTabId ||
    cleanedRecentTabs.length !== recentTabs.length ||
    cleanedRecentTabs.some((id, index) => id !== recentTabs[index]);

  currentTabId = nextCurrentTabId;
  recentTabs = cleanedRecentTabs.slice(0, MAX_RECENT);

  if (didChange) {
    await saveData();
  }

  return {
    currentTab: currentTabId !== null ? tabMap.get(currentTabId) : undefined,
    recent: recentTabs.map(id => tabMap.get(id)).filter(Boolean)
  };
}

/**
 * 监听 tab 切换事件
 * 当用户切换到新 tab 时，更新 recentTabs 列表
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await ensureInitialized();

  if (currentTabId !== null && currentTabId !== activeInfo.tabId) {
    const previousTab = await chrome.tabs.get(currentTabId).catch(() => null);
    if (previousTab && previousTab.windowId === activeInfo.windowId) {
      addToRecentTabs(currentTabId, activeInfo.tabId);
    }
  }

  currentTabId = activeInfo.tabId;
  await saveData();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ensureInitialized();

  const nextRecentTabs = recentTabs.filter(id => id !== tabId);
  const nextCurrentTabId = currentTabId === tabId ? null : currentTabId;

  if (nextRecentTabs.length !== recentTabs.length || nextCurrentTabId !== currentTabId) {
    recentTabs = nextRecentTabs;
    currentTabId = nextCurrentTabId;
    await saveData();
  }
});

/**
 * 监听来自 content script 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] received:', message);

  if (message.action === 'get-recent-tabs') {
    ensureInitialized()
      .then(async () => {
        const windowId = sender.tab?.windowId;
        if (typeof windowId !== 'number') {
          sendResponse([]);
          return;
        }

        const { currentTab, recent } = await syncWindowState(windowId, sender.tab?.id ?? null);
        const result = [currentTab, ...recent]
          .filter(tab => tab !== undefined)
          .slice(0, MAX_RECENT);

        sendResponse(result);
      })
      .catch((error) => {
        console.error('[background] get-recent-tabs failed:', error);
        sendResponse([]);
      });
    return true;
  }

  if (message.action === 'switch-to-tab') {
    chrome.tabs.update(message.tabId, { active: true });
  }

  if (message.action === 'toggle-previous-tab' && recentTabs.length > 0) {
    chrome.tabs.update(recentTabs[0], { active: true });
  }
});

void ensureInitialized();
