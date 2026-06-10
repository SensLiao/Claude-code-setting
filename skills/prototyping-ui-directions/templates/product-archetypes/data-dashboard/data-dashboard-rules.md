# Data-Dashboard — 八条铁律（gate 形式）

> 任何 data-dashboard 相关 artifact（variant HTML、prototype、design spec）必须每条都打勾才放行。违反任意一条立即驳回。
>
> 这些不是建议，是红队 gate。每条都带可机检/可目检的具体数字。

## 速查 checklist

- [ ] **铁律 1**：所有数字用 tabular-nums（等宽数字）
- [ ] **铁律 2**：每个 view 图表类型 ≤ 3 种
- [ ] **铁律 3**：accent 色 ≤ 3 个且语义化 + 色盲非色彩冗余
- [ ] **铁律 4**：data-ink ratio —— 无 chartjunk
- [ ] **铁律 5**：每个 async surface 三态齐全（loading + empty + error）
- [ ] **铁律 6**：数字视觉层级靠 scale contrast 建立
- [ ] **铁律 7**：dark mode 数据可读（非纯黑底/纯白字 + chart 配色重校准）
- [ ] **铁律 8**：filter / range / selection / tab 状态进 URL

---

## 铁律 1 · 数字必须 tabular-nums

**规则**：所有指标数字、表格数字列、货币、百分比、计数必须用等宽数字。

```css
.metric, td.numeric, .kpi-value {
  font-variant-numeric: tabular-nums;
  /* 货币/代码场景可加 lining-nums */
}
```

**为什么**：比例字体下 `1` 比 `8` 窄，数字列无法对齐，实时刷新时数字横向抖动。tabular-nums 让每个数字占等宽 → 列对齐、跳动不抖、可纵向比大小。

**gate**：
- [ ] KPI 大数字 = tabular-nums
- [ ] 表格所有数字列 = tabular-nums **且右对齐**
- [ ] 实时刷新的数字不产生横向位移

---

## 铁律 2 · 每个 view 图表类型 ≤ 3 种

**规则**：单个 dashboard view（一屏/一个路由）最多出现 3 种**不同类型**的图表（line、bar、area 各算一种）。同一指标族用同一种图。

**为什么**：每多一种图表类型，用户就多一次"这个图怎么读"的认知切换。5 种图混排 = 信息架构失败，扫描效率崩溃。

**gate**：
- [ ] 数一遍当前 view 的图表类型 ≤ 3
- [ ] 饼图/环图扇区 ≤ 5（超过改条形图）
- [ ] 不出现双 y 轴叠加导致的误导对比
- [ ] 同类指标（如多个 trend）用同一种图，不一个 line 一个 bar

---

## 铁律 3 · accent 色 ≤ 3 个且语义化 + 色盲冗余

**规则**：除中性色阶（灰/主背景/文字）外，强调色 ≤ 3 个，且每个都承载语义（状态/趋势/分类），绝不纯装饰。状态编码必须有**非色彩冗余**（图标/文字/形状）。

**为什么**：dashboard 的颜色是数据编码层，不是装饰层。颜色一多，色→义映射就崩。~8% 男性红绿色盲，只靠红绿区分好坏 = 对他们信息全失。

**gate**：
- [ ] 数据强调色 ≤ 3（不含中性阶）
- [ ] 每个强调色有明确语义槽位（good / warn / bad / category-N）
- [ ] status/severity 除颜色外有图标或文字差异
- [ ] 趋势涨跌除红绿外有 ▲▼ 箭头或 +/− 符号
- [ ] 关掉颜色（灰度模拟）后信息仍可区分

---

## 铁律 4 · data-ink ratio —— 无 chartjunk

**规则**（Tufte）：最大化数据墨水、最小化非数据墨水。每一个像素要么承载数据，要么删掉。

**必删的 chartjunk**：
- 3D 图表 / 立体扇区 / 投影阴影
- 重网格线（最多保留极淡的水平参考线，垂直网格通常删）
- 渐变填充 area（用纯色或极淡半透明）
- 重复图例（单 series 不需要图例，标题已说明）
- 装饰性边框 / 大面积背景色块 / 卡片重阴影
- 坐标轴上的冗余刻度（y 轴用缩写 1.2k / 3.4M）

