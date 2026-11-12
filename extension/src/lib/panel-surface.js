// Where the panel lives in a Chromium browser. Chrome, Edge, Brave, Vivaldi and
// Arc all ship the Side Panel API, so the toolbar button opens the panel there and
// the browser keeps it open across tab switches. A Chromium build without it
// falls back to a small window, then to a tab.
//
// This is the module the source tree itself uses. The Opera package carries
// panel-surface.opera.js under this same name instead (tools/build.mjs swaps it
// in), because Opera has no Side Panel API and a reference to one is a
// store-review flag in a package that never runs it.

export function installPanelSurface() {
  const sidePanel = chrome.sidePanel;
  if (!sidePanel || !sidePanel.setPanelBehavior) return;
  sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function (error) {
    console.warn("[luma] side panel setup failed:", error);
  });
}

function openPanelWindow() {
  const url = chrome.runtime.getURL("sidepanel.html");
  const inTab = function () {
    return chrome.tabs.create({ url: url }).catch(function () {});
  };
  if (!chrome.windows || !chrome.windows.create) return inTab();
  return chrome.windows.create({ url: url, type: "popup", width: 400, height: 760 }).catch(inTab);
}

export async function openPanel() {
  const sidePanel = chrome.sidePanel;
  if (!sidePanel || !sidePanel.open) return openPanelWindow();
  try {
    const win = await chrome.windows.getLastFocused({ populate: false });
    if (!win || typeof win.id !== "number") return openPanelWindow();
    await sidePanel.open({ windowId: win.id });
  } catch (_error) {
    // Only opens from a user gesture; a click or a command is one, so a failure
    // here means the browser refused for its own reason.
  }
}
