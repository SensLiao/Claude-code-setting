# BUILD PROMPT — {Target Name} Static HTML Prototype(通用规范)

> **谁读**:负责把 `Design/2.Anchors/{target}/{direction}/` 下的 AI 生图,**落代码**成可点击静态 HTML 原型的 code AI(Claude / Codex / Stitch / etc.)。
>
> **使用方法**:每次开始一个方向的 prototype 工作时,把以下三份输入**完整粘给 AI**:
> 1. **本文档**(`{target}/BUILD-PROMPT.md`)— 通用规范,80% 共性
> 2. **方向特色补丁**(`{target}/{direction}/BUILD-PROMPT.md`)— 该方向独有 tokens / 占位 / 装饰
> 3. 该方向 `Design/2.Anchors/{target}/{direction}/*.png` 里所有带 `core-` 的截图

---

## 0. 任务概述(必读)

你正在为 {项目类型 / 客户行业} 开发一个**静态 HTML 客户提案原型**。

### 这是什么、不是什么

| 是 | 不是 |
|---|---|
| 客户提案用的"看得见摸得着的"demo | 真实上线产品 |
| 静态 HTML + CSS + 极少量原生 JS | Next.js / React / Vue 应用 |
| 可点击导航(链接跳转到其他 HTML 文件) | 需要后端 API / 数据库 / 真实登录 |
| 截图能进 PDF / 也能部署到 Vercel | 需要构建工具 / npm install |
| 1:1 还原 AI 生图的设计语言 | 重新设计、加你自己的创意 |
| M 个 core page(本里程碑) | 整站完整 page |

### 唯一目标

让客户打开 demo 后说**"对,就是这个感觉,继续推进"**。
不是显摆代码能力,不是无障碍 100 分,不是优化 SEO。
是让客户在视觉上认可,从而签合同。

---

## 1. 技术栈约束(硬规则,不准改)

```
✅ 必须用
- 纯 HTML5(每个 page 一个 .html 文件)
- Tailwind CSS via CDN(<script src="https://cdn.tailwindcss.com"></script>)
- Google Fonts 通过 <link>(具体字体见方向特色补丁)
- 少量 vanilla JS(只为 accordion / mobile nav 切换,不写框架)

❌ 禁止用
- React / Vue / Svelte / 任何前端框架
- Next.js / Vite / Webpack / 任何构建工具
- npm install / package.json / node_modules
- TypeScript / SCSS / 任何需要编译的东西
- 后端调用 / fetch() 真实 API
- Tailwind 配置文件(用 CDN 自带 default config)
- 任何外部 UI 库(shadcn / Headless UI / Radix / 等等)

⚠️ 例外
- 图标可以用 Heroicons 或 Lucide 的 CDN inline SVG 复制粘贴
- 字体子集化不做,直接全字重 link 进来
```

**理由**:静态 HTML 任何人都能打开 / 部署到 Vercel 拖文件就能跑 / 客户能直接看,框架版本不会过时,3 年后还能开。

---

## 2. 文件结构(严格遵守)

```
Design/3.Prototype/{target}/{direction}/
├── BUILD-PROMPT.md          ← 方向特色补丁(已存在,你的输入之一)
├── README.md
├── index.html                ← Home / 主入口
├── {page-2}.html
├── {page-3}.html
├── ...
├── styles/
│   ├── tokens.css           ← 所有 design tokens(CSS 变量)
│   └── components.css       ← 卡片 / 按钮 / 表单 等组件样式
├── scripts/
│   └── main.js              ← accordion + mobile nav + 表单非提交占位
├── assets/
│   └── images/              ← 从 ../../2.Anchors/{target}/{direction}/ 复制 core 图
│       ├── {page-id}/
│       └── shared/
└── NOTES.md                 ← 占位状态 / 已知 bug / 后续待办
```

---

## 3. Design Tokens 规范

**Design tokens 全部定义在 `styles/tokens.css`**,所有页面通过 `<link>` 引用。
**禁止**在 HTML 里硬编码 hex / spacing / font-size 数值——必须用 token。

### tokens.css 模板(具体值见方向特色补丁)

```css
:root {
  /* === Colors === */
  --color-bg: #FFFFFF;
  --color-surface: #FFFFFF;
  --color-primary: #XXXXXX;
  --color-accent: #XXXXXX;
  --color-text: #XXXXXX;
  --color-text-muted: #XXXXXX;
  --color-border: #XXXXXX;

  /* === Typography === */
  --font-heading: "Xxx Sans", system-ui, sans-serif;
  --font-body: "Xxx Sans", system-ui, sans-serif;

  --text-eyebrow: 11px;
  --text-body-sm: 13px;
  --text-body: 15px;
  --text-body-lg: 17px;
  --text-h6: 18px;
  --text-h5: 22px;
  --text-h4: 28px;
  --text-h3: 36px;
  --text-h2: 48px;
  --text-h1: 56px;

  --leading-tight: 1.1;
  --leading-snug: 1.3;
  --leading-normal: 1.6;
  --leading-relaxed: 1.75;

  /* === Spacing(8 倍数系统)=== */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;

  /* === Radius === */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-2xl: 32px;
  --radius-pill: 999px;

  /* === Shadow === */
  --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 24px 60px rgba(0, 0, 0, 0.12);

  /* === Container === */
  --container-max: 1240px;
  --container-padding: 96px;
  --container-padding-tablet: 48px;
  --container-padding-mobile: 24px;
}
```

