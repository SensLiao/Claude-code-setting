# Landing-Marketing — 九条铁律（gate 形式）

> 任何 landing-marketing 相关 artifact（direction 候选 / variant HTML / prototype package）必须**每条都打勾**才放行。这不是建议，是红队 gate。
>
> 这些是**结构 / 转化纪律**，与锁定的 L3 视觉风格正交——L3 决定皮肤，这 9 条管骨架。冲突时 L3 赢视觉，本铁律赢结构（见 `README.md` 末段）。

---

## 铁律 1 · Above-the-fold value prop ≤ 8 词

- [ ] **headline 主张 ≤ 8 个词**（中文 ≤ 16 字），一眼说清"做什么 / 给谁 / 凭什么"。
- [ ] headline **不是**空泛套话：禁止 "We empower teams to..." / "The future of X" / "Unlock your potential" 这类零信息开头。
- [ ] 首屏(0 滚动、1440×900 与 390×844 两个视口)内**必须**同时可见：headline + subhead + 至少 1 个 primary CTA。

**度量**：截图首屏，数 headline 词数 > 8 → FAIL。subhead 也算空话（无具体名词/动词）→ FAIL。

## 铁律 2 · 单一 primary CTA 颜色，全页唯一

- [ ] 全页**只有一种**颜色角色承担 "primary CTA"（语义角色，不指定具体色值——色值由 L3 给）。
- [ ] 同一视口内**绝不**并列两个等权重大按钮；secondary 一律降级为 ghost / outline / text-link。
- [ ] primary CTA 文案**全页一致**（hero / 中部 / final CTA 用同一句动词，如统一 "Start free")。

**度量**：扫全页，出现 ≥2 个填充实心、同等尺寸、争夺注意力的按钮 → FAIL。primary CTA 文案在不同 section 不一致 → WARN。

## 铁律 3 · 首屏不堆叠（above-fold 密度纪律）

- [ ] hero 视口内元素**上限**：1 headline + 1 subhead + 1 primary CTA(+ 至多 1 secondary) + 1 micro-proof 行 + 1 视觉锚。
- [ ] 超出以上的任何内容（feature 列表 / 多段文字 / 第二个 CTA 组 / 多张图）**必须**移到 below-the-fold。
- [ ] 视觉锚是**真实产品 / 真实证据**，不是抽象渐变球 / 无关 3D 几何体 / 占位插画。

**度量**：首屏出现 feature grid / 3+ 段正文 / 2 组 CTA → FAIL。视觉锚是 gradient blob / 抽象 isometric → FAIL（见 `patterns-index.md` hero 反模式）。

## 铁律 4 · Social proof 必须具体且真实

- [ ] hero 之后**首个** proof 元素在前 1.5 屏内出现（logo bar / metric / testimonial 任一）。
- [ ] logo = **真实可辨认**客户；数字 = **真实可溯源**；testimonial = **完整署名**（名 + 职 + 公司）。
- [ ] **禁止**：占位灰块假 logo / "trusted by many" 无 logo / 匿名 "— A User" / 无出处大数字。

**度量**：proof 区出现 `bg-gray-*` 占位方块冒充 logo → FAIL。testimonial 无真实署名 → FAIL。原型阶段如确实无真数据，必须用**明确标注的 placeholder**（"[CLIENT LOGO]"）而非伪造，并在报告里标记待补。

## 铁律 5 · Section count 纪律（5–9 个）

- [ ] 营销主页 section 数 **5 ≤ N ≤ 9**（hero / proof / feature×2-3 / pricing|comparison / testimonial / FAQ / final CTA 的子集）。
- [ ] N > 9 → 说明一页里塞了两个页面的内容，**拆页**。
- [ ] 必含三件套：① hero ② 至少一个 social-proof ③ final CTA。缺任一 → FAIL。

**度量**：数 `<section>` 级区块。> 9 → FAIL。无 final CTA / 无 proof → FAIL。

## 铁律 6 · CTA 节奏（每 1.5–2.5 屏一次，≥3 次）

