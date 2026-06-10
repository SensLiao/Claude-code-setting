# Reference Anchors — Bubble-Physics

> 8 个 real gold-standard physics-UI 范例。Stage 1 reference-grounding pipeline 消费本文件：选哪些去研究、研究时盯哪一个点。
>
> 每条 = **name + where to find it + why exemplary + the ONE thing to study**。不要泛泛"看看人家做得好"——每条都给一个**单点研究目标**，落到具体物理量。
>
> ⚠️ 这些是**学物理手感 / 交互逻辑**的标杆，**不是**抄视觉皮肤（皮肤走锁定的 L3）。研究产出进 Stage 2 extract card 的 "physics pattern observed" 一节。

---

## 1. Apple iMessage —— Bubble & Screen Effects

- **where**：iOS Messages app → 发消息长按发送键 → "Send with Effect"（Slam / Loud / Gentle / Invisible Ink + 全屏 Balloons/Confetti）。Apple HIG "Playing haptics" / WWDC 历年 Messages session。
- **why exemplary**：把"消息气泡"做成有质量的物理对象的鼻祖级范例。Slam 是带 overshoot + settle 的冲击；Gentle 是低 stiffness 软落；每个 effect 都**自动 settle**、不永动、有 reduced-motion 兜底（系统级 Reduce Motion 下退化）。是"物理服务于情绪表达、但不挡正事"的教科书。
- **the ONE thing to study**：**Slam 效果的 squash-and-settle 时序**——冲入时的 overshoot 量、回弹次数、多久静止。对照我们 `--spring-bouncy` 该不该再收一点。

## 2. iOS Dynamic Island + Control Center —— 软体形变 & 弹性展开

- **where**：iPhone（14 Pro 起）灵动岛交互；任意 iOS 下拉 Control Center → 长按模块展开。WWDC23 "Design for the Dynamic Island"。
- **why exemplary**：Dynamic Island 的合并/分裂是**fluid soft-body morph**（两个形状像液体一样融合/分离），不是 crossfade。Control Center 模块展开是带轻微过冲的 spring，松手回弹。是"形变也走物理、且永远 settle 到确定终态"的标杆——直接对应我们的 Soft-body Card(8) 和 Magnetic Snap(3)。
- **the ONE thing to study**：**灵动岛 morph 的"不抢操作"特性**——形变进行中你仍能点它、点别处，物理从不锁交互（我们的铁律 6）。研究它怎么在 in-flight 时保持可点击。

## 3. Framer Motion —— `drag` + `dragTransition` 惯性拖拽

- **where**：framer.com/motion → Gestures / Drag 文档；examples 有可拖卡片 + `dragConstraints` + `dragElastic` + `dragTransition={{ power, timeConstant }}` 的活 demo。
- **why exemplary**：把"拖-甩-惯性-边界回弹"封装成最干净的声明式 API，是 React 生态做 Drag-and-Throw(2) + Rubber-band(7) 的事实标准起点。`dragElastic` 直接是橡皮筋过冲、`dragTransition` 直接是抛掷衰减。
- **the ONE thing to study**：**`power` 与 `timeConstant` 怎么映射到"甩多用力=飞多远"**——拿它的默认值校准我们 `--throw-normal`(power 0.6 / timeConstant 350) 的手感是否一致。

## 4. react-spring + @use-gesture (pmndrs) —— velocity → spring 的标准接法

- **where**：react-spring.dev（pmndrs/react-spring，~29K★）+ use-gesture.netlify.app（`useDrag`/`usePinch`）。官方 sandbox 有 "Draggable list" / "Cards" / "Slingshot" 物理 demo。
- **why exemplary**：展示了**手势 velocity 如何喂给 spring** 的最细粒度控制（`useDrag` 取 `velocity`/`movement` → `api.start({ config })`）。`{ stiffness, damping, mass }` 直接对应我们 motion-tokens 的四档 preset，是把 token 落地的参考实现。还强调 draggable 必须设 `touch-action`（避免和原生滚动打架，我们 Pinch spec 也写了）。
- **the ONE thing to study**：**Draggable list demo 的"被拖项让位 + 其余项 spring 重排"**——直接对应 Elastic List(6) + Collision Repel(4) 的组合实现。

## 5. Things 3 (Cultured Code) —— Magic Plus 拖拽创建

