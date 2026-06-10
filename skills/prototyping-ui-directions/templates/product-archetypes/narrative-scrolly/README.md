# Narrative-Scrolly Archetype

> 长故事滚动 / 编辑式 / 数据故事 / 沉浸式叙事页的知识库。
>
> Stage 0 用户选"加载 narrative-scrolly archetype"时被引入主流程；否则休眠在这里不影响主流程。

## 适用产品类型

- 数据新闻 / data journalism（NYT / The Pudding / Reuters Graphics / Bloomberg 风格的 scrollytelling 长文）
- 产品故事页 / 沉浸式 product story（Apple AirPods Pro、Apple Watch、Tesla / Polestar 配置叙事）
- 年度报告 / impact report / annual report（带 step-driven 图表的滚动叙事）
- 编辑式长读 / immersive editorial / 杂志专题（pull-quote、full-bleed、章节节奏）
- 品牌叙事单页 / brand manifesto（scroll-pinned act + reveal choreography）
- 解释类教程长文 / explainer（"边滚边讲"的分步骤可视化）

**不适用**：

- App / SaaS 产品界面（持续停留、双向操作 → 走通用框架或 canvas/dashboard archetype）
- Dashboard / 监控面板（信息密度 + 随机访问数据 → `data-dashboard`）
- Landing / 转化型营销页（首屏 CTA + 短滚动 + 转化漏斗为主 → `landing-marketing`；本 archetype 是"读完一个故事"，不是"3 屏内点击购买"）
- 节点编辑器 / 白板（空间化、非线性 → `canvas`）
- 任何"随机访问 / 用户主导导航 / 反复跳转"的产品 —— scrollytelling 的前提是**线性、被引导、有起点有终点**

## 与 L3 视觉风格如何 COMPOSE（关键边界）

本 archetype 提供的是**叙事结构 + 滚动编排（narrative STRUCTURE + scroll choreography）**，不是视觉皮肤。

- 它**叠加在**已锁定的 L3 视觉风格之上（taste / luxury / brutalist 三选一仍由 L3 决定）。
- 它**永远不**覆盖 L3 的 palette / typography skin / 视觉基调，也**永远不**占用任何 `l3_style` enum 槽位——它不是"第 4 种风格"。
- 分工边界：

  | 归 L3（视觉皮肤） | 归本 archetype（叙事骨架） |
  |---|---|
  | palette / 配色 token | 章节切分 + pacing（一章 = 几个 step） |
  | 字体族 + 字重 + 字号阶梯的"味道" | vertical rhythm 的**结构**（step 间距、pin 长度、节拍） |
  | 质感 / 纹理 / 圆角 / 阴影语言 | sticky-visual ↔ scrolling-text 的绑定关系 |
  | 视觉氛围（高级感 / brutalist / luxury） | reveal choreography / story beats 顺序 |
  | hover / 装饰性微动效 | scroll-tied motion（scrub / trigger / parallax）与 reduced-motion 兜底 |

- 落地姿势：variant 先由 L3 决定"长什么样"，再由本 archetype 决定"怎么把它铺成一个能从上滚到下读完的故事"。两者正交，互不抢槽。
- 如果某个建议同时改了视觉皮肤又改了叙事结构 → 拆开；视觉部分退回 L3，本 archetype 只保留结构/编排部分。

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `interaction.md` | scroll-progress / step-enter-exit / pin-unpin / skip-controls 的完整交互 spec + 全状态覆盖 + a11y（focus order = 视觉顺序 / prefers-reduced-motion） |
| `patterns-index.md` | 12 个核心 scrollytelling pattern 索引（sticky-visual+stepped text / pinned section / horizontal act / scroll-trigger reveal / progress indicator / parallax / image-sequence scrub / data-step chart / full-bleed interstitial / pull-quote / end CTA / 章节锚点导航），每个含 intent + structure + when + 它替换掉的 slop |
| `narrative-scrolly-rules.md` | 8 条 HARD rule 的 gate / checklist 形式（no-JS 可读 / 不劫持滚动速度 / pin ≤N 视口高 / 键盘+skip-link / LCP+CLS 预算 / trigger 防抖 …） |
| `layout-engines.md` | scrollytelling 布局逻辑（sticky graphic + flowing steps / full-height acts / horizontal pin）+ 推荐库（GSAP ScrollTrigger / Lenis / Scrollama / IntersectionObserver / Motion） |
| `motion-tokens.md` | scroll-tied motion token（scrub easing / reveal threshold / parallax depth ratio）+ 禁用项 + 保留叙事顺序的 reduced-motion 兜底 |
| `reference-anchors.md` | 9 个 gold-standard scrollytelling 范例（名字 + 在哪找 + 为何典范 + 该学的那一件事），供 reference-grounding pipeline 消费 |

## 八条铁律（速查）

