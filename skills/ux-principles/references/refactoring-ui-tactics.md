# Refactoring UI · 战术 Cheat Sheet（7 章核心数字）

> 来源：[Refactoring UI](https://www.refactoringui.com) — Adam Wathan + Steve Schoger 著。
> 用法：MODE B 决定具体数字时直接查；不允许凭感觉。
> 战术 > 哲学：本表全是可验证数字 / 取值范围。冷门内容 `WebFetch` 拿章节预览。

---

## Ch1. Starting from Scratch — 决定层次和重点

**核心原则**：动手前先答 3 问：
1. 这个 surface 用户来干啥？（write one sentence）
2. 这屏哪个 1 个元素必须最显眼？（不是 2 个）
3. 哪些是装饰可以删？

**反模式**：上来就选 component；先选 component 等于先穿衣服再决定去哪。

**正模式**：1 句话目标 → 1 个 hero action → 其他降权。

---

## Ch2. Hierarchy is Everything — 三要素 hierarchy

层次靠**字号 + 字重 + 颜色**三要素配合，不靠"bigger 就行"。

**字号尺度（建议梯）**：
```
12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60 / 72
```
- body: 14-16
- small: 12
- h3 / card title: 18-20
- h2 / section: 24-30
- h1 / hero: 36-48 (app dashboard) / 60-72 (landing)

**字重梯**：
- regular 400 — body
- medium 500 — labels / nav / small headings
- semibold 600 — section / card titles
- bold 700 — hero only

**颜色 hierarchy（mono palette）**：
- primary text: 100% black 或 #171717
- secondary text: 65% opacity
- tertiary text: 45% opacity
- disabled: 30% opacity
- mono label (caps): 38% opacity

**Hierarchy 反例**：
- 所有标题 bold 24px 黑色（无层次）
- h1 24px / h2 22px / h3 20px（差距太小）
- h1 黑 600 / body 黑 400（仅靠 weight 差）

**Hierarchy 正例**：
- h1: 36px semibold #171717
- h2: 24px semibold #171717
- h3: 18px medium #171717
- body: 14px regular rgba(0,0,0,0.65)
- meta: 12px medium UPPERCASE rgba(0,0,0,0.38)

---

## Ch3. Layout & Spacing — 留白和节奏

**Spacing scale（避免乱编）**：
```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96
```
不在这梯上的数字（17px / 23px）就是错的。

**Section gap rules**：
- inline elements: 4-8px
- card 内部 group: 12-16px
- card 之间: 16-24px
- section 之间: 32-48px
- page 顶部 hero → first section: 48-64px

**Reading width caps**：
- 纯文本段落: 65ch (~720px)
- 表单一列: 480-560px
- 主内容 + 右 rail: 1180px (720 + 280 + 24 gap + 156 buffer)
- 全宽 dashboard table: 1320-1440px

**Grid rules**：
- 多列网格最小列宽 320px
- `repeat(auto-fit, minmax(320px, 1fr))` 默认
- < 1040px 收 2 列
- < 680px 收 1 列

**Don't full-bleed text**：任何超过 720px 的纯文本段都难读。

**Don't shrink-wrap**：button 不要 padding 太紧，给文字呼吸（horizontal 16-24 / vertical 8-12）。

---

## Ch4. Designing Text — 字体与排版

**字体选择规则**：
- dashboard / SaaS / 工程类 → sans-serif 几何（Inter, Geist, Söhne, Söhne Mono）
- landing / brand → 可以 serif 配对（Tiempos + Inter）
- 不用 serif 在 dashboard
- 不用 Comic Sans / Trebuchet / Verdana（默认 stock 字体）

**Letter spacing (tracking)**：
- 大字（>30px）: -0.02em（-2%）紧
- body: 0（默认）
- 小字 caps（10-12px UPPERCASE）: 0.08-0.1em 拉开
- mono label: 0.05-0.08em

**Line height**：
- 大字 hero（>30px）: 1.0-1.1（紧）
- 标题（18-24px）: 1.2-1.3
- body: 1.5-1.6
- caption: 1.4

**Max line length**：
- body: 65-75 char (~600-720px)
- < 45 char 读起来跳行；> 90 char 找下一行难

**Don't underline links inside body unless necessary**：链接靠颜色 + hover 显出，不要 default underline。

**Numerals**：表格 / 仪表盘用 tabular-nums (`font-variant-numeric: tabular-nums`)，对齐用。

---

## Ch5. Working with Color — 颜色克制

**9-shade palette per color**（不是 3-shade）：
- 50（最浅 bg tint）
- 100 / 200 / 300（淡）
- 400 / 500（中 — 默认 accent）
- 600 / 700（深 — text + hover）
- 800 / 900（最深）

**accent 限制**：
- 1 product accent（不超过 2）
- accent saturation < 80%（不要荧光）
- THE LILA BAN（紫蓝渐变 + neon glow 是 AI slop）
- 状态色（red / amber / green）只在 status chip / error，不当 accent

**Mono-first**：90% UI 应该是 #171717 系灰阶；accent 是点睛而非铺满。

**Color contrast WCAG**：
- body text: contrast ≥ 4.5:1（AA）
- large text (>18px): contrast ≥ 3:1（AA）
- 关键 action ≥ 7:1（AAA）

**Don't use color alone for status**：red dot + icon ✕，不要只 red dot（色盲）。

**Tinted shadow**：阴影颜色 = 背景色 hue 的暗化，不是纯黑 50% alpha。

---

## Ch6. Creating Depth — 层次感

**Depth 来源 4 个**：
1. shadow（最常用，但要克制）
2. border / hairline（mono 风首选）
3. background contrast（card 比 page 亮）
4. transform translateY（hover 时动）

**Shadow scale（不是越大越好）**：
- micro: `0 1px 2px rgba(0,0,0,0.04)` — hairline 替代
- small: `0 4px 8px rgba(0,0,0,0.06)` — card hover
- medium: `0 8px 16px rgba(0,0,0,0.08)` — popover / modal
- large: `0 24px 48px rgba(0,0,0,0.12)` — full modal overlay

**Hairline border 替代 shadow**：clean light UI 风优先 `1px solid rgba(0,0,0,0.06)`。

**Don't stack 3 layers of shadow**（card + button + chip 各一层）。

**hover lift**：`transform: translateY(-1px)` + shadow upgrade，不要变色。

---

## Ch7. Working with Images — 图与图表

**Real data > placeholder**：
- 不要 Lorem ipsum；用真实文案样本
- 不要 generic stock photo；要切产品语境的素材
- 不要 random chart shape；用真实分布的 mock 数据

**Image cropping**：人脸 close-up 比远景更吸引；不重要的图给小空间。

**Icon rules**：
- stroke width 一致（统一 1.5 或 2.0）
- 来自同一 icon set（不混 phosphor + heroicons）
- 关键 icon 24px；inline icon 16px；小 chip icon 12px
- 不用 emoji 当 icon（emoji 风格随系统）

**Chart minimal**：
- 去掉网格线 / 去掉边框 / 去掉 legend 内嵌
- mono palette 配单 accent for emphasis
- tabular nums 对齐数字
- sparkline 优先于 full chart 当 inline

---

## Ch8. Final Tips — 收尾 checklist

跑完上面 7 章，最后 10 题收尾：

- [ ] 删 50% 装饰 element 看 UI 还能用吗？
- [ ] 每个 color / spacing / font-size 都在 token 里？没散落 inline？
- [ ] 所有 button 都有 hover / focus / active / disabled 状态？
- [ ] 所有 input 都有 placeholder + label + error state？
- [ ] 所有 list 都有 empty state？
- [ ] 所有 async 都有 loading skeleton？
- [ ] 所有 error 都有 inline + 解决路径？
- [ ] 所有 modal 都能 Escape 关闭？
- [ ] 所有 form 都能 Enter 提交？
- [ ] 所有 icon button 都有 aria-label？

---

## 速查表 — 常见数字

| 元素 | 数字 |
|---|---|
| 可点击行最小高度 | 44px (mobile) / 36px (desktop) |
| icon button | 32×32px |
| chip / pill | 24px height |
| input | 36-40px height |
| primary button | 40-44px height |
| card radius | 8px |
| chip radius | 4px |
| pill radius | 999px |
| border hairline | 1px solid rgba(0,0,0,0.06) |
| body text | 14px regular line-height 1.5 |
| small / mono label | 10-12px |
| hero h1 | 36-48px (app) / 60-72px (landing) |
| section gap | 32-48px |
| card gap | 16-24px |
| reading column | 65-75ch |
| dashboard shell | 1180-1440px max-width |

---

## 在 prototype writeup 里如何标注

每个 prototype writeup §3 "Visual Chassis Application" 里写 4-5 个具体数字应用：

```markdown
### Visual Chassis (Refactoring UI Ch1-7 applied)

- **Hierarchy** (Ch2): h1 36px/semibold/#171717 → h2 24px/semibold → body 14px/0.65 alpha
- **Spacing** (Ch3): 4/8/12/16/20/24/32/48 scale; section gap 32px; card 内部 12px
- **Reading width** (Ch3): main shell 1180px = 720 content + 280 rail + 24 gap
- **Color** (Ch5): mono #171717 accent only; amber #b8860b status; red #cc4444 error
- **Depth** (Ch6): 1px hairline border; no shadow except micro 0 1px 2px on hover
```
