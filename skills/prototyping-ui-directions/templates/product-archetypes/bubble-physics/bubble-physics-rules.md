# Bubble-Physics — 八条铁律（gate 形式）

> 任何 bubble-physics 相关 artifact 必须每条都打勾才放行。这是**红队 gate**，不是建议。违反任意一条立即驳回。
>
> 设计哲学：物理是 **enhancement**，不是 access。它让对的东西更有体感，但绝不能成为"完成任务的唯一通道"或"永动的视觉噪音"。

---

## 铁律 1 · 物理只走 transform / opacity（性能红线）

物理驱动的动画**只允许**改这些属性：

- ✅ `transform`: `translate3d` / `scale` / `rotate` / `skew`
- ✅ `opacity`
- ✅ （慎用）`filter`、`clip-path`——非主物理量，单屏 ≤ 2 处

**禁止物理驱动**：`width` / `height` / `top` / `left` / `right` / `bottom` / `margin` / `padding` / `border-width` / `font-size`（这些触发 layout/reflow，物理每帧 60 次必崩）。

**帧预算**：物理 tick + 渲染 ≤ **16.7ms/帧**（60fps）。掉到 < 50fps（>20ms）持续 10 帧 → 自动降级（减刚体 / 降 tick 率 / freeze 远处）。

- [ ] 所有物理动画只动 transform/opacity（grep 确认无 `width/height/top/left` 在 animation 路径）
- [ ] 用 `transform: translate3d` 而非 `top/left` 定位刚体
- [ ] 有帧率守护：掉帧触发降级而非硬扛
- [ ] `will-change: transform` 只在 drag/活跃期挂，settle 后摘除

---

## 铁律 2 · 每个 drag 必有非物理 fallback（可达性红线）

任何"拖拽才能完成"的操作，必须有**等价的非物理路径**：

- 键盘：`Tab` 聚焦 → 方向键移动（每按一次走固定 step，无惯性）/ `Enter`/`Space` 选中或拾起 → 方向键放置 → `Enter` 落下；`Esc` 取消
- 或 tap/click：点一下选中、点目标区放置（无需拖）
- 拖拽元素必须是真可聚焦控件（`tabindex` + `role` + `aria-label` + `aria-grabbed`/`aria-pressed` 状态）

物理（惯性、回弹、碰撞）是这条路径之上的**视觉增强**，不是它的前提。

- [ ] 每个 draggable 有键盘等价操作（聚焦 + 方向键/Enter）
- [ ] 每个 draggable 有 tap-to-select/place 等价路径
- [ ] draggable 是可聚焦控件，带 role + aria-label + grab 状态
- [ ] 用键盘可以 100% 完成任务，全程不触发任何物理

---

## 铁律 3 · 碰撞有预算（性能 + 复杂度红线）

同屏活跃刚体数硬上限：

| 设备 | 活跃刚体上限 | 同时碰撞对上限 |
|------|------------|---------------|
| Desktop | **60** | ~120（窄相位后） |
| Tablet | 40 | 80 |
| Mobile | **30** | 50 |

- 碰撞检测**禁止**裸 O(n²)——必须先 broadphase（grid / quadtree / 引擎内置 SAP），只对邻近对做窄相位
- 超预算时：视口外/远离指针的刚体 `sleep` 或 freeze（接铁律 4），只保留交互焦点附近活跃
- d3-force 的 `forceCollide` 迭代数 ≤ 3（再高 CPU 不划算）

- [ ] 活跃刚体数在设备上限内（移动端 ≤ 30）
- [ ] 有 broadphase，无 O(n²) 全对检测
- [ ] 超预算有 freeze/sleep 降级策略
- [ ] forceCollide iterations ≤ 3

---

## 铁律 4 · 必须 settle（不许永动）

任何 spring / 抛掷 / 碰撞激发的运动，必须在有限时间内**静止**：

- settle 时限：交互后运动 **≤ 1.2s** 内收敛（velocity < 0.01 → sleep，停 RAF）
- d3-force：alpha 衰减到 `alphaMin` 后调 `simulation.stop()`，不留常驻 tick
- **禁止** 永不停的 ambient float / 持续 jitter / 无限循环 `@keyframes`（除非用户**明确**要"活的背景"且单独评估，且仍受 reduced-motion 兜底）
- settle 后 CPU 占用回归 ~0（无 RAF 空转）

- [ ] 每个物理运动 ≤ 1.2s 内 settle 到静止
- [ ] settle 后停止 RAF / `simulation.stop()`，CPU 归零
- [ ] 无永动浮动/抖动（或经单独评估且有 reduced-motion 兜底）
- [ ] settle 阈值（velocity < 0.01）已实现且生效

---

