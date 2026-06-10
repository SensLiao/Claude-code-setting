# Data-Dashboard Patterns — Index

> 13 个核心 dashboard pattern。每个 = **intent（意图）/ structure（结构）/ when-to-use（何时用）/ replaces（它替换掉的 AI-slop）**。
>
> 这些是 dashboard 的"标准零件"。Stage 2 提取卡引用 pattern id，Stage 3 variant 必须用这里的 pattern 组装，不许自创"看起来很 dashboard 但功能不明"的零件。
>
> 所有 pattern 的视觉皮肤由锁定的 L3 决定（见 README "如何与 L3 组合"）；本文件只定义结构与反 slop 规则。

## 速查表

| # | Pattern | 一句话 intent | 替换掉的 AI-slop |
|---|---------|--------------|------------------|
| 1 | Metric / KPI Card | 单指标 + 趋势 + 对比的最小单元 | 3 张一模一样的渐变 stat card |
| 2 | Sparkline | 卡内嵌入的 micro-trend，无坐标轴 | 给一个数字配一张占半屏的大 line chart |
| 3 | Data Table (sort + filter) | 多行多列的可扫描、可操作真相源 | 用 card grid 堆叠本该是表格的数据 |
| 4 | Chart Panel | 带标题/图例/时间范围的图表容器 | 无标题、无单位、无空态的裸 `<canvas>` |
| 5 | Status Pill System | 状态/严重度的语义化色标体系 | 满屏彩色 badge，颜色无统一语义 |
| 6 | Filter Bar | 收敛数据集的水平筛选器组 | 把 filter 散落在页面各处、状态不进 URL |
| 7 | Command Palette | `Cmd+K` 全局跳转/操作入口 | 一个塞满 30 个 item 的顶部下拉菜单 |
| 8 | Sidebar Nav | 分区导航 + 可折叠的左栏 | 顶部水平 tab 塞 12 个一级入口 |
| 9 | Detail Drawer | 行/卡点击后侧滑的详情面板 | 点一行就整页跳转、丢失列表上下文 |
| 10 | Empty / Zero State | 无数据/全清空时的有用空态 | 一句灰色 "No data"，无引导无解释 |
| 11 | Time-Range Picker | 全局时间窗 + 预设 + 对比期 | 只有一个日期输入框、无 7D/30D 预设 |
| 12 | Alert / Threshold Banner | 越界/异常的醒目横幅 + 行动 | 把告警混进普通文本、无严重度分级 |
| 13 | Skeleton Loader | 加载中的结构占位（非 spinner） | 整页转圈 spinner、布局加载后跳动 |

---

## 1. Metric / KPI Card

**intent**：把"一个关键数字 + 它的方向 + 它的参照"压进一个可一眼读完的卡片。这是 dashboard 的原子。

**structure**：`[label（小、次要）] → [大数字（tabular-nums，最大字号）] → [delta（▲12.4% vs 上期，带色）] + [可选 sparkline]`。删除时间范围标注交给全局 time picker，不在每张卡重复。

**when-to-use**：overview 顶部 KPI 行（3–6 个）；每个代表一个北极星/健康指标。

**replaces**：❌ **3 张一模一样的渐变 stat card**（都是同样圆角、同样图标、同样 `+X%`、颜色纯装饰）。AI 最爱产这个。正解：① 数字字号建立层级（最重要的更大）② delta 必须有真实参照期 + 语义色 + 方向箭头 ③ 渐变背景删掉，data-ink 留给数字。

---

## 2. Sparkline

**intent**：在极小空间（一行高）里给一个数字配上下文趋势，回答"这个数字最近是涨是跌"。

**structure**：无坐标轴、无网格、无标签的 micro line/area，宽 60–120px、高 16–32px。可标 last-point dot + min/max 极值点。颜色跟随 delta 语义（涨绿跌红或中性）。

**when-to-use**：嵌在 KPI card 内、表格的"趋势"列、列表项尾部。

**replaces**：❌ **给一个数字配一张占半屏、带完整坐标轴+图例+网格的 line chart**。趋势上下文不该抢走数字的主角位。sparkline 是"数据墨水比"的典范：去掉一切非数据像素。

---

## 3. Data Table (sort + filter + select)

**intent**：多行多列结构化数据的**真相源**。可扫描、可排序、可筛选、可批量操作。dashboard 里最被低估、被 AI 最常错配的 pattern。

**structure**：`[列头（可点排序，带方向 ▲▼ + 可选 resize）] → [行（zebra 或仅 hover 高亮，数字列右对齐 tabular-nums）] → [行级 hover 操作 / checkbox 多选] → [底部 pagination 或虚拟滚动]`。粘性表头（sticky header）+ 首列可粘（sticky first column）应对横向滚动。

