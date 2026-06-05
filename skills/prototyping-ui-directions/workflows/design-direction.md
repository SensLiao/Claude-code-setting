---
name: uiux-design-direction
description: 通用工具型 sub-skill — 被 Stage 2 调用收敛 direction 候选；Stage 3 用 direction 驱动每个 variant 生成。
type: workflow-tool
used_by: [stage2-research-analysis, stage3-prototype-package]
---

# Design Direction — 通用工具

## 责任边界

- **Stage 2**：把 extract cards + cross-reference matrix 收敛成 N 个 direction 候选（≥3，≤5）
- **Stage 3**：每个 direction 驱动一个 variant；本工具负责确保 direction 的 palette / typography / motion 在 variant HTML 里被忠实落地

## 差异化硬指标

一个合格的 direction 候选集必须满足：

| 维度 | 要求 |
|------|------|
| Palette tone | 至少出现 2 种 tone（暖 / 冷 / 中性 / 高饱和 / 低饱和） |
| Density | 至少出现 2 种密度（spacious / compact） |
| Motion stance | 至少出现 2 种取向（minimal / generous） |
| Perspective | 至少出现 2 种主视角 / 主入口设计 |

不满足 → 强制再补一个反方向候选。

## Direction 候选 schema

详见 `templates/direction-candidate.md`。每份必须含：

- palette tokens（具体值，不写"暖色调"）
- typography stack（家族 + scale）
- motion stance（具体 ms + budget）
- perspective stance（主入口 2-3 行描述）
- dimension fit 自评（vs Stage 0 weight）
- borrowing-from（每个 vendor 借了什么）
- 不适合的场景

## 与 companion skill 的配合

- `design-system` 装了 → 可以让它从 58 个真实 brand 里挑相近候选作为输入
- `competitive-teardown` 装了 → 可以让它做"用户产品在市场上应该取什么 positioning"的输入

没装也能跑（主线程从 extract cards 直接收敛）。

## 不允许

- 用"暖色调 / 低密度 / 优雅 / 现代"这种空词当 direction 描述
- 三个候选其实是同一个调色板换 3 个 accent
- 不写"不适合的场景"
