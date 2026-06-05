# Product Archetypes — 知识库

> 这是一个**可扩展知识库**。每个 archetype 是一类产品类型的"该关注哪些 dimension、有哪些特有 pattern、有什么铁律"的指引。
>
> Stage 0 用户选要不要加载某个 archetype；不选就纯走通用 dimension 框架。**主流程不强引用**任何 archetype。

## 目录结构

```
templates/product-archetypes/
├── README.md              ← 本文件
├── canvas/                ← 已收录
│   ├── README.md
│   ├── interaction.md     # 10 pattern + 6 铁律
│   ├── layout-engines.md
│   ├── layout-engines-ref.md
│   ├── semantic-zoom.md
│   ├── motion-governor.md
│   ├── motion-tokens.md
│   ├── patterns-index.md
│   └── six-rules.md
└── _future-stubs/         ← 未来扩展占位
    ├── game-style.md
    ├── bubble-physics.md
    ├── creative-eye.md
    ├── data-dashboard.md
    ├── landing-marketing.md
    └── narrative-scrolly.md
```

## 已收录的 archetype

### canvas/
**目标产品类型**：节点编辑器 / 白板 / 流程编辑器 / 空间化协作工具
**关键 dimension**：Interaction, Motion, Perspective（高权重）
**特有产物**：10 pattern (Seed Create / Mitosis Duplicate / Absorb Delete / Tissue Group / Membrane Drag-In / Ungroup Release / Evidence Granules / Signal Edge Pulse / Semantic Zoom / Auto-layout Morph) + 6 铁律 + 三模式布局 + Z0-Z4 zoom + motion 治理规则

## 未来要收录的 archetype（已占位 stub）

| Archetype | 目标产品类型 | 主要要关注的 dimension |
|-----------|--------------|------------------------|
| `game-style/` | 游戏化交互 / 卡片对战 / 副本 UI | Motion, Interaction, Visual |
| `bubble-physics/` | 物理碰撞 / 弹性 / 球体 / 漂浮 | Motion, Visual |
| `creative-eye/` | 跟随式 / 注视式 / 拟人化交互（如鼠标跟随眼睛、视线导航） | Motion, Interaction, Perspective |
| `data-dashboard/` | 高密度数据可视化 / 监控面板 / 报表 | Perspective, Visual, Responsive |
| `landing-marketing/` | 营销 / 着陆页 / 滚动叙事 / 产品宣传 | Visual, Motion, Perspective |
| `narrative-scrolly/` | 长故事滚动 / 编辑式 / 数据故事 | Motion, Perspective, Visual |

## 如何新建一个 archetype

当用户在 Stage 0 描述了一个还没收录的产品类型，可以走"申请新建 archetype"路径：

1. 在 `_future-stubs/<name>.md` 找到对应 TODO（或新增）
2. 升级为正式 archetype：在 `templates/product-archetypes/<name>/` 下创建目录
3. 最少包含：
   - `README.md` — 这个 archetype 是什么、什么时候用、不用什么时候用
   - `patterns.md` 或 `interaction.md` — 该类产品特有的 pattern / 铁律
   - `dimensions-priority.md` — 该类产品 dimension 权重的"先验建议"
4. 在本 README 的"已收录"表里加一行

## Archetype 的"骨架"约定

每个 archetype 文件夹至少有：

| 文件 | 必填？ | 说明 |
|------|--------|------|
| `README.md` | ✅ | 入口介绍 + 边界 + 何时不用 |
| `dimensions-priority.md` | 推荐 | 该类产品六 dimension 的典型权重 |
| `patterns.md` / `interaction.md` | ✅ | 特有 pattern / 铁律 |
| `motion-tokens.md` | 可选 | 该类产品特有的动效 token |
| `runtime-recommendations.md` | 可选 | 该类产品推荐的运行时依赖（React Flow / Pixi / D3 / GSAP / ...） |

## 加载机制

Stage 0 用户选了某个 archetype（例如 canvas），Program Director 会：

1. 把该 archetype 目录下所有 .md 加进 Stage 2/3 的 context
2. Stage 2 提取卡多一节 "archetype dimension"，按 archetype 特有要求提取
3. Stage 3 variant 生成时，要求承接 archetype 的 pattern + 铁律
4. Stage 3 红队多一组 archetype-specific 检查项

**不选 archetype 时**：以上全部跳过，纯走通用 dimension 框架。

## 不允许

- 把 archetype 当成"主 skill" — 它永远是知识库
- 在主流程里硬引用某个 archetype
- 一次性加载多个 archetype（一个产品只属于一类；如果跨类，要么新建混合 archetype，要么选主类）
