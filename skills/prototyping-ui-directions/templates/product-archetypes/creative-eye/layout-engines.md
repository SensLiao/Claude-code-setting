# Layout Engines — Creative-Eye

> 实验性构图编排 + 推荐运行时库。不定义交互（→ `interaction.md`）、不定义动效 token（→ `motion-tokens.md`）、不定义视觉皮肤（→ 锁定的 L3）。
>
> 这里的「布局」不是 canvas 那种算法自动布局（dagre/d3-force），而是 **art-direction 级的人工构图模式** —— 实验交互站靠构图的「打破常规」与交互的「会回看你」共同制造高级感。

## 四种实验构图模式

| 模式 | 意图 | 何时用 | 配套 pattern |
|------|------|--------|--------------|
| Broken Grid | 故意打破对齐网格，制造张力与个性 | portfolio index / case 列表 / about | 磁吸（#2）、gaze-aware（#11）落在错位元素上 |
| Full-Bleed | 内容铺满视口边缘，沉浸无边框 | WebGL hero / 全屏作品展示 | WebGL hero（#8）、parallax（#10） |
| Overlap / Collage | 元素层叠、交错、拼贴，制造纵深与编辑感 | hero、章节过渡、特色拼贴 | parallax depth（#10）、distortion hover（#5） |
| Editorial Asymmetry | 非对称的杂志式排版，大小/留白强对比 | landing、case study 长页、叙事段 | scramble 标题（#7）、image-trail（#4） |

### Broken Grid（打破网格）

- **做法**：基于一个底层 grid（如 12 列），但让元素故意跨非整列、错位 `translateY`、不规则间距 —— 「有规则地打破规则」，不是随机乱摆。
- **纪律**：打破是为表达，不是为混乱。保持**阅读顺序的可预测性**（DOM 顺序 = 视觉/读屏顺序），错位只在视觉层（`transform`），不破坏 source order。
- **不允许**：错位导致键盘 Tab 顺序混乱、读屏顺序与视觉顺序脱节。

### Full-Bleed（满幅）

- **做法**：`width: 100vw` / `100dvh`，内容延伸到视口边缘，配 WebGL 或大图做沉浸首屏。
- **纪律**：满幅区内的**关键文字/CTA 仍受安全边距约束**（不贴边到难读）；用 `dvh` 而非 `vh` 处理移动端地址栏；防止横向溢出（`overflow-x: clip`）。
- **不允许**：关键内容画进 WebGL 满幅层（违反铁律 5）。

### Overlap / Collage（层叠拼贴）

- **做法**：元素用负 margin / `position` / `transform` 层叠，z-index 编排前后关系，配视差让各层异速运动。
- **纪律**：层叠**预留空间防 CLS**；交互元素的层叠不得让下层的可点区被上层无意遮挡（呼应铁律 2）。
- **不允许**：拼贴导致 CLS 暴增或点击目标被透明层吃掉。

### Editorial Asymmetry（编辑式非对称）

- **做法**：杂志式大小对比、不对称留白、超大标题 + 小正文、图文错位 —— 让排版本身有「态度」。
- **纪律**：非对称不等于无层级；用 scale contrast 建立清晰的视觉层级（呼应 L3 的 typography）。字号/留白用 L3 token，不自创。
- **不允许**：把「非对称」做成「随机」，失去信息层级。

## 推荐运行时库

| 库 | 角色 | 何时引 | 注意 |
|----|------|--------|------|
| **GSAP** (+ ScrollTrigger) | 时间线编排、scroll-driven、复杂 stagger | 几乎所有 creative-eye 站；scroll 叙事/pin/reveal | code-split 懒加载；ScrollTrigger 配 Lenis |
| **Lenis** (Studio Freight) | smooth scroll | 想要顺滑惯性滚动（这类站标配） | 必须配 reduced-motion 关闭；与 ScrollTrigger 同步用其 `raf` |
| **Three.js / R3F** | WebGL hero / shader 场景 | 需要复杂 3D / 流体 / 粒子 | 体积大，必懒加载；遵守 WebGL hero ≤ 1.5MB + fallback |
| **OGL** | 轻量 WebGL | image-trail / 简单 distortion / 单 shader | 比 Three.js 小一个量级；优先选它做轻 WebGL |
| **Motion** (Framer Motion) | React 组件级状态/spring/layout 动画 | 磁吸 spring、enter/exit、layout 过渡 | 用 `useReducedMotion` 钩子兜底 |
| **Splitting.js** | 字符/词/行拆分 | scramble、text-reveal、逐字 stagger | 拆分后终态文本仍是真实可读（铁律 6） |
| **Matter.js** | 2D 物理（碰撞/重力/弹性） | 仅当真需要物理交互时 | 非必要不引；多数「弹性」用 spring 即可 |

### 选库决策树

```
需要 scroll 叙事 / pin / 复杂时间线？        → GSAP + ScrollTrigger
需要顺滑惯性滚动？                          → Lenis（配 ScrollTrigger）
需要 WebGL，且是复杂 3D/粒子/流体？         → Three.js / R3F
需要 WebGL，但只是 image-trail / 单 shader？ → OGL（更轻）
在 React 里要磁吸 spring / enter-exit？     → Motion
要逐字/逐词文字动效？                       → Splitting.js（+ GSAP/Motion 驱动）
要真物理碰撞落地？                          → Matter.js（否则别引）
```

## 库使用纪律（跨库通用）

- **全部 heavy lib code-split 懒加载**（`import()`），不进首屏关键 bundle（铁律 7）
- **Lenis / GSAP scroll 效果必须在 `prefers-reduced-motion` 下禁用 / 退化**（铁律 3）
- **WebGL 库的初始化必须有 fallback 分支**（铁律 5）
- **不要为一个小效果引一个大库**（如只要弹性回弹，用 CSS spring / Motion，不引 Matter.js）
- 视觉 token（颜色/字体/间距）**一律从锁定的 L3 取**，库只负责运动与构图，不负责调色

## 不允许

- 全站统一套一种构图（实验站的价值在每个 surface 的构图意图，不是模板复用）
- 用 `position: absolute` 硬堆叠却不预留空间 → CLS 灾难
- 错位/拼贴破坏 DOM source order → 读屏与键盘顺序错乱
- 把构图实验做成「随机摆放」而非「有意打破」
- 为体积大的库不做 code-split（违反性能预算）
