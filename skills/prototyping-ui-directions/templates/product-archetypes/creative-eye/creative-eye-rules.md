# Creative-Eye — 八条铁律（gate 形式）

> 任何 creative-eye 相关 artifact 必须**每条都打勾**才放行。这是红队 gate，不是建议。
> 核心命题：实验交互的唯一合法性来自「它 elevate 了体验」。任何让内容更难拿到、让 touch / 键盘 / 读屏用户掉队、让性能崩盘的效果 —— 无论多酷 —— 一律驳回。

## 速查 checklist

- [ ] **铁律 1**：每个 cursor / hover / gaze 效果都有 touch + keyboard 等价兜底（pointer-fine 才挂效果）
- [ ] **铁律 2**：效果永不阻塞内容获取（光标不挡选择/点击；hover-reveal 内容在 DOM 里可 reach）
- [ ] **铁律 3**：`prefers-reduced-motion: reduce` 杀掉**所有**装饰性动效，内容静态全可见
- [ ] **铁律 4**：Effect budget 受控（重效果同屏 ≤ 2；磁吸主体 ≤ 5；WebGL hero 全站 ≤ 1）
- [ ] **铁律 5**：WebGL / shader 优雅降级（不可用→静态 fallback；首屏关键内容不依赖 WebGL）
- [ ] **铁律 6**：内容在无 JS 时可读（base markup 干净语义 HTML，效果全是 progressive enhancement）
- [ ] **铁律 7**：性能预算达标（cursor lerp rAF 内 < 1ms；≥ 60fps 桌面 / ≥ 30fps 移动；WebGL hero ≤ 1.5MB）
- [ ] **铁律 8**：cursor 不劫持系统行为（text caret / grab 等语义光标正确切换；隐藏系统光标必给等价反馈）

---

## 铁律 1 · 每个效果必须有 touch + keyboard 兜底

实验交互默认是 **pointer-fine 专属增强**，不是基线体验。

**Gate（全部满足）**：
- [ ] 所有 cursor-follow / 磁吸 / gaze / image-trail / distortion 效果都包在 `@media (pointer: fine)` 或 `matchMedia('(pointer: fine)')` 判定里；`(pointer: coarse)`（触屏）走静态等价路径
- [ ] 任何 hover-only 才能触发的内容/动作，都有 `:focus-visible` 键盘等价 + touch 的 tap 等价
- [ ] 磁吸元素在键盘 `:focus` 时**不**偏移，精确落位（吸附只对鼠标生效）
- [ ] touch 用户拿到的不是「坏掉的桌面版」，而是有意设计的静态/tap 版本

**红队问**：拔掉鼠标只用 Tab 键，能不能走完所有关键路径？用手机能不能拿到所有内容？任一「不能」→ 驳回。

## 铁律 2 · 效果永不阻塞内容获取

「酷」不能以「拿不到内容」为代价。

**Gate**：
- [ ] 自定义 cursor 层 `pointer-events: none`，绝不拦截下层的文字选择 / 链接点击 / 表单聚焦
- [ ] hover-reveal 的内容**必须真实存在于 DOM**（可被读屏与键盘 reach），不能是「只在 hover 时才被 JS 创建」的幽灵内容
- [ ] image-trail / distortion / 视差层不得永久遮挡正文、CTA、导航的可读性与可点击区域
- [ ] WebGL canvas / 覆盖层不捕获本应落到内容上的点击（用 `pointer-events: none` 或精确 hit-test）
- [ ] page-transition 覆盖层在动画结束后**必须**移除/禁用 pointer-events，不残留拦截

**红队问**：效果运行时，文字能选中吗？链接能点吗？读屏能念到 hover 才显示的内容吗？任一「不能」→ 驳回。

## 铁律 3 · `prefers-reduced-motion` 杀掉所有装饰性动效

这是 WCAG 2.3.3（Animation from Interactions）的硬要求，也是本 archetype 的尊严线。

**Gate**：
- [ ] `@media (prefers-reduced-motion: reduce)` 下：cursor-follow lerp、磁吸、gaze 跟随、视差、distortion、marquee、scramble、WebGL idle 动画**全部停止**
- [ ] 自定义光标在 reduced-motion 下恢复为**系统默认光标**（不再做缓动跟随）
- [ ] 所有「靠动画才出现」的内容（scramble 文字、reveal 元素）在 reduced-motion 下**直接显示终态**，不跳变、不消失
- [ ] page-transition 退化为 ≤ 80ms 的 opacity crossfade（保留页面切换的因果感，但无大幅运动）
- [ ] 状态变化仍可感知（hover 仍有非动效反馈：颜色/下划线/边框）

**红队问**：系统开「减少动态效果」后，页面是否仍 100% 可用、所有内容是否仍可见、是否再无大幅运动？任一「否」→ 驳回。

## 铁律 4 · Effect budget 每视口受控

实验效果是奢侈品，按预算花。

**Gate（硬数字）**：
- [ ] 同一视口同时运行的「重效果」（WebGL canvas / 连续 image-trail / 连续 shader distortion）≤ **2**
- [ ] 同屏「磁吸主体」≤ **5**（多了就是廉价乱吸）
- [ ] 同屏「gaze 跟随主体」≤ **2**（眼睛/朝向物件）
- [ ] 全站 WebGL hero ≤ **1**
- [ ] scramble/decode 文字同屏 ≤ **2** 处（标题级，不用于正文）
- [ ] 「看起来很酷但功能/信息不明」的效果一律删

**红队问**：这一屏数一下重效果、磁吸数、眼睛数 —— 有没有任何一项超预算？超 → 砍到预算内。

