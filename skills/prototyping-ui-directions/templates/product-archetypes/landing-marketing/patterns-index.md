# Landing-Marketing Patterns — Index

> 营销 / 转化页的 12 个核心 section pattern。每个 = **intent**（这个 section 在漏斗里干嘛）+ **structure**（怎么搭）+ **when**（什么产品/位置用）+ **replaces**（它替换掉的 AI-slop 反模式）。
>
> 这些是 **STRUCTURE**，不是视觉皮肤。具体配色/字体/质感由锁定的 L3 风格（taste / luxury / brutalist）决定。同一个 pattern 套不同 L3 长相完全不同。

## 速查表

| # | Pattern | 漏斗位置 | 主要 dimension | 替换的 AI-slop |
|---|---------|---------|---------------|----------------|
| 1 | Hero — Split (text + product visual) | 首屏 | Visual, Perspective | centered headline + gradient blob |
| 2 | Hero — Centered Statement | 首屏 | Visual | 同上 + 三个等权 CTA |
| 3 | Hero — Product-in-Hand (UI shot 主导) | 首屏 | Visual | 抽象 3D 球 / 无意义 isometric |
| 4 | Social-Proof Bar (logo strip) | hero 正下方 | Perspective | "trusted by many"无 logo |
| 5 | Logo Cloud (grid) | proof 区 | Visual | 占位灰块假 logo grid |
| 6 | Metric Strip (big numbers) | proof / 中部 | Visual | 装饰性大数字无来源 |
| 7 | Feature-Row Alternation (zig-zag) | feature 区 | Perspective, Motion | 3-up uniform icon card grid |
| 8 | Bento Feature Grid | feature 区 | Visual | 等高等宽 card 阵列 |
| 9 | Comparison Table (us vs them / before-after) | 中后部 | Perspective | 模糊"why choose us"段落 |
| 10 | Pricing Table | 转化前 | Visual, Perspective | 三列无锚定 + 全部"Contact us" |
| 11 | Testimonial / Quote | proof / 转化前 | Visual | 匿名"Great product! — User" |
| 12 | FAQ Accordion | final CTA 前 | Interaction | 把疑虑藏起来不答 |
| 13 | Final CTA (closer) | 页尾 | Visual, Perspective | 重复 hero / 弱 footer CTA |
| 14 | Sticky Nav + scroll-aware CTA | 全局 | Interaction | 永远占满的厚 header 挡内容 |

> 14 个条目，12+ 核心 pattern（hero 三变体合为"hero 家族"）。下面逐个 spec。

---

## 1. Hero — Split（text 左 + product visual 右）

- **intent**：首屏在一眼内完成"做什么 + 给谁 + 凭什么"，左侧文本承载 value prop，右侧视觉承载"产品长这样 / 用了什么效果"，让访客 3 秒内决定是否继续。
- **structure**：左列 = eyebrow(可选) + headline(≤8 词) + subhead(1 句) + primary CTA + secondary(ghost/link) + 一行 micro-proof（"No credit card" / "★ on G2"）；右列 = 真实产品 UI 截图 / 短 loop 视频 / 关键交互动效。左右约 5:7 或 1:1，**非严格居中**（asymmetry 制造视觉张力）。
- **when**：产品本身"看得见"（有 UI 的 SaaS / 工具）；右侧有真东西可展示时首选。
- **replaces**：❌ **centered-headline-with-gradient-blob** —— 居中标题 + 背后一坨彩色光晕 + 一个泛泛 CTA。这是头号 AI-slop：没有产品、没有信息层级、视觉锚是抽象渐变球而非真实价值。

## 2. Hero — Centered Statement（纯陈述式）

- **intent**：当产品抽象（平台 / 基础设施 / 理念型）、没有单一可展示 UI 时，用一句强陈述 + 极克制的视觉建立气场。
- **structure**：居中 headline(大字重对比) + 一句 subhead + **单个** primary CTA(+ 至多一个 secondary link) + 下方一条 social-proof bar 立即兜底。视觉锚来自 typography 本身的 scale contrast（不是渐变球）。
- **when**：开发者基础设施 / 抽象平台 / 品牌型 launch；产品没有"一张图说清"的 UI。
- **replaces**：❌ **centered + 三个等权大按钮** —— 居中没问题，但 AI 默认会并列"Get Started / Documentation / Pricing"三个同等大小按钮，稀释转化。本 pattern 强制单一 primary。

## 3. Hero — Product-in-Hand（UI 截图主导）

- **intent**：让产品的真实界面成为首屏主角，"showing beats telling"——用一张精修的产品大图直接证明价值，文本退居辅助。
- **structure**：headline + subhead 上方或叠加，下方/背景是一张大幅、近景、带真实数据的产品截图（常带 browser/app chrome、轻微 perspective tilt 或 shadow 浮起）。截图占视口 50%+。
- **when**：产品 UI 本身就是卖点（设计精良的工具：Linear / Raycast / Superhuman 类）。
- **replaces**：❌ **抽象 3D 球 / 无意义 isometric 插画** —— AI 爱用与产品无关的 3D 几何体或等距插画填充 hero。本 pattern 强制用**真实产品截图**，每一像素都在卖产品。

