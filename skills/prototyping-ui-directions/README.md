# Prototyping UI Directions

> Create non-production UI/UX direction prototypes from product ideas.
>
> 从一个模糊的产品 idea，走完 **idea → reference 抓取 → research → prototype packages** 4 个阶段，最终产出多个 variant 的 prototype package（HTML 或 React mock + palette + token candidates + comparison report + readme），供方向决策审阅。
>
> **不是** E2E 生成最终生产代码的 skill。Prototype 是用来**做方向决策**的，不直接上线。后半段（组件库实施 / 测试 / 合流 / 部署）交给你自己的工程流程。

## Skill 是什么

把"我想做个 X 的前端，参考 A 和 B 的感觉"这种模糊 idea，**变成**：

```
output/2026-05-11-my-product/
  idea-brief.md
  reference/{vendor-a, vendor-b, ...}/
  reference-manifest.md
  research/{extract-cards/, cross-reference.md, direction-candidates.md}
  prototypes/
    _index.html                  ← 总入口，点进去看所有 variant
    comparison-report.md         ← variant 横向比较报告（review-ready）
    variant-1/
      index.html (or index.tsx)  ← 主产品入口 prototype
      palette.json               ← 机器可读调色板
      palette.html               ← 人可读调色板
      token-candidates.css       ← 完整 design token 候选
      token-candidates.json      ← 同上，机器可读
      surface-A.html (or .tsx)   ← 其他关键 surface mock
      surface-B.html
      readme.md
      assets/tokens.css
    variant-2/ ...
    variant-3/ ...
```

## 谁来用

- 想在动工写代码前**先把 UI 方向探索清楚**的产品/设计/工程一体角色
- 想给团队/客户/投资人**做几版 mock 让他们选**的人
- 想**复用别人的 UI taste** 而不是抄一遍代码的人

## 4 个阶段

```
Stage 0 — Idea Intake               (idea-brief.md)
   ↓ 问 4-6 个关键问题
   ↓ 选 6 dimension 权重
   ↓ 决定加载哪个 product archetype（或不加载）
   
Stage 1 — Reference Acquisition     (reference/ + manifest)
   ↓ 跟用户敲定参考清单
   ↓ skill 自己跑 git clone / 截图 / 抓 wiki
   ↓ 写 manifest（来源 + license + 研究意图 + do-not-copy）
   
Stage 2 — Research & Analysis       (research/)
   ↓ 从 reference 提取 dimension 上的证据
   ↓ 横向 cross-reference
   ↓ 收敛出 3-5 个 direction 候选（必须真差异化）
   
Stage 3 — Prototype Package Generation  (prototypes/)
   ↓ 每个 direction 一个 variant
   ↓ variant = index.html|tsx + palette + token-candidates + surface mock + readme
   ↓ 横向 comparison-report.md（review-ready）
   ↓ 红队（推荐 taste-skill）
   ↓ 用户验收
```

详见 `SKILL.md` 主入口 + `workflows/program-director.md` 路由逻辑。

## Companion Skills（**全部可选**）

本 skill 不依赖任何外部 skill。装了任一个，本 skill 会自动用它增强：

| Skill | 增强什么 | 不装的降级 |
|-------|----------|-----------|
| `grill-with-docs` | Stage 0 压实模糊 idea | AskUserQuestion 兜底 |
| `taste-skill` | Stage 3 红队 / anti-slop 守门（**强推**） | 主线程自审，效果弱 |
| `frontend-design` | Stage 3 HTML / React mock 写得更有质感 | 基础 HTML/JSX |
| `design-system` | Stage 2 调色板候选输入（来自 58 brand） | 仅从 reference 提取 |
| `competitive-teardown` | Stage 1 reference 选型 + Stage 2 对比 | 手写 cross-ref |
| Codex 官方 plugin (`codex@openai-codex`) | Stage 3 多 variant 并行加速（`/codex:rescue`） | Claude subagent 并行 |

详见 `references/companion-skills.md`，含每个 skill 的安装方式（marketplace / git clone / archive 拉回）。

## Product Archetype 库（可扩展知识库）

`templates/product-archetypes/` 是**可增长的知识库**。每个 archetype 是某类产品的"该关注什么 dimension、有什么特有 pattern、什么铁律"的指引。

### 已收录

- `canvas/` — 节点 / 白板 / 流程编辑器 / 空间化协作（10 pattern + 6 铁律 + 三模式布局 + Z0-Z4 zoom + motion 治理）

### 占位中（未来扩展）

- `game-style/` — 游戏化交互
- `bubble-physics/` — 物理碰撞 / 弹性
- `creative-eye/` — 跟随式 / 注视式 / 拟人交互
- `data-dashboard/` — 数据密度型
- `landing-marketing/` — 营销 / 滚动叙事
- `narrative-scrolly/` — 长故事滚动