1. **No-JS / reduced-motion 下故事完整可读** — 关掉 JS 或开 reduced-motion，所有内容仍按叙事顺序线性呈现，**信息零丢失**；scroll effect 是增强，不是承载
2. **绝不劫持滚动速度** — 不改 native scroll velocity、不做"滚一下跳一屏"的 scroll-snap 强夺；smooth-scroll（Lenis）lerp ≥ 0.1，且 reduced-motion 下完全关闭
3. **单个 pin section ≤ 3 视口高** — 任何 sticky/pinned 段的滚动距离 ≤ 3×100vh；超过用户会迷失"我还要滚多久"
4. **键盘可达 + skip-link** — Tab 顺序 = 视觉/叙事顺序；提供"跳过动画/跳到正文"链接；step 内容不靠滚动才能聚焦
5. **LCP / CLS 预算硬卡** — LCP < 2.5s、CLS < 0.1；sticky 容器、image-sequence、reveal 占位都必须预留尺寸，绝不抖布局
6. **step trigger 必须防抖 + 幂等** — scroll 回滚再进入同一 step 不重复播放/不闪烁；trigger 用 IntersectionObserver 或 ScrollTrigger 的 onEnter/onLeaveBack，不裸绑 scroll 事件
7. **transform/opacity-only 驱动** — scroll-tied 动画只动 `transform / opacity / clip-path`，绝不在 scrub 里动 layout 属性（width/height/top/left/margin）
8. **章节有进度感** — 长故事必须让用户随时知道"在哪 / 还有多少"（progress bar 或 chapter dots）；reveal 一次只揭一个叙事单元，不要满屏同时炸开

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 4 | 编辑式排版、full-bleed、pull-quote、vertical rhythm 是叙事载体 |
| Interaction | 3 | 交互是"滚动驱动"为主，动作集小但必须可预测（不能边滚边乱跳） |
| Motion | 5 | scroll choreography 是本 archetype 的灵魂 |
| Perspective | 5 | 线性叙事 / 章节 / story beats / 信息揭示节奏是核心 |
| Accessibility | 4 | scroll-jacking 是无障碍重灾区，reduced-motion + 键盘 + no-JS 必须高优先 |
| Responsive | 4 | sticky+step 在窄屏极易塌；移动端 fallback 必须单独设计 |

> 这是先验，用户可在 Stage 0 调整。注意：本 archetype 的 a11y/responsive 权重显著高于 canvas —— 因为 scrollytelling 天然容易做成"只有桌面+鼠标+开动效才能读"的窄路。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重建议用先验表打底（Motion/Perspective=5，a11y/Responsive 拉到 4）；确认"这是线性故事不是 app/dashboard" |
| 1 | reference 选型推荐 `reference-anchors.md` 9 个范例（NYT/Pudding/Bloomberg/Apple/Polestar/Stripe Press/Species in Pieces/Every Last Drop/Active Theory）；提醒：把"该学的那一件事"写进研究意图 |
| 2 | extract card 多一节"scrollytelling structure observed"（章节数 / pin 用法 / sticky-visual 绑定方式 / reveal 节奏）；direction 候选必须明确 ① 叙事 spine（章节序列）② 主 layout 模式（sticky-graphic / full-height act / horizontal pin）③ reduced-motion 故事是否成立 |
| 3 | variant HTML 中必须至少有一个真实可滚的 scrollytelling surface（sticky-visual + ≥3 step）；红队跑八铁律 + anti-pattern + **强制验 reduced-motion / no-JS 双轨**（关 JS 截图必须仍是完整故事） |

## 运行时推荐（不强制）

- **GSAP + ScrollTrigger** — pin / scrub / step trigger 的事实标准；复杂编排首选
- **Scrollama**（基于 IntersectionObserver） — 轻量、专注 step-trigger 的 scrollytelling 库；数据新闻常用
- **IntersectionObserver**（原生） — 最轻的 step enter/exit；无依赖兜底首选
- **Lenis** — smooth-scroll（lerp 阻尼）；必须可被 reduced-motion 关闭
- **Motion**（Framer Motion）— React 场景的 `useScroll` / `useTransform` 做 scroll-linked 值
- **react-scrollama / @react-three** — React 项目的 step 封装 / 3D act

详见 `layout-engines.md` 与 `motion-tokens.md`。

## 不允许

- 跨类型套用（把 narrative-scrolly archetype 拿来做 app / dashboard / canvas）
- 把本 archetype 当成一种 L3 视觉风格、占用 `l3_style` 槽、或覆盖已锁定 L3 的视觉皮肤
- 在主流程的 SKILL.md / program-director.md 里硬引用本 archetype
- 把八铁律当"建议"而不是"红队 gate"
- 交付一个**关掉 JS 就空白 / 开 reduced-motion 就丢内容**的 scrollytelling（直接判失败）
- 一次性加载多个 archetype（一个产品只属于一类）
