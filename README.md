# Antigravity 极简上下文与模型配额监控看板 (Minimalist Context & Quota Viewer)

> 专为 **Google Antigravity 2.x** 打造的极简桌面端状态与配额看板。直接常驻于客户端顶部导航栏，聚焦核心指标，杜绝多余干扰。

---

## 🌟 核心特性 (Core Features)

本项目追求**极简、克制、高信息密度与纯粹的视觉美感**，仅保留并深度打磨以下 4 项核心能力：

1. **💬 当前会话上下文占用**
   - **顶栏胶囊**：小圆环环形进度条 + 占用百分比（如 `76%`），超限/紧张时自动变换警示色；
   - **看板明细**：直观展示已用 Token、预算上限（`256K`）、剩余可用 Token 及比例，清晰划分输入、缓存读取与输出构成。

2. **⚡ 生成速度 (TPS) 与首字延迟 (TTFT)**
   - **顶栏常驻**：实时显示模型生成速度与首字响应延迟（如 `32.7 TPS · 3.5s`）；
   - **看板明细**：详细统计生成速度 (TPS)、首字延迟 (TTFT)、总生成耗时与本次输出 Token 统计。

3. **🛡️ 官方模型配额余量监控 (Quota Monitor)**
   - **深度融合原生配额体系**：同源毫秒级极速静默同步，零额外 Python 后台进程与端口开销；
   - **顶栏动态指示**：`🛡️ G:97% C:86%` 动态余量胶囊；
   - **Gemini Models**（3.8 Flash / Pro）：周额度余量进度条与百分比 + 刷新倒计时；5小时限额余量与重置倒计时；
   - **Claude & GPT Models**（Sonnet / Opus / GPT）：周额度余量进度条与百分比 + 刷新倒计时；5小时限额余量与重置倒计时。

4. **📊 历次 Token 消耗热力图 (Activity Heatmap)**
   - **核心统计卡片**：累计处理总量 (Total)、今日使用 (Today)、本月使用 (Month)、今年使用 (Year)；
   - **52 周活跃热力图**：纯正 GitHub 风格网格，支持**每天 / 每周 / 每月 / 今年 / 累计总量**自由切换，鼠标悬浮显示精确日期与用量构成；
   - **多端来源筛选**：支持按全部来源、桌面客户端、CLI 终端一键过滤。

---

## ✂️ 极简化重构（剔除所有冗余功能）

与原版相比，本版本进行了深度精简与提纯，剔除了所有非核心及复杂干扰功能：
- ❌ **移除复杂的法币账单折算**：去除 API 参考金额、汇率转换（USD/CNY）、订阅实付对比等冗余计算，回归纯粹的 Token 与物理额度监控；
- ❌ **移除文件底层安全审计**：去除 Office/PDF/代码扫描等底层元数据表格；
- ❌ **移除无关二级抽屉**：去除 CLI 终端启动器、网络代理配置、语言切换抽屉与底层上下文加长补丁等复杂配置；
- ✅ **界面尺寸更紧凑**：去除多余层级，所有信息在 1 个顶栏指标组与 2 个可自由互切的极简面板中瞬间呈现。

---

## 🚀 快速开始与一键安装 (Quick Start)

### 🤖 给 AI 智能体的一键指令 (For AI Agents)
如果你在 Antigravity 内让 AI 智能体安装，只需对 AI 说：
> **“读取本仓库，执行 `node cli.js install` 帮我安装”**

```bash
# 1. 持久化注入 + 当前运行窗口 CDP 免重启即时热生效
node cli.js install

# 2. 查看当前安装与会话上下文运行状态
node cli.js status
```

### 💻 终端手动安装与常用命令
```bash
# 克隆仓库
git clone https://github.com/Mr-loster/antigravity-context-viewer.git
cd antigravity-context-viewer

# 一键安装（ASAR 持久化注入 + 运行中窗口免重启热挂载）
node cli.js install

# 仅对当前运行中窗口进行热重载（开发/调试时使用）
node cli.js live

# 查看安装与当前会话上下文状态
node cli.js status

# 执行自检与诊断（macOS / Windows / Linux 全平台支持）
node cli.js check

# 如需无损还原卸载
node cli.js restore
```

---

## 🛠️ 开发构建与测试 (Development & Testing)

本项目纯原生 Node.js 实现（要求 Node.js `>= 22.4.0`），零外部 npm 运行时依赖：

```bash
# 重新打包构建极简渲染层产物 (src/renderer -> meter-renderer.js)
npm run build:renderer

# 构建并运行全量单元与集成回归测试（63 项测试）
npm test
```

> **架构与稳定性优化**：
> - **全平台自适应**：自动识别 macOS (`~/Library/Application Support/Antigravity`)、Windows (`%APPDATA%\Antigravity`) 与 Linux (`~/.config/Antigravity`) 数据及 DevTools 端口路径；
> - **免重启热重载与自愈机制**：内置多实例清理与僵尸 DOM 防重插守卫，执行 `node cli.js install` 或 `node cli.js live` 时可无感热更新当前窗口，不留残留组件。

---

## 📁 仓库核心结构

```text
antigravity-context-viewer/
├── asar-engine.js            # 原生零依赖 Node.js ASAR 解包/打包引擎
├── cli.js                    # 统一命令行入口 (install / live / status / check / restore)
├── install.js                # ASAR 注入与运行时热挂载调度器
├── live-host.js              # 运行中窗口免重启 CDP 实时桥接宿主
├── local-api.js              # 跨平台 DevTools / 本地语言服务通信模块
├── meter-collector.js        # 会话上下文、历史 Token 与设置持久化采集引擎
├── meter-core.js             # 上下文占比、速度计算与热力图核心纯函数
├── meter-main.js             # Electron 主进程预加载与 IPC 桥接注入脚本
├── restore.js                # 原始备份校验与无损还原器
├── meter-renderer.js         # 极简渲染层构建产物
├── meter-core.test.js        # 核心算法与数据聚合单元测试
├── meter-integration.test.js # 热挂载、跨平台及渲染回归集成测试
├── src/renderer/             # 极简渲染层源码
│   ├── main.js               # 状态调度、Quota 配额轮询、顶栏联动与热更新自愈
│   ├── template.html         # 极简双看板 Shadow DOM 结构
│   ├── styles.css            # 紧凑玻璃拟态样式与深浅主题自适应
│   ├── colors.js             # 主题色板、Hex/RGB 转换与对比度工具
│   └── heatmap.js            # 52周活跃热力图与峰值/聚合指标渲染引擎
└── scripts/
    └── build-renderer.js     # 纯 Node.js 渲染层自动构建脚本
```

---

## 🤝 致谢与开源协议 (Acknowledgements & Credits)

本项目的诞生离不开开源社区的优秀探索与贡献，在此特别致谢：

* **[@elviscjn-cjn](https://github.com/elviscjn-cjn)**：本项目基于其开源的 **[antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer)** 进行了二次精炼重构与定制开发。其优秀的上下文抓取架构、Token 历史聚合引擎与 ASAR 原生打包设计为本项目奠定了坚实的基础，在此致以诚挚的敬意与感谢！
* **LINUX DO 社区**：感谢社区内各位技术专家的经验分享与交流探讨。

本项目遵循 [MIT 许可证](LICENSE) 开源。
