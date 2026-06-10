# Data-Dashboard — Reference Anchors

> **6-10 个真实的 gold-standard dashboard 范例**，供 reference-grounding pipeline（Stage 1）消费，把 variant 锚定到真实设计智慧，而不是 AI 默认审美。
>
> 每个锚点 = **name / where（哪里看得到）/ why exemplary（为何是标杆）/ study ONE thing（只学这一件事）**。
>
> 用法（Stage 1）：从下表选 **至少 2 个**与目标产品最接近的范例，把"study ONE thing"作为该 variant 必须体现的具体技法。不要泛泛说"参考 Stripe"，要落到具体那一件事。
>
> 注意：这些是**结构与信息设计**的标杆。它们各自的视觉皮肤（色、字、质感）不是你要照搬的——皮肤由锁定的 L3 决定。你锚定的是它们**怎么组织信息、怎么处理密度、怎么做状态**。

---

## 1. Vercel Dashboard

- **where**：`vercel.com/dashboard`（有账号即可看；deployments、analytics、observability 标签页）
- **why exemplary**：极致克制的 data-ink。深色界面下信息密度高但不拥挤；部署状态、build 日志、analytics 都用最少装饰呈现。Geist 字体 + tabular 数字的范本。
- **study ONE thing**：**部署列表的 status pill + 时间信息的克制排版** —— 一行里 status dot、commit、分支、耗时、相对时间，全部对齐、零 chartjunk，状态色是唯一的颜色。学它"一行塞五个字段还能一眼扫"。

---

## 2. Linear

- **where**：`linear.app`（产品页有大量真实截图/录屏；试用可进真实 issue 列表）
- **why exemplary**：B2B 列表/表格交互的天花板。键盘优先、command palette（`Cmd+K`）、即时筛选、视图切换流畅到像本地软件。density 控制的标杆。
- **study ONE thing**：**键盘驱动的列表交互 + `Cmd+K` 命令面板** —— 几乎一切操作都能不碰鼠标完成，filter/sort/navigate 全键盘。学它把"高频操作"做成键盘高速公路（对应本 archetype interaction.md §5）。

---

## 3. Stripe Dashboard

- **where**：`dashboard.stripe.com`（注册测试账号即可进 test mode，看 payments / balance / radar）
- **why exemplary**：金融数据 dashboard 的金标准。海量交易数据下依然清晰；金额永远 tabular-nums 对齐；时间范围、对比期、drill-down 到单笔交易的动线教科书级。空态/错误态打磨极细。
- **study ONE thing**：**金额与时间序列的精确呈现 + drill-down 动线** —— 从 overview 的收入趋势，点进去到某天，再点到单笔 charge 的完整生命周期，每一层上下文都不丢。学它"overview→明细→单据"的三层下钻 + 金额排版。

---

## 4. PostHog

- **where**：`posthog.com`（开源，可自托管或用 cloud；产品分析 insights / dashboards / funnels）
- **why exemplary**：产品分析 dashboard 的代表。多种图表类型（趋势/漏斗/留存/路径）但每个 view 克制地只用必要的几种；自助式 filter + breakdown 强大但不混乱。开源 = 可直接读它的前端实现。
- **study ONE thing**：**insight 卡片的"图表 + 控件 + 空态"自包含设计** —— 每个分析卡片自带时间范围、breakdown 维度、以及没数据时的引导。学它把 chart panel 做成自治单元（对应 patterns-index #4 + 铁律 5）。

---

## 5. Grafana

- **where**：`grafana.com` / `play.grafana.org`（公开 demo 实例，无需登录即可玩真实监控面板）
- **why exemplary**：observability/监控 dashboard 的事实标准。time-range picker、阈值告警、多 panel 网格、变量驱动的动态 dashboard —— 监控类的所有 pattern 它都有最成熟的形态。
- **study ONE thing**：**全局 time-range picker + 阈值可视化** —— 顶部统一时间窗控制所有 panel，预设 + 自定义 + 自动刷新；阈值线/变色直接画在图上。学它的时间镜头 + 阈值表达（对应 patterns-index #11 + #12）。

---

## 6. Datadog

