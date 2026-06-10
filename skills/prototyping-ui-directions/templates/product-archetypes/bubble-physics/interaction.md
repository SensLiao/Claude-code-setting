# Bubble-Physics — Interaction Spec

> 本文件定义 drag / throw / pinch / collision 四大交互的完整 spec、pointer + keyboard 双轨、全状态覆盖（idle / dragging / colliding / settling / disabled）、以及 perf governor（封顶活跃刚体）。
>
> 配套：pattern 列表见 `patterns-index.md`；spring 数值见 `motion-tokens.md`；引擎/freeze 见 `layout-engines.md`；红队 gate 见 `bubble-physics-rules.md`。

## 责任边界

本 spec **只**定义交互行为与状态机。

不做的事：
- 不定义视觉皮肤（颜色/字体/材质 → 锁定的 L3 风格）
- 不定义具体弹簧数值（→ `motion-tokens.md`）
- 不定义引擎选型/freeze 策略（→ `layout-engines.md`）
- 不写生产代码（→ Stage 3 prototype-engineer + frontend-design）

## 四大交互

每个交互按 **trigger / pointer / keyboard / physics / state / fallback / non-blocking** 七字段定义。

---

### 1. Drag（拖拽）

- **trigger**：pointerdown 命中可拖元素 + 移动超过 dead-zone（≥ 4px，防误触）
- **pointer**：
  - `pointerdown` → 元素进 `dragging` 态，挂 `will-change: transform`，`setPointerCapture`
  - `pointermove` → 元素 transform 跟随指针（spring 略滞后制造惯性，软体卡片接 Soft-body Pattern 8）
  - 实时采 `velocity` + `direction`（供松手抛掷用）
- **keyboard**（fallback，铁律 2）：
  - `Tab` 聚焦元素 → `Enter`/`Space` 拾起（进"键盘 grab"态，`aria-grabbed=true`）
  - 方向键移动：每按一次走固定 step（默认 16px，无惯性、无物理）
  - `Enter` 落下 / `Esc` 取消回原位
- **physics**：drag 中元素位置 = spring(target=指针)，stiffness 用 `--spring-snappy`；其它刚体对被拖元素做 Collision Repel(4)
- **state**：`idle → dragging → (settling | colliding) → idle`
- **fallback**：reduced-motion 下无滞后/无惯性，元素瞬时跟指针或直接点选点放
- **non-blocking**：drag 期间用户可 `Esc` 取消；可同时键盘操作别的元素；不冻结页面其它交互

### 2. Throw（抛掷 / 惯性甩出）

- **trigger**：`pointerup`/`pointercancel` 时 velocity > 阈值（如 > 0.2 px/ms）
- **pointer**：松手瞬间把 velocity 喂给 decay/`dragTransition`（token 见 `--throw-normal`）；元素带惯性滑行，friction 每帧衰减（0.95），velocity < 0.01 → settle
- **keyboard**：**无抛掷**——键盘是确定性移动（无惯性即是 fallback），不需要也不应模拟甩
- **physics**：
  - 滑行中遇容器边界 → rubber-band(超出 × 0.5) + spring 回弹（过冲 ≤ 16%，铁律 7）
  - 滑行中撞到其它刚体 → Collision Repel，动量传递（被撞者也受 clamp，不飞出界）
  - 若朝 Gravity Well(5) 方向 → 进 capture 半径后被吸落
- **state**：`dragging → throwing → (colliding) → settling → idle`
- **fallback**：reduced-motion 下**无抛掷**，松手即落在当前/最近合法位（瞬时）
- **non-blocking**：飞行中元素 `pointer-events: none`（不拦下方控件，铁律 6）；用户可点别处打断

### 3. Pinch（双指缩放 / 可选）

- **trigger**：双指 `touchstart`（或 trackpad pinch）—— **仅** 在产品确有"缩放气泡场/标签云密度"需求时实现，非必备
- **pointer**：双指距离变化 → 缩放容器或调整 force 的 `forceManyBody` strength（簇散开/聚拢）；单指退回 drag
- **keyboard**：`+` / `-` 离散缩放（4 档），或 `Ctrl + 滚轮`
- **physics**：缩放改变碰撞密度时，d3-force 重新松弛（短 alpha 脉冲）后 freeze
- **state**：`idle → pinching → settling → idle`
- **fallback**：reduced-motion 下缩放为离散 step，无 force 重排动画，直接给目标密度终态
- **non-blocking**：pinch 中可随时抬指；不与原生页面缩放打架（`touch-action` 设好）

### 4. Collision（碰撞）

- **trigger**：两刚体几何重叠（拖动/抛掷/新增元素挤入时）
- **pointer**：被推元素自动让位（不需用户额外操作）
- **keyboard**：键盘移动撞到占用位时，目标元素同样被 repel 让出（保持一致语义）
- **physics**：
  - broadphase 先筛邻近对（grid/quadtree），只对邻近做窄相位（铁律 3，无 O(n²)）
  - 重叠 → 沿连心线施分离冲量；被推元素带阻尼回流
  - 活跃碰撞对 ≤ 设备预算（desktop 120 / mobile 50）
- **state**：触发 `colliding` 子态，分离完成回 `settling → idle`
- **fallback**：reduced-motion 下无碰撞动画，元素直接落在 force/grid 算出的非重叠终态
- **non-blocking**：碰撞计算不阻塞主线程交互（重场景用 Rapier WASM/worker）

---

## 全状态覆盖（状态机）

每个物理元素必须显式实现这 5 个状态（少一个即驳回）：

