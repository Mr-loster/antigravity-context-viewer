  // =========================================================================
  // 模块 1: 精简主题与热力图色阶模块 (极简版)
  // =========================================================================
  const COLOR_STORAGE_KEY = 'ag_custom_colors_v1';
  const HEAT_PRESET_STORAGE_KEY = 'ag_heat_preset_v1';
  const THEME_STORAGE_KEY = 'ag_theme_mode';

  let currentThemeMode = 'auto';
  try {
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
        currentThemeMode = savedTheme;
      }
    }
  } catch {}

  const customColors = {
    panelBg: '',
    ringUsed: '',
    ringTrack: '',
    contextText: '',
    speedText: '',
    tokenTotal: '',
    tokenAccent: '',
    heatLow: '',
    heatHigh: '',
    heatLvl0: '',
    heatLvl1: '',
    heatLvl2: '',
    heatLvl3: '',
    heatLvl4: ''
  };
  let heatPreset = 'purple';

  const HEAT_PRESETS = {
    purple: {
      dark: ['#27272a', '#3f1e6b', '#652ab7', '#9053f8', '#c084fc'],
      light: ['#e4e4e7', '#e9d5ff', '#c084fc', '#9333ea', '#6b21a8']
    },
    green: {
      dark: ['#27272a', '#14532d', '#15803d', '#22c55e', '#86efac'],
      light: ['#e4e4e7', '#bbf7d0', '#4ade80', '#16a34a', '#14532d']
    },
    blue: {
      dark: ['#27272a', '#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd'],
      light: ['#e4e4e7', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a']
    }
  };

  try {
    const rawColors = typeof localStorage !== 'undefined' && localStorage.getItem(COLOR_STORAGE_KEY);
    if (rawColors) {
      const parsed = JSON.parse(rawColors);
      for (const k of Object.keys(customColors)) {
        if (typeof parsed?.[k] === 'string') customColors[k] = parsed[k];
      }
      if (typeof parsed?.heatPreset === 'string' && HEAT_PRESETS[parsed.heatPreset]) {
        heatPreset = parsed.heatPreset;
      }
    }
    const savedPreset = typeof localStorage !== 'undefined' && localStorage.getItem(HEAT_PRESET_STORAGE_KEY);
    if (savedPreset && HEAT_PRESETS[savedPreset]) heatPreset = savedPreset;
  } catch {}

  function normalizeHex(hexStr) {
    if (!hexStr || typeof hexStr !== 'string') return '';
    const clean = hexStr.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean.toLowerCase()}`;
    if (/^[0-9a-fA-F]{3}$/.test(clean)) {
      return `#${clean.split('').map(c => c + c).join('').toLowerCase()}`;
    }
    return '';
  }

  function hexToRgb(hexStr) {
    const clean = normalizeHex(hexStr);
    if (!clean) return null;
    const n = parseInt(clean.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function getSystemTheme() {
    try {
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        const body = document.body;
        const hasCls = (el, name) => Boolean(el?.classList?.contains?.(name));
        if (root?.getAttribute('data-theme') === 'light' || body?.getAttribute('data-theme') === 'light') return 'light';
        if (hasCls(root, 'light') || hasCls(body, 'light') || hasCls(root, 'theme-light') || hasCls(body, 'theme-light') || hasCls(body, 'vscode-light')) return 'light';
        if (root?.getAttribute('data-theme') === 'dark' || body?.getAttribute('data-theme') === 'dark') return 'dark';
        if (hasCls(root, 'dark') || hasCls(body, 'dark') || hasCls(root, 'theme-dark') || hasCls(body, 'theme-dark') || hasCls(body, 'vscode-dark')) return 'dark';
        if (typeof getComputedStyle === 'function' && body) {
          const bg = getComputedStyle(body).backgroundColor || '';
          const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
          if (m) {
            const lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255;
            if (lum > 0.6) return 'light';
            if (lum < 0.4) return 'dark';
          }
        }
      }
      if (typeof window !== 'undefined' && window.matchMedia) {
        if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      }
    } catch {}
    return 'dark';
  }

  function resolveTheme() {
    if (currentThemeMode === 'light') return 'light';
    if (currentThemeMode === 'dark') return 'dark';
    return getSystemTheme();
  }

  function getPresetHeatmapScale() {
    const isLight = resolveTheme() === 'light';
    const presetObj = HEAT_PRESETS[heatPreset] || HEAT_PRESETS.purple;
    return (isLight ? presetObj.light : presetObj.dark).slice();
  }

  function getEffectiveHeatmapScale() {
    const scale = getPresetHeatmapScale();
    for (let i = 0; i < 5; i++) {
      const lvlCustom = normalizeHex(customColors[`heatLvl${i}`]);
      if (lvlCustom) scale[i] = lvlCustom;
    }
    return scale;
  }

  function applyHeatmapPalette() {
    if (!host) return;
    const scale = getEffectiveHeatmapScale();
    for (let i = 0; i < 5; i++) {
      host.style.setProperty(`--ag-heat-lvl-${i}`, scale[i]);
    }
  }

  function applyCustomColors() {
    if (!host) return;
    applyHeatmapPalette();
  }

  function applyTheme() {
    if (!host) return;
    const activeTheme = resolveTheme();
    host.setAttribute('data-theme', activeTheme);
    host.setAttribute('data-theme-mode', currentThemeMode);
    const btns = [el('theme-toggle'), el('theme-toggle-tokens')].filter(Boolean);
    btns.forEach(btn => {
      if (currentThemeMode === 'auto') {
        btn.textContent = activeTheme === 'light' ? '🌗' : '🌓';
        btn.title = `当前主题：跟随宿主 (${activeTheme === 'light' ? '浅色' : '深色'})\n点击切换为：浅色模式`;
      } else if (currentThemeMode === 'light') {
        btn.textContent = '☀️';
        btn.title = '当前主题：浅色模式 (固定)\n点击切换为：深色模式';
      } else {
        btn.textContent = '🌙';
        btn.title = '当前主题：深色模式 (固定)\n点击切换为：跟随宿主';
      }
    });
    applyHeatmapPalette();
    if (typeof activeHeatView === 'string' && typeof renderHeatmapWeekly === 'function' && activeHeatView === 'weekly') {
      renderHeatmapWeekly();
    }
  }

  function cycleTheme() {
    if (currentThemeMode === 'auto') currentThemeMode = 'light';
    else if (currentThemeMode === 'light') currentThemeMode = 'dark';
    else currentThemeMode = 'auto';
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, currentThemeMode);
    } catch {}
    applyTheme();
  }

  function closeColorPicker() {}
  function setPlanDetailExpanded() {}
  let planDetailExpanded = false;
  let autoThemeObserver = null;
  let autoThemeMediaQuery = null;
  let onAutoThemeMediaChange = null;

  function initCustomColors() {
    applyTheme();
    applyCustomColors();
    try {
      if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        autoThemeObserver = new MutationObserver(() => {
          if (currentThemeMode === 'auto' && !state?.disposed) applyTheme();
        });
        if (document.documentElement) {
          autoThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        }
        if (document.body) {
          autoThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        }
      }
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        autoThemeMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        onAutoThemeMediaChange = () => {
          if (currentThemeMode === 'auto' && !state?.disposed) applyTheme();
        };
        autoThemeMediaQuery.addEventListener?.('change', onAutoThemeMediaChange);
      }
    } catch {}
  }

  function disposeColorObservers() {
    try { autoThemeObserver?.disconnect(); } catch {}
    autoThemeObserver = null;
    try {
      if (autoThemeMediaQuery && onAutoThemeMediaChange) {
        autoThemeMediaQuery.removeEventListener?.('change', onAutoThemeMediaChange);
      }
    } catch {}
    autoThemeMediaQuery = null;
    onAutoThemeMediaChange = null;
  }
