---
name: prototyping-ui-directions
description: Create non-production UI/UX direction prototypes from product ideas, including HTML/React mocks, palette and token candidates, visual variants, comparison reports, and review-ready prototype packages.
type: orchestrator
version: 0.2.0-skeleton
stages: 4
output: per-variant prototype package — HTML/React mocks + palette.json + token-candidates + comparison report
---

# Prototyping UI Directions — 主入口

> **干什么的**：把一个产品 idea 做成 **non-production UI/UX direction prototypes** — 包括 HTML/React mocks、palette 与 token 候选、视觉 variant、direction 对比报告，最终打包成 **review-ready prototype packages** 供决策审阅。
>
> **不干什么**：不写最终生产代码、不做组件库实施、不做测试 / 合流 / 部署。Prototype 是用来**做方向决策**的，不是用来直接上线的。后半段交给用户自己的工程流程。

## 调用即做的两件事

每次本 skill 被触发：

### 1. 读 state

```
Read state/checkpoint.json
```

文件不存在 = 还没开过 idea intake → 进 Stage 0。

### 2. 派路由

按下表决定下一步：

| 当前状态 | 下一步 |
|---------|--------|
| `current_stage = -1` (未初始化) | 进 `workflows/stage0-idea-intake.md` |
| `stage_0` 未完成 | 继续 Stage 0 |
| `stage_0 gate_passed`，`stage_1` 未开始 | 用户确认后进 Stage 1 |
| `stage_1` 进行中 | 路由到 `workflows/stage1-reference-acquisition.md` |
| `stage_1 gate_passed`，`stage_2` 未开始 | 进 Stage 2 |
| `stage_2` 进行中 | 路由到 `workflows/stage2-research-analysis.md` |
| `stage_2 gate_passed`，`stage_3` 未开始 | 进 Stage 3 |
| `stage_3` 进行中 | 路由到 `workflows/stage3-prototype-package.md` |
| `stage_3 gate_passed` | 报告 done，等用户开新轮或下载产物 |

## 4 阶段一览

```
Stage 0 — Idea Intake             产物：idea-brief.md
  │  跟用户聊：要做什么类型产品？氛围？参考方向？
  │  选 dimension 重点（视觉/交互/动画/视角/响应式/a11y）
  │  选是否加载 product archetype（canvas / dashboard / landing / ...）
  ↓
Stage 1 — Reference Acquisition   产物：reference/<vendor>/* + reference-manifest.md
  │  跟用户敲定要研究的具体参考清单
  │  skill 自己跑 git clone / 截图 / 抓 wiki，落到 reference/ 下
  │  写 manifest 注明每个 reference 的来源 + license + 研究意图
  ↓
Stage 2 — Research & Analysis     产物：research/{cross-ref.md, direction-candidates.md}
  │  从每个 reference 提取选中 dimension 上的 pattern / palette / typography / motion
  │  整理 cross-reference matrix
  │  收敛出 N 个 direction 候选（≥3，每个含调色板 + 风格基调 + 关键 pattern）
  ↓
Stage 3 — Prototype Package Generation
                                  产物：prototypes/variant-<N>/{index.html|tsx, palette.json, token-candidates.*, surface-*.html|tsx, readme.md}
                                  + comparison-report.md (variant 横向比较)
   并行跑每个 direction
   每 variant 输出 prototype package：
     - index.html (或 index.tsx)  主入口（产品门面 prototype）
     - palette.json              调色板（机器可读）
     - palette.html              调色板可视化
     - token-candidates.{css,json}  完整 design token 候选（color + type + spacing + radius + motion）
     - surface-*.html (或 .tsx)  关键 surface 的 mock（HTML 或 React 任选）
     - readme.md                 design rationale + dimension 决策 + borrowing
   附加一份 prototypes/comparison-report.md：variant 横向对比，给评审人看
   红队（推荐 companion skill: taste-skill）
   用户验收 = review-ready
```

## 不做的事（保护边界）

1. **不写生产代码** — 输出物到 HTML 样本为止
2. **不做组件库 / element contract / token pipeline** — 那是另一个 skill 的事
3. **不替用户选** — 参考清单、direction 数量、product archetype 都由用户拍板
4. **不偷偷 clone reference** — 每个 git clone 都必须在 Stage 1 跟用户确认过
5. **不写到主产品代码库** — 所有产物只落在本 skill 输出目录或用户指定路径

