# Creative-Eye Patterns — Index

> 12 个核心实验交互 pattern。完整 cursor/hover/gaze spec + 三轨兜底见 `interaction.md`，动效 token 见 `motion-tokens.md`，铁律 gate 见 `creative-eye-rules.md`。
>
> 每个 pattern 都标注它**替代掉的 gimmick 反模式** —— 这一列是本 archetype 的态度核心：同一个想法做对了是「有人格」，做错了是「廉价噱头」。

## 速查矩阵

| # | Pattern | 核心意图 | Motion ref | Touch/键盘兜底 | 替代的 gimmick |
|---|---------|---------|-----------|---------------|---------------|
| 1 | Custom Cursor | 光标即品牌人格 | lerp 0.12-0.18 | coarse pointer 隐藏自定义层，用系统光标 | 隐藏系统光标却无反馈 / 光标延迟到点不准 |
| 2 | Magnetic Button | CTA 吸住意图 | spring, strength 0.3 | 键盘 focus 直接落位，无吸附 | 全页元素乱吸 / 吸到点不中 |
| 3 | Cursor-Follow Eye / Gaze | UI「回看你」的人格暗示 | eye lerp 0.08 | 静止居中 + reduced-motion 完全静止 | 满屏眼睛跟踪的恐怖谷 |
| 4 | Hover Image-Trail | 链接 hover 拖出图像残影 | trail decay 0.92 | touch 用 tap→静态预览，键盘 focus 显图 | 残影盖住文字 / 性能炸裂 |
| 5 | Sticky / Distortion Hover | 元素被光标「粘」住形变 | displacement ≤ 12px | focus 用静态 outline 等价 | 形变到看不清内容 / 抖动晕眩 |
| 6 | Marquee (kinetic) | 横向无限滚动文字带 | scroll-velocity 联动 | reduced-motion 停在可读静态 | 速度快到读不了 / 纯装饰无信息 |
| 7 | Scramble / Decode Text | 文字解码式入场 | char stagger 14ms | reduced-motion 直接显示终态 | 全站每行都 scramble，读起来累 |
| 8 | WebGL Hero | shader 首屏质感 | rAF, ≤1.5MB | WebGL 不可用→静态图 fallback | 首屏内容依赖 WebGL 才出现 |
| 9 | Page-Transition Curtain | 路由切换的幕布过渡 | clip-path / curtain ≤ 700ms | reduced-motion 用 80ms crossfade | 过渡 > 1s 卡住导航 / 阻塞后退 |
| 10 | Parallax Depth | 多层视差营造纵深 | translateY ratio 0.1-0.4 | reduced-motion 锁死所有层 | CLS 暴增 / 滚动晕眩 |
| 11 | Gaze-Aware Element | 元素感知光标方位并朝向/反应 | rotate ≤ 8deg | 静止默认朝向 | 像被监视的诡异 / 抢主内容注意力 |
| 12 | Cursor-State Morph | 光标随上下文变形/带文字标签 | morph 200ms | coarse pointer 用区域 affordance | 标签延迟 / 语义光标丢失（caret 不见了）|

---

## 1. Custom Cursor

- **intent**：把系统光标替换成品牌化的自定义光标（dot + ring / 文字标签 / 反色混合），让「指」这个动作本身成为人格的一部分。
- **structure**：DOM 层一个 `position: fixed` 的 cursor 元素（或 ring + dot 两层），用 rAF + lerp 跟随真实 `pointermove` 坐标；真实系统光标在交互区可隐藏，但**非交互区 / 文本区必须恢复语义光标**。
- **when-to-use**：portfolio / agency 站第一层人格表达；几乎所有 creative-eye 站的基座。
- **替代的 gimmick**：① 直接 `cursor: none` 全站隐藏系统光标却不给等价视觉（用户找不到指针）；② lerp 太慢导致光标「追不上」真实位置，点击落点失准。**正确做法**：lerp 0.12-0.18（够跟手），交互层 dot 始终贴真实坐标、只有 ring 滞后做缓动。

## 2. Magnetic Button

