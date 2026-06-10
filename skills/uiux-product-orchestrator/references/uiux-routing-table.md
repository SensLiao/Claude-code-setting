# UIUX Routing Table

> 9 层 L0-L8 完整路由。**v2.3 (2026-06-10)** — 顶部新增 §0「组合调度引擎」(create/optimize 默认走 6 阶段技能组合,不再单挑);Layer 表 + 路由决策表保留为引擎各 phase 内部"调什么 skill"的明细。**v2.2** 移除已删 skill（`soft`/`gpt-taste`/`minimalist` 并入 `taste §11`；`frontend-pipeline`/`stitch`/`frontend-design-pro`/`apple` 系列等已删）。
> 三层关系:**SKILL.md §2.0 决定"从哪入口进引擎 + 哪档"** → **本表 §0 决定"组合序列(每 phase 调什么)"** → **本表 Layer 0-8 + 决策表 决定"某 phase 内具体挑哪个 skill"**。

## 0. 组合调度引擎（create/optimize 默认 — v2.3 重塑核心）

> create/optimize 任务**不再"挑一个 skill 出活"**,按 [combination-policy.md](combination-policy.md) 的 6 阶段 phase state machine 跑一套**有序技能组合**。ask-first 选档(默认 optimal),详 SKILL.md §2.0.A。下面是三档的有序序列(P0→P5 每 phase 调什么):

**最小组合 (min)** — 单页/快出,质量地板仍含接地+一趟评审:
```
P0 GROUND  local-template-index(design-system 1-2 DESIGN.md)[无匹配→competitive-teardown 视觉/design-inspiration MCP]
P1 EXPLORE prototyping-ui-directions → 2-3 候选 SHOW
P2 PICK    用户挑 → lock 1 个 L3 (taste/luxury/brutalist)
P3 BUILD   frontend-design@official (grounded in 选中参考)
P4 UNIFY   ux-principles MODE B (spacing/层级/字体一趟统一)
P5 REVIEW  gsd-ui-review (6-pillar 单趟)
```

**最优组合 (optimal) = 默认** — ~10 skill + 评审循环:
```
P0 GROUND  competitive-teardown 视觉模式 + 本地 design-system/历史 tokens [无匹配→web]
P1 EXPLORE prototyping-ui-directions → 3-4 候选(palette+tokens)[+imagegen moodboard 可选];grill-with-docs(brief 模糊时)
P2 PICK    用户挑 → lock 1 个 L3
P3 BUILD   frontend-design@official (+vercel:nextjs/:react-best-practices/:shadcn 若 React 栈)
P4 UNIFY   design-systems:tokenize → ux-principles MODE B → visual-critique
P5 REVIEW  ux-principles MODE C → gsd-ui-review → santa-loop，循环不早退直到 reviewer 双通过
```

**最大组合 (max)** — ~18 skill / 多轮 / 下游交付:
```
P0 GROUND  competitive-teardown 12 维 + 本地 58-index 全扫 + imagegen Awwwards-tier moodboard
P1 EXPLORE prototyping-ui-directions 4-6 完整 prototype 包 + 对比报告;grill-with-docs
P2 PICK    用户挑 → lock 1 个 L3 (+Layer P ai-native-interface 若 AI-native，正交不占锁)
P3 BUILD   anchor-prototype-wave 多 surface + vercel overlay + brandkit/theme-factory(严格排 L3 之后)
P4 UNIFY   design-systems:tokenize + ui-design:color/type/spacing-system + interaction-design:animation/state/loading + emil-design-eng + visual-critique
P5 REVIEW  ux-principles MODE C + gsd-ui-review + santa-loop + Codex plugin /codex:adversarial-review 跨 AI，多轮收敛;下游 enterprise-qa-testing / appsec / discoverability handoff
```

> **三档共同强制**:① P0 GROUND 接地(本地优先)是 BUILD 硬前置;② EXPLORE→SHOW→PICK 顺序;③ P5 REVIEW 至少一趟。深度矩阵(走哪些阶段+每阶段多深)+ L3 互斥保全 → [combination-policy.md](combination-policy.md) §3/§6。

---

## 入口情景分流（先过 SKILL.md §2.0，再查本表）

做 UI 不总是从头。先按 SKILL.md §2.0 判断用户给了什么料，落到 7 个入口之一，再来本表查具体 skill：

| 入口 | 用户给的料 | 跳到本表的 |
|---|---|---|
| E1 从零想法 | 一句话需求 | Layer 0 → 1 → 2 → 3 → 4 全流程 |
| E2 给了 reference 图 | "我要这种感觉" | Layer 2.5 `image-to-code`(reference) → anchor → 实现 |
| E3 给了截图要还原 | "照这张做" | Layer 2.5 `image-to-code`(image-first) |
| E4 客户提案 | "出几版给客户" | Layer 4 `sens-frontend-design` |
| E5 现有项目升级 | "我的页面改好看" | Layer 6 `visual-critique` → `redesign-skill` |
| E6 局部修补 | "这块不对" | Layer 0 `ux-principles` MODE B |
| E7 上线前审计 | "上线前体检" | Layer 6 `ux-principles` MODE C → `gsd-ui-review` |