## 铁律 5 · `prefers-reduced-motion` → 静态布局（不是慢物理）

`@media (prefers-reduced-motion: reduce)` 命中时，给**确定的静态终态**：

- 直接渲染 grid / list 的**最终位置**，**无** spring、**无** 惯性、**无** 碰撞动画、**无** 浮动
- 拖拽降级为：点选 + 点放（瞬时落位，至多 100ms opacity 过渡维持因果可读）
- 这是"**没有物理**"，**不是**"放慢的物理"或"低 stiffness 的物理"——简化幅度不达标即驳回
- 状态变化仍须可感知（选中态用 border/背景，不靠 bounce 传达）

- [ ] reduced-motion 下是静态布局终态，零 spring/惯性/碰撞
- [ ] 拖拽在 reduced-motion 下降级为点选点放
- [ ] 不是"慢一点的物理"——确实移除了物理
- [ ] 选中/分组等状态在无动效下仍清晰可辨

---

## 铁律 6 · 物理绝不困住 focus / 阻塞任务（可用性红线）

飞行中、漂浮中、碰撞中的元素**不得**干扰任务完成：

- 运动中的气泡**不抢** keyboard focus、**不偷** focus ring
- 飞行中的元素**不拦截** click/tap 命中下方真实控件（飞行态可 `pointer-events: none` 直到 settle）
- **任何时刻**核心 CTA（提交/下一步/关闭）都可达、可点、不被漂浮元素遮挡或推走
- 物理动画**可被打断**：用户操作立即响应，不等动画跑完（接 interaction.md 的 interruptibility）
- 焦点顺序稳定：物理重排**不**改 DOM tab 顺序（视觉位置变，逻辑顺序不变）

- [ ] 运动元素不抢 focus、不偷 focus ring
- [ ] 飞行元素不拦下方控件的点击
- [ ] 核心 CTA 任何时刻可达，不被物理元素遮挡/推走
- [ ] 物理可被用户操作随时打断
- [ ] tab 顺序不被物理重排打乱

---

## 铁律 7 · 抛掷有边界与摩擦（约束红线）

momentum 不许"飞出去回不来"：

- 抛掷必须有 **friction 衰减**（速度按帧乘衰减系数，如 0.92–0.96），不能匀速永动
- 容器边界 **clamp**：元素中心不许移出可视区；越界用 rubber-band resistance（超出量 × ≤0.5）+ spring 回弹
- rubber-band/over-scroll 过冲 **≤ 容器尺寸 16%**
- 多刚体场景抛掷不许把别的刚体撞飞出界（被撞元素同样受 clamp）

- [ ] 抛掷有 friction 衰减，非匀速
- [ ] 容器边界 clamp，元素不会飞出且回不来
- [ ] over-scroll/rubber-band 过冲 ≤ 16%
- [ ] 碰撞不会把元素永久撞出可视区

---

## 铁律 8 · 不污染主视觉（克制红线 + L3 从属）

物理是**系统运动逻辑**，不是产品视觉主调：

- wobble/bounce 幅度受锁定的 **L3 视觉风格**约束（皮肤优先，见 README §How it COMPOSES）：
  - `luxury` → 仅 gentle（过度弹跳破坏高级感）
  - `taste` → gentle / snappy
  - `brutalist` → snappy / bouncy 可
- 装饰性物理（浮动 logo / 背景粒子）单屏累计 ≤ 2 处，且受铁律 4 settle 约束
- **禁止** 把整个产品做成"物理 playground 海报"——除非产品本体就是 explorable playground
- 物理**不改** palette / typography / 视觉层次（那是 L3 的地盘）

- [ ] spring preset 在锁定 L3 允许档内（luxury 无 wobbly/bouncy）
- [ ] 装饰性物理单屏 ≤ 2 处
- [ ] 产品没被做成"物理炫技海报"
- [ ] 物理未篡改 L3 的颜色/字体/层次

---

## 一页红队总表

```
□ 1 transform/opacity-only，≥60fps，掉帧降级
□ 2 每个 drag 有键盘 + tap 双 fallback，纯键盘可完成任务
□ 3 刚体预算（desktop≤60 / mobile≤30），broadphase，无 O(n²)
□ 4 ≤1.2s settle，settle 后 CPU 归零，无永动
□ 5 reduced-motion → 静态终态（不是慢物理）
□ 6 物理不抢 focus / 不拦点击 / 不挡 CTA / 可打断
□ 7 抛掷有 friction + 边界 clamp，过冲 ≤16%
□ 8 preset 守 L3 约束，装饰 ≤2 处，不污染主视觉
```

> 8 条全绿才算 review-ready。任一条红 = 驳回重做，不接受"差不多"。
