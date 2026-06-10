# Creative-Eye — Reference Anchors

> **Gold-standard 范例锚点**。Stage 1 的 reference-grounding pipeline 直接消费本文件：它把这些真实站点/作品当作「真·设计情报」去抓取与提炼，让 direction 候选 ground 在实际存在的高水准交互上，而不是 AI 脑补的泛设计。
>
> 每个锚点 = 名字 / 在哪找 / 为什么是标杆 / 要研究的「那一件事」。
>
> **使用纪律**：研究的是**技法与决策**（lerp 手感、effect budget、fallback 取舍、构图意图），**不是复刻视觉**。视觉皮肤由锁定的 L3 决定；这些锚点教的是「交互怎么做对」。这些是「向哪学」的指北针，不是「抄哪个」的素材库。

## 锚点清单

### 1. Active Theory

- **在哪找**：activetheory.net（其作品集 / case 页）；Awwwards profile「Active Theory」
- **为什么是标杆**：WebGL/创意交互的天花板级 studio，把 shader、3D、cursor 交互、page-transition 融成有叙事的整体；多个 Site of the Year / FWA。
- **研究那一件事**：**WebGL hero 与 DOM 内容如何分层共存** —— 重 WebGL 视觉永远是背景/装饰层，关键文案与导航始终是可访问的 DOM（直接印证铁律 5）。看它如何在不牺牲内容可达性的前提下把 WebGL 拉满。

### 2. Locomotive

- **在哪找**：locomotive.ca；其开源库 `locomotive-scroll`（GitHub: locomotivemtl/locomotive-scroll）
- **为什么是标杆**：Montreal agency，定义了一代「smooth-scroll + 视差 + 编辑式构图」的范式；locomotive-scroll 被无数 Awwwards 站采用。
- **研究那一件事**：**smooth scroll 驱动的视差与 reveal 编排** —— scroll 进度如何映射到分层位移与揭示，以及（关键）如何在 reduced-motion / 低端设备下退化（印证铁律 3 + 7 的 scroll 纪律）。注意现在新项目多用 Lenis（见 #3），但 Locomotive 是理解这套范式的原点。

### 3. Studio Freight / lenis

- **在哪找**：库 → GitHub `darkroomengineering/lenis`（前 Studio Freight）；范例站 → studiofreight.com 旧站、basement.studio、lenis 官方 demo
- **为什么是标杆**：Lenis 是当下 creative 站 smooth-scroll 的事实标准（轻、与 GSAP ScrollTrigger 同步好、尊重 prefers-reduced-motion）。Studio Freight/Basement 的站本身就是 cursor + scroll + WebGL 协同的范本。
- **研究那一件事**：**smooth scroll 如何与 GSAP ScrollTrigger 用同一个 rAF 同步**，以及 Lenis 对 reduced-motion 的内建尊重 —— 这是「顺滑但不晕、可降级」的工程基线（直接对应 `layout-engines.md` 的库纪律 + 铁律 3/7）。

### 4. Igloo Inc

- **在哪找**：igloo.inc；Awwwards「Site of the Year」获奖页（近年 SOTY）
- **为什么是标杆**：近年 WebGL/3D 沉浸体验的标杆级获奖站，3D 场景 + cursor 交互 + 滚动叙事高度融合，性能与质感都在线。
- **研究那一件事**：**重 3D 体验的性能预算与加载编排** —— 大体量 WebGL 如何懒加载、如何在进入视口才启动、如何对低端设备降级，而不是一进站就把首屏拖死（印证铁律 7 的资源 + 可见性暂停 + code-split）。

### 5. Aristide Benoist

- **在哪找**：aristidebenoist.com；Awwwards profile「Aristide Benoist」
- **为什么是标杆**：个人 creative developer portfolio 的范本，custom cursor、磁吸、hover-reveal、distortion 用得克制又有人格 —— 是「个人站怎么做出 studio 级交互」的教科书。
- **研究那一件事**：**custom cursor + 磁吸 + cursor-state morph 的手感与克制度** —— lerp 跟手、磁吸只给关键目标、光标随上下文变形（VIEW/DRAG），且不滥用（直接对应 pattern #1/#2/#12 与 effect budget 铁律 4）。

### 6. Cuberto

- **在哪找**：cuberto.com；其开源 cursor 库（GitHub: `cuberto/mouse-follower`）；Awwwards profile「Cuberto」
- **为什么是标杆**：以「光标即体验」著称的 studio，cursor-follow、磁吸、cursor-state morph 是其招牌；`mouse-follower` 库是社区做自定义光标的常用起点。
- **研究那一件事**：**cursor-state morph 的状态机设计** —— 光标如何根据 hover 目标（链接/作品/拖拽/媒体）切换形态与文字标签，以及 dot 贴真实坐标、ring 滞后缓动的两层结构（直接对应 pattern #12 + 铁律 8 的「不劫持/不丢语义」）。

