# Local Template Index — 参考接地 SOURCE A 查找表

> **本文件是 P0 GROUND 阶段 SOURCE A(本地优先参考接地)的查找表**,配合 [`combination-policy.md`](combination-policy.md) §4。
> 作用:把接地 pipeline 指向用户**真实**的本地设计资产,让大多数任务**无需联网**就能接地。
> 创建 2026-06-10。维护:资产移动时更新本表路径(见 §7)。

---

## 1. 主接地源:本地 58 品牌 DESIGN.md 语料(直接读,无需 skill)

**SOURCE A 的一等接地源是本地的 58 品牌 DESIGN.md 语料库** —— 58 个从顶级网站抽取的真实品牌 DESIGN.md(Google Stitch 9-section 格式:theme / color / typography / component / layout / depth / do-dont / responsive / agent-prompt),每个品牌配 `preview.html` + `preview-dark.html`。

- **语料根(canonical,直接读)**:`~/Desktop/Innovation_projects/Self-project/awesome-design-md/design-md/<slug>/DESIGN.md`
  - `<slug>` 见 §2 的 9 桶 / §3 的 archetype 锚(全名是目录名,如 `linear.app` / `stripe` / `vercel` / `ferrari`)。
  - 每个 `<slug>/` 目录含:`DESIGN.md`(9-section 主文件)+ `preview.html` + `preview-dark.html` + `README.md`。
  - 语料自带 `README.md` + `SKILL.md`(在语料根 `…/awesome-design-md/`,非本 `~/.claude` 下,作为可选的桶/recipe 说明文档)。
- **GROUND 怎么用**:classify 产品类型/mood → 按 §2 桶 / §3 archetype 锚选出品牌 shortlist → **直接 `Read` 1-3 个 `…/design-md/<slug>/DESIGN.md`**(或仅 Section 9 quick-palette)→ 抽进 `design/grounding.md`(带 provenance = 本地路径)。
- **web-fallback**:本地 58 桶**无品类/mood 匹配**时,才走 §6 的 web SOURCE B(Godly / design-inspiration MCP)。**precedence:local-first → web-fallback → 绝不凭空生造。**

> **铁律(context-budget)**:单次响应 NEVER 读超过 3 个 full DESIGN.md;4+ 品牌对比只读 Section 1+2;quick palette 只读 Section 9。接地不是把 58 个全吞进来。

---

## 2. Style bucket → 品牌 shortlist(mood 快速匹配)

用户给"氛围"而非品牌名时,按这 9 桶映射(grounding 直接用):

| Bucket | 品牌 |
|---|---|
| **Dark Luxe** | linear.app, cursor, superhuman, elevenlabs, bmw, lamborghini, resend |
| **Monochrome Precision** | vercel, spacex, tesla, x.ai, hashicorp, uber, cal, figma, ollama |
| **Warm Editorial** | airbnb, notion, claude, clay, sanity, ferrari, lovable, warp |
| **Vibrant Gradient** | stripe, cohere, together.ai, lovable, raycast, revolut, renault |
| **Developer Terminal** | warp, ollama, expo, resend, supabase, opencode.ai, composio, voltagent, sentry |
| **Playful Brand** | posthog, figma, zapier, miro, airtable, pinterest, clay, minimax |
| **Fintech Trust** | coinbase, wise, kraken, stripe, revolut |
| **Cinematic Full-Bleed** | spacex, tesla, ferrari, runwayml, bmw, apple, spotify |
| **Enterprise Systematic** | ibm, hashicorp, nvidia, uber, apple, airtable |

**5 Fusion Recipe**(跨品牌混搭,按 role 映射不按 raw value):Precise Fintech(Stripe 字 + Linear 色 + Vercel 布局)/ Warm SaaS(Notion 字 + Airbnb 色 + Cal 布局)/ Dark Developer(Warp 字 + Supabase 色 + Linear 布局)/ Bold Consumer(Uber 字 + Spotify 色 + Framer 布局)/ Luxury Automotive(Ferrari 字 + BMW 色 + Tesla 布局)。

---

## 3. Archetype → bucket 先验(产品类型选参考)

P1 EXPLORE 加载某个 product archetype 时,按下表先验挑参考品牌(GROUND 可按实际 mood 调整):

