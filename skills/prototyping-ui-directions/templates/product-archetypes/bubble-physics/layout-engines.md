# Layout Engines — Bubble-Physics

> 物理布局/动力学引擎的选型决策。由 Stage 2 direction 候选显式选定，不套死一个库。每个 variant 的 readme 必须声明"用了哪个引擎 + 为什么 + 刚体预算"。

## 四类引擎（按用途分，不是按流行度）

### A. d3-force + forceCollide —— 多刚体自组织簇

- **是什么**：力导向模拟。一堆 node 在斥力/吸引力/碰撞力下自己排开，达到平衡。
- **核心力**：
  - `forceManyBody()` —— 节点间斥力（负 strength），让簇散开
  - `forceCollide(r + pad)` —— 防重叠的硬约束（**bubble cluster 的命门**），iterations ≤ 3
  - `forceCenter()` / `forceX/Y()` —— 把簇拉向中心或锚点
  - `forceRadial()` —— 排成环/同心圈
- **用于**：Bubble Cluster(1) / Collision Repel(4，纯力学版) / Floating Tags(9) / Pressure-Size(10)
- **手感**：weight 用 node radius/strength 表达；大 node = 更沉、更难推。
- **坑**：`forceCollide` 不是 100% 无穿插（迭代有限），元素极密时会轻微重叠——配 padding + 限制密度。

### B. react-spring / Framer Motion —— 单元素 & 少量元素的弹簧手感

- **是什么**：基于 stiffness/damping/mass 的弹簧插值（不是 duration/easing）。手感最细。
- **react-spring** + **@use-gesture/react**：drag 采 velocity → `decay`/`config` 喂惯性；spring 数值见 `motion-tokens.md`。
- **Framer Motion**：`drag` + `dragConstraints` + `dragTransition={{ power, timeConstant }}` + `dragElastic`(rubber-band)；`layout`/`layoutId` 做 FLIP 重排。开箱即用、最快出原型。
- **用于**：Drag-and-Throw(2) / Magnetic Snap(3) / Elastic List(6) / Rubber-band Scroll(7) / Soft-body Card(8)
- **手感**：mass 越大越"沉"、damping 越低越"弹"。
- **坑**：逐元素 spring 不做碰撞——元素会重叠；要互斥得自己加约束或换 A/C。

### C. Matter.js —— 真 2D 刚体动力学

- **是什么**：完整 2D 物理引擎（刚体、重力、约束、复杂碰撞形状、摩擦/弹性系数）。
- **用于**：需要**真重力**、复杂碰撞形状（非圆）、堆叠/拼图、可见的真实物理时——Collision Repel(4) 重型版、Gravity Well(5) 真引力版。
- **手感**：最"真"，但渲染要自己接（Matter render 或同步到 DOM transform）。
- **坑**：刚体多了吃 CPU；DOM 同步比 canvas 渲染慢——刚体 > 40 考虑 canvas 渲染或换 D。**别**用它做本可用 spring 解决的简单回弹（杀鸡用牛刀）。

### D. Rapier (`@dimforge/rapier2d`, WASM) —— 高性能 / 高刚体数 / 确定性

- **是什么**：Rust + WASM 物理引擎，性能与确定性（deterministic）远超 Matter.js。
- **用于**：刚体数大（数百）、需要确定性回放、Matter.js 撑不住帧率时升级。
- **坑**：WASM 加载体积 + 接入成本高；原型阶段非必要不上——Stage 3 mock 多数用 A/B 足矣。

## 选型决策树

```
需要"一堆元素互不重叠的有机簇"？
  └─ 是 → d3-force + forceCollide (A)                      [Pattern 1/9/10]
需要"单个/少数元素拖、甩、弹、回正"，不需互斥？
  └─ 是 → react-spring + use-gesture / Framer drag (B)     [Pattern 2/3/6/7/8]
需要"真重力 / 复杂碰撞形状 / 堆叠"？
  └─ 元素 ≤ 40 → Matter.js (C)                             [Pattern 4/5 重型]
  └─ 元素 > 40 或要确定性/高性能 → Rapier (D)
拿不准 / 只是想要点弹性点缀？
  └─ 默认 Framer Motion (B) —— 最快出原型、API 最少
```

## Force-directed vs Grid Hybrid（关键架构决策）

纯力导向"好看但不可预测"，纯 grid"可预测但死板"。多数好的 physics-UI 是**混合**：

| 模式 | 做法 | 适用 |
|------|------|------|
| **Pure force** | 全靠 d3-force 自组织，无锚点 | 装饰性簇、标签云、关系无强结构（Pattern 9） |
| **Grid + physics overlay** | 逻辑落点是 grid/槽位，物理只做"过渡 + 微扰 + 吸附" | 选择器、可排序卡片（Pattern 3/6）—— **最常用、最可控** |
| **Force settle → snap to grid** | 先 force 自组织，settle 后吸附到最近网格对齐 | 既要有机感又要最终整齐 |
| **Anchored force** | force 跑，但部分 node `fx/fy` 钉死（用户拖过的/重要的） | 用户已整理过的布局，只对新节点松弛 |

> **默认建议**：除非产品本体是自由 playground，否则用 **Grid + physics overlay**——逻辑位置确定、可达性可控（铁律 2/6），物理只负责"手感"。Pure force 留给装饰层。

## 何时 freeze the simulation（冻结模拟）

冻结 = 停止 RAF tick / `simulation.stop()`，刚体定格。**必须** freeze 的时机：

1. **settle 后** —— alpha < alphaMin 或全体 velocity < 0.01（铁律 4 强制），freeze 让 CPU 归零
2. **超刚体预算** —— 视口外 / 远离指针的刚体 freeze，只留交互焦点附近活跃（铁律 3）
3. **`prefers-reduced-motion`** —— 永久 freeze，直接给静态终态（铁律 5）
4. **tab 不可见**（`document.hidden`）—— freeze 省电，回来再 thaw
5. **元素被钉住**（用户拖过 → `fx/fy` set）—— 该 node 退出模拟，不再被力推动

**thaw（解冻）时机**：用户开始拖拽 / 新元素加入 / 显式 "re-shuffle" / tab 重新可见。

> 原则：物理是"被触发的瞬时计算"，不是"常驻后台进程"。能 freeze 就 freeze。

## 与 reduced-motion / 触屏的集成约定

- reduced-motion → 跳过模拟，用 force 的"理论终态"或预算好的 grid 直接渲染（freeze at frame 0）
- 触屏 → pointer events（非 mouse-only），刚体预算降到 mobile 档（≤30），`touch-action` 设好避免和原生滚动打架
- 模式/布局选择持久化到 surface state（别每次进来都重跑全量 force）

## Refs

- D3 force simulation docs（`forceManyBody` / `forceCollide` / `forceCenter` / `alphaMin` / `simulation.stop()`）
- Framer Motion `drag` / `dragConstraints` / `dragTransition`(power, timeConstant) / `dragElastic` / `layout`
- react-spring + `@use-gesture/react`（velocity → decay）
- Matter.js（Bodies / World / Engine / sleeping）
- Rapier 2D（`@dimforge/rapier2d`，WASM，deterministic）