## Product Archetype 库（可选加载）

`templates/product-archetypes/` 下是**可扩展知识库**。Stage 0 决定要不要加载。

当前已经收录：

- `canvas/` — 节点 / 白板 / 流程编辑器（10 pattern + 6 铁律 + layout engines + semantic zoom + motion tokens）

未来可加（占位 stub 已在 `_future-stubs/`）：

- `game-style/` — 游戏化交互
- `bubble-physics/` — 物理碰撞 / 弹性
- `creative-eye/` — 跟随式 / 注视式 / 拟人交互
- `data-dashboard/` — 数据密度型
- `landing-marketing/` — 营销 / 着陆页 / 滚动叙事
- `narrative-scrolly/` — 长故事滚动 / 编辑式

**主流程不强引用任何 archetype**。Stage 0 用户说"我做的是 canvas 型"→ 加载 canvas archetype。说"我做的是 dashboard"→ 加载 dashboard archetype。说"都不像"→ 跳过 archetype，纯用通用 dimension 框架。

**扩展规则**：以后碰到主库不覆盖的新产品类型，在 `_future-stubs/` 把 TODO 升级成正式 archetype 即可。骨架结构（patterns / dimensions / rules）保持一致。

## 通用 Dimension 框架

不论加不加载 archetype，所有产品都按以下 dimension 分析（Stage 0 让用户选权重）：

- **Visual** — palette / typography / hierarchy / texture
- **Interaction** — 核心动作语义、状态切换、键盘可达性
- **Motion** — duration / easing / 优先动效场景
- **Perspective** — 信息架构 / 用户视角 / 主路径
- **Accessibility** — WCAG AA / 减动效 / 键盘 / 屏读
- **Responsive** — breakpoints / 触屏 / 密度切换

详见 `references/analysis-dimensions.md`。

## Companion Skills（可选，会自动检测）

主 skill 不依赖任何外部 skill。但如果你装了下列任一个，本 skill 会自动用它增强：

| Companion | 角色 | 没装时的降级 |
|-----------|------|--------------|
| `grill-with-docs` | Stage 0 压实模糊点 | 主线程问答兜底 |
| `taste-skill` | Stage 3 红队 / anti-slop 守门 | 主线程自审（弱） |
| `frontend-design` | Stage 3 HTML / React mock 写得更有质感 | 主线程写基础 HTML/JSX |
| `design-system` | Stage 2 调色板 / typography 候选输入 | 跳过，纯从 reference 提取 |
| `competitive-teardown` | Stage 1 reference 选型 + Stage 2 对比 | 主线程手写 cross-ref |
| `codex-dispatch` | Stage 3 多 variant 并行加速 | 顺序生成 |

完整安装指引：见根目录 `README.md` §Companion Skills。

## 触发本 skill 的典型说法

- "帮我做几版前端 prototype / UI direction"
- "出 5 版 dashboard 方向给我评审"
- "我想做个 [节点编辑器 / landing / 游戏化 ...]，参考 [产品 A / B]，先做 mock"
- "从 idea 到 prototype package 走一遍"
- "做几个 variant 让我挑方向"
- "出一份 prototype + token candidates 用来 review"

**不**触发的说法：

- "帮我把这个组件合并到生产" → 那是组件库 / merge 流程的事
- "写测试 / 做 a11y 审查" → 那是 QA skill 的事
- "建 design token pipeline" → 那是 design-system pipeline 的事

## 下游 Handoff

Stage 3 出 review-ready 包后**就停**。用户选定 variant 要走生产，按 `references/skill-routing-matrix.md` §"下游 Handoff" 提示对应下游 skill。当前已挂：

| variant 类型 | 下游 skill |
|--------------|------------|
| editorial-luxury / 高端品牌单页 / 100dvh hero video | `luxury-editorial-site-builder`（跳过其 Phase 0/1，从 Phase 2 真实内容开始） |

本 skill **不自动调用**下游——只在 `comparison-report.md` 末尾给提示。

## 版本

- `0.2.0-skeleton` — 主入口 + program-director 完整；4 stage workflow 各一份；canvas archetype 完整；其他 sub-skill 是 stub