---

## 4. 通用组件间距规则(本文档最重要部分)

下面的间距值是**强制**的,不允许"看起来差不多"。

### 4.1 Section 垂直间距

| 上下文 | padding-top | padding-bottom |
|---|---|---|
| 桌面端(≥1024px) | 96px | 96px |
| 平板(768-1023px) | 64px | 64px |
| 手机(<768px) | 48px | 48px |

**例外**:Hero section 上方紧贴 header,只有 padding-bottom;Footer 上下分别 80px / 40px。

### 4.2 Container(全站统一 wrapper)

```css
.container {
  max-width: var(--container-max);    /* 1240px */
  margin: 0 auto;
  padding-left: var(--container-padding);    /* 96px */
  padding-right: var(--container-padding);
}

@media (max-width: 1023px) { padding: 0 var(--container-padding-tablet); }  /* 48px */
@media (max-width: 767px)  { padding: 0 var(--container-padding-mobile); }  /* 24px */
```

**所有 section 内部必须用 `.container` 包裹**。

### 4.3 卡片内部间距

| 卡片类型 | padding(桌面) | padding(手机) | gap(卡片之间) |
|---|---|---|---|
| 小卡片(icon card) | 24px | 20px | 24px |
| 中卡片(profile card) | 24px | 20px | 24px |
| 大卡片(pricing card) | 32px | 24px | 24-32px |
| Hero 浮动徽章 | 16px 20px | 12px 16px | n/a |

### 4.4 文字之间的纵向间距

```
Heading → Subline:        16px
Subline → CTA button row: 32px
Heading → Body 多段:       24px + 段间 16px
Section heading → 第一行 content:  48px 桌面,32px 手机
List item 行高:            1.6
Body paragraph 段间:       16px
```

### 4.5 按钮规格

| 类型 | height | padding x | font-size | font-weight | radius |
|---|---|---|---|---|---|
| Primary CTA | 52-56px | 24-32px | 16px | 700 | (方向 token) |
| Secondary | 52-56px | 24-32px | 16px | 600 | (同 primary) |
| Small / inline link | n/a | n/a | 14px | 500 | n/a |

**两个按钮并排**:gap 16px
**按钮内 icon + text**:gap 8px

### 4.6 表单字段规格

```
Input height:        52px
Input radius:        12-14px(方向 token 决定)
Input padding x:     16px
Label → Input:       8px
Field → Field:       16px
Form section gap:    32px
Submit button top margin: 24px
```

### 4.7 Grid 间距

```
2-column grid gap:   24-32px
3-column grid gap:   24px
4-column grid gap:   24px(桌面),自动塌缩到 2 列(平板)/ 1 列(手机)
```

---

## 5. Page 骨架

每个 page 都用相同的 layout shell:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Page Title} — {Brand}</title>
  <link href="https://fonts.googleapis.com/css2?family={...}" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles/tokens.css">
  <link rel="stylesheet" href="styles/components.css">
</head>
<body>
  <header class="site-header">...</header>
  <main>
    <!-- page-specific sections -->
  </main>
  <footer class="site-footer">...</footer>
  <script src="scripts/main.js"></script>