- **intent**：CTA / 关键链接在光标靠近时被「磁吸」，强化「这里可点」的意图引导。
- **structure**：监听元素附近（radius ≈ 1.5× 元素尺寸）的 `pointermove`，按距离比例对元素施加 `translate`（最大位移 ≈ 元素半宽 × strength），离开时 spring 回原位。
- **when-to-use**：首屏主 CTA、联系入口、case 卡片 — **少而精**，全页 ≤ 5 个。
- **替代的 gimmick**：满页所有按钮都磁吸 → 廉价、且吸附让点击目标移动反而更难命中（违反 Fitts's Law）。**正确做法**：只给真正想引导的 1-3 个目标加磁吸；键盘 focus 时**不**偏移，直接精确落位。

## 3. Cursor-Follow Eye / Gaze

- **intent**：界面里有「眼睛 / 注视点 / 角色」会跟随光标方位转动，制造「UI 在回看你」的拟人化人格暗示（anthropomorphic — UI that looks back）。
- **structure**：眼球 / 瞳孔元素，按光标相对其中心的角度，在受限半径内 `translate`（瞳孔）或父容器 `rotate`（朝向）；lerp 0.08 做柔和跟随。
- **when-to-use**：品牌吉祥物、404 页、about 页人格化点缀 — **点睛用，不是主导航**。
- **替代的 gimmick**：满屏几十只眼睛同时跟踪 → 恐怖谷、廉价。**正确做法**：1-2 个注视主体；reduced-motion 下完全静止居中；眼睛不承载关键信息（信息靠文字，眼睛只是人格糖）。

## 4. Hover Image-Trail

- **intent**：导航 / 列表项 hover 时，沿光标轨迹拖出该项对应的图像残影序列，把「列表」变成有质感的视觉探索。
- **structure**：一组预加载图，`pointermove` 时按节流（每 N px / 每帧）激活下一张，每张 `opacity` + `scale` 随时间 decay（0.92/帧）淡出;OGL/WebGL 做位移版本更顺。
- **when-to-use**：project 列表、case index、menu overlay。
- **替代的 gimmick**：残影盖住正在读的文字 / 一次性 spawn 几十张图导致掉帧。**正确做法**：trail 限长（≤ 6 张并存），图懒加载 + 尺寸受控，残影区域避开正文；touch 上退化为 tap 显示静态缩略图。

## 5. Sticky / Distortion Hover

- **intent**：元素（图、卡、字）在光标进入时被「粘住」并轻微形变 / 位移 / 扭曲，强化触感反馈。
- **structure**：hover 时元素跟随光标做受限 `translate`（≤ 12px）或 shader/SVG `feDisplacementMap` 扭曲；离开 spring 复位。
- **when-to-use**：作品缩略图、特色卡片、hero 标题字。
- **替代的 gimmick**：形变幅度大到内容看不清 / 高频抖动引发眩晕。**正确做法**：位移与扭曲都设硬上限（位移 ≤ 12px，扭曲 displacement scale ≤ 20），文字可读性优先；distortion 计入 effect budget 的「重效果」。

## 6. Marquee (kinetic)

- **intent**：横向无限滚动的文字 / logo 带，作为节奏装置与信息载体（不只是装饰）。
- **structure**：内容复制 2× 拼接，`translateX` 线性循环；进阶版按 scroll velocity 改变速度/方向（GSAP + Lenis 联动）。
- **when-to-use**：section 分隔、client logo 墙、口号带。
- **替代的 gimmick**：速度快到根本读不了 / 跑马灯里全是无意义重复词。**正确做法**：默认速度可读（≈ 50-100px/s），承载真实信息（客户名 / 服务）；reduced-motion 下停在静态可读位置。

## 7. Scramble / Decode Text

- **intent**：标题以「乱码逐字解码成终态」的方式入场，制造数字感 / 神秘感。
- **structure**：用 Splitting.js 拆字符，每字符先随机字形再按 stagger（14ms/char）定格为目标字符。
- **when-to-use**：hero 主标题、section 标题、数字/代号展示 — **稀缺使用**。
- **替代的 gimmick**：全站每段正文都 scramble → 阅读负担、廉价。**正确做法**：只给 1-2 个关键标题用；终态文字在 DOM 里始终是真实可读文本（progressive enhancement），reduced-motion / no-JS 直接显示终态。

## 8. WebGL Hero