- **where**：`datadoghq.com`（有 14 天试用进真实环境；产品页有大量 dashboard 截图）
- **why exemplary**：超高密度 observability 的极限。海量 metrics、logs、traces 在一屏共存仍可操作；status 色系、severity 分级、alert 流的处理是大规模监控的范本。
- **study ONE thing**：**高密度下的 status 色系一致性 + severity 分级** —— 成百上千个信号用一套严格的色→义映射（绿/黄/红 + 形状），critical 永远能从噪声里跳出来。学它在极端密度下守住颜色语义纪律（对应铁律 3 + patterns-index #5）。

---

## 7. Retool

- **where**：`retool.com`（免费账号可搭真实内部工具；模板库有大量 admin panel 范例）
- **why exemplary**：内部工具/admin panel 的代表。table + form + chart + 操作按钮的组合是 B2B CRUD 控制台的典型骨架；bulk action、行内编辑、detail drawer 都有成熟实现。
- **study ONE thing**：**data table 的 bulk action + 行内操作模式** —— 多选后浮出批量操作栏、行级操作菜单、点行开 drawer 编辑。学它把"表格不只是展示、还是操作面"做扎实（对应 interaction.md §1 + patterns-index #3/#9）。

---

## 8. Plausible Analytics

- **where**：`plausible.io`（开源，有公开 demo dashboard `plausible.io/plausible.io`，无需登录看真实数据）
- **why exemplary**：极简分析 dashboard 的典范。单页呈现网站核心指标，data-ink ratio 极高，几乎没有任何多余像素；证明"少图表 + 强层级"比"塞满 widget"更好用。轻量 dashboard 的最佳参照。
- **study ONE thing**：**单页极简 KPI + 一张主趋势图的克制构成** —— 顶部几个核心数字、一张可切换指标的主图、下方分维度的紧凑列表，没有花哨却信息完备。学它"做减法"的勇气（对应铁律 4 + 6）。

---

## 9. Mixpanel

- **where**：`mixpanel.com`（免费版可进真实项目；reports / insights / flows）
- **why exemplary**：自助式分析 dashboard 的代表。复杂的 event-based 查询、漏斗、留存被包装成可视化的 report builder；filter/breakdown/segment 的交互密度很高但有清晰的渐进披露。
- **study ONE thing**：**复杂查询的渐进披露式 filter/breakdown UI** —— 把"按 X 分组、筛选 Y、对比 Z"这种复杂操作做成一步步可见的控件链，而不是一个吓人的查询表单。学它驯服复杂筛选（对应 patterns-index #6）。

---

## 10. Supabase Dashboard

- **where**：`supabase.com/dashboard`（免费项目即可进；table editor、SQL editor、logs、reports）
- **why exemplary**：开发者工具 dashboard 的代表。table editor 是"密集数据网格 + 直接编辑"的好例子；logs explorer 的 filter + 时间范围 + 详情展开是日志查看器的范本。深色数据界面可读性强。
- **study ONE thing**：**table editor 的密集网格 + 行内编辑 + sticky 表头/首列** —— 大量行列下，sticky header、首列固定、单元格直接编辑、键盘移动。学它把"电子表格级密度"做得不卡不乱（对应 layout-engines.md 表格退化 + interaction.md §1）。

---

## 锚定执行规则（Stage 1 必读）

1. **选 ≥2 个**与目标产品类型最接近的范例：
   - 监控/observability → Grafana + Datadog
   - 产品分析 → PostHog + Mixpanel + Plausible
   - B2B admin / 内部工具 → Retool + Linear + Supabase
   - 金融/交易 → Stripe
   - 开发者平台 → Vercel + Supabase
2. 把选中范例的 **"study ONE thing"** 写进 Stage 2 提取卡的 "dashboard pattern observed"，并要求 Stage 3 variant **具体体现**这件事
3. **锚定的是信息结构与技法，不是皮肤** —— 颜色/字体/质感跟随锁定的 L3，不照搬范例的视觉
4. 禁止"泛泛参考"：必须落到具体一件可验证的技法（如"像 Stripe 那样做三层 drill-down"），红队会核 variant 是否真的做到了