</body>
</html>
```

### Header(所有 page 共用,完全一致)
- Logo / 品牌名 左
- Nav 中:对应所有 page 的链接
- 右:辅助 CTA + 主 CTA
- 当前 page 对应 nav item 加 active 状态
- 移动端汉堡菜单切换

### Footer(所有 page 共用,完全一致)
- 多列:Brand / Links / Connect 等
- 底部:版权 + 法律链接
- 占位文字见每方向 PROMPTS.md 的 footer prompt

---

## 6. 数据占位规范(核心)

每段文字内容**必须**按下面 3 种标注之一处理:

### 6.1 三种数据等级

| 等级 | 标注 | 含义 | 改不改 |
|---|---|---|---|
| 🟢 **REAL** | 默认不标注 | 业务真实数据,客户提案核心信息 | **不准改** |
| 🟡 **PLACEHOLDER** | `<!-- PLACEHOLDER: 待客户提供 -->` | 占位,等真实数据填入 | 保留占位文本,后期替换 |
| 🔴 **LOREM** | `<!-- LOREM: 仅供视觉占位 -->` | 假文本,只为撑出布局 | 客户应明白这是假的 |

### 6.2 REAL(必保留,绝对不准改字)

由方向特色补丁 + PROMPTS.md 共同定义。常见 REAL:
- 业务定位话术
- 真实承诺(免费试听 / no commitment / 等)
- 货币 + 价格(从 PROMPTS.md 抄)
- 统计数字(从 PROMPTS.md 抄)
- 隐私 / 合规提示

### 6.3 PLACEHOLDER(占位但保留位置)

```
🟡 用 <!-- PLACEHOLDER --> 注释包起来,文本写明显占位:
- 品牌名 / Logo wordmark
- 地址 / 电话 / 邮箱
- 营业时间
- 占位人名(老师 / 客户)
- 真实社交账号链接(用 #)
```

### 6.4 LOREM(纯撑布局)

```
🔴 用 <!-- LOREM --> 注释,内容用通俗占位即可,
但仍要符合行业口吻,不要直接 Lorem ipsum 拉丁文。
```

### 6.5 注释规范

每个 HTML 文件顶部加注释块:

```html
<!--
  Page: {page-name}
  Status: PROTOTYPE — Client Proposal Demo
  Data legend:
    🟢 REAL        : Locked business facts. Do not edit.
    🟡 PLACEHOLDER : Will be replaced with client-provided data later.
    🔴 LOREM       : Visual filler only. Client knows this is fake.
  Last updated: 2026-MM-DD
-->
```

---

## 7. 交互规范(JS 只做这些,不多做)

```
1. Mobile nav 切换
2. FAQ accordion(若有)
3. Pricing toggle(若有)
4. Form submit 占位
   - onsubmit="event.preventDefault(); alert('Demo only — form not connected');"
5. Smooth scroll to anchor(CSS scroll-behavior: smooth)

❌ 不要做:
- 真实滑入动画 / 数字滚动 / 视差
- 真实数据 fetch
- Cookie / localStorage 复杂状态
- 真实搜索 / 真实登录跳转
```

---

## 8. 响应式断点

```css
@media (max-width: 1023px)  { /* 平板 */ }
@media (max-width: 767px)   { /* 手机 */ }
```

```
≥1024:    完整多列网格,完整 nav,96px container padding
768-1023: 多列网格折成 2 列,nav 缩窄 padding 到 48px
<768:     单列,汉堡 nav,container padding 24px,字号比例缩到 ~85%
```

**响应式标准**:1440 / 768 / 390 三档跑截图,客户提案 PDF 至少展示 1440 / 390 两档。

---

## 9. 与图片素材的关系

| 来源 | 用途 |
|---|---|
| `Design/2.Anchors/{target}/{direction}/*.png` | **整页参考截图**,你做出的页面应在视觉上 1:1 还原 |
| `Design/3.Prototype/{target}/{direction}/assets/images/` | **实际嵌入素材** |

### 9.1 嵌图原则(两阶段)

**第一版**:直接把 core PNG 截图按整页嵌进对应 .html 的某个 section 作"图占位",**在上面叠真实的 HTML 文字 / 按钮**。

**第二版**(客户确认方向后):重写为**纯 HTML/CSS 复刻**,所有元素都是真实 DOM,装饰 / 人物换成 Phase 3 跑出来的 individual asset。

### 9.2 注释标记

```html
<!-- IMAGE-PLACEHOLDER: home-hero (core).png — 整页参考截图,Phase 2 替换为纯 HTML 还原 -->
<img src="assets/images/home-hero.png" alt="Home hero reference">
```

---

## 10. 自检 Checklist(每 page 都过一遍)

```
□ HTML 通过验证(无未闭合标签)
□ 用了 design tokens,无硬编码 hex / spacing
□ 所有文字按 §6 的注释规范标注了 REAL / PLACEHOLDER / LOREM
□ 品牌名跨所有 page 完全一致
□ Header / Footer 在所有 page 完全一致(复制粘贴,不要改)
□ 当前 page 对应的 nav item 有 active 样式
□ Section 间距走 §4 规定
□ 桌面 / 平板 / 手机 三档无横向滚动条
□ FAQ accordion(若有)默认展开前 2 题
□ Form 提交是 preventDefault + alert
□ 所有外链是 # 或 javascript:void(0)
□ Lighthouse:Performance > 80,Accessibility > 85 即可
□ Console 无 error / warning
□ NOTES.md 记下:PLACEHOLDER 待补 / LOREM 待换 / 整图嵌入临时方案
```

---

## 11. 你做完后的产出物

```
1. ✅ N 个 *.html 文件
2. ✅ tokens.css + components.css(干净,无冗余)
3. ✅ main.js(< 100 行,只做 §7 那 5 件事)
4. ✅ assets/images/ 里所有 core PNG + Phase 3 素材
5. ✅ NOTES.md 记录占位状态 + 已知问题 + 后续待办
6. ✅ 一句话总结:用了什么字体 / 主色 / 占位品牌名 / 跑了多少屏断点测试
```

---

## 12. 不要做的事(常见 AI 翻车清单)

```
❌ 不要为了"看起来更现代"自作主张加渐变 / 玻璃态 / 视差
❌ 不要把 N 个 page 做成 SPA 路由(必须是真 .html 文件)
❌ 不要自己重排 nav 顺序
❌ 不要改 PROMPTS.md 里的核心承诺话术
❌ 不要换货币 / 价格
❌ 不要在 N 个 page 里改 header / footer 配色或顺序
❌ 不要默认 dark mode(除非方向明确要求)
❌ 不要装 Tailwind 的 @apply 然后用 build tool
❌ 不要忘记 viewport meta tag
```

---

**通用规范结束。打开方向特色补丁继续读。**
