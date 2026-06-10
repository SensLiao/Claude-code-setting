# Creative-Eye Archetype

> 实验性「会回看你」的交互知识库 — cursor-follow / 注视 / 拟人化人格暗示 / 磁吸 / WebGL 点缀。
> Awwwards / FWA / SOTD 级 portfolio、agency 站、art-direction-forward 体验。
>
> Stage 0 用户选「加载 creative-eye archetype」时被引入主流程；否则休眠在这里不影响主流程。
>
> **核心立场**：这个 archetype 加的是**实验性交互层（INTERACTION）**，不是视觉皮肤。它 COMPOSES on top of 一个**已锁定的 L3 视觉风格**（taste / luxury / brutalist），自己**永远不是**一种 L3 风格，**绝不**进 `l3_style` enum，**绝不**抢 L3 slot。详见下方「与 L3 的组合关系」。

## 适用产品类型

- Awwwards / FWA / CSSDA / SOTD 级别 portfolio（个人 / studio）
- Digital agency / production house 官网（Active Theory / Locomotive / Cuberto 流派）
- Art-direction-forward 的产品 landing / brand experience
- 实验性导航 / 沉浸式叙事入口（非线性、cursor-driven）
- Showreel / case-study 展示页（hover-reveal 重度依赖）
- 任何「希望第一眼就让人觉得这站有人格、会回看我」的体验

**不适用**：

- 高频生产力工具（节点编辑器 / dashboard / 表单 — cursor 跟随会干扰精确操作 → 用 `canvas` 或 `data-dashboard`）
- 信息密集型应用、企业后台、SaaS 控制台（gaze/magnetic 是噪声）
- 交易 / 支付 / 表单密集流程（每一帧 distraction 都是转化漏斗的洞）
- 移动优先产品（cursor 概念在 touch 上不成立，本 archetype 是 pointer-first 的，touch 只能降级兜底）
- 任何「a11y / 可读性 / 转化」优先级高于「惊艳」的场景

> **一句话边界**：creative-eye 让站「有人格」，不让站「难用」。任何让内容更难拿到的效果，立即驳回。

## 与 L3 视觉风格的组合关系（COMPOSES, never overrides）

| 维度 | L3 视觉风格（taste / luxury / brutalist） | creative-eye archetype |
|------|------|------|
| 管什么 | palette / typography / spacing / 视觉皮肤 / 「长什么样」 | cursor / gaze / hover 编排 / 磁吸 / WebGL 点缀 / 「怎么动、怎么回应」 |
| 互斥？ | L3 之间互斥，一次只挂一个 | 与任何**一个** L3 正交叠加，自己不互斥 L3 |
| 进 enum？ | 进 `l3_style` enum | **绝不**进 `l3_style` enum |

- **L3 决定视觉皮肤；creative-eye 决定交互人格。** 同一套 cursor-follow eye 可以挂在 luxury（克制、慢 lerp、金属 cursor）上，也可以挂在 brutalist（粗暴、瞬时、像素 cursor）上 — 视觉 token（颜色 / 字体 / 圆角 / 阴影）一律由锁定的 L3 提供，creative-eye **只读不写**视觉 token。
- **creative-eye 不自带颜色系统**：所有 cursor / trail / WebGL accent 的配色从 L3 的 `--color-*` token 取，不自创调色板。
- **冲突裁决**：若某交互效果与 L3 的克制度冲突（如 luxury 要求极简，但 magnetic 太跳脱），**L3 的克制度优先**，调低 motion intensity（见 `motion-tokens.md` 的 intensity 档位），而不是放弃 L3。
- **反模式**：把 creative-eye 当成「第 4 种 L3 风格」去和 taste/luxury/brutalist 并列选择 —— 这是错的。它是叠加层，不是候选皮肤。

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `patterns-index.md` | 12 个核心交互 pattern 索引（custom cursor / magnetic button / cursor-follow eye / hover image-trail / sticky distortion hover / marquee / scramble-decode text / WebGL hero / page-transition curtain / parallax depth / gaze-aware element / cursor-state morph）+ 每个 pattern 替代掉的「gimmick 反模式」|
| `creative-eye-rules.md` | 8 条铁律的 gate / checklist 形式（fallback 强制 / 不阻塞内容 / reduced-motion 杀装饰 / effect budget / WebGL 优雅降级 / no-JS 可读 / 性能预算 / cursor 不劫持）|
| `interaction.md` | cursor / hover / gaze 完整交互 spec + pointer/keyboard/touch 三轨兜底 + 全状态覆盖 + 性能 governor（rAF lerp / will-change 纪律）|
| `layout-engines.md` | 实验性构图（broken grid / full-bleed / overlap-collage / editorial asymmetry）+ 推荐库（GSAP / Lenis / Three.js / R3F / OGL / Motion / Splitting.js）|
| `motion-tokens.md` | 表现力动效 token（cursor lerp factor / magnetic strength / distortion / text-reveal stagger）+ 要避免的 + reduced-motion 兜底 |
| `reference-anchors.md` | 6-10 个真实 gold-standard 范例（Active Theory / Locomotive / Studio Freight-lenis / Igloo Inc / Aristide Benoist / Cuberto / Dennis Snellenberg / Awwwards SOTD / Codrops）— reference-grounding pipeline 直接消费 |

