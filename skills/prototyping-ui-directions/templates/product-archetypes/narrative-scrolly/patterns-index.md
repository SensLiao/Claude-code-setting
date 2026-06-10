# Narrative-Scrolly Patterns — Index

> 12 个核心 scrollytelling pattern。每个 = intent（要解决什么叙事问题）+ structure（怎么搭）+ when（什么时候用）+ replaces（它替换掉的那个 slop）。
> 交互 spec（state / a11y / reduced-motion）见 `interaction.md`；motion token 见 `motion-tokens.md`；布局逻辑见 `layout-engines.md`。

## 速查表

| # | Pattern | 一句话 | 主 driver | Reduced-motion 降级 |
|---|---------|--------|-----------|--------------------|
| 1 | Sticky-Visual + Stepped Text | 图钉住，文字分步走过 | step trigger | 图文交替的线性长文 |
| 2 | Pinned Section | 一段被钉住、内部演进 | scrub / step | 直接展开为正常流 |
| 3 | Horizontal-Scroll Act | 纵滚驱动横向位移的一幕 | scrub | 纵向堆叠卡片 |
| 4 | Scroll-Triggered Reveal | 进入视口即揭示 | enter trigger | 内容默认可见 |
| 5 | Progress / Chapter Indicator | 我在哪、还有多少 | scroll progress | 静态目录 |
| 6 | Parallax Layer | 前后景差速营造深度 | scroll-linked | 静止分层 |
| 7 | Image-Sequence Scrub | 滚动 = 逐帧播放 | scrub | 单张关键帧 / 短视频 |
| 8 | Data-Step Chart | 一图随章节逐步揭示数据 | step trigger | 完整静态图 + 注释 |
| 9 | Full-Bleed Interstitial | 满幅过场分隔两章 | enter / scrub | 满幅静态图 + 标题 |
| 10 | Pull-Quote | 抽出金句作叙事呼吸点 | enter trigger | 加重排版的 blockquote |
| 11 | End CTA / Coda | 故事收尾 + 下一步 | enter trigger | 普通 footer CTA |
| 12 | Chapter Anchor Nav | 跳章 + skip 控制 | click / hash | 顶部锚点目录 |

---

## 1. Sticky-Visual + Stepped Text（scrollytelling 核心范式）

- **intent**：让一个**持续可见的图形**（图表 / 地图 / 产品图 / 3D）随读者滚过的文字步骤而演进——"边讲边演"。这是数据新闻最经典的范式。
- **structure**：左/右一栏 `position: sticky; top: 0; height: 100vh` 的图形容器；另一栏是正常文档流的 step 块（每块约 1 视口高）。step 进入视口 → 触发图形切换状态（换数据/换 highlight/换镜头）。
- **when**：一个视觉对象需要被"逐步解读"——数据集、地图、产品拆解、流程演进。
- **replaces**：❌ slop = "图在上、一大段文字在下、各说各的"的图文割裂；或图文同时全量出现、读者不知道先看哪。Sticky-visual 把"看哪、何时看"编排死。

## 2. Pinned Section（图钉幕）

- **intent**：把某一幕**钉在屏幕中央**，让读者在原地停留期间内部完成一段演进（计数器跑动 / 元素逐个进入 / 镜头推进），结束后释放继续滚。
- **structure**：`ScrollTrigger { pin: true, start: "top top", end: "+=N*100vh", scrub }`；pin 期间内部用 scrub 或 sub-step 推进；`end` 决定停留时长（铁律：≤3 视口高）。
- **when**：一个高潮节点需要"被强调、被停下来看"——关键数字揭晓、产品 360° 展示、转折点。
- **replaces**：❌ slop = 满页都在 pin、每段都 scroll-jack，读者永远在"被卡住"。Pin 是稀缺强调手段，不是默认布局。

## 3. Horizontal-Scroll Act（横向一幕）

- **intent**：在一段纵向滚动里插入**一幕横向移动**（时间线 / 画廊 / 流程带），用纵滚距离驱动横向位移，制造节奏变化。
- **structure**：外层 pin 容器（高 = 横向内容宽度换算的滚动距离）；内层 `transform: translateX(-progress * (scrollWidth - vw))` 由 scrub 驱动。
- **when**：内容天然是横向序列（编年时间线、步骤流水、对比画廊），且想打破"一直往下"的单调。
- **replaces**：❌ slop = 把横向内容硬塞进纵向、或做成需要用户**手动横拖**的滚动条（移动端灾难、可发现性差）。纵滚驱动横移让交互保持单一心智。⚠️ 移动端必须降级为纵向堆叠（见 `layout-engines.md`）。