### 7. Dennis Snellenberg

- **在哪找**：dennissnellenberg.com；Awwwards profile / SOTD 获奖页
- **为什么是标杆**：多次 SOTD 的个人 portfolio，page-transition、cursor、hover-reveal、文字动效编排成丝滑整体，是「过渡与连续性」的范本。
- **研究那一件事**：**page-transition curtain 与路由连续性** —— 跳转如何用幕布/clip-path 掩盖加载、保持仪式感，同时保证浏览器后退即时、过渡可中断、reduced-motion 退化（直接对应 pattern #9 + 铁律 2/3）。

### 8. Codrops（Tympanus demos）

- **在哪找**：tympanus.net/codrops（Articles + Playground）；GitHub `codrops`
- **为什么是标杆**：creative web 交互技法的最大公开教学库 —— image-trail、distortion hover、text scramble/decode、WebGL 效果几乎都能找到带源码的可复现 demo。是把「想法」落成「技法」的第一查处。
- **研究那一件事**：**单个交互技法的最小可复现实现** —— 比如 hover image-trail、`feDisplacementMap` distortion、scramble text 的具体做法与参数（对应 pattern #4/#5/#7）。**注意**：Codrops demo 多为「炫技裸 demo」，常**不含** touch/键盘/reduced-motion 兜底 —— 取其技法，但必须按本 archetype 八铁律补全三轨兜底再用。

### 9. Awwwards — Site of the Day / Developer Award

- **在哪找**：awwwards.com/websites（按 Site of the Day / Honorable Mentions / Developer Award 筛）；awwwards.com/awwwards/collections
- **为什么是标杆**：creative-interaction 的**当下水位线**与趋势风向标 —— 想知道「今年这类站在玩什么交互、什么算高水准」，这里是活的、滚动更新的真相源。
- **研究那一件事**：**当前 SOTD 在 cursor/gaze/WebGL/transition 上的共性技法与 effect budget 取舍** —— 拿来校准「现在的高水准是什么样」，避免 ground 在过时范式上。Stage 1 抓 reference 时优先从近 3-6 个月的 SOTD / Developer Award 取样。

### 10. FWA (thefwa.com)

- **在哪找**：thefwa.com（FWA of the Day / FWA of the Month）
- **为什么是标杆**：与 Awwwards 并列的实验性/技术驱动 web 体验权威评选，更偏「技术野心与沉浸感」一端，WebGL/3D/实验导航的标杆富集地。
- **研究那一件事**：**实验性导航与沉浸入口的范式** —— 非线性、cursor-driven、3D 空间化的导航怎么做得既惊艳又不让用户迷路（对应 README 的「实验性导航」适用场景 + 铁律 2 的可达性）。

---

## reference-grounding pipeline 取样指引

> 给 Stage 1 reference 抓取的操作约定：

1. **优先活水源**：#9 Awwwards SOTD / #10 FWA 取近 3-6 个月样本 —— 校准「当下水位」，别 ground 在过时范式。
2. **技法查处**：具体某个 pattern 不会做 → 去 #8 Codrops 找带源码 demo，但**必补三轨兜底**（Codrops demo 通常不含 a11y/touch/reduced-motion）。
3. **studio 级整体性**：要学「多效果如何协同成一个有人格的整体」→ 看 #1 Active Theory / #2 Locomotive / #6 Cuberto / #7 Dennis Snellenberg。
4. **个人站可达性**：做个人 portfolio → #5 Aristide Benoist / #7 Dennis Snellenberg 是「个人体量 + studio 级交互 + 克制」的最佳参照。
5. **WebGL 性能现实**：重 3D → #4 Igloo Inc / #1 Active Theory 学加载编排与降级，别只看效果不看代价。
6. **工程基线库**：smooth scroll → #3 Lenis；scroll 范式原点 → #2 locomotive-scroll；cursor 起点库 → #6 Cuberto `mouse-follower`。

## 取用红线

- ❌ **不复刻视觉**：锚点教交互技法/决策，不是视觉素材；视觉皮肤永远由锁定的 L3 提供
- ❌ **不照搬裸 demo**：Codrops / 裸技法 demo 常缺 touch/键盘/reduced-motion —— 必须按八铁律补全三轨兜底
- ❌ **不 ground 在过时范式**：优先近期 SOTD/FWA 样本，老站只用于理解原理
- ❌ **不堆砌**：看到 10 个站 10 种炫技 ≠ 一个站全上 —— 受 effect budget（铁律 4）约束，按本产品的人格选 2-4 个 pattern
- ✅ **学的是**：lerp 手感 / 磁吸克制度 / WebGL 分层与降级 / 过渡连续性 / cursor 状态机 / scroll 工程基线 / effect budget 取舍
