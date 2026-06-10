# Narrative-Scrolly — 八条铁律（gate 形式）

> 任何 narrative-scrolly 相关 artifact 必须**每条都打勾**才放行。这是 Stage 3 红队的 archetype-specific gate，不是"建议"。
> 违反任意一条 = 驳回。带具体数字的卡点不许"差不多"。

## 红队 checklist（先扫这个）

- [ ] **铁律 1**：关 JS / 开 `prefers-reduced-motion` 后，故事**按叙事顺序完整可读、信息零丢失**
- [ ] **铁律 2**：不劫持 native scroll velocity；smooth-scroll lerp ≥ 0.1 且 reduced-motion 下关闭；无强制 scroll-snap 夺滚
- [ ] **铁律 3**：每个 pin / sticky 段滚动距离 ≤ **3×100vh**
- [ ] **铁律 4**：键盘 Tab 顺序 = 视觉/叙事顺序；有 skip-link；step 内容不靠滚动才可聚焦
- [ ] **铁律 5**：LCP < **2.5s**、CLS < **0.1**；所有 sticky/sequence/reveal 容器预留尺寸
- [ ] **铁律 6**：step trigger 用 IO / ScrollTrigger 回调，**防抖 + 幂等**；裸绑 `scroll` 事件 = 驳回
- [ ] **铁律 7**：scroll-tied 动画只动 `transform / opacity / clip-path`；scrub 里出现 layout 属性 = 驳回
- [ ] **铁律 8**：长故事有进度感（progress bar 或 chapter dots）；reveal 一次只揭一个叙事单元

---

## 铁律 1 · No-JS / reduced-motion 下故事完整可读（第一性原理）

**Gate**：把 prototype 在 ① JS 禁用 ② `prefers-reduced-motion: reduce` 两种条件下各截一次全文长图。两张图都必须是**一篇能读完的完整故事**。

- 所有正文、图表数据、图片、章节标题在静态/降级态全部存在且**按叙事顺序**排列。
- scroll effect（pin / scrub / reveal / parallax）是**渐进增强**，绝不是内容的唯一承载。
- 判失败的典型：关 JS 后空白 / 只剩骨架 / step 文字叠在一起 / 图表消失 / sticky 容器塌成 0 高。
- 数据故事尤其要命：图表在 reduced-motion 下必须显示**完整静态版 + 全部注释**（不分步而已，数据一个不少）。

> 这是整套 archetype 的地基。一个"关掉动效就读不了"的 scrollytelling 直接出局，其余七条都不用看。

## 铁律 2 · 绝不劫持滚动速度 / 不夺滚

**Gate**：用户滚动手感必须接近 native。

- ❌ 禁止改写 wheel/touch 的 native velocity 做"滚一格跳一屏"的强制 scroll-snap 夺滚（CSS `scroll-snap-type: mandatory` 全页夺滚禁用；如需 snap 用 `proximity` 且单幕局部）。
- smooth-scroll（Lenis 等）允许，但 **lerp 阻尼 ≥ 0.1**（不许做成"滑很久停不下来"的果冻滚），且 `prefers-reduced-motion` 下**完全禁用** smooth-scroll，回退原生滚动。
- ❌ 禁止在滚动中段拦截并反向"吸附"，禁止禁用滚动（除非是有明确 skip 出口的短暂 pin，且计入铁律 3 预算）。
- Mac 触控板/惯性滚动、移动端橡皮筋必须正常工作。

## 铁律 3 · 单个 pin section ≤ 3 视口高

**Gate**：任意一个 `pin: true` 或 `position: sticky` 钉住的段，其滚动距离（ScrollTrigger `end` 折算）≤ **3 × 100vh**。

- 超过 3 屏的"原地停留"会让用户产生"是不是卡住了 / 还要滚多久"的焦虑甚至误以为页面坏了。
- 一个 sticky-visual + stepped text 段的 step 总数控制在 **3–6 步**为宜（每步约 1 屏，含图形容器自身 1 屏，总滚动 ≤ 3–4 屏；若步数多，拆成两个独立 sticky 段）。
- pin 是稀缺强调资源：**全页 pin 段数量建议 ≤ 3 个**，不许每章都 pin。
- horizontal act 的等效纵向距离同样计入此预算。

## 铁律 4 · 键盘可达 + skip-link + 焦点顺序

**Gate**：纯键盘 + 屏读器能读完整个故事。

- **Tab/焦点顺序 = DOM 顺序 = 视觉/叙事顺序**；绝不用 CSS（order/absolute/transform）把视觉顺序与 DOM 顺序拧开导致焦点乱跳。
- 页首提供 **skip-link**："跳到正文" + （若有重开场动画）"跳过开场动画"。
- 章节提供锚点导航（`#chapter-N`），键盘可达；锚点跳转尊重 reduced-motion（不强制 smooth）。
- step 里的可交互元素（链接/按钮/图表控件）**不依赖滚动到特定位置才能聚焦**；focus 时若元素在 sticky 视图外，需 `scroll-margin` 或程序滚动保证可见。
- 每个 `id` 锚点加 `scroll-margin-top` 防固定头遮挡。