## 4. Scroll-Triggered Reveal（进入即揭示）

- **intent**：元素在进入视口时以受控方式揭示（淡入 / 上移 / clip-path 擦除），制造"内容随你而来"的节奏，而不是一次性平铺。
- **structure**：IntersectionObserver（`threshold ≈ 0.2`，`rootMargin` 收一点）→ 加 `is-visible` class → CSS transition 接管（transform+opacity）。**幂等**：回滚再进入不重播（除非显式 replay）。
- **when**：几乎所有 step / 段落 / 图片的入场默认手法（轻量、低风险）。
- **replaces**：❌ slop = 全站每个元素都 `fade-up 600ms` 的 "AOS 罐头动画"满屏乱飞、滚到哪炸到哪、还会布局抖动。Reveal 要克制：一次一个叙事单元，threshold 一致，绝不动 layout。

## 5. Progress / Chapter Indicator（进度 / 章节指示）

- **intent**：长故事必须随时回答"我读到哪了、还剩多少"，降低"无尽滚动"的焦虑。
- **structure**：顶部 `scaleX` 进度条（值 = `scrollTop / scrollHeight`，transform 驱动）；或侧边 chapter dots（当前章高亮，可点击跳转）。`position: fixed`，不参与布局。
- **when**：任何 > 3 屏的叙事；章节 ≥ 3 个时强烈建议 chapter dots。
- **replaces**：❌ slop = 没有任何进度反馈的"深渊滚动"，读者不知道还要滚多久就弃读。指示器是叙事的"地图"。

## 6. Parallax Layer（差速分层）

- **intent**：让前景/背景以不同速度移动，营造**深度感**与氛围，强化场景过渡。
- **structure**：分层元素按 `translateY(scrollProgress * depthRatio)` 移动，depthRatio 越小越"远"（背景 0.1–0.3，前景 0.6–1.0）；scroll-linked，非 scrub 不必 pin。
- **when**：hero / 章节过场 / 氛围铺陈，想要电影感的少数节点。
- **replaces**：❌ slop = 全页 parallax、视差幅度过大导致眩晕 + 抖动 + 移动端卡顿。Parallax 是点缀（每故事 ≤2–3 处），幅度小（depth 差 < 0.5），reduced-motion 下完全关闭。

## 7. Image-Sequence Scrub（逐帧擦洗）

- **intent**：把滚动映射为一段**逐帧序列**的播放进度（产品旋转 / 拆解 / 变形），即 Apple AirPods Pro 式的"滚动驱动动画"。
- **structure**：预载/懒载一组帧（或 `<canvas>` 逐帧绘制）；`frameIndex = floor(progress * (frames-1))`；scrub 绑定。帧数 / 分辨率严格预算（见铁律 5、`layout-engines.md`）。
- **when**：实体产品展示、形态演变、需要"用户控制时间轴"的强表现节点。
- **replaces**：❌ slop = 塞一段几十 MB 的视频自动播放、或上千张全分辨率 PNG 拖垮 LCP/带宽。Scrub 必须配懒加载 + 降帧 + 占位尺寸；低端设备/reduced-motion 降级为单张关键帧。

## 8. Data-Step Chart（数据分步图）

- **intent**：data journalism 核心——同一张图随章节**逐步揭示**（先看总量→再拆分→再 highlight 异常），让数据"被讲出来"而非一次砸给读者。
- **structure**：sticky chart（D3 / SVG / Canvas）+ stepped text（见 Pattern 1）；每个 step 携带一个 chart state（数据子集 / 轴范围 / 高亮 / 注释），enter 时过渡（≤500ms）。
- **when**：任何"用数据讲故事"的段落——趋势、对比、地理分布、异常揭示。
- **replaces**：❌ slop = 把一张信息爆炸的复杂图直接糊上来、读者无从下手；或图与解说文字分离。Data-step 把"读图顺序"编排成叙事。**reduced-motion 下**：展示完整静态图 + 全部注释（信息不丢，只是不分步）。

## 9. Full-Bleed Interstitial（满幅过场）