**when-to-use**：任何"一堆同构记录"——用户、订单、事件、issue、日志、交易。**判定**：如果你在用 card 重复渲染同样的字段集 → 它本该是表格。

**replaces**：❌ **用 card grid 堆叠本该是表格的数据**（每条记录一张卡，浪费空间、无法按列扫描、无法排序对比）。也替换 ❌ 数字列左对齐导致无法纵向比大小。正解：同构记录 = 表格；数字列右对齐 + tabular-nums；排序/筛选是一等公民。

---

## 4. Chart Panel

**intent**：给一个图表配齐"读懂它需要的一切"——标题、单位、时间范围、图例、以及它自己的三态。

**structure**：`[panel 头：标题 + 单位 + 可选 time-range 局部覆盖 + 溢出菜单] → [图表本体] → [图例（仅在 >1 series 时）]`。每个 panel 自带 loading skeleton / empty / error 三态。轴标签精简，y 轴用缩写（1.2k 而非 1200）。

**when-to-use**：趋势（line/area）、构成（stacked bar/100% bar）、分布（histogram）、对比（grouped bar）。**一个 view 里图表类型 ≤ 3 种**（铁律 2）。

**replaces**：❌ **无标题、无单位、无空态的裸图表**（直接甩一个 `<canvas>`，用户不知道这是什么、单位是什么、没数据时白板一块）。还替换 ❌ 饼图超过 5 个扇区（改用条形）、❌ 双 y 轴误导对比。

---

## 5. Status Pill System

**intent**：用一套**统一语义**的小色标，把状态/严重度/健康度编码成可一眼分类的视觉信号。

**structure**：`[dot 或 filled pill] + [文字标签]`。固定语义槽位：`success/healthy`（绿）、`warning/degraded`（琥珀）、`error/critical/down`（红）、`neutral/idle`（灰/主色）、`info`（蓝）。**色盲冗余**：每个状态除颜色外必须有图标或文字差异。色值由 L3 提供，本 pattern 只锁语义槽位。

**when-to-use**：表格状态列、服务健康、部署状态、订单流转、告警严重度。

**replaces**：❌ **满屏彩色 badge，颜色无统一语义**（这个绿是"成功"那个绿是"标签"，用户无法建立色→义映射）。正解：全产品共用一张 status→color→icon 映射表，绝不复用状态色做装饰。

---

## 6. Filter Bar

**intent**：把"收敛当前数据集"的所有控件聚到一处，让用户快速切片，且切片状态可分享。

**structure**：水平排列的 `[search] + [facet 下拉/多选] + [time-range（或独立放右上）] + [active filter chips（可单独 ×）] + [Clear all]`。已激活的 filter 用 chip 显形，不让用户猜"现在看的是哪个切片"。

**when-to-use**：data table 上方、事件流上方、任何大数据集前。

**replaces**：❌ **filter 散落在页面各处 + 状态不进 URL**（刷新就丢、无法发链接给同事"看我看到的这个异常"）。正解：filter 集中 + active chips 可见 + 状态 URL-encodable（铁律 8）。

---

## 7. Command Palette

**intent**：`Cmd/Ctrl+K` 唤起的全局模糊搜索 —— 跳转、操作、切换的统一键盘入口。给 power user 的高速公路。

**structure**：`[模糊搜索框] → [分组结果：Navigation / Actions / Recent / Search results] → [键盘上下选 + Enter 执行 + 显示快捷键提示]`。结果按相关度排，最近用过的置顶。

**when-to-use**：任何中大型 B2B 控制台（页面/实体多到导航装不下时）。Linear / Vercel / Stripe 都有。

**replaces**：❌ **一个塞满 30 个 item 的顶部下拉菜单**（深层功能藏三级、找不到、鼠标地狱）。正解：导航靠 sidebar 给结构，命令面板给速度，两者互补。

---

## 8. Sidebar Nav

**intent**：用左侧竖栏承载产品的**信息架构骨架**——分区、分组、可折叠，让用户始终知道"我在哪、能去哪"。

**structure**：`[logo/工作区切换器] → [分组导航项（icon + label，active 高亮）] → [可折叠为 icon-only rail] → [底部：账号/设置/折叠按钮]`。多层级用 collapsible section，不用 hover 飞出菜单（不可靠）。

**when-to-use**：≥5 个一级区域的控制台。是 dashboard 的默认导航模式。

**replaces**：❌ **顶部水平 tab 塞 12 个一级入口**（横向挤爆、响应式崩溃、无层级）。正解：一级结构进 sidebar（纵向可扩展 + 可折叠省空间），顶部 bar 只留全局动作（搜索/通知/账号）。

---

## 9. Detail Drawer

**intent**：点击行/卡时，从侧边滑出详情面板，**保留列表上下文**——用户能看细节又不丢失"我在列表哪一行"。