| Archetype | 首选 bucket | 典型品牌锚 |
|---|---|---|
| `landing-marketing` | Vibrant Gradient / Monochrome / Cinematic | stripe, vercel, linear.app, apple, framer, raycast |
| `data-dashboard` | Fintech Trust / Enterprise Systematic / Dark Luxe | linear.app, stripe, vercel, posthog, supabase |
| `canvas` | Developer Terminal / Monochrome | linear.app, figma, miro |
| `game-style` | Playful Brand | posthog, minimax, zapier |
| `bubble-physics` | Playful / Cinematic | apple, framer |
| `creative-eye` | Cinematic Full-Bleed / Dark Luxe | apple, runwayml, framer |
| `narrative-scrolly` | Cinematic Full-Bleed / Warm Editorial | apple, ferrari, spacex, stripe |

> 每个 archetype 还自带 `reference-anchors.md`(真实标杆站点 + 该学什么),与本表互补:本表给**品牌 DESIGN.md**(有 token),archetype 给**站点 exemplar**(有交互范式)。

---

## 4. 历史已解决 token 集(real resolved tokens,最高保真)

这些不是模板,是用户过往真实项目沉淀的**已解决 token**——任务与旧任务相似时优先复用:

| 资产 | 路径 | 适合 |
|---|---|---|
| Agent meta-Universe anchor | `…/cases/Route A/Agent meta-Universe/design/anchor/{tokens.json, ANCHOR-STYLE.md}` | Editorial Watercolor Atlas / oklch 编辑感 |
| AI-agents dashboard combos A–E | `…/AI agents应用/dashboard/design/prototypes/2026-05-18-ai-agents-mc/V1-anchor-base/combo-*/` | dashboard / bento / stripe-linear 融合 |
| agent-console ui-lab c1–c5 | `…/Company/agent-console/ui-lab/v1 - static-html/c*/tokens.candidate.css` | agent console / 静态 HTML 后台 |
| dashboard 生产 tokens | `…/AI agents应用/dashboard/apps/web/src/styles/tokens.css` | 已上生产的真实 token |

> 根前缀 `…` = `~/Desktop/Innovation_projects/Self-project/Personal AI Infrastructure/`。

---

## 5. 字体 / 主题 / UX 参考(各阶段配套)

| 资产 | 路径 | 服务阶段 |
|---|---|---|
| Premium 字体(~35 TTF,免 Google) | `~/.claude/skills/canvas-design/canvas-fonts/`(Cormorant / CrimsonPro / IBMPlexSerif / Instrument Sans+Serif / JetBrains Mono / Geist Mono / Outfit / WorkSans / Bricolage…) | P3 BUILD / P4 UNIFY |
| 10 预设主题 | `~/.claude/skills/theme-factory/themes/`(modern-minimalist / midnight-galaxy / arctic-frost / botanical-garden / desert-rose / forest-canopy / golden-hour / ocean-depths / sunset-boulevard / tech-innovation) | P1 EXPLORE 起点 |
| UX 参考库 | `~/.claude/skills/ux-principles/references/`(laws-of-ux-cheat / nn-10-heuristics / refactoring-ui-{hierarchy,layout-spacing,typography,color,depth-and-polish} / built-for-mars-audit-lens) | P4 UNIFY / P5 REVIEW |
| 已解决参考截图 | Agent meta-Universe `design/reference/PC/refs` + dashboard `…/visual-gate/*.png` | P0 GROUND(同类视觉锚) |

---

## 6. 接地落点 + 消费顺序

P0 GROUND 把上述资产抽进 `design/grounding.md`(schema 见 combination-policy §4),消费优先级:

```
1. 本地 58 DESIGN.md 语料(mood/brand → 直接读 …/design-md/<slug>/DESIGN.md)  ← 首选,覆盖最广
2. 历史 token 集(任务像旧任务 → 直接复用已解决决策)    ← 最高保真
3. archetype reference-anchors.md(站点 exemplar)       ← 交互范式锚
4. web SOURCE B(本地全无品类匹配才走 — Godly/design-inspiration MCP) ← fallback,绝不凭空生造
```

---

## 7. 维护

- §1/§4 的 Desktop 路径指向用户当前 canonical 资产位置(多在 `Desktop/Innovation_projects/Self-project/` 下)。资产移动 → **更新本表的语料根路径(§1)**——本表是 corpus 路径的单一真相源(没有 skill 间接层,所以路径只在这里维护)。
- 本表是 GROUND 的稳定查找入口:新 project 读本表即可够到散落资产,无需每次重新发现。
- 58 品牌全名 = `…/design-md/` 下的目录名(`ls` 即得);§2/§3 已按桶/archetype 列出常用锚,本表不逐一重复全部 58 个,避免双真相源。