- **intent**：用一幅**满视口**的图像/色块/标题作章节之间的"呼吸"与转场，重置读者注意力。
- **structure**：`width:100vw; min-height:100svh` 的段；可叠 parallax 或 scrub 的轻揭示；标题居中或编辑式偏置。注意 `svh/dvh` 处理移动端地址栏。
- **when**：两个语义差异大的章节之间需要分隔与情绪切换。
- **replaces**：❌ slop = 通篇等宽文档流毫无节奏；或满幅大图纯装饰、不承载任何转场语义。Interstitial 必须服务"章节切换"这个叙事功能。

## 10. Pull-Quote（金句呼吸点）

- **intent**：把一句**关键论断/数据/引语**放大抽出，作为叙事的重音与视觉停顿。
- **structure**：大字号、收窄行宽（measure 30–40ch）、留白充足；可配 enter 时的轻揭示。属于 L3 排版皮肤 + 本 archetype 的"节奏位置"协作。
- **when**：每隔 2–4 屏需要一个视觉/语义重音；强观点、强数据、强引用。
- **replaces**：❌ slop = 整篇均匀灰字无重音、读者读到睡着；或把每段都加粗放大（重音=无重音）。Pull-quote 是稀缺重音，密度受控。

## 11. End CTA / Coda（收尾与下一步）

- **intent**：故事有结尾——给读者一个情绪落点 + 明确下一步（订阅 / 分享 / 探索数据 / 购买 / 读下一篇）。
- **structure**：收束段（呼应开头/点题）+ 单一主 CTA + 可选次级链接（来源、方法论、相关故事）。揭示用 enter trigger，克制。
- **when**：每个 scrollytelling 故事的最后一幕，必有。
- **replaces**：❌ slop = 故事戛然而止直接撞 footer，读者悬在半空无处可去；或塞满五个等权 CTA 的转化漏斗（那是 landing-marketing 的事，不是叙事收尾）。Coda 先收束情绪，再给**一个**主行动。

## 12. Chapter Anchor Nav（跳章 + skip 控制）

- **intent**：让读者能**非线性跳转**到某章 + 提供"跳过动画/直达正文"的逃生口，是 scrollytelling 的无障碍命脉。
- **structure**：固定/可展开的章节锚点列表（`href="#chapter-N"`，平滑滚动且尊重 reduced-motion）；页首 skip-link（"跳到正文/跳过开场动画"）；每章 `id` + `scroll-margin-top` 防被固定头遮挡。
- **when**：任何多章叙事；尤其有重 pin/scrub 开场时（必须能跳过）。
- **replaces**：❌ slop = 唯一的前进方式是"老老实实滚到底"、键盘用户和赶时间的人被困死。Anchor nav + skip-link 把"被引导"和"可自主"两种需求都满足。

## Pattern × 设备 / 模式 兼容矩阵

| Pattern | Desktop | Mobile（窄屏） | Reduced-motion / no-JS |
|---------|---------|---------------|------------------------|
| 1 Sticky-Visual + Steps | ✅ 主战场 | ⚠️ sticky 改为 figure 内嵌于 step 流 | ✅ 退化为图文交替长文 |
| 2 Pinned Section | ✅ | ⚠️ 缩短 pin 或取消 pin | ✅ 正常文档流展开 |
| 3 Horizontal Act | ✅ | ❌ 降级为纵向堆叠 | ✅ 纵向堆叠 |
| 4 Reveal | ✅ | ✅ | ✅ 内容默认可见 |
| 5 Progress/Chapter | ✅ | ✅（dots 可折叠） | ✅ 静态目录 |
| 6 Parallax | ✅ 少量 | ⚠️ 关闭或极弱 | ✅ 静止 |
| 7 Image-Sequence | ✅ | ⚠️ 降帧/降分辨率 | ✅ 单张关键帧 |
| 8 Data-Step Chart | ✅ 主战场 | ✅（图随 step） | ✅ 完整静态图+注释 |
| 9 Full-Bleed Interstitial | ✅ | ✅ | ✅ 静态满幅 |
| 10 Pull-Quote | ✅ | ✅ | ✅ |
| 11 End CTA / Coda | ✅ | ✅ | ✅ |
| 12 Chapter Anchor Nav | ✅ | ✅ | ✅（核心逃生口，必须留） |
