---
name: uiux-stage0-idea-intake
description: Stage 0 — 跟用户对齐"做什么类型产品 / 关注哪些 dimension / 加载哪个 archetype"。产物：idea-brief.md + dimension-priorities + archetype-choice。
type: workflow
stage: 0
gate: gates/stage0-exit.md
---

# Stage 0 — Idea Intake

## 目的

把用户脑袋里模糊的"我想做一个 X"变成一份**可以驱动后续 3 个阶段**的 idea brief。**不**做技术决策、**不**敲定调色板、**不**列具体 reference URL（那是 Stage 1 的事）。只做三件事：

1. 确认产品类型与情境
2. 确认这次重点关注哪些 dimension
3. 决定是否加载 product archetype 的知识库模板

## 流程

### Step 1 · 用户讲 idea

用主线程问答（如果装了 `grill-with-docs`，建议拉它进来压模糊点）：

```
Q1. 一句话说你想做什么？
Q2. 给谁用？什么场景？
Q3. 你脑子里有没有"看起来像 X"或"感觉像 X"的参考？（不要 URL，给个氛围）
Q4. 这次输出物你打算怎么用？（投资人 demo / 设计探索 / 给工程团队做参照 / 个人作品）
```

不强行追问到锁死。Stage 0 出"足够清晰"即可，不是"完美"。

### Step 2 · 选 dimension 权重

参考 `references/analysis-dimensions.md` 给六个 dimension：

- **Visual** — 颜色 / 字体 / 层次 / 质感
- **Interaction** — 核心动作 / 状态 / 键盘
- **Motion** — 动效场景 / 节奏 / 减动效
- **Perspective** — 信息架构 / 视角 / 用户路径
- **Accessibility** — WCAG / 减动效 / 键盘
- **Responsive** — breakpoints / 触屏 / 密度

让用户给每个 dimension 打 1-5 分（重视度）。**默认值**：全 3。让用户改它觉得高/低于 3 的。

### Step 3 · 决定 archetype

读 `templates/product-archetypes/` 里有的目录（不是 stub）。当前可加载：

- `canvas/` — 节点 / 白板 / 流程编辑器（10 pattern + 6 铁律 + layout / zoom / motion）

未来扩展中（在 `_future-stubs/`，不能直接加载）：

- game-style / bubble-physics / creative-eye / data-dashboard / landing-marketing / narrative-scrolly

让用户从下面三个选项中选：

| 选项 | 含义 |
|------|------|
| 加载某个 archetype | 把对应目录下所有文件作为 Stage 2/3 的额外知识库；产物会被要求承接 archetype 的 pattern + 铁律 |
| 不加载 archetype | 纯用通用 dimension 框架。适合 dashboard / landing / 内部工具等不需要特殊交互的产品 |
| 申请新建 archetype | 用户描述一个还没收录的产品类型；Stage 0 出口除了 idea brief 还会产出 `templates/product-archetypes/_future-stubs/<name>.md` 的初稿 |

### Step 4 · 写 idea-brief.md

落到 `output/<date>-<nickname>/idea-brief.md`：

```markdown
# Idea Brief — <date> — <nickname>

## What
<一句话产品>

## Who & When
- 用户: ...
- 场景: ...
- 输出物用途: ...

## Vibe references (氛围，非具体)
- "看起来像 X"
- "感觉像 Y"

## Dimension priorities
| Dimension | Weight 1-5 |
|-----------|-----------|
| Visual | 5 |
| Interaction | 4 |
| ... | ... |

## Archetype choice
- loaded: canvas | none | (new draft: <name>)
- rationale: ...

## Out of scope
- 不做最终生产代码
- 不做组件库 / merge
- ...

## Open questions（不阻塞，记在这）
- ...
```

## Gate（`gates/stage0-exit.md`）

- [ ] What / Who / 用途 都不空
- [ ] Vibe references 至少 1 条
- [ ] Dimension priorities 六个都打过分（默认 3 可，但要表态）
- [ ] Archetype 三个选项明确选了一个
- [ ] Out of scope 至少 2 条
- [ ] 独立 red-team（不是产出者）签字

## 失败模式

| 症状 | 急救 |
|------|------|
| 用户没法回答"给谁用什么场景" | 用 `grill-with-docs` 拉一次 grilling session；仍然答不上来 → 停下，告诉用户这个 idea 还没到 UI/UX 阶段，建议先做 PRD 类工作 |
| 用户什么 archetype 都不匹配 | 走"申请新建 archetype"路径；Stage 0 出口多一份新 archetype 初稿 |
| Dimension 全打 5 | 提醒用户"全 5 = 没有侧重 = 后面 variant 不会差异化"；要求至少 3 个 ≤3 |
