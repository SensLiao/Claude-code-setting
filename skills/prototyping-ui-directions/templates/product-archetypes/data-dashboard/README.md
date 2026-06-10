# Data-Dashboard Archetype

> 数据密集型 dashboard / 分析控制台 / B2B admin 面板的设计知识库。
>
> 核心是 **information density（信息密度）与 data-ink ratio（Tufte）** —— 让用户在最少视觉噪声下最快扫描到数字、趋势、异常。
>
> Stage 0 用户选"加载 data-dashboard archetype"时被引入主流程；否则休眠在这里不影响主流程。

## 适用产品类型

- 分析控制台（analytics console）：PostHog / Mixpanel / Plausible / Amplitude 风格
- 运维监控面板（observability / monitoring）：Grafana / Datadog / Vercel Observability 风格
- B2B SaaS admin / 后台管理：Stripe Dashboard / Supabase / Retool 风格
- 指标墙 / KPI overview / executive summary 面板
- 数据表为主的 CRUD 控制台（Linear issue list、Airtable 风格 grid）
- 日志 / 事件 / 审计流查看器（带 filter + drill-down）

**不适用**：

- 节点编辑器 / 白板 / 流程图（→ `canvas` archetype）
- Landing / marketing（线性滚动叙事 → `landing-marketing`）
- 长故事数据可视化（data storytelling、scrollytelling → `narrative-scrolly`）
- 单图大屏可视化艺术品（信息密度 ≠ data art；本 archetype 服务于**操作型扫描**，不是展览）
- 任何"用户主要在阅读连续文章"的产品

> **边界判定**：如果用户的核心动作是"扫一眼一堆数字 → 发现异常 → 钻下去查原因 → 采取行动"，就是本 archetype。如果核心动作是"被一个数据故事打动"，那是 `narrative-scrolly`。

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `README.md` | 本文件 —— 入口 + 边界 + 铁律速查 + dimension 先验 + stage 行为 + L3 组合方式 |
| `patterns-index.md` | 13 个核心 pattern 索引（KPI card / sparkline / data table / chart panel / status pill / filter bar / command palette / sidebar nav / detail drawer / empty-zero state / time-range picker / threshold banner / skeleton loader），每个含 intent + structure + when-to-use + 它替换掉的 AI-slop |
| `data-dashboard-rules.md` | 8 条铁律的 gate 形式（红队 checklist），全部带具体数字（chart 类型上限 / tabular-nums 强制 / data-ink ratio / accent 色数上限 / 每个 async surface 必须三态） |
| `layout-engines.md` | dashboard 网格系统（sidebar+content / 12-col data grid / bento KPI / density 模式）+ responsive collapse + 推荐库（TanStack Table / Recharts / visx / ECharts / shadcn） |
| `motion-tokens.md` | 数据场景专用动效 token（number tween / chart enter / row expand）—— 克制；明确禁止的 motion；reduced-motion 兜底 |
| `interaction.md` | 表格交互（sort/filter/select/bulk）+ drill-down + hover tooltip + 全状态覆盖（default→skeleton 9 态）+ 键盘导航 |
| `reference-anchors.md` | 6-10 个 real gold-standard dashboard 范例（Vercel / Linear / Stripe / PostHog / Grafana / Datadog / Retool / Plausible / Mixpanel / Supabase），供 reference-grounding pipeline 消费 |

## 八条铁律（速查）

1. **数字必须 tabular-nums** —— 所有指标、表格数字、货币用等宽数字（`font-variant-numeric: tabular-nums`），让列对齐、跳动不抖
2. **每个 view 图表类型 ≤ 3 种** —— 一屏混 5 种图 = 信息架构失败；同一指标族用同一种图
3. **accent 色 ≤ 3 个，且语义化** —— 颜色编码状态/趋势，不做装饰；红=坏/绿=好/中性=主色，色盲必须有非色彩冗余编码
4. **data-ink ratio 优先** —— 删掉 chartjunk：无意义网格线、3D、阴影、渐变填充、重复图例；每一滴墨水都要承载数据
5. **每个 async surface 必须三态齐全** —— loading（skeleton）+ empty/zero + error，缺一不可；首屏绝不允许"白屏等数据"
6. **扫描方向遵循数字层级** —— 最重要的数字最大/最左上；KPI 用 scale contrast 建立层级，不靠颜色堆叠
7. **dark mode 数据必须可读** —— 不用纯黑底（用 `~#0a0a0a`–`#111`），不用纯白字；chart 配色在暗色下重新校准对比度，不直接反相
8. **filter / drill-down 状态进 URL** —— time range、filter、selected row、active tab 必须 URL-encodable，可分享、可刷新、可回退

