# Reference Anchors — Narrative-Scrolly

> 9 个 gold-standard scrollytelling 范例，供 Stage 1 reference-grounding pipeline 消费（写进研究意图）。
> 每个 = 名字 + 在哪找 + 为何典范 + **该学的那一件事**（study ONE thing）。
> 用法：Stage 1 选 reference 时优先从这 9 个挑 2–4 个对口的；把"该学的那一件事"作为 Stage 2 extract card 的提取焦点，避免泛泛"看起来很酷"。
> 注：这些是**叙事结构 + 滚动编排**的范例，不是 L3 视觉皮肤来源——视觉味道仍由锁定的 L3 决定（README §与 L3 如何 COMPOSE）。

## 范例总表

| # | 名字 | 类型 | 该学的那一件事 |
|---|------|------|----------------|
| 1 | NYT "Snow Fall" | 数据新闻奠基作 | full-bleed media + 文字交织的"沉浸但不喧宾" |
| 2 | The Pudding | data journalism | data-step：让数据**自己**讲，动效只服务理解 |
| 3 | Bloomberg Graphics | 金融数据故事 | sticky chart + stepped text 的 data-step 范式纪律 |
| 4 | Apple AirPods Pro | 产品故事页 | image-sequence scrub：滚动=逐帧，丝滑可控 |
| 5 | Polestar | 汽车配置叙事 | full-height act + 克制 reveal 的高级留白节奏 |
| 6 | Stripe Press "Poor Charlie's Almanack" | editorial 长读 | 编辑式排版 + 翻页隐喻的 scroll 节奏 |
| 7 | Species in Pieces (In Pieces) | CSS 实验叙事 | 纯 CSS/SVG clip-path 形变 + 章节切换（零 WebGL） |
| 8 | Every Last Drop | 公益 explainer | parallax 角色叙事：一条 spine 串起全程 |
| 9 | Active Theory | 创意工作室故事 | 高强度编排里**仍守**性能/降级的工程纪律 |

---

## 1. NYT "Snow Fall: The Avalanche at Tunnel Creek"

- **在哪找**：搜 "NYT Snow Fall Tunnel Creek"（nytimes.com 2012 专题，scrollytelling 公认开山之作）；备查 Pulitzer / Storybench 复盘文。
- **为何典范**：定义了"长读 + full-bleed 动画媒体 + 音频证言 + 数据图"的沉浸式数据新闻范式，至今被引为标杆。
- **该学的那一件事 ⭐**：**full-bleed media 与正文的"交织节奏"**——媒体段全幅震撼，但随即回到舒适阅读宽度的正文；震撼与可读交替，沉浸而不喧宾夺主（对应 Pattern 9 Full-Bleed Interstitial + 铁律 8 节奏）。

## 2. The Pudding

- **在哪找**：pudding.cool（持续更新的 data journalism 站；近作如"democracy 一词 145 年国会演说"分析）。
- **为何典范**：把复杂数据集做成"边滚边被讲明白"的 data-step 叙事；公认"restraint beats spectacle"——动效服务理解而非炫技。
- **该学的那一件事 ⭐**：**data-step 的克制**——同一张图随章节逐步揭示（先总量→再拆分→再 highlight），让**数据自己讲故事**，动效只负责"读图顺序"（对应 Pattern 8 Data-Step Chart）。

## 3. Bloomberg Graphics

- **在哪找**：bloomberg.com/graphics（金融/经济/气候的交互专题，如各类 "The Bloomberg ..." data story）；备查 wbkd/awesome-interactive-journalism 列表。
- **为何典范**：sticky-chart + stepped-text 范式执行得极有纪律——大数据集分步揭示、注释精准、性能稳健，是"商业级数据故事"的工程范本。
- **该学的那一件事 ⭐**：**sticky-graphic + stepped text 的状态机纪律**——每个 step 携带明确 chart state（数据子集/轴/highlight/注释），过渡干净、回滚稳定（对应 Pattern 1 + 交互 2 Step Enter/Exit + 铁律 6 幂等）。

## 4. Apple AirPods Pro（产品页）

- **在哪找**：apple.com 产品页搜 "AirPods Pro"（及 Apple Watch / iPhone 产品页同代手法）；属"滚动驱动产品演示"的事实标杆。
- **为何典范**：把滚动映射为逐帧产品动画（旋转/拆解/降噪可视化），丝滑、可控、性能优化到位——image-sequence scrub 的天花板。
- **该学的那一件事 ⭐**：**image-sequence scrub 的工程化**——滚动=播放进度，用户控制时间轴；帧数/分辨率/懒加载严格预算，绝不拖垮 LCP（对应 Pattern 7 + 铁律 5 性能预算 + reduced-motion 降单帧）。

