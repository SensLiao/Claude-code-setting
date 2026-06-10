# Layout Engines — Scrollytelling

> 报告里 §"叙事布局层"的实现注释。scrollytelling 不是套死一个库，而是按"这一幕是哪种结构"选编排模式。
> 与 `patterns-index.md`（pattern × 设备矩阵）、`narrative-scrolly-rules.md`（铁律 3/5/7）保持一致。

## 三种布局模式（决策先行）

| 模式 | 结构 | 适用幕 | 主 driver |
|------|------|--------|-----------|
| **Sticky-Graphic** | 一栏 `position: sticky` 图形 + 一栏文档流 step | data-step chart / 产品逐步拆解 / 地图解读 | step trigger（IO） |
| **Full-Height Act** | 一组 `min-height:100svh` 的整幕，纵向堆叠 | 章节过场 / full-bleed interstitial / 情绪段 | enter trigger / 轻 scrub |
| **Horizontal Pin** | 外层 pin、内层 `translateX` 由纵滚驱动 | 时间线 / 画廊 / 横向流程带 | scrub（pin + 折算距离） |

> 一个故事通常**混用**三种模式：开场 Full-Height Act → 中段 Sticky-Graphic 讲数据 → 插一段 Horizontal Pin 时间线 → 收尾 Full-Height Act + Coda。

## Sticky-Graphic（scrollytelling 主范式）

**结构**：
```
.scrolly { display: grid; grid-template-columns: 1fr 1fr; }   /* 桌面 */
.scrolly__graphic { position: sticky; top: 0; height: 100vh; } /* 图钉住 */
.scrolly__steps   { /* 正常文档流，每个 .step ≈ 100vh */ }
```
- step 进入视口（IO threshold≈0.5）→ 更新 graphic 的 active state（换数据/highlight/镜头）。
- **图形容器必须预留满高**（防 CLS，铁律 5）；图形内部用 transform/opacity 过渡（铁律 7）。
- step 数 3–6，总滚动 ≤3–4 屏（铁律 3）；超量拆成多个 sticky 段。

**移动端降级**（必做，铁律 + 责任边界）：
- 窄屏放弃 side-by-side sticky；改为 **graphic 内嵌进每个 step 之前/之中**（figure 随文流），或 graphic 顶部 sticky 一小条、step 在下。
- 用 `@media (min-width: 768px)` 仅在桌面启用 sticky 双栏。

## Full-Height Act（整幕）

**结构**：`section { width:100%; min-height:100svh; display:grid; place-items:center; }`
- 用 `svh/dvh` 而非 `vh` 处理移动端地址栏伸缩导致的高度跳动（防 100vh 在移动端溢出/抖动）。
- 幕内元素用 enter-reveal（IO）或极轻 parallax；**不强制 pin**（除非是高潮幕，且计入 pin 预算）。
- 幕与幕之间靠 full-bleed interstitial 做语义/情绪切换。

## Horizontal Pin（横向幕）

**结构**：
```
外层 .h-act  高度 = (内层总宽 - 视口宽) 折算的纵向滚动距离
内层 .h-track  transform: translateX(-progress * (scrollWidth - innerWidth))
```
- ScrollTrigger `{ pin: true, scrub: true, end: () => "+=" + (track.scrollWidth - innerWidth) }`。
- **纵滚驱动横移**，绝不让用户手动横拖（铁律 2 + 可发现性）。
- **移动端降级为纵向堆叠**（铁律：horizontal act 在窄屏 ❌）：`@media (max-width:767px)` 下取消 pin/translateX，内容竖排。

## 推荐库（按场景）

| 库 | 定位 | 何时选 | 注意 |
|----|------|--------|------|
| **GSAP + ScrollTrigger** | pin / scrub / trigger 事实标准 | 复杂编排：pin + 横向 act + image-sequence scrub | 用回调（onEnter/onLeaveBack）保幂等；`scrub` 数值给阻尼；记得 `ScrollTrigger.refresh()` on resize |
| **Scrollama** | 轻量 step-trigger（基于 IO） | 纯 sticky-graphic + stepped text 的数据新闻 | 专注 step 进出，不做 scrub/pin；配自己的 sticky CSS |
| **IntersectionObserver**（原生） | 最轻 enter/exit | reveal、step 触发、无依赖兜底 | threshold/rootMargin 调好防抖；scrub 类做不了（只有进出，无进度） |
| **Lenis** | smooth-scroll 阻尼 | 想要顺滑滚动手感 | **必须** reduced-motion 下禁用（铁律 2）；lerp≥0.1；与 ScrollTrigger 用 `lenis.on('scroll', ScrollTrigger.update)` 同步 |
| **Motion**（Framer Motion） | React `useScroll`/`useTransform` | React 项目做 scroll-linked 值（进度条、parallax、scrub 映射） | `useScroll({ target, offset })` 取 progress；`useTransform` 映射；reduced-motion 用 `useReducedMotion()` 分支 |
| **react-scrollama** | Scrollama 的 React 封装 | React 数据新闻 step | 同 Scrollama 边界 |

## 选型决策树

```
这一幕是"一个图形被逐步解读"？        → Sticky-Graphic（IO / Scrollama）
这一幕是"横向序列/时间线"？           → Horizontal Pin（GSAP ScrollTrigger pin+scrub）
这一幕是"逐帧产品动画"？              → Image-Sequence Scrub（GSAP scrub + canvas/雪碧图）
这一幕只是"整屏过场/情绪段"？          → Full-Height Act（IO reveal，可选轻 parallax）
只需要"进入即揭示"，无进度映射？        → 原生 IntersectionObserver（最轻，零依赖兜底）
React 项目且需要 scroll-linked 连续值？  → Motion useScroll/useTransform
```

## 跨模式约定

- 所有模式的入场/过渡走 `motion-tokens.md` 的 token，不在各幕自创 duration/easing。
- 任意 pin 段计入"全页 pin 预算 ≤3"（铁律 3）。
- resize / 设备旋转后必须重算（ScrollTrigger.refresh / IO 重建），sticky 高度跟随 `svh`。
- reduced-motion：禁用 Lenis、关 parallax/scrub、sticky-graphic 退化为图文交替线性流（铁律 1）。

## Refs

- GSAP ScrollTrigger docs（pin / scrub / toggleActions / callbacks）
- Scrollama（IO-based step triggers, sticky scrollytelling）
- The Pudding "How to Implement Scrollytelling"（范式参考）
- MDN IntersectionObserver / `svh`·`dvh` viewport units
- Lenis（smooth-scroll，reduced-motion 分支）
- Motion `useScroll` / `useTransform` / `useReducedMotion`
