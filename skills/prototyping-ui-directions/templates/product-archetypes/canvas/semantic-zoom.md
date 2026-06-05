---
name: uiux-semantic-zoom-system
description: Z0–Z4 可视内容策略。Living Canvas 专项 3/4。
type: workflow
stage: 1
parent: living-canvas-pack
status: stub
---

# Semantic Zoom System — Stub

## 责任边界
**只**定义每个 zoom 层级看到什么。不定义 zoom 动画（→ `creative-motion-governor.md`）、不定义 zoom 触发交互（→ `living-canvas-interaction.md` Pattern 9）。

## 层级建议（待定，需 Stage 0 确认阈值）

| 层级 | 缩放范围（建议） | 节点可视内容 |
|------|----------------|------------|
| Z0 — Galaxy | < 30% | 仅 module hull + 少量数字徽章 |
| Z1 — Cluster | 30-60% | module hull + 节点 icon + 数量 |
| Z2 — Node | 60-100% | 节点 title + 状态 dot + 一行摘要 |
| Z3 — Detail | 100-160% | 节点全字段（除长描述） |
| Z4 — Inspector | > 160% | 全字段 + 边描述 + 内嵌图表 |

## 不允许
- 简单 CSS scale 而不切换内容
- 在 Z0 / Z1 还显示完整文字（违反"galaxy"的可读性）
- 跨层级 crossfade > 120ms

## 执行者
- Claude subagent (Task)，model: opus

## Done 条件
- 5 层级阈值冻结
- 每层级一份"该层级该显示什么"的契约
- 与 React Flow `getZoom()` / `useStore` 的集成约定
