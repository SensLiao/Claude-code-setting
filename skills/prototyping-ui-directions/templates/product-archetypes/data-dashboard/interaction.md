# Data-Dashboard — Interaction Spec

> Dashboard 的交互契约：表格操作、drill-down、hover tooltip、全状态覆盖、键盘导航。
>
> 责任边界：**只**定义交互行为。不定义布局（→ `layout-engines.md`）、不定义 pattern 结构（→ `patterns-index.md`）、不定义动效细节（→ `motion-tokens.md`）、不写实现代码（→ Stage 2/3）。
>
> 核心信条：dashboard 是**操作型工具**，交互必须**可预测、高效、键盘友好**。创意留给视觉（且 dashboard 的视觉也该克制），交互层不许"发明新手势"。

---

## 1. Table 交互（dashboard 的核心战场）

### Sort（排序）
- **trigger**：点列头
- **行为**：单击 → 升序；再击 → 降序；三击 → 取消排序（回默认）。列头显示当前方向 `▲/▼`
- **多列排序**：`Shift+点` 追加次级排序键（power user 功能，显式提示）
- **约束**：数字列、日期列必须按真实值排序，不是字符串排序（"10" 不能排在 "2" 前）
- **状态进 URL**（铁律 8）：`?sort=revenue&dir=desc`

### Filter（筛选）
- **trigger**：filter bar 的 facet 控件 / 列头筛选图标
- **行为**：选中即应用，active filter 显形为可 × 的 chip；"Clear all" 一键清空
- **search**：debounce 200–300ms 后查询，不每键打字都打请求
- **筛空**：进入 filtered-empty 态（带"Clear filters"，铁律 5）
- **状态进 URL**

### Select + Bulk actions（多选 + 批量）
- **trigger**：行首 checkbox / `Shift+点` 范围选 / 表头 checkbox 全选（当前页 vs 全部需明确区分）
- **行为**：选中后浮出 **bulk action bar**（顶部或底部固定），显示"已选 N 项 + 可用批量操作 + 取消选择"
- **约束**：破坏性批量操作（删除/归档）必须二次确认且说清影响数量（"删除 23 条记录？"）
- **键盘**：`Space` 切换当前行选中；`Cmd/Ctrl+A` 全选

### Column 操作
- **resize**：拖列边界，宽度持久化
- **reorder / show-hide**：列设置菜单可调，配置持久化到用户偏好
- **pin**：关键标识列可 pin 到左侧（横向滚动时 sticky）

---

## 2. Drill-Down（下钻）

Dashboard 的灵魂动线：overview → 细节 → 根因。

- **trigger**：点 KPI card / 图表数据点 / 表格行
- **三种下钻深度**：
  | 深度 | 用什么 | 何时 |
  |------|--------|------|
  | 浅 | **Detail Drawer** 侧滑（保留列表上下文）| 看一眼细节就回来（高频）|
  | 中 | **就地展开行**（inline row expand）| 详情少、想对比多行 |
  | 深 | **整页路由跳转** | 详情本身是一个大工作区 |
- **面包屑**：深层下钻必须有 breadcrumb 可逐级返回，不靠浏览器后退猜
- **保持上下文**：drawer/展开关闭后，列表滚动位置、选中行、筛选状态**全部保留**（铁律 8 让这天然成立）
- **图表点击下钻**：点 chart 的某个 bar/segment → 筛选下方表格到该维度（"点这天 → 表格只看这天的事件"）

---

## 3. Hover Tooltip（悬停披露）

- **图表 tooltip**：hover 数据点 → 显示精确值 + 单位 + 时间戳 + （多 series 时）该 x 处所有 series 值。跟随光标，不遮挡数据点
- **截断文本 tooltip**：表格单元格文本被省略号截断时，hover 显示全文
- **指标说明 tooltip**：KPI label 旁 `ⓘ` 图标，hover 解释"这个指标怎么算的"（消除歧义，B2B 必备）
- **delay**：tooltip 出现 delay 300–500ms（防扫过时狂闪），消失即时
- **约束**：tooltip 是**渐进披露**，不是藏关键信息的地方——核心数字永远直接可见，tooltip 只给精度/解释

