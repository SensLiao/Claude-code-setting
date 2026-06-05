---
name: uiux-surface-architecture
description: 通用工具型 sub-skill — Stage 0 末和 Stage 2 末用它把"产品有哪些主要 surface"列清楚，喂给 Stage 3 决定要生成哪些 HTML 文件。
type: workflow-tool
used_by: [stage0-idea-intake, stage2-research-analysis, stage3-prototype-package]
---

# Surface Architecture — 通用工具

## 责任边界

- Stage 0：在 idea brief 里给出"产品主要 surface 列表"（最少 1 个主入口 + N 个核心 surface）
- Stage 2：根据 direction 候选可能调整 surface 列表（某些 direction 要新增 surface 才能体现风格差异）
- Stage 3：每个 surface 对应一份 HTML 文件

## 通用 surface 类型清单

不同产品类型常见的 surface 类型（不强制选，只给灵感）：

| 类型 | 示例 |
|------|------|
| 主入口 (landing / home) | 第一眼看到的产品门面 |
| 列表 / 库 (list / library) | 多个对象的浏览页 |
| 详情 (detail) | 单个对象的详情页 |
| 编辑 / 工作面 (editor / workspace) | 用户在做事的页面 |
| 仪表盘 (dashboard) | 数据 / 状态汇总 |
| 设置 (settings) | 配置 / 偏好 |
| 弹层 / 抽屉 (overlay / drawer) | 二级交互层 |
| 空状态 / 引导 (empty / onboarding) | 新用户 / 无数据时 |

按产品类型选合适的，不强求全有。

## Surface Map schema

详见 `templates/surface-purpose-matrix.md`。每个 surface 必须含：

- name（短小、用产品语义命名，不要 generic 名字）
- 主要做什么
- 谁会看到
- 关键状态（默认 / 选中 / loading / 空 / 错）
- 优先级 P0 / P1 / P2 （决定 Stage 3 是否一定要生成它）

## 数量上限

- 最少：1 个（仅主入口）
- 建议：3-5 个（主入口 + 2-4 个核心 surface）
- 上限：8（再多 Stage 3 一个 variant 写不完，分批做 better）

## 不允许

- 一开始就要求 8+ surface
- surface 名字用 "Page1 / View2" 这种 generic
- 不给关键状态
