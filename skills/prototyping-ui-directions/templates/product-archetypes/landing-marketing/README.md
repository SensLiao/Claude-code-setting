# Landing-Marketing Archetype

> 营销 / 转化型着陆页（hero → social proof → feature → pricing → CTA 漏斗；线性滚动）的知识库。
>
> Stage 0 用户选"加载 landing-marketing archetype"时被引入主流程；否则休眠在这里不影响主流程。
>
> **核心定位**：这个 archetype 提供的是**产品类型 STRUCTURE**（一个营销页该有哪些 section、怎么排、CTA 节奏、信任结构、scroll-reveal 序列）——它**不提供视觉皮肤**。视觉皮肤永远由锁定的 L3 风格（taste / luxury / brutalist）决定。见文末「与 L3 视觉风格的组合关系」。

## 适用产品类型

- SaaS / 开发者工具 / API 产品的营销主页（Linear / Stripe / Vercel / Resend / Clerk 风格）
- 单品着陆页（single-product landing / launch page / waitlist page）
- 定价页 + feature 页 + 转化漏斗（hero → proof → feature → pricing → CTA）
- 产品发布页 / changelog 式 launch 页
- 任何"用户在**线性纵向滚动**上被逐步说服、最终落到一个转化动作"的页面

**不适用**：
- Canvas / 节点编辑器 / 白板（→ `canvas/` archetype，空间化非线性）
- Dashboard / 数据监控（信息密度 + 数据可视化为主，无转化漏斗）
- 长故事滚动 / 数据叙事（→ `narrative-scrolly`，叙事节奏 ≠ 转化节奏）
- App 内功能页 / 设置页 / 表单密集型后台（无 hero、无 social proof、无 CTA 漏斗）
- 文档站 / 博客（信息检索为主，不是说服转化）

> **边界提示**：营销页和叙事滚动页都"线性向下滚"，但**目标函数不同**——营销页优化 conversion（每屏都在推 CTA / 消除疑虑），叙事页优化 comprehension（每屏在讲清一个事实）。如果用户真正要的是 data story / explainer，应走 `narrative-scrolly` 而非本 archetype。

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `README.md` | 本文件：适用边界 + 文件清单 + 铁律速查 + dimension 权重先验 + stage 加载行为 + 运行时推荐 + 与 L3 的组合关系 |
| `patterns-index.md` | 12 个核心营销 section pattern（hero 三变体 / social-proof bar / logo cloud / feature-row 交替 / bento feature grid / pricing table / FAQ accordion / final CTA / sticky nav / testimonial / comparison table / metric strip），每个含 intent + 结构 + 何时用 + 替换掉的 AI-slop 反模式 |
| `landing-marketing-rules.md` | 9 条 HARD 铁律（gate / checklist 形式，带具体数字：value prop ≤8 词 / 单一 primary CTA 色 / LCP < 2.5s / section count 纪律 / 等） |
| `layout-engines.md` | 营销页的空间/网格/构图逻辑（12-col、container width、vertical rhythm、asymmetry、bento）+ 推荐库 |
| `motion-tokens.md` | scroll-reveal / parallax / entrance 动效 token（duration / easing）+ 该避免的 + reduced-motion 兜底 |
| `interaction.md` | CTA 状态 / nav scroll 行为 / lead-capture form 状态机（default→hover→active→focus→loading→empty→error→success）/ sticky / scroll-spy |
| `reference-anchors.md` | 8 个 real gold-standard 营销页范例（Linear / Stripe / Vercel / Raycast / Framer / Clerk / Resend / Superhuman），每个含 where to find + why exemplary + the ONE thing to study；供 reference-grounding pipeline 消费 |

## 九条铁律（速查）

1. **Above-the-fold 必须在 ≤8 个词内说清 value prop** — headline 是"做什么 + 给谁 + 凭什么"，不是"We empower teams to..."这种空话
2. **单一 primary CTA 颜色，全页唯一** — primary CTA 用一种高对比强调色；secondary 一律降级为 ghost / link，绝不并列两个等权大按钮
3. **首屏不堆叠** — hero 视口内最多 1 个 headline + 1 句 subhead + 1 个 primary CTA(+1 secondary) + 1 个视觉锚；其余全部移到 below-the-fold
4. **Social proof 必须具体** — logo 要真实可辨认的客户 / 数字要真实（"10,000+ teams"而非"trusted by many"）；禁止占位灰块假 logo
5. **Section count 纪律** — 营销主页 5-9 个 section（hero / proof / feature×2-3 / pricing 或 CTA / FAQ / final CTA）；超过 9 个说明在一页里塞了两个页面
6. **CTA 节奏** — 每 1.5-2.5 屏出现一次 conversion 机会（重复 primary CTA 文案一致）；首屏 + 中部 + 页尾至少 3 次
7. **LCP < 2.5s / hero 图 ≤ 200KB** — 营销页性能是转化的一部分；hero 媒体必须 priority-load + 显式尺寸，禁止 CLS
8. **F/Z 阅读动线对齐** — 关键信息（headline / CTA / proof）落在 F-pattern（文本密）或 Z-pattern（视觉密）的视线节点上，不随意居中堆叠
9. **Scroll-reveal 是增强不是门槛** — reveal 动画失败 / reduced-motion 下内容必须完整可见可转化；绝不靠 JS 动画"解锁"内容

