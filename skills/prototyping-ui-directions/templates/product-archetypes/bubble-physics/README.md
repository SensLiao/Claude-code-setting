# Bubble-Physics Archetype

> Physics-based / 弹性 / 可拖拽 & 碰撞的交互知识库 —— spring 物理、drag-throw-momentum、soft-body & collision、引力/吸附场。
>
> Stage 0 用户选"加载 bubble-physics archetype"时被引入主流程；否则休眠在这里不影响主流程。
>
> **这是一层 interaction PHYSICS，不是视觉风格。** 它叠加在已锁定的 L3 视觉皮肤之上，永远不抢 L3 slot（详见末尾 §How it COMPOSES）。

## 适用产品类型

- 交互式 playground / explorable explainer（拖一下、丢一下、撞一下就懂的演示）
- tag / topic / interest 气泡选择器（多选偏好、标签云、技能图谱）
- soft-body / 弹性卡片界面（卡片有"重量"和"惯性"，拖动会回弹）
- 空间化 picker —— 用位置/距离/大小表达关系，而非列表行号
- 物理引导的 onboarding（兴趣气泡、磁吸分组、丢进收集篮）
- "活的"装饰性 hero —— 浮动 logo 群、可推开的品牌粒子（克制使用）

**不适用**（命中任一就别加载本 archetype）：

- 表单密集 / 数据录入工具 —— 用户要"精确命中输入框"，物理只会增加 Fitts 难度
- 高密度 dashboard / 报表 —— 信息要稳，不要漂
- 任何"主路径是阅读 + 顺序操作"的产品（文档、设置页、结账流程）
- 列表型 CRUD —— 用 elastic scroll 顶多点缀，整页不该是物理场
- accessibility-critical / 键盘优先 的合规系统（物理是 enhancement，不能是唯一入口）
- 节点编辑器 / 流程图 —— 那是 `canvas` archetype 的地盘（有向连接 + 持久布局，不是自由碰撞）

> **一句话判据**：物理只在"位置/重量/邻近本身就是信息"时 ELEVATES；在"用户只想快准狠完成任务"时 DISTRACTS。拿不准就别加载。

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `README.md` | 本文件：适用边界 + 铁律速查 + dimension 权重 + stage 加载 + L3 组合规则 |
| `patterns-index.md` | 11 个核心 pattern 索引（Bubble Cluster / Drag-and-Throw / Magnetic Snap / Collision Repel / Gravity Well / Elastic List / Rubber-band Scroll / Soft-body Card / Floating Tags / Pressure-Size Mapping / Settle-to-Rest），每个含它替代的 gimmick 反模式 |
| `bubble-physics-rules.md` | 8 条 HARD rule，gate / checklist 形式，带具体数字（transform-only ≥60fps / collision budget / fallback 强制 / reduced-motion → 静态布局 / 物理不许困住 focus） |
| `layout-engines.md` | 物理布局引擎选型（d3-force + forceCollide / Matter.js / Rapier / react-spring + use-gesture），force-directed vs grid hybrid，何时 freeze simulation |
| `motion-tokens.md` | spring token 预设（gentle / snappy / bouncy / wobbly，含 stiffness/damping/mass 具体值）+ 要避免的（over-bouncy / never-settling）+ reduced-motion 兜底 |
| `interaction.md` | drag / throw / pinch / collision 完整 spec，pointer + keyboard 双轨，全状态覆盖（idle / dragging / colliding / settling / disabled），perf governor（封顶活跃刚体数） |
| `reference-anchors.md` | 8 个真实 gold-standard physics-UI 范例（iMessage / Dynamic Island / Stripe / Framer drag / Things 3 / Tinder / react-spring / Matter.js），供 Stage 1 reference-grounding pipeline 消费 |

## 八条铁律（速查）

1. **物理只走 transform / opacity** —— 仅动 `transform`(translate/scale/rotate) 与 `opacity`，**禁止** 物理驱动 `width/height/top/left/margin`；掉出 60fps（>16.7ms/帧）即降级
2. **每个 drag 必有非物理 fallback** —— 键盘（方向键移动 / Enter 选中）或 tap-to-select 永远可达，物理是 enhancement 不是唯一入口
3. **碰撞有预算** —— 同屏活跃刚体 ≤ 60（移动端 ≤ 30）；broadphase 之外不做 O(n²) 检测；超预算就 freeze 远处刚体
4. **必须 settle** —— 任何弹簧/抛掷在 ≤ 1.2s 内静止（velocity < 0.01 即 sleep）；**禁止** 永不停的漂浮/抖动
5. **`prefers-reduced-motion` → 静态布局** —— 直接给 grid/list 终态，无 spring、无惯性、无碰撞、无浮动；不是"慢一点的物理"，是"没有物理"
6. **物理绝不困住 focus / 阻塞任务** —— 飞行中的气泡不抢 focus、不拦 click、不让"提交"按钮够不着；任务一定能在不碰物理的前提下完成
7. **抛掷有边界与摩擦** —— momentum 必须有 friction 衰减 + 容器 clamp，元素不许飞出可视区且回不来；rubber-band 过冲 ≤ 容器 16%
8. **不污染主视觉** —— 物理是系统的运动逻辑，不是产品视觉主调；wobble/bounce 幅度受 L3 皮肤约束（luxury 皮肤下只准 gentle，详 §How it COMPOSES）