---

## Layer 0 — UX Foundation
- `ux-principles` MODE A(pre-design 澄清)
- `ux-principles` MODE B(战术查表;含并入的 `refactoring-ui-{hierarchy,layout-spacing,typography,color,depth-and-polish}.md` 5 份明细)
- `ux-principles` MODE C(最终 audit)

## Layer P — Paradigm / Interaction Architecture(orthogonal overlay,Layer 0 的 peer)
- `ai-native-interface` — AI-native conversation-first 网页产品的**交互范式层**(skeleton 骨架库 / show-then-ask / continuous-interface + URL-as-state / start-the-conversation 首屏 / give-before-take 节奏)
- **与 L3 组合(composes with L3),永远不是 L3 候选、不占 L3 锁、不参与 L3 互斥** —— Layer P 决定 interaction architecture(对话怎么流、骨架库怎么取、状态怎么连续),Layer 3 决定 visual skin(调性皮肤),两者正交、同时存在
- 配套 `ux-principles` Show-Then-Ask / Give-Before-Take 两条 law(UX 侧判断) + `security-app-llm`(AI surface 安全)
- 触发:"对话式 AI 原生产品 / conversation-first / 生成式 UI / 骨架库 / show-then-ask / continuous interface / URL-as-state / 没有页面只有一场对话"

## Layer 1 — Discovery
- `grill-with-docs`(需求模糊时)
- `competitive-teardown`(竞品研究)

## Layer 2 — Exploration
- `prototyping-ui-directions`(多方向 variant)
- `imagegen-frontend-web`(网页参考图生成)

## Layer 2.5 — Source Import
- `image-to-code-skill`(截图 → 代码;`mode=reference` 提取 anchor / 默认 image-first 还原)

## Layer 3 — Style Lock(互斥,一次只一个)
- `taste-skill` — **默认通用 premium craft**，含 §11 三档变体(语义切换,一次一档):
  - **MODE A Editorial Monochrome** — Notion / Linear / SaaS / warm monochrome / 文档感(原 `minimalist-skill`)
  - **MODE B Double-Bezel Agency** — $150k agency / 嵌套硬件感 / 浅色高级 / fluid-glass nav(原 `soft-skill`)
  - **MODE C GSAP Scrollytelling** — 高动效 / pinning / 滚动叙事 / Awwwards(原 `gpt-tasteskill`)
- `luxury` — 暗色编辑 / Oswald / fashion / architect
- `brutalist-skill`(user-invocable only)— Swiss / 数据密集 / 工业粗野

## Layer 4 — Production
- `anchor-prototype-wave`(手动,多 surface 量产)
- `sens-frontend-design`(3-stage 客户提案型,静态原型可部署/截图进 PDF)
- `luxury-editorial-site-builder`(brand landing 专用 workflow,不占 L3 锁)
- `frontend-design@official`(生产 React 默认)

## Layer 5 — Platform Overlay
- `vercel:nextjs` / `vercel:react-best-practices` / `vercel:shadcn` / `vercel:turbopack`
- (iOS/SwiftUI overlay 已随 `apple` 系列移除 — 本配置聚焦 Web;未来做移动端再装回)

## Layer 6 — Audit / Refinement
- 局部修补 → `ux-principles` MODE B(明细在 `ux-principles/references/refactoring-ui-*.md`)
- `visual-critique`(截图 critique)
- `redesign-skill`(整页升级 workflow)
- `gsd-ui-review`(上线前 6-pillar gate)

## Layer 7 — Design System
- `design-systems:tokenize` / `:create-component` / `:design-system-governance` / `:accessibility-audit`
- `ui-design:color-palette` / `:type-system` / `:spacing-system` / `:layout-grid` / `:responsive-design` / `:dark-mode-design`
- `interaction-design:animation-principles` / `:form-design` / `:state-machine` / `:loading-states`

## Layer 8 — Brand / Assets
- `brandkit` — logo / identity / brand board
- `theme-factory` — 主题切换 / 多主题预设
- `canvas-design` — 海报 / PDF / 静态作品

---

## 路由决策表(用户意图 → 推荐 skill)

