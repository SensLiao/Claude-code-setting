# Layout Engines — Landing-Marketing

> 营销页的**空间 / 网格 / 构图逻辑**。这里给的是 STRUCTURE（grid、container、rhythm、asymmetry、bento），具体配色/字体/质感由锁定的 L3 风格决定，**不在本文件**。
>
> 与 canvas archetype 的根本差异：营销页是**线性纵向流**——没有 viewport pan / zoom / node 布局算法，核心是"section 怎么在 12-col 上排、垂直节奏怎么呼吸、哪里打破对称制造张力"。

## 1. Grid 系统：12-col 为主轴

| 用途 | 列跨度建议 | 说明 |
|------|-----------|------|
| Container max-width | 1120–1280px | 内容主体上限；超宽屏靠两侧留白，不拉满 |
| 全宽 section 背景 | 100vw | 背景色/图满屏，**内容仍收在 container 内** |
| Hero text 列 | 5–6 / 12 | 文本不超过 ~60ch 可读宽度 |
| Hero visual 列 | 6–7 / 12 | 产品图略宽于文本，制造主次 |
| Feature-row 文本 | 5 / 12 | 留 1 col gutter 给图文呼吸 |
| Feature-row 视觉 | 6 / 12 | |
| Pricing 卡 | 3–4 / 12 each | 2-4 列；推荐档可跨更宽或抬高 |
| 正文阅读宽 | 60–75ch | 长文本绝不满 container 宽 |

- **gutter**：24–32px（desktop）/ 16px（mobile）。
- **outer margin**：clamp(16px, 5vw, 96px)——mobile 贴边收紧，desktop 大留白。
- **断点**：320 / 375 / 768 / 1024 / 1440 / 1920（与 `~/.claude/rules/web/testing.md` 一致）。mobile-first，营销流量过半在手机。

## 2. Container width 三档

| 档 | max-width | 用途 |
|----|-----------|------|
| `--container-tight` | 720–800px | 纯文本 section / FAQ / 单列 testimonial（窄=易读） |
| `--container-base` | 1120–1200px | 主力：hero / feature-row / pricing |
| `--container-wide` | 1280–1440px | bento / logo cloud / 大幅产品图 section |

> 三档混用制造节奏：宽 section（hero/bento）↔ 窄 section（FAQ/quote）交替，避免全页一个宽度的死板。

## 3. Vertical rhythm（垂直节奏 = 营销页的呼吸）

垂直留白比水平更重要——它定义 section 的"分量"和阅读节奏。

| Token | 值 | 用途 |
|-------|----|----|
| `--section-py` | clamp(64px, 8vw, 160px) | section 上下 padding；**这是营销页高级感的主来源** |
| `--section-gap-major` | 96–160px | 重大 section 间距（hero↔feature） |
| `--section-gap-minor` | 48–80px | 紧密关联块间距（feature-row 之间） |
| `--block-gap` | 24–40px | section 内元素堆叠间距 |
| `--hero-py` | clamp(80px, 12vh, 200px) | hero 通常比普通 section 更高更空 |

**规则**：
- section padding **不均匀**——hero / final CTA 留白最大(分量最重)，密集信息 section(comparison/pricing) 略紧。
- 垂直节奏用 **8px baseline grid** 的倍数(8/16/24/32/48/64/96/160)，不随手填值。
- 相邻 section 背景色切换处，靠 padding 制造"换气"，不要硬贴。

## 4. Asymmetry（非对称 = 张力来源）

AI 默认全居中 → 平庸。营销页用受控非对称制造视觉兴趣：

- **Hero split**：text 5 / visual 7（非 6/6），视觉略大压住版面。
- **Feature-row zig-zag**：逐行左右交换图文位置，视线之字形下行（见 `patterns-index.md` #7）。
- **Eyebrow / label 左对齐**，headline 左对齐起，**不**全部居中。
- **视觉锚偏移**：产品图可轻微出血(bleed)到 container 外 / 倾斜 perspective tilt，打破方正。
- **留白不对称**：左密右疏 或 上紧下松，引导视线流向 CTA。

> 例外：Centered Statement hero(#2) 与 Final CTA(#13) 可对称居中——但仍守单 CTA 纪律。

## 5. Bento 编排（feature 区可选）

当 feature 多且主次不均（`patterns-index.md` #8）：

- 基于 12-col 划分**非均匀** cell：如 `[8-col 大旗舰] [4-col 次要]` / `[6 6]` / `[4 4 4]` 混排成 2-3 行。
- 大 cell 装旗舰 feature(大视觉 + 多文案)；小 cell 装次要 feature(图标 + 一句)。
- cell 间 gap 统一(16–24px)，cell **圆角 / 边框 / 背景的具体样式由 L3 决定**(本文件只管尺寸网格)。
- CSS Grid `grid-template-areas` 命名区块，mobile 退化为单列堆叠(大 cell 在前)。

```css
/* 结构示意——质感(圆角/阴影/色)由 L3 套 */
.bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}
.bento__hero  { grid-column: span 8; grid-row: span 2; }
.bento__minor { grid-column: span 4; }
@media (max-width: 768px) {
  .bento { grid-template-columns: 1fr; }
  .bento__hero, .bento__minor { grid-column: 1 / -1; grid-row: auto; }
}
```

## 6. 推荐库 / 工具

| 用途 | 推荐 | 备注 |
|------|------|------|
| 框架 | **Astro** / **Next.js** | 营销页首选 SSG/ISR；Astro 纯静态 JS payload 最低 |
| 图片 | **`next/image`** / Astro `<Image>` | 自动 AVIF/WebP + 显式尺寸(防 CLS) |
| Grid/util | **Tailwind** (+ `container` plugin) | 快搭骨架；**必须按 L3 retune**，不裸用默认 |
| 组件骨架 | **shadcn/ui** | accordion / tabs / card 结构层；样式按 L3 改 |
| 容器查询 | CSS `@container` | bento cell 内组件自适应 |
| OG 图 | **`@vercel/og`** | 分享卡片(转化入口) |

## 不允许

- 全页单一 container 宽度 + 全居中堆叠（平庸 AI-slop 版式）。
- 均匀 padding 到处一样（破坏垂直节奏，失去分量层级）。
- bento cell 全等高等宽（那不是 bento，是普通 grid，见 `patterns-index.md` #8 反模式）。
- 在本文件里写死颜色 / 字体 / 阴影 / 圆角具体值（那是 L3 的领地）。
- 文本满 container 宽（> 75ch 不可读）。

## Refs

- `patterns-index.md`（section pattern 与本布局如何配合）
- `~/.claude/rules/web/performance.md`（bundle budget / 图片优化）
- `~/.claude/rules/web/coding-style.md`（CSS 变量 / 文件组织约定）