## 铁律 5 · WebGL / shader 必须优雅降级

WebGL 是增强，不是地基。

**Gate**：
- [ ] 检测 WebGL 上下文是否可用（`canvas.getContext('webgl2'||'webgl')` 失败 → fallback）
- [ ] WebGL 不可用 / `powerPreference: 'high-performance'` 拿不到独显 / 低端移动设备 → 退化为**静态图或 CSS 渲染**
- [ ] **首屏关键内容（标题 / CTA / 导航 / 核心文案）绝不画在 WebGL 里**，必须是 DOM HTML，WebGL 只做背景/装饰层
- [ ] WebGL 资源（shader / texture / 几何）懒加载 + code-split，不阻塞首屏渲染
- [ ] WebGL 失败不能让页面白屏或报错中断 —— 有 try/catch + fallback 路径

**红队问**：在不支持 WebGL 的环境（或手动禁用）打开，关键内容还在吗？没白屏吗？「否」→ 驳回。

## 铁律 6 · 内容在无 JS 时可读

所有花活都是 progressive enhancement，base 必须能独立站立。

**Gate**：
- [ ] JS 关闭 / 加载失败时：文字、图片、链接、导航**全部静态可见可用**
- [ ] base markup 是干净语义 HTML（`header`/`nav`/`main`/`section`/`h1-h6`/`a`/`img[alt]`），不是空 `div` 等 JS 注入
- [ ] scramble 文字的终态、reveal 元素的终态、trail 对应的图，都在初始 HTML 里就存在（JS 只是「增强」其呈现，不是「创造」其存在）
- [ ] 自定义 cursor / WebGL / 磁吸全是 JS 增强层，缺失时退回系统光标 + 静态布局，不破坏可用性

**红队问**：禁用 JS 刷新，这页还能读、能点、能导航吗？「否」→ 驳回（base markup 不合格）。

## 铁律 7 · 性能预算硬约束

惊艳不能用掉帧 / 发烫换。

**Gate（硬数字）**：
- [ ] cursor lerp / 磁吸计算在单帧 rAF 内 < **1ms**；所有 pointer 驱动逻辑节流到 rAF，不在 `pointermove` 里直接做重计算或读布局（避免 layout thrash）
- [ ] 帧率：桌面 ≥ **60fps**，移动 ≥ **30fps**；effect 不得使活动期间持续掉帧
- [ ] WebGL hero 总资源（shader + texture + 几何）≤ **1.5MB**
- [ ] heavy lib（Three.js / GSAP / 物理引擎）**code-split + 懒加载**（`import()`），不进首屏关键 bundle
- [ ] `will-change` 只在动画**进行时**加、结束**立即移除**；不长期挂在大量元素上
- [ ] 只动 compositor-friendly 属性（`transform` / `opacity` / `clip-path` / `filter` 慎用）；**禁止**动画 `width/height/top/left/margin/padding/border/font-size`
- [ ] scroll 驱动用 Lenis / IntersectionObserver / ScrollTrigger，不裸写高频 scroll handler

**红队问**：DevTools Performance 录一段交互，有没有长帧 / layout thrash / 持续掉帧？Network 看 WebGL 资源是否超 1.5MB？任一超标 → 优化或砍效果。

## 铁律 8 · cursor 不劫持系统行为

自定义光标可以炫，但不能让用户「找不到指针」或「不知道现在能干嘛」。

**Gate**：
- [ ] 隐藏系统光标（`cursor: none`）时，**必须**有等价的自定义视觉反馈始终可见，且贴近真实坐标（dot 不滞后）
- [ ] 进入 `input` / `textarea` / `[contenteditable]` 区域：**恢复系统 text caret**（`cursor: text`），不能只有装饰光标导致 caret 语义丢失
- [ ] 可拖拽区域显示 `grab`/`grabbing` 语义、可点击区域有对应 affordance、disabled 区域显示 `not-allowed`
- [ ] 自定义光标不破坏 `:focus-visible` 焦点可见性（WCAG 2.4.7）—— 键盘焦点环始终清晰
- [ ] 自定义光标层 z-index 不遮挡 modal / 重要交互的焦点反馈

**红队问**：在输入框里打字时光标对吗（是 caret 不是装饰球）？拖拽区是 grab 吗？用键盘 Tab 时焦点环看得见吗？任一「否」→ 驳回。

---

## Gate 失败时的动作

| 违反 | 急救 |
|------|------|
| 铁律 1（无 touch/键盘兜底） | 把效果包进 `(pointer: fine)`，为 coarse/键盘补静态等价路径，再过 gate |
| 铁律 2（阻塞内容） | cursor 层加 `pointer-events: none`；把 hover 幽灵内容改成 DOM 常驻 + 视觉隐藏 |
| 铁律 3（reduced-motion 不全） | 补 `prefers-reduced-motion` 媒体查询，逐 pattern 加停动/显终态分支 |
| 铁律 4（超预算） | 数效果，砍到 ≤2 重效果 / ≤5 磁吸 / ≤1 WebGL hero |
| 铁律 5（WebGL 不降级） | 加 context 检测 + 静态 fallback；把首屏关键内容移出 WebGL |
| 铁律 6（无 JS 崩） | 重写 base markup 为语义 HTML，把效果改为纯增强层 |
| 铁律 7（性能炸） | rAF 节流 + code-split + will-change 纪律 + 改 transform-only；压 WebGL 资源 |
| 铁律 8（劫持光标） | 补语义光标切换（caret/grab）+ 等价反馈 + 焦点可见 |
