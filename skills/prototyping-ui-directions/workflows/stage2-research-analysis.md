---
name: uiux-stage2-research-analysis
description: Stage 2 — 从 reference 提取 dimension 上的 pattern / palette / typography / motion，整理 cross-reference matrix，收敛出 N 个 direction 候选。产物：research/{extract-cards/, cross-reference.md, direction-candidates.md}。
type: workflow
stage: 2
gate: gates/stage2-exit.md
---

# Stage 2 — Research & Analysis

## 目的

把 Stage 1 抓回来的"一堆 reference 素材"，转成"**N 个差异化、可挑选的 direction 候选**"。每个候选最后会驱动 Stage 3 生成一个 variant。

## 流程

### Step 1 · per-reference 提取

对每个 vendor（来自 Stage 1 manifest），按 Stage 0 选定的 dimension 权重，提取证据卡：

```markdown
# Extract Card — <vendor> — <date>

## Visual
- palette: 主色 / 辅助 / 背景 / 文字 / 状态色（从 CSS / 截图采样）
- typography: family / scale / weight
- hierarchy: 怎么区分 primary / secondary
- texture: 纹理 / 噪点 / 玻璃 / 光晕 ...

## Interaction
- 核心动作的语义命名
- 状态切换可见性（hover/focus/active/disabled/loading）
- 键盘期望

## Motion
- 估算 duration 区间
- 哪些场景给了动效
- 哪些场景明确不给（不应被忽略）

## Perspective
- 主入口 surface 长什么样
- 用户视角 / 信息密度切换

## Accessibility（看得见的）
- 焦点环 / contrast / 减动效兜底

## Responsive（看得见的）
- breakpoints / 触屏 / 密度切换

## Quote-worthy 引用片段
- "<截屏 / 代码片段 / 文档原话>"

## Do-not-copy
- 品牌色 / 字体 / 独占动效
```

落到 `output/<date>-<nickname>/research/extract-cards/<vendor>.md`。

执行者：Claude subagent (Task) sonnet，每个 vendor 一个 subagent 并行；或 codex-dispatch 加速。

### Step 2 · Cross-reference matrix

横向对比所有 vendor 在每个 dimension 上的做法。

```markdown
# Cross-reference Matrix — <date>

|                | vendor-a | vendor-b | vendor-c | ... |
|----------------|----------|----------|----------|-----|
| Palette tone   | warm     | cool     | mono     |     |
| Typography     | serif+sans | mono primary | grotesk |  |
| Density        | spacious | compact  | compact  |     |
| Hierarchy via  | scale    | color    | weight   |     |
| Motion budget  | minimal  | heavy    | medium   |     |
| Perspective    | bird-eye | first-person | flat |     |
| Distinctive trait | ... | ... | ... |        |
```

落到 `research/cross-reference.md`。

### Step 3 · 收敛 direction 候选

至少 **3 个** direction，最多 **5 个**。**差异化是硬指标** —— 三个候选不能是"同一个风格换三个标题色"。

每个 direction 必须含：

```markdown
# Direction Candidate — <id> — <一句话风格描述>

## Palette
- color-bg / surface / text-primary / text-muted / accent-primary / accent-on / status-{success,warn,danger,info}
- 用 oklch 或 hex 都行，给具体值，不写"暖色调"这种话

## Typography
- display family + scale
- text family + scale
- mono（如果产品需要）

## Motion stance
- micro 默认 ms
- 复杂转换 ms 上限
- effect budget 每屏 ≤N

## Perspective stance
- 主入口长什么样（用 2-3 行说）
- 用户视角

## Dimension fit
按 Stage 0 weight 自评 — 这个 direction 在哪些 dimension 上强、哪些上弱

## Borrowing from
- vendor-a: <借了什么>
- vendor-b: <借了什么>
- 严格区分 borrow（pattern）vs copy（品牌色 / 字体）

## 不适合的场景
- 这个 direction **不适合** ...
```

落到 `research/direction-candidates.md`（或拆成多文件）。

执行者：主线程主导收敛，可选 `design-system` companion 提供候选调色板。

### Step 4 · 用户确认

把 direction 候选给用户看，让用户决定：

- 哪几个进 Stage 3 生成 variant（默认全部，但用户可砍）
- 是否要 skill 再补一个"反方向"候选（如果用户觉得现有几个都太相似）

## Gate（`gates/stage2-exit.md`）

- [ ] 每个 vendor 一份 extract card，dimension 字段不空
- [ ] cross-reference matrix 完整
- [ ] direction 候选 ≥3 且**真的差异化**（不同 palette tone + 不同 density + 不同 motion stance）
- [ ] 每个 direction 自评 dimension fit
- [ ] 每个 direction 明确说"不适合 X 场景"（避免 Stage 3 跑出来才发现错位）
- [ ] 独立 red-team 签字 — 红队负责"差异化是否真的够"
- [ ] 用户确认哪几个进 Stage 3

## 失败模式

| 症状 | 急救 |
|------|------|
| 提取卡里某 dimension 字段全空（reference 上看不出来） | 写 "n/a — reference 上不可见"，不要瞎编 |
| 3 个 direction 看起来都像一个东西 | 强制再出一个反方向（如果全冷色，加一个暖色 / 如果都密度高，加一个低密度） |
| 用户说"全要" | 提醒上限 5 个；超过用户也审不动 |
| 用户砍到只剩 1 个 | 可以，但 Stage 3 也只跑 1 个 variant，失去"比稿"意义；告诉用户后再继续 |
