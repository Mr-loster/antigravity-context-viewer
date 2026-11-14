'use strict';
/**
 * 极简模块注入与手术刀清洗调度引擎 (installer-engine.js)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getStateDir } = require('./asar-engine');

const TAGS = {
  PROXY_START: '// --- Antigravity Proxy NoTun Injection Start ---',
  PROXY_END: '// --- Antigravity Proxy NoTun Injection End ---',
  CHINESE_START: '// --- Antigravity Chinese Localization Injection Start ---',
  CHINESE_END: '// --- Antigravity Chinese Localization Injection End ---',
  METER_UTILS_START: '// --- Antigravity Context Meter utils Injection Start ---',
  METER_UTILS_END: '// --- Antigravity Context Meter utils Injection End ---',
  METER_PRELOAD_START: '// --- Antigravity Context Meter preload Injection Start ---',
  METER_PRELOAD_END: '// --- Antigravity Context Meter preload Injection End ---'
};

function acquireFileLock(targetPath, timeoutMs = 15000) {
  const lockDir = path.join(getStateDir(), 'install.lock');
  const start = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      const releaseFn = () => {
        try { fs.rmdirSync(lockDir); } catch {}
      };
      releaseFn.release = releaseFn;
      return releaseFn;
    } catch (e) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`获取文件锁超时 (${lockDir})，可能有并发进程正在执行安装或卸载。`);
      }
      const sleepEnd = Date.now() + 100;
      while (Date.now() < sleepEnd) {}
    }
  }
}

function validateSyntax(code, filename = 'script.js') {
  if (typeof code !== 'string') return false;
  try {
    new vm.Script(code, { filename });
    return true;
  } catch {
    return false;
  }
}

function generateMeterUtilsCode() {
  const storageFallbackLine = '    if (storageManager) globalThis.__agDefaultStorageManager = storageManager; else if (globalThis.__agDefaultStorageManager) storageManager = globalThis.__agDefaultStorageManager;';
  const hookLine = '    require("./meter-main").installContextMeter(win);\n';
  return {
    headerProxyHook: `try { require("./meter-main").ensureProxyEnvironment(process.env); } catch {}`,
    nodeWrapperHook: `\n    try { require("./meter-main").ensureProxyEnvironment(env); } catch {}`,
    storageFallback: `\n${storageFallbackLine}`,
    menuBarOption: `\n        autoHideMenuBar: true,`,
    windowLoadHook: `${TAGS.METER_UTILS_START}\n${hookLine}${TAGS.METER_UTILS_END}\n`,
    focusHook: `\n        try { require("./meter-main").installContextMeter(wins[0]); require("./meter-main").ensureMeterInjected(wins[0], { force: true }); } catch {}`,
    createHook: `\n        try { require("./meter-main").installContextMeter(_mWin); require("./meter-main").ensureMeterInjected(_mWin, { force: true }); } catch {}`
  };
}

function generateMeterPreloadCode() {
  return `\n${TAGS.METER_PRELOAD_START}
// Context Meter v2: narrow read-only conversation scan API
electron_1.contextBridge.exposeInMainWorld("contextMeterAPI", { scan: (id, force) => electron_1.ipcRenderer.invoke("context-meter:scan", id, force === true), getTokenHistory: (force) => electron_1.ipcRenderer.invoke("context-meter:token-history", force === true), syncOverlay: (opts) => electron_1.ipcRenderer.invoke("context-meter:sync-overlay", opts), recordCalls: (calls) => electron_1.ipcRenderer.invoke("context-meter:record-calls", calls), getSettings: (opts) => electron_1.ipcRenderer.invoke("context-meter:get-settings", opts), saveSettings: (payload) => electron_1.ipcRenderer.invoke("context-meter:save-settings", payload), openExternal: (url) => electron_1.ipcRenderer.invoke("context-meter:open-external", url), getModulesStatus: () => electron_1.ipcRenderer.invoke("context-meter:modules-status"), toggleModule: (name, enable, opts) => electron_1.ipcRenderer.invoke("context-meter:toggle-module", name, enable, opts) });
${TAGS.METER_PRELOAD_END}\n`;
}

function cleanUtilsSource(source) {
  if (!source || typeof source !== 'string') return source;
  let code = source;
  const proxyRegex = new RegExp(`\\n?\\s*${TAGS.PROXY_START}[\\s\\S]*?${TAGS.PROXY_END}\\n?`, 'g');
  code = code.replace(proxyRegex, '\n');
  const meterRegex = new RegExp(`\\n?\\s*${TAGS.METER_UTILS_START}[\\s\\S]*?${TAGS.METER_UTILS_END}\\n?`, 'g');
  code = code.replace(meterRegex, '\n');
  const storageFallbackLine = '    if (storageManager) globalThis.__agDefaultStorageManager = storageManager; else if (globalThis.__agDefaultStorageManager) storageManager = globalThis.__agDefaultStorageManager;';
  code = code
    .replace(/\s*try\s*\{\s*require\("\.\/meter-main"\)\.ensureProxyEnvironment\(process\.env\);\s*\}\s*catch\s*\{\}\r?\n?/g, '')
    .replace(/\s*try\s*\{\s*require\("\.\/meter-main"\)\.ensureProxyEnvironment\(env\);\s*\}\s*catch\s*\{\}\r?\n?/g, '')
    .replace('\n' + storageFallbackLine, '')
    .replace(/\s*require\("\.\/meter-main"\)\.installContextMeter\(win\);?\r?\n?/g, '')
    .replace(/\n\s*try\s*\{\s*require\("\.\/meter-main"\)\.installContextMeter\(wins\[0\]\);[\s\S]*?\}\s*catch\s*\{\}/g, '')
    .replace(/const _mWin = createWindow\(`\$\{constants_1\.WINDOW_ORIGIN\}:\$\{port\}\/`\);\s*\n\s*try\s*\{\s*require\("\.\/meter-main"\)\.installContextMeter\(_mWin\);[\s\S]*?\}\s*catch\s*\{\}/g, 'createWindow(`${constants_1.WINDOW_ORIGIN}:${port}/`);');
  code = code.replace(/\n {8}autoHideMenuBar:\s*true,/, '');
  return code;
}

function cleanPreloadSource(source) {
  if (!source || typeof source !== 'string') return source;
  let code = source;
  const chineseRegex = new RegExp(`\\n?\\s*${TAGS.CHINESE_START}[\\s\\S]*?${TAGS.CHINESE_END}\\n?`, 'g');
  code = code.replace(chineseRegex, '\n');
  const meterRegex = new RegExp(`\\n?\\s*${TAGS.METER_PRELOAD_START}[\\s\\S]*?${TAGS.METER_PRELOAD_END}\\n?`, 'g');
  code = code.replace(meterRegex, '\n');
  const legacyMeterRegex = /\r?\n?\/\/ Context Meter v2: narrow read-only conversation scan API\r?\nelectron_1\.contextBridge\.exposeInMainWorld\("contextMeterAPI",\s*\{[\s\S]*?\}\);\r?\n?/g;
  code = code.replace(legacyMeterRegex, '\n');
  return code;
}

function verifyCleanStructure(cleanUtils) {
  if (!cleanUtils) return false;
  if (cleanUtils.includes('installContextMeter')) return false;
  if (cleanUtils.includes(TAGS.PROXY_START) || cleanUtils.includes(TAGS.METER_UTILS_START)) return false;
  const marker = '    void win.loadURL(url);';
  const setupNodeMarker = 'function setupNodeWrapper(env) {';
  const structuralOk = cleanUtils.split(marker).length === 2 && cleanUtils.includes(setupNodeMarker);
  return structuralOk && validateSyntax(cleanUtils, 'dist/utils.js');
}

module.exports = {
  TAGS,
  acquireFileLock,
  validateSyntax,
  generateMeterUtilsCode,
  generateMeterPreloadCode,
  cleanUtilsSource,
  cleanPreloadSource,
  verifyCleanStructure
};
