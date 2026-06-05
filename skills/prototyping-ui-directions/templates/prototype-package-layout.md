# Prototype Package Layout — Template

> Stage 3 产物的标准目录结构。每个 variant 必须严格遵守。

## 总输出根

```
output/<YYYY-MM-DD>-<nickname>/
├── idea-brief.md              # Stage 0 产物
├── reference/                 # Stage 1 产物
│   ├── <vendor-1>/
│   │   ├── _lineage.md
│   │   └── (clone 物 / 截图)
│   ├── <vendor-2>/
│   └── ...
├── reference-manifest.md      # Stage 1 manifest
├── research/                  # Stage 2 产物
│   ├── extract-cards/
│   │   ├── <vendor-1>.md
│   │   └── ...
│   ├── cross-reference.md
│   └── direction-candidates.md
└── prototypes/                # Stage 3 产物（最终交付）
    ├── _index.html            # 所有 variant 的总入口（画廊）
    ├── comparison-report.md   # 横向对比报告（给评审人）
    └── variant-<N>/
        ├── index.html  (or index.tsx)
        ├── palette.json
        ├── palette.html
        ├── token-candidates.css
        ├── token-candidates.json
        ├── surface-<a>.html (or .tsx)
        ├── surface-<b>.html
        ├── readme.md
        └── assets/
            └── tokens.css
```

## 命名规则

- `<YYYY-MM-DD>-<nickname>` —— 日期 + 产品昵称。例：`2026-05-11-my-canvas-editor`
- `variant-1 / variant-2 / ...` —— 序号；**不允许** `option-a / option-b`，要在 readme 里给一句话语义描述
- surface 文件名用产品语义：`surface-canvas.html / surface-library.html`，**不允许** `page1.html / view2.html`

## 必填字段（每 variant）

| 文件 | 必填？ | 说明 |
|------|--------|------|
| `index.html` 或 `index.tsx` | ✅ | 产品门面 prototype（同 variant 内二选一，不混用） |
| `palette.json` | ✅ | 机器可读调色板 |
| `palette.html` | ✅ | 人可读调色板可视化 |
| `token-candidates.css` | ✅ | 完整 design token CSS（HTML/React 引用） |
| `token-candidates.json` | ✅ | 同上的 JSON 版（供工具链消费） |
| `readme.md` | ✅ | 设计 rationale |
| `surface-*.{html,tsx}` | ≥1 个 P0 surface | 主入口外的核心 surface |
| `assets/tokens.css` | 推荐 | 把 token-candidates.css 复制一份方便 import |
| `package.json` | React 时必填 | npm install + npm run dev 能跑起来 |

## palette.json schema

```json
{
  "name": "<direction id>",
  "tone": "<一句话风格>",
  "tokens": {
    "color-bg-base":      "oklch(...)",
    "color-bg-raised":    "oklch(...)",
    "color-text-primary": "oklch(...)",
    "color-text-muted":   "oklch(...)",
    "color-accent":       "oklch(...)",
    "color-accent-on":    "oklch(...)",
    "color-success":      "oklch(...)",
    "color-warn":         "oklch(...)",
    "color-danger":       "oklch(...)",
    "color-info":         "oklch(...)",
    "color-border":       "oklch(...)",
    "color-overlay":      "oklch(...)"
  },
  "typography": {
    "font-display": "<family stack>",
    "font-text":    "<family stack>",
    "font-mono":    "<family stack>"
  },
  "motion": {
    "micro":   "120ms",
    "base":    "240ms",
    "complex": "320ms",
    "ceiling": "400ms"
  }
}
```

## token-candidates.css schema（CSS custom properties）

```css
:root {
  /* Color */
  --color-bg-base: oklch(...);
  --color-bg-raised: oklch(...);
  --color-text-primary: oklch(...);
  --color-text-muted: oklch(...);
  --color-accent: oklch(...);
  --color-accent-on: oklch(...);
  --color-success: oklch(...);
  --color-warn: oklch(...);
  --color-danger: oklch(...);
  --color-info: oklch(...);
  --color-border: oklch(...);
  --color-overlay: oklch(...);

  /* Typography */
  --font-display: ...;
  --font-text: ...;
  --font-mono: ...;
  --text-xs: ...;
  --text-sm: ...;
  --text-base: clamp(...);
  --text-lg: ...;
  --text-xl: ...;
  --text-2xl: ...;
  --text-hero: clamp(...);

  /* Spacing */
  --space-1: 0.25rem;
  /* ... --space-12 */
  --space-section: clamp(...);

  /* Radius */
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-flat: ...;
  --shadow-raised: ...;
  --shadow-overlay: ...;

  /* Motion */
  --motion-micro: 120ms;
  --motion-base: 240ms;
  --motion-complex: 320ms;
  --motion-ceiling: 400ms;
  --ease-out-cubic: cubic-bezier(0.33,1,0.68,1);
  --ease-out-expo: cubic-bezier(0.16,1,0.3,1);
}
```

## token-candidates.json schema

跟 css 等价，但是 JSON 结构便于工具消费：

```json
{
  "color": { "bg-base": "oklch(...)", "...": "..." },
  "typography": { "font-display": "...", "text-xs": "...", "...": "..." },
  "spacing": { "1": "0.25rem", "...": "..." },
  "radius": { "sm": "...", "...": "..." },
  "shadow": { "flat": "...", "...": "..." },
  "motion": { "micro": "120ms", "ease-out-cubic": "...", "...": "..." }
}
```

## _index.html 模板（画廊）

`prototypes/_index.html` 是总入口：

- 每个 variant 一张卡片
- 卡片：variant id + 一句话风格 + palette 3-5 色块缩略 + "Open prototype" → 进 `variant-<N>/index.html`
- 顶部 link 到 `comparison-report.md`
- 简洁的画廊设计，不喧宾夺主

## comparison-report.md（review-ready）

详细 schema 见 `workflows/stage3-prototype-package.md` Step 8。