## 铁律 5 · LCP / CLS 性能预算硬卡

**Gate**：Lighthouse / Web Vitals：**LCP < 2.5s**、**CLS < 0.1**（移动 4G 节流档）。

- sticky 容器、image-sequence 画布、reveal 元素、full-bleed 图**全部预留显式尺寸**（width/height 或 aspect-ratio），绝不让晚到的资源把布局顶动 → CLS。
- hero / 首屏关键图 `fetchpriority="high"` + 预加载**唯一**关键资源；序列帧/下方资源懒加载。
- image-sequence：帧数与分辨率严格预算（建议 ≤ 60–120 帧、按视口降分辨率、雪碧图或 `<canvas>` 逐帧、首帧即占位）；绝不一次性同步加载上千张全分辨率 PNG。
- scroll handler 不做重排重绘；只写 `transform/opacity`；用 `requestAnimationFrame` 或库的 ticker，不在 scroll 回调里读 layout（避免强制同步布局 / layout thrash）。
- 字体 `font-display: swap` + 预载关键字重，防 FOIT 拖 LCP。

## 铁律 6 · step trigger 防抖 + 幂等

**Gate**：来回滚动同一区间，step 状态稳定、不重播、不闪烁。

- step enter/exit 用 **IntersectionObserver** 或 **ScrollTrigger 的 `onEnter/onEnterBack/onLeave/onLeaveBack`** 回调；**严禁裸绑 `window.addEventListener('scroll')` 自己算位置**。
- **幂等**：回滚再进入已激活的 step 不重新播放入场动画（除非显式设计 replay）；状态由"当前 active step index"单一真相驱动，不靠累加。
- 防抖/防抖动：threshold 用单值（如 0.2）+ 合理 `rootMargin`，避免在边界反复 enter/leave 抖动；快速滚动时跳过的中间 step 状态要能正确"跳达"终态而非排队补播。
- scrub 动画必须可被打断/可反向，不阻塞后续滚动。

## 铁律 7 · transform / opacity-only 驱动

**Gate**：所有 scroll-tied / reveal / parallax / pin 动画**只**动合成器友好属性。

- 允许：`transform`（translate/scale/rotate）、`opacity`、`clip-path`、（极慎）`filter`。
- ❌ 禁止在 scroll/scrub 里动：`width / height / top / left / right / bottom / margin / padding / border-width / font-size`（触发 layout/reflow，掉帧 + CLS）。
- `will-change: transform` 只在动效进行时加、结束即移除；不全局乱挂。
- 横向 act 用 `translateX` 而非改 `left`；进度条用 `scaleX` 而非改 `width`。

## 铁律 8 · 章节进度感 + 揭示克制

**Gate**：用户随时知道"在哪 / 还有多少"，且信息**逐单元**揭示。

- > 3 屏的故事必须有 **progress bar（scaleX）或 chapter dots**（≥3 章时强烈建议 dots）。
- reveal 节奏：**一次只揭示一个叙事单元**（一段 / 一图 / 一个 step），不许"满屏元素同时 fade-up 炸开"。
- 入场动效统一 threshold、统一时长档（见 `motion-tokens.md`），不许每个元素各搞一套时长/方向的"AOS 罐头乱炖"。
- pull-quote / 重音元素密度受控（建议每 2–4 屏 ≤1 个重音），重音过密 = 无重音。

---

## 失败模式急救表

| 症状 | 急救 |
|------|------|
| 关 JS 后页面空白 / 内容丢失 | 违铁律 1：把内容写进静态 DOM，effect 只加 class 增强；图表出静态 fallback |
| 滚动"果冻 / 停不下来 / 被吸附" | 违铁律 2：调高 lerp（≥0.1）、去掉 mandatory snap、reduced-motion 关 smooth-scroll |
| 用户反馈"卡在某一屏滚不动很久" | 违铁律 3：缩短该 pin 的 `end`（≤3 屏）或拆分 step；加进度提示 |
| 屏读/键盘用户读不完 | 违铁律 4：补 skip-link + 锚点导航；修 DOM 顺序 = 视觉顺序 |
| 布局抖动 / 加载慢 | 违铁律 5：给 sticky/sequence/图片预留尺寸；序列帧降帧+懒载；预载唯一关键资源 |
| step 来回滚就闪/重播 | 违铁律 6：换 IO/ScrollTrigger 回调，做幂等，单一 active-step 真相 |
| 滚动掉帧 | 违铁律 7：把 width/top 等改成 transform/opacity；scrub 只写合成属性 |
| "太花 / 不知道在哪" | 违铁律 8：加进度条/章节点；reveal 改成一次一单元；压重音密度 |