- [ ] 全页 conversion 机会**至少 3 次**：首屏 + 中部 + 页尾(final CTA)。
- [ ] 相邻两次 primary CTA 间隔 **1.5–2.5 个视口高度**（既不挤、也不让用户滚很久找不到入口）。
- [ ] 长页(6+ section)由 sticky nav 的 scroll-aware CTA 接力（见 `interaction.md`）。

**度量**：全程滚动，conversion 入口 < 3 次 → FAIL。出现连续 > 3 屏无任何 CTA → WARN。

## 铁律 7 · 性能预算（LCP < 2.5s / hero 媒体 ≤ 200KB）

- [ ] LCP < **2.5s**（移动 4G 模拟）；hero LCP 元素(大图/大标题)**显式 width/height** + `fetchpriority="high"` + priority-load。
- [ ] hero 主视觉**≤ 200KB**（AVIF/WebP）；below-fold 图 `loading="lazy"`。
- [ ] CLS < **0.1**：所有图/视频/iframe 占位有显式尺寸；字体 `font-display: swap` + 防 FOUT 跳动。
- [ ] 营销页 JS 预算(gzipped) ≤ **150KB**（landing），重动画库按需 `import()`。

**度量**：跑 Lighthouse / WebPageTest。LCP ≥ 2.5s 或 CLS ≥ 0.1 → FAIL。hero 图 > 200KB → FAIL。（详 `~/.claude/rules/web/performance.md`。）

## 铁律 8 · F/Z 阅读动线对齐

- [ ] 关键信息（headline / primary CTA / 首个 proof）落在阅读动线的视线节点上：
  - **文本密** section → F-pattern（左上起、横扫、下沉左缘）：headline 左上、CTA 在第一横扫末或左缘。
  - **视觉密 / hero** → Z-pattern（左上 logo→右上 nav-CTA→对角→左下→右下 primary CTA）：primary CTA 落在 Z 收尾(右下/对角终点)。
- [ ] **不**把所有东西无脑居中堆叠（除非是 Centered Statement hero #2，且仍遵守单 CTA）。

**度量**：标注视线热区，primary CTA / headline 落在动线死角(如纯居中下方被忽略区) → WARN→FAIL（取决于严重度）。

## 铁律 9 · Scroll-reveal 是增强不是门槛（内容无 JS 可见）

- [ ] 关闭 JS / scroll 动画失败时，**全部内容仍完整可见、可读、CTA 可点**——绝不靠 reveal 动画"解锁"内容。
- [ ] `prefers-reduced-motion: reduce` 下：去除 parallax / 大位移 reveal，内容**直接呈现**（保留 ≤ 120ms opacity 渐入维持感知连续，见 `motion-tokens.md`）。
- [ ] reveal 初始态**不得**把内容 `opacity:0` 后依赖 JS 才显示（无 JS = 永远看不见）→ 用渐进增强：默认可见，JS 接管后再加动画。
- [ ] 任何 section 不得依赖 scroll 动画"完成"才显示 CTA。

**度量**：禁用 JS 重载，出现空白 / 内容不可见 / CTA 消失 → FAIL。reduced-motion 下仍有大位移 parallax → FAIL。

---

## 红队执行顺序（Stage 3）

1. 截首屏(desktop + mobile) → 跑铁律 1/2/3/8。
2. 全页滚动 → 跑铁律 4/5/6（数 section、数 CTA、查 proof）。
3. 禁用 JS 重载 → 跑铁律 9（内容可见性）。
4. 开 `prefers-reduced-motion` → 跑铁律 9（动效兜底）。
5. Lighthouse/WPT → 跑铁律 7（性能）。
6. 对照 `patterns-index.md` 反模式列 → 确认没有 centered-blob hero / uniform icon grid / 假 logo / 匿名 testimonial / 全 "Contact us" 定价。

> 任一 FAIL 必须修复或在报告显式标注 + 说明后果，方可进 Stage 4 package。WARN 项记入 prototype 报告"待打磨"。