---

## 4. 全状态覆盖（9 态，逐一定义）

任何可交互/异步元素必须定义这 9 个态。这是 dashboard 区别于 demo 的硬线。

| 态 | 定义 | 视觉要求 |
|----|------|----------|
| **default** | 静止可读 | 数据清晰、tabular-nums、层级分明 |
| **hover** | 指针悬停 | 极轻高亮（背景/边框），≤120ms，提示可交互 |
| **active / pressed** | 正在点击 | 即时反馈（轻微按下感），无延迟 |
| **focus** | 键盘聚焦 | **清晰 focus ring**（≥2px，对比达标）—— 键盘用户的命脉，绝不删 outline |
| **loading** | 异步加载中 | skeleton（匹配布局，非裸 spinner）|
| **empty / zero** | 无数据 | 三分空态：首次空(CTA) / 筛选空(Clear) / 正常零值(正向语气)|
| **error** | 加载/操作失败 | 错误说明 + 重试入口，不静默白屏 |
| **disabled** | 不可用 | 降低对比 + `cursor: not-allowed` + （建议）tooltip 说明为何禁用 |
| **skeleton** | loading 的具体形态 | 复刻目标布局的灰块，shimmer ≤1.5s，数据到达无 CLS |

> **红队**：随手抽一个 chart panel / 表格，问"这 9 个态都有吗"。缺 focus ring、缺三态、缺 disabled 说明 = 驳回。

### 状态间的优先级
- error 覆盖 loading（失败了就别再转）
- disabled 覆盖 hover/active（禁用就不响应）
- focus 与 hover 可叠加（键盘聚焦 + 鼠标悬停同时存在）

---

## 5. 键盘导航（B2B 合规 + power user 刚需）

| 操作 | 快捷键 |
|------|--------|
| 全局命令面板 | `Cmd/Ctrl + K` |
| 表格行间移动 | `↑ / ↓` |
| 进入/展开当前行（drawer）| `Enter` |
| 关闭 drawer / 取消 / 退出 | `Esc` |
| 切换当前行选中 | `Space` |
| 全选 | `Cmd/Ctrl + A` |
| drawer 内切上一条/下一条 | `↑ / ↓` 或 `J / K` |
| 焦点在控件间移动 | `Tab / Shift+Tab`（顺序必须符合视觉顺序）|

**硬约束**：
- 所有操作鼠标能做的，键盘也要能做（WCAG 2.1.1 Keyboard）
- focus 顺序符合视觉/逻辑顺序，无 focus 陷阱
- focus ring 永不为了"好看"而删（删 outline = 打掉键盘可用性）
- 快捷键遵循平台/同类产品默认期望（不发明 `Cmd+J` 去做"删除"这种反直觉绑定）

---

## 6. 表格 a11y（容易漏，单列）

- 用语义 `<table>/<th>/<td>`，不用 div 堆假表格（屏幕阅读器需要表格语义）
- 列头 `scope="col"`，行头 `scope="row"`
- 排序状态用 `aria-sort="ascending|descending|none"`
- 数字列 `<td>` 右对齐但语义不变
- 状态 pill 的颜色信息要有文字/`aria-label`（色盲 + 屏幕阅读器，呼应铁律 3）

---

## 不允许

- 发明新手势/新交互词去做标准操作（sort/filter/select 必须是用户预期的样子）
- 删 focus ring（打掉键盘可用性）
- 字符串排序冒充数字排序
- tooltip 藏关键数字（核心数据必须直接可见）
- 破坏性批量操作不二次确认 / 不说影响数量
- 下钻丢失列表上下文（滚动位置/选中/筛选必须保留）
- 假 `<table>`（div 堆叠，破坏 a11y）
- 9 态不全的异步元素流入 variant