**Stage 0 用户自己选要不要加载**。主流程不强引用任何 archetype；做 dashboard / landing 之类不需要画布交互的产品时跳过 canvas，纯用 6 dimension 通用框架。

### 如何加新 archetype

见 `templates/product-archetypes/README.md` §"如何新建"。骨架结构（patterns / dimensions / rules）保持一致。

## 通用 Dimension 框架

不论加不加载 archetype，所有产品都走六个 dimension（Stage 0 让用户打权重）：

- **Visual** — palette / typography / hierarchy / texture
- **Interaction** — 动作语义 / 状态 / 键盘
- **Motion** — duration / easing / 优先动效场景
- **Perspective** — 信息架构 / 视角 / 主路径
- **Accessibility** — WCAG / 减动效 / 键盘
- **Responsive** — breakpoints / 触屏 / 密度

详见 `references/analysis-dimensions.md`。

## 目录结构

```
prototyping-ui-directions/
├── SKILL.md                        # 主入口（自动 stage 路由）
├── VERSION
├── README.md                       # 本文件
│
├── workflows/                      # sub-skill 工作流
│   ├── program-director.md         # 总路由
│   ├── stage0-idea-intake.md
│   ├── stage1-reference-acquisition.md
│   ├── stage2-research-analysis.md
│   ├── stage3-prototype-package.md
│   ├── reference-intelligence.md   # 工具型 — 被 Stage 1/2 共用
│   ├── design-direction.md         # 工具型 — 被 Stage 2/3 共用
│   └── surface-architecture.md     # 工具型 — 被 Stage 0/2/3 共用
│
├── gates/                          # stage exit + 12-gate
│   ├── stage0-exit.md ... stage3-exit.md
│   └── 12-gate-checklist.md
│
├── templates/                      # 给 sub-skill 填的模板
│   ├── checkpoint.json
│   ├── prototype-package-layout.md
│   ├── reference-clone-manifest.md
│   ├── research-extract-card.md
│   ├── direction-candidate.md
│   ├── reference-tier-package.md
│   ├── surface-purpose-matrix.md
│   ├── token-candidates.md
│   └── product-archetypes/         # 可扩展知识库
│       ├── README.md
│       ├── canvas/
│       └── _future-stubs/
│
├── contexts/                       # 加载到对应 stage 的 context
│   ├── idea-intake.md
│   ├── visual-research.md
│   └── prototype-package.md
│
├── references/                     # 底层知识
│   ├── analysis-dimensions.md      # 通用 6 dimension 框架
│   ├── companion-skills.md         # 可选 skill 列表 + 安装
│   ├── tier-criteria.md            # Tier A/B/C 标准
│   ├── runtime-stack.md            # 默认 HTML+CSS+JS；archetype 推荐运行时
│   ├── anti-patterns.md            # 红队 checklist
│   └── skill-routing-matrix.md     # 完整路由
│
├── state/                          # 跨会话恢复
│   ├── checkpoint.json
│   └── log.md
│
└── output/                         # 真实运行时的产物（默认空）
```

## 怎么用

### 启动

最自然：

```
跟 Claude 说：「帮我做个 [产品类型] 的 UI 探索，参考 [A] 和 [B]，出几版给我看」
```

或者：

```
/prototyping-ui-directions
```

Program Director 会读 `state/checkpoint.json`，发现没初始化 → 引导进 Stage 0。

### 中途中断 / 跨会话恢复

`state/checkpoint.json` 持久化当前 stage / 已完成 artifact。下次会话 SKILL.md 会自动读它继续。

### 同时跑多个项目

每个项目用一个 `<date>-<nickname>` 作为 `output_root`。`state/checkpoint.json` 只跟踪"最近一次"，多项目并发的话建议每个项目单独 fork 本 skill 集到不同目录。

## 不会做的事

- 不写最终生产代码
- 不替你拍业务决策、不替你选 reference、不替你选 direction
- 不偷偷 clone reference（必须用户确认每个候选）
- 不写到你的主代码库（产物只落 `output/<date>-<nick>/`）
- 不在主流程硬引用 product archetype（archetype 是知识库，不是触发选项）

## 分发给别人

这个 skill 集**可单独分发**：

1. 把 `prototyping-ui-directions/` 整个目录拷到对方的 `~/.claude/skills/`
2. 对方按 `references/companion-skills.md` 自选装哪几个 companion
3. 即可用

**不**依赖任何 vendored 别人的 skill。

## 版本

- `0.1.0` — 初版（Track B 内化定位，已弃用）
- `0.2.0-skeleton` — 通用化 + 缩减到 sample pipeline 范围 + Canvas 移到 archetype + 删 vendored 改 companion 检测（当前）

## 下一步

- 把 product-archetypes 的占位 stub 升级为正式 archetype
- 在 `bin/` 下加 checkpoint 读写脚本（避免手改 JSON）
- 跑 dogfooding 在真实项目上