> 完整 gate 形式见 `bubble-physics-rules.md`。

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 3 | 气泡形/软体形/标签视觉跟随 L3，本身权重不高 |
| Interaction | 5 | drag/throw/collision 是核心动作，必须严谨 |
| Motion | 5 | spring 物理是整个 archetype 的灵魂 |
| Perspective | 3 | 空间化/邻近表达关系，中等 |
| Accessibility | 4 | 拖拽天然 a11y 不友好，**必须**双轨，权重比 canvas 高一档 |
| Responsive | 4 | 触屏是主场（pointer events + 手势），刚体预算随屏调，权重高 |

> 这是先验，用户可在 Stage 0 调整。注意 Accessibility 与 Responsive 比 canvas 高 —— 拖拽 + 触屏是本 archetype 的固有风险区。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重用先验表打底；提醒用户"物理是 enhancement，确认主任务不依赖它能完成" |
| 1 | reference 选型走 `reference-anchors.md` 的 8 个范例；要求每个候选 direction 选定主 spring preset（gentle/snappy/bouncy/wobbly）与主引擎（d3-force vs spring-per-element） |
| 2 | extract card 多一节"physics pattern observed"（spring 手感 / 碰撞策略 / settle 时间）；direction 候选必须声明刚体预算 + fallback 方案 |
| 3 | variant HTML 至少有一个 physics surface（真能拖、真会撞、真会 settle）；红队跑 8 铁律 + 每个 pattern 的反模式检查 + reduced-motion 双轨快照 |

## 运行时推荐（不强制）

- **d3-force + forceCollide** —— 多刚体 cluster / 标签云 / force-directed 布局（最稳的"一堆气泡互不重叠"方案）
- **react-spring** + **@use-gesture/react** —— 单元素/少量元素的 drag-throw-momentum + 弹簧（手感最细）
- **Framer Motion** —— `drag` / `dragConstraints` / `dragTransition`(power+timeConstant) + `layout`，开箱即用的惯性拖拽
- **Matter.js** —— 需要真刚体动力学/重力/复杂碰撞形状时（2D 物理引擎，showcase 多）
- **Rapier**(`@dimforge/rapier2d`, WASM) —— 高刚体数 / 高性能 / 确定性物理（Matter.js 撑不住时升级）

详见 `layout-engines.md` 的选型决策树。

## 不允许

- 跨类型套用（把 bubble-physics 拿去做 dashboard / 表单 / 文档）
- 在主流程的 `SKILL.md` / `program-director.md` 里硬引用本 archetype
- 把 8 铁律当"建议"而不是红队 gate
- 一次性加载多个 archetype（一个产品只属于一类）
- **把本 archetype 当成一种 L3 视觉风格** —— 它永远不进 `l3_style` enum，不会被 style-lock（见下）

## How it COMPOSES with a locked L3 visual style

> **核心定位**：本 archetype 加的是**交互 PHYSICS**（元素怎么动、怎么撞、怎么 settle），不是**视觉 skin**（颜色/字体/材质/层次）。两者正交、叠加，互不覆盖。

**关系模型**：

```
L3 视觉风格 (taste / luxury / brutalist)   ← 决定"长什么样"（皮肤）：占 l3_style slot
        ⊕  (叠加，不覆盖)
bubble-physics archetype                   ← 决定"怎么动/怎么撞"（物理）：不占任何 l3_style slot
```

**硬约束**：

1. **archetype 永不声明 L3 slot** —— 它不是第 4 种风格，不进 style-lock，不和 taste/luxury/brutalist 互斥；它和任意一个 L3 **共存**。
2. **L3 拥有视觉，archetype 拥有运动** —— 气泡的颜色/圆角/阴影/字体/材质 = L3 说了算；气泡的 stiffness/damping/碰撞/惯性 = archetype 说了算。archetype 绝不改 palette / typography / 视觉层次。
3. **L3 反向约束物理幅度（皮肤优先）** —— 当物理的"手感"会冲撞 L3 的气质时，**L3 赢**：
   | 锁定的 L3 | 允许的 spring preset | 禁止 |
   |-----------|---------------------|------|
   | `luxury` | gentle（低 bounce、慢 settle、克制） | wobbly / bouncy（过度弹跳破坏高级感） |
   | `taste`（default） | gentle / snappy | wobbly（除非用户明确要俏皮） |
   | `brutalist` | snappy / bouncy（生硬、夸张、反精致是其美学） | gentle（太软不符合 brutalist 张力） |
   > preset 具体数值见 `motion-tokens.md`；这里只定"哪个 L3 准用哪档"。
4. **冲突裁决** —— 若 archetype 默认 preset 与 L3 约束冲突，按本表降级到 L3 允许档，并在 variant readme 标注"physics preset 因 L3=<x> 降级为 <preset>"。
5. **没锁 L3 时** —— archetype 用自己的 dimension 先验 + 默认 snappy preset 跑；一旦下游锁了 L3，回到本表复核。

**一句话**：L3 给气泡穿衣服，bubble-physics 给气泡注入重量和脾气；衣服永远盖在物理外面，物理永远不撕衣服。
