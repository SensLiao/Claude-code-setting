# Runtime Stack — Sample Pipeline 用什么

> 本 skill 的输出物是**纯 HTML / CSS / JS 样本**。不假设 React / 任何 framework，也不假设构建工具。
>
> 任何 archetype 模板可以推荐自己的运行时（如 canvas archetype 推荐 React Flow + Motion），但**主流程不绑死**。

## 默认（无 framework）

- **HTML 5** + 现代 **CSS**（custom properties / clamp / oklch / container queries / `:has()` 都可以用）
- **vanilla JS**（按需 `<script>` 标签直接写）
- 调色板用 **CSS custom properties** 在 `assets/tokens.css` 里集中定义
- 字体走 Google Fonts CDN 或 local subset（在 readme 里说明）

这是默认。每个 variant 不带构建步骤就能在浏览器里打开看。

## 可选增强（按 archetype 加载）

如果 Stage 0 加载了某个 archetype，对应运行时会被推荐加进 variant：

### Canvas archetype（`templates/product-archetypes/canvas/`）
- **React Flow** (xyflow) — node-based UI
- **Motion** (Framer Motion) — `layout` / `layoutId` / `AnimatePresence`
- **dagre / d3-hierarchy / elk** — auto-layout
- **d3-force + forceCollide** — organic layout

但即便加载了 canvas archetype，**variant HTML 仍允许用 vanilla 写**。Archetype 是知识库，不是强依赖。

### 其他 archetype（占位中）
- game-style → Pixi.js / Three.js / GSAP（占位）
- bubble-physics → matter.js（占位）
- data-dashboard → D3 / observablehq plot / echarts（占位）
- landing-marketing → 通常 vanilla 即可
- narrative-scrolly → GSAP ScrollTrigger / scrollama（占位）

## 选型纪律

- 不允许在一个 variant 里同时上 React + Vue（混框架）
- 不允许把 archetype 推荐运行时**强加**给不需要的产品
- 任何外部依赖必须在 variant 的 readme.md 里写明（版本 + 用途 + license）
- 字体在 readme 里写清来源 + license

## 验收（Stage 3 gate 内）

- HTML 在 Chrome / Firefox / Safari 任一最新版能打开（首选 Chrome）
- 无 console error
- 无 broken external resource（字体 / 图片 / CDN 链接）
- 没有依赖 Node / 构建步骤就能打开（archetype 内部例外，要在 readme 写明）