```
        ┌──────────────────────────────────────────┐
        ▼                                            │
     ┌──────┐  pointerdown/Enter   ┌──────────┐      │
     │ idle │ ───────────────────▶ │ dragging │      │
     └──────┘                      └──────────┘      │
        ▲                            │   │           │
        │                    pointerup│   │overlap    │
        │              (v>阈值)│       │   ▼           │
        │                      ▼       │ ┌───────────┐ │
        │                 ┌─────────┐  │ │ colliding │ │
        │                 │ throwing│──┼▶└───────────┘ │
        │                 └─────────┘  │      │        │
        │                      │       │      ▼        │
        │                      ▼       ▼  ┌──────────┐ │
        │                    ┌────────────│ settling │─┘
        │     v<0.01         │            └──────────┘
        └────────────────────┘
                  (sleep, 停 RAF)

  disabled ── 独立态：不可拖、不参与碰撞、不接收物理（视觉 dimmed）
```

| 状态 | 含义 | 视觉/行为契约 | 退出条件 |
|------|------|--------------|----------|
| **idle** | 静止可交互 | 正常态；hover/focus 有 affordance（cursor: grab） | pointerdown / Enter |
| **dragging** | 被指针/键盘抓住 | cursor: grabbing；`aria-grabbed=true`；spring 跟随 | pointerup / Enter 落下 / Esc |
| **throwing** | 松手后惯性滑行 | `pointer-events:none`；friction 衰减 | 撞墙/撞物 → colliding；v<0.01 → settling |
| **colliding** | 与他者分离中 | 分离冲量；被推者阻尼回流 | 分离完成 → settling |
| **settling** | 收敛到 rest | spring 趋稳；过冲 ≤ 预算 | v<0.01 → idle（sleep） |
| **disabled** | 不可用 | dimmed；不可聚焦拖动；退出模拟 | 被重新 enable |

> **不可达性裁决**（铁律 6）：`throwing`/`colliding` 中的元素**不抢 focus**、**不拦下方点击**；任何时刻 `Esc`/点击别处可打断回 idle。

## Pointer ⊕ Keyboard 双轨对照表

| 操作 | Pointer | Keyboard（fallback） |
|------|---------|---------------------|
| 选中 | click/tap | Tab 聚焦 + Enter/Space |
| 拾起 | pointerdown 拖 | Enter/Space（grab） |
| 移动 | 拖动（带物理） | 方向键 step 16px（无物理） |
| 抛掷 | 快速甩 + 松手 | —（无；确定性移动即 fallback） |
| 放下 | pointerup | Enter（落下） |
| 取消 | —（拖回） | Esc（回原位） |
| 缩放 | pinch | `+`/`-` / Ctrl+滚轮 |

> 纯键盘必须能 100% 完成任务（铁律 2）；物理是 pointer 路径的增强，键盘路径**不含**物理。

## Perf Governor（性能治理 / 封顶活跃刚体）

物理 surface 必须内建以下治理（对应铁律 1/3/4）：

1. **活跃刚体上限**：desktop 60 / tablet 40 / mobile 30。超出 → 视口外/远指针刚体 `sleep`（freeze），不参与 tick。
2. **帧预算守护**：tick+render ≤ 16.7ms。连续 10 帧 > 20ms → 降级链：① 降 force iterations → ② sleep 远处刚体 → ③ 降 tick 率（60→30Hz）→ ④ 退化为静态布局。
3. **broadphase 强制**：碰撞先 grid/quadtree 筛，禁止裸 O(n²)。
4. **sleep / wake**：velocity < 0.01 → sleep + 停 RAF；用户操作/新元素/tab 可见 → wake。
5. **`will-change` 生命周期**：只在 dragging/active 挂 `will-change: transform`，settling 后摘除（常挂会吃显存）。
6. **tab 隐藏冻结**：`document.hidden` → freeze 全场，省电。
7. **虚拟化**：列表型（Elastic List）元素 > 50 时虚拟化，只对可视区元素跑 spring。

## 出口 artifact

本 archetype 在 Stage 3 完成时，variant 必须产出：

- 至少 1 个**真能跑**的 physics surface（真拖、真甩、真撞、真 settle），覆盖 Drag(1) + Throw(2) + 至少一个 cluster/collision pattern
- 该 surface 的 reduced-motion 静态终态版（双轨快照）
- variant readme 声明：用的引擎 + 主 spring preset + 刚体预算 + L3 皮肤约束下的 preset 降级说明
- 8 铁律红队 checklist 全绿（`bubble-physics-rules.md`）

## 失败模式

| 症状 | 急救 |
|------|------|
| 拖拽掉帧/卡顿 | 查是否动了 `top/left`（应 transform）；查刚体数是否超预算；挂 `will-change` |
| 元素永远在轻微抖动 | settle 阈值没生效——加 velocity<0.01 → sleep + stop RAF（铁律 4） |
| 键盘用户无法完成任务 | 漏了 keyboard fallback——补 Tab/Enter/方向键路径（铁律 2） |
| 飞行元素挡住按钮点不到 | 飞行态没设 `pointer-events:none`（铁律 6） |
| 元素被甩出屏幕回不来 | 缺容器 clamp + rubber-band（铁律 7） |
| 在 luxury 皮肤下弹得很廉价 | preset 没降级——luxury 只准 gentle（铁律 8 + motion-tokens L3 表） |
| reduced-motion 下还在弹 | fallback 写成"慢物理"了——必须是**无物理**静态终态（铁律 5） |
