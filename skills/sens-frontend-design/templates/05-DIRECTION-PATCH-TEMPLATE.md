# BUILD PROMPT — Direction {N} / {Name}(方向特色补丁)

> **先读主文档**:`../BUILD-PROMPT.md` —— 通用规范、技术栈、组件间距、数据占位、自检 checklist 都在那里。
> 本文档**只**写本方向独有的东西。

---

## 1. 方向定位

{2-3 句话,该方向给谁看 / 什么气质 / 关键词}
**反面**:不要做成 {明确边界 — 不要做成什么样}

---

## 2. 占位品牌名(本里程碑统一用,所有 page 不准混用)

🟡 **{Placeholder Brand Name}**

- 全站 wordmark / `<title>` / footer 版权 / logo alt 都用这个
- 客户拍板真名后,全站 `find & replace` 一次性换掉

---

## 3. 字体引入

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family={Heading}:wght@400;500;600;700;800&family={Body}:wght@400;500;600;700&display=swap" rel="stylesheet">
```

`--font-heading` 用 `"{Heading Font}"`,`--font-body` 用 `"{Body Font}"`,fallback `system-ui, sans-serif`。

---

## 4. tokens.css 具体值

```css
:root {
  /* === Colors === */
  --color-bg: #XXXXXX;                /* 页面背景 */
  --color-bg-soft: #XXXXXX;           /* 软色段落背景 */
  --color-surface: #FFFFFF;
  --color-surface-tinted: #XXXXXX;    /* 轻色卡片 */

  --color-primary: #XXXXXX;
  --color-primary-deep: #XXXXXX;
  --color-accent: #XXXXXX;            /* CTA 强调色 */
  --color-bg-muted: #XXXXXX;

  --color-text: #XXXXXX;
  --color-text-muted: #XXXXXX;
  --color-border: #XXXXXX;

  /* === Typography === */
  --font-heading: "{Heading Font}", system-ui, sans-serif;
  --font-body: "{Body Font}", "{Heading Font}", system-ui, sans-serif;

  --text-eyebrow: 12px;
  --text-body-sm: 14px;
  --text-body: 16px;
  --text-body-lg: 19px;
  --text-h6: 18px;
  --text-h5: 22px;
  --text-h4: 28px;
  --text-h3: 36px;
  --text-h2: 52px;
  --text-h1: 72px;          /* Hero 用,其他 page heading 用 --text-h2 */

  --weight-heading: 800;
  --weight-body: 500;
  --weight-body-emphasis: 700;
  --letter-spacing-heading: 0;

  /* === Radius === */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;
  --radius-xl: 24px;
  --radius-2xl: 32px;
  --radius-pill: 999px;

  /* === Shadow === */
  --shadow-sm: 0 4px 12px rgba(R, G, B, 0.06);
  --shadow-md: 0 18px 48px rgba(R, G, B, 0.14);
  --shadow-lg: 0 24px 60px rgba(R, G, B, 0.18);
  --shadow-badge: 0 16px 40px rgba(R, G, B, 0.12);
}
```

---

## 5. 颜色比例(强制)

- {主背景色} ~50%
- {卡片色} ~30%
- {主色} ~15%
- {强调 CTA 色} ~5%

**{强调色}是本方向的视觉钩子** — 少而精,只用在最重要的 CTA。

---

## 6. 方向独有的视觉钩子(关键!)

{描述本方向独一无二的视觉元素,例:Blue School 的 organic blob、Editorial 的栏目线、
Kids 的涂鸦元素、Coaching 的深色头条 bar、Mint 的三栏 schedule 边栏……}

### 实现方式(Prototype 阶段)

```
第一版:{用 CSS / SVG 怎么近似实现}
第二版:{用 Phase 2 跑出来的 asset PNG 替换}
```

### 样例代码(若适用)

```html
{贴一段最小可运行示例,例如 SVG path、CSS positioning、grid template 等}
```

---

## 7. 已生成的 Core PNG 清单

| Page ID | 状态 | 落盘路径 |
|---|---|---|
| `core-01-{name}` | ✅ / ⏳ | `assets/images/{page-id}.png` |
| `core-02-{name}` | ✅ / ⏳ | ... |
| ... | ... | ... |

PNG 生成后,复制到 `prototype/{direction}/assets/images/`,命名见主文档。

---

## 8. 课程 / 产品 / 数据(REAL — 不准改)

```
{该方向的真实业务数据,从 PROMPTS.md 抄过来。
N 方向可能不一样,例如儿童方向的课程名 vs 成人方向的课程名。}

业务清单:
1. {产品/课程 1} — {年龄/受众} · {时长} · {一句话定位}
2. {产品/课程 2}
...

价格:
- {Tier 1}: ${price}
- {Tier 2}: ${price}
- {Tier 3}: ${price}

承诺 / Trust 元素:
- {数字 1}
- {数字 2}
- {承诺 1}
- {承诺 2}
```

---

## 9. CTA 按钮文案(全站统一)

```
主 CTA({方向强调色按钮}):
- {场景 1}:  "{CTA 文案 1}"
- {场景 2}:  "{CTA 文案 2}"

次 CTA({次色 outline 按钮}):
- "{次 CTA 文案 1}"
- "{次 CTA 文案 2}"

不要出现:
- {该方向不适合的 CTA 词,例如成人课程不用 "Sign up",学校不用 "Apply now"}
```

---

## 10. 本方向独有 sections(可选)

{如果该方向比通用多 1-2 个 section,在这里列出。
例:Blue School 的 Top Contact Bar、Kids 的 Trust Stickers 区、Editorial 的 Stories 区。}

### {Section 名}

```
{布局描述 + 占位文案}
```

---

## 11. Floating Stat Badges / 装饰元素(若有)

```
{描述本方向的悬浮装饰类元素,例:数据徽章、pill 标签、装饰 sparkle 等。
规格 + 用法 + 出现在哪些 page。}
```

---

## 12. 本方向独有的"不要做"

```
❌ 不要用 {错误风格 1}
❌ 不要做 {错误颜色用法}
❌ Hero 照片**绝对**不能用 {错误素材 cliché}
❌ 不要 {本方向独有的反模式}
```

---

## 13. 一句话验收标准

> {目标用户}在{场景}打开 demo,应该感到:**"{期待感受}"**。
>
> 如果第一眼是"看起来像 {错误参照 1}",方向跑偏。
> 如果第一眼是"看起来像 {错误参照 2}",失败。
> 如果第一眼是"看起来像 {错误参照 3}",失败。
