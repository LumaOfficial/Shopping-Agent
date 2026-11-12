// Where the panel lives in Firefox. The package declares the panel as a
// sidebar_action, so the browser itself owns the surface and no Side Panel API
// exists — this file is what the build puts in place of the Chromium module,
// which is why no Firefox package contains a reference to an API Firefox lacks.
//
// Firefox only lets an extension open its sidebar while a user gesture is live,
// so the toolbar click and the keyboard command call straight through with
// nothing awaited first. Firefox for Android has no sidebar at all, and there
// the panel opens in a window, or a tab where windows cannot be opened.

function openPanelWindow() {
  const url = chrome.runtime.getURL("sidepanel.html");
  const inTab = function () {
    return chrome.tabs.create({ url: url }).catch(function () {});
  };
  if (!chrome.windows || !chrome.windows.create) return inTab();
  return chrome.windows.create({ url: url, type: "popup", width: 400, height: 760 }).catch(inTab);
}

// The sidebar_action needs no setup call: declaring it is what puts the panel in
// Firefox's sidebar menu.
export function installPanelSurface() {}

export function openPanel() {
  const sidebar = chrome.sidebarAction;
  if (!sidebar) return openPanelWindow();
  // toggle() closes the sidebar on a second click, which is what the toolbar
  // button should do; open() is the fallback where toggle() is missing.
  const opened = typeof sidebar.toggle === "function" ? sidebar.toggle() : sidebar.open();
  return Promise.resolve(opened).catch(function () {
    // Firefox refuses without a live gesture (a page script, say); the toolbar
    // button and Alt+Shift+S are both gestures, so they do open it.
  });
}
