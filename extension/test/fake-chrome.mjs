// A stand-in for the extension APIs the service worker uses, so the worker can
// be imported and driven from Node. Storage is a plain in-memory map, and the
// messages the panel would send are delivered through the real onMessage
// listener the worker registers.
const LISTENERS = ["onMessage", "onInstalled", "onStartup"];

function storageArea(store, changed) {
  function names(key) {
    if (key === null || typeof key === "undefined") return Object.keys(store);
    return Array.isArray(key) ? key : [key];
  }
  return {
    async get(key) {
      const out = {};
      names(key).forEach((name) => {
        if (Object.prototype.hasOwnProperty.call(store, name)) out[name] = store[name];
      });
      return out;
    },
    async set(values) {
      const patch = {};
      Object.keys(values || {}).forEach((name) => {
        store[name] = values[name];
        patch[name] = { newValue: values[name] };
      });
      changed(patch, "local");
    },
    async remove(key) {
      const patch = {};
      names(key).forEach((name) => {
        delete store[name];
        patch[name] = {};
      });
      changed(patch, "local");
    },
    async clear() {
      Object.keys(store).forEach((name) => delete store[name]);
    },
  };
}

export function createFakeChrome(seed) {
  const store = Object.assign({}, seed || {});
  const watchers = [];
  const listeners = {};
  LISTENERS.forEach((name) => {
    listeners[name] = [];
  });
  const opened = [];

  const chrome = {
    storage: {
      local: storageArea(store, (patch, area) => watchers.forEach((fn) => fn(patch, area))),
      onChanged: { addListener(fn) { watchers.push(fn); } },
    },
    runtime: {
      id: "test-extension",
      getURL(path) {
        return "chrome-extension://test-extension/" + path;
      },
      onMessage: { addListener(fn) { listeners.onMessage.push(fn); } },
      onInstalled: { addListener(fn) { listeners.onInstalled.push(fn); } },
      onStartup: { addListener(fn) { listeners.onStartup.push(fn); } },
    },
    tabs: {
      async create(options) {
        opened.push(options);
        return { id: opened.length };
      },
      async query() {
        return [];
      },
      async sendMessage() {
        return null;
      },
    },
    scripting: {
      async getRegisteredContentScripts() {
        return [];
      },
      async registerContentScripts() {},
      async unregisterContentScripts() {},
    },
    declarativeNetRequest: {
      async updateEnabledRulesets() {},
    },
    action: { onClicked: { addListener() {} } },
    commands: { onCommand: { addListener() {} } },
    windows: {
      getLastFocused(_options, done) {
        done({ id: 1 });
      },
      async create() {
        return { id: 2 };
      },
    },
    sidePanel: {
      async setPanelBehavior() {},
      async open() {},
    },
    permissions: {
      async contains() {
        return true;
      },
      async request() {
        return true;
      },
    },
  };

  // What the panel does with chrome.runtime.sendMessage, without a browser. The
  // default sender is one of the extension's own pages, which is what a panel
  // message really carries; a test that wants a different speaker passes its own.
  const PANEL = { id: chrome.runtime.id, url: chrome.runtime.getURL("sidepanel.html") };

  function send(message, sender) {
    const listener = listeners.onMessage[0];
    if (!listener) return Promise.reject(new Error("the worker registered no message listener"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("the worker never answered " + message.type)), 5000);
      listener(message, sender || PANEL, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
  }

  return { chrome, store, send, opened, listeners };
}

// Every test needs its own copy of the worker: its module state (the offer
// cache) belongs to one browser session, and the listeners it registers belong
// to one fake.
let runs = 0;
export async function loadWorker(seed) {
  const fake = createFakeChrome(seed);
  globalThis.chrome = fake.chrome;
  const url = new URL("../src/background/service-worker.js", import.meta.url);
  url.search = "run=" + (runs += 1);
  await import(url.href);
  return fake;
}
