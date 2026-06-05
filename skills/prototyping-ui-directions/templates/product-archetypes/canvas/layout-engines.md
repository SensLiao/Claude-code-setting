---
name: uiux-canvas-layout-engine
description: Structured / Organic / Preserve 三模式布局编排。Living Canvas 专项 2/4。
type: workflow
stage: 1
parent: living-canvas-pack
status: stub
---

# Canvas Layout Engine — Stub

## 责任边界
**只**编排布局算法。不定义交互（→ `living-canvas-interaction.md`）、不定义 zoom（→ `semantic-zoom-system.md`）、不定义动效细节（→ `creative-motion-governor.md`）。

## 三模式

| 模式 | 库 / 算法 | 适用 |
|------|----------|------|
| Structured | dagre / d3-hierarchy / elk（React Flow 官方 auto-layout 示例可切换） | 审批链、有向 flow、层次结构 |
| Organic | d3-force + forceCollide（D3 force simulation） | module 内局部组织、轻微回弹 |
| Preserve | 自研策略层（不是第三方库） | 用户已手动整理过的画布；只对新增 / 未定位节点局部整理 |

## 不允许
- 全局统一套一种算法
- 在 Preserve 模式下触发 Auto-layout Morph（违反 Preserve 语义）

## 执行者
- Claude subagent (Task)，model: opus

## Done 条件
- 三模式各一份决策树（"什么时候用哪个算法、何时切换"）
- 与 React Flow viewport / nodesDraggable / fitView 钩子的集成约定
- 与 Pattern × Layout Mode 兼容矩阵（在 `living-canvas-interaction.md`）保持一致