| 用户意图 | 第一推荐 | Layer |
|---|---|---|
| AI-native 对话式产品 / 生成式 UI / 骨架库 | `ai-native-interface`(范式层,与 L3 并行) + 锁定 L3 + `ux-principles` + `security-app-llm` | P(+3) |
| 需求不清楚 | `grill-with-docs` | 1 |
| 竞品研究 | `competitive-teardown` | 1 |
| 视觉方向探索 | `prototyping-ui-directions` + `imagegen-frontend-web` | 2 |
| 截图 → 代码 | `image-to-code-skill` | 2.5 |
| 给了 reference 图"要这种感觉" | `image-to-code-skill`(mode=reference) → anchor | 2.5 |
| 高级 premium(未指定暗/浅) | 反问 → 暗:`luxury` / 浅:`taste` MODE B | 3 |
| 暗色编辑 / fashion | `luxury` | 3 |
| Notion / Linear / SaaS / 文档感 | `taste` MODE A (Editorial Monochrome) | 3 |
| 默认 premium craft | `taste`(baseline) | 3 |
| agency 高级感 / 嵌套硬件感 | `taste` MODE B (Double-Bezel) | 3 |
| GSAP / 滚动叙事 / 高动效 | `taste` MODE C (GSAP) | 3 |
| 完整 UI 项目(多 surface 量产) | `anchor-prototype-wave`(手动) | 4 |
| 客户提案(多方向不上线) | `sens-frontend-design` | 4 |
| Brand landing 单页 | `luxury-editorial-site-builder` | 4 |
| 生产 React | `frontend-design@official` + `vercel:nextjs` | 4+5 |
| 局部 UI 修补 | `ux-principles` MODE B | 6 |
| 重做整页 | `redesign-skill` | 6 |
| 截图 critique | `visual-critique` | 6 |
| 上线前最终 audit | `ux-principles` MODE C → `gsd-ui-review` | 6 |
| Design tokens | `design-systems:tokenize` | 7 |
| 色彩/字体/间距 | `ui-design:color-palette` + `:type-system` + `:spacing-system` | 7 |
| 响应式/暗模式 | `ui-design:responsive-design` + `:dark-mode-design` | 7 |
| Logo / 品牌 | `brandkit` | 8 |
| 海报 / PDF | `canvas-design` | 8 |
| 多主题 | `theme-factory` | 8 |

---

## 铁律(v1.0 substance 保留 + v2.3 phase-scope)

- **L3 互斥(phase-scoped)**:**BUILD 起(P3+)同时只能锁一个主风格**(由 `uiux-style-mutex-guard.js` hook 物理强制);taste §11 三档变体也是一次只叠一个。**例外:EXPLORE(P1)出多风格候选是锁前采样、不写 chassis、guard 不 fire**(详 combination-policy.md §6 + SKILL.md §4)
- **跨层组合是对的(v2.3)**:调度引擎 P0-P5 刻意跨层叠加多个 skill(接地 + 探索 + 风格 + 生成 + 统一 + 评审)是**质量优先的正确行为**,不违反任何铁律 —— 被禁的是"同层竞争 skill 同时上"(尤其多个 L3 锁定风格),不是"跨层组合"
- Layer P(`ai-native-interface`)是 orthogonal 范式层,**composes with L3、永远不是 L3 候选**,不进 L3 互斥、不占 L3 锁 —— 它与锁定的某个 L3 同时存在,paradigm 决定 interaction、L3 决定 visual skin
- Collection skills(`ui-ux-pro-max` / `ux-design@wondelai`)已卸载,永不当主风格
- Workflow skills(`redesign-skill` / `image-to-code-skill`)永不当 L3 主风格
- `luxury-editorial-site-builder` 只用于 brand landing(workflow,不占 L3)
- `theme-factory` 与 L3 主风格不同时跑(排 P3 BUILD 之后当资产步,会覆盖 tokens)
- `anchor-prototype-wave` 不**自动**触发;仅在 max 档(用户已选 max)由引擎 P3 BUILD 显式调度,或用户手动调用

## 模糊 Trigger 反问协议

**"高级/premium" 未指明暗/浅:**
> "要暗色编辑风(`luxury`:黑底/Oswald/fashion 感)还是浅色高级感(`taste` MODE B:Double-Bezel agency / 嵌套硬件感)?"

**"audit/design system/UI" 无细分:**
> 先走 `ux-principles` MODE A 列出冲突子分类。

**"升级 UI/redesign" 范围模糊:**
> 默认 `ux-principles` MODE B(局部战术修补);用户明确"重做整页"才进 `redesign-skill`。

## 反模式

- 同时**锁定**多个 L3 主风格(或 taste 多个 MODE)—— 注:EXPLORE 阶段多风格候选是采样,**不算违规**
- Workflow skill 当主风格用
- 跳过 Layer 0 直接进 Production
- 不确认入口(SKILL.md §2.0)就盲目从头跑全流程
- 自动触发 Layer 4 manual-only skill
- 一次性激活多个**同层竞争** skill / 多个 L3 锁定风格 —— **注:跨层刻意质量组合(调度引擎 P0-P5)是 v2.3 正确行为,不在此列**
- create/optimize 任务收敛成"单 skill 单趟"(旧默认,正是 v2.3 要根治的)
- 无 `grounding.md` 就进 P3 BUILD(凭空生造)
- 在 Layer 2 探索阶段强制 output-skill 完整输出