## 5. Polestar（汽车配置 / 品牌叙事）

- **在哪找**：polestar.com（车型页 / 品牌故事页）；同类可参 Tesla 车型页、各高端车企 configurator 叙事。
- **为何典范**：full-height act + 大量留白 + 极克制的 reveal，营造"高级、安静、有呼吸"的产品叙事；没有廉价动效堆砌。
- **该学的那一件事 ⭐**：**留白驱动的 pacing**——整幕 full-height、reveal 一次一单元、过场克制，用"少"换"贵"（对应 Pattern 4 Reveal + 9 Interstitial + 铁律 8 揭示克制；与 L3 luxury 皮肤天然契合）。

## 6. Stripe Press —"Poor Charlie's Almanack"

- **在哪找**：press.stripe.com（尤其在线版 "Poor Charlie's Almanack"，poorcharliesalmanack.com）；Stripe Press 整站是 editorial web 标杆。
- **为何典范**：把一本书做成 web 阅读体验——编辑式排版、章节节奏、翻页/进度隐喻，证明"长文本"也能有强 scroll 叙事而不靠浮夸动画。
- **该学的那一件事 ⭐**：**editorial 排版 + 文本型 scroll 节奏**——vertical rhythm、measure 宽度、pull-quote、章节进度共同构成阅读体验（对应 Pattern 5 Progress + 10 Pull-Quote + README dimension：Visual=4 排版即叙事载体）。

## 7. Species in Pieces（In Pieces）

- **在哪找**：species-in-pieces.com（Bryan James 作品，Awwwards SOTM；Smashing Magazine 有 "The Making of In Pieces" 复盘，仍在线）。
- **为何典范**：**纯 CSS/SVG clip-path** 实现 30 个物种三角碎片形变 + 物种间章节切换，零 canvas/WebGL；证明高表现力叙事不一定要重运行时。
- **该学的那一件事 ⭐**：**用最轻技术（clip-path 形变）做章节过渡**——形变即叙事切换、性能友好、合成器属性驱动（对应 Pattern 4 clip-path reveal + 铁律 7 transform/opacity-only；轻量兜底思路）。

## 8. Every Last Drop

- **在哪找**：everylastdrop.co.uk（Nice and Serious × WaterWise，公益 explainer，仍在线）。
- **为何典范**：用一个角色的一天（卡通插画 + parallax）把"日均用水"这个抽象数据讲成可共情的故事；一条清晰 spine 串起全程。
- **该学的那一件事 ⭐**：**单一叙事 spine（角色/线索）贯穿全程**——parallax 服务"跟随角色"的连续感，章节虽多但读者始终知道"在跟谁、走到哪"（对应 Pattern 6 Parallax 克制用 + README Stage 2：direction 候选必须先定"叙事 spine"）。

## 9. Active Theory（创意工作室案例 / 故事页）

- **在哪找**：activetheory.net（其 case study / 实验项目页；高端 WebGL + scroll 编排代表，Awwwards 常客）。
- **为何典范**：极高强度的滚动编排 + WebGL，但**仍**做性能优化、设备降级与交互可控——代表"创意天花板"与"工程纪律"可以并存。
- **该学的那一件事 ⭐**：**高强度编排里仍守工程底线**——再炫的 scroll 编排也要有 reduced-motion/低端设备降级、不夺滚、不抖布局（对应全部八铁律的精神：创意 ≠ 弃守 a11y/性能；学它"炫但不失控"）。

---

## 选用提示（给 Stage 1）

- **数据故事**（data journalism / 年度报告）→ 优先 #2 Pudding + #3 Bloomberg + #1 Snow Fall。
- **产品故事页**（硬件/汽车/品牌）→ #4 AirPods + #5 Polestar（+ L3 luxury 皮肤）。
- **编辑式长读**（杂志/书/manifesto）→ #6 Stripe Press + #1 Snow Fall。
- **想要轻量/低运行时**或证明"不靠重库也行"→ #7 Species in Pieces + #8 Every Last Drop。
- **创意上限参考**（但务必连工程纪律一起学）→ #9 Active Theory。
- ⚠️ 每个 reference 在 extract card 里只追"该学的那一件事"，别把九件事全抄进一个 prototype（违 README 八铁律的密度/克制精神）。