- **intent**：首屏用 shader / 粒子 / 流体做有机质感背景或主视觉，瞬间拉满「这站不一样」的第一印象。
- **structure**：Three.js/R3F 或 OGL 的全屏 canvas，rAF 驱动 shader；纹理 / 几何懒加载。
- **when-to-use**：landing / portfolio 首屏 —— **一个站只允许 1 个 WebGL hero**。
- **替代的 gimmick**：首屏标题/CTA 画在 WebGL 里，WebGL 没加载出来就白屏 / 内容缺失。**正确做法**：关键内容是 DOM HTML，WebGL 只做背景/装饰层；WebGL 不可用时静态图 fallback（见铁律 5）；体积 ≤ 1.5MB。

## 9. Page-Transition Curtain

- **intent**：路由切换时用幕布 / clip-path / 色块覆盖做过渡，掩盖加载、制造仪式感与连续性。
- **structure**：离场→覆盖层动画→新页就绪→揭幕；配合 View Transitions API 或 Barba/GSAP；总时长 ≤ 700ms。
- **when-to-use**：多页 portfolio、case study 之间的导航。
- **替代的 gimmick**：过渡 > 1s 让用户每次跳转都干等 / 阻塞浏览器后退。**正确做法**：硬上限 700ms，可中断；浏览器后退/前进必须即时响应；reduced-motion 退化为 80ms crossfade。

## 10. Parallax Depth

- **intent**：滚动时多层以不同速率位移，营造纵深与电影感。
- **structure**：分层元素按 scroll 进度乘以 ratio（0.1-0.4）做 `translateY`；用 Lenis + GSAP/ScrollTrigger 或 IntersectionObserver 驱动，避免 scroll handler churn。
- **when-to-use**：hero、章节过渡、图文 storytelling。
- **替代的 gimmick**：视差导致布局抖动（CLS 暴增）/ 幅度过大引发滚动晕眩。**正确做法**：只动 `transform`（不动 layout 属性），ratio 克制，预留空间防 CLS；reduced-motion 下所有层锁死。

## 11. Gaze-Aware Element

- **intent**：元素感知光标在屏幕的方位，朝向它 / 做出反应（卡片轻微 3D 倾斜朝向光标、箭头指向光标），是 cursor-follow 的「物件级」版本。
- **structure**：按光标相对元素中心的向量，映射为受限 `rotateX/rotateY`（≤ 8deg）或指向角度；rAF + lerp 平滑。
- **when-to-use**：特色卡（tilt-toward-cursor）、引导箭头、交互式 hero 物件。
- **替代的 gimmick**：满屏物件都盯着光标 → 像被监视，且抢走对主内容的注意力。**正确做法**：少量主体，倾斜角小（≤ 8deg）保持内容可读；不承载关键信息；reduced-motion 静止默认朝向。

## 12. Cursor-State Morph

- **intent**：自定义光标按悬停上下文变形并可带文字标签（hover 作品时变「VIEW」、hover 拖拽区变「DRAG」、hover 链接放大成 ring），用光标本身传达 affordance。
- **structure**：基于 hover 目标的 `data-cursor` 属性切换 cursor 形态/文字/尺寸，morph 200ms。
- **when-to-use**：作品网格、可拖拽画廊、视频/媒体区。
- **替代的 gimmick**：标签跟手延迟大显得脏 / 在文本输入区还显示自定义光标导致 caret 语义丢失。**正确做法**：morph ≤ 200ms 且 dot 贴真实坐标；进入 `input`/`textarea`/`[contenteditable]` 区域**必须**恢复系统 text caret（见铁律 8 与 `interaction.md` 状态表）；coarse pointer 上用区域内的视觉 affordance 替代。

---

## 兼容与预算说明

- **「重效果」三类**（计入 effect budget，同屏 ≤ 2）：WebGL hero（#8）、Hover Image-Trail（#4 的 WebGL 版）、连续 Distortion（#5 的 shader 版）。轻效果（#1/#2/#3/#6/#7/#10/#11/#12）不计入「重」预算，但磁吸主体同屏 ≤ 5。
- **必配兜底**：#1-#5、#11、#12 是 pointer-fine 专属，**必须**有 coarse-pointer / 键盘等价路径（见 `creative-eye-rules.md` 铁律 1）。
- **reduced-motion 全量响应**：12 个 pattern 全部在 `prefers-reduced-motion: reduce` 下退化（停动 / 显终态 / 静止），无一例外（铁律 3）。
- 完整 trigger / state / fallback / 性能 governor 见 `interaction.md`。
