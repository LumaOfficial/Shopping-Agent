// Where the panel lives in Opera. Opera is Chromium underneath, but it does not
// ship the Side Panel API; its own sidebar is declared with the sidebar_action
// manifest key, and the panel appears on Opera's sidebar rail when the user
// clicks the extension's icon there. This file is what the build puts in place of
// the Chromium module, so the Opera package holds no reference to an API Opera
// does not implement.
//
// Opera's sidebarAction API (opr.sidebarAction) only sets a panel's title, icon
// and page — it cannot open or close the sidebar — so a toolbar click or
// Alt+Shift+S opens the panel in a small window instead of doing nothing.

function openPanelWindow() {
  const url = chrome.runtime.getURL("sidepanel.html");
  const inTab = function () {
    return chrome.tabs.create({ url: url }).catch(function () {});
  };
  if (!chrome.windows || !chrome.windows.create) return inTab();
  return chrome.windows.create({ url: url, type: "popup", width: 400, height: 760 }).catch(inTab);
}

// Declaring sidebar_action is what puts the panel on the sidebar rail, so there
// is nothing to install here.
export function installPanelSurface() {}

export function openPanel() {
  return openPanelWindow();
}