> 完整 gate 形式见 `data-dashboard-rules.md`。

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 5 | 数字/视觉层级、data-ink、status 色系是核心命脉 |
| Perspective | 5 | overview → drill-down → detail 的信息架构是灵魂 |
| Responsive | 4 | density 模式 + sidebar collapse + 表格在窄屏的退化策略 |
| Interaction | 4 | sort/filter/select/bulk/keyboard 必须严谨且高效 |
| Accessibility | 4 | 表格 a11y、色盲冗余编码、键盘全覆盖（B2B 合规常要求）|
| Motion | 2 | 克制是美德；动效服务于"数据变化的可感知"，绝不炫技 |

> 这是先验，用户可在 Stage 0 调整。注意 **Motion 故意压低** —— dashboard 的好坏不靠动效，过度动效是反模式。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重建议用先验表打底（Visual/Perspective 优先，Motion 压低）；问清"信息密度档位"（comfortable / compact）|
| 1 | reference 选型推荐：Vercel / Linear / Stripe / PostHog / Grafana / Datadog / Retool / Plausible / Mixpanel / Supabase（见 `reference-anchors.md`）；要求至少锚定 2 个真实范例 |
| 2 | extract card 多一节 "dashboard pattern observed"（提取被锚定范例的密度档、图表类型、status 色系、空态处理）；direction 候选必须明确选 layout 模式（sidebar / bento / command-bar）+ density 档 |
| 3 | variant HTML 中必须至少有一个 dashboard surface 含真实数据密度（≥1 KPI 行 + 1 data table + 1 chart panel）；红队跑八铁律 + 三态检查 + tabular-nums 检查 |

## 运行时推荐（不强制）

- **TanStack Table** (@tanstack/react-table) —— headless 表格逻辑（sort / filter / pagination / column resize / row selection），不绑死样式
- **TanStack Virtual** —— 大数据集（>100 行）虚拟滚动，避免 DOM 爆炸
- **Recharts** —— 快速上手的 React 图表（中小数据量、标准图表类型）
- **visx** (@visx/*) —— Airbnb 出品，D3 + React 的低层积木；要定制可视化时用
- **ECharts** (echarts / echarts-for-react) —— 大数据量、复杂交互、热力图/桑基图等富图表
- **shadcn/ui** —— Card / Table / Badge / Command / Sheet（detail drawer）/ Skeleton 等原语，配 Tailwind
- **nuqs** —— type-safe URL search params 状态（落地铁律 8 的 filter/range URL 同步）

详见 `layout-engines.md` 的"库 × 场景"决策表。

## 如何与锁定的 L3 视觉风格组合（COMPOSES, 不 OVERRIDE）

**这是本 archetype 最容易被误用的点，必须读懂。**

- **Archetype 提供产品类型的 STRUCTURE（结构）**：信息层级、pattern 库（KPI card / table / chart）、密度规则、三态契约、扫描动线、status 语义体系。它回答的是"一个 dashboard 该有哪些零件、怎么排、密度多高、空态怎么办"。
- **L3 视觉风格提供 SKIN（皮肤）**：调色板、字体、圆角、阴影、质感、动效个性。`taste-skill` / `luxury` / `brutalist-skill` 才是 L3，它们回答"这套零件长成什么气质"。
- **组合方式**：先锁 L3（视觉皮肤），再套 data-dashboard archetype（产品结构）。archetype 的 token（间距、密度、status 色的**语义槽位**）填进 L3 提供的**具体色值/字体/质感**里。例如：archetype 说"status 需要 good/warn/bad 三个语义色 + 非色彩冗余"，L3 决定这三个色具体是哪三个 hue、什么饱和度、配什么图标。

**硬边界（违反即驳回）**：

- ❌ 本 archetype **绝不**声称或占用任何 `l3_style` enum 槽位 —— 它不是第 4 种视觉风格，永远不进 style-lock 互斥组
- ❌ 本 archetype **绝不**覆盖 L3 已锁定的调色板 / 字体 / 圆角 / 阴影语言；它只声明**语义需求**（"这里需要一个 danger 色"），不声明**具体外观**（"这里必须是 #ef4444"）
- ❌ 不允许"因为是 dashboard 所以默认 dark mode / 默认某配色" —— dark/light 与配色是 L3 + 用户决策，archetype 只保证"无论哪种皮肤，数据都可读、三态都齐、tabular-nums 都在"
- ✅ archetype 与 L3 正交：同一套 dashboard 结构可以套 `taste` 的克制编辑感、`luxury` 的高级暗金、`brutalist` 的硬边框 —— 结构不变，皮肤可换

> 一句话：**archetype 管"是不是一个好用的 dashboard"，L3 管"这个 dashboard 长得贵不贵"。两者叠加，不抢槽。**

## 不允许

- 跨类型套用（把 data-dashboard archetype 拿来做 canvas / landing / scrolly）
- 在主流程的 SKILL.md / program-director.md 里硬引用本 archetype
- 把 8 铁律当成"建议"而不是"红队 gate"
- 把本 archetype 当成 L3 视觉风格用，或让它覆盖锁定的 L3 皮肤
- 一次性加载多个 archetype（一个产品只属于一类）
