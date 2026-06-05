---
name: uiux-stage3-prototype-package
description: Stage 3 — 每个 direction 候选生成一个 variant prototype package。每 variant 输出 index.html (或 index.tsx) + palette.json + token-candidates + surface mock + readme.md，并出一份 prototypes/comparison-report.md。这是 pipeline 的终点。
type: workflow
stage: 3
gate: gates/stage3-exit.md
---

# Stage 3 — Prototype Package Generation

## 目的

把 Stage 2 选定的 N 个 direction 候选**变成实际的、可点击的 prototype package**。每个 variant 独立成包，可以单独打开在浏览器里看。再加一份 **comparison report** 给评审人横向对比。

**这是 pipeline 的终点**。Prototype 是用来**做方向决策**的，不是用来直接上线的。再往后（组件库实施 / 真实集成 / 上线）不归本 skill 管。

## 输出形态（铁定）

每个 variant 落到 `output/<date>-<nickname>/prototypes/variant-<id>/`：

```
prototypes/
├── _index.html                       # 总索引页（列出所有 variant 卡片）
├── comparison-report.md              # 横向对比报告（review-ready）
└── variant-<id>/
    ├── index.html  (or index.tsx)    # 主入口 prototype（产品门面）
    ├── palette.json                  # 调色板（机器可读）
    ├── palette.html                  # 调色板可视化（人可读）
    ├── token-candidates.css          # 完整 design token 候选（CSS custom properties）
    ├── token-candidates.json         # 同上，机器可读
    ├── surface-<name>.html (or .tsx) # 其他关键 surface mock
    ├── readme.md                     # design rationale + dimension 决策 + borrowing
    └── assets/                       # 共用 CSS / 图标 / 字体（可选）
        ├── tokens.css                # = token-candidates.css 的副本，给 HTML 引用
        └── ...
```

**HTML vs React 选择**：
- Stage 0 idea brief 里用户没说 → 默认 HTML（最低门槛，浏览器直开）
- 用户说"我后续要做 React" / "用 Vite/Next/CRA" → 改用 `.tsx` + 给一份 `package.json` 让 `npm install && npm run dev` 能跑起来
- 不允许混用（同一个 variant 必须全 HTML 或全 React）

**最少**：每 variant 至少有 `index.html` / `index.tsx` + `palette.json` + `palette.html` + `token-candidates.*` + `readme.md`。

**典型**：3-5 个 surface mock + index + palette × 2 + token-candidates × 2 + readme，每 variant 10-12 个文件。

## 流程

### Step 1 · 分派 variant

每个 direction 候选 = 1 个 variant。

- 装了 `codex-dispatch`：每个 variant 派一个 codex 任务并行
- 否则：Claude subagent (Task) sonnet × variant 数，并行
- 同时活跃 variant 上限 5

每个 variant 任务的输入：

- 该 direction 的 candidate.md（palette / typography / motion / perspective）
- Stage 0 dimension priorities
- Stage 0 archetype 选择（如果选了，拉对应 archetype 知识库；canvas archetype 在 `templates/product-archetypes/canvas/`）
- Stage 0 选定 HTML 还是 React
- Stage 2 cross-reference matrix（避免"再抄一遍 vendor X"）

### Step 2 · 生成 palette.json + token-candidates.*

`palette.json`：见 `templates/prototype-package-layout.md` schema。

`token-candidates.css`：完整 design token，把 palette + typography + spacing + radius + shadow + motion 全部以 CSS custom property 形式列出。HTML/React 引用它，**不写死颜色**。

`token-candidates.json`：同上的 JSON 版本，给将来工具链消费（如 Style Dictionary）。

### Step 3 · 生成 palette.html

把 palette.json 渲染成**人可读**的可视化（色块 + token 名 + hex/oklch + 排版样本）。用户 5 秒看出风格的关键页面。

### Step 4 · 生成 index.html / index.tsx（主入口 prototype）

**产品门面**。5 秒内能让人看出：

- 这是什么产品
- 主要功能 / surface 入口
- 风格基调（调色板 + 排版 + 第一印象动效）
- 跟其他 variant 的核心区别

不允许：

- Lorem ipsum / 占位词 / "Click me" 占位（用 idea brief 里的真实场景文案）
- 不放真实功能入口
- 跟 palette.html 一样（index 是产品门面，不是调色板展示）