> 完整 gate 形式 + 数字阈值见 `landing-marketing-rules.md`。

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 5 | hero 构图 / 信息层级 / 信任视觉是营销页第一战场 |
| Motion | 4 | scroll-reveal 序列 + entrance 节奏，是"高级感"来源，但**绝不能挡转化** |
| Perspective | 4 | F/Z 阅读动线 + above-fold 纪律 + section pacing 是说服力核心 |
| Interaction | 3 | CTA / form / nav 状态要扎实，但 pattern 密度低于 canvas |
| Responsive | 4 | 营销流量过半来自 mobile；hero / pricing / CTA 必须 mobile-first |
| Accessibility | 3 | 对比度 / 焦点态 / reduced-motion / 表单标签必须达标 |

> 这是先验，用户可在 Stage 0 调整。营销页和 canvas 最大的权重差异：**Visual + Responsive 升到第一梯队，Interaction 降级**（营销页没有复杂操作模型，只有"读 → 信 → 点"）。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重建议用先验表打底（Visual/Responsive/Perspective 优先）；确认是 conversion 页而非 narrative 页 |
| 1 | reference 选型推荐：`reference-anchors.md` 8 个范例（Linear / Stripe / Vercel / Raycast / Framer / Clerk / Resend / Superhuman）；按用户产品调性选 2-4 个 |
| 2 | extract card 多一节"landing section structure observed"（这个范例的 section 顺序 / CTA 节奏 / proof 类型 / F-Z 动线）；direction 候选必须明确 section 序列 + 主 CTA 策略 + 主 hero 变体 |
| 3 | variant HTML 必须含完整 above-fold + 至少 1 个 social-proof + 1 个 feature section + 1 个 final CTA；红队跑 9 铁律 + 反 AI-slop（见 `landing-marketing-rules.md` + `patterns-index.md` 反模式列） |

## 运行时推荐（不强制）

- **Next.js / Astro** — 营销页首选（SSG / ISR + 图片优化 + 极小 JS）；Astro 在纯静态营销页上 JS payload 最低
- **`next/image` / Astro `<Image>`** — 自动 AVIF/WebP + 显式尺寸（防 CLS，护 LCP）
- **GSAP + ScrollTrigger** 或 **Motion (Framer Motion)** — scroll-reveal / pin / entrance；简单 reveal 优先用纯 CSS `@keyframes` + `IntersectionObserver`，重的才上库
- **Tailwind + shadcn/ui** — 快速搭 section 骨架（但必须按 L3 风格 retune，不能裸用默认样式，见 `landing-marketing-rules.md` 铁律 9 / `design-quality.md` 反模板政策）
- **`@vercel/og`** — 动态 OG image（营销页分享卡片是转化入口）

详见 `layout-engines.md` / `motion-tokens.md`。

## 不允许

- 跨类型套用（把 landing-marketing archetype 拿来做 dashboard / canvas / 后台表单页）
- 在主流程的 SKILL.md / program-director.md 里硬引用本 archetype
- 把 9 铁律当成"建议"而不是"红队 gate"
- 一页塞两个产品的营销内容（section > 9 → 拆成两页）
- 用 scroll-reveal 动画当"内容门槛"（动画/JS 挂了内容就看不见 → 直接红队驳回）
- **把本 archetype 当成一种 L3 视觉风格**（见下）

## 与 L3 视觉风格的组合关系（COMPOSES, 不 OVERRIDE）

这是本 archetype 最容易被误用的地方，必须讲清：

- **本 archetype 提供 STRUCTURE**：section 序列、above-fold 纪律、CTA 节奏、social-proof 结构、F/Z 动线、scroll 序列、性能预算。这些是"一个营销页该怎么搭骨架"。
- **L3 风格提供 SKIN**：调色板、字体、质感、阴影/圆角语言、motion 个性、整体气质。这些由锁定的 `taste-skill` / `luxury` / `brutalist-skill` 决定。
- **组合方式**：archetype 决定"这里放一个 hero、那里放 social-proof bar、CTA 节奏是 3 次"；L3 决定"这个 hero 长什么样、按钮什么质感、reveal 用什么 easing 个性"。同一套 landing 结构，套 taste 出极简编辑风，套 luxury 出深色奢华风，套 brutalist 出粗野高对比风——**结构不变，皮肤全变**。
- **铁律**：
  - 本 archetype **NEVER** 进任何 `l3_style` enum，**NEVER** 被 style-lock 成"第 4 种风格"。
  - 本 archetype **NEVER** 规定具体颜色值 / 字体名 / 阴影参数——那些是 L3 的领地。本文件里出现的颜色/对比只谈"语义角色"（如"single primary CTA color"），不谈具体色值。
  - 当 L3 风格的视觉主张与本 archetype 的结构建议冲突时，**L3 赢视觉、archetype 赢结构**：例如 brutalist 想让 CTA 不用圆角不用渐变 → 听 L3；但"全页单一 primary CTA 色 / 首屏不堆叠"这种**结构纪律**仍然成立。
  - motion 同理：`motion-tokens.md` 给的是营销页 motion 的**结构性约束**（duration 上限 / reveal 时机 / reduced-motion 兜底），具体 easing 个性与动效风味由 L3 决定。