## 八条铁律（速查）

1. **每个 cursor / hover / gaze 效果必须有 touch + keyboard 兜底** — pointer-fine 才挂效果；coarse pointer / `:focus-visible` 走静态等价路径，绝不让 touch / 键盘用户拿不到内容
2. **效果永不阻塞内容获取** — 自定义 cursor 不挡文字选择 / 链接点击；hover-reveal 的内容必须在 DOM 里可被读屏与键盘 reach，不能「只有 hover 才存在」
3. **`prefers-reduced-motion: reduce` 杀掉所有装饰性动效** — cursor-follow / 磁吸 / 视差 / distortion / WebGL idle 动画全停，光标恢复系统默认，内容静态全可见
4. **Effect budget 每视口受控** — 同屏同时运行的「重效果」（WebGL canvas / image-trail / 连续 distortion）≤ 2；磁吸元素同屏 ≤ 5；一个站只允许 1 个 WebGL hero
5. **WebGL / shader 必须优雅降级** — WebGL 不可用 / `powerPreference` 拿不到 / 移动端低端机 → fallback 到静态图或 CSS，**首屏关键内容绝不依赖 WebGL 才出现**
6. **内容在没有 JS 时必须可读** — 文字、图片、链接、导航在 JS 关闭 / 失败时全部静态可见可用；scramble / split / trail 全是 progressive enhancement，base markup 必须是干净语义 HTML
7. **性能预算硬约束** — cursor lerp 在 rAF 内单次 < 1ms；effect 不掉帧到 60fps 以下（移动端 ≥ 30fps）；WebGL hero ≤ 1.5MB（含 texture）；heavy lib code-split 懒加载
8. **cursor 不劫持系统行为** — 自定义 cursor 期间，text caret / pointer / grab 等语义光标在对应区域必须正确切换；绝不隐藏系统光标却不给等价反馈（违反 WCAG 2.4.7 焦点可见）

> 完整 gate 形式（带数字 + 红队 checklist）见 `creative-eye-rules.md`。

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 4 | 实验构图 + WebGL 质感，但视觉皮肤由 L3 决定，这里是「构图 + 质感」不是「调色」 |
| Interaction | 5 | cursor/gaze/hover 编排是 archetype 灵魂，必须严谨 |
| Motion | 5 | 表现力动效是核心卖点；但越出格越要 governor 兜 |
| Perspective | 4 | 非线性导航 / 注视引导 / 沉浸入口 |
| Accessibility | 4 | **故意调高** — 这类站最容易做成 inaccessible gimmick，a11y 是它「elevates 而非沦为噱头」的分水岭 |
| Responsive | 3 | pointer-first，但 touch 降级必须是一等公民，不是事后想起 |

> 注意 canvas 把 Accessibility 设为 3、Responsive 设为 2；creative-eye 反而把 Accessibility 抬到 4 —— 因为实验交互最大的失败模式就是「炫但没法用」。这是先验，用户可在 Stage 0 调整。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重建议用先验表打底（注意 a11y 抬高）；**强制确认**：「你已经锁定了哪个 L3 视觉风格？creative-eye 是叠在它上面的交互层」 |
| 1 | reference 选型直接用 `reference-anchors.md` 的 6-10 个 gold-standard；reference-grounding pipeline 从这里取范例 |
| 2 | extract card 多一节「creative interaction observed」（光标行为 / 磁吸 / gaze / WebGL 用法）；direction 候选必须明确：选哪几个 pattern + 每个的 fallback 方案 + effect budget 分配 |
| 3 | variant HTML 中至少有一个 cursor / hover / gaze pattern 真正可交互；红队跑 8 铁律 + 每 pattern 的 gimmick 反模式检查 + reduced-motion 双轨快照 + 键盘/touch 兜底验证 |

## 运行时推荐（不强制）

- **GSAP**（含 ScrollTrigger）— 时间线编排、scroll-driven、复杂 stagger 的主力
- **Lenis**（Studio Freight）— smooth scroll；几乎所有这类站的标配
- **Three.js / react-three-fiber (R3F)** — WebGL hero / shader 场景
- **OGL** — 轻量 WebGL（image-trail / 简单 distortion，比 Three.js 体积小一个量级）
- **Motion**（Framer Motion）— React 组件级状态动效、磁吸 spring、layout 动画
- **Splitting.js** — 字符 / 词拆分，做 text-reveal / scramble 的基础
- **Matter.js** — 仅当需要真物理（落地、碰撞）时；否则别引

详见 `layout-engines.md` 与 `interaction.md`。

## 不允许

- **把 creative-eye 当成第 4 种 L3 风格**与 taste/luxury/brutalist 并列选 — 它是叠加交互层，不进 `l3_style` enum
- **creative-eye 自创调色板 / 字体** — 视觉 token 一律从锁定的 L3 取，这里只读不写
- 跨类型套用（把 creative-eye 拿来做高频生产力工具 / dashboard / 表单流程）
- 在主流程的 SKILL.md / program-director 里硬引用本 archetype
- 把 8 铁律当「建议」而不是「红队 gate」
- 同屏堆多个 WebGL canvas / 多条 image-trail（违反 effect budget）
- 隐藏系统光标却不给等价视觉反馈 / 不给 touch 与键盘兜底（这是 inaccessible gimmick 红线）
