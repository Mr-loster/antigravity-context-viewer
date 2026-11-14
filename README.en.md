# Antigravity Minimalist Context & Quota Viewer

> A tailored, minimalist status & quota dashboard designed for **Google Antigravity 2.x**. Pinned directly to the top navigation bar, focusing only on core metrics with zero visual clutter.

---

## 🌟 Core Features

This project pursues **minimalism, restraint, high information density, and clean visual aesthetics**, retaining and refining only 4 core capabilities:

1. **💬 Current Conversation Context Occupancy**
   - **Topbar Capsule**: Circular ring progress indicator + occupancy percentage (e.g., `76%`), dynamic alert colors for warning/overflow;
   - **Panel Breakdown**: Real-time display of used tokens, context budget ceiling (`256K`), remaining tokens and percentage, with input, cache read, and output breakdown.

2. **⚡ Generation Speed (TPS) & Time to First Token (TTFT)**
   - **Topbar Indicator**: Real-time output speed and first-token latency (e.g., `32.7 TPS · 3.5s`);
   - **Panel Breakdown**: Detailed metrics for generation speed (TPS), TTFT, total generation duration, and output tokens.

3. **🛡️ Official Model Quota Monitor**
   - **Native Integration**: Same-origin millisecond-level silent sync, zero external Python process or port overhead;
   - **Dynamic Topbar Pill**: `🛡️ G:97% C:86%` dynamic status pill;
   - **Gemini Models** (3.8 Flash / Pro): Weekly limit remaining progress bar & percentage + reset countdown; 5-hour limit remaining + refresh countdown;
   - **Claude & GPT Models** (Sonnet / Opus / GPT): Weekly limit remaining progress bar & percentage + reset countdown; 5-hour limit remaining + refresh countdown.

4. **📊 Token Activity Heatmap**
   - **Summary Cards**: Total processed tokens, today's usage, this month's usage, this year's usage;
   - **52-Week Activity Heatmap**: Clean GitHub-style grid supporting **Daily / Weekly / Monthly / Yearly / Cumulative** views, hover tooltips for exact dates and token compositions;
   - **Source Filter**: Filter by All, Desktop Client, or CLI terminal.

---

## ✂️ Minimalist Redesign (Removed Bloat)

Compared to the original upstream project, this version has been thoroughly streamlined:
- ❌ **Removed fiat currency and pricing conversions**: Removed API cost estimations, USD/CNY conversions, and subscription price comparisons;
- ❌ **Removed file AST / deep scanner tables**: Removed Office/PDF/code scanning metadata;
- ❌ **Removed secondary drawers**: Removed CLI launcher, network proxy toggles, language translation switchers, and binary unlock drawers;
- ✅ **Ultra-compact UI**: Everything is presented in 1 topbar capsule cluster and 2 instantly toggleable minimalist panels.

---

## 🚀 Quick Start

### 🤖 For AI Agents
If you ask an AI assistant inside Antigravity to install this repo, simply say:
> **"Read this repository and run `node cli.js install` to install it for me"**

```bash
# 1. Persistent injection + CDP live hot-reload for current running window
node cli.js install

# 2. Check current status
node cli.js status
```

### 💻 Manual CLI Installation
```bash
git clone https://github.com/Mr-loster/antigravity-context-viewer.git
cd antigravity-context-viewer

node cli.js install
node cli.js status

# To restore
node cli.js restore
```

---

## 🤝 Acknowledgements & Credits

Special thanks to the open-source community:

* **[@elviscjn-cjn](https://github.com/elviscjn-cjn)**: This project is a tailored, minimalist fork built upon **[antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer)**. Its excellent context inspection architecture, token history aggregation engine, and zero-dependency ASAR engine laid a solid foundation for this project. We express our sincere respect and gratitude!
* **LINUX DO Community**: Thanks to all experts and members for their experience sharing and discussions.

Licensed under [MIT](LICENSE).
