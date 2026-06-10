# Layout Engines — Data-Dashboard

> Dashboard 的布局编排：网格系统、density 模式、responsive collapse、推荐库。
>
> 责任边界：**只**编排布局与网格。不定义交互（→ `interaction.md`）、不定义 pattern 结构（→ `patterns-index.md`）、不定义动效（→ `motion-tokens.md`）、不定义视觉皮肤（→ 锁定的 L3）。

## 三种布局骨架

| 骨架 | 结构 | 适用 |
|------|------|------|
| **Sidebar + Content** | 左侧固定/可折叠导航栏 + 右侧主内容区（顶部可加 command bar） | 默认。≥5 区域的 B2B 控制台、admin 后台 |
| **Bento KPI Grid** | 不规则但对齐的卡片网格，不同卡跨不同行列（KPI 大、趋势宽、列表高） | overview / executive summary 首屏，需要在一屏塞多个异构 widget |
| **Command-Bar + Canvas** | 顶部命令栏（搜索/筛选/动作）+ 下方单一密集内容（大表格/大图） | 单实体深挖型工具（log viewer、query console、单一大表格）|

> 这三个**可嵌套**：典型生产 dashboard = Sidebar+Content 外壳，content 区内 overview 用 Bento，列表页用 Command-Bar+表格。

---

## Sidebar + Content（默认外壳）

```
┌──────┬───────────────────────────────┐
│ logo │  [global search]   [time]  [@] │  ← top bar：全局动作
│      ├───────────────────────────────┤
│ nav  │                               │
│ nav  │      content area             │  ← 主内容（可滚动）
│ nav  │      (bento / table / charts) │
│ ─────│                               │
│ acct │                               │
└──────┴───────────────────────────────┘
   ↑ 可折叠为 icon-only rail (64px)
```

- sidebar 宽：展开 `240–280px`，折叠 rail `56–64px`
- top bar 高：`48–64px`，sticky
- content 区独立滚动，sidebar/topbar 固定
- sidebar 状态（展开/折叠）持久化到 localStorage

---

## 12-Column Data Grid（content 区内部）

content 区内部用 12 列网格排布 widget，让异构卡片对齐：

| Widget | 典型跨列（desktop） |
|--------|---------------------|
| KPI card | 3 列（一行 4 个）或 2 列（一行 6 个）|
| 趋势 chart panel | 6–8 列 |
| 宽 data table | 12 列（整行）|
| 窄 list / status panel | 4 列 |
| 占满主图 | 12 列 |

- gutter：comfortable `24px` / compact `16px`
- 行高用 `min-content` + 内容驱动，不强制等高（等高是 bento 反模式之一）

---

## Bento KPI Grid

Bento ≠ 等大方格。要点：

- 卡片**大小随重要性变化**：北极星指标卡可跨 2×2，次要趋势 1×2，迷你 stat 1×1
- 所有卡片**边缘对齐**到同一网格（这是 bento 之所以不乱的关键）
- 避免 ❌ "n 张同尺寸卡均匀铺满"（那是 AI-slop card grid，不是 bento）
- gap 统一（comfortable 24px / compact 16px）

---

## Density 模式：comfortable / compact

Dashboard 必须支持密度切换 —— B2B power user 要 compact 塞更多数据，新手/演示要 comfortable。

| Token | comfortable | compact |
|-------|-------------|---------|
| 表格行高 | `44–48px` | `32–36px` |
| 单元格 padding (y) | `12px` | `6–8px` |
| 卡片 padding | `20–24px` | `12–16px` |
| 网格 gutter | `24px` | `16px` |
| 基础字号 | `14px` | `13px` |
| KPI 主数字 | `32–40px` | `24–28px` |

- 密度档作为 design token 注入，一处切换全局生效
- 默认档：分析/监控类倾向 compact；管理/演示类倾向 comfortable
- 密度选择持久化（用户偏好）

---

## Responsive Collapse 策略

Dashboard 在窄屏是**退化**问题，不是"等比缩小"。固定退化顺序：

| 断点 | 动作 |
|------|------|
| `≥1280px` | 全展开：sidebar 展开 + 多列 bento + 表格全列 |
| `1024–1280px` | sidebar 自动折叠为 rail；bento 降到 2 列 |
| `768–1024px` (tablet) | sidebar 变 overlay drawer（汉堡触发）；bento 单列堆叠；表格隐藏次要列 |
| `<768px` (mobile) | sidebar = 底部 tab 或 drawer；KPI 单列；**表格转 card-list 或保留横向滚动 + sticky 首列**；图表降为 sparkline 或可滚动 |

**表格的窄屏退化**（最关键）：
- 优先：隐藏次要列（保留 1 关键标识列 + 1–2 核心指标列）
- 或：横向滚动 + sticky 首列（用户左右刷）
- 或：每行转为紧凑 card（仅当列数少时）
- ❌ 绝不：让 12 列表格在手机上无策略地溢出/挤压换行

---

## 库 × 场景决策表

| 需求 | 选这个 | 不选/注意 |
|------|--------|-----------|
| 表格逻辑（sort/filter/pagination/select/resize） | **TanStack Table**（headless，不绑样式） | 不要手搓排序/筛选状态机 |
| 大数据集（>100 行）滚动 | **TanStack Virtual** | 不虚拟化会 DOM 爆炸卡死 |
| 标准图表、快速上手、中小数据 | **Recharts** | 超大数据量/复杂交互时换 ECharts |
| 定制可视化、要 D3 控制力 | **visx**（@visx/*，D3+React 积木）| 学习曲线陡，简单图别用 |
| 大数据量/富交互/热力图/桑基/地图 | **ECharts**（echarts-for-react）| bundle 较大，按需引入 |
| 原语（Card/Table/Badge/Command/Sheet/Skeleton）| **shadcn/ui** + Tailwind | 是 unstyled 起点，皮肤交给 L3 |
| URL 状态同步（filter/range/sort）| **nuqs**（type-safe search params）| 不要手拼 query string（铁律 8）|

> **皮肤归属**：以上库都只提供**结构/逻辑**。具体调色、字体、圆角、阴影、质感由**锁定的 L3**决定（见 README "如何与 L3 组合"）。archetype 不在这里指定颜色。

## 不允许

- 全 view 强制等高卡片网格（杀死 bento 的层级）
- 把 12 列表格无策略地塞进手机（必须走退化策略）
- 自己实现表格排序/虚拟滚动（用 TanStack）
- 在 layout 层硬编码颜色/字体（那是 L3 的槽位）
- 把 density 写死（必须 token 化、可切换、可持久化）