### Step 5 · 生成关键 surface mock

按 Stage 0 surface map + Stage 2 末用户勾选生成。每个 surface 必须：

- 使用 `assets/tokens.css`，不写死颜色
- 至少展示 3 个核心状态（默认 / hover / 空状态 / 错误 / loading / 选中 / ...）
- 顶部 / 底部有"回 index"链接
- 文件头注释写："对应 direction = X, 借鉴 vendor Y 的 Z pattern"

### Step 6 · 生成 readme.md

```markdown
# Variant <id> — <一句话风格描述>

## Direction
（从 Stage 2 candidate 摘）

## Output type
- HTML / React
- 跑起来: `<command>` （如 `open index.html` / `npm install && npm run dev`）

## Files
- index.{html,tsx} — 主入口
- palette.{html,json} — 调色板
- token-candidates.{css,json} — 完整 token
- surface-A.{html,tsx} — ...
- ...

## Dimension decisions
| Dimension | Stage 0 weight | 本 variant 怎么处理 |
| ... |

## Borrowing from
- vendor-a: 借了 ...
- vendor-b: 借了 ...

## 适合 / 不适合的场景
- ...
```

### Step 7 · 生成 _index.html（总索引）

`prototypes/_index.html` — 总入口画廊：

- 每个 variant 一张卡片
- 卡片显示：variant id / 一句话风格 / palette 缩略色块 / "Open prototype" 链接
- 自身简洁不喧宾夺主

### Step 8 · 生成 comparison-report.md（review-ready）

`prototypes/comparison-report.md` — 给评审人**横向对比**所有 variant 的报告：

```markdown
# Prototype Comparison Report — <date> — <project>

## Variants overview
| Variant | One-line style | Palette tone | Density | Motion stance | Output type |
| ... |

## Dimension fit comparison
（六 dimension × 每 variant 的 fit 简评）

## Borrowing matrix
（每个 reference vendor 在哪些 variant 体现）

## Recommendation framework
- 偏好 X 类用户 → variant ...
- 偏好 Y 类用户 → variant ...
- 风险高 / 实现成本低 → variant ...

## Open questions for reviewer
- 是否要进一步合并 variant X 和 Y 的特性？
- 是否需要追加一个反方向 variant？
```

### Step 9 · 红队

- 装了 `taste-skill` → 让它跑 anti-slop 红队
- 没装 → 主线程按 `references/anti-patterns.md` 自审，并明确告诉用户"未经独立红队"

红队找：

- 模板感 / AI-slop（generic hero / 居中标题 + gradient blob / 默认 card grid / Lorem）
- variant 之间是否真的差异化
- palette.html 是否 5 秒看出风格
- index 是否真的承担产品门面
- comparison report 是否对评审人有价值

### Step 10 · 用户验收

在浏览器打开 `prototypes/_index.html`，让用户：

- 标记 accept / revise / reject 每个 variant
- accept 的写入 `state/checkpoint.json.stage_3.user_accepted`
- 给评审人时，给他 `_index.html` + `comparison-report.md` 两个入口

## Gate（`gates/stage3-exit.md`）

- [ ] 每 variant 至少有 index + palette.json + palette.html + token-candidates.{css,json} + readme
- [ ] HTML 在浏览器真的能打开（React 在 `npm run dev` 真的能起）
- [ ] 无 console error / 无 broken external resource
- [ ] 不含 Lorem ipsum
- [ ] palette.json + token-candidates schema 合规
- [ ] variant 之间至少 2 维真差异化
- [ ] `_index.html` 与 `comparison-report.md` 都存在
- [ ] 独立 red-team 签字
- [ ] 用户至少 accept 1 个 variant

## 失败模式

| 症状 | 急救 |
|------|------|
| variant 跑出来都很像 | 回 Stage 2 出更差异化的 direction |
| HTML / React 报错 | 立即修；不接受"基本可用" |
| 全 reject | 回 Stage 2 重出 direction |
| 用户要"再生一个 variant" | 加新 direction 进 Stage 2 → Gate 2 → 才进 Stage 3，不走捷径 |
| 用 Lorem ipsum 被发现 | 立即重做该 variant |
| HTML / React 混用一份 variant | 立即重做；同一 variant 只能一种类型 |