## 4. Social-Proof Bar（logo 横条）

- **intent**：在 hero 之后**立即**用客户 logo 消除"这靠不靠谱"的第一疑虑，借第三方信任做转化背书。
- **structure**：一行 "Trusted by / Powering teams at" 引导词 + 5-7 个**真实可辨认**的客户 logo，单色处理（grayscale / 当前文字色）统一调性，等间距横排，logo 高度统一（约 24-32px 视觉权重）。
- **when**：有真实知名客户时，紧贴 hero 下方（首屏可见最佳）。
- **replaces**：❌ **"trusted by many teams worldwide" 纯文字无 logo** —— 空口无凭。也替换 ❌ 占位灰色方块假 logo。没有真 logo 就用 metric strip（#6）或 testimonial（#11），不要伪造。

## 5. Logo Cloud（logo 网格）

- **intent**：当客户数量多、想表达"规模与广度"时，用 grid 形式的 logo 墙做体量背书。
- **structure**：3-6 列 × 2-4 行的 logo grid，统一单色 + 统一 cell 尺寸，hover 可微亮（可选）。比 bar(#4) 信息量大，适合放在专门的 "Trusted by industry leaders" section。
- **when**：客户多且分布广（中后部 proof 区，或专门的客户页入口）。
- **replaces**：❌ **占位灰块 placeholder grid** —— 一堆 `bg-gray-200` 方块假装是 logo。真有客户才用 cloud；logo 数量不足就降级回 bar。

## 6. Metric Strip（大数字带）

- **intent**：用 3-4 个有冲击力的真实数字（用户数 / 处理量 / 节省时间 / uptime）量化价值，给抽象产品一个"硬证据"锚点。
- **structure**：横向 3-4 个 metric，每个 = 超大数字(scale 对比强) + 一行 label("99.99% uptime" / "2M+ requests/day" / "10,000+ teams")，等分排列，数字用页面强调字重。
- **when**：产品价值可量化 / 缺少知名 logo 但有亮眼数据时（proof 区或中部转化前）。
- **replaces**：❌ **装饰性大数字无出处** —— AI 爱放"100% / 24/7 / ∞"这种无意义大字。本 pattern 要求每个数字**真实可溯源**，label 说清单位。

## 7. Feature-Row Alternation（zig-zag 交替行）

- **intent**：逐个深入讲核心 feature，用"图文左右交替"制造阅读节奏，每行一个卖点讲透（而非并列浅尝），引导视线之字形下行。
- **structure**：每行 = 一侧文本块（feature 标题 + 2-3 句价值 + 可选 micro-CTA / 链接）+ 另一侧视觉（产品截图 / 动图 / 局部 UI）。**逐行左右交换**（row1 文左图右，row2 图左文右）。2-4 行为宜。
- **when**：有 2-4 个需要"展开讲"的核心 feature；产品功能有可视化截图。
- **replaces**：❌ **3-up uniform icon-card grid** —— 三个等宽 card，每个一个线性图标 + 一句话，信息浅、层级平、毫无重点。这是 AI 默认 feature 区。zig-zag 给每个 feature **呼吸空间 + 真实视觉 + 阅读节奏**。

## 8. Bento Feature Grid

- **intent**：当 feature 多、重要性不均时，用大小不一的 bento cell 在一屏内同时传达"功能丰富 + 主次分明"，制造现代编辑感。
- **structure**：非均匀网格——1 个大 cell（旗舰 feature，带大视觉）+ 若干中/小 cell（次要 feature），cell 内可混排 UI 截图 / 短动效 / 图标 + 文案。打破 12-col 的死板对齐（见 `layout-engines.md` bento 段）。
- **when**：feature 数量 5+ 且有明确主次；想在一屏给"产品很全"的印象（替代长长的 feature 列表）。
- **replaces**：❌ **等高等宽 card 阵列** —— N 个一模一样的方卡，无层级、无重点、无个性。bento 用**尺寸差异编码重要性**，天然制造层级。

## 9. Comparison Table（us-vs-them / before-after）

- **intent**：直接、诚实地把"选我们 vs 现状/竞品"摆出来，用对照消除"凭什么是你"的理性疑虑，加速决策。
- **structure**：两种形态——(a) **us vs them**：行=能力维度，列=我们/竞品A/竞品B，✓/✗/部分 标记，我们列高亮；(b) **before-after**：左"没有我们时的痛"右"有我们后的爽"。维度 5-8 行，诚实（不全 ✓）。
- **when**：处于竞争市场、访客在比价比功能时（pricing 前的理性铺垫）。
- **replaces**：❌ **模糊的 "Why choose us" 三段排比文案** —— "Fast. Reliable. Loved by developers." 这种空泛形容词。comparison table 用**具体维度对照**给出可验证的差异。

## 10. Pricing Table

- **intent**：清晰呈现价格档位，用锚定（anchoring）+ 推荐位引导到目标 plan，把"考虑"转成"选哪个"。
- **structure**：2-4 列价格卡，**一个 plan 视觉高亮**("Most popular" badge + 略放大/抬高/描边)，每列 = plan 名 + 价格(突出) + 计费周期 toggle(月/年) + 核心 feature 清单(✓) + 单个 CTA。年付默认/带折扣标记。最高档可"Contact sales"但**不能所有档都是**。
- **when**：有明确定价的 SaaS / 订阅产品（转化前的最后理性关口）。
- **replaces**：❌ **三列无锚定全 "Contact us"** —— 三个一样的卡、没有推荐、价格藏起来全让你联系销售。本 pattern 强制**至少一个明确价格 + 一个高亮推荐档**，降低决策摩擦。

## 11. Testimonial / Quote

- **intent**：用真实客户的话做情感 + 社会认同背书，比自夸更可信，临门一脚推动转化。
- **structure**：客户原话(1-3 句，可挑重点加粗) + **真实**姓名 + 职位 + 公司 + 头像/公司 logo。可单条大 quote(放重点位)或 2-3 条卡片排列。带具体结果的 quote 最强（"cut our build time 60%"）。
- **when**：有真实可署名的客户反馈时（proof 区或 pricing 前）。
- **replaces**：❌ **匿名 "Great product! — A User"** —— 没名没脸没公司的假评价，零可信度。本 pattern 要求**完整可验证署名**；没有真 testimonial 就不放，用 metric / logo 代替。

## 12. FAQ Accordion

- **intent**：在转化前主动回答阻碍下单的最后疑虑（价格/安全/迁移/取消/集成），把"犹豫"消解在页内，减少跳出。
- **structure**：单列 accordion，6-10 个真实高频问题，点击展开答案（一次可展开一个或多个）。问题按"购买决策阻力"排序（先答最挡转化的）。**默认折叠**首屏只露问题。
- **when**：产品有常见顾虑（付费 / B2B / 有迁移成本）；放在 final CTA 正前方。
- **replaces**：❌ **把疑虑藏起来 / 无 FAQ** —— 假装用户没疑问，或把答案塞进帮助中心让用户离开页面。本 pattern 把高频顾虑**就地解决**，不放走访客。

## 13. Final CTA（closer / 收尾转化区）

- **intent**：页尾最后一次、最强一次的转化召唤，对已读完全程的高意向访客临门一脚，承接前面所有铺垫。
- **structure**：聚焦的 section——一句强收尾文案(重申核心价值或制造紧迫) + **单个**醒目 primary CTA(文案与 hero 一致) + 可选 micro-proof("Join 10,000+ teams" / "No credit card")。视觉上**独立成屏**、留白充分、CTA 是绝对焦点。
- **when**：每个营销主页**必有**（页尾、footer 之前）。
- **replaces**：❌ **直接重复 hero / 把 CTA 弱化进 footer 链接** —— 要么原样复制首屏(无新意)，要么 CTA 缩成 footer 里一个小链接(浪费最高意向时刻)。本 pattern 给收尾一个**专属、聚焦、强对比**的转化区。

## 14. Sticky Nav + Scroll-Aware CTA（粘性导航）

- **intent**：滚动过程中持续提供导航 + 转化入口，但不遮挡内容；让 CTA 在用户任何时刻"想点就能点"。
- **structure**：顶部 nav 初始透明/轻量；scroll 越过 hero 后变为**紧凑 + 半透明背景(backdrop-blur) + 投影**，并**渐显一个紧凑 primary CTA**（hero 内 CTA 滚走后接力）。nav 高度收紧(≤56-64px)，绝不占满视口。可选 scroll-spy 高亮当前 section。
- **when**：页面较长（4+ section）需要持续导航 + 转化入口时。
- **replaces**：❌ **永远占满的厚 header 挡内容** —— 一个 80px+ 的厚导航全程占顶部，吃掉首屏空间、滚动时挡住内容。本 pattern 让 nav **滚动自适应收缩**，把转化入口接力进 nav 而非塞满屏幕。

---

## Section 序列默认模板（structure 先验）

营销主页推荐序列（5-9 section，见 `landing-marketing-rules.md` 铁律 5）：

```
[Sticky Nav]
1. Hero (#1/#2/#3 三选一)
2. Social-Proof Bar (#4)              ← 紧贴 hero，立即背书
3. Feature-Row Alternation (#7) ×2-3  或  Bento (#8)
4. Metric Strip (#6) / Comparison (#9) ← 理性证据（可选）
5. Testimonial (#11)                   ← 情感背书
6. Pricing (#10)                       ← 转化前理性关口（有定价时）
7. FAQ (#12)                           ← 消除最后疑虑
8. Final CTA (#13)                     ← 临门一脚
[Footer]
```

> 这是**结构先验**，不是死序。Stage 2 的 direction 候选必须显式声明自己的 section 序列 + hero 变体 + CTA 节奏；Stage 3 红队对照本序列检查"是否漏了 proof / 漏了 final CTA / section 是否超 9"。
