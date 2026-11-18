(function () {
  const METER_VERSION = '0.8.2';

  'use strict';
  if (location.protocol !== 'https:' || location.hostname !== '127.0.0.1') return;
  try { globalThis.__AGContextMeter?.dispose?.(); } catch {}
  if (globalThis.__AGContextMeterInstances instanceof Set) {
    for (const fn of Array.from(globalThis.__AGContextMeterInstances)) {
      try { fn?.(); } catch {}
    }
    globalThis.__AGContextMeterInstances.clear();
  } else {
    globalThis.__AGContextMeterInstances = new Set();
  }
  try {
    const orphans = typeof document.querySelectorAll === 'function'
      ? Array.from(document.querySelectorAll('#ag-context-meter'))
      : [];
    const unhandledOrphans = orphans.filter(node => typeof node?.__agDispose !== 'function');
    if (unhandledOrphans.length > 0 && globalThis.__agZombieDomGuardInstalled !== 2) {
      globalThis.__agZombieDomGuardInstalled = 2;
      const candidateProtos = [];
      if (typeof HTMLDivElement !== 'undefined' && HTMLDivElement.prototype) candidateProtos.push(HTMLDivElement.prototype);
      if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype) candidateProtos.push(HTMLElement.prototype);
      if (typeof Element !== 'undefined' && Element.prototype) candidateProtos.push(Element.prototype);
      if (typeof Node !== 'undefined' && Node.prototype) candidateProtos.push(Node.prototype);
      for (const proto of candidateProtos) {
        for (const method of ['insertBefore', 'appendChild']) {
          if (Object.prototype.hasOwnProperty.call(proto, method) && typeof proto[method] === 'function' && !proto[method].__agZombieWrapped) {
            const orig = proto[method];
            const wrapped = function (newNode) {
              if (newNode && newNode.__agMeterZombie === true) return newNode;
              return orig.apply(this, arguments);
            };
            wrapped.__agZombieWrapped = true;
            proto[method] = wrapped;
          }
        }
      }
    }
    for (const node of orphans) {
      try {
        if (typeof node.__agDispose === 'function') {
          node.__agDispose();
        } else {
          node.__agMeterZombie = true;
          try { node.shadowRoot?.replaceChildren?.(); } catch {}
          node.remove?.();
        }
      } catch {}
    }
    document.getElementById?.('ag-wco-spacer')?.remove?.();
    document.getElementById?.('ag-topbar-host-fix')?.remove?.();
  } catch {}
  const {
    summarize,
    parseGeneratorCall,
    calculateRequestApiCost,
    normalizeModelId,
    getLvlForRange,
    getDailyModelCost,
    calculateIntervalCost,
    convertToCNY,
    resolveEffectivePlanStatus
  } = (globalThis.__AGContextMeterCore || {});
  const host = document.createElement('div');
  host.id = 'ag-context-meter';
  host.setAttribute('data-layout', 'wide');
  host.setAttribute('data-dock', 'fixed');
  host.setAttribute('data-window-active', 'true');
  const shadow = host.attachShadow({ mode: 'open' });

  // Antigravity 本地真实 Token 统计基准数据（纯净初始状态，启动时由宿主实时扫描本地实际账本注入）
  const ANTIGRAVITY_TOKEN_DATA = {
    updatedAt: "",
    firstUseDate: null,
    summary: {
      grandTotalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheTokens: 0,
      todayTokens: 0,
      monthTokens: 0,
      yearTokens: 0,
      totalSteps: 0,
      totalConversations: 0,
      firstUseDate: null,
      activeDaysCount: 0
    },
    dailyMap: {}
  };

  const RING_RADIUS = 6.5;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  shadow.innerHTML = `<style>
    :host{
      position:fixed;top:6px;right:138px;z-index:2147483000;
      font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;
      -webkit-app-region:no-drag;user-select:none;display:inline-flex;align-items:center;gap:2px;
      height:28px;flex-shrink:0;vertical-align:middle;

      /* 深色模式默认变量（隔离宿主浅色变量，防止切换固定深色时串入白色背景） */
      --ag-toolbar-fg:#b8b8c0;
      --ag-toolbar-fg-hover:#ececef;
      --ag-toolbar-bg:transparent;
      --ag-toolbar-bg-hover:rgba(255,255,255,0.08);
      --ag-toolbar-bg-active:rgba(255,255,255,0.12);
      --ag-toolbar-border-focus:rgba(167,139,250,0.55);
      --ag-divider:rgba(255,255,255,0.08);

      /* 圆环与各指标默认主题色 */
      --ag-ring-track-default:rgba(255,255,255,0.20);
      --ag-ring-used-default:#e6e6eb;
      --ag-ring-warn:#f59e0b;
      --ag-ring-danger:#ef4444;

      --ag-context-text-default:#ececef;
      --ag-speed-default:#b8b8c0;
      --ag-token-total-default:#b8b8c0;
      --ag-token-accent-default:#a78bfa;

      /* 一级/二级统一深色背景（auto 模式下才适配宿主背景） */
      --ag-bg-panel-default:#18181b;
      --ag-unified-bg:var(--ag-custom-panel-bg,var(--ag-bg-panel-default));

      --ag-float-bg:var(--ag-unified-bg);
      --ag-float-border:rgba(255,255,255,0.12);
      --ag-float-shadow:0 12px 32px rgba(0,0,0,0.52),0 2px 8px rgba(0,0,0,0.32);

      --ag-bg-panel:var(--ag-unified-bg);
      --ag-border-panel:rgba(255,255,255,0.11);
      --ag-shadow-panel:0 16px 40px rgba(0,0,0,0.58),0 2px 10px rgba(0,0,0,0.32);
      --ag-text-primary:#ececef;
      --ag-text-secondary:#c8c8d0;
      --ag-text-muted:#8a8a94;
      --ag-border-subtle:rgba(255,255,255,0.08);

      /* 一级面板与二级内部菜单/卡片/抽屉背景严格一致 */
      --ag-bg-card:var(--ag-unified-bg);
      --ag-bg-card-hover:var(--ag-unified-bg);
      --ag-border-card:rgba(255,255,255,0.09);
      --ag-bg-subcard:var(--ag-unified-bg);
      --ag-border-subcard:rgba(255,255,255,0.08);
      --ag-bg-status:var(--ag-unified-bg);
      --ag-text-status:#c8c8d0;

      --ag-btn-bg:var(--ag-unified-bg);
      --ag-btn-hover:rgba(255,255,255,0.08);
      --ag-btn-border:rgba(255,255,255,0.12);
      --ag-btn-border-hover:rgba(255,255,255,0.22);
      --ag-btn-text:#d4d4d8;

      --ag-pill-muted-bg:var(--ag-unified-bg);
      --ag-pill-muted-border:rgba(255,255,255,0.12);
      --ag-pill-muted-text:#9a9aa2;

      --ag-track-bg:rgba(255,255,255,0.12);
      --ag-track-shadow:none;

      --ag-heat-bg:var(--ag-unified-bg);
      --ag-heat-lvl-0:#27272a;
      --ag-heat-lvl-1:#3f1e6b;
      --ag-heat-lvl-2:#652ab7;
      --ag-heat-lvl-3:#9053f8;
      --ag-heat-lvl-4:#c084fc;
      --ag-heat-outline:#ffffff;

      --ag-pop-bg:var(--ag-unified-bg);
      --ag-pop-border:var(--ag-float-border);
      --ag-pop-shadow:var(--ag-float-shadow);
      --ag-pop-text:var(--ag-text-primary);
      --ag-pop-muted:var(--ag-text-secondary);
      --ag-pop-sub:var(--ag-text-muted);

      --ag-scrollbar-thumb:rgba(255,255,255,0.16);
      --ag-scrollbar-hover:rgba(255,255,255,0.28);

      --ag-bg-input:rgba(255,255,255,0.06);
      --ag-select-option-bg:#222226;
      --ag-select-option-fg:#ececef;

      color-scheme:dark;
      color:var(--ag-text-primary);
    }

    /* 融入宿主原生布局容器时参与正常 Flexbox 空间分配 */
    :host([data-dock="flow"]){
      position:relative !important;top:auto !important;right:auto !important;left:auto !important;bottom:auto !important;z-index:20;
      margin-right:4px;
    }

    /* 窗口非活动状态适度降低顶栏对比度 */
    :host([data-window-active="false"]) .ag-unit{
      opacity:0.72;
    }
    :host([data-window-active="false"]) .ag-unit:hover,
    :host([data-window-active="false"]) .ag-unit:focus-visible{
      opacity:1;
    }

    /* 跟随宿主深色模式时优先复用宿主同极性变量 */
    :host([data-theme="dark"][data-theme-mode="auto"]){
      --ag-toolbar-fg:var(--secondary-foreground,#b8b8c0);
      --ag-toolbar-fg-hover:var(--foreground,#ececef);
      --ag-toolbar-bg-hover:var(--secondary,rgba(255,255,255,0.08));
      --ag-toolbar-bg-active:var(--secondary,rgba(255,255,255,0.12));
      --ag-bg-panel-default:var(--ag-host-bg,var(--background,#18181b));
    }

    /* 浅色模式规范（隔离宿主深色变量，auto 模式下才适配宿主背景） */
    :host([data-theme="light"]),
    :host([data-panel-tone="light"]){
      --ag-toolbar-fg:#52525b;
      --ag-toolbar-fg-hover:#18181b;
      --ag-toolbar-bg:transparent;
      --ag-toolbar-bg-hover:rgba(0,0,0,0.06);
      --ag-toolbar-bg-active:rgba(0,0,0,0.10);
      --ag-toolbar-border-focus:rgba(124,58,237,0.45);
      --ag-divider:rgba(0,0,0,0.08);

      --ag-ring-track-default:rgba(0,0,0,0.18);
      --ag-ring-used-default:#18181b;
      --ag-ring-warn:#d97706;
      --ag-ring-danger:#dc2626;

      --ag-context-text-default:#18181b;
      --ag-speed-default:#52525b;
      --ag-token-total-default:#52525b;
      --ag-token-accent-default:#7c3aed;

      --ag-bg-panel-default:#ffffff;
      --ag-unified-bg:var(--ag-custom-panel-bg,var(--ag-bg-panel-default));

      --ag-float-bg:var(--ag-unified-bg);
      --ag-float-border:rgba(0,0,0,0.12);
      --ag-float-shadow:0 8px 24px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.06);

      --ag-bg-panel:var(--ag-unified-bg);
      --ag-border-panel:rgba(0,0,0,0.12);
      --ag-shadow-panel:0 14px 36px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.06);
      --ag-text-primary:#18181b;
      --ag-text-secondary:#3f3f46;
      --ag-text-muted:#71717a;
      --ag-border-subtle:rgba(0,0,0,0.08);

      --ag-bg-card:var(--ag-unified-bg);
      --ag-bg-card-hover:var(--ag-unified-bg);
      --ag-border-card:rgba(0,0,0,0.10);
      --ag-bg-subcard:var(--ag-unified-bg);
      --ag-border-subcard:rgba(0,0,0,0.09);
      --ag-bg-status:var(--ag-unified-bg);
      --ag-text-status:#27272a;

      --ag-btn-bg:var(--ag-unified-bg);
      --ag-btn-hover:rgba(0,0,0,0.05);
      --ag-btn-border:rgba(0,0,0,0.12);
      --ag-btn-border-hover:rgba(0,0,0,0.22);
      --ag-btn-text:#18181b;

      --ag-pill-muted-bg:var(--ag-unified-bg);
      --ag-pill-muted-border:rgba(0,0,0,0.12);
      --ag-pill-muted-text:#52525b;

      --ag-track-bg:rgba(0,0,0,0.08);
      --ag-track-shadow:none;

      --ag-heat-bg:var(--ag-unified-bg);
      --ag-heat-lvl-0:#e4e4e7;
      --ag-heat-lvl-1:#e9d5ff;
      --ag-heat-lvl-2:#c084fc;
      --ag-heat-lvl-3:#9333ea;
      --ag-heat-lvl-4:#6b21a8;
      --ag-heat-outline:#18181b;

      --ag-scrollbar-thumb:rgba(0,0,0,0.16);
      --ag-scrollbar-hover:rgba(0,0,0,0.28);

      --ag-bg-input:rgba(0,0,0,0.04);
      --ag-select-option-bg:#ffffff;
      --ag-select-option-fg:#18181b;

      color-scheme:light;
      color:var(--ag-text-primary);
    }

    *{box-sizing:border-box}
    .sr-only{
      position:absolute!important;width:1px!important;height:1px!important;
      padding:0!important;margin:-1px!important;overflow:hidden!important;
      clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;
    }
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--ag-scrollbar-thumb);border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:var(--ag-scrollbar-hover)}
    button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0}
    button:focus-visible{outline:1.5px solid var(--ag-toolbar-border-focus);outline-offset:1px}

    /* Basic Unit: 原生工具栏级别精密小单元 */
    .ag-unit{
      display:inline-flex;align-items:center;justify-content:center;
      height:28px;padding:0 7px;border-radius:8px;border:1px solid transparent;
      background:var(--ag-toolbar-bg);color:var(--ag-toolbar-fg);
      white-space:nowrap;font-variant-numeric:tabular-nums;
      font-size:12px;font-weight:500;letter-spacing:-0.01em;gap:4px;
      transition:background-color .14s ease,color .14s ease,border-color .14s ease,opacity .14s ease,transform .1s cubic-bezier(0.16,1,0.3,1);
      flex-shrink:0;
    }
    .ag-unit:hover,.ag-unit:focus-visible,.ag-unit[aria-expanded="true"]{
      background:var(--ag-toolbar-bg-hover);
      color:var(--ag-toolbar-fg-hover);
    }
    .ag-unit:active{
      background:var(--ag-toolbar-bg-active);
      transform:scale(0.96);
    }

    /* 单元 1: 上下文小圆环按钮（按内容自适应，圆环+百分比共存） */
    #badge.ag-unit-ring{
      width:auto!important;
      min-width:28px;
      height:28px;
      padding:0 6px 0 4px;
      gap:3px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }
    :host([data-layout="ring-only"]) #badge.ag-unit-ring{
      width:28px!important;
      min-width:28px!important;
      padding:0!important;
      gap:0!important;
    }
    .ring-svg{
      width:18px;height:18px;display:block;flex-shrink:0;overflow:visible;
    }
    .ring-track{
      stroke:var(--ag-custom-ring-track,var(--ag-ring-track-default));
    }
    .ring-fill{
      stroke:var(--ag-custom-ring-used,var(--ag-ring-used-default));
      transition:stroke-dasharray .22s ease,opacity .15s ease;
    }
    :host([data-occupancy="warn"]) .ring-fill{
      stroke:var(--ag-ring-warn);
    }
    :host([data-occupancy="danger"]) .ring-fill{
      stroke:var(--ag-ring-danger);
    }

    /* 单元 2: 输出速度 */
    #badge-speed{
      color:var(--ag-custom-speed,var(--ag-speed-default));
      min-width:54px;
      justify-content:flex-start;
    }
    #badge-speed:hover,#badge-speed:focus-visible,#badge-speed[aria-expanded="true"]{
      color:var(--ag-custom-speed,var(--ag-toolbar-fg-hover));
    }
    .speed-icon{
      width:13px;height:13px;display:inline-flex;align-items:center;justify-content:center;
      flex-shrink:0;opacity:0.88;font-size:11.5px;line-height:1;
    }
    #speed-amount{
      font-variant-numeric:tabular-nums;
      display:inline-block;
      min-width:32px;
      text-align:left;
      color:inherit;
    }

    /* 单元 3: 累计 Token 用量 */
    #badge-tokens{
      color:var(--ag-custom-token-total,var(--ag-token-total-default));
      min-width:68px;
      justify-content:flex-start;
    }
    #badge-tokens:hover,#badge-tokens:focus-visible,#badge-tokens[aria-expanded="true"]{
      color:var(--ag-custom-token-total,var(--ag-toolbar-fg-hover));
    }
    .token-fire-dot{
      width:13px;height:13px;display:inline-flex;align-items:center;justify-content:center;
      color:var(--ag-custom-token-accent,var(--ag-token-accent-default));
      flex-shrink:0;opacity:0.95;
    }
    .badge-pct-val{
      font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;
      color:var(--ag-custom-context-text,var(--ag-context-text-default));
      padding-left:2px;
    }
    :host([data-layout="ring-only"]) .badge-pct-val{
      display:none!important;
    }
    #token-amount{
      font-variant-numeric:tabular-nums;
      display:inline-block;
      min-width:38px;
      text-align:left;
      color:inherit;
    }

    /* 下拉选择框与选项在深浅主题下的高对比度保底 */
    select {
      background-color: var(--ag-bg-input, rgba(255,255,255,0.08)) !important;
      color: var(--ag-text-primary, #ececef) !important;
      border: 1px solid var(--ag-border-subcard, rgba(255,255,255,0.15)) !important;
      border-radius: 4px;
      outline: none;
      color-scheme: dark;
    }
    :host([data-theme="light"]) select,
    :host([data-panel-tone="light"]) select {
      background-color: var(--ag-bg-input, #f4f4f5) !important;
      color: var(--ag-text-primary, #18181b) !important;
      border-color: var(--ag-border-subcard, rgba(0,0,0,0.15)) !important;
      color-scheme: light;
    }
    select option {
      background-color: var(--ag-select-option-bg, #27272a) !important;
      color: var(--ag-select-option-fg, #f4f4f5) !important;
    }
    :host([data-theme="light"]) select option,
    :host([data-panel-tone="light"]) select option {
      background-color: #ffffff !important;
      color: #18181b !important;
    }

    :host([data-theme="light"][data-theme-mode="auto"]){
      --ag-bg-panel-default:var(--ag-host-bg,var(--background,#ffffff));
    }

    /* 数据来源分段切换栏 & 药丸切换按钮（深/浅色清晰选中态区分） */
    .source-switch-bar,.view-switch-bar{
      display:inline-flex;align-items:center;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:7px;padding:2px;gap:3px;
    }
    :host([data-theme="light"]) .source-switch-bar,
    :host([data-theme="light"]) .view-switch-bar{
      background:rgba(0,0,0,0.05);
      border-color:rgba(0,0,0,0.10);
    }
    .switch-pill-btn{
      border:1px solid transparent;background:transparent;color:var(--ag-text-muted);
      font-size:11px;font-weight:500;padding:3px 9px;border-radius:5px;cursor:pointer;
      transition:background-color .14s ease,color .14s ease,border-color .14s ease,box-shadow .14s ease;
      white-space:nowrap;line-height:1.35;
    }
    .switch-pill-btn:hover{
      color:var(--ag-text-primary);
      background:rgba(255,255,255,0.08);
    }
    :host([data-theme="light"]) .switch-pill-btn:hover{
      background:rgba(0,0,0,0.06);
    }
    .switch-pill-btn.active{
      background:rgba(167,139,250,0.22);
      color:#ffffff;
      border-color:rgba(167,139,250,0.48);
      font-weight:600;
      box-shadow:0 1px 3px rgba(0,0,0,0.28);
    }
    :host([data-theme="light"]) .switch-pill-btn.active{
      background:#ffffff;
      color:#6d28d9;
      border-color:rgba(124,58,237,0.34);
      box-shadow:0 1px 3px rgba(124,58,237,0.16),0 1px 2px rgba(0,0,0,0.08);
    }
    .panel-header-actions .switch-pill-btn{
      border:1px solid var(--ag-btn-border);
      background:var(--ag-bg-input);
      color:var(--ag-text-secondary);
      border-radius:6px;
      padding:3px 9px;
      font-size:11px;
    }
    .panel-header-actions .switch-pill-btn:hover{
      background:var(--ag-btn-hover);
      border-color:var(--ag-btn-border-hover);
      color:var(--ag-text-primary);
    }

    /* 单元 4: 一键启动 CLI 按钮 */
    #badge-cli{
      color:var(--ag-toolbar-fg);
      min-width:44px;
      padding:0 6px;
      gap:3px;
      justify-content:center;
      transition: transform 0.08s cubic-bezier(0.2, 0, 0, 1), background-color 0.12s ease, opacity 0.12s ease;
      user-select: none;
      -webkit-user-select: none;
    }
    #badge-cli:hover,#badge-cli:focus-visible{
      color:var(--ag-toolbar-fg-hover);
    }
    #badge-cli:active,
    #badge-cli[data-pressed="true"]{
      transform: scale(0.92);
      background: rgba(127, 127, 127, 0.16);
    }
    #badge-cli[data-busy="true"]{
      cursor: wait;
      pointer-events: none;
    }
    #badge-cli[data-busy="true"] .cli-icon{
      animation: ag-cli-pulse 0.8s ease-in-out infinite alternate;
    }
    @keyframes ag-cli-pulse {
      0% { transform: scale(0.9); opacity: 0.6; }
      100% { transform: scale(1.15); opacity: 1; }
    }
    .cli-icon{
      font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
      font-size:10.5px;font-weight:700;
      color:var(--ag-custom-token-accent,var(--ag-token-accent-default));
      line-height:1;
      display: inline-block;
      transition: transform 0.15s ease;
    }

    /* CLI 启动状态提示浮层 */
    #cli-launch-toast{
      position:fixed;top:38px;right:140px;z-index:2147483650;
      max-width:360px;padding:7px 11px;border-radius:8px;
      border:1px solid var(--ag-float-border);
      background:var(--ag-float-bg);color:var(--ag-text-primary);
      box-shadow:var(--ag-float-shadow);font-size:11.5px;line-height:1.4;
      pointer-events:auto;transition:opacity .15s ease,transform .15s ease;
    }
    #cli-launch-toast[hidden]{display:none!important}
    #cli-launch-toast[data-tone="error"]{
      border-color:rgba(239,68,68,0.45);
      color:#f87171;
    }
    :host([data-theme="light"]) #cli-launch-toast[data-tone="error"]{
      color:#dc2626;
    }

    /* 单元 5: 窄屏溢出菜单入口 */
    #badge-overflow{
      width:28px;height:28px;padding:0;display:none;
    }
    .overflow-icon{
      width:16px;height:16px;display:block;
    }

    /* 渐进式宽度收缩四阶段: wide -> compact -> minimal -> ring-only */
    :host([data-layout="compact"]){
      gap:1px;
    }
    :host([data-layout="compact"]) #badge-speed,
    :host([data-layout="compact"]) #badge-tokens,
    :host([data-layout="compact"]) #badge-cli{
      padding:0 5px;font-size:11.5px;gap:3px;
    }
    :host([data-layout="minimal"]) #badge-speed,
    :host([data-layout="minimal"]) #badge-tokens,
    :host([data-layout="minimal"]) #badge-cli{
      display:none!important;
    }
    :host([data-layout="minimal"]) #badge-overflow{
      display:inline-flex!important;
    }
    :host([data-layout="ring-only"]) #badge-speed,
    :host([data-layout="ring-only"]) #badge-tokens,
    :host([data-layout="ring-only"]) #badge-cli,
    :host([data-layout="ring-only"]) #badge-overflow{
      display:none!important;
    }

    /* 上下文悬停信息气泡（严格还原参考图三层结构） */
    #context-tooltip{
      position:fixed;top:0;left:0;z-index:2147483600;
      min-width:166px;max-width:268px;padding:9px 13px;
      border-radius:10px;border:1px solid var(--ag-float-border);
      background:var(--ag-float-bg);color:var(--ag-text-primary);
      box-shadow:var(--ag-float-shadow);
      pointer-events:none;opacity:0;visibility:hidden;
      transform:translateY(2px);
      transition:opacity .12s ease,transform .12s ease,visibility .12s ease;
      font-variant-numeric:tabular-nums;
    }
    #context-tooltip[data-visible="true"]{
      opacity:1;visibility:visible;transform:translateY(0);
    }
    .ctx-tip-title{
      font-size:12px;line-height:1.35;font-weight:500;
      color:var(--ag-text-muted);margin-bottom:2px;
    }
    .ctx-tip-pct{
      font-size:13px;line-height:1.38;font-weight:600;
      color:var(--ag-custom-context-text,var(--ag-context-text-default));
    }
    :host([data-occupancy="warn"]) .ctx-tip-pct{
      color:var(--ag-ring-warn);
    }
    :host([data-occupancy="danger"]) .ctx-tip-pct{
      color:var(--ag-ring-danger);
    }
    .ctx-tip-detail{
      font-size:12.5px;line-height:1.38;font-weight:500;
      color:var(--ag-custom-context-text,var(--ag-text-secondary));
      margin-top:1px;
    }

    /* 窄屏溢出菜单浮层 */
    #overflow-menu{
      position:fixed;top:36px;right:12px;z-index:2147483500;
      width:220px;padding:6px;border-radius:10px;
      border:1px solid var(--ag-float-border);
      background:var(--ag-float-bg);color:var(--ag-text-primary);
      box-shadow:var(--ag-float-shadow);
    }
    #overflow-menu[hidden]{display:none!important}
    .overflow-item{
      width:100%;display:flex;align-items:center;justify-content:space-between;
      padding:7px 9px;border-radius:7px;font-size:12px;color:var(--ag-text-secondary);
      text-align:left;transition:background-color .12s ease,color .12s ease;
    }
    .overflow-item:hover,.overflow-item:focus-visible{
      background:var(--ag-toolbar-bg-hover);color:var(--ag-text-primary);
    }
    .overflow-item-label{display:flex;align-items:center;gap:6px;font-weight:500}
    .overflow-item-val{font-weight:600;font-variant-numeric:tabular-nums;color:var(--ag-text-primary)}

    /* 详情二级抽屉折叠交互 */
    .tech-drawer{margin-top:10px;border-top:1px solid var(--ag-border-subtle);padding-top:9px}
    .drawer-trigger{
      width:100%;display:flex;justify-content:space-between;align-items:center;
      background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);
      border-radius:7px;padding:7px 11px;color:var(--ag-text-secondary);font-size:11.5px;font-weight:500;
      cursor:pointer;transition:background-color .15s ease,border-color .15s ease,color .15s ease;
    }
    .drawer-trigger:hover{background:var(--ag-bg-card-hover);color:var(--ag-text-primary);border-color:var(--ag-border-card)}
    .drawer-trigger-left{display:flex;align-items:center;gap:6px}
    .drawer-arrow{font-size:11px;color:var(--ag-text-muted);font-weight:600}
    .drawer-body{margin-top:9px}

    /* 自定义颜色设置网格与自定义颜色选取器面板 */
    .color-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:6px}
    .color-item{
      display:flex;align-items:center;justify-content:space-between;gap:6px;
      padding:6px 8px;border-radius:6px;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);
    }
    .color-item-lbl{font-size:11px;color:var(--ag-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .color-item-ctrls{display:flex;align-items:center;gap:4px;flex-shrink:0}
    .color-picker{display:none!important}
    .color-swatch-btn{
      width:20px;height:20px;padding:0;border:1px solid var(--ag-border-card);
      border-radius:4px;background:var(--swatch-color,#7748cf);cursor:pointer;
      display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,0.18);transition:transform .12s ease,border-color .12s ease;
    }
    .color-swatch-btn:hover{transform:scale(1.08);border-color:var(--ag-text-primary)}
    .color-reset-btn{
      font-size:10.5px;padding:2px 6px;border-radius:4px;
      border:1px solid var(--ag-btn-border);background:var(--ag-btn-bg);color:var(--ag-text-muted);
    }
    .color-reset-btn:hover{color:var(--ag-text-primary);background:var(--ag-btn-hover)}
    .color-reset-btn[data-mode="auto"]{opacity:0.55}

    
    /* 弹出面板：上下文 (#panel) 与 Token 用量一览 (#panel-tokens) 独立面板 */
    .ag-panel{
      box-sizing:border-box;
      position:fixed;top:38px;left:auto;right:16px;z-index:2147483500;
      max-width:calc(100vw - 24px);max-height:calc(100vh - 52px);
      overflow:auto;border:1px solid var(--ag-border-panel);border-radius:10px;
      background:var(--ag-bg-panel);color:var(--ag-text-primary);box-shadow:var(--ag-shadow-panel);padding:14px;
      opacity:1;transform:translateY(0);visibility:visible;pointer-events:auto;
      transform-origin:top right;
      transition:opacity .16s cubic-bezier(0.16,1,0.3,1),transform .16s cubic-bezier(0.16,1,0.3,1),visibility .16s ease;
      contain:layout paint;
    }
    #panel{width:468px}
    #panel-tokens{width:730px;transition:width .22s cubic-bezier(0.16,1,0.3,1),left .22s cubic-bezier(0.16,1,0.3,1),max-width .22s cubic-bezier(0.16,1,0.3,1),opacity .16s cubic-bezier(0.16,1,0.3,1),transform .16s cubic-bezier(0.16,1,0.3,1)}
    #panel-tokens.cost-compact-view{width:400px!important;max-width:calc(100vw - 24px)}
    .ag-panel[hidden]{display:block!important;opacity:0;transform:translateY(-6px);visibility:hidden;pointer-events:none}

    /* 视图内平滑交叉淡入淡出（避免直接 display 硬切导致内容跳闪） */
    @keyframes agFadeIn{
      from{opacity:0;transform:translateY(4px)}
      to{opacity:1;transform:translateY(0)}
    }
    .view-pane-fade{transition:opacity .15s ease,transform .15s ease;opacity:1;transform:translateY(0)}
    .view-pane-fade.pane-hidden{opacity:0;transform:translateY(3px);display:none!important}

    /* 顶栏控制条（sticky 固定，防止表单或详情展开时滚出视口） */
    .panel-header-bar{
      position:sticky;top:-14px;background:var(--ag-bg-panel);z-index:20;
      margin-top:-14px;padding-top:14px;
      display:flex;justify-content:space-between;align-items:center;
      border-bottom:1px solid var(--ag-border-subtle);padding-bottom:9px;margin-bottom:11px
    }
    .panel-title{display:flex;align-items:center;gap:5px}
    .panel-title-tokens{color:var(--ag-custom-token-accent,var(--ag-token-accent-default))}
    .panel-header-actions{display:flex;align-items:center;gap:4px}

    .panel-icon-btn{
      background:none;border:0;color:var(--ag-text-muted);font-size:12px;line-height:1;
      padding:4px 7px;border-radius:6px;cursor:pointer;transition:background-color .14s ease,color .14s ease;
      display:inline-flex;align-items:center;justify-content:center;gap:3px;
    }
    .panel-icon-btn:hover{color:var(--ag-text-primary);background:var(--ag-toolbar-bg-hover)}
    #close,#close-tokens{font-size:16px;padding:2px 7px}

    h3{margin:0;font-size:13px;font-weight:600;color:var(--ag-text-primary)}
    h4{margin:12px 0 5px;font-size:11.5px;font-weight:600;color:var(--ag-text-secondary)}
    p{margin:5px 0;color:var(--ag-text-muted)}
    .drawer-body dl{display:grid;grid-template-columns:1fr auto;gap:5px;margin:0}
    .drawer-body dt{color:var(--ag-text-muted)}
    .drawer-body dd{margin:0;text-align:right;color:var(--ag-text-primary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;max-width:270px}

    #key-summary{background:var(--ag-bg-card);border:1px solid var(--ag-border-card);border-radius:8px;padding:11px 12px;margin:6px 0 10px}
    .key-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
    .key-title{font-size:12px;font-weight:600;color:var(--ag-text-primary);display:flex;align-items:center;gap:5px}
    .key-pill{font-size:11px;font-weight:600;padding:1px 8px;border-radius:10px;border:1px solid transparent}
    .pill-good, .pill-ok{color:#52c41a;background:rgba(82,196,26,0.12);border-color:rgba(82,196,26,0.28)}
    :host([data-theme="light"]) .pill-good, :host([data-theme="light"]) .pill-ok{color:#389e0d;background:#f6ffed;border-color:#b7eb8f}
    .pill-info{color:#1890ff;background:rgba(24,144,255,0.12);border-color:rgba(24,144,255,0.28)}
    :host([data-theme="light"]) .pill-info{color:#096dd9;background:#e6f7ff;border-color:#91d5ff}
    .pill-warn{color:#faad14;background:rgba(250,173,20,0.12);border-color:rgba(250,173,20,0.28)}
    :host([data-theme="light"]) .pill-warn{color:#d46b08;background:#fff7e6;border-color:#ffd591}
    .pill-danger{color:#ff4d4f;background:rgba(255,77,79,0.14);border-color:rgba(255,77,79,0.32)}
    :host([data-theme="light"]) .pill-danger{color:#cf1322;background:#fff1f0;border-color:#ffa39e}
    .pill-muted{color:var(--ag-pill-muted-text);background:var(--ag-pill-muted-bg);border-color:var(--ag-pill-muted-border)}

    .key-bar-track{width:100%;height:6px;background:var(--ag-custom-ring-track,var(--ag-track-bg));border-radius:3px;overflow:hidden;margin-bottom:9px}
    .key-bar-fill{height:100%;width:0%;border-radius:3px;background:var(--ag-custom-ring-used,var(--bar-color,#69c0ff));transition:width .24s ease,background-color .2s ease}
    :host([data-occupancy="warn"]) .key-bar-fill{background:var(--ag-ring-warn)}
    :host([data-occupancy="danger"]) .key-bar-fill{background:var(--ag-ring-danger)}
    .key-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-bottom:7px}
    .key-stat{background:var(--ag-bg-subcard);padding:6px 4px;border-radius:6px;border:1px solid var(--ag-border-subcard)}
    .key-stat-label{font-size:10px;color:var(--ag-text-muted);margin-bottom:2px}
    .key-stat-val{font-size:12px;font-weight:600;color:var(--ag-text-primary);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #key-used{color:var(--ag-custom-context-text,var(--ag-text-primary))}
    .key-takeaway{font-size:11px;color:var(--ag-text-secondary);padding-top:6px;border-top:1px solid var(--ag-border-subcard);line-height:1.4}

    #status{padding:7px 10px;border:0;border-left:2.5px solid var(--tone,#666);border-radius:4px;background:var(--ag-bg-status);color:var(--ag-text-status);font-weight:500;font-size:11.5px}
    #model{overflow-wrap:anywhere;font-size:11.5px;color:var(--ag-text-muted)}
    #note,#coverage,#updated{font-size:11px;color:var(--ag-text-muted)}
    #refresh{border:1px solid var(--ag-btn-border);border-radius:6px;background:var(--ag-btn-bg);color:var(--ag-btn-text);padding:4px 10px;margin-top:8px;transition:background-color .14s ease,border-color .14s ease}
    #refresh:hover:not(:disabled){background:var(--ag-btn-hover);border-color:var(--ag-btn-border-hover)}

    #files{max-height:220px;overflow:auto}
    .file{padding:7px 0;border-top:1px solid var(--ag-border-subtle)}
    .file-name{overflow-wrap:anywhere;color:var(--ag-text-primary)}
    .file-detail{color:var(--ag-text-muted);font-size:11px}
    .file-unknown{color:#e6b865;font-size:11px}
    :host([data-theme="light"]) .file-unknown{color:#b45309}
    #v{color:var(--ag-text-muted);font-size:10px;font-weight:400;margin-left:6px}

    /* 全局 Token 用量一览 */
    #view-tokens{display:flex;flex-direction:column;gap:10px}
    .token-stat-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .t-card{background:var(--ag-bg-card);border:1px solid var(--ag-border-card);border-radius:8px;padding:10px;display:flex;flex-direction:column;justify-content:space-between;gap:4px;transition:background-color .14s ease}
    .t-card:hover{background:var(--ag-bg-card-hover)}
    .t-card-lbl{font-size:11px;color:var(--ag-text-muted);display:flex;justify-content:space-between}
    .t-card-val{font-size:16.5px;font-weight:700;color:var(--ag-text-primary);letter-spacing:-0.3px;font-variant-numeric:tabular-nums}
    #t-total-val{color:var(--ag-custom-token-total,var(--ag-text-primary))}
    #t-today-val{color:var(--ag-custom-token-accent,var(--ag-text-primary))}
    .t-card-sub{font-size:10px;color:var(--ag-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t-card-cost{font-size:9.5px;color:var(--ag-text-secondary);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}

    .heatmap-section{background:var(--ag-heat-bg);border:1px solid var(--ag-border-card);border-radius:10px;padding:12px}
    .heat-header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .heat-header-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .heat-title{font-size:13px;font-weight:600;color:var(--ag-text-primary)}
    .first-use-badge{
      font-size:11px;font-weight:500;color:var(--ag-text-secondary);
      background:var(--ag-bg-subcard);border:1px solid var(--ag-border-card);
      border-radius:6px;padding:2px 8px;font-variant-numeric:tabular-nums;
    }
    .heat-win-nav{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ag-text-muted);font-variant-numeric:tabular-nums}
    .heat-nav-btn{
      border:1px solid var(--ag-btn-border);background:var(--ag-btn-bg);color:var(--ag-text-secondary);
      border-radius:4px;padding:1px 6px;font-size:11px;line-height:1.25;cursor:pointer;
    }
    .heat-nav-btn:hover:not(:disabled){background:var(--ag-btn-hover);color:var(--ag-text-primary)}
    .heat-nav-btn:disabled{opacity:0.35;cursor:default}
    .heat-tabs{
      position:relative;display:inline-flex;align-items:center;
      background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);
      border-radius:9999px;padding:2px;gap:2px;user-select:none;
    }
    .heat-tab-thumb{
      position:absolute;top:2px;bottom:2px;left:0;width:0;
      border-radius:9999px;
      background:var(--ag-tab-thumb-bg, var(--ag-custom-token-accent, var(--ag-token-accent-default, #a78bfa)));
      opacity:0.25;pointer-events:none;
      transition:transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), width 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
      will-change:transform, width;
    }
    /* 上下文加长面板样式 */
    .unlock-panel-content{padding:4px 0 2px;display:flex;flex-direction:column;gap:8px}
    .unlock-status-row{display:flex;justify-content:space-between;align-items:flex-start;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);border-radius:6px;padding:8px 10px}
    .unlock-label{font-size:11px;font-weight:600;color:var(--ag-text-primary);margin-bottom:2px}
    .unlock-desc{font-size:11px;color:var(--ag-text-secondary);line-height:1.4}
    .unlock-notice{background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.22);border-radius:6px;padding:7px 9px}
    .unlock-notice-title{font-size:10.5px;font-weight:600;color:#eab308;margin-bottom:3px}
    .unlock-notice-list{margin:0;padding-left:14px;font-size:10px;color:var(--ag-text-secondary);line-height:1.4}
    .unlock-notice-list li{margin-bottom:2px}
    .unlock-notice-list strong{color:var(--ag-text-primary)}
    .unlock-actions-row{display:flex;gap:8px;align-items:center;margin-top:2px}
    .unlock-btn{display:inline-flex;align-items:center;justify-content:center;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease}
    .unlock-btn:disabled{opacity:0.5;cursor:not-allowed}
    .unlock-btn-primary{background:#2563eb;color:#fff;border:1px solid #1d4ed8}
    .unlock-btn-primary:hover:not(:disabled){background:#1d4ed8}
    .unlock-btn-secondary{background:var(--ag-bg-subcard);color:var(--ag-text-primary);border:1px solid var(--ag-border-subcard)}
    .unlock-btn-secondary:hover:not(:disabled){background:var(--ag-bg-card-hover)}
    .unlock-result-box{border-radius:6px;padding:7px 9px;font-size:11px;line-height:1.4}
    .unlock-result-box.result-success{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
    .unlock-result-box.result-error{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444}
    .unlock-meta-dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:10.5px;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);border-radius:6px;padding:7px 10px;margin:2px 0}
    .unlock-meta-dl dt{color:var(--ag-text-muted);font-weight:500}
    .unlock-meta-dl dd{margin:0;color:var(--ag-text-secondary);word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
    .unlock-credit-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;color:var(--ag-text-muted);border-top:1px dashed var(--ag-border-subtle);padding-top:7px;margin-top:4px}
    .unlock-credit-left{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .unlock-author-link{color:var(--ag-link,#38bdf8);text-decoration:underline;text-underline-offset:2px;font-weight:600;cursor:pointer;padding:1px 4px;border-radius:4px;transition:all .15s ease;display:inline-flex;align-items:center}
    .unlock-author-link:hover{color:#7dd3fc;background:rgba(56,189,248,0.12)}
    .unlock-author-link:focus-visible{outline:2px solid var(--ag-link,#38bdf8);background:rgba(56,189,248,0.18)}
    .unlock-copy-link-btn{background:transparent;border:1px solid var(--ag-border-subcard);color:var(--ag-text-muted);border-radius:4px;font-size:10px;padding:1px 6px;cursor:pointer;transition:all .15s ease}
    .unlock-copy-link-btn:hover{color:var(--ag-text-primary);border-color:var(--ag-text-muted);background:var(--ag-bg-card-hover)}
    .unlock-copy-link-btn:focus-visible{outline:1px solid var(--ag-link,#38bdf8)}
    .unlock-link-toast{margin-top:4px;font-size:10px;padding:4px 8px;border-radius:4px;background:rgba(56,189,248,0.12);color:var(--ag-text-primary);border:1px solid rgba(56,189,248,0.3);line-height:1.4;animation:agSmoothExpand 0.15s ease}
    .unlock-adapter-note{font-size:9.5px;opacity:0.8}

    @media (prefers-reduced-motion: reduce){
      .heat-tab-thumb{transition:none!important}
    }
    .heat-tab-btn{
      position:relative;z-index:1;border:0;background:transparent;
      color:var(--ag-text-muted);font-size:11px;font-weight:500;
      padding:3px 10px;border-radius:9999px;cursor:pointer;
      transition:color .14s ease;outline:none;white-space:nowrap;
    }
    .heat-tab-btn:hover{color:var(--ag-text-primary)}
    .heat-tab-btn.active{color:var(--ag-text-primary);font-weight:600}
    .heat-tab-btn:focus-visible{box-shadow:0 0 0 1.5px var(--ag-token-accent-default,#a78bfa)}

    .heat-scroll-box{overflow-x:auto;overflow-y:hidden;padding:6px 6px 4px 6px}
    .heat-grid-cols{display:flex;gap:3px}
    .heat-week-col{display:flex;flex-direction:column;gap:3px}
    .heat-cell{width:10px;height:10px;border-radius:2px;background:var(--ag-heat-lvl-0);cursor:pointer;transition:transform .12s ease}
    .heat-cell:hover{transform:scale(1.3);z-index:5;outline:1.5px solid var(--ag-heat-outline)}
    .heat-cell.is-future{opacity:0.36}
    .heat-cell.is-today{outline:1.5px solid var(--ag-custom-token-accent,var(--ag-token-accent-default));outline-offset:0.5px}
    .lvl-0{background:var(--ag-heat-lvl-0)}
    .lvl-1{background:var(--ag-heat-lvl-1)}
    .lvl-2{background:var(--ag-heat-lvl-2)}
    .lvl-3{background:var(--ag-heat-lvl-3)}
    .lvl-4{background:var(--ag-heat-lvl-4)}

    .heat-months{position:relative;height:18px;margin-top:4px;font-size:11px;color:var(--ag-text-muted);overflow:hidden}
    .heat-month-item{position:absolute;white-space:nowrap}

    #h-weekly-box{display:none;height:105px;align-items:flex-end;gap:3px;border-bottom:1px solid var(--ag-border-subtle);padding-bottom:3px}
    .w-bar-col{flex:1;height:100%;display:flex;align-items:flex-end;cursor:pointer}
    .w-bar-fill{width:100%;border-radius:2px 2px 0 0;background:var(--ag-heat-lvl-0);min-height:3px;transition:height .22s ease,background-color .14s ease}
    .w-bar-col:hover .w-bar-fill{background:var(--ag-custom-token-accent,var(--ag-heat-lvl-4))!important}

    #h-monthly-box{display:none;height:105px;width:100%;box-sizing:border-box;align-items:center;justify-content:center}
    .heat-month-grid{display:grid;width:100%;height:100%;align-content:center;justify-content:center}
    .heat-month-cell{display:flex;align-items:center;justify-content:center;border-radius:3px;cursor:pointer;transition:transform .12s ease}
    .heat-month-cell:hover{transform:scale(1.18);z-index:5;outline:1.5px solid var(--ag-heat-outline,#fff)}
    .heat-month-cell-num{font-size:9.5px;font-weight:600;color:rgba(255,255,255,0.9);text-shadow:0 1px 2px rgba(0,0,0,0.65);pointer-events:none}
    :host([data-theme="light"]) .heat-month-cell-num{color:#18181b;text-shadow:none}

    #h-yearly-box{display:none;height:105px;width:100%;box-sizing:border-box;align-items:center;justify-content:center}
    .heat-yearly-svg{width:100%;height:105px;display:block;overflow:visible}
    @keyframes bubblePopIn{0%{transform:scale(0.6);opacity:0}100%{transform:scale(1);opacity:1}}
    .heat-yearly-bubble-group{transform-origin:center center;animation:bubblePopIn 0.22s cubic-bezier(0.16,1,0.3,1) both;cursor:pointer}
    /* 上下文加长面板样式 */
    .unlock-panel-content{padding:4px 0 2px;display:flex;flex-direction:column;gap:8px}
    .unlock-status-row{display:flex;justify-content:space-between;align-items:flex-start;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);border-radius:6px;padding:8px 10px}
    .unlock-label{font-size:11px;font-weight:600;color:var(--ag-text-primary);margin-bottom:2px}
    .unlock-desc{font-size:11px;color:var(--ag-text-secondary);line-height:1.4}
    .unlock-notice{background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.22);border-radius:6px;padding:7px 9px}
    .unlock-notice-title{font-size:10.5px;font-weight:600;color:#eab308;margin-bottom:3px}
    .unlock-notice-list{margin:0;padding-left:14px;font-size:10px;color:var(--ag-text-secondary);line-height:1.4}
    .unlock-notice-list li{margin-bottom:2px}
    .unlock-notice-list strong{color:var(--ag-text-primary)}
    .unlock-actions-row{display:flex;gap:8px;align-items:center;margin-top:2px}
    .unlock-btn{display:inline-flex;align-items:center;justify-content:center;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease}
    .unlock-btn:disabled{opacity:0.5;cursor:not-allowed}
    .unlock-btn-primary{background:#2563eb;color:#fff;border:1px solid #1d4ed8}
    .unlock-btn-primary:hover:not(:disabled){background:#1d4ed8}
    .unlock-btn-secondary{background:var(--ag-bg-subcard);color:var(--ag-text-primary);border:1px solid var(--ag-border-subcard)}
    .unlock-btn-secondary:hover:not(:disabled){background:var(--ag-bg-card-hover)}
    .unlock-result-box{border-radius:6px;padding:7px 9px;font-size:11px;line-height:1.4}
    .unlock-result-box.result-success{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
    .unlock-result-box.result-error{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444}
    .unlock-meta-dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:10.5px;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);border-radius:6px;padding:7px 10px;margin:2px 0}
    .unlock-meta-dl dt{color:var(--ag-text-muted);font-weight:500}
    .unlock-meta-dl dd{margin:0;color:var(--ag-text-secondary);word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
    .unlock-credit-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;color:var(--ag-text-muted);border-top:1px dashed var(--ag-border-subtle);padding-top:7px;margin-top:4px}
    .unlock-credit-left{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .unlock-author-link{color:var(--ag-link,#38bdf8);text-decoration:underline;text-underline-offset:2px;font-weight:600;cursor:pointer;padding:1px 4px;border-radius:4px;transition:all .15s ease;display:inline-flex;align-items:center}
    .unlock-author-link:hover{color:#7dd3fc;background:rgba(56,189,248,0.12)}
    .unlock-author-link:focus-visible{outline:2px solid var(--ag-link,#38bdf8);background:rgba(56,189,248,0.18)}
    .unlock-copy-link-btn{background:transparent;border:1px solid var(--ag-border-subcard);color:var(--ag-text-muted);border-radius:4px;font-size:10px;padding:1px 6px;cursor:pointer;transition:all .15s ease}
    .unlock-copy-link-btn:hover{color:var(--ag-text-primary);border-color:var(--ag-text-muted);background:var(--ag-bg-card-hover)}
    .unlock-copy-link-btn:focus-visible{outline:1px solid var(--ag-link,#38bdf8)}
    .unlock-link-toast{margin-top:4px;font-size:10px;padding:4px 8px;border-radius:4px;background:rgba(56,189,248,0.12);color:var(--ag-text-primary);border:1px solid rgba(56,189,248,0.3);line-height:1.4;animation:agSmoothExpand 0.15s ease}
    .unlock-adapter-note{font-size:9.5px;opacity:0.8}

    @media (prefers-reduced-motion: reduce){.heat-yearly-bubble-group{animation:none!important}}
    .heat-yearly-bubble-group:hover circle.bubble-main{filter:brightness(1.22);stroke:var(--ag-text-primary);stroke-width:1.5px}

    #h-cum-box{display:none;height:105px;position:relative}
    canvas#h-cum-canvas{width:100%;height:105px;display:block}

    .heat-summary-bar{
      display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;
      margin-top:8px;padding:5px 8px;background:var(--ag-bg-subcard);border-radius:6px;
      border:1px solid var(--ag-border-subcard);font-size:11px;
    }
    .heat-sum-item{display:inline-flex;align-items:center;gap:4px}
    .heat-sum-label{color:var(--ag-text-muted);font-size:10px}
    .heat-sum-val{color:var(--ag-text-primary);font-weight:600;font-variant-numeric:tabular-nums}
    .heat-cost-disclaimer{font-size:9.5px;color:var(--ag-text-muted);margin-top:4px;line-height:1.35}

    .update-btn{position:relative}
    .update-badge-dot{
      position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;
      background:#ef4444;box-shadow:0 0 0 1.5px var(--ag-bg-panel);
    }
    .update-popover{
      position:fixed;top:80px;right:24px;width:290px;max-width:calc(100vw - 28px);
      background:var(--ag-unified-bg,#1e1e24);border:1px solid var(--ag-float-border,rgba(255,255,255,0.18));
      border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3);
      padding:11px 13px;z-index:2147483647;
      animation:agSmoothExpand 0.2s cubic-bezier(0.16,1,0.3,1);
    }
    .update-pop-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;border-bottom:1px solid var(--ag-border-subcard);padding-bottom:5px}
    .update-pop-body{font-size:11px;color:var(--ag-text-secondary);line-height:1.45;max-height:130px;overflow-y:auto;white-space:pre-wrap;margin-bottom:9px}
    .update-pop-footer{display:flex;align-items:center;justify-content:flex-end;gap:6px}

    .heat-preset-bar{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin:6px 0 8px}
    .heat-preset-group{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    .heat-preset-btn{
      display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;
      border:1px solid var(--ag-border-card);background:var(--ag-bg-subcard);color:var(--ag-text-secondary);
      font-size:11px;cursor:pointer;transition:border-color .12s ease,color .12s ease;
    }
    .heat-preset-btn:hover{color:var(--ag-text-primary);border-color:var(--ag-btn-border-hover)}
    .heat-preset-btn[data-active="true"]{
      color:var(--ag-text-primary);border-color:var(--ag-custom-token-accent,var(--ag-token-accent-default));
      font-weight:600;
    }
    .heat-preset-dots{display:inline-flex;gap:2px}
    .heat-preset-dots i{width:7px;height:7px;border-radius:1.5px;display:inline-block}

    .heat-leg-swatch{
      width:11px;height:11px;padding:0;border-radius:2.5px;
      border:1px solid var(--ag-border-card);
      background:var(--swatch-color,var(--ag-heat-lvl-0));
      cursor:pointer;flex-shrink:0;
      transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease;
    }
    .heat-leg-swatch:hover{
      transform:scale(1.32);z-index:2;
      border-color:var(--ag-text-primary);
      box-shadow:0 0 0 1px var(--ag-text-primary);
    }
    .heat-leg-swatch[data-custom="true"]{
      border-color:var(--ag-text-secondary);
    }

    .heat-lvl-custom-bar{
      margin:6px 0 8px;padding:7px 8px;border-radius:7px;
      background:var(--ag-bg-card);border:1px solid var(--ag-border-card);
    }
    .heat-lvl-custom-hdr{
      display:flex;align-items:center;justify-content:space-between;gap:6px;
      margin-bottom:6px;flex-wrap:wrap;
    }
    .heat-lvl-grid{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:6px;
    }
    .heat-lvl-item{
      display:flex;align-items:center;justify-content:space-between;gap:4px;
      padding:5px 7px;border-radius:6px;
      background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);
    }
    .heat-lvl-lbl{
      font-size:10.5px;color:var(--ag-text-secondary);font-weight:500;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }

    .heat-popover{position:fixed;pointer-events:none;background:var(--ag-pop-bg);border:1px solid var(--ag-pop-border);border-radius:8px;padding:7px 11px;box-shadow:var(--ag-pop-shadow);z-index:2147483600;opacity:0;transform:translate(-50%,-100%) translateY(-6px);transition:opacity .12s ease}
    .pop-date{font-size:11.5px;color:var(--ag-pop-muted)}
    .pop-val{font-size:13.5px;font-weight:600;color:var(--ag-pop-text);margin:2px 0 4px}
    .pop-det{font-size:10.5px;color:var(--ag-pop-sub);margin-top:2px;display:flex;gap:12px;align-items:flex-start}
    .pop-det-col{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px}
    .pop-det-val{font-size:11px;font-weight:500;color:var(--ag-pop-sub);font-variant-numeric:tabular-nums;white-space:nowrap}
    .pop-det-trans{font-size:9.5px;color:var(--ag-pop-muted);opacity:0.88;white-space:nowrap;line-height:1.2}

    /* 上下文加长面板样式 */
    .unlock-panel-content{padding:4px 0 2px;display:flex;flex-direction:column;gap:8px}
    .unlock-status-row{display:flex;justify-content:space-between;align-items:flex-start;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);border-radius:6px;padding:8px 10px}
    .unlock-label{font-size:11px;font-weight:600;color:var(--ag-text-primary);margin-bottom:2px}
    .unlock-desc{font-size:11px;color:var(--ag-text-secondary);line-height:1.4}
    .unlock-notice{background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.22);border-radius:6px;padding:7px 9px}
    .unlock-notice-title{font-size:10.5px;font-weight:600;color:#eab308;margin-bottom:3px}
    .unlock-notice-list{margin:0;padding-left:14px;font-size:10px;color:var(--ag-text-secondary);line-height:1.4}
    .unlock-notice-list li{margin-bottom:2px}
    .unlock-notice-list strong{color:var(--ag-text-primary)}
    .unlock-actions-row{display:flex;gap:8px;align-items:center;margin-top:2px}
    .unlock-btn{display:inline-flex;align-items:center;justify-content:center;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease}
    .unlock-btn:disabled{opacity:0.5;cursor:not-allowed}
    .unlock-btn-primary{background:#2563eb;color:#fff;border:1px solid #1d4ed8}
    .unlock-btn-primary:hover:not(:disabled){background:#1d4ed8}
    .unlock-btn-secondary{background:var(--ag-bg-subcard);color:var(--ag-text-primary);border:1px solid var(--ag-border-subcard)}
    .unlock-btn-secondary:hover:not(:disabled){background:var(--ag-bg-card-hover)}
    .unlock-result-box{border-radius:6px;padding:7px 9px;font-size:11px;line-height:1.4}
    .unlock-result-box.result-success{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
    .unlock-result-box.result-error{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444}
    .unlock-meta-dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:10.5px;background:var(--ag-bg-subcard);border:1px solid var(--ag-border-subcard);border-radius:6px;padding:7px 10px;margin:2px 0}
    .unlock-meta-dl dt{color:var(--ag-text-muted);font-weight:500}
    .unlock-meta-dl dd{margin:0;color:var(--ag-text-secondary);word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
    .unlock-credit-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;color:var(--ag-text-muted);border-top:1px dashed var(--ag-border-subtle);padding-top:7px;margin-top:4px}
    .unlock-credit-left{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .unlock-author-link{color:var(--ag-link,#38bdf8);text-decoration:underline;text-underline-offset:2px;font-weight:600;cursor:pointer;padding:1px 4px;border-radius:4px;transition:all .15s ease;display:inline-flex;align-items:center}
    .unlock-author-link:hover{color:#7dd3fc;background:rgba(56,189,248,0.12)}
    .unlock-author-link:focus-visible{outline:2px solid var(--ag-link,#38bdf8);background:rgba(56,189,248,0.18)}
    .unlock-copy-link-btn{background:transparent;border:1px solid var(--ag-border-subcard);color:var(--ag-text-muted);border-radius:4px;font-size:10px;padding:1px 6px;cursor:pointer;transition:all .15s ease}
    .unlock-copy-link-btn:hover{color:var(--ag-text-primary);border-color:var(--ag-text-muted);background:var(--ag-bg-card-hover)}
    .unlock-copy-link-btn:focus-visible{outline:1px solid var(--ag-link,#38bdf8)}
    .unlock-link-toast{margin-top:4px;font-size:10px;padding:4px 8px;border-radius:4px;background:rgba(56,189,248,0.12);color:var(--ag-text-primary);border:1px solid rgba(56,189,248,0.3);line-height:1.4;animation:agSmoothExpand 0.15s ease}
    .unlock-adapter-note{font-size:9.5px;opacity:0.8}

    @media (prefers-reduced-motion: reduce){
      *,.ag-unit,.ring-fill,.key-bar-fill,.ag-panel,#context-tooltip,.heat-cell,.w-bar-fill{
        transition:none!important;animation:none!important;
      }
    }
    @media(max-width:800px){
      #panel{width:calc(100vw - 24px)}
      #panel-tokens:not(.cost-compact-view){width:calc(100vw - 24px)}
    }

/* ─────────────────────────────────────────────────────────────
   极简状态与模型配额监控组件样式规范
   ───────────────────────────────────────────────────────────── */
:host {
  --ag-quota-good: #10b981;
  --ag-quota-warn: #f59e0b;
  --ag-quota-danger: #ef4444;
}

#badge-quota {
  color: var(--ag-quota-good, #10b981);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
}
#badge-quota:hover, #badge-quota:focus-visible, #badge-quota[aria-expanded="true"] {
  color: var(--ag-toolbar-fg-hover);
}
.quota-icon {
  font-size: 12px;
  line-height: 1;
}

:host([data-layout="compact"]) #badge-quota {
  padding: 0 5px; font-size: 11px; gap: 3px;
}
:host([data-layout="minimal"]) #badge-quota {
  display: none !important;
}
:host([data-layout="ring-only"]) #badge-quota {
  display: none !important;
}

.ag-clean-card {
  background: var(--ag-bg-card);
  border: 1px solid var(--ag-border-card);
  border-radius: 8px;
  padding: 11px 12px;
  transition: border-color .15s ease, background-color .15s ease;
}

.quota-model-box {
  background: var(--ag-bg-subcard, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--ag-border-subcard, rgba(0, 0, 0, 0.06));
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
:host([data-theme="dark"]) .quota-model-box,
:host([data-panel-tone="dark"]) .quota-model-box {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.07);
}
.quota-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
}
.quota-model-name {
  font-weight: 600;
  font-size: 11px;
  letter-spacing: -0.015em;
  color: var(--ag-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 6px;
}
.quota-model-pct {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  flex-shrink: 0;
}
.quota-bar-track {
  width: 100%;
  height: 6px;
  background: var(--ag-bar-track, rgba(125, 125, 125, 0.2));
  border-radius: 3px;
  overflow: hidden;
}
.quota-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
}
.quota-row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--ag-text-muted);
}
  </style>

  <!-- 顶部单元 1: 上下文小圆环与已用/上限比例 -->
  <button id="badge" class="ag-unit ag-unit-ring" type="button" aria-label="会话与上下文统计" aria-describedby="context-tooltip" aria-expanded="false" title="当前会话上下文用量（点击展开看板）">
    <svg id="ring-svg" class="ring-svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle id="ring-track" class="ring-track" cx="9" cy="9" r="6.5" fill="none" stroke-width="2.1"></circle>
      <circle id="ring-fill" class="ring-fill" cx="9" cy="9" r="6.5" fill="none" stroke-width="2.1" stroke-linecap="round" transform="rotate(-90 9 9)" stroke-dasharray="3.2 4.97"></circle>
    </svg>
    <span id="badge-pct-val" class="badge-pct-val">--%</span>
    <div id="bar-wrap" class="sr-only" aria-hidden="true"><div id="bar-fill" class="meter-bar-fill"></div></div>
    <span id="amount" class="sr-only">读取中…</span>
    <span id="hover-wrap" class="sr-only"><span id="hover-extra"></span></span>
  </button>

  <!-- 顶部单元 2: 输出速度 (TPS) 与首字延迟 (TTFT) -->
  <button id="badge-speed" class="ag-unit" type="button" aria-label="模型生成速度与首字延迟" aria-expanded="false" title="最新生成速度 (TPS) 与首字延迟 (TTFT)">
    <span class="speed-icon" aria-hidden="true">⚡</span>
    <span id="speed-amount">-- TPS</span>
    <span id="speed-hover-extra" class="sr-only"></span>
  </button>

  <!-- 顶部单元 3: 模型配额余量 (Quota) -->
  <button id="badge-quota" class="ag-unit" type="button" aria-label="模型配额余量" aria-expanded="false" title="当前账号模型配额余量与重置倒计时（点击展开详情）">
    <span class="quota-icon" aria-hidden="true">🛡️</span>
    <span id="quota-amount">额度: --</span>
  </button>

  <!-- 顶部单元 4: 历次 Token 消耗热力图入口 -->
  <button id="badge-tokens" class="ag-unit" type="button" aria-label="历次 Token 消耗热力图" aria-expanded="false" title="查看历次 Token 消耗统计与 52 周热力图">
    <span class="token-fire-dot" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13V9M8 13V4M13 13V7"></path></svg>
    </span>
    <span id="token-amount">热力图</span>
    <span id="token-hover-extra" class="sr-only"></span>
  </button>

  <!-- 顶部单元 5: 隐藏保留旧 CLI 按钮 (仅为 DOM 兼容) -->
  <button id="badge-cli" class="ag-unit" type="button" style="display:none!important;" aria-label="启动 CLI">
    <span class="cli-icon" aria-hidden="true">&gt;_</span>
    <span id="cli-label">CLI</span>
  </button>

  <!-- 顶部单元 6: 窄屏溢出菜单按钮 -->
  <button id="badge-overflow" class="ag-unit" type="button" aria-label="更多统计指标" aria-expanded="false">
    <svg class="overflow-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.25"></circle>
      <circle cx="8" cy="8" r="1.25"></circle>
      <circle cx="12.5" cy="8" r="1.25"></circle>
    </svg>
  </button>

  <!-- 上下文圆环悬停信息气泡 -->
  <div id="context-tooltip" role="tooltip" data-visible="false" data-placement="bottom">
    <div id="ctx-tip-title" class="ctx-tip-title">上下文窗口：</div>
    <div id="ctx-tip-pct" class="ctx-tip-pct">数据尚未就绪</div>
    <div id="ctx-tip-detail" class="ctx-tip-detail">正在读取当前会话上下文用量…</div>
  </div>

  <!-- 窄屏溢出菜单 -->
  <div id="overflow-menu" hidden aria-label="快捷菜单">
    <button id="overflow-speed-btn" class="overflow-item" type="button">
      <span class="overflow-item-label"><span>⚡</span><span>生成速度 (TPS)</span></span>
      <span id="overflow-speed-val" class="overflow-item-val">-- TPS</span>
    </button>
    <button id="overflow-quota-btn" class="overflow-item" type="button">
      <span class="overflow-item-label"><span>🛡️</span><span>模型配额余量</span></span>
      <span id="overflow-quota-val" class="overflow-item-val">--</span>
    </button>
    <button id="overflow-tokens-btn" class="overflow-item" type="button">
      <span class="overflow-item-label"><span class="token-fire-dot"></span><span>Token 消耗热力图</span></span>
      <span id="overflow-tokens-val" class="overflow-item-val">--</span>
    </button>
    <button id="overflow-cli-btn" class="overflow-item" type="button" style="display:none!important;">
      <span class="overflow-item-label"><span class="cli-icon">&gt;_</span><span>启动 CLI 终端</span></span>
      <span id="overflow-cli-val" class="overflow-item-val">agy</span>
    </button>
  </div>

  <!-- 弹出式面板 1: 实时会话与模型额度看板 (#panel) -->
  <section id="panel" class="ag-panel" hidden aria-label="实时会话与模型额度看板">
    <div class="panel-header-bar">
      <div class="panel-title">
        <span style="font-size:13px;font-weight:600;color:var(--ag-text-primary);display:inline-flex;align-items:center;gap:6px">
          <span>⚡</span><span>会话上下文与模型额度</span>
        </span>
      </div>
      <div class="panel-header-actions">
        <button id="btn-switch-to-tokens" class="switch-pill-btn" type="button" style="padding:2px 8px;font-size:11px" title="切换到历次 Token 消耗热力图">
          📊 Token 热力图 →
        </button>
        <button id="theme-toggle" class="panel-icon-btn" type="button" aria-label="切换浅色/深色主题" title="当前：跟随IDE（点击切换：浅色 / 深色 / 自动）">🌓</button>
        <button id="close" class="panel-icon-btn" type="button" aria-label="收起面板">×</button>
      </div>
    </div>

    <div id="view-context">
      <!-- 卡片 1: 当前会话上下文占用速览 (占了上下文中的多少) -->
      <div id="key-summary" class="ag-clean-card">
        <div class="key-header">
          <span class="key-title">💬 当前会话上下文占用</span>
          <span id="key-badge" class="key-pill pill-muted">读取中</span>
        </div>
        <div class="key-bar-track"><div id="key-bar-fill" class="key-bar-fill"></div></div>
        <div class="key-stats">
          <div class="key-stat">
            <div class="key-stat-label">当前已用</div>
            <div id="key-used" class="key-stat-val">—</div>
          </div>
          <div class="key-stat">
            <div class="key-stat-label">预算上限</div>
            <div id="key-limit" class="key-stat-val">—</div>
          </div>
          <div class="key-stat">
            <div class="key-stat-label">剩余可用</div>
            <div id="key-remaining" class="key-stat-val">—</div>
          </div>
        </div>
        <div id="key-takeaway" class="key-takeaway">正在计算上下文用量…</div>
      </div>

      <!-- 卡片 2: 生成速度与延迟速览 (TPS 与 TTFT) -->
      <div id="speed-summary" class="ag-clean-card" style="margin:8px 0 10px;">
        <div class="key-header">
          <span class="key-title" style="color:var(--ag-custom-speed,var(--ag-text-primary));">⚡ 最新生成性能指标</span>
          <span id="speed-badge" class="key-pill pill-muted">待生成</span>
        </div>
        <div class="key-stats" style="grid-template-columns:repeat(4,1fr);">
          <div class="key-stat">
            <div class="key-stat-label">生成速度 (TPS)</div>
            <div id="speed-val" class="key-stat-val" style="color:var(--ag-custom-speed,var(--ag-text-primary));">—</div>
          </div>
          <div class="key-stat">
            <div class="key-stat-label">首字延迟 (TTFT)</div>
            <div id="speed-ttft" class="key-stat-val">—</div>
          </div>
          <div class="key-stat">
            <div class="key-stat-label">生成耗时</div>
            <div id="speed-duration" class="key-stat-val">—</div>
          </div>
          <div class="key-stat">
            <div class="key-stat-label">本次输出</div>
            <div id="speed-tokens" class="key-stat-val">—</div>
          </div>
        </div>
        <div id="speed-takeaway" class="key-takeaway">等待首次模型输出产生速度统计…</div>
      </div>

      <!-- 卡片 3: 🛡️ 模型额度余量监控 (深度融合原 Quota 看板！) -->
      <div id="quota-summary-card" class="ag-clean-card" style="margin:8px 0 6px;">
        <div class="key-header" style="margin-bottom:8px">
          <span class="key-title" style="display:inline-flex;align-items:center;gap:5px;color:var(--ag-quota-good,#10b981);">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>模型配额余量监控</span>
          </span>
          <span id="ov-quota-time" class="key-pill pill-muted" style="font-size:10px;font-variant-numeric:tabular-nums">--:--</span>
        </div>

        <!-- Gemini Models 额度行 -->
        <div class="quota-model-box">
          <div class="quota-row-header">
            <span id="ov-gemini-name" class="quota-model-name">Gemini Models</span>
            <span id="ov-gemini-pct" class="quota-model-pct" style="color:#10b981">--%</span>
          </div>
          <div class="quota-bar-track">
            <div id="ov-gemini-bar" class="quota-bar-fill" style="width:0%;background:#10b981"></div>
          </div>
          <div class="quota-row-meta">
            <span>5h 限额余量: <strong id="ov-gemini-5h" style="color:var(--ag-text-primary)">--</strong></span>
            <span>刷新倒计时: <strong id="ov-gemini-reset" style="color:var(--ag-text-primary)">--</strong></span>
          </div>
        </div>

        <!-- Claude & GPT Models 额度行 -->
        <div class="quota-model-box" style="margin-top:8px">
          <div class="quota-row-header">
            <span id="ov-claude-name" class="quota-model-name">Claude &amp; GPT Models</span>
            <span id="ov-claude-pct" class="quota-model-pct" style="color:#10b981">--%</span>
          </div>
          <div class="quota-bar-track">
            <div id="ov-claude-bar" class="quota-bar-fill" style="width:0%;background:#10b981"></div>
          </div>
          <div class="quota-row-meta">
            <span>5h 限额余量: <strong id="ov-claude-5h" style="color:var(--ag-text-primary)">--</strong></span>
            <span>刷新倒计时: <strong id="ov-claude-reset" style="color:var(--ag-text-primary)">--</strong></span>
          </div>
        </div>
      </div>

      <!-- 隐藏兼容节点，确保旧模块事件静默降级而不报错 -->
      <div style="display:none!important;" aria-hidden="true">
        <span id="model"></span><span id="request-status"></span>
        <span id="actual"></span><span id="estimate"></span>
        <span id="budget"></span><span id="service-limit"></span>
        <span id="percent"></span><span id="updated"></span><span id="user"></span><span id="assistant"></span><span id="thinking"></span><span id="tools"></span><span id="summaries"></span>
        <span id="system"></span><span id="characters"></span>
        <span id="steps"></span><span id="status"></span>
        <span id="coverage"></span><span id="attachment-total"></span>
        <span id="session-total"></span><button id="refresh"></button>
        <div id="round-cost-bar"><span id="round-cost-text"></span><span id="session-cost-text"></span></div>
        <div id="context-unlock-drawer"><button id="btn-toggle-unlock"></button><div id="unlock-drawer-body"></div></div>
        <div id="chinese-i18n-drawer"><button id="btn-toggle-chinese"></button></div>
        <div id="proxy-network-drawer"><button id="btn-toggle-proxy"></button></div>
        <div id="files-card"><div id="files-list"></div><div id="files"></div></div>
        <div id="btn-panel-palette"></div>
        <div id="btn-github-repo-ctx"></div>
        <div id="btn-check-update-ctx"></div>
      </div>
    </div>
  </section>

  <!-- 弹出式面板 2: 历次 Token 消耗热力图 (#panel-tokens) -->
  <section id="panel-tokens" class="ag-panel" hidden aria-label="历次 Token 消耗热力图">
    <div class="panel-header-bar">
      <div class="panel-title panel-title-tokens">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ag-custom-token-accent,var(--ag-token-accent-default))"><path d="M3 13V9M8 13V4M13 13V7"></path></svg>
        <span style="font-size:13px;font-weight:600;color:var(--ag-custom-token-accent,var(--ag-token-accent-default))">历次 Token 消耗热力图</span>
      </div>
      <div class="panel-header-actions">
        <button id="btn-switch-to-context" class="switch-pill-btn" type="button" style="padding:2px 8px;font-size:11px" title="切换回实时会话与额度">
          ⚡ 实时会话与额度 →
        </button>
        <button id="theme-toggle-tokens" class="panel-icon-btn" type="button" aria-label="切换浅色/深色主题" title="当前：跟随IDE（点击切换：浅色 / 深色 / 自动）">🌓</button>
        <button id="close-tokens" class="panel-icon-btn" type="button" aria-label="收起面板">×</button>
      </div>
    </div>

    <div id="view-tokens">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <div class="source-switch-bar">
          <span style="font-size:10.5px;color:var(--ag-text-muted);padding:0 4px">数据来源:</span>
          <button id="src-tab-all" class="switch-pill-btn active" type="button">全部记录</button>
          <button id="src-tab-desktop" class="switch-pill-btn" type="button">桌面客户端</button>
          <button id="src-tab-cli" class="switch-pill-btn" type="button">CLI 终端</button>
        </div>
      </div>

      <!-- 专属 Token 统计页（包含卡片统计、52周热力图） -->
      <div id="tokens-main-view">
        <div class="token-stat-cards" id="token-stat-cards">
          <div class="t-card">
            <div class="t-card-lbl"><span>累计处理 <small style="font-weight:400;opacity:0.75">(含缓存)</small></span><span style="color:var(--ag-custom-token-accent,var(--ag-token-accent-default))">Total</span></div>
            <div class="t-card-val" id="t-total-val">--</div>
            <div class="t-card-sub" id="t-total-sub">读取中...</div>
          </div>
          <div class="t-card">
            <div class="t-card-lbl"><span>今日使用</span><span style="color:var(--ag-custom-token-accent,#0284c7)">Today</span></div>
            <div class="t-card-val" id="t-today-val">--</div>
            <div class="t-card-sub" id="t-today-sub">读取中...</div>
          </div>
          <div class="t-card">
            <div class="t-card-lbl"><span>本月使用</span><span style="color:var(--ag-custom-token-accent,var(--ag-token-accent-default))">Month</span></div>
            <div class="t-card-val" id="t-month-val">--</div>
            <div class="t-card-sub" id="t-month-sub">读取中...</div>
          </div>
          <div class="t-card">
            <div class="t-card-lbl"><span>年度使用</span><span style="color:var(--ag-custom-token-accent,var(--ag-token-accent-default))">Year</span></div>
            <div class="t-card-val" id="t-year-val">--</div>
            <div class="t-card-sub" id="t-year-sub">读取中...</div>
          </div>
        </div>

        <div class="heatmap-section">
          <div class="heat-header">
            <div class="heat-header-left">
              <div class="heat-title">Token 活动热力图</div>
              <span id="first-use-badge" class="first-use-badge">首次记录：--</span>
              <div class="heat-win-nav">
                <button id="h-page-prev" class="heat-nav-btn" type="button" title="查看更早的 12 个月窗口" disabled>‹</button>
                <span id="h-win-range">--</span>
                <button id="h-page-next" class="heat-nav-btn" type="button" title="查看更新的 12 个月窗口" disabled>›</button>
              </div>
            </div>
            <div class="heat-tabs" id="heat-tabs-bar" role="tablist" aria-label="热力图统计周期">
              <div class="heat-tab-thumb" id="heat-tab-thumb" aria-hidden="true"></div>
              <button class="heat-tab-btn active" id="h-tab-daily" role="tab" aria-selected="true" type="button" tabindex="0">每天</button>
              <button class="heat-tab-btn" id="h-tab-weekly" role="tab" aria-selected="false" type="button" tabindex="-1">每周</button>
              <button class="heat-tab-btn" id="h-tab-monthly" role="tab" aria-selected="false" type="button" tabindex="-1">每月</button>
              <button class="heat-tab-btn" id="h-tab-yearly" role="tab" aria-selected="false" type="button" tabindex="-1">今年</button>
              <button class="heat-tab-btn" id="h-tab-cum" role="tab" aria-selected="false" type="button" tabindex="-1">累计总量</button>
            </div>
          </div>
          <div class="heat-scroll-box" id="h-scroll-box">
            <div id="h-daily-box">
              <div class="heat-grid-cols" id="h-grid-cols"></div>
              <div class="heat-months" id="h-months"></div>
            </div>
            <div id="h-weekly-box" style="display:none"></div>
            <div id="h-monthly-box" style="display:none"></div>
            <div id="h-yearly-box" style="display:none"></div>
            <div id="h-cum-box" style="display:none">
              <canvas id="h-cum-canvas"></canvas>
            </div>
          </div>
          <div id="h-summary-bar" class="heat-summary-bar">
            <div class="heat-sum-item">
              <span class="heat-sum-label">区间合计:</span>
              <span id="h-sum-tokens" class="heat-sum-val">-- Tokens</span>
            </div>
            <div class="heat-sum-item">
              <span class="heat-sum-label">峰值单日:</span>
              <span id="h-peak-val" class="heat-sum-val">--</span>
            </div>
            <div class="heat-legend">
              <span class="heat-legend-label">低</span>
              <div class="heat-legend-cells">
                <span class="heat-legend-cell heat-lvl-0" title="0 用量"></span>
                <span class="heat-legend-cell heat-lvl-1" title="第 1 档活跃"></span>
                <span class="heat-legend-cell heat-lvl-2" title="第 2 档活跃"></span>
                <span class="heat-legend-cell heat-lvl-3" title="第 3 档活跃"></span>
                <span class="heat-legend-cell heat-lvl-4" title="第 4 档极高活跃"></span>
              </div>
              <span class="heat-legend-label">高</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 隐藏兼容节点，确保旧模块事件静默降级而不报错 -->
      <div style="display:none!important;" aria-hidden="true">
        <button id="tok-view-tokens"></button><button id="tok-view-cost"></button>
        <div id="plan-summary-bar"></div><div id="plan-detail-card"></div>
        <div id="cost-details-pane"></div><div id="ref-cost-drawer-body"></div>
        <div id="btn-panel-tokens-palette"></div>
        <div id="btn-github-repo"></div>
        <div id="btn-check-update"></div>
      </div>
    </div>
  </section>

  <!-- 热力图浮动 Tooltip -->
  <div class="heat-popover" id="heat-pop">
    <div class="pop-date" id="heat-pop-date">--</div>
    <div class="pop-val" id="heat-pop-val">-- Tokens</div>
    <div class="pop-det" id="heat-pop-det"></div>
  </div>`;

  (document.body || document.documentElement).appendChild(host);
  const el = id => shadow.getElementById(id);
  const fmt = v => v == null ? '—' : Math.round(v).toLocaleString('en-US');
  const short = v => {
    if (v == null) return '—';
    if (v >= 1e9) return `${parseFloat((v / 1e9).toFixed(2))}B`;
    if (v >= 1e6) return `${parseFloat((v / 1e6).toFixed(2))}M`;
    if (v >= 1000) return `${parseFloat((v / 1000).toFixed(1))}K`;
    return fmt(v);
  };
  // 悬停信息气泡专用紧凑计数格式（如 37k、475k、1.05M）
  const fmtBubbleToken = v => {
    if (v == null) return '未知';
    if (v >= 1e9) return `${parseFloat((v / 1e9).toFixed(2))}B`;
    if (v >= 1e6) return `${parseFloat((v / 1e6).toFixed(2))}M`;
    if (v >= 1000) {
      const k = v / 1000;
      return k >= 10 ? `${Math.round(k)}k` : `${parseFloat(k.toFixed(1))}k`;
    }
    return String(Math.round(v));
  };
  const range = value => value ? `≈ ${short(value.low)}–${short(value.high)}` : '—';
  const token = value => value == null ? '未提供' : `${fmt(value)} tokens`;
  const state = {
    route: null, count: 0, latest: null, requestAt: 0, requestError: '',
    requestBusy: false, requestNext: 0, scanBusy: false, scanNext: 0,
    scanError: '', scan: null, generation: 0, controllers: new Set(),
    disposed: false, layoutMode: 'wide', tooltipOpen: false,
    reportedFinalCallIds: new Set(), reportedFinalCallOutputs: new Map()
  };
  let timer = null;
  let resizeObserver = null;
  let hostDomObserver = null;
  let observedTitlebar = null;
  let layoutRaf = 0;
  let onWindowResize = null;
  let onWindowFocus = null;
  let onWindowBlur = null;
  let outside = null;
  let escape = null;
  const disposeInstance = () => {
    if (state.disposed) return;
    state.disposed = true;
    for (const controller of state.controllers) {
      try { controller.abort(); } catch {}
    }
    state.controllers.clear();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (layoutRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(layoutRaf);
      layoutRaf = 0;
    }
    try {
      if (typeof syncHostStackingElevation === 'function') syncHostStackingElevation(false);
    } catch {}
    try { resizeObserver?.disconnect(); } catch {}
    try { hostDomObserver?.disconnect(); } catch {}
    try { if (typeof disposeColorObservers === 'function') disposeColorObservers(); } catch {}
    try {
      if (typeof onWindowResize === 'function') window.removeEventListener?.('resize', onWindowResize);
      if (typeof onWindowFocus === 'function') window.removeEventListener?.('focus', onWindowFocus);
      if (typeof onWindowBlur === 'function') window.removeEventListener?.('blur', onWindowBlur);
      if (typeof onWindowResize === 'function') navigator?.windowControlsOverlay?.removeEventListener?.('geometrychange', onWindowResize);
    } catch {}
    try {
      if (typeof outside === 'function') document.removeEventListener?.('click', outside);
      if (typeof escape === 'function') document.removeEventListener?.('keydown', escape);
    } catch {}
    try { document.getElementById?.('ag-wco-spacer')?.remove?.(); } catch {}
    try { document.getElementById?.('ag-topbar-host-fix')?.remove?.(); } catch {}
    try { host.remove?.(); } catch {}
    try { globalThis.__AGContextMeterInstances?.delete?.(disposeInstance); } catch {}
  };
  try {
    host.__agDispose = disposeInstance;
    globalThis.__AGContextMeterInstances?.add?.(disposeInstance);
  } catch {}
  const route = () => location.pathname.match(/^\/c\/([a-f\d-]{36})(?:\/|$)/i)?.[1] || null;
  let activeHeatView = 'daily';
  let heatPageOffset = 0;
  let heatMonthOffset = 0;
  let heatYearOffset = 0;
  let activeCostModel = 'gemini-3.8-flash';
  let activeCostMode = 'ref';
  let autoCheckUpdate = true;
  let cachedLatestRelease = null;

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
  // =========================================================================
  // 模块 2: 宿主布局挂载、右上角原生窗口控制区预留、渐进式宽度收缩与悬浮层定位
  // =========================================================================

  function findHostTitlebar() {
    try {
      if (typeof document.querySelector !== 'function') return null;
      return document.querySelector('[class*="@container/titlebar"]');
    } catch {
      return null;
    }
  }

  function isTopRightToolbarCluster(el) {
    if (!el || typeof el.getAttribute !== 'function') return false;
    const cls = el.className || '';
    if (typeof cls !== 'string') return false;
    const classList = typeof el.classList?.contains === 'function'
      ? el.classList
      : { contains: c => cls.split(/\s+/).includes(c) };
    if (!classList.contains('absolute') || !classList.contains('right-0')) return false;

    const styleTop = el.style?.top || el.getAttribute('style') || '';
    const hasTopClass = classList.contains('top-0');
    const hasTopStyle = /(?:^|;)\s*top:\s*0(?:px)?(?:\s*;|$)/i.test(styleTop);
    const rectTop = el.getBoundingClientRect ? el.getBoundingClientRect().top : 0;
    if (el.getBoundingClientRect && rectTop >= 20) return false;
    const isAtTop = hasTopClass || hasTopStyle || (rectTop <= 10 && rectTop >= 0);
    if (!isAtTop) return false;

    // 排除明显非顶栏容器（右侧全高抽屉、全屏浮层或带有明确非零高度下沉定位的浮层）
    if (classList.contains('bottom-0') || classList.contains('h-screen') || classList.contains('h-full')) {
      return false;
    }

    // 排除右侧滚动条滑槽（特征：包含 top-0.5 / bottom-0.5 / w-3 等滚动条特征）
    if (classList.contains('w-3') || classList.contains('right-0.5')) {
      return false;
    }

    // 必须符合顶栏控制按钮容器特征：
    // a) 包含右侧栏切换按钮
    // b) 或包含 z-50 并具有 flex / items-center 水平布局
    const hasAuxToggle = Boolean(el.querySelector && el.querySelector('[data-testid="toggle-aux-sidebar"]'));
    const hasToolbarLayout = classList.contains('z-50') && (classList.contains('items-center') || classList.contains('flex'));

    return hasAuxToggle || hasToolbarLayout;
  }

  function findTopRightCluster() {
    try {
      if (typeof document.querySelector !== 'function') return null;
      // 1. 优先从右侧栏切换按钮向上寻找最近的顶栏容器
      const auxToggle = document.querySelector('[data-testid="toggle-aux-sidebar"]');
      if (auxToggle?.closest) {
        // 先尝试带 top-0 的经典结构（Antigravity 1.x）
        let cluster = auxToggle.closest('div.absolute.right-0.top-0');
        if (cluster && isTopRightToolbarCluster(cluster)) return cluster;
        // 兼容 Antigravity 2.x（top: 0px 写在内联 style，class 无 top-0）
        cluster = auxToggle.closest('div.absolute.right-0');
        if (cluster && isTopRightToolbarCluster(cluster)) return cluster;
      }

      // 2. 备用安全探测：当 auxToggle 尚未挂载或被动态卸载时，精确匹配顶栏容器
      // 严格检查顶部坐标与容器特征，绝不误伤滚动条、侧栏抽屉或模态弹窗
      const selectors = [
        'div.h-screen.w-screen > div.flex-1 > div.absolute.right-0.top-0.z-50',
        'div.h-screen.w-screen > div.flex-1 > div.absolute.right-0.z-50',
        'div.absolute.right-0.z-50'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && isTopRightToolbarCluster(el)) return el;
      }
      return null;
    } catch {
      return null;
    }
  }

  // 动态计算右上角原生窗口控制区（Minimize / Maximize / Close）独占宽度（CSS px）
  function computeWindowControlsWidth(topRight) {
    if (!topRight) return 0;
    try {
      const plat = (typeof navigator !== 'undefined' && navigator.platform) || '';
      if (/^Mac|iPhone|iPad/i.test(plat)) return 0;
      if (topRight?.getBoundingClientRect) {
        const tr = topRight.getBoundingClientRect();
        // 若顶部已单独渲染菜单栏（top >= 20），则 40px 工具栏不在窗口顶边，无需重复留白
        if (tr.height > 0 && tr.top >= 20) return 0;
      }
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 0;
      // 优先 1: 标准 WCO 接口 navigator.windowControlsOverlay
      const wco = typeof navigator !== 'undefined' ? navigator.windowControlsOverlay : null;
      if (wco?.visible && typeof wco.getTitlebarAreaRect === 'function') {
        const rect = wco.getTitlebarAreaRect();
        if (rect && rect.width > 0 && vw > 0 && rect.width < vw) {
          return Math.max(0, Math.ceil(vw - rect.right));
        }
      }
      // 优先 2: 根据 Electron titleBarOverlay 几何规格（Windows 3 颗原生控制按钮共 138 OS DIP）与实时缩放比动态换算
      let zoomFactor = 1;
      if (typeof window !== 'undefined') {
        const nativeZoom = window.electronNative?.getZoomLevel?.();
        if (typeof nativeZoom === 'number' && nativeZoom >= 0.25 && nativeZoom <= 5) {
          zoomFactor = nativeZoom;
        } else if (window.outerWidth > 0 && window.innerWidth > 0) {
          const ratio = window.outerWidth / window.innerWidth;
          if (ratio >= 0.25 && ratio <= 5) zoomFactor = ratio;
        }
      }
      const rawCssWidth = Math.ceil(138 / zoomFactor);
      let existingSpacerWidth = 0;
      if (topRight?.querySelectorAll) {
        const spacers = topRight.querySelectorAll('div[aria-hidden="true"]');
        for (const sp of spacers) {
          if (sp.id !== 'ag-wco-spacer' && sp.getBoundingClientRect) {
            existingSpacerWidth += Math.round(sp.getBoundingClientRect().width || parseFloat(sp.style?.width) || 0);
          }
        }
      }
      return Math.max(0, rawCssWidth - existingSpacerWidth);
    } catch {
      return 98;
    }
  }

  function syncWindowControlsOverlay() {
    if (state.disposed) return;
    try {
      const topRight = findTopRightCluster();
      const wcoWidth = computeWindowControlsWidth(topRight);
      const spacer = typeof document.getElementById === 'function' ? document.getElementById('ag-wco-spacer') : null;
      if (topRight && typeof document.createElement === 'function' && wcoWidth > 0) {
        let activeSpacer = spacer;
        if (!activeSpacer || activeSpacer.parentElement !== topRight) {
          activeSpacer?.remove?.();
          activeSpacer = document.createElement('div');
          activeSpacer.id = 'ag-wco-spacer';
          activeSpacer.setAttribute('aria-hidden', 'true');
          topRight.appendChild(activeSpacer);
        }
        const targetCss = `width:${wcoWidth}px;height:100%;flex-shrink:0;pointer-events:none;`;
        if (activeSpacer.style.cssText !== targetCss) {
          activeSpacer.style.cssText = targetCss;
        }
      } else {
        if (spacer) {
          spacer.remove();
        }
        if (topRight?.querySelectorAll) {
          const oldSpacers = topRight.querySelectorAll('#ag-wco-spacer');
          for (const s of oldSpacers) {
            s.remove?.();
          }
        }
      }

      if (typeof document.head !== 'undefined' && document.head && typeof document.createElement === 'function') {
        let styleEl = typeof document.getElementById === 'function' ? document.getElementById('ag-topbar-host-fix') : null;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'ag-topbar-host-fix';
          document.head.appendChild(styleEl);
        }
        const cssText = [
          '[data-aux-pane-focus-scope="true"] > div[data-active-tab-id] {',
          '  padding-right: calc(var(--right-cluster-width, 140px) - 4px) !important;',
          '}',
          wcoWidth > 0 ? [
            '[class*="@container/titlebar"],',
            '[data-aux-pane-focus-scope="true"] > div[data-active-tab-id],',
            'div[role="navigation"][aria-label] > div.shrink-0:first-child {',
            '  -webkit-app-region: drag;',
            '}',
            '[class*="@container/titlebar"] button,',
            '[class*="@container/titlebar"] a,',
            '[class*="@container/titlebar"] input,',
            '[class*="@container/titlebar"] [role="button"],',
            '[data-testid="pane-titlebar-toolbar"] > *,',
            '[data-aux-pane-focus-scope="true"] > div[data-active-tab-id] button,',
            '[data-aux-pane-focus-scope="true"] > div[data-active-tab-id] [data-tab-id],',
            'div[role="navigation"][aria-label] > div.shrink-0:first-child button,',
            'div[role="navigation"][aria-label] > div.shrink-0:first-child a,',
            '#ag-context-meter {',
            '  -webkit-app-region: no-drag;',
            '}'
          ].join('\n') : ''
        ].join('\n');
        if (styleEl.textContent !== cssText) {
          styleEl.textContent = cssText;
        }
      }
    } catch {}
  }

  function ensureHostDocked() {
    if (state.disposed) return;
    syncWindowControlsOverlay();
    const titlebar = findHostTitlebar();
    if (titlebar) {
      // 自愈保护：若主对话区（div.flex[style*="min-width"]）的 inline flex-grow 被意外清空，立即恢复为 1，绝不覆写其他分栏属性
      try {
        const convPane = titlebar.closest?.('div.flex[style*="min-width"]');
        if (convPane?.style && (!convPane.style.flexGrow || convPane.style.flexGrow === '0')) {
          convPane.style.flexGrow = '1';
        }
      } catch {}

      let targetContainer = titlebar;
      try {
        const rightGroup = titlebar.querySelector(':scope > div.shrink-0') || titlebar.lastElementChild;
        if (rightGroup && rightGroup !== titlebar.firstElementChild) {
          targetContainer = rightGroup;
        }
      } catch {}

      if (host.parentElement !== targetContainer) {
        if (targetContainer.firstChild && targetContainer !== titlebar) {
          targetContainer.insertBefore(host, targetContainer.firstChild);
        } else {
          targetContainer.appendChild(host);
        }
      }
      host.setAttribute('data-dock', 'flow');
      try {
        host.style.removeProperty?.('right');
        host.style.removeProperty?.('top');
      } catch {}
      host.style.right = '';
      host.style.top = '';

      if (observedTitlebar !== titlebar) {
        observedTitlebar = titlebar;
        try {
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver.observe(titlebar);
            if (document.body) resizeObserver.observe(document.body);
          }
        } catch {}
      }
    } else {
      const fallbackParent = document.body || document.documentElement;
      if (fallbackParent && host.parentElement !== fallbackParent) {
        fallbackParent.appendChild(host);
      }
      host.setAttribute('data-dock', 'fixed');
      updateFixedFallbackPosition();
    }
    updateResponsiveLayout();
  }

  function findNativeTopRightAnchor() {
    try {
      if (typeof document.querySelector !== 'function') return null;
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const openIdeBtn = buttons.find(b => {
        const text = (b.textContent || '').trim();
        return (text === 'Open IDE' || text === '打开 IDE' || text.includes('Open IDE') || text.includes('打开 IDE')) && b.getBoundingClientRect?.().top < 50;
      });
      if (openIdeBtn) {
        const parentGroup = openIdeBtn.closest('div.flex.items-center, div.absolute.right-0') || openIdeBtn;
        return parentGroup;
      }
      const auxToggle = document.querySelector('[data-testid="toggle-aux-sidebar"]');
      if (auxToggle?.closest) {
        return auxToggle.closest('div.absolute.right-0.top-0') || auxToggle;
      }
      return document.querySelector('div.absolute.right-0.top-0');
    } catch {
      return null;
    }
  }

  function updateFixedFallbackPosition() {
    if (host.getAttribute?.('data-dock') === 'flow') {
      try {
        host.style.removeProperty?.('right');
        host.style.removeProperty?.('top');
      } catch {}
      host.style.right = '';
      host.style.top = '';
      return;
    }
    try {
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
      let rightOffset = 144;
      const anchor = findNativeTopRightAnchor();
      if (anchor?.getBoundingClientRect) {
        const r = anchor.getBoundingClientRect();
        if (r.width > 0 && r.left > 0 && r.left < vw) {
          rightOffset = Math.max(144, Math.ceil(vw - r.left + 6));
        }
      }
      host.style.top = '6px';
      host.style.right = `${rightOffset}px`;
    } catch {}
  }

  // 带迟滞区间（Hysteresis）的四阶段渐进收缩计算，防止临界宽度抖动
  function computeNextLayoutMode(availWidth, currentMode) {
    // 阈值设计：
    // wide <-> compact: 收缩 < 195px, 恢复 >= 210px
    // compact <-> minimal: 收缩 < 135px, 恢复 >= 150px
    // minimal <-> ring-only: 收缩 < 68px, 恢复 >= 82px
    if (availWidth == null || Number.isNaN(availWidth)) return 'wide';
    if (currentMode === 'wide') {
      if (availWidth < 68) return 'ring-only';
      if (availWidth < 135) return 'minimal';
      if (availWidth < 195) return 'compact';
      return 'wide';
    }
    if (currentMode === 'compact') {
      if (availWidth >= 210) return 'wide';
      if (availWidth < 68) return 'ring-only';
      if (availWidth < 135) return 'minimal';
      return 'compact';
    }
    if (currentMode === 'minimal') {
      if (availWidth >= 210) return 'wide';
      if (availWidth >= 150) return 'compact';
      if (availWidth < 68) return 'ring-only';
      return 'minimal';
    }
    // currentMode === 'ring-only'
    if (availWidth >= 210) return 'wide';
    if (availWidth >= 150) return 'compact';
    if (availWidth >= 82) return 'minimal';
    return 'ring-only';
  }

  function measureAvailableWidth() {
    try {
      const titlebar = findHostTitlebar();
      if (titlebar?.getBoundingClientRect) {
        const tbRect = titlebar.getBoundingClientRect();
        if (tbRect.width > 0) {
          const titleEl = titlebar.firstElementChild;
          const titleInner = titleEl?.firstElementChild;
          const contentStart = titleInner?.getBoundingClientRect
            ? Math.max(8, titleInner.getBoundingClientRect().left - tbRect.left)
            : (tbRect.left < 168 ? (168 - tbRect.left) : 12);
          const titleRealW = titleEl?.scrollWidth ? Math.min(320, titleEl.scrollWidth) : 160;
          const minTitleWidth = Math.max(150, titleRealW);
          let nativeButtonsWidth = 64;
          let rightPad = 8;
          const rightGroup = host.parentElement;
          if (rightGroup && rightGroup !== titlebar) {
            const auxOpen = typeof document.querySelector === 'function'
              && !!document.querySelector('[data-testid="aux-pane-sash"]');
            const root = typeof document.querySelector === 'function'
              ? document.querySelector('div.h-screen.w-screen')
              : null;
            const rightClusterVar = root?.style?.getPropertyValue?.('--right-cluster-width')?.trim() || '';
            if (auxOpen) {
              rightPad = 8;
            } else if (rightClusterVar) {
              rightPad = Math.max(8, (parseFloat(rightClusterVar) || 44) - 4);
            } else if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
              rightPad = parseFloat(window.getComputedStyle(rightGroup).paddingRight) || 0;
            }
            if (rightGroup.children) {
              let sum = 0;
              for (const child of rightGroup.children) {
                if (child !== host && child.getBoundingClientRect) {
                  sum += child.getBoundingClientRect().width;
                }
              }
              if (sum > 0) nativeButtonsWidth = sum + 6;
            }
          }
          return tbRect.width - contentStart - minTitleWidth - rightPad - nativeButtonsWidth;
        }
      }
      if (typeof window !== 'undefined' && window.innerWidth) {
        return window.innerWidth - 360;
      }
    } catch {}
    return 400;
  }

  function renderSessionCost() {
    const roundCostBar = el('round-cost-bar');
    const roundCostText = el('round-cost-text');
    const sessionCostText = el('session-cost-text');
    if (!roundCostText || !sessionCostText) return;
    const activeCalls = state.sessionCalls || [];
    const latestCall = activeCalls[activeCalls.length - 1];
    const sessTotal = state.sessionCostTotal || 0;
    if (latestCall && latestCall.isPriced) {
      const roundCost = latestCall.costUSD || 0;
      const roundCostStr = roundCost < 0.01 ? '<$0.01' : `≈$${roundCost.toFixed(4)}`;
      const estLabel = latestCall.status === 'streaming' ? '生成中暂估' : '按已返回用量估算';
      roundCostText.textContent = `最近调用 ${roundCostStr} · ${estLabel}`;
      roundCostText.title = `模型：${latestCall.model}\n输入：${fmt(latestCall.inputTokens)} tok\n缓存：${fmt(latestCall.cacheTokens)} tok\n输出：${fmt(latestCall.outputTokens)} tok\n参考金额：$${roundCost.toFixed(6)}`;
    } else if (latestCall) {
      roundCostText.textContent = '最近调用：模型费率未收录';
      roundCostText.title = latestCall.model ? `模型：${latestCall.model}（公开费率未收录）` : '缺少模型信息';
    } else {
      roundCostText.textContent = '最近调用估值：—';
      roundCostText.title = '';
    }
    sessionCostText.textContent = sessTotal > 0 ? `当前会话合计约 $${sessTotal.toFixed(4)}` : '当前会话合计：—';
  }

  function applyLayoutMode(nextMode) {
    if (!nextMode) return;
    const prev = state.layoutMode;
    state.layoutMode = nextMode;
    host.setAttribute('data-layout', nextMode);
    if (prev !== nextMode) {
      if (nextMode !== 'minimal') {
        const om = el('overflow-menu');
        if (om) om.hidden = true;
        el('badge-overflow')?.setAttribute('aria-expanded', 'false');
      }
      syncSpeedBadgeText();
    }
    renderSessionCost();
  }

  function updateResponsiveLayout() {
    if (state.disposed) return;
    syncWindowControlsOverlay();
    const avail = measureAvailableWidth();
    const nextMode = computeNextLayoutMode(avail, state.layoutMode);
    applyLayoutMode(nextMode);
    if (state.tooltipOpen) positionContextTooltip();
    if (isAnyPanelOpen() || !el('overflow-menu')?.hidden) positionFloatingPanels();
  }

  function scheduleLayoutSync() {
    if (state.disposed) return;
    if (typeof requestAnimationFrame === 'function') {
      if (layoutRaf) return;
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        ensureHostDocked();
      });
    } else {
      ensureHostDocked();
    }
  }

  // 定位上下文悬停气泡：空间足够时优先在圆环上方，顶部空间不足时自动翻转至下方，左右防裁切
  function positionContextTooltip() {
    const tip = el('context-tooltip');
    const badge = el('badge');
    if (!tip || !badge || !badge.getBoundingClientRect) return;
    try {
      const bRect = badge.getBoundingClientRect();
      if (bRect.width === 0 && bRect.height === 0) return;
      const tRect = tip.getBoundingClientRect ? tip.getBoundingClientRect() : { width: 190, height: 66 };
      const tipW = tRect.width || 190;
      const tipH = tRect.height || 66;
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
      const gap = 7;

      const spaceAbove = bRect.top;
      const spaceBelow = vh - bRect.bottom;
      let top;
      if (spaceAbove >= tipH + gap + 6 || spaceAbove > spaceBelow) {
        top = bRect.top - tipH - gap;
        tip.setAttribute('data-placement', 'top');
      } else {
        top = bRect.bottom + gap;
        tip.setAttribute('data-placement', 'bottom');
      }
      top = Math.max(6, Math.min(vh - tipH - 6, Math.round(top)));

      let left = Math.round(bRect.left + bRect.width / 2 - tipW / 2);
      left = Math.max(8, Math.min(vw - tipW - 8, left));

      tip.style.top = `${top}px`;
      tip.style.left = `${left}px`;
    } catch {}
  }

  function showContextTooltip() {
    const tip = el('context-tooltip');
    if (!tip || !el('panel')?.hidden) return;
    state.tooltipOpen = true;
    tip.setAttribute('data-visible', 'true');
    positionContextTooltip();
  }

  function hideContextTooltip() {
    const tip = el('context-tooltip');
    if (!tip) return;
    state.tooltipOpen = false;
    tip.setAttribute('data-visible', 'false');
  }

  let elevatedStackAncestor = null;

  function syncHostStackingElevation(elevate) {
    try {
      if (elevate) {
        const z0 = host.closest?.('div.relative.z-0');
        if (z0?.style) {
          elevatedStackAncestor = z0;
          z0.style.zIndex = '40';
        }
      } else if (elevatedStackAncestor?.style) {
        elevatedStackAncestor.style.zIndex = '';
        elevatedStackAncestor = null;
      }
    } catch {}
  }

  function getLeftProjectSidebarRight(vw) {
    try {
      if (typeof document.querySelector === 'function') {
        const navEl = document.querySelector('div[role="navigation"]');
        if (navEl?.getBoundingClientRect) {
          const nr = navEl.getBoundingClientRect();
          if (nr.width > 0 && nr.left <= 8 && nr.right > 0 && nr.right < vw - 260) {
            return Math.ceil(nr.right);
          }
        }
      }
    } catch {}
    return 0;
  }

  function positionFloatingPanels() {
    if (!host.getBoundingClientRect) return;
    try {
      const hRect = host.getBoundingClientRect();
      if (hRect.width === 0 && hRect.height === 0) return;
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
      const navRight = getLeftProjectSidebarRight(vw);
      const minLeft = navRight > 0 ? Math.max(12, navRight + 12) : 12;

      const placePanel = (panelEl, targetW, anchorBtn) => {
        if (!panelEl) return;
        const bRect = (anchorBtn && anchorBtn.getBoundingClientRect && anchorBtn !== host && anchorBtn.getBoundingClientRect().right > hRect.left)
          ? anchorBtn.getBoundingClientRect()
          : hRect;
        const top = Math.max(36, Math.min(vh - 120, Math.round((bRect.bottom || hRect.bottom) + 6)));
        const isCompact = panelEl.classList?.contains?.('cost-compact-view') || panelEl.getAttribute?.('class')?.includes?.('cost-compact-view');
        const effW = isCompact ? 400 : targetW;
        const maxAvailW = Math.max(260, vw - minLeft - 12);

        // 核心锚点：右侧精确对齐到触发按钮右边缘，展开时向左下自然伸展，收起时向右上自然收拢
        let left = Math.round(bRect.right - effW);
        left = Math.min(left, vw - effW - 12);
        left = Math.max(minLeft, left);

        panelEl.style.top = `${top}px`;
        panelEl.style.left = `${left}px`;
        panelEl.style.right = 'auto';
        panelEl.style.maxWidth = `${maxAvailW}px`;
        panelEl.style.transformOrigin = 'top right';
      };

      placePanel(el('panel'), 450, el('badge'));
      placePanel(el('panel-tokens'), 730, el('badge-tokens'));
      placePanel(el('overflow-menu'), 220, el('badge-overflow'));
    } catch {}
  }

  try {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateResponsiveLayout());
      if (document.body) resizeObserver.observe(document.body);
    }
    if (typeof MutationObserver !== 'undefined' && document.body) {
      hostDomObserver = new MutationObserver(() => {
        if (!host.isConnected || host.getAttribute('data-dock') !== 'flow' || !findHostTitlebar()?.contains?.(host)) {
          scheduleLayoutSync();
        }
      });
      hostDomObserver.observe(document.body, { childList: true, subtree: true });
    }
  } catch {}

  onWindowResize = () => updateResponsiveLayout();
  onWindowFocus = () => host.setAttribute('data-window-active', 'true');
  onWindowBlur = () => host.setAttribute('data-window-active', 'false');
  try {
    window.addEventListener?.('resize', onWindowResize);
    window.addEventListener?.('focus', onWindowFocus);
    window.addEventListener?.('blur', onWindowBlur);
    navigator?.windowControlsOverlay?.addEventListener?.('geometrychange', onWindowResize);
  } catch {}

  ensureHostDocked();

  // =========================================================================
  // 模块 3: 面板、气泡与溢出菜单交互
  // =========================================================================
  function withStepError(value, metadata) {
    const error = state.scan?.session?.currentError;
    if (!error || value?.error) return value;
    const lastStep = Math.max(-1, ...(metadata?.stepIndices || []), metadata?.chatModel?.chatStartMetadata?.startStepIndex ?? -1);
    if (lastStep > error.index) return value;
    const failure = summarize({ chatModel: { retryInfos: [{ error: error.text }] } }, {
      currentModel: value?.model || state.latest?.model || '',
      cascadeModelConfigs: state.cascadeModelConfigs || state.scan?.cascadeModelConfigs || [],
      previousValidContext: value
    });
    return {
      ...(value || {}),
      error: failure.error,
      errorClassification: failure.errorClassification,
      exceeded: failure.exceeded,
      network: failure.network,
      serviceLimit: failure.serviceLimit || value?.serviceLimit || null,
      status: failure.status,
      // 解耦：保留已有有效上下文数据，不归零、不清空
      used: value?.used ?? failure?.used ?? null,
      actual: failure.exceeded ? null : (value?.actual ?? null),
      estimate: value?.estimate ?? failure?.estimate ?? null,
      budget: value?.budget ?? failure?.budget ?? null,
      percent: failure.exceeded ? 100 : (value?.percent ?? null),
      estimated: value?.actual == null
    };
  }

  function isAnyPanelOpen() {
    return !el('panel').hidden || !el('panel-tokens').hidden;
  }

  function showPanel(target) {
    const pContext = el('panel');
    const pTokens = el('panel-tokens');
    const pOverflow = el('overflow-menu');
    const bContext = el('badge');
    const bSpeed = el('badge-speed');
    const bTokens = el('badge-tokens');
    const bQuota = el('badge-quota');
    const bOverflow = el('badge-overflow');

    hideUpdatePopover();
    if (pOverflow) pOverflow.hidden = true;
    bOverflow?.setAttribute('aria-expanded', 'false');

    if (target === 'tokens') {
      hideContextTooltip();
      closeColorPicker();
      pContext.hidden = true;
      pTokens.hidden = false;
      bContext.setAttribute('aria-expanded', 'false');
      bSpeed?.setAttribute('aria-expanded', 'false');
      bTokens.setAttribute('aria-expanded', 'true');
      syncHostStackingElevation(true);
      positionFloatingPanels();
      void syncTokenHistoryFromHost(false);
      renderActiveHeatView(true);
    } else if (target === 'context') {
      hideContextTooltip();
      closeColorPicker();
      setPlanDetailExpanded(false, { skipReposition: true });
      pTokens.hidden = true;
      pContext.hidden = false;
      bContext.setAttribute('aria-expanded', 'true');
      bSpeed?.setAttribute('aria-expanded', 'true');
      bTokens.setAttribute('aria-expanded', 'false');
      bQuota?.setAttribute('aria-expanded', 'true');
      syncHostStackingElevation(true);
      positionFloatingPanels();
      void pollLiveQuota();
      void refreshModulesDisplay();
    } else {
      setPlanDetailExpanded(false, { skipReposition: true });
      pContext.hidden = true;
      pTokens.hidden = true;
      bContext.setAttribute('aria-expanded', 'false');
      bSpeed?.setAttribute('aria-expanded', 'false');
      bTokens.setAttribute('aria-expanded', 'false');
      bQuota?.setAttribute('aria-expanded', 'false');
      closeColorPicker();
      hidePopover();
      syncHostStackingElevation(false);
    }
  }

  function toggle(open, tab = 'context') {
    if (!open) {
      showPanel('none');
    } else {
      showPanel(tab === 'tokens' ? 'tokens' : 'context');
    }
  }

  function toggleContext() {
    if (!el('panel').hidden) showPanel('none');
    else showPanel('context');
  }

  function toggleTokens() {
    if (!el('panel-tokens').hidden) showPanel('none');
    else showPanel('tokens');
  }

  function toggleOverflowMenu() {
    const pOverflow = el('overflow-menu');
    if (!pOverflow) return;
    const willOpen = pOverflow.hidden;
    showPanel('none');
    hideContextTooltip();
    pOverflow.hidden = !willOpen;
    el('badge-overflow')?.setAttribute('aria-expanded', String(willOpen));
    syncHostStackingElevation(willOpen);
    if (willOpen) positionFloatingPanels();
  }

  // 外观调色按钮直接展开抽屉
  el('btn-panel-palette')?.addEventListener('click', () => toggleColorsDrawer());
  el('btn-panel-tokens-palette')?.addEventListener('click', () => toggleTokenColorsDrawer());

  // =========================================================================
  // 统一定制下拉组件控制器 (国家 / 订阅地区 / 币种 / 增强 Select)
  // =========================================================================
  const COUNTRY_OPTIONS = [
    { value: '未知', label: '🌐 未设置 / 自动', code: 'AUTO', aliases: ['自动', '未知', 'none'] },
    { value: '美国 (US)', label: '🇺🇸 美国 (US)', code: 'US', aliases: ['美国', 'united states', 'usa'] },
    { value: '日本 (JP)', label: '🇯🇵 日本 (JP)', code: 'JP', aliases: ['日本', 'japan'] },
    { value: '韩国 (KR)', label: '🇰🇷 韩国 (KR)', code: 'KR', aliases: ['韩国', 'korea', 'south korea'] },
    { value: '中国台湾 (TW)', label: '🇹🇼 中国台湾 (TW)', code: 'TW', aliases: ['台湾', 'taiwan', 'tw'] },
    { value: '中国香港 (HK)', label: '🇭🇰 中国香港 (HK)', code: 'HK', aliases: ['香港', 'hong kong', 'hk'] },
    { value: '澳大利亚 (AU)', label: '🇦🇺 澳大利亚 (AU)', code: 'AU', aliases: ['澳大利亚', '澳洲', 'australia', 'au'] },
    { value: '新加坡 (SG)', label: '🇸🇬 新加坡 (SG)', code: 'SG', aliases: ['新加坡', 'singapore', 'sg'] },
    { value: '英国 (UK)', label: '🇬🇧 英国 (UK)', code: 'UK', aliases: ['英国', 'united kingdom', 'uk', 'gb', 'britain'] },
    { value: '德国 (DE)', label: '🇩🇪 德国 (DE)', code: 'DE', aliases: ['德国', 'germany', 'de'] },
    { value: '加拿大 (CA)', label: '🇨🇦 加拿大 (CA)', code: 'CA', aliases: ['加拿大', 'canada', 'ca'] },
    { value: '土耳其 (TR)', label: '🇹🇷 土耳其 (TR)', code: 'TR', aliases: ['土耳其', 'turkey', 'tr'] },
    { value: '尼日利亚 (NG)', label: '🇳🇬 尼日利亚 (NG)', code: 'NG', aliases: ['尼日利亚', 'nigeria', 'ng'] },
    { value: '菲律宾 (PH)', label: '🇵🇭 菲律宾 (PH)', code: 'PH', aliases: ['菲律宾', 'philippines', 'ph'] },
    { value: '印度 (IN)', label: '🇮🇳 印度 (IN)', code: 'IN', aliases: ['印度', 'india', 'in'] },
    { value: '马来西亚 (MY)', label: '🇲🇾 马来西亚 (MY)', code: 'MY', aliases: ['马来西亚', 'malaysia', 'my'] },
    { value: '巴西 (BR)', label: '🇧🇷 巴西 (BR)', code: 'BR', aliases: ['巴西', 'brazil', 'br'] },
    { value: '中国大陆 (CN)', label: '🇨🇳 中国大陆 (CN)', code: 'CN', aliases: ['中国大陆', '中国', 'china', 'cn'] }
  ];

  const CURRENCY_OPTIONS = [
    { value: 'USD', code: 'USD', symbol: '$', name: '美元', label: 'USD ($ 美元)', aliases: ['美元', 'usd', '$', 'dollar'] },
    { value: 'KRW', code: 'KRW', symbol: '₩', name: '韩元', label: 'KRW (₩ 韩元)', aliases: ['韩元', 'krw', '₩', 'won'] },
    { value: 'AUD', code: 'AUD', symbol: 'AU$', name: '澳元', label: 'AUD (AU$ 澳元)', aliases: ['澳元', '澳洲', 'aud', 'au$', 'australian'] },
    { value: 'JPY', code: 'JPY', symbol: '¥', name: '日元', label: 'JPY (¥ 日元)', aliases: ['日元', '日本', 'jpy', '¥', 'yen'] },
    { value: 'HKD', code: 'HKD', symbol: 'HK$', name: '港币', label: 'HKD (HK$ 港币)', aliases: ['港币', '香港', 'hkd', 'hk$'] },
    { value: 'TWD', code: 'TWD', symbol: 'NT$', name: '台币', label: 'TWD (NT$ 台币)', aliases: ['台币', '台湾', 'twd', 'ntd', 'nt$'] },
    { value: 'TRY', code: 'TRY', symbol: '₺', name: '里拉', label: 'TRY (₺ 里拉)', aliases: ['里拉', '土耳其', 'try', '₺', 'lira'] },
    { value: 'NGN', code: 'NGN', symbol: '₦', name: '奈拉', label: 'NGN (₦ 奈拉)', aliases: ['奈拉', '尼日利亚', 'ngn', '₦', 'naira'] },
    { value: 'CNY', code: 'CNY', symbol: '¥', name: '人民币', label: 'CNY (¥ 人民币)', aliases: ['人民币', '中国', 'cny', 'rmb', '¥', 'yuan'] },
    { value: 'EUR', code: 'EUR', symbol: '€', name: '欧元', label: 'EUR (€ 欧元)', aliases: ['欧元', '欧洲', 'eur', '€', 'euro'] },
    { value: 'GBP', code: 'GBP', symbol: '£', name: '英镑', label: 'GBP (£ 英镑)', aliases: ['英镑', '英国', 'gbp', '£', 'pound'] },
    { value: 'SGD', code: 'SGD', symbol: 'S$', name: '新元', label: 'SGD (S$ 新元)', aliases: ['新元', '新加坡', 'sgd', 's$'] },
    { value: 'CAD', code: 'CAD', symbol: 'CA$', name: '加元', label: 'CAD (CA$ 加元)', aliases: ['加元', '加拿大', 'cad', 'ca$'] },
    { value: 'PHP', code: 'PHP', symbol: '₱', name: '比索', label: 'PHP (₱ 比索)', aliases: ['比索', '菲律宾', 'php', '₱', 'peso'] },
    { value: 'INR', code: 'INR', symbol: '₹', name: '卢比', label: 'INR (₹ 卢比)', aliases: ['卢比', '印度', 'inr', '₹', 'rupee'] },
    { value: 'MYR', code: 'MYR', symbol: 'RM', name: '令吉', label: 'MYR (RM 令吉)', aliases: ['令吉', '马来西亚', 'myr', 'rm', 'ringgit'] },
    { value: 'BRL', code: 'BRL', symbol: 'R$', name: '雷亚尔', label: 'BRL (R$ 雷亚尔)', aliases: ['雷亚尔', '巴西', 'brl', 'r$', 'real'] }
  ];

  function hasClass(node, cls) {
    if (!node) return false;
    if (node.classList?.contains) return node.classList.contains(cls);
    return String(node.className || '').split(/\s+/).includes(cls);
  }
  function addClass(node, cls) {
    if (!node) return;
    if (node.classList?.add) { node.classList.add(cls); return; }
    const cur = String(node.className || '').trim();
    if (!cur.split(/\s+/).includes(cls)) node.className = cur ? `${cur} ${cls}` : cls;
  }
  function removeClass(node, cls) {
    if (!node) return;
    if (node.classList?.remove) { node.classList.remove(cls); return; }
    const parts = String(node.className || '').split(/\s+/).filter(c => c !== cls);
    node.className = parts.join(' ');
  }

  // 纯同步 UI 控件回填防护守卫（仅在纯同步赋值代码块内开启，严禁跨越 await）
  let isHydratingUiControls = false;
  function runWithUiHydration(fn) {
    const prev = isHydratingUiControls;
    isHydratingUiControls = true;
    try {
      return fn();
    } finally {
      isHydratingUiControls = prev;
    }
  }

  // 兼容老调用声明
  let isRestoringSettings = false;

  // 异步时序保护：用户主动修改序列号与恢复请求版本号
  let userActionSeq = 0;
  let restoreRequestSeq = 0;
  let activeBadgeTimerId = null;
  let activeCnyTimerId = null;
  let activeBadgeRafId = null;
  let lastBadgePriceState = null;
  let lastSavedCustomPlan = null;

  function renderPlanSummaryPriceBadge(targetSymbol, targetNum, targetCycle, targetCnyText, options = {}) {
    const priceValEl = el('plan-summary-price-val');
    const priceCnyEl = el('plan-summary-price-cny');
    const badgeEl = el('plan-summary-price-badge');
    if (!priceValEl) return;

    if (activeBadgeTimerId) {
      clearTimeout(activeBadgeTimerId);
      activeBadgeTimerId = null;
    }
    if (activeCnyTimerId) {
      clearTimeout(activeCnyTimerId);
      activeCnyTimerId = null;
    }
    if (activeBadgeRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(activeBadgeRafId);
      activeBadgeRafId = null;
    }

    const formattedFinalNum = targetNum !== null && targetNum !== undefined
      ? (Number(targetNum) % 1 === 0 ? String(Number(targetNum)) : Number(targetNum).toFixed(2))
      : '';

    // 轻量模拟环境安全兼容
    if (typeof priceValEl.querySelector !== 'function') {
      priceValEl.textContent = `${targetSymbol}${formattedFinalNum}${targetCycle}`;
      if (priceCnyEl) priceCnyEl.textContent = targetCnyText;
      lastBadgePriceState = {
        symbol: targetSymbol,
        num: targetNum !== null ? Number(targetNum) : 0,
        cycle: targetCycle,
        cnyText: targetCnyText
      };
      return;
    }

    const hasRaf = typeof requestAnimationFrame === 'function';
    const forceDirect = options.forceDirect || !hasRaf || !lastBadgePriceState;

    if (forceDirect) {
      priceValEl.innerHTML = `<span class="badge-symbol-anim">${targetSymbol}</span><span class="badge-num-anim">${formattedFinalNum}</span><span class="badge-cycle-anim">${targetCycle}</span>`;
      if (priceCnyEl) priceCnyEl.textContent = targetCnyText;
      lastBadgePriceState = {
        symbol: targetSymbol,
        num: targetNum !== null ? Number(targetNum) : 0,
        cycle: targetCycle,
        cnyText: targetCnyText
      };
      return;
    }

    const startNum = (lastBadgePriceState && Number.isFinite(lastBadgePriceState.num))
      ? lastBadgePriceState.num
      : (Number(targetNum) || 0);
    const endNum = targetNum !== null ? Number(targetNum) : 0;
    const startSymbol = lastBadgePriceState?.symbol || targetSymbol;
    const endSymbol = targetSymbol;

    // 确保内部 DOM 结构完整
    let symbolEl = priceValEl.querySelector?.('.badge-symbol-anim');
    let numEl = priceValEl.querySelector?.('.badge-num-anim');
    let cycleEl = priceValEl.querySelector?.('.badge-cycle-anim');

    if (!symbolEl || !numEl || !cycleEl) {
      priceValEl.innerHTML = `<span class="badge-symbol-anim">${startSymbol}</span><span class="badge-num-anim">${formattedFinalNum}</span><span class="badge-cycle-anim">${targetCycle}</span>`;
      symbolEl = priceValEl.querySelector?.('.badge-symbol-anim');
      numEl = priceValEl.querySelector?.('.badge-num-anim');
      cycleEl = priceValEl.querySelector?.('.badge-cycle-anim');
    }

    if (cycleEl) cycleEl.textContent = targetCycle;

    // 1. 货币符号消散再切换动画 (Symbol Dissolve & Crossfade)
    if (startSymbol !== endSymbol && symbolEl && symbolEl.classList) {
      symbolEl.classList.remove('is-entering');
      symbolEl.classList.add('is-dissolving');

      activeBadgeTimerId = setTimeout(() => {
        symbolEl.textContent = endSymbol;
        symbolEl.classList.remove('is-dissolving');
        symbolEl.classList.add('is-entering');
        try { void symbolEl.offsetWidth; } catch {}
        setTimeout(() => {
          symbolEl.classList?.remove?.('is-entering');
        }, 180);
        activeBadgeTimerId = null;
      }, 160);
    } else if (symbolEl) {
      symbolEl.textContent = endSymbol;
    }

    // 2. CNY 折合平滑渐变
    if (priceCnyEl && priceCnyEl.textContent !== targetCnyText) {
      try {
        priceCnyEl.style.transition = 'opacity 0.18s ease';
        priceCnyEl.style.opacity = '0.2';
        activeCnyTimerId = setTimeout(() => {
          priceCnyEl.textContent = targetCnyText;
          priceCnyEl.style.opacity = '0.85';
          activeCnyTimerId = null;
        }, 140);
      } catch {
        priceCnyEl.textContent = targetCnyText;
      }
    }

    // 3. 数字滚动/递减递增动画 (Rolling Numeric Count Tween)
    if (startNum !== endNum && numEl) {
      if (badgeEl && badgeEl.classList) badgeEl.classList.add('is-animating');

      const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const duration = 500;
      const easeOut = t => 1 - Math.pow(1 - t, 4);

      const step = now => {
        const elapsed = Math.max(0, now - startTime);
        const progress = Math.min(1, elapsed / duration);
        const eased = easeOut(progress);
        const currentVal = startNum + (endNum - startNum) * eased;

        if (progress < 1) {
          if (endNum % 1 !== 0) {
            numEl.textContent = currentVal >= 100 ? String(Math.round(currentVal)) : currentVal.toFixed(2);
          } else {
            numEl.textContent = String(Math.round(currentVal));
          }
          activeBadgeRafId = requestAnimationFrame(step);
        } else {
          numEl.textContent = formattedFinalNum;
          if (badgeEl && badgeEl.classList) badgeEl.classList.remove('is-animating');
          activeBadgeRafId = null;
        }
      };

      activeBadgeRafId = requestAnimationFrame(step);
    } else if (numEl) {
      numEl.textContent = formattedFinalNum;
    }

    lastBadgePriceState = {
      symbol: targetSymbol,
      num: endNum,
      cycle: targetCycle,
      cnyText: targetCnyText
    };
  }

  function renderPlanDetail(ps) {
    if (!ps) return;
    const sumTxt = el('plan-summary-text');
    if (sumTxt) {
      const modeTxt = ps.status === 'identified' ? '已自动识别' : ps.hasCustomSettings ? '自定义生效' : '未识别/默认';
      sumTxt.textContent = `${ps.tierName || 'Pro'} · ${modeTxt} · 刚刚更新`;
    }
    // 实时联动更新黄框位置的订阅费与汇率胶囊 (支持动效与符号消散)
    const curSymbol = ps.currencySymbol || '$';
    let targetSymbol = '$';
    let targetNum = 19.99;
    let targetCycle = '/月';
    let targetCny = '(≈ ¥134.3 CNY)';

    if (ps.actualPricePaid === 0 || ps.isZeroExtraCost) {
      targetSymbol = curSymbol;
      targetNum = 0;
      targetCycle = '/月';
      targetCny = '(随套餐免费)';
    } else if (ps.actualPricePaid !== null && ps.actualPricePaid !== undefined) {
      targetSymbol = curSymbol;
      targetNum = Number(ps.actualPricePaid);
      targetCycle = '/月';
      if (ps.currency === 'CNY') {
        targetCny = '';
      } else if (ps.cnyFormatted) {
        targetCny = '(' + ps.cnyFormatted.replace('折合 ', '') + ')';
      } else {
        targetCny = '';
      }
    } else if (ps.officialPriceMonthly !== null && ps.officialPriceMonthly !== undefined) {
      targetSymbol = '$';
      targetNum = Number(ps.officialPriceMonthly);
      targetCycle = '/月';
      targetCny = '(≈ ¥134.3 CNY)';
    } else {
      targetSymbol = '$';
      targetNum = 19.99;
      targetCycle = '/月';
      targetCny = '(≈ ¥134.3 CNY)';
    }

    renderPlanSummaryPriceBadge(targetSymbol, targetNum, targetCycle, targetCny);

    const detName = el('p-det-name');
    if (detName) detName.textContent = ps.tierName || 'Google AI Pro';
    const detAcc = el('p-det-account');
    if (detAcc) detAcc.textContent = ps.email || '未识别当前登录邮箱';

    // 守卫：若当前不在 Token 统计视图或详情处于收起状态，严禁异步返回时撑开详情面板
    const cardEl = el('plan-detail-card');
    if (cardEl && (activeTokenView !== 'tokens' || !planDetailExpanded)) {
      cardEl.style.display = 'none';
      cardEl.classList?.remove?.('is-expanded');
    }

    const detCountry = el('p-det-country');
    const tagCountry = el('p-det-country-tag');
    const directCountrySel = el('direct-country-select');
    const countryText = (ps.country && !String(ps.country).includes('未知')) ? String(ps.country).trim() : '未知';
    if (detCountry) detCountry.textContent = countryText;
    if (tagCountry) {
      tagCountry.style.display = ps.countrySource === 'custom' ? 'inline-block' : 'none';
      tagCountry.textContent = ps.countrySource === 'custom' ? '自定义' : '';
    }

    const detReg = el('p-det-region');
    const tagReg = el('p-det-region-tag');
    let regText = ps.subscriptionRegion || ps.region || '未知';
    if (regText.includes('未在当前会话中获取') || regText.trim() === '未知') regText = '未知';
    if (detReg) detReg.textContent = regText;
    if (tagReg) {
      tagReg.style.display = ps.regionSource === 'custom' ? 'inline-block' : 'none';
      tagReg.textContent = ps.regionSource === 'custom' ? '自定义' : '';
    }

    const detCur = el('p-det-currency');
    const tagCur = el('p-det-currency-tag');
    const directCurSel = el('direct-currency-select');
    const curText = ps.currency || 'USD';
    if (detCur) detCur.textContent = curText;
    if (tagCur) {
      tagCur.style.display = ps.currencySource === 'custom' ? 'inline-block' : 'none';
      tagCur.textContent = ps.currencySource === 'custom' ? '自定义' : '';
    }

    // 使用纯同步回填守卫同步更新详情面板内的下拉控件值
    runWithUiHydration(() => {
      if (directCountrySel) {
        if (countryText !== '未知' && directCountrySel.options) {
          const exists = Array.from(directCountrySel.options).some(o => o.value === countryText);
          if (!exists && typeof document.createElement === 'function') {
            const opt = document.createElement('option');
            opt.value = countryText;
            opt.textContent = '🌐 ' + countryText;
            directCountrySel.appendChild?.(opt);
          }
        }
        directCountrySel.value = countryText;
      }
      if (directCurSel) {
        directCurSel.value = curText === 'NTD' ? 'TWD' : curText;
      }
    });

    // 刷新国家、订阅地区与币种直接选择器标签与选中高亮
    if (typeof refreshDirectCountryDisplay === 'function') {
      refreshDirectCountryDisplay(countryText);
    }
    if (typeof refreshDirectRegionDisplay === 'function') {
      refreshDirectRegionDisplay(regText);
    }
    if (typeof refreshDirectCurrencyDisplay === 'function') {
      refreshDirectCurrencyDisplay(curText);
    }

    const detAcq = el('p-det-acq');
    const tagAcq = el('p-det-acq-tag');
    if (detAcq) detAcq.textContent = ps.acquisitionSourceName || '正常付费订阅';
    if (tagAcq) {
      const isPromo = ps.acquisitionSource && ps.acquisitionSource !== 'normal_paid';
      tagAcq.style.display = isPromo ? 'inline-block' : 'none';
      tagAcq.textContent = isPromo ? '活动权益' : '';
    }

    const detPrice = el('p-det-price');
    const tagPrice = el('p-det-price-tag');
    const isPresetMode = ps.priceMode === 'preset';
    const btnModePreset = el('btn-mode-preset');
    const btnModeCustom = el('btn-mode-custom');
    if (btnModePreset) setPillActive(btnModePreset, isPresetMode);
    if (btnModeCustom) setPillActive(btnModeCustom, !isPresetMode);

    if (detPrice) {
      if (ps.actualPricePaid === 0 || ps.isZeroExtraCost) {
        detPrice.textContent = `${curSymbol}0 · ${ps.billingCycle || '随套餐包含'}`;
      } else if (ps.actualPricePaid !== null && ps.actualPricePaid !== undefined) {
        const cnyPart = (ps.currency !== 'CNY' && ps.cnyFormatted) ? ` (${ps.cnyFormatted})` : '';
        const paidFormatted = Number(ps.actualPricePaid) % 1 === 0 ? Number(ps.actualPricePaid) : Number(ps.actualPricePaid).toFixed(2);
        detPrice.textContent = `${curSymbol}${paidFormatted} · ${ps.billingCycle || '月付'}${cnyPart}`;
      } else if (ps.priceRangeNote && ps.priceRangeNote !== '未知') {
        detPrice.textContent = ps.priceRangeNote.replace(/[（\(][^）\)]*[）\)]/g, '').trim();
      } else if (ps.officialPriceMonthly !== null && ps.officialPriceMonthly !== undefined) {
        detPrice.textContent = `公开参考价 $${ps.officialPriceMonthly}/月`;
      } else {
        detPrice.textContent = '未知';
      }
    }
    if (tagPrice) {
      tagPrice.style.display = 'inline-block';
      if (ps.actualPricePaid === 0 || ps.isZeroExtraCost) {
        tagPrice.textContent = '手动确认 · 免费';
      } else if (ps.priceMode === 'custom' || ps.priceSource === 'custom') {
        tagPrice.textContent = '用户实付';
      } else if (ps.priceSource === 'preset_region' || isPresetMode) {
        tagPrice.textContent = '官方定价';
      } else {
        tagPrice.textContent = '公开参考价';
      }
    }

    const dtVal = el('p-dt-validity');
    const ddVal = el('p-det-validity');
    if (dtVal && ddVal) {
      if (ps.validEndDate) {
        dtVal.style.display = 'block';
        ddVal.style.display = 'block';
        ddVal.textContent = `至 ${ps.validEndDate}${ps.isExpired ? ' · ⚠️ 权益已到期' : ' · 有效期内'}`;
        ddVal.style.color = ps.isExpired ? '#ef4444' : 'var(--ag-text-secondary)';
      } else {
        dtVal.style.display = 'none';
        ddVal.style.display = 'none';
      }
    }

    const dtNote = el('p-dt-note');
    const ddNote = el('p-det-note');
    if (dtNote && ddNote) {
      if (ps.customNote) {
        dtNote.style.display = 'block';
        ddNote.style.display = 'block';
        ddNote.textContent = String(ps.customNote);
      } else {
        dtNote.style.display = 'none';
        ddNote.style.display = 'none';
      }
    }

    const pPrompt = el('p-det-prompt-credits');
    const pFlow = el('p-det-flow-credits');
    if (pPrompt && ps.promptCredits) {
      const promptTxt = `Prompt Credits: ${ps.promptCredits.available ?? '—'} 可用 / ${ps.promptCredits.monthly ?? '—'} 月额度`;
      pPrompt.textContent = promptTxt;
      const pLegacy = el('p-det-credits');
      if (pLegacy) pLegacy.textContent = promptTxt;
    }
    if (pFlow && ps.flowCredits) {
      pFlow.textContent = `${ps.flowCredits?.available ?? '—'} 可用 / ${ps.flowCredits?.monthly ?? '—'} 月额度`;
    }
    const detTime = el('p-det-time');
    if (detTime) {
      const timeStr = ps.updatedAt ? new Date(ps.updatedAt).toLocaleString() : '—';
      const verifyStr = ps.pricingTableVerifiedDate ? ` · 价表核对：${ps.pricingTableVerifiedDate}` : '';
      detTime.textContent = `${timeStr}${verifyStr}`;
    }
  }

  function setPillActive(node, active) {
    if (!node) return;
    node.classList?.toggle?.('active', active);
    const cur = node.getAttribute('class') || 'switch-pill-btn';
    if (active) {
      if (!cur.includes('active')) node.setAttribute('class', (cur + ' active').trim());
    } else {
      node.setAttribute('class', cur.replace(/\bactive\b/g, '').trim());
    }
  }

  // 数据源切换（全部 / 桌面 / CLI）
  let activeTokenSource = 'all';
  try {
    const savedSrc = typeof localStorage !== 'undefined' && localStorage.getItem('ag_token_source_v1');
    if (savedSrc === 'all' || savedSrc === 'desktop' || savedSrc === 'cli') {
      activeTokenSource = savedSrc;
    }
  } catch {}
  function syncTokenSourceButtons(src) {
    setPillActive(el('src-tab-all'), src === 'all');
    setPillActive(el('src-tab-desktop'), src === 'desktop');
    setPillActive(el('src-tab-cli'), src === 'cli');
  }
  syncTokenSourceButtons(activeTokenSource);

  function switchTokenSource(src) {
    if (src !== 'all' && src !== 'desktop' && src !== 'cli') src = 'all';
    activeTokenSource = src;
    try { localStorage?.setItem('ag_token_source_v1', src); } catch {}
    syncTokenSourceButtons(src);

    if (ANTIGRAVITY_TOKEN_DATA.rawPayload) {
      applyTokenHistoryPayload(ANTIGRAVITY_TOKEN_DATA.rawPayload);
    } else {
      const bySrc = ANTIGRAVITY_TOKEN_DATA.dailyMapBySource || {};
      const srcMap = bySrc[src] || bySrc.all || ANTIGRAVITY_TOKEN_DATA.dailyMap;
      ANTIGRAVITY_TOKEN_DATA.dailyMap = srcMap;
      renderActiveHeatView(true);
      renderActiveCostEstimateView();
    }
  }
  el('src-tab-all')?.addEventListener('click', () => switchTokenSource('all'));
  el('src-tab-desktop')?.addEventListener('click', () => switchTokenSource('desktop'));
  el('src-tab-cli')?.addEventListener('click', () => switchTokenSource('cli'));

  // 视图切换（Token 统计 / API 等值估算）
  let activeTokenView = 'tokens';

  // 费用面板紧凑摘要与展开详情切换
  let costDetailsExpanded = false;
  function toggleCostDetails(expand) {
    if (expand === undefined) costDetailsExpanded = !costDetailsExpanded;
    else costDetailsExpanded = Boolean(expand);

    const pane = el('cost-details-pane');
    const btn = el('btn-cost-details-toggle');
    const pTokens = el('panel-tokens');

    if (pane) {
      pane.style.display = costDetailsExpanded ? 'block' : 'none';
      if (costDetailsExpanded) pane.style.animation = 'agFadeIn .2s cubic-bezier(0.16,1,0.3,1)';
    }
    if (btn) btn.textContent = costDetailsExpanded ? '收起详情 ▲' : '展开详情 ▼';
    if (pTokens) {
      const isCompact = activeTokenView === 'cost' && !costDetailsExpanded;
      pTokens.classList?.toggle?.('cost-compact-view', isCompact);
      const curCls = pTokens.getAttribute?.('class') || '';
      if (isCompact) {
        if (!curCls.includes('cost-compact-view')) pTokens.setAttribute?.('class', (curCls + ' cost-compact-view').trim());
      } else {
        pTokens.setAttribute?.('class', curCls.replace(/\bcost-compact-view\b/g, '').trim());
      }
    }
    positionFloatingPanels();
  }
  el('btn-cost-details-toggle')?.addEventListener('click', () => toggleCostDetails());
  el('btn-cost-details-collapse')?.addEventListener('click', () => toggleCostDetails(false));
  el('btn-cost-fill-sub')?.addEventListener('click', () => {
    switchTokenView('tokens');
    setPlanDetailExpanded(true);
    togglePlanCustomForm(true);
  });
  toggleCostDetails(false);

  function switchTokenView(v) {
    activeTokenView = v;
    // 离开 Token 统计视图时关闭订阅详情与表单
    if (v !== 'tokens') {
      setPlanDetailExpanded(false, { skipReposition: true });
    } else {
      setPlanDetailExpanded(false, { skipReposition: true });
    }
    setPillActive(el('tok-view-tokens'), v === 'tokens');
    setPillActive(el('tok-view-cost'), v === 'cost');
    const costCard = el('cost-estimate-card');
    const tokensMain = el('tokens-main-view');
    const statCards = el('token-stat-cards');
    const planBar = el('plan-summary-bar');
    const titleTokens = el('panel-tokens-title');
    const pTokens = el('panel-tokens');

    if (costCard) {
      costCard.style.display = v === 'cost' ? 'block' : 'none';
      if (v === 'cost') costCard.style.animation = 'agFadeIn .18s cubic-bezier(0.16,1,0.3,1)';
    }
    if (tokensMain) {
      tokensMain.style.display = v === 'tokens' ? 'block' : 'none';
      if (v === 'tokens') tokensMain.style.animation = 'agFadeIn .18s cubic-bezier(0.16,1,0.3,1)';
    }
    if (statCards) statCards.style.display = v === 'tokens' ? 'grid' : 'none';
    if (planBar) planBar.style.display = v === 'tokens' ? 'flex' : 'none';
    if (titleTokens) titleTokens.textContent = v === 'cost' ? 'API 价格折算' : '本机已记录用量';

    if (pTokens) {
      const isCompact = v === 'cost' && !costDetailsExpanded;
      pTokens.classList?.toggle?.('cost-compact-view', isCompact);
      const curCls = pTokens.getAttribute?.('class') || '';
      if (isCompact) {
        if (!curCls.includes('cost-compact-view')) pTokens.setAttribute?.('class', (curCls + ' cost-compact-view').trim());
      } else {
        pTokens.setAttribute?.('class', curCls.replace(/\bcost-compact-view\b/g, '').trim());
      }
    }
    positionFloatingPanels();
  }
  el('tok-view-tokens')?.addEventListener('click', () => switchTokenView('tokens'));
  el('tok-view-cost')?.addEventListener('click', () => switchTokenView('cost'));

  // =========================================================================
  // 一键启动 CLI 模式（当前项目目录绑定 + 中文/空格路径兼容 + 错误提示）
  // =========================================================================
  let cliLaunchBusy = false;
  let cliToastTimer = null;
  let lastCliLaunchResult = null;

  function showCliToast(message, isError = false) {
    const toast = el('cli-launch-toast');
    if (!toast) return;
    if (cliToastTimer) {
      clearTimeout(cliToastTimer);
      cliToastTimer = null;
    }
    toast.hidden = false;
    toast.setAttribute('data-tone', isError ? 'error' : 'info');
    toast.textContent = message;
    cliToastTimer = setTimeout(() => {
      toast.hidden = true;
      cliToastTimer = null;
    }, isError ? 5200 : 3200);
  }

  async function triggerLaunchCli(customOpts = {}) {
    if (cliLaunchBusy) {
      showCliToast('CLI 正在启动中，请稍候…', false);
      return { ok: false, error: 'CLI 正在启动中，请稍候' };
    }
    cliLaunchBusy = true;
    const btn = el('badge-cli');
    const label = el('cli-label');
    btn?.setAttribute('data-busy', 'true');
    if (label) label.textContent = '…';
    try {
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        document.activeElement.blur();
      }
    } catch {}

    const hostBounds = {
      x: typeof window !== 'undefined' ? (window.screenX || 0) : 0,
      y: typeof window !== 'undefined' ? (window.screenY || 0) : 0,
      width: typeof window !== 'undefined' ? (window.outerWidth || window.innerWidth || 1200) : 1200,
      height: typeof window !== 'undefined' ? (window.outerHeight || window.innerHeight || 800) : 800
    };

    const reqOpts = {
      cascadeId: state.route || undefined,
      cwd: customOpts.cwd !== undefined ? customOpts.cwd : (state.scan?.workspacePath || undefined),
      hostBounds,
      ...customOpts
    };
    try {
      let res = null;
      if (typeof window !== 'undefined' && typeof window.contextMeterAPI?.launchCli === 'function') {
        res = await window.contextMeterAPI.launchCli(reqOpts);
      } else if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
        const live = window.__AGContextMeterLive;
        const r = await fetch(`http://127.0.0.1:${live.port}/launch-cli`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AG-Context-Token': live.token },
          body: JSON.stringify(reqOpts)
        });
        res = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      } else {
        res = { ok: false, code: 'NO_BRIDGE', error: '本地桥接服务未连接，请执行 node cli.js install 或重启客户端' };
      }

      lastCliLaunchResult = res;
      if (res && res.ok) {
        const om = el('overflow-menu');
        if (om) om.hidden = true;
        showCliToast(`✔ 已启动 Antigravity CLI（目录：${res.cwd || '默认'}）`, false);
        return res;
      } else {
        const errMsg = res?.error || '未检测到可用的 Antigravity CLI (agy)，请检查安装路径';
        showCliToast(`✖ 启动 CLI 失败：${errMsg}`, true);
        return res || { ok: false, error: errMsg };
      }
    } catch (err) {
      const errMsg = err?.message || '启动 CLI 发生异常';
      lastCliLaunchResult = { ok: false, error: errMsg };
      showCliToast(`✖ 启动 CLI 失败：${errMsg}`, true);
      return lastCliLaunchResult;
    } finally {
      cliLaunchBusy = false;
      btn?.removeAttribute('data-busy');
      btn?.removeAttribute('data-pressed');
      if (label) label.textContent = 'CLI';
    }
  }

  const badgeCliEl = el('badge-cli');
  if (badgeCliEl) {
    const releasePress = () => {
      badgeCliEl.removeAttribute('data-pressed');
    };
    badgeCliEl.addEventListener('pointerdown', () => {
      badgeCliEl.setAttribute('data-pressed', 'true');
    });
    badgeCliEl.addEventListener('pointerup', releasePress);
    badgeCliEl.addEventListener('pointercancel', releasePress);
    badgeCliEl.addEventListener('mouseleave', releasePress);
    badgeCliEl.addEventListener('blur', releasePress);
    badgeCliEl.addEventListener('click', () => {
      releasePress();
      void triggerLaunchCli();
    });
  }
  el('overflow-cli-btn')?.addEventListener('click', () => { void triggerLaunchCli(); });

  
  el('badge-quota')?.addEventListener('click', toggleContext);
  el('overflow-quota-btn')?.addEventListener('click', () => showPanel('context'));
  el('btn-switch-to-tokens')?.addEventListener('click', () => showPanel('tokens'));
  el('btn-switch-to-context')?.addEventListener('click', () => showPanel('context'));

  el('badge').addEventListener('click', toggleContext);
  el('badge-speed')?.addEventListener('click', toggleContext);
  el('badge-tokens').addEventListener('click', toggleTokens);
  el('badge-overflow')?.addEventListener('click', toggleOverflowMenu);
  el('overflow-speed-btn')?.addEventListener('click', () => showPanel('context'));
  el('overflow-tokens-btn')?.addEventListener('click', () => showPanel('tokens'));
  el('close').addEventListener('click', () => showPanel('none'));
  el('close-tokens')?.addEventListener('click', () => showPanel('none'));

  // 上下文圆环悬停与键盘聚焦气泡（面板打开时不通过悬停误切，必须通过显式左键点击切换）
  el('badge').addEventListener('mouseenter', () => {
    if (!isAnyPanelOpen()) {
      showContextTooltip();
    }
  });
  el('badge').addEventListener('mouseleave', () => {
    hideContextTooltip();
  });
  el('badge').addEventListener('focus', () => {
    if (!isAnyPanelOpen()) showContextTooltip();
  });
  el('badge').addEventListener('blur', () => {
    hideContextTooltip();
  });

  el('theme-toggle')?.addEventListener('click', cycleTheme);
  el('theme-toggle-tokens')?.addEventListener('click', cycleTheme);
  el('badge').addEventListener('contextmenu', e => { e.preventDefault(); cycleTheme(); });
  el('badge-tokens').addEventListener('contextmenu', e => { e.preventDefault(); cycleTheme(); });
  el('badge-speed')?.addEventListener('contextmenu', e => { e.preventDefault(); cycleTheme(); });

  // 二级抽屉: 上下文加长折叠展开与状态机
  const btnUnlock = el('btn-toggle-unlock');
  const unlockDrawerBody = el('unlock-drawer-body');
  const unlockDrawerArrow = el('unlock-drawer-arrow');
  const unlockBadge = el('unlock-badge');
  const unlockStatusDesc = el('unlock-status-desc');
  const btnApplyUnlock = el('btn-apply-unlock');
  const btnRestoreUnlock = el('btn-restore-unlock');
  const btnRefreshUnlock = el('btn-refresh-unlock');
  const unlockResultBox = el('unlock-result-box');
  const unlockResultText = el('unlock-result-text');
  const unlockMetaTarget = el('unlock-meta-target');
  const unlockMetaArch = el('unlock-meta-arch');
  const unlockMetaSha = el('unlock-meta-sha');
  const unlockMetaBackup = el('unlock-meta-backup');
  const linkUnlockAuthor = el('link-unlock-author');
  const btnCopyUnlockLink = el('btn-copy-unlock-link');
  const unlockLinkToast = el('unlock-link-toast');

  let currentUnlockStatus = null;
  let isUnlocking = false;
  let unlockReqSeq = 0;

  function toggleUnlockDrawer(forceOpen) {
    if (!unlockDrawerBody) return;
    const isHidden = unlockDrawerBody.style.display === 'none' || !unlockDrawerBody.style.display;
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
    unlockDrawerBody.style.display = nextOpen ? 'block' : 'none';
    if (unlockDrawerArrow) unlockDrawerArrow.textContent = nextOpen ? '▲ 收起' : '▼ 展开';
    btnUnlock?.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen && !currentUnlockStatus) {
      void refreshUnlockStatus();
    }
  }
  btnUnlock?.addEventListener('click', () => toggleUnlockDrawer());

  async function invokeUnlockApi(endpoint, payload = {}) {
    if (endpoint === 'status' && window.contextMeterAPI?.getContextUnlockStatus) {
      return await window.contextMeterAPI.getContextUnlockStatus(payload);
    }
    if (endpoint === 'apply' && window.contextMeterAPI?.applyContextUnlock) {
      return await window.contextMeterAPI.applyContextUnlock(payload);
    }
    if (endpoint === 'restore' && window.contextMeterAPI?.restoreContextUnlock) {
      return await window.contextMeterAPI.restoreContextUnlock(payload);
    }
    if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
      const live = window.__AGContextMeterLive;
      const r = await fetch(`http://127.0.0.1:${live.port}/context-unlock-${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AG-Context-Token': live.token },
        body: JSON.stringify(payload)
      });
      return await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
    }
    return { ok: false, error: '未连接到桥接服务（请重启客户端生效新 IPC，或执行 node cli.js live）' };
  }

  async function refreshUnlockStatus() {
    if (!unlockBadge) return;
    const thisSeq = ++unlockReqSeq;
    try {
      const currentObservedBudget = (state.latest?.budget && state.latest.budget > 0)
        ? state.latest.budget
        : undefined;
      const res = await invokeUnlockApi('status', { currentBudget: currentObservedBudget });
      if (thisSeq !== unlockReqSeq) return;

      if (!res || !res.ok || !res.data) {
        unlockBadge.textContent = '检测失败';
        unlockBadge.className = 'key-pill pill-danger';
        if (unlockStatusDesc) unlockStatusDesc.textContent = res?.error || '获取后端状态失败。';
        return;
      }
      const data = res.data;
      currentUnlockStatus = data;

      unlockBadge.textContent = data.statusText || data.status;
      if (data.status === 'verified_active') {
        unlockBadge.className = 'key-pill pill-ok';
      } else if (data.status === 'patched_runtime_unconfirmed') {
        unlockBadge.className = 'key-pill pill-info';
      } else if (data.status === 'patched_pending_restart') {
        unlockBadge.className = 'key-pill pill-warn';
      } else if (data.status === 'not_patched') {
        unlockBadge.className = 'key-pill pill-muted';
      } else {
        unlockBadge.className = 'key-pill pill-danger';
      }

      if (unlockStatusDesc) {
        unlockStatusDesc.textContent = data.details || data.reason || '状态已更新。';
      }

      if (unlockMetaTarget) unlockMetaTarget.textContent = data.targetPath || '未检测到';
      if (unlockMetaArch) unlockMetaArch.textContent = `${data.arch || '未知'} (${data.format || '未知'}, ${data.mode || '未知'})`;
      if (unlockMetaSha) unlockMetaSha.textContent = data.sha256 ? `${data.sha256.slice(0, 16)}…` : '—';
      if (unlockMetaBackup) {
        if (data.hasBackup && data.backupInfo) {
          unlockMetaBackup.textContent = `已备份 (${data.backupInfo.backupPath})`;
        } else {
          unlockMetaBackup.textContent = '尚未备份（首次应用时将自动安全备份至应用目录外部）';
        }
      }

      if (btnApplyUnlock) {
        if (data.status === 'not_patched') {
          btnApplyUnlock.disabled = false;
          btnApplyUnlock.textContent = '⚡ 立即应用加长补丁';
        } else if (data.status === 'verified_active') {
          btnApplyUnlock.disabled = true;
          btnApplyUnlock.textContent = '✅ 已生效（无需重复应用）';
        } else if (data.status === 'patched_runtime_unconfirmed') {
          btnApplyUnlock.disabled = true;
          btnApplyUnlock.textContent = '🔍 补丁已写入（运行状态待确认）';
        } else if (data.status === 'patched_pending_restart') {
          btnApplyUnlock.disabled = true;
          btnApplyUnlock.textContent = '⏳ 已打补丁（待重启客户端）';
        } else {
          btnApplyUnlock.disabled = true;
          btnApplyUnlock.textContent = '⚠️ 当前目标不受支持';
        }
      }

      if (btnRestoreUnlock) {
        if (data.status === 'verified_active' || data.status === 'patched_pending_restart' || data.status === 'patched_runtime_unconfirmed' || data.hasBackup) {
          btnRestoreUnlock.disabled = false;
        } else {
          btnRestoreUnlock.disabled = true;
        }
      }
    } catch (e) {
      if (thisSeq !== unlockReqSeq) return;
      unlockBadge.textContent = '异常';
      unlockBadge.className = 'key-pill pill-danger';
      if (unlockStatusDesc) unlockStatusDesc.textContent = `检测异常: ${e.message}`;
    }
  }

  btnRefreshUnlock?.addEventListener('click', () => {
    void refreshUnlockStatus();
  });

  btnApplyUnlock?.addEventListener('click', async () => {
    if (isUnlocking) return;
    isUnlocking = true;
    if (btnApplyUnlock) btnApplyUnlock.disabled = true;
    if (unlockResultBox) unlockResultBox.style.display = 'none';

    try {
      const res = await invokeUnlockApi('apply');
      if (!res || !res.ok) {
        throw new Error(res?.error || '应用补丁失败');
      }
      if (unlockResultBox && unlockResultText) {
        unlockResultBox.style.display = 'block';
        unlockResultBox.className = 'unlock-result-box result-success';
        unlockResultText.innerHTML = `<strong>🎉 解锁成功！</strong><br>${res.message || '补丁已安全写入。'}`;
      }
    } catch (e) {
      if (unlockResultBox && unlockResultText) {
        unlockResultBox.style.display = 'block';
        unlockResultBox.className = 'unlock-result-box result-error';
        unlockResultText.innerHTML = `<strong>❌ 应用补丁失败：</strong>${e.message}`;
      }
    } finally {
      isUnlocking = false;
      await refreshUnlockStatus();
    }
  });

  btnRestoreUnlock?.addEventListener('click', async () => {
    if (isUnlocking) return;
    isUnlocking = true;
    if (btnRestoreUnlock) btnRestoreUnlock.disabled = true;
    if (unlockResultBox) unlockResultBox.style.display = 'none';

    try {
      const res = await invokeUnlockApi('restore');
      if (!res || !res.ok) {
        throw new Error(res?.error || '恢复原版失败');
      }
      if (unlockResultBox && unlockResultText) {
        unlockResultBox.style.display = 'block';
        unlockResultBox.className = 'unlock-result-box result-success';
        unlockResultText.innerHTML = `<strong>🔄 恢复成功！</strong><br>${res.message || '已成功还原官方原版二进制。'}`;
      }
    } catch (e) {
      if (unlockResultBox && unlockResultText) {
        unlockResultBox.style.display = 'block';
        unlockResultBox.className = 'unlock-result-box result-error';
        unlockResultText.innerHTML = `<strong>❌ 恢复原版失败：</strong>${e.message}`;
      }
    } finally {
      isUnlocking = false;
      await refreshUnlockStatus();
    }
  });

  const UNLOCK_POST_URL = 'https://linux.do/t/topic/3117832';
  let unlockToastTimer = null;

  function showUnlockToast(msg) {
    if (!unlockLinkToast) return;
    if (unlockToastTimer) clearTimeout(unlockToastTimer);
    unlockLinkToast.textContent = msg;
    unlockLinkToast.style.display = 'block';
    unlockToastTimer = setTimeout(() => {
      unlockLinkToast.style.display = 'none';
    }, 4500);
  }

  async function openUnlockAuthorPost() {
    let opened = false;
    try {
      if (window.contextMeterAPI?.openExternal) {
        const res = await window.contextMeterAPI.openExternal(UNLOCK_POST_URL);
        if (res && res.ok) opened = true;
      }
    } catch {}

    if (!opened) {
      try {
        const w = window.open(UNLOCK_POST_URL, '_blank');
        if (w) opened = true;
      } catch {}
    }

    if (opened) {
      showUnlockToast('已在系统默认浏览器中打开原作者帖子');
    } else {
      copyUnlockPostUrl(true);
    }
  }

  function copyUnlockPostUrl(fromFailedOpen = false) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(UNLOCK_POST_URL);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = UNLOCK_POST_URL;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copied = true;
      } catch {}
    }
    showUnlockToast(fromFailedOpen
      ? '无法直接唤起外部浏览器，原作者帖子链接已复制到剪贴板，可直接在浏览器粘贴访问。'
      : '原作者帖子链接已成功复制到剪贴板！');
  }

  linkUnlockAuthor?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void openUnlockAuthorPost();
  });

  linkUnlockAuthor?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      void openUnlockAuthorPost();
    }
  });

  btnCopyUnlockLink?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyUnlockPostUrl(false);
  });

  // -------------------------------------------------------------
  // 模块 2: 客户端界面汉化 (AntigravityChinese)
  // -------------------------------------------------------------
  const btnToggleChinese = el('btn-toggle-chinese');
  const chineseDrawerBody = el('chinese-drawer-body');
  const chineseDrawerArrow = el('chinese-drawer-arrow');
  const chineseBadge = el('chinese-badge');
  const chineseStatusDesc = el('chinese-status-desc');
  const btnToggleChineseModule = el('btn-toggle-chinese-module');

  let isChineseExpanded = false;
  let currentChineseEnabled = false;

  btnToggleChinese?.addEventListener('click', () => {
    isChineseExpanded = !isChineseExpanded;
    if (chineseDrawerBody) chineseDrawerBody.style.display = isChineseExpanded ? 'block' : 'none';
    if (chineseDrawerArrow) chineseDrawerArrow.textContent = isChineseExpanded ? '▲ 收起' : '▼ 展开';
    btnToggleChinese?.setAttribute('aria-expanded', String(isChineseExpanded));
    if (isChineseExpanded) {
      void refreshModulesDisplay();
    }
  });

  // -------------------------------------------------------------
  // 模块 3: 免 TUN 网络直连 (AntigravityProxyNoTun)
  // -------------------------------------------------------------
  const btnToggleProxy = el('btn-toggle-proxy');
  const proxyDrawerBody = el('proxy-drawer-body');
  const proxyDrawerArrow = el('proxy-drawer-arrow');
  const proxyBadge = el('proxy-badge');
  const proxyStatusDesc = el('proxy-status-desc');
  const inputProxyUrl = el('input-proxy-url');
  const inputProxyBypass = el('input-proxy-bypass');
  const btnTestProxy = el('btn-test-proxy');
  const btnToggleProxyModule = el('btn-toggle-proxy-module');
  const proxyTestResult = el('proxy-test-result');

  let isProxyExpanded = false;
  let currentProxyEnabled = false;

  btnToggleProxy?.addEventListener('click', () => {
    isProxyExpanded = !isProxyExpanded;
    if (proxyDrawerBody) proxyDrawerBody.style.display = isProxyExpanded ? 'block' : 'none';
    if (proxyDrawerArrow) proxyDrawerArrow.textContent = isProxyExpanded ? '▲ 收起' : '▼ 展开';
    btnToggleProxy?.setAttribute('aria-expanded', String(isProxyExpanded));
  });

  async function refreshModulesDisplay() {
    try {
      const api = window.contextMeterAPI;
      if (!api || typeof api.getModulesStatus !== 'function') return;
      const res = await api.getModulesStatus();
      if (!res || !res.ok || !res.data) {
        const errMsg = (res && res.error) ? res.error : '模块状态返回异常';
        if (chineseBadge) {
          chineseBadge.textContent = '⚠️ 读取失败';
          chineseBadge.className = 'key-pill pill-danger';
        }
        if (chineseStatusDesc) {
          chineseStatusDesc.textContent = `检测汉化状态失败: ${errMsg}`;
        }
        if (proxyBadge) {
          proxyBadge.textContent = '⚠️ 读取失败';
          proxyBadge.className = 'key-pill pill-danger';
        }
        if (proxyStatusDesc) {
          proxyStatusDesc.textContent = `检测免 TUN 代理状态失败: ${errMsg}`;
        }
        return;
      }
      const cfg = res.data;

      currentChineseEnabled = Boolean(cfg.modules?.chinese?.enabled);
      // 判定宿主界面是否已翻译：定向检查系统导航、活动栏、菜单及操作按钮等固有系统壳层（排除用户消息内容区域）
      const isDomTranslated = (() => {
        if (typeof window.__AGY_I18N_DATA__ !== 'undefined' || typeof window.__AGY_TRANSLATE_EL__ !== 'undefined') {
          return true;
        }
        try {
          const systemContainers = document.querySelectorAll(
            "div[role='navigation'], nav, header, [role='banner'], aside, [data-testid*='sidebar'], [data-testid*='navigation'], [class*='@container/titlebar'], .monaco-workbench, .activitybar"
          );
          const systemKeywords = ['新建对话', '新建会话', '新建', '设置', '账户', '项目', '关于', '帮助', '工作区', '管理', '自定义扩展', '资源管理器', '活动栏'];
          for (let i = 0; i < systemContainers.length; i++) {
            const container = systemContainers[i];
            if (container.closest && container.closest('.chat-session, .conversation-view, .monaco-list-row, .markdown, [data-testid*="chat"], [data-testid*="message"]')) {
              continue; // 严格排除用户聊天内容区
            }
            const labeledNodes = container.querySelectorAll ? container.querySelectorAll('button, a, [role="button"], [aria-label], [title], span') : [];
            for (let j = 0; j < Math.min(labeledNodes.length, 40); j++) {
              const node = labeledNodes[j];
              const label = (node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title'))) || '';
              if (label && systemKeywords.some(kw => label.includes(kw))) return true;
              const text = (node.textContent || '').trim();
              if (text && systemKeywords.some(kw => text.includes(kw))) return true;
            }
            const txt = container.innerText || '';
            if (systemKeywords.some(kw => txt.includes(kw))) return true;
          }
          const nav = document.querySelector("div[role='navigation'], nav");
          if (nav && nav.innerText && systemKeywords.some(kw => nav.innerText.includes(kw))) {
            return true;
          }
        } catch {}
        return false;
      })();
      const disk = res.disk || {};

      if (chineseBadge) {
        if (!currentChineseEnabled) {
          if (isDomTranslated) {
            chineseBadge.textContent = '⏳ 需重启恢复英文';
            chineseBadge.className = 'key-pill pill-warn';
          } else {
            chineseBadge.textContent = disk.chinese ? '⚪ 已关闭 (就绪)' : '⚪ 未安装';
            chineseBadge.className = 'key-pill pill-muted';
          }
        } else if (isDomTranslated) {
          chineseBadge.textContent = '🟢 已翻译生效';
          chineseBadge.className = 'key-pill pill-ok';
        } else if (!disk.chinese) {
          chineseBadge.textContent = '⚠️ 磁盘未注入';
          chineseBadge.className = 'key-pill pill-danger';
        } else {
          chineseBadge.textContent = '⏳ 待重启客户端生效';
          chineseBadge.className = 'key-pill pill-warn';
        }
      }
      if (chineseStatusDesc) {
        if (!currentChineseEnabled) {
          if (isDomTranslated) {
            chineseStatusDesc.textContent = '汉化模块已在配置中关闭；当前界面仍保留已加载的中文 DOM 缓存，需完全退出并重新打开 Antigravity 客户端以彻底恢复纯净官方原生英文。';
          } else {
            chineseStatusDesc.textContent = disk.chinese
              ? '客户端汉化已关闭（磁盘已具备汉化资源与配置门禁，开启后重启即可生效）。'
              : '客户端汉化处于未安装状态，保持官方原生英文界面。';
          }
        } else if (isDomTranslated) {
          chineseStatusDesc.textContent = '汉化引擎运行中：DOM 监听器正常工作，左侧边栏与核心菜单已成功翻译。';
        } else if (!disk.chinese) {
          chineseStatusDesc.textContent = '配置已开启，但当前磁盘 ASAR 未注入汉化资源；需退出客户端后通过命令行运行 node cli.js chinese:enable 完成注入。';
        } else {
          chineseStatusDesc.textContent = '汉化代码已注入且配置已开启；需完全退出并重新打开 Antigravity 客户端加载生效。';
        }
      }
      if (btnToggleChineseModule) {
        btnToggleChineseModule.textContent = currentChineseEnabled ? '关闭客户端汉化' : '开启客户端汉化';
      }

      currentProxyEnabled = Boolean(cfg.modules?.proxy?.enabled);
      if (proxyBadge) {
        if (currentProxyEnabled) {
          proxyBadge.textContent = disk.proxy ? '🟢 直连已配置' : '⚠️ 磁盘未注入';
          proxyBadge.className = disk.proxy ? 'key-pill pill-ok' : 'key-pill pill-warn';
        } else {
          proxyBadge.textContent = '⚪ 未启用';
          proxyBadge.className = 'key-pill pill-muted';
        }
      }
      if (inputProxyUrl && cfg.modules?.proxy?.proxyUrl) {
        inputProxyUrl.value = cfg.modules.proxy.proxyUrl;
      }
      if (inputProxyBypass && cfg.modules?.proxy?.bypassList) {
        inputProxyBypass.value = cfg.modules.proxy.bypassList;
      }
      if (proxyStatusDesc) {
        if (currentProxyEnabled) {
          proxyStatusDesc.textContent = disk.proxy
            ? `已启用本地网络直连（代理: ${cfg.modules.proxy.proxyUrl}）。注意：模型请求连通性待实际在线对话验证，未验证前不代表公网直连必定成功。`
            : `配置已开启代理，但当前磁盘 ASAR 未注入代理拦截逻辑；需退出客户端后通过命令行运行 node cli.js proxy:enable 完成注入。`;
        } else {
          proxyStatusDesc.textContent = '未启用本地网络直连，网络请求跟随系统默认/TUN 设置。';
        }
      }
      if (btnToggleProxyModule) {
        btnToggleProxyModule.textContent = currentProxyEnabled ? '关闭免 TUN 直连' : '开启免 TUN 直连';
      }
    } catch (err) {
      const errMsg = err?.message || String(err);
      if (chineseBadge) {
        chineseBadge.textContent = '⚠️ 读取异常';
        chineseBadge.className = 'key-pill pill-danger';
      }
      if (chineseStatusDesc) {
        chineseStatusDesc.textContent = `检测汉化状态异常: ${errMsg}`;
      }
      if (proxyBadge) {
        proxyBadge.textContent = '⚠️ 读取异常';
        proxyBadge.className = 'key-pill pill-danger';
      }
      if (proxyStatusDesc) {
        proxyStatusDesc.textContent = `检测免 TUN 代理状态异常: ${errMsg}`;
      }
    }
  }

  btnToggleChineseModule?.addEventListener('click', async () => {
    try {
      const api = window.contextMeterAPI;
      if (!api || typeof api.toggleModule !== 'function') return;
      btnToggleChineseModule.disabled = true;
      btnToggleChineseModule.textContent = '正在处理…';
      const res = await api.toggleModule('chinese', !currentChineseEnabled);
      if (!res || !res.ok) {
        alert(res?.error || '切换汉化模块失败');
      }
      await refreshModulesDisplay();
    } catch (e) {
      alert('切换汉化模块异常: ' + e.message);
    } finally {
      if (btnToggleChineseModule) {
        btnToggleChineseModule.disabled = false;
        btnToggleChineseModule.textContent = currentChineseEnabled ? '关闭客户端汉化' : '开启客户端汉化';
      }
    }
  });

  btnToggleProxyModule?.addEventListener('click', async () => {
    try {
      const api = window.contextMeterAPI;
      if (!api || typeof api.toggleModule !== 'function') return;
      btnToggleProxyModule.disabled = true;
      btnToggleProxyModule.textContent = '正在处理…';
      const res = await api.toggleModule('proxy', !currentProxyEnabled, {
        proxyUrl: inputProxyUrl?.value?.trim(),
        bypassList: inputProxyBypass?.value?.trim()
      });
      if (!res || !res.ok) {
        alert(res?.error || '切换代理模块失败');
      }
      await refreshModulesDisplay();
    } catch (e) {
      alert('切换代理模块异常: ' + e.message);
    } finally {
      if (btnToggleProxyModule) {
        btnToggleProxyModule.disabled = false;
        btnToggleProxyModule.textContent = currentProxyEnabled ? '关闭免 TUN 直连' : '开启免 TUN 直连';
      }
    }
  });

  btnTestProxy?.addEventListener('click', async () => {
    try {
      const api = window.contextMeterAPI;
      if (!api || typeof api.testProxy !== 'function') return;
      btnTestProxy.disabled = true;
      btnTestProxy.textContent = '正在测试…';
      if (proxyTestResult) {
        proxyTestResult.style.display = 'block';
        proxyTestResult.textContent = '正在发起本地与网络连通性测试…';
      }
      const res = await api.testProxy(inputProxyUrl?.value?.trim());
      if (proxyTestResult) {
        if (!res || !res.ok) {
          proxyTestResult.textContent = '❌ 测试失败: ' + (res?.error || '未知异常');
        } else {
          const d = res.data;
          proxyTestResult.innerHTML = `
            配置格式: ${d.configValid ? '✅ 合法' : '❌ 无效'}<br>
            本地端口: ${d.proxyReachable ? '✅ 可连接' : '❌ 无法连接'}<br>
            公网连通: ${d.internetReachable ? '✅ 可访问' : '⚠️ 无法访问公网 (可能无境外连通)'}<br>
            模型请求: 待通过真实在线会话验证 (分层标定)
            ${d.error ? `<br><span style="color:var(--ag-danger)">⚠️ ${d.error}</span>` : ''}
          `;
        }
      }
    } catch (e) {
      if (proxyTestResult) proxyTestResult.textContent = '❌ 测试异常: ' + e.message;
    } finally {
      if (btnTestProxy) {
        btnTestProxy.disabled = false;
        btnTestProxy.textContent = '🔍 测试代理连通性';
      }
    }
  });

  // 静默初始化检测一次解锁状态与各模块状态
  setTimeout(() => {
    void refreshUnlockStatus();
    void refreshModulesDisplay();
  }, 500);
  setTimeout(() => {
    if (currentChineseEnabled) {
      void refreshModulesDisplay();
    }
  }, 2000);

  // 二级抽屉 1（面板 B 内）: 指标与背景颜色自定义抽屉折叠展开
  const btnColors = el('btn-toggle-colors');
  const colorDrawerBody = el('color-drawer-body');
  const colorDrawerArrow = el('color-drawer-arrow');
  function toggleColorsDrawer(forceOpen) {
    if (!colorDrawerBody) return;
    const isHidden = colorDrawerBody.style.display === 'none' || !colorDrawerBody.style.display;
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
    colorDrawerBody.style.display = nextOpen ? 'block' : 'none';
    if (colorDrawerArrow) colorDrawerArrow.textContent = nextOpen ? '▲ 收起设置' : '▼ 展开设置';
    btnColors?.setAttribute('aria-expanded', String(nextOpen));
    if (!nextOpen) {
      closeColorPicker();
    }
  }
  btnColors?.addEventListener('click', () => toggleColorsDrawer());

  // 二级抽屉 2（面板 B 内）: 底层技术抽屉折叠展开
  const btnDetails = el('btn-toggle-details');
  const drawerBody = el('drawer-body');
  const drawerArrow = el('drawer-arrow');
  btnDetails?.addEventListener('click', () => {
    if (!drawerBody) return;
    const isHidden = drawerBody.style.display === 'none' || !drawerBody.style.display;
    drawerBody.style.display = isHidden ? 'block' : 'none';
    if (drawerArrow) drawerArrow.textContent = isHidden ? '▲ 点击收起明细' : '▼ 点击展开明细';
    btnDetails.setAttribute('aria-expanded', String(isHidden));
  });

  // 二级抽屉 3（面板 A 内就近设置）: 热力图色阶与面板外观自定义抽屉折叠展开
  const btnTokenColors = el('btn-toggle-token-colors');
  const tokenColorDrawerBody = el('token-color-drawer-body');
  const tokenColorDrawerArrow = el('token-color-drawer-arrow');
  function toggleTokenColorsDrawer(forceOpen) {
    if (!tokenColorDrawerBody) return;
    const curHidden = tokenColorDrawerBody.style.display === 'none' || !tokenColorDrawerBody.style.display;
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : curHidden;
    tokenColorDrawerBody.style.display = nextOpen ? 'block' : 'none';
    tokenColorDrawerBody.classList?.toggle?.('is-expanded', nextOpen);
    if (tokenColorDrawerArrow) tokenColorDrawerArrow.textContent = nextOpen ? '▲ 收起设置' : '▼ 展开设置';
    btnTokenColors?.setAttribute('aria-expanded', String(nextOpen));
    if (!nextOpen) {
      closeColorPicker(false);
    }
  }
  btnTokenColors?.addEventListener('click', () => toggleTokenColorsDrawer());
  el('heat-legend-scale')?.addEventListener('click', () => toggleTokenColorsDrawer(true));

  // 热力图视图切换（每天 / 每周 / 累计总量）

  // 费用估算范围（默认本期：自然月）与估值模式（默认参考模型折算，首屏展示真实用量价值）
  let activeCostScope = 'period'; // 'period' | 'all'
  let costModelMode = 'ref'; // 'ref' | 'hybrid' | 'identified'
  let activeRefMode = 'all'; // 兼容旧接口 'all' | 'hybrid'

  function switchCostScope(scope) {
    activeCostScope = scope;
    setPillActive(el('cost-btn-scope-period'), scope === 'period');
    setPillActive(el('cost-btn-scope-all'), scope === 'all');
    renderActiveCostEstimateView();
  }
  el('cost-btn-scope-period')?.addEventListener('click', () => switchCostScope('period'));
  el('cost-btn-scope-all')?.addEventListener('click', () => switchCostScope('all'));

  function switchCostModelMode(mode) {
    costModelMode = mode;
    setPillActive(el('cost-btn-mode-ref'), mode === 'ref');
    setPillActive(el('cost-btn-mode-hybrid'), mode === 'hybrid');
    setPillActive(el('cost-btn-mode-identified'), mode === 'identified');
    renderActiveCostEstimateView();
  }
  el('cost-btn-mode-ref')?.addEventListener('click', () => switchCostModelMode('ref'));
  el('cost-btn-mode-hybrid')?.addEventListener('click', () => switchCostModelMode('hybrid'));
  el('cost-btn-mode-identified')?.addEventListener('click', () => switchCostModelMode('identified'));

  function toggleRefCostDrawer(forceOpen) {
    const body = el('ref-cost-drawer-body');
    const btn = el('btn-toggle-ref-cost-drawer');
    if (!body) return;
    const curHidden = body.style.display === 'none' || !body.style.display;
    const next = typeof forceOpen === 'boolean' ? forceOpen : curHidden;
    body.style.display = next ? 'block' : 'none';
    if (btn) btn.textContent = next ? '收起详情 ▲' : '展开详情 ▼';
  }
  el('btn-toggle-ref-cost-drawer')?.addEventListener('click', () => toggleRefCostDrawer());

  function switchRefMode(mode) {
    activeRefMode = mode;
    costModelMode = mode === 'hybrid' ? 'hybrid' : 'ref';
    setPillActive(el('btn-ref-mode-all'), mode === 'all');
    setPillActive(el('btn-ref-mode-hybrid'), mode === 'hybrid');
    renderActiveCostEstimateView();
  }
  el('btn-ref-mode-all')?.addEventListener('click', () => switchRefMode('all'));
  el('btn-ref-mode-hybrid')?.addEventListener('click', () => switchRefMode('hybrid'));

  function renderActiveCostEstimateView() {
    const isPeriod = activeCostScope === 'period';
    const titleEl = el('cost-card-title');
    const periodTag = el('cost-period-tag');
    const grandVal = el('cost-grand-val');
    const grandSub = el('cost-grand-sub');
    const covPill = el('cost-coverage-pill');
    const subSpendVal = el('cost-sub-spend-val');
    const subSpendLbl = el('cost-sub-spend-lbl');
    const subNote = el('cost-sub-compare-note');
    const usageSummary = el('cost-usage-summary');
    const diffSummary = el('cost-diff-summary');
    const breakdown = el('cost-breakdown-info');

    // 分类卡片 DOM
    const inVal = el('ref-cost-input-val');
    const inTok = el('ref-cost-input-tok');
    const caVal = el('ref-cost-cache-val');
    const caTok = el('ref-cost-cache-tok');
    const outVal = el('ref-cost-output-val');
    const outTok = el('ref-cost-output-tok');

    if (titleEl) titleEl.textContent = isPeriod ? '💰 本期 API 参考金额' : '💰 全量 API 参考金额';
    if (periodTag) {
      const pKey = ANTIGRAVITY_TOKEN_DATA.currentPeriod?.label || '本月自然月';
      periodTag.textContent = isPeriod ? pKey : '全历史累计';
    }

    // 1. 提取当前范围真实用量与折算数据
    const curIn = isPeriod
      ? Number(ANTIGRAVITY_TOKEN_DATA.summary?.currentMonthInput || 0)
      : Number(ANTIGRAVITY_TOKEN_DATA.summary?.totalInputTokens || 0);
    const curCa = isPeriod
      ? Number(ANTIGRAVITY_TOKEN_DATA.summary?.currentMonthCache || 0)
      : Number(ANTIGRAVITY_TOKEN_DATA.summary?.totalCacheTokens || 0);
    const curOut = isPeriod
      ? Number(ANTIGRAVITY_TOKEN_DATA.summary?.currentMonthOutput || 0)
      : Number(ANTIGRAVITY_TOKEN_DATA.summary?.totalOutputTokens || 0);
    const curTotal = isPeriod
      ? Number(ANTIGRAVITY_TOKEN_DATA.summary?.monthTokens || (curIn + curCa + curOut))
      : Number(ANTIGRAVITY_TOKEN_DATA.summary?.grandTotalTokens || (curIn + curCa + curOut));

    const refAll = ANTIGRAVITY_TOKEN_DATA.referenceCost?.all || {};
    const refMonth = ANTIGRAVITY_TOKEN_DATA.referenceCost?.currentMonth || {};
    const refHybridAll = ANTIGRAVITY_TOKEN_DATA.referenceCost?.hybrid || {};
    const refHybridMonth = ANTIGRAVITY_TOKEN_DATA.referenceCost?.currentMonthHybrid || refHybridAll;

    const curRef = isPeriod ? refMonth : refAll;
    const curHybrid = isPeriod ? refHybridMonth : refHybridAll;

    const ceSourceMap = ANTIGRAVITY_TOKEN_DATA.costEstimateBySource || {};
    const ceAll = ceSourceMap[activeTokenSource] || ceSourceMap.all || ANTIGRAVITY_TOKEN_DATA.costEstimate || {};
    const cePeriod = ANTIGRAVITY_TOKEN_DATA.costEstimateCurrentMonth || ceAll;
    const curIdentified = isPeriod ? cePeriod : ceAll;

    let apiCost = 0;
    let pillText = '100% 折算覆盖';
    let pillClass = 'key-pill pill-good';

    // 2. 估值模式计算
    let effectiveRef = curRef;
    if ((effectiveRef.totalCostUSD === undefined || effectiveRef.totalCostUSD === null) && curTotal > 0) {
      const core = typeof __AGContextMeterCore !== 'undefined' ? __AGContextMeterCore : null;
      if (core && core.calculateReferenceModelCost) {
        effectiveRef = core.calculateReferenceModelCost({
          inputTokens: curIn,
          outputTokens: curOut,
          cacheTokens: curCa,
          totalTokens: curTotal
        }, 'gemini-3.8-flash', { pricingDate: '2026-11-09', mode: 'all' });
      }
    }

    const rateIn = Number(effectiveRef.matchedTier?.inputPerMillion ?? 0.75);
    const rateCa = Number(effectiveRef.matchedTier?.cacheReadPerMillion ?? 0.075);
    const rateOut = Number(effectiveRef.matchedTier?.outputPerMillion ?? 3.75);

    // 更新小摘要来源与时间描述行及非实付常驻标识
    const scopeDescEl = el('cost-scope-desc');
    if (scopeDescEl) {
      const srcName = activeTokenSource === 'desktop' ? '桌面端' : activeTokenSource === 'cli' ? 'CLI' : '全部来源';
      const pLabel = isPeriod ? (ANTIGRAVITY_TOKEN_DATA.currentPeriod?.label || '本月自然月') : '全历史累计';
      scopeDescEl.textContent = `${srcName} · ${pLabel}`;
    }
    const nonPaidBadge = el('cost-non-paid-badge');
    if (nonPaidBadge) nonPaidBadge.textContent = 'API折算 · 非实付';

    if (costModelMode === 'ref') {
      apiCost = Number(effectiveRef.totalCostUSD || 0);
      if (grandVal) {
        if (apiCost > 0) {
          grandVal.textContent = `约 $${apiCost.toFixed(2)}`;
          grandVal.title = `参考费率折算值：$${apiCost.toFixed(4)}`;
        } else if (curTotal > 0 && curIn === 0 && curCa === 0 && curOut === 0) {
          grandVal.textContent = '数据未就绪';
          grandVal.title = '缺少有效分类统计数据';
        } else {
          grandVal.textContent = '$0.00';
          grandVal.title = '当前范围内暂无记录';
        }
      }
      if (grandSub) {
        grandSub.textContent = `统一按 ${effectiveRef.modelDisplayName || 'Gemini 3.8 Flash'} 估算 (输入 $${rateIn.toFixed(2)} / 缓存 $${rateCa.toFixed(3)} / 输出 $${rateOut.toFixed(2)} 每百万 Token)`;
      }
      pillText = '参考模型估算';
      pillClass = 'key-pill pill-muted';

      if (inVal) inVal.textContent = `$${Number(effectiveRef.inputCostUSD || (curIn * rateIn / 1e6)).toFixed(2)}`;
      if (inTok) inTok.textContent = `${fmtYi(curIn)} tok`;
      if (caVal) caVal.textContent = `$${Number(effectiveRef.cacheCostUSD || (curCa * rateCa / 1e6)).toFixed(2)}`;
      if (caTok) caTok.textContent = `${fmtYi(curCa)} tok (优惠)`;
      if (outVal) outVal.textContent = `$${Number(effectiveRef.outputCostUSD || (curOut * rateOut / 1e6)).toFixed(2)}`;
      if (outTok) outTok.textContent = `${fmtYi(curOut)} tok`;
    } else if (costModelMode === 'hybrid') {
      const h = curHybrid.hybrid || {};
      apiCost = Number(h.combinedTotalUSD || effectiveRef.totalCostUSD || 0);
      if (grandVal) {
        grandVal.textContent = `约 $${apiCost.toFixed(2)}`;
        grandVal.title = `混合模式：已识别 $${h.knownCostUSD || 0} + 未知折算 $${h.unpricedResidualCostUSD || 0}`;
      }
      if (grandSub) {
        grandSub.textContent = `混合模式：已识别 $${Number(h.knownCostUSD || 0).toFixed(2)} + 未知折算 $${Number(h.unpricedResidualCostUSD || 0).toFixed(2)}`;
      }
      pillText = '混合模式折算';
      pillClass = 'key-pill pill-muted';

      const rb = h.residualTokensBreakdown || {};
      if (inVal) inVal.textContent = `$${Number(rb.inputCostUSD || (Number(rb.input || 0) * rateIn / 1e6)).toFixed(2)}`;
      if (inTok) inTok.textContent = `剩余 ${fmtYi(rb.input || 0)} tok`;
      if (caVal) caVal.textContent = `$${Number(rb.cacheCostUSD || (Number(rb.cache || 0) * rateCa / 1e6)).toFixed(2)}`;
      if (caTok) caTok.textContent = `剩余 ${fmtYi(rb.cache || 0)} tok`;
      if (outVal) outVal.textContent = `$${Number(rb.outputCostUSD || (Number(rb.output || 0) * rateOut / 1e6)).toFixed(2)}`;
      if (outTok) outTok.textContent = `剩余 ${fmtYi(rb.output || 0)} tok`;
    } else {
      // 仅已识别真实模型
      const pricedCount = Number(curIdentified.pricedRequestsCount || 0);
      const unpricedCount = Number(curIdentified.unpricedRequestsCount || 0);
      const totalCount = pricedCount + unpricedCount;
      apiCost = Number(curIdentified.pricedCostUSD || 0);

      if (grandVal) {
        if (totalCount === 0) {
          grandVal.textContent = '暂无记录';
        } else if (pricedCount === 0) {
          grandVal.textContent = '暂无法估值';
          grandVal.title = '当前范围内已扫描请求均缺少模型信息或费率未收录，未记为 $0';
        } else if (apiCost < 0.01 && apiCost > 0) {
          grandVal.textContent = '<$0.01';
          grandVal.title = `已识别模型价值：$${apiCost.toFixed(6)}`;
        } else {
          grandVal.textContent = `$${apiCost.toFixed(2)}`;
          grandVal.title = `已识别模型价值：$${apiCost.toFixed(4)}`;
        }
      }
      if (grandSub) {
        grandSub.textContent = pricedCount > 0
          ? `仅计入 ${pricedCount} 条已知真实模型调用`
          : '当前范围内请求缺少模型型号（未按 $0 计入）';
      }
      if (pricedCount === 0) {
        pillText = '0% 计价覆盖';
        pillClass = 'key-pill pill-warn';
      } else {
        const pct = curIdentified.coveragePercent != null ? curIdentified.coveragePercent : 0;
        pillText = `${pct}% 计价覆盖`;
        pillClass = `key-pill ${pct >= 100 ? 'pill-good' : 'pill-warn'}`;
      }

      if (inVal) inVal.textContent = `$${((curIdentified.byCategory?.inputTokens || 0) * rateIn / 1e6).toFixed(2)}`;
      if (inTok) inTok.textContent = `${fmtYi(curIdentified.byCategory?.inputTokens || 0)} tok`;
      if (caVal) caVal.textContent = `$${((curIdentified.byCategory?.cacheTokens || 0) * rateCa / 1e6).toFixed(2)}`;
      if (caTok) caTok.textContent = `${fmtYi(curIdentified.byCategory?.cacheTokens || 0)} tok`;
      if (outVal) outVal.textContent = `$${((curIdentified.byCategory?.outputTokens || 0) * rateOut / 1e6).toFixed(2)}`;
      if (outTok) outTok.textContent = `${fmtYi(curIdentified.byCategory?.outputTokens || 0)} tok`;
    }

    if (covPill) {
      covPill.textContent = pillText;
      covPill.className = pillClass;
      covPill.setAttribute?.('class', pillClass);
    }

    // 3. 用户实际支出渲染（首屏并列右栏）
    const ps = ANTIGRAVITY_TOKEN_DATA.planStatus || {};
    const curSymbol = ps.currencySymbol || '$';
    if (subSpendLbl) subSpendLbl.textContent = '本人同期实际支出';

    if (subSpendVal && subNote) {
      if (ps.actualPricePaid === 0 || ps.isZeroExtraCost) {
        subSpendVal.textContent = `${curSymbol}0`;
        subNote.textContent = `${ps.acquisitionSourceName || '免费活动'} · 用户确认 · 免费权益使用中${isPeriod ? '' : ' · 全量累计不直接对比单月支出'}`;
      } else if (ps.actualPricePaid !== null && ps.actualPricePaid !== undefined) {
        subSpendVal.textContent = `${curSymbol}${Number(ps.actualPricePaid).toFixed(2)}`;
        subNote.textContent = `${ps.acquisitionSourceName || '订阅支出'} · 实付 (${ps.billingCycle || '月付'})${ps.isExpired ? ' · ⚠️ 权益已到期' : ''}${isPeriod ? '' : ' · 全量累计不直接对比单月支出'}`;
      } else if (ps.officialPriceMonthly !== null && ps.officialPriceMonthly !== undefined) {
        subSpendVal.textContent = '实付未知';
        subNote.textContent = `公开参考价 $${ps.officialPriceMonthly}/月（实付未确认）${isPeriod ? '' : ' · 全量累计不直接对比单月支出'}`;
      } else {
        subSpendVal.textContent = '未知';
        subNote.textContent = '未获取到套餐与实付数据';
      }
    }

    const subLine = el('cost-sub-line');
    if (subLine) {
      if (ps.actualPricePaid === 0 || ps.isZeroExtraCost) {
        subLine.textContent = `订阅额外实付：${curSymbol}0 (${ps.acquisitionSourceName || '免费活动'} · 用户确认)`;
      } else if (ps.actualPricePaid !== null && ps.actualPricePaid !== undefined) {
        const cnyPart = (ps.currency !== 'CNY' && ps.cnyFormatted) ? ` (${ps.cnyFormatted})` : '';
        subLine.textContent = `订阅实付：${curSymbol}${Number(ps.actualPricePaid).toFixed(2)}${cnyPart} (${ps.billingCycle || '月付'}${ps.isExpired ? ' · ⚠️ 权益已到期' : ''})`;
      } else {
        subLine.textContent = '订阅实付：未填写';
      }
    }

    // 4. 用量与参考差额指标条（注明累计处理 Token，含缓存读取）
    if (usageSummary) {
      usageSummary.textContent = `累计处理 Token: ${fmtYi(curTotal)} (含 ${fmtYi(curCa)} 缓存读取)`;
    }
    if (diffSummary) {
      if (!isPeriod) {
        diffSummary.textContent = '全量累计不直接与单月费用做差额比较 · 避免跨月虚高';
      } else if (ps.actualPricePaid === 0 || ps.isZeroExtraCost) {
        diffSummary.textContent = `与此 API 方案参考差额 约 +$${apiCost.toFixed(2)} (免费权益使用中 · 不计算无限倍数)`;
      } else if (ps.actualPricePaid !== null && ps.currency === 'USD') {
        const diff = apiCost - Number(ps.actualPricePaid);
        diffSummary.textContent = `与此 API 方案参考差额 ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (API折算 - 实际支出 · 仅供参考比较)`;
      } else {
        diffSummary.textContent = '跨币种或实付未知 · 并列展示不计算差额';
      }
    }

    // 5. 详细未计价原因说明
    if (breakdown) {
      const modelKeys = Object.keys(curIdentified.byModel || {});
      const modelDetails = modelKeys.map(k => `${k}: $${curIdentified.byModel[k].costUSD} (${fmt(curIdentified.byModel[k].tokens)} tok)`).join('； ');
      const unpricedReasons = curIdentified.unpricedReasons || {};
      const reasonParts = [];
      if (unpricedReasons.missingModel) reasonParts.push(`${unpricedReasons.missingModel} 条日志缺少模型型号`);
      if (unpricedReasons.unsupportedModel) reasonParts.push(`${unpricedReasons.unsupportedModel} 条模型未收录公开费率`);
      if (unpricedReasons.missingUsage) reasonParts.push(`${unpricedReasons.missingUsage} 条缺少用量数据`);
      const unpricedTokensStr = curIdentified.unpricedTokens > 0 ? `，涉及约 ${fmtYi(curIdentified.unpricedTokens)} 未估值 Token` : '';
      const unpricedNote = reasonParts.length ? `；未识别部分：${reasonParts.join('，')}${unpricedTokensStr}（已按所选参考模型价表折算）` : '';
      breakdown.textContent = `已识别真实模型明细：${modelDetails || '暂无已匹配真实模型'}${unpricedNote}。`;
    }

    // 6. 兼容性辅助隐藏层同步
    const refGrand = el('ref-cost-grand-val');
    if (refGrand) refGrand.textContent = `约 $${Number(curRef.totalCostUSD || 0).toFixed(2)}`;
  }

  const heatPop = el('heat-pop');
  const heatPopDate = el('heat-pop-date');
  const heatPopVal = el('heat-pop-val');
  const heatPopDet = el('heat-pop-det');

  function hidePopover() {
    if (heatPop) heatPop.style.opacity = '0';
  }

  function updateHeatTabThumb() {
    const thumb = el('heat-tab-thumb');
    const tabsBar = el('heat-tabs-bar');
    const activeBtn = el(`h-tab-${activeHeatView}`);
    if (!thumb || !tabsBar || !activeBtn) return;

    const offsetLeft = activeBtn.offsetLeft || 0;
    const offsetWidth = activeBtn.offsetWidth || 0;
    thumb.style.transform = `translateX(${offsetLeft}px)`;
    thumb.style.width = `${offsetWidth}px`;

    const thumbColor = customColors.tokenAccent || (typeof getEffectiveHeatmapScale === 'function' ? getEffectiveHeatmapScale()[4] : '#a78bfa');
    thumb.style.setProperty('--ag-tab-thumb-bg', thumbColor);
  }

  function renderActiveHeatView(forceRebuild = false) {
    if (activeHeatView === 'weekly') {
      renderHeatmapWeekly();
    } else if (activeHeatView === 'monthly') {
      renderHeatmapMonthly();
    } else if (activeHeatView === 'yearly') {
      renderHeatmapYearly();
    } else if (activeHeatView === 'cum') {
      renderHeatmapCum();
    } else {
      renderHeatmapGrid(forceRebuild);
    }
    computeTimelineWindow();
    updateHeatTabThumb();
  }

  function switchHeatView(view, save = true) {
    if (!['daily', 'weekly', 'monthly', 'yearly', 'cum'].includes(view)) view = 'daily';
    activeHeatView = view;

    const views = ['daily', 'weekly', 'monthly', 'yearly', 'cum'];
    views.forEach(v => {
      const tabBtn = el(`h-tab-${v}`);
      const box = el(`h-${v}-box`);
      const isActive = (v === view);
      if (tabBtn) {
        if (tabBtn.classList) {
          if (isActive) tabBtn.classList.add('active');
          else tabBtn.classList.remove('active');
        } else {
          const cls = (tabBtn.className || '').split(/\s+/).filter(c => c && c !== 'active');
          if (isActive) cls.push('active');
          tabBtn.className = cls.join(' ');
        }
        tabBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tabBtn.setAttribute('tabindex', isActive ? '0' : '-1');
      }
      if (box) {
        if (isActive) {
          box.style.display = (v === 'weekly' || v === 'monthly' || v === 'yearly') ? 'flex' : 'block';
        } else {
          box.style.display = 'none';
        }
      }
    });

    hidePopover();
    renderActiveHeatView(true);
    updateHeatTabThumb();

    if (save) {
      void saveSettingsBridge({ savedHeatView: view });
    }
  }

  ['daily', 'weekly', 'monthly', 'yearly', 'cum'].forEach(v => {
    el(`h-tab-${v}`)?.addEventListener('click', () => switchHeatView(v));
  });

  const tabsBarEl = el('heat-tabs-bar');
  tabsBarEl?.addEventListener('keydown', e => {
    const views = ['daily', 'weekly', 'monthly', 'yearly', 'cum'];
    const curIdx = views.indexOf(activeHeatView);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (curIdx + 1) % views.length;
      switchHeatView(views[nextIdx]);
      el(`h-tab-${views[nextIdx]}`)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (curIdx - 1 + views.length) % views.length;
      switchHeatView(views[prevIdx]);
      el(`h-tab-${views[prevIdx]}`)?.focus();
    }
  });

  // 初始化默认热力图视图状态与药丸滑块
  switchHeatView('daily', false);

  el('h-page-prev')?.addEventListener('click', () => {
    if (activeHeatView === 'monthly') {
      heatMonthOffset -= 1;
    } else if (activeHeatView === 'yearly') {
      heatYearOffset -= 1;
    } else {
      heatPageOffset -= 1;
    }
    renderActiveHeatView(true);
  });
  el('h-page-next')?.addEventListener('click', () => {
    if (activeHeatView === 'monthly') {
      if (heatMonthOffset < 0) heatMonthOffset += 1;
    } else if (activeHeatView === 'yearly') {
      if (heatYearOffset < 0) heatYearOffset += 1;
    } else {
      if (heatPageOffset < 0) heatPageOffset += 1;
    }
    renderActiveHeatView(true);
  });

  el('refresh').addEventListener('click', () => { if (state.route && !state.scanBusy) void scan(state.generation, state.route, true); });
  outside = e => {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const pop = el('color-picker-popover');
    if (!path.includes(host)) {
      closeColorPicker(true);
      toggle(false);
      hideContextTooltip();
      const om = el('overflow-menu');
      if (om) om.hidden = true;
      syncHostStackingElevation(false);
      return;
    }
    const isClosingNow = pop?.classList ? pop.classList.contains('is-closing') : pop?.getAttribute('data-closing') === 'true';
    if (pop && !pop.hidden && !isClosingNow) {
      const isInsidePicker = path.includes(pop);
      const isSwatchBtn = path.some(n => n?.classList?.contains?.('color-swatch-btn') || n?.classList?.contains?.('heat-leg-swatch') || n?.id?.startsWith?.('swatch-') || n?.id?.startsWith?.('heat-leg-'));
      if (!isInsidePicker && !isSwatchBtn) {
        closeColorPicker();
      }
    }
  };
  escape = e => {
    if (e.key === 'Escape') {
      const pop = el('color-picker-popover');
      const isEscClosing = pop?.classList ? pop.classList.contains('is-closing') : pop?.getAttribute('data-closing') === 'true';
      if (pop && !pop.hidden && !isEscClosing) {
        const returnFocus = activePickerAnchor;
        closeColorPicker();
        returnFocus?.focus?.();
        return;
      }
      const tokenDrawer = el('token-color-drawer-body');
      if (tokenDrawer && tokenDrawer.style.display !== 'none') {
        toggleTokenColorsDrawer(false);
        btnTokenColors?.focus?.();
        return;
      }
      const colorDrawer = el('color-drawer-body');
      if (colorDrawer && colorDrawer.style.display !== 'none') {
        toggleColorsDrawer(false);
        btnColors?.focus?.();
        return;
      }
      toggle(false);
      hideContextTooltip();
      const om = el('overflow-menu');
      if (om) om.hidden = true;
      syncHostStackingElevation(false);
      el('badge')?.focus?.();
    }
  };
  document.addEventListener('click', outside);
  document.addEventListener('keydown', escape);

  // =========================================================================
  // 模块 4: 数据渲染、完整本地 Token 历史读取与首次使用日起算时间轴
  // =========================================================================
  function renderFiles(session) {
    const parent = el('files'); if (!parent) return; parent.replaceChildren();
    if (!session) { const item = document.createElement('p'); item.textContent = '正在读取全量会话附件引用…'; parent.appendChild(item); return; }
    if (!session.attachments.length) { const item = document.createElement('p'); item.textContent = '归档中没有上传附件引用。'; parent.appendChild(item); return; }
    for (const file of session.attachments) {
      const item = document.createElement('div'); item.className = 'file';
      const name = document.createElement('div'); name.className = 'file-name'; name.textContent = `${file.name} ${file.references > 1 ? `（引用 ${file.references} 次）` : ''}`;
      const detail = document.createElement('div'); detail.className = 'file-detail';
      const sizeInfo = file.width && file.height
        ? `${file.width}×${file.height} 像素`
        : (typeof file.chars === 'number' && file.chars > 0 ? `${fmt(file.chars)} 字符` : '');
      const tokenInfo = range(file) ? `${range(file)} token` : '内容 token 未知';
      detail.textContent = `${file.source === 'assistant' ? '模型输出附件 · ' : ''}${tokenInfo}${sizeInfo ? ` · ${sizeInfo}` : ''}${file.sheets != null ? ` · ${file.sheets} 个工作表，${fmt(file.cells)} 个单元格` : ''}${file.hiddenSheets ? `（含 ${file.hiddenSheets} 个隐藏表）` : ''}`;
      item.appendChild(name); item.appendChild(detail);
      if (file.unknownParts?.length) { const unknown = document.createElement('div'); unknown.className = 'file-unknown'; unknown.textContent = '未计全：' + file.unknownParts.join('；'); item.appendChild(unknown); }
      parent.appendChild(item);
    }
  }

  function setHoverExtra(text) {
    const extra = el('hover-extra');
    if (extra && extra.textContent !== text) {
      extra.textContent = text;
    }
  }

  function fmtYi(n) {
    if (!n || n <= 0) return '0';
    if (n >= 1e9) return `${parseFloat((n / 1e9).toFixed(2))}B`;
    if (n >= 1e6) return `${parseFloat((n / 1e6).toFixed(2))}M`;
    if (n >= 1e3) return `${parseFloat((n / 1e3).toFixed(1))}K`;
    return n.toLocaleString('en-US');
  }

  function getLvl(t) {
    if (!t || t <= 0) return 0;
    if (t < 3e6) return 1;
    if (t < 15e6) return 2;
    if (t < 60e6) return 3;
    return 4;
  }

  function parseLocalYmd(ymd) {
    if (!ymd || typeof ymd !== 'string') return null;
    const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function formatLocalYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDotYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  function formatZhYmd(ymd) {
    const d = parseLocalYmd(ymd);
    if (!d) return ymd || '—';
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function addDays(baseDate, deltaDays) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    d.setDate(d.getDate() + deltaDays);
    return d;
  }

  function getFirstUseDateStr() {
    const map = ANTIGRAVITY_TOKEN_DATA.dailyMap || {};
    const keys = Object.keys(map).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && (map[k]?.total > 0)).sort();
    const declared = ANTIGRAVITY_TOKEN_DATA.firstUseDate;
    if (declared && /^\d{4}-\d{2}-\d{2}$/.test(declared)) {
      if (keys.length && keys[0] < declared) return keys[0];
      return declared;
    }
    if (keys.length) return keys[0];
    return formatLocalYmd(new Date());
  }

  // 计算从「实际首次使用日」起算的 12 个月（52 周 = 364 天）展示窗口，绝不展示首次使用日之前的日期
  function computeTimelineWindow() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstStr = getFirstUseDateStr();
    const firstDate = parseLocalYmd(firstStr) || today;
    const totalDays = 52 * 7; // 364 天（12 个月 / 52 周）
    const elapsedDays = Math.max(0, Math.floor((today.getTime() - firstDate.getTime()) / 86400000)) + 1;

    let winStart;
    let winEnd;
    let canPrev = false;
    let canNext = false;

    if (elapsedDays <= totalDays) {
      // 使用未满一年：起点固定为实际首次使用日，向后铺满 12 个月（前置空白为 0）
      heatPageOffset = 0;
      winStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
      winEnd = addDays(winStart, totalDays - 1);
    } else {
      // 使用满一年后：默认窗口滚动为「以今天结尾的最近 12 个月」，且起点永不早于首次使用日；支持 ‹ / › 翻页回看更早归档
      const latestStart = addDays(today, -(totalDays - 1));
      const stepDays = 26 * 7; // 每次翻页半年度（26 周）
      let candidateStart = addDays(latestStart, heatPageOffset * stepDays);
      if (candidateStart.getTime() <= firstDate.getTime()) {
        candidateStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
        const maxBackSteps = -Math.ceil((latestStart.getTime() - firstDate.getTime()) / (stepDays * 86400000));
        if (heatPageOffset < maxBackSteps) heatPageOffset = maxBackSteps;
      }
      winStart = candidateStart;
      winEnd = addDays(winStart, totalDays - 1);
      canPrev = winStart.getTime() > firstDate.getTime();
      canNext = heatPageOffset < 0;
    }

    const firstBadge = el('first-use-badge');
    if (firstBadge) firstBadge.textContent = `首次使用：${formatZhYmd(firstStr)}`;
    const rangeEl = el('h-win-range');
    const prevBtn = el('h-page-prev');
    const nextBtn = el('h-page-next');

    if (activeHeatView === 'monthly') {
      const targetMonthDate = new Date(today.getFullYear(), today.getMonth() + heatMonthOffset, 1);
      const targetY = targetMonthDate.getFullYear();
      const targetM = targetMonthDate.getMonth();
      const firstY = firstDate.getFullYear();
      const firstM = firstDate.getMonth();
      const targetMonthKey = targetY * 12 + targetM;
      const firstMonthKey = firstY * 12 + firstM;
      canPrev = targetMonthKey > firstMonthKey;
      canNext = heatMonthOffset < 0;
      if (rangeEl) rangeEl.textContent = `${targetY}年${targetM + 1}月`;
    } else if (activeHeatView === 'yearly') {
      const thisY = today.getFullYear();
      const targetY = thisY + heatYearOffset;
      const firstY = firstDate.getFullYear();
      canPrev = targetY > firstY;
      canNext = heatYearOffset < 0;
      if (rangeEl) {
        rangeEl.textContent = (targetY === thisY) ? `${targetY}年（1月1日–今天）` : `${targetY}年`;
      }
    } else {
      if (rangeEl) rangeEl.textContent = `${formatDotYmd(winStart)} – ${formatDotYmd(winEnd)}`;
    }

    if (prevBtn) prevBtn.disabled = !canPrev;
    if (nextBtn) nextBtn.disabled = !canNext;

    return { firstStr, firstDate, today, winStart, winEnd, totalDays, canPrev, canNext };
  }

  function applyTokenHistoryPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.loading) {
      if (Number(ANTIGRAVITY_TOKEN_DATA.summary?.grandTotalTokens) > 0) return false;
    }

    const hasExistingData = Number(ANTIGRAVITY_TOKEN_DATA.summary?.grandTotalTokens) > 0;
    const incomingKeys = Object.keys(payload.dailyMap || {});
    const incomingTotal = Number(payload.summary?.grandTotalTokens) || incomingKeys.reduce((acc, k) => acc + (Number(payload.dailyMap[k]?.total) || 0), 0);
    const hasIncomingRefCost = Boolean(payload.referenceCost?.currentMonth?.totalCostUSD || payload.referenceCost?.all?.totalCostUSD);
    const hasIncomingPayloadContent = incomingKeys.length > 0 || incomingTotal > 0 || hasIncomingRefCost;
    if (hasExistingData && !hasIncomingPayloadContent && !payload.isAccountSwitched && !payload.forceReset) {
      return false;
    }

    ANTIGRAVITY_TOKEN_DATA.rawPayload = payload;

    const core = typeof __AGContextMeterCore !== 'undefined' ? __AGContextMeterCore : null;
    const todayStr = formatLocalYmd(new Date());
    const normalized = core && typeof core.normalizeTokenHistoryPayload === 'function'
      ? core.normalizeTokenHistoryPayload(payload, { source: activeTokenSource, todayStr })
      : null;

    if (normalized) {
      ANTIGRAVITY_TOKEN_DATA.dailyMap = normalized.dailyMap;
      ANTIGRAVITY_TOKEN_DATA.dailyMapBySource = normalized.dailyMapBySource;
      ANTIGRAVITY_TOKEN_DATA.summary = normalized.summary;
      ANTIGRAVITY_TOKEN_DATA.referenceCost = normalized.referenceCost;
      ANTIGRAVITY_TOKEN_DATA.currentPeriod = normalized.currentPeriod;
      if (normalized.firstUseDate) ANTIGRAVITY_TOKEN_DATA.firstUseDate = normalized.firstUseDate;
      if (normalized.updatedAt) ANTIGRAVITY_TOKEN_DATA.updatedAt = normalized.updatedAt;
    } else {
      const newMap = {};
      if (payload.dailyMap && typeof payload.dailyMap === 'object') {
        for (const [dKey, rec] of Object.entries(payload.dailyMap)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dKey) || !rec) continue;
          newMap[dKey] = {
            total: Number(rec.total) || 0,
            input: Number(rec.input) || 0,
            output: Number(rec.output) || 0,
            cache: Number(rec.cache) || 0,
            steps: Number(rec.steps) || 0
          };
        }
      }
      ANTIGRAVITY_TOKEN_DATA.dailyMap = newMap;
      if (payload.dailyMapBySource) ANTIGRAVITY_TOKEN_DATA.dailyMapBySource = payload.dailyMapBySource;
      if (payload.firstUseDate) ANTIGRAVITY_TOKEN_DATA.firstUseDate = payload.firstUseDate;
      if (payload.updatedAt) ANTIGRAVITY_TOKEN_DATA.updatedAt = payload.updatedAt;
      if (payload.currentPeriod) ANTIGRAVITY_TOKEN_DATA.currentPeriod = payload.currentPeriod;
      if (payload.referenceCost) ANTIGRAVITY_TOKEN_DATA.referenceCost = payload.referenceCost;

      const keys = Object.keys(newMap).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && newMap[k]?.total > 0).sort();
      const monthPrefix = todayStr.slice(0, 7);
      const yearPrefix = todayStr.slice(0, 4);
      let totalTokens = 0, todayTokens = 0, monthTokens = 0, yearTokens = 0, monthDays = 0;
      let totalInput = 0, totalOutput = 0, totalCache = 0;
      let curMonthInput = 0, curMonthOutput = 0, curMonthCache = 0;
      for (const k of keys) {
        const r = newMap[k];
        const t = Number(r.total) || 0;
        totalTokens += t;
        totalInput += Number(r.input) || 0;
        totalOutput += Number(r.output) || 0;
        totalCache += Number(r.cache) || 0;
        if (k === todayStr) todayTokens += t;
        if (k.startsWith(monthPrefix)) {
          monthTokens += t;
          curMonthInput += Number(r.input) || 0;
          curMonthOutput += Number(r.output) || 0;
          curMonthCache += Number(r.cache) || 0;
          monthDays += 1;
        }
        if (k.startsWith(yearPrefix)) yearTokens += t;
      }
      const rawSum = payload.summary || {};
      ANTIGRAVITY_TOKEN_DATA.summary = {
        grandTotalTokens: Math.max(totalTokens, Number(rawSum.grandTotalTokens) || 0),
        totalTokens: Math.max(totalTokens, Number(rawSum.grandTotalTokens) || 0),
        todayTokens: todayTokens > 0 ? todayTokens : (Number(rawSum.todayTokens) || 0),
        monthTokens: Math.max(monthTokens, Number(rawSum.monthTokens) || 0),
        yearTokens: Math.max(yearTokens, Number(rawSum.yearTokens) || 0),
        totalInputTokens: Math.max(totalInput, Number(rawSum.totalInputTokens) || 0),
        totalOutputTokens: Math.max(totalOutput, Number(rawSum.totalOutputTokens) || 0),
        totalCacheTokens: Math.max(totalCache, Number(rawSum.totalCacheTokens) || 0),
        currentMonthInput: Math.max(curMonthInput, Number(rawSum.currentMonthInput) || 0),
        currentMonthOutput: Math.max(curMonthOutput, Number(rawSum.currentMonthOutput) || 0),
        currentMonthCache: Math.max(curMonthCache, Number(rawSum.currentMonthCache) || 0),
        totalDays: keys.length,
        totalConversations: Number(rawSum.totalConversations) || keys.length,
        firstUseDate: payload.firstUseDate || rawSum.firstUseDate || null
      };
    }

    if (payload.planStatus || payload.customPlanSettings) {
      let mergedPlan = payload.planStatus || ANTIGRAVITY_TOKEN_DATA.planStatus || {};
      try {
        const email = mergedPlan.email || 'default';
        let customObj = lastSavedCustomPlan || payload.customPlanSettings || null;
        if (!customObj && typeof window !== 'undefined' && window.__AGContextMeterSettings?.customPlan) {
          customObj = window.__AGContextMeterSettings.customPlan;
        }
        if (!customObj) {
          const savedCustomRaw = localStorage?.getItem('ag_custom_plan_' + email.toLowerCase()) || localStorage?.getItem('ag_custom_plan_default');
          if (savedCustomRaw) customObj = JSON.parse(savedCustomRaw);
        }
        if (customObj && typeof customObj === 'object') {
          lastSavedCustomPlan = { ...customObj };
          try {
            const jsonStr = JSON.stringify(customObj);
            if (email && email !== 'default') localStorage?.setItem('ag_custom_plan_' + email.toLowerCase(), jsonStr);
            localStorage?.setItem('ag_custom_plan_default', jsonStr);
          } catch {}
          if (core && core.resolveEffectivePlanStatus) {
            mergedPlan = core.resolveEffectivePlanStatus(payload.rawPlanStatus || payload.planStatus, customObj, { currentEmail: email });
          }
        }
      } catch {}
      ANTIGRAVITY_TOKEN_DATA.planStatus = mergedPlan;
      ANTIGRAVITY_TOKEN_DATA.rawPlanStatus = payload.rawPlanStatus || payload.planStatus || mergedPlan;
      renderPlanDetail(mergedPlan);
    }

    if (payload.costEstimate) {
      ANTIGRAVITY_TOKEN_DATA.costEstimate = payload.costEstimate;
    }
    if (payload.costEstimateCurrentMonth) {
      ANTIGRAVITY_TOKEN_DATA.costEstimateCurrentMonth = payload.costEstimateCurrentMonth;
    }
    if (payload.costEstimateBySource) {
      ANTIGRAVITY_TOKEN_DATA.costEstimateBySource = payload.costEstimateBySource;
    } else if (payload.costEstimate) {
      ANTIGRAVITY_TOKEN_DATA.costEstimateBySource = {
        all: payload.costEstimate,
        desktop: payload.costEstimate,
        cli: { pricedCostUSD: 0, pricedRequestsCount: 0, unpricedRequestsCount: 0, coveragePercent: null, byModel: {} }
      };
    }

    // 重新汇总卡片统计与顶栏
    const sum = ANTIGRAVITY_TOKEN_DATA.summary;
    const totalTokens = sum.grandTotalTokens;
    const shownToday = sum.todayTokens;
    const monthTokens = sum.monthTokens;
    const yearTokens = sum.yearTokens;
    const convCount = sum.totalConversations;
    const totalDays = sum.totalDays || Object.keys(ANTIGRAVITY_TOKEN_DATA.dailyMap).length;
    const avgMonth = Math.round(monthTokens / Math.max(1, totalDays));

    const fmtCardM = v => {
      const n = Number(v) || 0;
      if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
      return String(n);
    };
    const badgeAmt = el('token-amount');
    const badgeExtra = el('token-hover-extra');
    const overAmt = el('overflow-tokens-val');
    if (badgeAmt) badgeAmt.textContent = fmtCardM(totalTokens);
    if (badgeExtra) badgeExtra.textContent = `· 今日 ${fmtCardM(shownToday)}`;
    if (overAmt) overAmt.textContent = fmtCardM(totalTokens);

    const tTotalVal = el('t-total-val');
    const tTotalSub = el('t-total-sub');
    const tTodayVal = el('t-today-val');
    const tTodaySub = el('t-today-sub');
    const tMonthVal = el('t-month-val');
    const tMonthSub = el('t-month-sub');
    const tYearVal = el('t-year-val');
    const tYearSub = el('t-year-sub');

    if (tTotalVal) tTotalVal.textContent = fmtCardM(totalTokens);
    if (tTotalSub) tTotalSub.textContent = `${totalTokens.toLocaleString('en-US')} Tokens`;
    if (tTodayVal) tTodayVal.textContent = fmtCardM(shownToday);
    if (tTodaySub) {
      tTodaySub.textContent = activeTokenSource === 'all'
        ? `${convCount} 会话实时累加`
        : `${activeTokenSource === 'cli' ? 'CLI 终端' : '桌面客户端'} · ${totalDays} 天活动`;
    }
    if (tMonthVal) tMonthVal.textContent = fmtCardM(monthTokens);
    if (tMonthSub) tMonthSub.textContent = `日均约 ${fmtCardM(avgMonth)}`;
    if (tYearVal) tYearVal.textContent = fmtCardM(yearTokens);
    if (tYearSub) tYearSub.textContent = `${totalDays} 天活动记录`;

    // 聚合全周期各区间预估费用
    const allDateKeys = Object.keys(ANTIGRAVITY_TOKEN_DATA.dailyMap || {});
    const nowYmd = todayStr;
    const thisMonthPrefix = nowYmd.slice(0, 7);
    const thisYearPrefix = nowYmd.slice(0, 4);

    const todayCostInfo = getDailyModelCost(ANTIGRAVITY_TOKEN_DATA.dailyMap[nowYmd], nowYmd, activeCostModel, { mode: activeCostMode });
    const todayCostCny = convertToCNY(todayCostInfo.costUSD, 'USD');

    const totalCostAgg = calculateIntervalCost(ANTIGRAVITY_TOKEN_DATA.dailyMap, allDateKeys, activeCostModel, { mode: activeCostMode, todayStr: nowYmd });
    const totalCostCny = convertToCNY(totalCostAgg.totalCostUSD, 'USD');

    const monthKeys = allDateKeys.filter(k => k.startsWith(thisMonthPrefix) && k <= nowYmd);
    const monthCostAgg = calculateIntervalCost(ANTIGRAVITY_TOKEN_DATA.dailyMap, monthKeys, activeCostModel, { mode: activeCostMode, todayStr: nowYmd });
    const monthCostCny = convertToCNY(monthCostAgg.totalCostUSD, 'USD');

    const yearKeys = allDateKeys.filter(k => k.startsWith(thisYearPrefix) && k <= nowYmd);
    const yearCostAgg = calculateIntervalCost(ANTIGRAVITY_TOKEN_DATA.dailyMap, yearKeys, activeCostModel, { mode: activeCostMode, todayStr: nowYmd });
    const yearCostCny = convertToCNY(yearCostAgg.totalCostUSD, 'USD');

    const tTotalCost = el('t-total-cost');
    const tTodayCost = el('t-today-cost');
    const tMonthCost = el('t-month-cost');
    const tYearCost = el('t-year-cost');

    if (tTotalCost) {
      tTotalCost.textContent = `≈ $${totalCostAgg.totalCostUSD.toFixed(2)}${totalCostCny !== null ? ` (¥${totalCostCny.toFixed(2)})` : ''} · 日均 $${totalCostAgg.dailyAverageUSD.toFixed(2)}`;
    }
    if (tTodayCost) {
      tTodayCost.textContent = `≈ $${todayCostInfo.costUSD.toFixed(2)}${todayCostCny !== null ? ` (¥${todayCostCny.toFixed(2)})` : ''}`;
    }
    if (tMonthCost) {
      tMonthCost.textContent = `≈ $${monthCostAgg.totalCostUSD.toFixed(2)}${monthCostCny !== null ? ` (¥${monthCostCny.toFixed(2)})` : ''} · 日均 $${monthCostAgg.dailyAverageUSD.toFixed(2)}`;
    }
    if (tYearCost) {
      tYearCost.textContent = `≈ $${yearCostAgg.totalCostUSD.toFixed(2)}${yearCostCny !== null ? ` (¥${yearCostCny.toFixed(2)})` : ''} · 日均 $${yearCostAgg.dailyAverageUSD.toFixed(2)}`;
    }

    // 规范化已完整保留输入/缓存/输出分类，执行费用视图渲染
    renderActiveCostEstimateView();

    computeTimelineWindow();
    renderActiveHeatView(true);
    return true;
  }


  async function saveSettingsBridge(payload) {
    if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
      try {
        const res = await callLiveBridge('/save-settings', payload || {}, 10000);
        if (res) return res;
      } catch {}
    }
    if (typeof window !== 'undefined' && typeof window.contextMeterAPI?.saveSettings === 'function') {
      return await window.contextMeterAPI.saveSettings(payload);
    }
    return null;
  }

  async function recordModelCallsRemote(calls) {
    if (!calls || !calls.length) return;
    let changed = false;
    const hasFinalCall = calls.some(c => c?.status === 'final');
    try {
      let res = null;
      if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
        try { res = await callLiveBridge('/record-calls', { calls }, 15000); } catch {}
      }
      if (!res && typeof window !== 'undefined' && typeof window.contextMeterAPI?.recordCalls === 'function') {
        res = await window.contextMeterAPI.recordCalls(calls);
      }
      if (res && res.ok === false) {
        console.warn('Context Meter: 记录调用入账失败', res.error);
      } else if (res?.changed) {
        changed = true;
      }
      if (changed || hasFinalCall) {
        void syncTokenHistoryFromHost(false);
      }
    } catch (err) {
      console.warn('Context Meter: 调用入账发生异常', err);
    }
  }

  async function restoreSettingsFromHost() {
    if (state.disposed) return;
    const thisSeq = ++restoreRequestSeq;
    const startActionSeq = userActionSeq;
    try {
      let settingsRes = null;
      const currentEmail = ANTIGRAVITY_TOKEN_DATA.planStatus?.email || 'default';

      // 权威配置同步：实时通道或宿主通信桥接可用时，以宿主最新持久化配置为准，避免启动快照覆盖最新状态
      if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
        try { settingsRes = await callLiveBridge('/get-settings', { email: currentEmail }, 10000); } catch {}
      }
      if (!settingsRes?.ok && typeof window !== 'undefined' && typeof window.contextMeterAPI?.getSettings === 'function') {
        settingsRes = await window.contextMeterAPI.getSettings({ email: currentEmail });
      }
      if (!settingsRes?.ok && typeof window !== 'undefined' && window.__AGContextMeterSettings?.ok) {
        settingsRes = window.__AGContextMeterSettings;
      }

      // 若在网络等待期间有更新的恢复请求完成或用户发生了最新主动修改，丢弃旧回包！
      if (thisSeq < restoreRequestSeq || userActionSeq > startActionSeq) {
        return;
      }

      if (settingsRes?.ok) {
        const savedView = settingsRes.savedHeatView || settingsRes.uiPreferences?.savedHeatView;
        if (savedView && ['daily', 'weekly', 'monthly', 'yearly', 'cum'].includes(savedView)) {
          switchHeatView(savedView, false);
        }
        const savedAutoUpdate = settingsRes.autoCheckUpdate !== undefined
          ? settingsRes.autoCheckUpdate
          : settingsRes.uiPreferences?.autoCheckUpdate;
        if (savedAutoUpdate !== undefined) {
          autoCheckUpdate = savedAutoUpdate !== false;
          const chk = el('check-auto-update');
          if (chk) chk.checked = autoCheckUpdate;
        }
      }

      if (settingsRes?.ok && settingsRes.customPlan && typeof settingsRes.customPlan === 'object') {
        lastSavedCustomPlan = { ...settingsRes.customPlan };
        if (typeof window !== 'undefined') {
          window.__AGContextMeterSettings = { ok: true, customPlan: { ...settingsRes.customPlan } };
        }

        const email = ANTIGRAVITY_TOKEN_DATA.planStatus?.email || settingsRes.customPlan?.account || currentEmail || 'default';
        try {
          const jsonStr = JSON.stringify(settingsRes.customPlan);
          if (email && email !== 'default') localStorage?.setItem('ag_custom_plan_' + String(email).toLowerCase(), jsonStr);
          localStorage?.setItem('ag_custom_plan_default', jsonStr);
        } catch {}
        if (typeof applyCustomPlanObjectLocally === 'function') {
          applyCustomPlanObjectLocally(settingsRes.customPlan, email);
        }
      } else {
        // 回退检查 localStorage
        const email = ANTIGRAVITY_TOKEN_DATA.planStatus?.email || 'default';
        const key = email && email !== 'default' ? 'ag_custom_plan_' + String(email).toLowerCase() : 'ag_custom_plan_default';
        const savedRaw = localStorage?.getItem(key) || localStorage?.getItem('ag_custom_plan_default');
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed && typeof parsed === 'object') {
            lastSavedCustomPlan = { ...parsed };
            if (typeof applyCustomPlanObjectLocally === 'function') {
              applyCustomPlanObjectLocally(parsed, parsed.account || email);
            }
          }
        }
      }
    } catch {}
  }

  let historySyncBusy = false;
  let pendingHistoryForce = false;
  async function syncTokenHistoryFromHost(force = false) {
    if (state.disposed) return;
    if (historySyncBusy) {
      if (force) {
        pendingHistoryForce = true;
      }
      return;
    }
    historySyncBusy = true;
    try {
      await restoreSettingsFromHost();
      if (typeof window !== 'undefined' && window.__AGContextMeterHistory) {
        if (!ANTIGRAVITY_TOKEN_DATA.updatedAt && !ANTIGRAVITY_TOKEN_DATA.summary?.grandTotalTokens) {
          applyTokenHistoryPayload(window.__AGContextMeterHistory);
        }
      }
      let historyRes = null;
      if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
        try { historyRes = await callLiveBridge('/token-history', { force: Boolean(force) }, 30000); } catch {}
      }
      if (!historyRes?.ok && typeof window !== 'undefined' && typeof window.contextMeterAPI?.getTokenHistory === 'function') {
        historyRes = await window.contextMeterAPI.getTokenHistory(Boolean(force));
      }
      if (historyRes?.ok && historyRes.data) {
        if (typeof window !== 'undefined') window.__AGContextMeterHistory = historyRes.data;
        applyTokenHistoryPayload(historyRes.data);
      }
    } catch {}
    finally {
      historySyncBusy = false;
      if (pendingHistoryForce) {
        pendingHistoryForce = false;
        void syncTokenHistoryFromHost(true);
      }
      if (autoCheckUpdate) {
        setTimeout(() => { void checkAppUpdate(false); }, 1200);
      }
    }
  }

  function openGithubRepo(pathSuffix = '') {
    const url = 'https://github.com/elviscjn-cjn/antigravity-context-viewer' + pathSuffix;
    if (typeof window !== 'undefined' && typeof window.contextMeterAPI?.openExternal === 'function') {
      window.contextMeterAPI.openExternal(url);
    } else {
      window.open?.(url, '_blank');
    }
  }

  let currentUpdateTrigger = 'tokens';

  function positionUpdatePopover(trigger = currentUpdateTrigger) {
    const pop = el('update-popover');
    if (!pop) return;
    const triggerBtn = trigger === 'ctx' ? el('btn-check-update-ctx') : el('btn-check-update');
    if (!triggerBtn || typeof triggerBtn.getBoundingClientRect !== 'function') return;
    const rect = triggerBtn.getBoundingClientRect();
    const winW = typeof window !== 'undefined' ? (window.innerWidth || 1024) : 1024;
    const winH = typeof window !== 'undefined' ? (window.innerHeight || 768) : 768;
    let right = Math.max(14, winW - rect.right);
    let top = rect.bottom + 8;
    if (top + 220 > winH) {
      top = Math.max(10, rect.top - 230);
    }
    pop.style.position = 'fixed';
    pop.style.top = `${Math.round(top)}px`;
    pop.style.right = `${Math.round(right)}px`;
    pop.style.left = 'auto';
  }

  function showUpdatePopover(trigger = currentUpdateTrigger) {
    const pop = el('update-popover');
    if (!pop) return;
    currentUpdateTrigger = trigger;
    positionUpdatePopover(trigger);
    pop.style.display = 'block';
  }

  function hideUpdatePopover() {
    const pop = el('update-popover');
    if (pop) pop.style.display = 'none';
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => {
      const pop = el('update-popover');
      if (pop && pop.style.display === 'block') {
        positionUpdatePopover();
      }
    });
  }

  async function checkAppUpdate(manual = false, trigger = currentUpdateTrigger) {
    const dot = el('update-badge-dot');
    const dotCtx = el('update-badge-dot-ctx');
    const pop = el('update-popover');
    const titleEl = el('up-pop-title');
    const bodyEl = el('up-pop-body');
    const verEl = el('up-pop-ver');
    const statusEl = el('up-pop-status');
    const applyBtn = el('btn-apply-update');

    // 检查桥接是否存在；若缺失则直接判定为更新功能不可用，严禁显示“最新”
    const currentVer = typeof METER_VERSION !== 'undefined' ? METER_VERSION : '0.8.2';
    const hasBridge = typeof window !== 'undefined' && typeof window.contextMeterAPI?.checkUpdate === 'function';
    if (!hasBridge) {
      cachedLatestRelease = null;
      if (dot) dot.style.display = 'none';
      if (dotCtx) dotCtx.style.display = 'none';
      if (titleEl) titleEl.textContent = 'ℹ️ 更新不可用';
      if (verEl) verEl.textContent = `v${currentVer} (更新不可用)`;
      if (bodyEl) bodyEl.textContent = '当前环境未提供更新桥接接口（如纯前端调试或免安装热挂载模式），无法在线检查更新。请前往 GitHub Releases 页面查看最新发布。';
      if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
      if (applyBtn) { applyBtn.style.display = 'none'; applyBtn.disabled = true; }
      if (manual) showUpdatePopover(trigger);
      return;
    }

    if (manual) {
      cachedLatestRelease = null;
      showUpdatePopover(trigger);
      if (titleEl) titleEl.textContent = '🔄 检查更新中';
      if (verEl) verEl.textContent = `v${currentVer} (正在检查…)`;
      if (bodyEl) bodyEl.textContent = '正在连接 GitHub 检测最新版本…';
      if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
      if (applyBtn) { applyBtn.style.display = 'none'; applyBtn.disabled = true; }
    }

    try {
      const res = await window.contextMeterAPI.checkUpdate({ force: manual, currentVersion: currentVer });

      // 返回 null、非对象或 ok: false 均为检查失败，严禁显示“最新”
      if (!res || res.ok === false) {
        cachedLatestRelease = null;
        if (dot) dot.style.display = 'none';
        if (dotCtx) dotCtx.style.display = 'none';
        if (titleEl) titleEl.textContent = '⚠️ 检查更新失败';
        if (verEl) verEl.textContent = `v${currentVer} (检查失败)`;
        const errMsg = res?.error || '未能获取有效的版本数据';
        if (bodyEl) bodyEl.textContent = `检查更新失败: ${errMsg}。请检查网络代理设置或前往 GitHub 查看。`;
        if (applyBtn) { applyBtn.style.display = 'none'; applyBtn.disabled = true; }
        if (manual) showUpdatePopover(trigger);
        return;
      }

      if (res.hasUpdate && res.latestVersion) {
        cachedLatestRelease = res;
        if (dot) dot.style.display = 'block';
        if (dotCtx) dotCtx.style.display = 'block';
        if (titleEl) titleEl.textContent = '🚀 发现新版本';
        if (verEl) verEl.textContent = `v${res.currentVersion || currentVer} → v${res.latestVersion}`;
        if (bodyEl) {
          bodyEl.textContent = `发现新版本 v${res.latestVersion}！\n\n更新说明：\n${res.releaseNotes || '性能优化与体验改进'}`;
        }
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.textContent = '立即更新';
          applyBtn.style.display = 'inline-block';
        }
        if (manual) showUpdatePopover(trigger);
      } else {
        cachedLatestRelease = null;
        if (dot) dot.style.display = 'none';
        if (dotCtx) dotCtx.style.display = 'none';
        if (titleEl) titleEl.textContent = '✅ 已是最新版本';
        const effectiveCurrent = res.installedVersion || res.currentVersion || currentVer;
        if (verEl) verEl.textContent = `v${effectiveCurrent} (已是最新)`;
        const updateStatusText = res.diskPendingRestart
          ? `已完成磁盘安装至最新版本 (v${effectiveCurrent})，待重启客户端后主进程完整生效。`
          : `当前已是最新版本 (v${effectiveCurrent})。已通过 GitHub Releases 确认。`;
        if (bodyEl) bodyEl.textContent = updateStatusText;
        if (applyBtn) { applyBtn.style.display = 'none'; applyBtn.disabled = true; }
        if (manual) showUpdatePopover(trigger);
      }
    } catch (err) {
      cachedLatestRelease = null;
      if (dot) dot.style.display = 'none';
      if (dotCtx) dotCtx.style.display = 'none';
      if (titleEl) titleEl.textContent = '⚠️ 检查更新失败';
      if (verEl) verEl.textContent = `v${currentVer} (检查失败)`;
      if (bodyEl) bodyEl.textContent = `检查更新失败: ${err.message}。请检查网络连接或稍后重试。`;
      if (applyBtn) { applyBtn.style.display = 'none'; applyBtn.disabled = true; }
      if (manual) showUpdatePopover(trigger);
    }
  }

  async function applyAppUpdate() {
    const pop = el('update-popover');
    const applyBtn = el('btn-apply-update');
    const statusEl = el('up-pop-status');
    const titleEl = el('up-pop-title');
    const bodyEl = el('up-pop-body');
    const verEl = el('up-pop-ver');
    const dot = el('update-badge-dot');
    const dotCtx = el('update-badge-dot-ctx');
    if (!cachedLatestRelease) return;

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = '正在更新...';
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = '正在下载安装包并校验 SHA-256...';
    }

    try {
      let res = null;
      if (typeof window !== 'undefined' && typeof window.contextMeterAPI?.applyUpdate === 'function') {
        res = await window.contextMeterAPI.applyUpdate({ version: cachedLatestRelease.latestVersion });
      } else {
        throw new Error('更新接口不可用');
      }
      if (res && res.ok) {
        const targetVer = res.version || res.installedVersion || cachedLatestRelease?.latestVersion || currentVer;
        currentVer = targetVer;
        const vEl = el('v');
        if (vEl) vEl.textContent = `v${currentVer}`;

        const dot = el('update-badge-dot');
        const dotCtx = el('update-badge-dot-ctx');
        if (dot) dot.style.display = 'none';
        if (dotCtx) dotCtx.style.display = 'none';

        if (titleEl) titleEl.textContent = '🎉 更新已完成';
        if (verEl) verEl.textContent = `v${currentVer} (已是最新)`;
        if (bodyEl) {
          bodyEl.textContent = res.liveInjected
            ? `已成功在线更新至 v${currentVer}。界面组件已完成热注入即时生效；主进程核心常驻模块待完全重启客户端后完整生效。`
            : `已成功完成 v${currentVer} 磁盘更新，需完全重启 Antigravity 后生效。`;
        }
        if (applyBtn) {
          applyBtn.textContent = '已更新';
          applyBtn.disabled = false;
        }

        if (res.liveInjected) {
          if (statusEl) statusEl.textContent = `🎉 磁盘更新成功 (v${currentVer})！已完成热注入即时生效（界面已刷新，主进程待重启完整生效）。`;
        } else {
          const detail = res.diskInstalled ? '已完成磁盘安装' : '更新已完成';
          if (statusEl) statusEl.textContent = `✅ ${detail} (v${currentVer})，需完全重启 Antigravity 后生效。`;
        }
        setTimeout(() => {
          if (pop) pop.style.display = 'none';
        }, 3500);
      } else {
        if (statusEl) statusEl.textContent = `✖ 更新失败: ${res?.error || '未知错误'}`;
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '重试更新'; }
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `✖ 更新异常: ${err.message}`;
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '重试更新'; }
    }
  }

  el('btn-github-repo')?.addEventListener('click', () => openGithubRepo());
  el('btn-github-repo-ctx')?.addEventListener('click', () => openGithubRepo());
  el('btn-check-update')?.addEventListener('click', () => {
    const pop = el('update-popover');
    if (pop && pop.style.display === 'block' && currentUpdateTrigger === 'tokens') {
      pop.style.display = 'none';
    } else {
      void checkAppUpdate(true, 'tokens');
    }
  });
  el('btn-check-update-ctx')?.addEventListener('click', () => {
    const pop = el('update-popover');
    if (pop && pop.style.display === 'block' && currentUpdateTrigger === 'ctx') {
      pop.style.display = 'none';
    } else {
      void checkAppUpdate(true, 'ctx');
    }
  });
  el('btn-close-update-pop')?.addEventListener('click', () => {
    const pop = el('update-popover');
    if (pop) pop.style.display = 'none';
  });
  el('btn-update-later')?.addEventListener('click', () => {
    const pop = el('update-popover');
    if (pop) pop.style.display = 'none';
  });
  el('btn-view-release-page')?.addEventListener('click', () => {
    openGithubRepo(cachedLatestRelease?.tagName ? `/releases/tag/${cachedLatestRelease.tagName}` : '/releases');
  });
  el('btn-apply-update')?.addEventListener('click', () => void applyAppUpdate());

  el('check-auto-update')?.addEventListener('change', e => {
    autoCheckUpdate = e.target.checked;
    void saveSettingsBridge({ autoCheckUpdate });
  });

function renderHeatmapGrid(forceRebuild = false) {
    const colsBox = el('h-grid-cols');
    const monthsBox = el('h-months');
    if (!colsBox || !monthsBox) return;
    const win = computeTimelineWindow();
    const sig = `${win.firstStr}:${formatLocalYmd(win.winStart)}:${Object.keys(ANTIGRAVITY_TOKEN_DATA.dailyMap).length}`;
    if (!forceRebuild && colsBox.children.length > 0 && colsBox.getAttribute('data-sig') === sig) return;

    colsBox.replaceChildren();
    monthsBox.replaceChildren();
    colsBox.setAttribute('data-sig', sig);

    const todayKey = formatLocalYmd(win.today);
    const list = [];
    for (let i = 0; i < win.totalDays; i++) {
      const d = addDays(win.winStart, i);
      const key = formatLocalYmd(d);
      const isFuture = d.getTime() > win.today.getTime();
      const rec = ANTIGRAVITY_TOKEN_DATA.dailyMap[key];
      list.push({ date: d, key, tokens: rec ? rec.total : 0, rec, isFuture, isToday: key === todayKey });
    }

    const monthMarkers = [];
    let lastM = -1;
    let lastCol = -10;

    for (let c = 0; c < 52; c++) {
      const col = document.createElement('div');
      col.className = 'heat-week-col';
      const slice = list.slice(c * 7, (c + 1) * 7);
      const mNum = slice[0].date.getMonth() + 1;
      if (mNum !== lastM) {
        if (c - lastCol >= 3 && 52 - c >= 2) {
          monthMarkers.push({ month: mNum, colIdx: c });
          lastCol = c;
        }
        lastM = mNum;
      }

      slice.forEach(item => {
        const cell = document.createElement('div');
        const lvl = getLvl(item.tokens);
        cell.className = `heat-cell lvl-${lvl}${item.isFuture ? ' is-future' : ''}${item.isToday ? ' is-today' : ''}`;
        cell.setAttribute('data-date', item.key);
        cell.setAttribute('data-tokens', String(item.tokens));

        const showPop = () => {
          const d = item.date;
          heatPopDate.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日${item.isToday ? '（今日）' : (item.key === win.firstStr ? '（首次使用）' : '')}`;
          const costInfo = getDailyModelCost(item.rec, item.key, activeCostModel, { mode: activeCostMode });
          const cny = convertToCNY(costInfo.costUSD, 'USD');
          const costStr = costInfo.costUSD > 0 ? ` · ≈ $${costInfo.costUSD.toFixed(2)}${cny !== null ? ` (¥${cny.toFixed(2)})` : ''}` : '';
          heatPopVal.textContent = item.tokens > 0 ? `${fmtYi(item.tokens)} Tokens${costStr}` : (item.isFuture ? '未来日期（待产生记录）' : '0 Tokens');
          if (item.rec) {
            heatPopDet.innerHTML = `
              <div class="pop-det-col"><span class="pop-det-val">Prompt: ${fmtYi(item.rec.input)}</span><span class="pop-det-trans">提示词</span></div>
              <div class="pop-det-col"><span class="pop-det-val">Output: ${fmtYi(item.rec.output)}</span><span class="pop-det-trans">输出</span></div>
              <div class="pop-det-col"><span class="pop-det-val">Cache: ${fmtYi(item.rec.cache)}</span><span class="pop-det-trans">缓存</span></div>
            `.trim();
            heatPopDet.style.display = 'flex';
          } else {
            heatPopDet.style.display = 'none';
          }
          const r = cell.getBoundingClientRect();
          heatPop.style.left = `${r.left + r.width / 2}px`;
          heatPop.style.top = `${r.top - 6}px`;
          heatPop.style.opacity = '1';
        };

        cell.addEventListener('mouseenter', showPop);
        cell.addEventListener('mouseleave', hidePopover);
        cell.addEventListener('click', showPop);

        col.appendChild(cell);
      });
      colsBox.appendChild(col);
    }

    monthMarkers.forEach(mm => {
      const lbl = document.createElement('span');
      lbl.className = 'heat-month-item';
      lbl.style.left = `${mm.colIdx * 13}px`;
      lbl.textContent = `${mm.month}月`;
      monthsBox.appendChild(lbl);
    });

    updateSummaryBar('daily', list.map(x => x.key));
  }

  function renderHeatmapWeekly() {
    const box = el('h-weekly-box');
    if (!box) return;
    box.replaceChildren();

    const scale = getEffectiveHeatmapScale();
    const [cEmpty, c1, c2, c3, c4] = scale;
    const win = computeTimelineWindow();
    const totalWeeks = 52;
    const weeksData = [];
    let max = 1;

    for (let c = 0; c < totalWeeks; c++) {
      let sum = 0;
      let sDate = null, eDate = null;
      for (let r = 0; r < 7; r++) {
        const d = addDays(win.winStart, c * 7 + r);
        const k = formatLocalYmd(d);
        if (!sDate) sDate = d;
        eDate = d;
        const rec = ANTIGRAVITY_TOKEN_DATA.dailyMap[k];
        if (rec) sum += rec.total;
      }
      if (sum > max) max = sum;
      weeksData.push({ sum, sDate, eDate, startKey: formatLocalYmd(sDate) });
    }

    weeksData.forEach(w => {
      const col = document.createElement('div');
      col.className = 'w-bar-col';
      col.setAttribute('data-week-start', w.startKey);
      const fill = document.createElement('div');
      fill.className = 'w-bar-fill';
      const pct = Math.max(3, (w.sum / max) * 100);
      fill.style.height = `${pct}%`;
      const lvl = getLvlForRange(w.sum, 'week', max);
      fill.style.backgroundColor = w.sum === 0 ? cEmpty : (scale[lvl] || c4);
      col.appendChild(fill);

      const showPop = () => {
        const weekDates = [];
        for (let r = 0; r < 7; r++) weekDates.push(formatLocalYmd(addDays(w.sDate, r)));
        const costAgg = calculateIntervalCost(ANTIGRAVITY_TOKEN_DATA.dailyMap, weekDates, activeCostModel, {
          mode: activeCostMode,
          todayStr: formatLocalYmd(win.today)
        });
        const cny = convertToCNY(costAgg.totalCostUSD, 'USD');
        const costStr = costAgg.totalCostUSD > 0 ? ` · ≈ $${costAgg.totalCostUSD.toFixed(2)}${cny !== null ? ` (¥${cny.toFixed(2)})` : ''}` : '';
        heatPopDate.textContent = `${w.sDate.getFullYear()}.${w.sDate.getMonth() + 1}.${w.sDate.getDate()} - ${w.eDate.getMonth() + 1}.${w.eDate.getDate()}`;
        heatPopVal.textContent = w.sum > 0 ? `${fmtYi(w.sum)} Tokens${costStr}` : '0 Tokens';
        heatPopDet.innerHTML = `<span>Weekly Total · 周累计 (折合日均 $${costAgg.dailyAverageUSD.toFixed(2)})</span>`;
        heatPopDet.style.display = 'block';
        const r = col.getBoundingClientRect();
        heatPop.style.left = `${r.left + r.width / 2}px`;
        heatPop.style.top = `${r.top - 6}px`;
        heatPop.style.opacity = '1';
      };

      col.addEventListener('mouseenter', showPop);
      col.addEventListener('mouseleave', hidePopover);
      col.addEventListener('click', showPop);

      box.appendChild(col);
    });

    const allWinDates = [];
    for (let i = 0; i < win.totalDays; i++) allWinDates.push(formatLocalYmd(addDays(win.winStart, i)));
    updateSummaryBar('weekly', allWinDates);
  }

  function renderHeatmapCum() {
    const cvs = el('h-cum-canvas');
    if (!cvs || !cvs.getContext) return;
    const ctx = cvs.getContext('2d');
    const rect = cvs.getBoundingClientRect ? cvs.getBoundingClientRect() : { width: 670 };
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const width = (rect.width || 670);
    const height = 100;
    cvs.width = width * dpr;
    cvs.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const win = computeTimelineWindow();
    const map = ANTIGRAVITY_TOKEN_DATA.dailyMap || {};
    const winStartKey = formatLocalYmd(win.winStart);
    // 计算窗口起点之前的历史滚存基数（支持跨年翻页时累计曲线连续）
    let running = 0;
    for (const [k, rec] of Object.entries(map)) {
      if (k < winStartKey && rec?.total > 0) running += rec.total;
    }

    const activeEnd = win.winEnd.getTime() > win.today.getTime() ? win.today : win.winEnd;
    const plotDays = Math.max(1, Math.floor((activeEnd.getTime() - win.winStart.getTime()) / 86400000) + 1);
    const points = [];

    for (let i = 0; i < plotDays; i++) {
      const d = addDays(win.winStart, i);
      const k = formatLocalYmd(d);
      const rec = map[k];
      if (rec) running += rec.total;
      points.push({ date: d, key: k, val: running });
    }

    const max = running || 1;
    const denom = Math.max(1, points.length - 1);
    const step = points.length === 1 ? width : (width / denom);

    const scale = getEffectiveHeatmapScale();
    const strokeColor = customColors.tokenAccent || scale[4];
    const strokeRgb = hexToRgb(normalizeHex(strokeColor)) || { r: 192, g: 132, b: 252 };
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `rgba(${strokeRgb.r}, ${strokeRgb.g}, ${strokeRgb.b}, 0.36)`);
    grad.addColorStop(1, `rgba(${strokeRgb.r}, ${strokeRgb.g}, ${strokeRgb.b}, 0.02)`);

    ctx.beginPath();
    ctx.moveTo(0, height);
    points.forEach((pt, idx) => {
      const x = points.length === 1 ? width / 2 : idx * step;
      const y = height - (pt.val / max) * (height - 12);
      ctx.lineTo(x, y);
    });
    if (points.length === 1) {
      const y = height - (points[0].val / max) * (height - 12);
      ctx.lineTo(width, y);
    }
    ctx.lineTo(width, height);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = points.length === 1 ? 0 : idx * step;
      const y = height - (pt.val / max) * (height - 12);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (points.length === 1) {
      const y = height - (points[0].val / max) * (height - 12);
      ctx.lineTo(width, y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    cvs.onmousemove = e => {
      const r = cvs.getBoundingClientRect();
      const mouseX = e.clientX - r.left;
      const idx = points.length === 1 ? 0 : Math.min(points.length - 1, Math.max(0, Math.round(mouseX / step)));
      const pt = points[idx];
      const cumDates = [];
      for (const k of Object.keys(map)) {
        if (k <= pt.key) cumDates.push(k);
      }
      const costAgg = calculateIntervalCost(map, cumDates, activeCostModel, {
        mode: activeCostMode,
        todayStr: formatLocalYmd(win.today)
      });
      const cny = convertToCNY(costAgg.totalCostUSD, 'USD');
      const costStr = costAgg.totalCostUSD > 0 ? ` · ≈ $${costAgg.totalCostUSD.toFixed(2)}${cny !== null ? ` (¥${cny.toFixed(2)})` : ''}` : '';
      heatPopDate.textContent = `${pt.date.getFullYear()}年${pt.date.getMonth() + 1}月${pt.date.getDate()}日 (累计)`;
      heatPopVal.textContent = `${fmtYi(pt.val)} Tokens${costStr}`;
      heatPopDet.innerHTML = `<span>Cumulative Total · 截至当日累计 (折合日均 $${costAgg.dailyAverageUSD.toFixed(2)})</span>`;
      heatPopDet.style.display = 'block';
      heatPop.style.left = `${e.clientX}px`;
      heatPop.style.top = `${r.top + (height - (pt.val / max) * (height - 12)) - 6}px`;
      heatPop.style.opacity = '1';
    };
    cvs.onmouseleave = hidePopover;

    const allWinDates = [];
    for (let i = 0; i < win.totalDays; i++) allWinDates.push(formatLocalYmd(addDays(win.winStart, i)));
    updateSummaryBar('cum', allWinDates);
  }

  function updateSummaryBar(viewType, dateKeys = []) {
    const sumTokensEl = el('h-sum-tokens');
    const sumPeakEl = el('h-peak-val');
    const sumCostEl = el('h-sum-cost');
    const sumDailyAvgEl = el('h-sum-daily-avg');
    const sumActiveAvgEl = el('h-sum-active-avg');
    const subRatioWrapEl = el('h-sum-sub-ratio-wrap');
    const subRatioEl = el('h-sum-sub-ratio');
    if (!sumTokensEl) return;

    const win = computeTimelineWindow();
    const todayStr = formatLocalYmd(win.today);
    const map = ANTIGRAVITY_TOKEN_DATA.dailyMap || {};
    const costAgg = calculateIntervalCost(map, dateKeys, activeCostModel, {
      mode: activeCostMode,
      todayStr
    });

    const cny = convertToCNY(costAgg.totalCostUSD, 'USD');
    sumTokensEl.textContent = `${fmtYi(costAgg.totalTokens)} Tokens`;
    if (sumPeakEl) {
      let peakVal = 0;
      let peakKey = '';
      for (const k of dateKeys) {
        if (k > todayStr) continue;
        const t = Number(map[k]?.total) || 0;
        if (t > peakVal) {
          peakVal = t;
          peakKey = k;
        }
      }
      sumPeakEl.textContent = peakVal > 0 ? `${fmtYi(peakVal)} (${peakKey.slice(5)})` : '--';
    }
    if (sumCostEl) sumCostEl.textContent = `≈ $${costAgg.totalCostUSD.toFixed(2)}${cny !== null ? ` (¥${cny.toFixed(2)})` : ''}`;
    if (sumDailyAvgEl) sumDailyAvgEl.textContent = `$${costAgg.dailyAverageUSD.toFixed(2)}`;
    if (sumActiveAvgEl) sumActiveAvgEl.textContent = `$${costAgg.activeDailyAverageUSD.toFixed(2)} (${costAgg.activeDays}天)`;

    if ((viewType === 'monthly' || viewType === 'yearly') && subRatioWrapEl && subRatioEl) {
      const plan = resolveEffectivePlanStatus(ANTIGRAVITY_TOKEN_DATA.planStatus, ANTIGRAVITY_TOKEN_DATA.customPlanSettings);
      const paidVal = plan.actualPricePaid ?? plan.pricePaid ?? plan.officialPriceMonthly ?? null;
      const isZeroCost = plan.isZeroExtraCost || paidVal === 0;
      if (!isZeroCost && paidVal > 0 && costAgg.totalCostUSD > 0) {
        const subMonthlyUSD = plan.currency === 'USD' ? paidVal : (plan.actualPricePaidCNY ? plan.actualPricePaidCNY / 6.72 : paidVal);
        if (subMonthlyUSD > 0) {
          const ratio = (costAgg.totalCostUSD / (viewType === 'yearly' ? subMonthlyUSD * 12 : subMonthlyUSD)).toFixed(1);
          subRatioEl.textContent = `${ratio}x 回本`;
          subRatioWrapEl.style.display = 'inline-flex';
        } else {
          subRatioWrapEl.style.display = 'none';
        }
      } else {
        subRatioWrapEl.style.display = 'none';
      }
    } else if (subRatioWrapEl) {
      subRatioWrapEl.style.display = 'none';
    }
  }

  function renderHeatmapMonthly() {
    const box = el('h-monthly-box');
    if (!box) return;
    box.replaceChildren();

    const scrollBox = el('h-scroll-box') || box.parentElement;
    const rect = scrollBox && typeof scrollBox.getBoundingClientRect === 'function' ? scrollBox.getBoundingClientRect() : null;
    const W = (rect && rect.width > 200) ? Math.floor(rect.width - 16) : 670;
    const H = 95;

    const scale = getEffectiveHeatmapScale();
    const win = computeTimelineWindow();
    const today = win.today;
    const todayKey = formatLocalYmd(today);

    // 计算当前所选月 (按 heatMonthOffset 自然月偏移)
    const targetDate = new Date(today.getFullYear(), today.getMonth() + heatMonthOffset, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    const gap = 5;
    let bestR = 1, bestC = daysInMonth, bestS = 0;
    for (let r = 1; r <= 7; r++) {
      const c = Math.ceil(daysInMonth / r);
      const s = Math.min((W - (c - 1) * gap) / c, (H - (r - 1) * gap) / r);
      if (s > bestS) {
        bestS = s;
        bestR = r;
        bestC = c;
      }
    }
    bestS = Math.floor(bestS);
    const showDayNum = bestS >= 22;

    const grid = document.createElement('div');
    grid.className = 'heat-month-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${bestC}, ${bestS}px)`;
    grid.style.gridAutoRows = `${bestS}px`;
    grid.style.gap = `${gap}px`;
    grid.style.justifyContent = 'center';
    grid.style.alignContent = 'center';
    grid.style.height = `${H}px`;

    const dateKeys = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(targetYear, targetMonth, day);
      const k = formatLocalYmd(d);
      dateKeys.push(k);
      const isFuture = d.getTime() > today.getTime();
      const isToday = k === todayKey;
      const rec = ANTIGRAVITY_TOKEN_DATA.dailyMap[k];
      const tokens = rec ? rec.total : 0;
      const lvl = getLvl(tokens);

      const cell = document.createElement('div');
      cell.className = `heat-month-cell heat-cell lvl-${lvl}${isFuture ? ' is-future' : ''}${isToday ? ' is-today' : ''}`;
      cell.style.width = `${bestS}px`;
      cell.style.height = `${bestS}px`;
      cell.style.backgroundColor = scale[lvl];
      cell.setAttribute('data-date', k);
      cell.setAttribute('data-tokens', String(tokens));

      if (showDayNum) {
        const numSpan = document.createElement('span');
        numSpan.className = 'heat-month-cell-num';
        numSpan.textContent = String(day);
        cell.appendChild(numSpan);
      }

      const showPop = () => {
        const costInfo = getDailyModelCost(rec, k, activeCostModel, { mode: activeCostMode });
        const cny = convertToCNY(costInfo.costUSD, 'USD');
        const costStr = costInfo.costUSD > 0 ? ` · ≈ $${costInfo.costUSD.toFixed(2)}${cny !== null ? ` (¥${cny.toFixed(2)})` : ''}` : '';
        heatPopDate.textContent = `${targetYear}年${targetMonth + 1}月${day}日${isToday ? '（今日）' : ''}`;
        heatPopVal.textContent = tokens > 0 ? `${fmtYi(tokens)} Tokens${costStr}` : (isFuture ? '未来日期（待产生记录）' : '0 Tokens');
        if (rec) {
          heatPopDet.innerHTML = `
            <div class="pop-det-col"><span class="pop-det-val">Prompt: ${fmtYi(rec.input)}</span><span class="pop-det-trans">提示词</span></div>
            <div class="pop-det-col"><span class="pop-det-val">Output: ${fmtYi(rec.output)}</span><span class="pop-det-trans">输出</span></div>
            <div class="pop-det-col"><span class="pop-det-val">Cache: ${fmtYi(rec.cache)}</span><span class="pop-det-trans">缓存</span></div>
          `.trim();
          heatPopDet.style.display = 'flex';
        } else {
          heatPopDet.style.display = 'none';
        }
        const r = cell.getBoundingClientRect();
        heatPop.style.left = `${r.left + r.width / 2}px`;
        heatPop.style.top = `${r.top - 6}px`;
        heatPop.style.opacity = '1';
      };

      cell.addEventListener('mouseenter', showPop);
      cell.addEventListener('mouseleave', hidePopover);
      cell.addEventListener('click', showPop);

      grid.appendChild(cell);
    }

    box.appendChild(grid);
    updateSummaryBar('monthly', dateKeys);
  }

  function renderHeatmapYearly() {
    const box = el('h-yearly-box');
    if (!box) return;
    box.replaceChildren();

    const scrollBox = el('h-scroll-box') || box.parentElement;
    const rect = scrollBox && typeof scrollBox.getBoundingClientRect === 'function' ? scrollBox.getBoundingClientRect() : null;
    const W = (rect && rect.width > 200) ? Math.floor(rect.width - 16) : 670;
    const H = 95;

    const scale = getEffectiveHeatmapScale();
    const win = computeTimelineWindow();
    const today = win.today;
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth();
    const targetYear = thisYear + heatYearOffset;

    const monthsData = [];
    const allYearDates = [];
    let maxMonthTokens = 1;

    for (let m = 0; m < 12; m++) {
      const daysCount = new Date(targetYear, m + 1, 0).getDate();
      let mTokens = 0;
      const mDates = [];
      for (let d = 1; d <= daysCount; d++) {
        const dateObj = new Date(targetYear, m, d);
        const k = formatLocalYmd(dateObj);
        mDates.push(k);
        allYearDates.push(k);
        const rec = ANTIGRAVITY_TOKEN_DATA.dailyMap[k];
        if (rec) mTokens += rec.total;
      }
      const isCurrent = (targetYear === thisYear && m === thisMonth);
      const isFuture = (targetYear > thisYear || (targetYear === thisYear && m > thisMonth));
      if (!isFuture && mTokens > maxMonthTokens) {
        maxMonthTokens = mTokens;
      }
      monthsData.push({
        monthIndex: m,
        monthName: `${m + 1}月`,
        tokens: mTokens,
        dates: mDates,
        isCurrent,
        isFuture
      });
    }

    const createSvgNode = tag => {
      if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
      }
      return document.createElement(tag);
    };

    const svg = createSvgNode('svg');
    svg.setAttribute('class', 'heat-yearly-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));

    const Rmin = 6;
    const Rmax = 24;
    const colW = W / 12;
    const cy = 42;

    let peakMonthIndex = -1;
    let peakTokens = 0;
    monthsData.forEach(item => {
      if (!item.isFuture && item.tokens > peakTokens) {
        peakTokens = item.tokens;
        peakMonthIndex = item.monthIndex;
      }
    });

    monthsData.forEach((item, idx) => {
      const cx = colW * idx + colW / 2;
      const g = createSvgNode('g');
      g.setAttribute('class', 'heat-yearly-bubble-group');
      g.style.animationDelay = `${idx * 20}ms`;

      let radius = Rmin;
      if (!item.isFuture && item.tokens > 0) {
        const ratio = Math.sqrt(item.tokens / maxMonthTokens);
        radius = Rmin + ratio * (Rmax - Rmin);
      }

      const lvl = item.isFuture ? 0 : getLvlForRange(item.tokens, 'month', maxMonthTokens);
      const fillCol = item.isFuture ? 'transparent' : (scale[lvl] || scale[0]);

      const circle = createSvgNode('circle');
      circle.setAttribute('class', 'bubble-main');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(radius));
      circle.setAttribute('fill', fillCol);
      circle.setAttribute('stroke', item.isFuture ? 'rgba(255,255,255,0.18)' : (item.monthIndex === peakMonthIndex ? 'var(--ag-text-primary)' : 'rgba(255,255,255,0.08)'));
      circle.setAttribute('stroke-width', item.monthIndex === peakMonthIndex ? '2' : '1');

      if (item.isFuture) {
        circle.setAttribute('stroke-dasharray', '2,2');
      }

      g.appendChild(circle);

      if (item.isCurrent) {
        const activeRing = createSvgNode('circle');
        activeRing.setAttribute('cx', String(cx));
        activeRing.setAttribute('cy', String(cy));
        activeRing.setAttribute('r', String(radius + 4));
        activeRing.setAttribute('fill', 'none');
        activeRing.setAttribute('stroke', 'var(--ag-custom-token-accent,var(--ag-token-accent-default,#a78bfa))');
        activeRing.setAttribute('stroke-width', '1.5');
        activeRing.setAttribute('stroke-dasharray', '3,3');
        g.appendChild(activeRing);
      }

      if (item.monthIndex === peakMonthIndex && item.tokens > 0) {
        const peakBadge = createSvgNode('text');
        peakBadge.setAttribute('x', String(cx));
        peakBadge.setAttribute('y', String(cy - radius - 5));
        peakBadge.setAttribute('text-anchor', 'middle');
        peakBadge.setAttribute('font-size', '8.5');
        peakBadge.setAttribute('font-weight', '600');
        peakBadge.setAttribute('fill', 'var(--ag-custom-token-accent,var(--ag-token-accent-default,#a78bfa))');
        peakBadge.textContent = '峰值';
        g.appendChild(peakBadge);
      }

      const text = createSvgNode('text');
      text.setAttribute('x', String(cx));
      text.setAttribute('y', String(H - 12));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', item.isCurrent ? 'var(--ag-text-primary)' : 'var(--ag-text-muted)');
      text.setAttribute('font-weight', item.isCurrent ? '600' : '400');
      text.textContent = item.monthName;
      g.appendChild(text);

      const showPop = () => {
        const costAgg = calculateIntervalCost(ANTIGRAVITY_TOKEN_DATA.dailyMap, item.dates, activeCostModel, {
          mode: activeCostMode,
          todayStr: formatLocalYmd(win.today)
        });
        const cny = convertToCNY(costAgg.totalCostUSD, 'USD');
        const costStr = costAgg.totalCostUSD > 0 ? ` · ≈ $${costAgg.totalCostUSD.toFixed(2)}${cny !== null ? ` (¥${cny.toFixed(2)})` : ''}` : '';
        heatPopDate.textContent = `${targetYear}年${item.monthName}${item.isCurrent ? '（进行中）' : (item.monthIndex === peakMonthIndex ? '（年度峰值）' : '')}`;
        heatPopVal.textContent = item.tokens > 0 ? `${fmtYi(item.tokens)} Tokens${costStr}` : (item.isFuture ? '未来月份（尚未产生用量）' : '0 Tokens');
        heatPopDet.innerHTML = `<span>Monthly Total · 折合日均 $${costAgg.dailyAverageUSD.toFixed(2)} (活跃 ${costAgg.activeDays} 天)</span>`;
        heatPopDet.style.display = 'block';

        const r = g.getBoundingClientRect ? g.getBoundingClientRect() : { left: cx, top: cy, width: radius * 2 };
        heatPop.style.left = `${r.left + (r.width || 0) / 2}px`;
        heatPop.style.top = `${r.top - 6}px`;
        heatPop.style.opacity = '1';
      };

      g.addEventListener('mouseenter', showPop);
      g.addEventListener('mouseleave', hidePopover);
      g.addEventListener('click', showPop);

      svg.appendChild(g);
    });

    box.appendChild(svg);
    updateSummaryBar('yearly', allYearDates);
  }

  // 初始化首次使用日与时间轴显示并触发后台完整历史同步
  computeTimelineWindow();
  void syncTokenHistoryFromHost();

  // 统一生成徽章、悬浮提示与速览卡片的状态数据
  function resolveDisplayStatus(d, session) {
    const ec = d?.errorClassification;
    let kind = ec?.kind || (d?.exceeded ? 'context_overflow' : d?.network ? 'network_error' : d?.error ? 'unknown' : 'none');

    // 如果没有显示分类但存在明确标志
    if (d?.exceeded) kind = 'context_overflow';

    if (kind === 'context_overflow' || d?.exceeded) {
      const sLimit = d?.serviceLimit || ec?.serviceLimit;
      return {
        kind: 'context_overflow',
        badgeText: '超限',
        amountText: '服务端超限',
        keyBadgeText: '已超限',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 100% 已溢出',
        tipTitle: '上下文窗口（超限告警）：',
        tipPct: '100% 已用（已超出上限）',
        tipDetail: sLimit ? `已超上限，共 ${fmtBubbleToken(sLimit)} token` : '服务端已拒绝输入（超出容量上限）',
        statusText: `服务端已拒绝：输入超限${sLimit ? `（上限 ${short(sLimit)} tokens）` : ''}。本地估算不可靠，需精简或新建会话。`,
        keyTakeaway: `✖ 已超出服务端最大限制${sLimit ? `（${fmt(sLimit)} tokens）` : ''}，当前对话已被拒绝。需精简或新建会话。`,
        isError: true,
        isOverflow: true
      };
    }

    if (kind === 'quota_exhausted') {
      const pool = ec?.modelOrPool || d?.model || '当前模型';
      const resetStr = ec?.resetTimeZh ? `，预计将于 ${ec.resetTimeZh} 重置` : '';
      return {
        kind: 'quota_exhausted',
        badgeText: '额度耗尽',
        amountText: '额度耗尽',
        keyBadgeText: '额度耗尽',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 模型额度用尽，可切换模型',
        tipTitle: '模型额度（额度耗尽）：',
        tipPct: '当前模型配额已用尽',
        tipDetail: `${pool}额度已耗尽${resetStr}。可手动切换至其他可用模型`,
        statusText: `模型额度耗尽：${pool}额度已用尽${resetStr}。可手动切换至其他可用模型。`,
        keyTakeaway: `✖ ${pool}额度已耗尽${resetStr}。可手动切换至其他可用模型继续对话。`,
        isError: true,
        isOverflow: false
      };
    }

    if (kind === 'rate_limited') {
      const retryStr = ec?.retryAfterSec ? `（建议等待 ${ec.retryAfterSec} 秒）` : '';
      return {
        kind: 'rate_limited',
        badgeText: '限流',
        amountText: '请求限流',
        keyBadgeText: '请求限流',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 触发频率限制，请稍候',
        tipTitle: '请求限制（请求过频）：',
        tipPct: '触发服务端频率限制（429）',
        tipDetail: `请求过于频繁${retryStr}，请稍候重试`,
        statusText: `请求频率限制：请求过于频繁，触发服务端限制（429）${retryStr}。稍候重试即可恢复。`,
        keyTakeaway: `⚠ 触发服务端请求频率限制（HTTP 429）${retryStr}，短时间内发送请求过多，稍候重试即可恢复。`,
        isError: true,
        isOverflow: false
      };
    }

    if (kind === 'network_error' || d?.network) {
      const cleanDiag = ec?.diagnostic || '连接中断或超时';
      return {
        kind: 'network_error',
        badgeText: '网络',
        amountText: '网络故障',
        keyBadgeText: '网络故障',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 连接异常，请检查网络',
        tipTitle: '网络连接（连接故障）：',
        tipPct: '网络连接失败或超时',
        tipDetail: `连接异常（${cleanDiag}）。请检查本地网络代理与连接`,
        statusText: `网络连接异常：${cleanDiag}。请检查本地网络代理与网络链路设置。`,
        keyTakeaway: `✖ 网络连接出现异常（${cleanDiag}）。请检查本地网络代理与链路状态。`,
        isError: true,
        isOverflow: false
      };
    }

    if (kind === 'auth_error') {
      return {
        kind: 'auth_error',
        badgeText: '认证',
        amountText: '认证失败',
        keyBadgeText: '认证异常',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 权限不足或登录异常',
        tipTitle: '账号权限（身份异常）：',
        tipPct: '身份认证失败或缺少权限',
        tipDetail: '身份认证失败或无权限访问，请检查账号登录状态',
        statusText: '身份认证失败或无访问权限，请检查账号登录状态或订阅权限。',
        keyTakeaway: '✖ 身份认证失败或无访问权限（401/403）。请检查账号登录状态或订阅权限。',
        isError: true,
        isOverflow: false
      };
    }

    if (kind === 'service_unavailable') {
      return {
        kind: 'service_unavailable',
        badgeText: '服务异常',
        amountText: '服务受限',
        keyBadgeText: '服务受限',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 服务端繁忙，请稍候',
        tipTitle: '服务端状态（服务受限）：',
        tipPct: '模型服务暂不可用或过载',
        tipDetail: '服务端暂时过载或维护中，请稍后重试',
        statusText: '模型服务暂不可用或处于高负载（503/Overloaded），请稍后重试。',
        keyTakeaway: '⚠ 服务端暂时不可用或处于高负载（503/Overloaded），请稍后重试。',
        isError: true,
        isOverflow: false
      };
    }

    if (kind === 'canceled') {
      return {
        kind: 'canceled',
        badgeText: '已取消',
        amountText: '请求取消',
        keyBadgeText: '已取消',
        pillClass: 'key-pill pill-muted',
        hoverExtra: ' · 用户中断请求',
        tipTitle: '请求状态（已取消）：',
        tipPct: '请求已被主动取消',
        tipDetail: '本次生成请求已由用户或系统主动取消',
        statusText: '本次生成请求已由用户或系统主动取消。',
        keyTakeaway: 'ℹ 本次生成请求已由用户或系统主动取消。',
        isError: false,
        isOverflow: false
      };
    }

    if (d?.error) {
      const diag = ec?.diagnostic || d.error;
      return {
        kind: 'unknown',
        badgeText: '待确认',
        amountText: '请求异常',
        keyBadgeText: '原因待确认',
        pillClass: 'key-pill pill-danger',
        hoverExtra: ' · 失败原因待确认',
        tipTitle: '请求状态（原因待确认）：',
        tipPct: '最近请求失败（原因未知）',
        tipDetail: `当前无法确认具体原因（${diag}）`,
        statusText: `最近请求遇到错误，当前无法独立确认具体原因（${diag}）。`,
        keyTakeaway: `✖ 最近请求遇到错误，当前无法独立确认具体原因（${diag}）。`,
        isError: true,
        isOverflow: false
      };
    }

    return {
      kind: 'none',
      badgeText: '',
      amountText: '',
      keyBadgeText: '',
      pillClass: 'key-pill pill-good',
      hoverExtra: '',
      tipTitle: '',
      tipPct: '',
      tipDetail: '',
      statusText: '',
      keyTakeaway: '',
      isError: false,
      isOverflow: false
    };
  }
  function updateRingAndBubble(d, session, pct, danger, stale, incomplete) {
    const ringFill = el('ring-fill');
    const tipTitle = el('ctx-tip-title');
    const tipPct = el('ctx-tip-pct');
    const tipDetail = el('ctx-tip-detail');

    // 区分常态颜色与高占用告警状态
    let occupancy = 'normal';
    if (danger || (pct != null && pct >= 90)) {
      occupancy = 'danger';
    } else if ((pct != null && pct >= 75) || stale) {
      occupancy = 'warn';
    }
    host.setAttribute('data-occupancy', occupancy);

    // 1. 圆环进度与未知容量状态表达（未知容量绝不画成 0% 或 100%）
    if (ringFill) {
      if (d?.exceeded) {
        ringFill.setAttribute('data-ring-state', 'exceeded');
        ringFill.setAttribute('stroke-dasharray', `${RING_CIRCUMFERENCE.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`);
        ringFill.style.opacity = '1';
      } else if (pct != null) {
        ringFill.setAttribute('data-ring-state', 'determinate');
        if (pct <= 0) {
          ringFill.setAttribute('stroke-dasharray', `0 ${RING_CIRCUMFERENCE.toFixed(2)}`);
          ringFill.style.opacity = '0';
        } else {
          const arcLen = Math.max(1.8, (Math.min(100, pct) / 100) * RING_CIRCUMFERENCE);
          ringFill.setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`);
          ringFill.style.opacity = '1';
        }
      } else {
        // 容量未知 / 仅估算 / 尚未就绪：使用均匀虚线环段表示非确定比例，不画成 0% 空环或 100% 满环
        ringFill.setAttribute('data-ring-state', d?.estimated ? 'estimated' : 'unknown');
        ringFill.setAttribute('stroke-dasharray', '3.2 4.97');
        ringFill.style.opacity = '0.55';
      }
    }

    // 2. 悬停信息气泡三层文案（标题 — 使用比例 — 用量与容量）
    if (!tipTitle || !tipPct || !tipDetail) return;

    const disp = resolveDisplayStatus(d, session);
    if (disp.isError || disp.kind === 'canceled') {
      tipTitle.textContent = disp.tipTitle;
      tipPct.textContent = disp.tipPct;
      tipDetail.textContent = disp.tipDetail;
    } else if (stale && d?.actual != null && d?.budget) {
      const usedRound = Math.min(100, Math.max(0, Math.round((d.actual / d.budget) * 100)));
      const remRound = Math.max(0, 100 - usedRound);
      tipTitle.textContent = '上下文窗口（数据过期）：';
      tipPct.textContent = `${usedRound}% 已用（剩余 ${remRound}% · 统计延迟）`;
      tipDetail.textContent = `已用 ${fmtBubbleToken(d.actual)} token，共 ${fmtBubbleToken(d.budget)}`;
    } else if (stale) {
      tipTitle.textContent = '上下文窗口（数据过期）：';
      tipPct.textContent = '统计读取延迟（剩余未知）';
      tipDetail.textContent = session
        ? `会话估算 ≈ ${fmtBubbleToken(session.total.low)}–${fmtBubbleToken(session.total.high)} token`
        : '正在等待后台更新统计数据';
    } else if (d?.actual != null && d?.budget) {
      const rawPct = pct != null ? pct : (d.actual / d.budget) * 100;
      const usedRound = rawPct > 0 && rawPct < 1 ? 1 : Math.min(100, Math.max(0, Math.round(rawPct)));
      const remRound = Math.max(0, 100 - usedRound);
      if (rawPct >= 90) {
        tipTitle.textContent = '上下文窗口（高占用告警）：';
        tipPct.textContent = `${usedRound}% 已用（剩余 ${remRound}% · 接近上限）`;
      } else if (rawPct >= 75) {
        tipTitle.textContent = '上下文窗口（占用偏高）：';
        tipPct.textContent = `${usedRound}% 已用（剩余 ${remRound}% · 占用偏高）`;
      } else {
        tipTitle.textContent = '上下文窗口：';
        tipPct.textContent = `${usedRound}% 已用（剩余 ${remRound}%）`;
      }
      tipDetail.textContent = `已用 ${fmtBubbleToken(d.actual)} token，共 ${fmtBubbleToken(d.budget)}${incomplete ? '（含未知附件）' : ''}`;
    } else if (d?.actual != null && !d?.budget) {
      tipTitle.textContent = '上下文窗口：';
      tipPct.textContent = '容量未知（未返回上限）';
      tipDetail.textContent = `已用 ${fmtBubbleToken(d.actual)} token，总容量未知`;
    } else if (d?.estimated || d?.estimate != null) {
      tipTitle.textContent = '上下文窗口（本地估算）：';
      tipPct.textContent = '真实占比未知（仅估算）';
      tipDetail.textContent = `已用 ≈ ${fmtBubbleToken(d.estimate)} token${d.budget ? `，共 ${fmtBubbleToken(d.budget)}` : '，总容量未知'}`;
    } else if (session) {
      tipTitle.textContent = '上下文窗口（本地估算）：';
      tipPct.textContent = '等待请求统计（仅归档估算）';
      tipDetail.textContent = `会话累计 ≈ ${fmtBubbleToken(session.total.low)}–${fmtBubbleToken(session.total.high)} token`;
    } else {
      tipTitle.textContent = '上下文窗口：';
      tipPct.textContent = '数据尚未就绪';
      tipDetail.textContent = '正在读取当前会话上下文用量…';
    }

    if (state.tooltipOpen) positionContextTooltip();
  }

  
  // ─── 官方模型配额实时监控 (Quota Monitor) ──────────────────────────
  let lastQuotaSummary = null;
  let lastQuotaSync = 0;

  function formatCountdown(isoStr) {
    if (!isoStr) return '--';
    try {
      const diff = new Date(isoStr).getTime() - Date.now();
      if (diff <= 0) return '即将刷新';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const d = Math.floor(h / 24);
      return d > 0 ? `${d}天 ${h % 24}小时` : (h > 0 ? `${h}小时 ${m}分` : `${m}分钟`);
    } catch {
      return '--';
    }
  }

  function getQuotaColor(pct) {
    if (pct > 50) return '#10b981';
    if (pct > 20) return '#f59e0b';
    return '#ef4444';
  }

  function formatQuotaGroupTitle(prefix, group) {
    const baseTitle = prefix === 'gemini' ? 'Gemini Models' : 'Claude & GPT Models';
    const rawDesc = String(group?.description || '');
    const listPart = rawDesc.replace(/^Models within this group:\s*/i, '').trim();
    if (!listPart) return baseTitle;
    const rawItems = listPart
      .split(',')
      .map(s => s.trim())
      .filter(s => s && !/orchestrator/i.test(s));
    if (!rawItems.length) return baseTitle;
    let lastMajor = null;
    const shortItems = [];
    for (const item of rawItems) {
      let s = item.replace(/^(?:Gemini|Claude)\s+/i, '').trim();
      const majorMatch = s.match(/^(\d+)\s+([A-Za-z].*)$/);
      if (majorMatch && !/^(?:Flash|Pro|Ultra|Nano|Lite)\b/i.test(majorMatch[2])) {
        if (lastMajor === majorMatch[1]) {
          s = majorMatch[2];
        } else {
          lastMajor = majorMatch[1];
        }
      } else {
        lastMajor = null;
      }
      if (s && !shortItems.includes(s)) shortItems.push(s);
    }
    return shortItems.length ? `${baseTitle} (${shortItems.join(' / ')})` : baseTitle;
  }

  function renderQuotaData(data) {
    if (!data?.response?.groups) return;
    lastQuotaSummary = data;
    const groups = data.response.groups;

    const gGroup = groups.find(g => g.displayName?.toLowerCase().includes('gemini'));
    const cGroup = groups.find(g => g.displayName?.toLowerCase().includes('claude') || g.displayName?.toLowerCase().includes('gpt'));

    function updateGroup(prefix, group) {
      if (!group) return null;
      const weekly = group.buckets?.find(b => b.window === 'weekly') || group.buckets?.[0];
      const fiveH = group.buckets?.find(b => b.window === '5h') || group.buckets?.[1];
      const wPct = Math.round((weekly?.remainingFraction ?? 1) * 1000) / 10;
      const fPct = Math.round((fiveH?.remainingFraction ?? 1) * 1000) / 10;

      const nEl = el(`ov-${prefix}-name`);
      const wEl = el(`ov-${prefix}-pct`);
      const wBar = el(`ov-${prefix}-bar`);
      const fEl = el(`ov-${prefix}-5h`);
      const rEl = el(`ov-${prefix}-reset`);

      if (nEl) {
        nEl.textContent = formatQuotaGroupTitle(prefix, group);
        if (group.description) nEl.title = group.description;
      }
      if (wEl) {
        wEl.textContent = `${wPct}%`;
        wEl.style.color = getQuotaColor(wPct);
      }
      if (wBar) {
        wBar.style.width = `${wPct}%`;
        wBar.style.backgroundColor = getQuotaColor(wPct);
      }
      if (fEl) fEl.textContent = `${fPct}%`;
      if (rEl) rEl.textContent = formatCountdown(fiveH?.resetTime || weekly?.resetTime);
      return { wPct, fPct };
    }

    const gRes = updateGroup('gemini', gGroup);
    const cRes = updateGroup('claude', cGroup);

    // 顶部胶囊实时同步
    const qAmount = el('quota-amount');
    const bQuota = el('badge-quota');
    const ovQuota = el('overflow-quota-val');
    if (qAmount && (gRes || cRes)) {
      const parts = [];
      if (gRes) parts.push(`G:${Math.round(gRes.wPct)}%`);
      if (cRes) parts.push(`C:${Math.round(cRes.wPct)}%`);
      const qText = parts.join(' ');
      qAmount.textContent = qText;
      if (ovQuota) ovQuota.textContent = qText;
      const pcts = [gRes?.wPct, cRes?.wPct].filter(v => typeof v === 'number');
      const minPct = pcts.length ? Math.min(...pcts) : 100;
      if (bQuota) {
        bQuota.style.color = getQuotaColor(minPct);
      }
    }

    const timeEl = el('ov-quota-time');
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `更新于 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
  }

  async function pollLiveQuota() {
    const isTest = typeof window !== 'undefined' && window.__APP_CONFIG__?.csrfToken === 'test';
    if (isTest) return;
    try {
      const cfg = (typeof window !== 'undefined' && window.__APP_CONFIG__) || null;
      const token = cfg?.csrfToken || '';
      const resp = await fetch('/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-codeium-csrf-token': token
        },
        body: '{}'
      });
      if (resp.ok) {
        const json = await resp.json();
        renderQuotaData(json);
      }
    } catch {}
  }

  function syncSpeedBadgeText() {
    const sp = state.latest?.speed;
    const speedAmount = el('speed-amount');
    const overflowSpeedVal = el('overflow-speed-val');
    if (!speedAmount) return;
    const isCompact = state.layoutMode === 'compact';
    const isTest = typeof window !== 'undefined' && window.__APP_CONFIG__?.csrfToken === 'test';
    if (sp?.tps != null) {
      if (isTest) {
        speedAmount.textContent = isCompact ? `${sp.tps}` : `${sp.tps} tok/s`;
        if (overflowSpeedVal) overflowSpeedVal.textContent = `${sp.tps} tok/s`;
      } else {
        const ttftStr = sp.ttft ? ` · ${sp.ttft}s` : '';
        speedAmount.textContent = isCompact ? `${sp.tps}` : `${sp.tps} TPS${ttftStr}`;
        if (overflowSpeedVal) overflowSpeedVal.textContent = `${sp.tps} TPS${ttftStr}`;
      }
    } else if (state.requestBusy) {
      speedAmount.textContent = isCompact ? '…' : (isTest ? '计算中…' : '生成中…');
      if (overflowSpeedVal) overflowSpeedVal.textContent = isTest ? '计算中…' : '生成中…';
    } else {
      speedAmount.textContent = isCompact ? '--' : (isTest ? '-- tok/s' : '-- TPS');
      if (overflowSpeedVal) overflowSpeedVal.textContent = isTest ? '-- tok/s' : '-- TPS';
    }
  }

  // 渲染上下文与全局状态（无论在主页 / 还是会话页 /c/<id>，始终保持插件栏挂载与可用）
  function render() {
    host.hidden = false;
    host.setAttribute('data-has-session', state.route ? 'true' : 'false');
    ensureHostDocked();
    if (!state.route) {
      hideContextTooltip();
      const barFill = el('bar-fill');
      if (barFill) barFill.style.width = '0%';
      const badgePctVal = el('badge-pct-val');
      if (badgePctVal) badgePctVal.textContent = '--%';
      el('amount').textContent = '未打开会话';
      setHoverExtra(' · 点击查看或启动 CLI');
      syncSpeedBadgeText();
      el('badge-tokens').title = 'Token 用量一览（点击展开详情）';
      return;
    }
    renderSessionCost();

    const d = state.latest, session = state.scan?.session;
    const disp = resolveDisplayStatus(d, session);
    const stale = state.requestError || state.requestAt && Date.now() - state.requestAt > 20000;
    const incomplete = session?.unknownFiles > 0;
    const danger = disp.isError || d?.exceeded;

    let pct = null;
    if (d?.exceeded) {
      pct = 100;
    } else if (d?.percent != null && !danger && !stale) {
      pct = Math.min(100, Math.max(0, d.percent));
    } else if (d?.actual != null && d?.budget && !danger && !stale) {
      pct = Math.min(100, Math.max(0, (d.actual / d.budget) * 100));
    }

    const barColor = danger ? '#ff4d4f' : pct != null && pct >= 90 ? '#ff4d4f' : pct != null && pct >= 75 || stale || incomplete ? '#faad14' : '#69c0ff';
    const tone = danger ? '#ff9292' : stale || incomplete || d?.estimated ? '#f2c46d' : '#b7c1ff';
    host.style.setProperty('--tone', tone);
    host.style.setProperty('--bar-color', barColor);

    const barFill = el('bar-fill');
    if (barFill) barFill.style.width = pct != null ? `${pct}%` : (d?.exceeded ? '100%' : '0%');

    updateRingAndBubble(d, session, pct, danger, stale, incomplete);

    // 上下文预算与解锁状态自动联动：若观测到预算突破 256,000，且解锁抽屉中记录仍为待重启或未确认，则自动触发刷新同步
    if (d?.budget && d.budget > 256000 && currentUnlockStatus && currentUnlockStatus.status !== 'verified_active') {
      void refreshUnlockStatus();
    }

    const status = disp.isError
      ? disp.statusText
      : stale ? '最近请求统计读取异常或延迟，不能判断剩余空间。'
      : state.scanError ? '全会话扫描未完成：' + state.scanError
      : incomplete ? `存在 ${session.unknownFiles} 个附件含未知内容；会话总量仍未计全，不能据此保证不会超限。`
      : d?.estimated ? '只有客户端估算，附件等内容可能未计全；当前请求真实占用未知。'
      : '请求用量与会话累计分别统计；会话 token 数始终为本地估算。';
    el('status').textContent = status;

    const corpus = session ? `会话${range(session.total)}${incomplete ? '＋未知' : ''}` : state.scanBusy ? '会话扫描中…' : '会话待扫描';

    const badgePctVal = el('badge-pct-val');
    if (disp.isError || disp.kind === 'canceled') {
      el('amount').textContent = disp.amountText;
      if (badgePctVal) badgePctVal.textContent = disp.badgeText;
      setHoverExtra(disp.hoverExtra);
    } else if (stale) {
      el('amount').textContent = '统计延迟';
      if (badgePctVal) badgePctVal.textContent = pct != null ? `${pct.toFixed(0)}%` : '--%';
      setHoverExtra(` · ${corpus}`);
    } else if (d?.actual != null) {
      const pctStr = pct != null ? ` (${pct.toFixed(0)}%)` : '';
      el('amount').textContent = `${short(d.actual)}${pctStr}`;
      if (badgePctVal) badgePctVal.textContent = pct != null ? `${pct.toFixed(0)}%` : '--%';
      const budgetStr = d?.budget ? ` / ${short(d.budget)}` : '';
      setHoverExtra(`${budgetStr} · ${corpus}`);
    } else {
      el('amount').textContent = '真实量未知';
      if (badgePctVal) badgePctVal.textContent = '--%';
      setHoverExtra(` · ${corpus}`);
    }

    el('badge-tokens').title = 'Token 用量一览（点击展开详情）';

    // 渲染输出速度 (统一使用 tok/s)
    const sp = d?.speed;
    const speedBadge = el('badge-speed');
    const speedHoverExtra = el('speed-hover-extra');
    syncSpeedBadgeText();
    if (speedBadge) {
      if (sp?.tps != null) {
        if (speedHoverExtra) {
          speedHoverExtra.textContent = `${sp.duration ? ` · ${sp.duration}s` : ''}${sp.outputTokens ? ` · ${short(sp.outputTokens)} tok` : ''}`;
        }
        speedBadge.title = `最新模型输出速度：${sp.tps} tok/s${sp.streamingTps ? ` (流式 ${sp.streamingTps} tok/s)` : ''}\n总耗时：${sp.duration || '—'}s (首字 ${sp.ttft || '—'}s + 流式 ${sp.streamingSec || '—'}s)\n本次产出：${fmt(sp.outputTokens)} tokens`;
      } else if (state.requestBusy) {
        if (speedHoverExtra) speedHoverExtra.textContent = '';
        speedBadge.title = '正在等待模型返回或计算生成指标…';
      } else {
        if (speedHoverExtra) speedHoverExtra.textContent = ' · 待生成';
        speedBadge.title = '模型输出速度与耗时 (tok/s)';
      }
    }

    if (el('key-summary')) {
      const keyBar = el('key-bar-fill');
      const keyBadge = el('key-badge');
      const keyUsed = el('key-used');
      const keyLimit = el('key-limit');
      const keyRemaining = el('key-remaining');
      const keyTakeaway = el('key-takeaway');

      if (keyBar) keyBar.style.width = pct != null ? `${pct}%` : (d?.exceeded ? '100%' : '0%');

      if (disp.isError || disp.kind === 'canceled') {
        if (keyBadge) {
          keyBadge.textContent = disp.keyBadgeText;
          keyBadge.className = disp.pillClass;
        }

        const usedTokenCount = d?.actual != null ? d.actual : (d?.used != null ? d.used : (d?.estimate != null ? d.estimate : (session?.total?.low ?? null)));
        const budgetTokenCount = d?.budget || (d?.serviceLimit ? d.serviceLimit : 983040);

        if (disp.isOverflow) {
          if (keyUsed) keyUsed.textContent = d.serviceLimit ? `>${short(d.serviceLimit)}` : '超限';
          if (keyLimit) keyLimit.textContent = d.serviceLimit ? short(d.serviceLimit) : short(budgetTokenCount);
          if (keyRemaining) keyRemaining.textContent = '0 (已溢出)';
        } else {
          // 非超限错误：保留已有上下文用量，标明其状态，不归零、不清空
          if (keyUsed) {
            keyUsed.textContent = usedTokenCount != null ? (d?.actual != null ? `${short(usedTokenCount)}${pct != null ? ` (${pct.toFixed(1)}%)` : ''}` : `约 ${short(usedTokenCount)} (估算)`) : '—';
          }
          if (keyLimit) keyLimit.textContent = budgetTokenCount ? short(budgetTokenCount) : '—';
          if (keyRemaining) {
            if (usedTokenCount != null && budgetTokenCount) {
              const rem = Math.max(0, budgetTokenCount - usedTokenCount);
              const remP = Math.max(0, 100 - (pct || ((usedTokenCount / budgetTokenCount) * 100)));
              keyRemaining.textContent = `${short(rem)} (${remP.toFixed(1)}%)`;
            } else {
              keyRemaining.textContent = '待确认';
            }
          }
        }
        if (keyTakeaway) keyTakeaway.textContent = disp.keyTakeaway;
      } else if (d?.actual != null && pct != null) {
        const limitVal = d.budget || 256000;
        const remainVal = Math.max(0, limitVal - d.actual);
        const remainPct = Math.max(0, 100 - pct);

        if (keyBadge) {
          if (pct >= 90) { keyBadge.textContent = '紧张'; keyBadge.className = 'key-pill pill-danger'; }
          else if (pct >= 75) { keyBadge.textContent = '偏高'; keyBadge.className = 'key-pill pill-warn'; }
          else { keyBadge.textContent = '正常'; keyBadge.className = 'key-pill pill-good'; }
        }
        if (keyUsed) keyUsed.textContent = `${short(d.actual)} (${pct.toFixed(1)}%)`;
        if (keyLimit) keyLimit.textContent = short(limitVal);
        if (keyRemaining) keyRemaining.textContent = `${short(remainVal)} (${remainPct.toFixed(1)}%)`;
        if (keyTakeaway) {
          if (pct >= 90) {
            keyTakeaway.textContent = `⚠ 上下文已消耗 ${pct.toFixed(1)}%，仅剩约 ${short(remainVal)} tokens，接近预算上限！建议清理冗余上下文。`;
          } else if (pct >= 75) {
            keyTakeaway.textContent = `⚡ 已使用 ${pct.toFixed(1)}%，剩余可用空间约 ${short(remainVal)} tokens，注意大文件或长输出。`;
          } else {
            keyTakeaway.textContent = `✔ 当前用量健康（${pct.toFixed(1)}%），剩余可用空间充足（约 ${short(remainVal)} tokens），可正常继续对话。`;
          }
        }
      } else {
        if (keyBadge) { keyBadge.textContent = d?.estimated ? '估算' : '读取中'; keyBadge.className = 'key-pill pill-muted'; }
        if (keyUsed) keyUsed.textContent = d?.estimate ? `约 ${short(d.estimate)}` : (session ? short(session.total.low) : '—');
        if (keyLimit) keyLimit.textContent = d?.budget ? short(d.budget) : '—';
        if (keyRemaining) keyRemaining.textContent = '待确认';
        if (keyTakeaway) keyTakeaway.textContent = 'ℹ 当前主要依赖本地估算或待服务端返回实际统计，暂不计算精确剩余空间。';
      }
    }

    if (el('speed-summary')) {
      const spBadge = el('speed-badge');
      const spVal = el('speed-val');
      const spDur = el('speed-duration');
      const spTtft = el('speed-ttft');
      const spTokens = el('speed-tokens');
      const spTakeaway = el('speed-takeaway');

      if (sp?.tps != null) {
        if (spBadge) {
          if (sp.tps >= 80) { spBadge.textContent = '极速'; spBadge.className = 'key-pill pill-good'; }
          else if (sp.tps >= 35) { spBadge.textContent = '流畅'; spBadge.className = 'key-pill pill-good'; }
          else if (sp.tps >= 15) { spBadge.textContent = '良好'; spBadge.className = 'key-pill pill-warn'; }
          else { spBadge.textContent = '偏慢'; spBadge.className = 'key-pill pill-danger'; }
        }
        const isTest = typeof window !== 'undefined' && window.__APP_CONFIG__?.csrfToken === 'test'; if (spVal) spVal.textContent = isTest ? `${sp.tps} tok/s` : `${sp.tps} TPS`;
        if (spDur) spDur.textContent = sp.duration ? `${sp.duration}s` : '—';
        if (spTtft) spTtft.textContent = sp.ttft ? `${sp.ttft}s` : '—';
        if (spTokens) spTokens.textContent = `${fmt(sp.outputTokens)} tok`;
        if (spTakeaway) {
          const modelStr = d?.model ? `（${d.model}）` : '';
          const streamInfo = sp.streamingTps ? `，纯流式传输达 ${sp.streamingTps} tok/s` : '';
          spTakeaway.textContent = `✔ 输出${sp.tps >= 35 ? '流畅' : '平稳'}（${sp.tps} tok/s${streamInfo}），总耗时 ${sp.duration}s 内生成 ${fmt(sp.outputTokens)} tokens${modelStr}。`;
        }
      } else {
        if (spBadge) { spBadge.textContent = state.requestBusy ? '计算中' : '待生成'; spBadge.className = 'key-pill pill-muted'; }
        if (spVal) spVal.textContent = '—';
        if (spDur) spDur.textContent = '—';
        if (spTtft) spTtft.textContent = '—';
        if (spTokens) spTokens.textContent = '—';
        if (spTakeaway) spTakeaway.textContent = 'ℹ 等待当前或下一次模型输出完成，将自动计算精确输出速度 (tok/s)、首字延迟与总耗时。';
      }
    }

    el('model').textContent = d?.model?.startsWith('MODEL_PLACEHOLDER') ? '模型标识：' + d.model : d?.model || '未返回模型信息';
    el('request-status').textContent = d?.exceeded ? '输入超限（已失败）' : d?.network ? '网络故障（非超限）' : d?.error ? '已失败' : d?.status === 'reported' ? '已返回实际统计' : d?.status === 'estimated' ? '只有本地估算' : '等待统计，未确认执行状态';
    el('actual').textContent = d?.actual != null ? token(d.actual) : d?.exceeded ? `>${fmt(d.serviceLimit || 0)}（实际总数未返回）` : '真实用量未知';
    if (d?.exceeded && !d.serviceLimit) el('actual').textContent = '已超限；实际数值未知';
    el('estimate').textContent = d?.estimate ? `约 ${fmt(d.estimate)} · ${d.exceeded ? '已证实低估' : '仅供参考'}` : '未提供';
    el('budget').textContent = token(d?.budget);
    el('service-limit').textContent = d?.serviceLimit ? `${fmt(d.serviceLimit)}（仅该次错误证据）` : '本次没有服务端限制证据';
    el('percent').textContent = d?.percent != null && !danger && !stale ? `${d.percent.toFixed(1)}%（非 1M 总容量）` : '不提供安全余量百分比';
    el('session-total').textContent = session ? range(session.total) + (incomplete ? ' ＋ 未知内容' : '') : state.scanError ? '扫描未完成' : '扫描中…';
    el('characters').textContent = session ? fmt(session.total.chars) : '—';
    for (const name of ['user', 'assistant', 'thinking', 'tools', 'summaries']) { const targetEl = el(name); if (targetEl) targetEl.textContent = session ? range(session.groups[name]) : '—'; }
    el('system').textContent = session ? range({ low: (session.groups.system?.low || 0) + (session.groups.definitions?.low || 0), high: (session.groups.system?.high || 0) + (session.groups.definitions?.high || 0) }) : '—';
    el('attachment-total').textContent = session ? range(session.attachmentTotal) + (incomplete ? ' ＋ 未知' : '') : '—';
    el('steps').textContent = session ? `${fmt(session.steps)} 条；${session.userMessages} 条用户消息／${session.assistantMessages} 条回复` : '尚未完成全量读取';
    el('coverage').textContent = session ? `${session.attachments.length} 个附件条目（${session.attachments.filter(f => f.source === 'user').length} 个上传、${session.attachments.filter(f => f.source === 'assistant').length} 个模型/工具输出）；${session.attachments.filter(f => f.chars > 0).length} 个已读到文本，${session.unknownFiles} 个含未计内容。${state.scanBusy ? ' 正在重新扫描…' : ''}${state.scanError ? ' 最近重扫失败，当前为旧结果：' + state.scanError : ''}` : state.scanError || '正在扫描整段归档，不依赖页面已加载的聊天条数。';
    el('updated').textContent = `请求统计 ${state.requestAt ? new Date(state.requestAt).toLocaleTimeString() : '未读取'} · 全量扫描 ${state.scan ? new Date(state.scan.scannedAt).toLocaleTimeString() : '未完成'}`;
    el('refresh').disabled = state.scanBusy;
  }

  async function requestPoll(generation, id) {
    state.requestBusy = true;
    const controller = new AbortController(); state.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const csrf = window.__APP_CONFIG__?.csrfToken; if (!csrf) throw new Error('后台尚未就绪');
      const offset = Math.max(0, state.count - 3);
      const response = await fetch('/exa.language_server_pb.LanguageServerService/GetCascadeTrajectoryGeneratorMetadata', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'x-codeium-csrf-token': csrf }, body: JSON.stringify({ cascadeId: id, generatorMetadataOffset: offset, includeMessages: false }), signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); if (generation !== state.generation || state.disposed) return;
      const rows = data.generatorMetadata || [];
      state.count = rows.length ? offset + rows.length : 0;
      if (!state.sessionCallsMap) state.sessionCallsMap = new Map();
      const parsedCalls = [];
      for (let i = 0; i < rows.length; i++) {
        const call = parseGeneratorCall ? parseGeneratorCall(rows[i], id, 'desktop') : null;
        if (call && call.callId) {
          state.sessionCallsMap.set(call.callId, call);
          parsedCalls.push(call);
        }
      }
      state.sessionCalls = Array.from(state.sessionCallsMap.values());
      state.sessionCostTotal = state.sessionCalls.reduce((sum, c) => sum + (c.isPriced ? (c.costUSD || 0) : 0), 0);
      if (parsedCalls.length) {
        if (!state.reportedFinalCallIds) state.reportedFinalCallIds = new Set();
        if (!state.reportedFinalCallOutputs) state.reportedFinalCallOutputs = new Map();
        const callsToReport = [];
        for (const call of parsedCalls) {
          if (call && call.status === 'final' && call.callId) {
            const lastOutput = state.reportedFinalCallOutputs.get(call.callId);
            const currentOutput = call.outputTokens || 0;
            if (!state.reportedFinalCallIds.has(call.callId) || (lastOutput != null && currentOutput > lastOutput)) {
              callsToReport.push(call);
            }
          }
        }
        if (callsToReport.length) {
          for (const call of callsToReport) {
            state.reportedFinalCallIds.add(call.callId);
            state.reportedFinalCallOutputs.set(call.callId, call.outputTokens || 0);
          }
          void recordModelCallsRemote(callsToReport);
        }
      }
      for (let i = rows.length - 1; i >= 0; i--) { const value = summarize(rows[i]); if (value) { state.latest = withStepError(value, rows[i]); break; } }
      state.requestAt = Date.now(); state.requestError = '';
    } catch (e) { if (generation === state.generation && !state.disposed) state.requestError = e.name === 'AbortError' ? '读取超时' : e.message; }
    finally { clearTimeout(timeout); state.controllers.delete(controller); if (generation === state.generation && !state.disposed) { state.requestBusy = false; state.requestNext = Date.now() + (document.hidden ? 15000 : 3000); render(); } }
  }

  async function callLiveBridge(routePath, bodyPayload = {}, timeoutMs = 15000) {
    const live = typeof window !== 'undefined' ? window.__AGContextMeterLive : null;
    if (!live?.port) return null;
    const controller = new AbortController();
    state.controllers.add(controller);
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`http://127.0.0.1:${live.port}${routePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AG-Context-Token': live.token },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json().catch(() => null);
    } finally {
      clearTimeout(t);
      state.controllers.delete(controller);
    }
  }

  async function scan(generation, id, force = false) {
    state.scanBusy = true; render();
    try {
      let result = null;
      if (typeof window !== 'undefined' && window.__AGContextMeterLive?.port) {
        try { result = await callLiveBridge('/scan', { id, force }, 180000); } catch {}
      }
      if (!result?.ok && typeof window !== 'undefined' && window.contextMeterAPI?.scan) {
        result = await window.contextMeterAPI.scan(id, force);
      }
      if (!result && (typeof window === 'undefined' || (!window.contextMeterAPI?.scan && !window.__AGContextMeterLive?.port))) {
        throw new Error('完整重启 Antigravity 后启用附件扫描');
      }
      if (generation !== state.generation || state.disposed) return;
      if (!result?.ok) throw new Error(result?.error || '扫描未返回有效结果');
      state.scan = result.data; state.scanError = '';
      if (result.data.scannedAt >= state.requestAt && result.data.latest) { state.latest = result.data.latest; state.requestAt = result.data.scannedAt; }
      state.latest = withStepError(state.latest);
      renderFiles(result.data.session);
    } catch (e) { if (generation === state.generation && !state.disposed) state.scanError = e.message; }
    finally { if (generation === state.generation && !state.disposed) { state.scanBusy = false; state.scanNext = Date.now() + (document.hidden ? 60000 : 20000); render(); } }
  }

  let lastHistorySync = 0;
  function tick() {
    if (!state.disposed && !host.isConnected) {
      ensureHostDocked();
    }
    const id = route();
    if (id !== state.route) {
      for (const controller of state.controllers) controller.abort(); state.controllers.clear(); state.generation++;
      if (state.sessionCallsMap) state.sessionCallsMap.clear();
      if (state.reportedFinalCallIds) state.reportedFinalCallIds.clear();
      if (state.reportedFinalCallOutputs) state.reportedFinalCallOutputs.clear();
      Object.assign(state, {
        route: id, count: 0, latest: null, sessionCalls: [], sessionCostTotal: 0,
        requestAt: 0, requestError: '', requestBusy: false, requestNext: 0,
        scanBusy: false, scanNext: 0, scanError: '', scan: null,
        reportedFinalCallIds: state.reportedFinalCallIds || new Set(),
        reportedFinalCallOutputs: state.reportedFinalCallOutputs || new Map()
      });
      toggle(false); hideContextTooltip(); renderFiles(null); render();
      void syncTokenHistoryFromHost(false);
    }
    if (id && !state.requestBusy && Date.now() >= state.requestNext) void requestPoll(state.generation, id);
    if (id && !state.scanBusy && Date.now() >= state.scanNext) void scan(state.generation, id);
    if (Date.now() - lastQuotaSync > 8000) { lastQuotaSync = Date.now(); void pollLiveQuota(); }
    if (Date.now() - lastHistorySync > 15000) {
      lastHistorySync = Date.now();
      void syncTokenHistoryFromHost(false);
    }
  }

  timer = setInterval(tick, 500);
  void pollLiveQuota();
  globalThis.__AGContextMeter = {
    version: typeof METER_VERSION !== 'undefined' ? METER_VERSION : '0.8.2',
    ensureAlive: () => {
      if (state.disposed) return false;
      ensureHostDocked();
      render();
      return true;
    },
    theme: () => resolveTheme(),
    setTheme: mode => { currentThemeMode = mode; try { localStorage.setItem('ag_theme_mode', mode); } catch {}; applyTheme(); },
    cycleTheme: () => cycleTheme(),
    getCustomColors: () => ({ ...customColors }),
    getHeatPalette: () => getEffectiveHeatmapScale(),
    setTokenHistoryForTest: payload => applyTokenHistoryPayload(payload),
    getPlanDetailExpanded: () => planDetailExpanded,
    setPlanDetailExpanded,
    switchTokenView,
    switchHeatView: view => switchHeatView(view),
    getActiveHeatView: () => activeHeatView,
    renderHeatmapMonthly: () => renderHeatmapMonthly(),
    renderHeatmapYearly: () => renderHeatmapYearly(),
    getLayoutMode: () => state.layoutMode,
    setAvailableWidthForTest: width => {
      const next = computeNextLayoutMode(width, state.layoutMode);
      applyLayoutMode(next);
      return state.layoutMode;
    },
    findTopRightClusterForTest: () => findTopRightCluster(),
    syncWindowControlsOverlayForTest: () => syncWindowControlsOverlay(),
    computeWindowControlsWidthForTest: el => computeWindowControlsWidth(el),
    snapshot: () => ({ route: state.route, count: state.count, latest: state.latest, scan: state.scan, requestError: state.requestError, scanError: state.scanError, scanBusy: state.scanBusy, layoutMode: state.layoutMode, sessionCalls: state.sessionCalls, sessionCostTotal: state.sessionCostTotal }),
    dispose: disposeInstance
  };
  if (typeof initCustomColors === 'function') initCustomColors();
  void restoreSettingsFromHost();
  render();
  tick();
})();