**gate**：
- [ ] 无 3D、无投影阴影、无立体效果
- [ ] 网格线 ≤ 必要的水平参考线，且极淡
- [ ] 单 series 图无冗余图例
- [ ] y 轴大数字用缩写（k/M/B）
- [ ] 卡片/面板不靠重阴影+渐变堆砌"质感"（质感是 L3 的事，且 L3 也应克制）

---

## 铁律 5 · 每个 async surface 三态齐全

**规则**：任何会异步加载数据的 surface（KPI card、chart panel、data table、列表、drawer）必须同时提供 **loading（skeleton）+ empty/zero + error** 三态。首屏绝不允许"白屏等数据"。

**为什么**：真实数据有延迟、会为空、会失败。只做 happy path = demo 骗局，一上线就露馅。三态是 dashboard 的"诚实"基线。

**gate**（对每个 async surface 逐一核）：
- [ ] **loading**：有 skeleton（匹配最终布局，非孤零零 spinner）
- [ ] **empty**：区分首次空（带 CTA）/ 筛选空（带 Clear）/ 正常零值（正向语气）
- [ ] **error**：有错误说明 + 重试入口，不是静默白屏或 console 报错
- [ ] 数据到达后无布局跳动（CLS ≈ 0）
- [ ] 部分失败可降级（一个 panel 挂了不拖垮整页）

---

## 铁律 6 · 数字视觉层级靠 scale contrast

**规则**：信息优先级用**字号/位置**建立，不靠颜色堆叠。最重要的数字最大、最靠左上；次要信息（label、单位、对比）明显更小、更弱。

**为什么**：用户扫 dashboard 是"先抓最大的数字，再看上下文"。如果所有数字一样大、靠不同颜色区分重要性 → 没有视觉锚点，扫描无序。

**gate**：
- [ ] KPI 主数字字号明显大于其 label 与 delta（建议主数字 ≥ 2× label）
- [ ] 一个 view 有清晰的"视觉入口"（最大/最显眼的那个数）
- [ ] 不靠颜色饱和度来表达"这个更重要"
- [ ] 扫描动线符合 F/Z 型（重要信息在左上）

---

## 铁律 7 · dark mode 数据必须可读

**规则**：暗色模式不是把亮色反相。底色不用纯黑（`#000`），用 `~#0a0a0a`–`#141414`；文字不用纯白（`#fff`），用 `~#e5e5e5`–`#ededed`；图表配色在暗背景下**重新校准**对比与饱和度。

**为什么**：纯黑底 + 纯白字 = 最大对比 = 光晕/眩光/久看疲劳。亮色图表直接搬到暗底常常对比不足、相邻色难分。dark mode 要单独设计，不是 `invert()`。

**gate**（若产品支持 dark mode）：
- [ ] 底色非纯黑（用极深灰），有 1–2 级表面分层（elevation 靠微亮而非阴影）
- [ ] 正文非纯白（降到 ~90% 亮度）
- [ ] chart series 色在暗底下两两可区分、对比达标
- [ ] status 色（红/琥珀/绿）在暗底重新取值，不沿用亮底原值
- [ ] 文字与背景对比 ≥ WCAG AA（正文 4.5:1）

---

## 铁律 8 · 状态进 URL

**规则**：time range、active filters、selected row/entity、active tab、sort 字段必须 URL-encodable。dashboard 的"当前视图"应可分享、可刷新保持、可前进/后退。

**为什么**：dashboard 是协作工具。"看我看到的这个异常"必须靠发链接完成，不能靠口述"你点这个再选那个再筛这个"。刷新丢状态 = 数据排查体验崩溃。

**gate**：
- [ ] time range 在 URL（query param 或 path）
- [ ] active filters 在 URL
- [ ] 复制当前 URL 发给同事，对方打开看到**完全相同**的切片
- [ ] 刷新页面后筛选/范围/排序保持
- [ ] 浏览器后退能回到上一个筛选状态
- [ ] 推荐用 type-safe 方案（如 nuqs）避免手搓 query string

---

## 红队执行顺序

1. 先跑机检项（tabular-nums / 图表类型计数 / accent 色计数 / URL 状态）
2. 再跑目检项（data-ink / 层级 / dark mode 对比 / 三态质量）
3. 任一铁律不过 → 驳回并指出**具体哪条 + 哪个 surface**
4. 三态（铁律 5）是 dashboard 最常翻车点，逐 surface 核，不抽样