**structure**：右侧 `Sheet`（宽 400–600px）滑入，含 `[实体标题 + 关闭] → [关键字段] → [关联数据/活动时间线] → [行动按钮]`。背景列表保留可见（半遮罩或并排）。支持 `Esc` 关闭、上下键切换上一条/下一条记录。

**when-to-use**：表格行详情、事件详情、用户档案 —— 任何"看一眼细节就回列表"的高频动作。

**replaces**：❌ **点一行就整页跳转、丢失列表上下文和滚动位置**（看完详情按返回，列表回到顶部，刚才看的那行找不到了）。正解：drawer 保留上下文；只有"详情本身是一个大工作区"时才整页跳转。

---

## 10. Empty / Zero State

**intent**：在"还没数据 / 被筛空 / 全部清零"时，给出**有用的**空态——解释为什么空 + 下一步做什么，而不是冷冰冰一句话。

**structure**：区分三种空：① **首次空（onboarding）**：图示 + "还没有数据" + 主 CTA（导入/创建/连接数据源）② **筛选空（filtered-empty）**：「当前筛选无结果」+ "Clear filters" 按钮 ③ **正常零值（zero is valid）**：如"0 个未解决告警"——这是**好事**，用绿色/正向语气，不当错误处理。

**when-to-use**：每个 data table、chart panel、列表都必须有（铁律 5 的一部分）。

**replaces**：❌ **一句灰色 "No data"，无引导无解释**（用户不知道是出错了、还没配、还是筛空了）。正解：三种空各有专门文案与行动；"零"可能是成功而非失败。

---

## 11. Time-Range Picker

**intent**：dashboard 的"时间镜头"——一处控制全局/局部时间窗，带常用预设和对比期。

**structure**：`[预设：1H / 24H / 7D / 30D / 90D / Custom] + [自定义日期范围] + [可选：vs 上一周期对比开关] + [时区标注]`。选择后所有受控 panel 同步刷新；范围进 URL。预设覆盖 80% 场景，custom 兜底。

**when-to-use**：任何时间序列 dashboard（监控、分析、趋势）。通常放右上角全局位。

**replaces**：❌ **只有一个裸日期输入框、无 7D/30D 预设**（每次想看"最近一周"都要手动选两个日期）。正解：预设优先 + 对比期 + 时区清晰 + 状态进 URL。

---

## 12. Alert / Threshold Banner

**intent**：当指标越界/服务异常/有需立即关注的事，用**分级醒目**的横幅打断扫描，并给出行动入口。

**structure**：`[严重度色条/图标] + [简明问题陈述（含数字：CPU 94% > 阈值 80%）] + [主行动按钮（查看/确认/静音）] + [可关闭]`。严重度分级：critical（红，置顶不可忽略）/ warning（琥珀）/ info（蓝）。多条告警折叠成"N 个告警"可展开。

**when-to-use**：监控面板顶部、越过阈值时、incident 期间。

**replaces**：❌ **把告警混进普通正文、无严重度分级**（critical 和 info 长一样，用户分不清哪个要命）。正解：分级 + 含具体数字 + 带行动 + critical 不可被滚动淹没。

---

## 13. Skeleton Loader

**intent**：加载期间用**结构化灰块**占位，预示即将到来的布局，避免空白焦虑和加载后跳动（CLS）。

**structure**：复刻目标布局的灰色占位块（卡的形状、表格的行、图表的矩形），带极轻的 shimmer 或 pulse（≤1.5s 周期）。**形状必须匹配真实内容尺寸**，数据到达后无布局位移。

**when-to-use**：每个 async surface 的 loading 态（铁律 5）。**默认优于 spinner**——spinner 只说"在转"，skeleton 说"马上是这个样子"。

**replaces**：❌ **整页转圈 spinner + 布局加载后跳动**（用户盯着 spinner 不知道要等什么；数据到了页面突然重排，正在点的东西位移）。正解：skeleton 匹配最终布局；spinner 只留给"不可预知形状/极短(<300ms)"的加载。

---

## Pattern 组合矩阵（典型 dashboard view）

| View 类型 | 必含 pattern | 常见可选 |
|-----------|-------------|----------|
| Overview / 首页 | KPI Card ×N + Chart Panel + Time-Range Picker | Sparkline、Threshold Banner |
| 列表 / 管理台 | Data Table + Filter Bar + Detail Drawer | Command Palette、Bulk actions、Empty State |
| 监控 / observability | Chart Panel ×N + Status Pill + Threshold Banner + Time-Range | Alert list、Sparkline |
| 实体详情 | Detail Drawer 或全页 + KPI Card + 关联 Data Table | Activity timeline、Status Pill |
| 全局（所有 view） | Sidebar Nav + Command Palette + Skeleton（loading）+ Empty/Error | — |

> 任何 view 都至少要过：三态齐全（铁律 5）、tabular-nums（铁律 1）、图表 ≤3 种（铁律 2）。
