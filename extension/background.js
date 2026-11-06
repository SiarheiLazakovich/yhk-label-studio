// Extension entry point: clicking the toolbar icon opens the app full-size in a tab,
// or focuses the tab if the app is already open. No permissions are needed:
// runtime.getContexts can see the extension's own tabs.
const APP_URL = chrome.runtime.getURL("index.html");

chrome.action.onClicked.addListener(async () => {
  const [existing] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [APP_URL] });
  if (existing) {
    await chrome.tabs.update(existing.tabId, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: APP_URL });
});
