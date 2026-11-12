// Which desktop this panel is running on. The same source ships to Chrome,
// Edge, Brave, Vivaldi and Opera on Windows, macOS and Linux, so the only things
// allowed to differ are the keyboard shortcut the panel prints and the word for
// the machine the shopper is holding. Behaviour is identical everywhere, which
// is what tools/emulate-platforms.mjs checks.
//
// Detection reads only the strings the browser exposes, so the harness can drive
// it with an emulated navigator instead of a real Windows or Mac.
const DESKTOPS = {
  windows: {
    id: "windows",
    label: "Windows",
    shortcut: "Alt + Shift + S",
    line: "Press Alt + Shift + S on any page to bring this panel back.",
    where: "the toolbar at the top right of the browser window",
  },
  mac: {
    id: "mac",
    label: "macOS",
    shortcut: "\u2325 + \u21e7 + S",
    line: "Press \u2325 \u21e7 S on any page to bring this panel back.",
    where: "the toolbar at the top right of the browser window",
  },
  linux: {
    id: "linux",
    label: "Linux",
    shortcut: "Alt + Shift + S",
    line: "Press Alt + Shift + S on any page to bring this panel back.",
    where: "the toolbar at the top right of the browser window",
  },
  chromeos: {
    id: "chromeos",
    label: "ChromeOS",
    shortcut: "Alt + Shift + S",
    line: "Press Alt + Shift + S on any page to bring this panel back.",
    where: "the toolbar at the top right of the browser window",
  },
  android: {
    id: "android",
    label: "Android",
    shortcut: "",
    line: "Phones do not run the panel; the same account works in the desktop browsers.",
    where: "the browser menu",
  },
  ios: {
    id: "ios",
    label: "iPhone or iPad",
    shortcut: "",
    line: "Phones do not run the panel; the same account works in the desktop browsers.",
    where: "the browser menu",
  },
  unknown: {
    id: "unknown",
    label: "your computer",
    shortcut: "Alt + Shift + S",
    line: "Press Alt + Shift + S on any page to bring this panel back.",
    where: "the toolbar at the top right of the browser window",
  },
};

// Values navigator.platform has used for each desktop, plus the names a caller
// can pass when it already knows the answer (the preview's OS switcher does).
const ALIASES = {
  win32: "windows",
  win64: "windows",
  win: "windows",
  windows: "windows",
  mac: "mac",
  macintel: "mac",
  macos: "mac",
  darwin: "mac",
  linux: "linux",
  x11: "linux",
  cros: "chromeos",
  chromeos: "chromeos",
  android: "android",
  ios: "ios",
};

function read(input) {
  // An explicit input is used as given, so a harness can say "no navigator at
  // all" without Node's own navigator leaking in.
  const env = input || {};
  const nav = input ? env.navigator || null : typeof navigator !== "undefined" ? navigator : null;
  const agent = String(env.userAgent || (nav && nav.userAgent) || "");
  const platform = String(
    env.platform ||
      (nav && nav.platform) ||
      (nav && nav.userAgentData && nav.userAgentData.platform) ||
      ""
  );
  return { agent, platform };
}

// A phone is reported rather than guessed at: the panel is a desktop surface,
// and saying so is friendlier than printing a shortcut that cannot work.
export function platformFrom(input) {
  const { agent, platform } = read(input);
  const value = platform.toLowerCase();
  const ua = agent.toLowerCase();
  const alias = ALIASES[value];
  if (alias) return alias;

  if (/android/.test(value) || /android/.test(ua)) return "android";
  if (/(iphone|ipad|ipod)/.test(value) || /(iphone|ipad|ipod)/.test(ua)) return "ios";
  if (/^(mac|darwin)/.test(value) || /macintosh|mac os x/.test(ua)) return "mac";
  if (/^win/.test(value) || /windows/.test(ua)) return "windows";
  // ChromeOS reports a Linux platform string, so its own token is read first.
  if (/cros/.test(value) || /cros/.test(ua)) return "chromeos";
  if (/linux|x11/.test(value) || /linux|x11/.test(ua)) return "linux";
  return "unknown";
}

export function detectPlatform() {
  return platformFrom(null);
}

export function platformInfo(id) {
  return DESKTOPS[id] || DESKTOPS.unknown;
}

export function shortcutLabel(id) {
  return platformInfo(id).shortcut;
}

// The one sentence the tutorial and the settings page show, so both say the
// same thing about the same desktop.
export function platformLine(id) {
  const info = platformInfo(id);
  if (!info.shortcut) return info.line;
  return info.label + " \u00b7 " + info.shortcut;
}

export function isDesktop(id) {
  return Boolean(platformInfo(id).shortcut);
}

export const PLATFORMS = Object.keys(DESKTOPS);