- **where**：culturedcode.com/things → Features "Magic Plus" + Support "Using Gestures"。iOS/iPad app 内：拖 ➕ 按钮到列表任意处插入、拖到左下 Inbox target 直送收件箱。60fps.design 有逐帧拆解。
- **why exemplary**：两届 Apple Design Award。把一个"新建"动作做成有重量的可拖物理对象，拖到哪插到哪、有 magnetic-snap 到插入点 + drop target 吸附（我们的 Magnetic Snap(3) + Gravity Well(5)）。关键是**物理增强了一个本可以用普通按钮完成的操作，却没把它变复杂**——点一下仍是普通新建，拖才触发物理。完美诠释"物理是 enhancement 不是 access"（铁律 2）。
- **the ONE thing to study**：**插入点的 magnetic-snap 反馈**——拖动时列表如何实时让出间隙、➕ 如何吸附到最近合法插入位。这是 Magnetic Snap 做"对齐又不死板"的黄金样本。

## 6. Tinder / Bumble —— 卡片堆叠 swipe 物理

- **where**：Tinder / Bumble app 主界面卡片堆；开源复刻参考 `react-tinder-card`（npm）、`Swipeable` 类库。
- **why exemplary**：定义了"卡片 swipe"的物理语汇——拖动时卡片**随位移倾斜**（rotateZ 跟手）、超过阈值带 velocity 飞出、未过阈值 spring 回弹归位、下方卡片随之上浮。是 Soft-body Card(8) + Drag-and-Throw(2) + 阈值判定的最普及范例。
- **the ONE thing to study**：**拖动位移 → rotateZ 的映射曲线 + 飞出/回弹的阈值判定**——位移多少度数、velocity 多大算"决定飞出"。校准我们 Soft-body 的 rotate ≤ 8° 是否够表达力，以及 throw 触发阈值（> 0.2 px/ms）。

## 7. Matter.js Demos (liabru) —— 真刚体动力学参照系

- **where**：brm.io/matter-js → Demos（Newton's Cradle / Ball Pool / Chains / Avalanche / Basic Soft Bodies / **Sleeping** / Grid Broadphase）。GitHub liabru/matter-js，examples 目录有全部源码 + CodePen。
- **why exemplary**：当需要**真重力 / 真碰撞 / 堆叠**时的参照系。特别看两个工程 demo：**"Sleeping"**（刚体静止后 sleep 省 CPU——正是我们铁律 4 的 settle/sleep）和 **"Grid Broadphase"**（碰撞前网格筛选——正是我们铁律 3 禁 O(n²) 的做法）。"Ball Pool" 是 Bubble Cluster(1) 的真物理版参照。
- **the ONE thing to study**：**"Sleeping" demo 的 sleep 阈值与唤醒逻辑**——刚体多久无运动进入 sleep、什么触发 wake。直接搬进我们 Settle-to-Rest(11) 的实现（velocity < 0.01 → sleep + 停 RAF）。

## 8. Stripe —— 物理驱动的产品演示 / 交互细节

- **where**：stripe.com 历年首页与产品页的交互演示（如可拖动的 3D 元素、带惯性的卡片、press-感反馈的按钮）；Stripe Press 站点；Stripe 的 "Increment" 工程博客谈 web 动效性能。
- **why exemplary**：商业级标杆——证明物理能用在**高端 B2B 品牌**而不显廉价：克制的 spring、压力感的按钮、绝不 over-bounce、全程 60fps、transform-only。正是我们铁律 8（不污染主视觉）+ 铁律 1（性能红线）在真实付费产品上的体现。是 "luxury/professional 皮肤下物理该多克制" 的活样本（对照 README §How it COMPOSES 的 luxury → 仅 gentle）。
- **the ONE thing to study**：**它的"压力感/弹性"幅度有多小**——Stripe 的 spring 几乎只有一点点 overshoot。量一下，作为我们 `--spring-gentle`（luxury 档）的上限标尺：高级感 = 物理在场但几乎察觉不到。

---

## 研究产出约定

- 每个被选中研究的 anchor → Stage 2 extract card 写一节，至少记：**spring 手感（估算 stiffness/damping 档）/ 碰撞策略 / settle 时间 / 是否守住"不挡操作"**。
- 把观察到的具体数值/时序回填校准 `motion-tokens.md` 的四档 preset 与 `--throw-*`。
- **只学物理与交互逻辑**，视觉皮肤一律交给锁定的 L3——anchor 的颜色/字体不进我们的 token。
