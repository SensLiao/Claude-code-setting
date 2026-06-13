# Combination Policy — UIUX Dispatch Engine

> **本文件是 UIUX 主线的调度引擎规格(single source of truth)。** orchestrator SKILL.md §2.0 / `uiux-routing-table.md` / `style-lock-policy.md` 都引用本文件。
> 创建 2026-06-10。起因:用户反馈"第一版质量次 / 自动调度只挑 1-2 个 skill / AI 凭空生造无参考"——根因是旧编排被设计成"router(intent → 挑最窄的一个 skill)+ 单趟出活 + 禁止一次激活多 skill"。本文件把它**重塑为分阶段调度引擎(phase state machine)**。
>
> **核心句**:质量来自**结构 + 顺序 + 调度方式**,不来自"挑几个 skill"。组合 = 沿 Layer 横向广度 + 沿评审纵向深度;**不是**同时挂多个 L3 风格。

---

## 1. 范式反转:Router → Dispatch Engine

| | 旧(router) | 新(dispatch engine) |
|---|---|---|
| 形态 | intent → 查表 → 挑**最窄的一个** skill → 出活 | 6 阶段 state machine,每阶段有自己的**调度策略**,阶段间用**状态产物**串联 |
| 组合 | 禁止(反模式:"一次性激活多个 skill") | **刻意组合**:横向跨层 + 纵向评审循环 |
| 参考 | 默认零接地(taste 从模型权重默写) | **GROUND 阶段是硬前置**,本地 58 DESIGN.md 优先 + web 补充 |
| 多风格 | 被 L3 互斥误伤成"任何时候都不能多版" | EXPLORE 阶段**合法多版采样**(锁前,不违互斥) |
| 退出 | 第一趟就停 | REVIEW **循环不早退**,迭代到 reviewer 通过 |
| 默认 | 线性 Route A | **ask-first**:问 min/optimal/max(默认建议 optimal) |

**L3 互斥完整保留**(详 §6)。范式反转只发生在 **UIUX 主线**;GSD / AppSec / QA 主线的 narrower-skill-wins 不变。

---

## 2. Phase State Machine(6 阶段)

```
        ┌─────────────────────────── tier 决定走多深(§3) ──────────────────────────┐
        │                                                                             │
  ▶ P0 GROUND ──▶ P1 EXPLORE ──▶ P2 PICK ──▶ P3 BUILD ──▶ P4 UNIFY ──▶ P5 REVIEW ──▶ ✅ ship gate
   先扒参考      多方向采样      锁定唯一      锁定风格      细节统一      UX+交叉评审
   (硬前置)      (fan-out)       (人拍板)      下落地        (机械门)      (循环)
                                                              ▲              │
                                                              └── fail 回灌 ──┘
```

每阶段的合同:**目的 / 进入条件 / 拥有的 skill / 调度策略 / 产出状态产物 / 退出 gate**。调度策略各不相同——这是"重塑顺序与调度方式"的实质。

### P0 — GROUND(参考接地,硬前置)
- **目的**:消灭"凭空生造"。任何设计代码落地前,先有真实参考锚点。
- **进入条件**:create/optimize 任务被识别 + tier 已选(§7)。**进入第一步先跑 `local-template-index.md` §0 corpus presence-check;0 命中则按协议 STOP/ask,不得静默降级到模型先验。**
- **拥有的 skill**:本地 `local-template-index.md`(58 DESIGN.md + 历史 tokens)+ `competitive-teardown`(视觉抽取模式)+ web 源(Godly 免费 / design-inspiration MCP)+ suite 级 `references/anti-slop-suite.md`(注入为生成约束,所有 lens 通用)。
- **调度策略**:**串行查找,本地优先**。先按产品类型匹配本地 DESIGN.md / archetype `reference-anchors.md`;命中即用;本地无品类匹配才走 web。
- **产出状态产物**:`design/grounding.md`(匹配参考 + 抽取的 palette/type/spacing/motion token + provenance + 标杆站点)。**多 surface intent(用户说"做整个 X / 这几个页面 / dashboard 全套" 或 surface 数 ≥2)时,额外 enumerate surface 清单 → 写 `.uiux/lock/surface-inventory.yaml`(intent: multi-surface,每 surface build_status/review_status=pending);单 surface intent 可省。**
- **退出 gate**:`grounding.md` 存在且非空。**无它不得进 P3 BUILD。**

### P1 — EXPLORE(多方向采样,grounded)
- **目的**:先出几版给用户挑,不是一上来定死一个方向。
- **进入条件**:`grounding.md` 就绪。
- **拥有的 skill**:`prototyping-ui-directions`(主)+ `imagegen-frontend-web`(可选 moodboard)+ `ux-principles` MODE A(law/anti-pattern 选型)。
- **调度策略**:**并行 fan-out** —— 同时跑 N 个方向探索器,每个是一份 grounded 候选(palette + tokens + 关键 surface mock)。N 由 tier 定(§3)。**此阶段不写 chassis、不 lock、L3 互斥 guard 不 fire(§6)。**
- **产出状态产物**:`design/directions/<n>-<name>.md`(N 份候选,字段对齐便于横向对比)+ 对比说明。
- **退出 gate**:≥2 份(min)/ ≥3 份(optimal/max)成形候选,SHOW 给用户。

### P2 — PICK(用户拍板,唯一锁点)
- **目的**:把决定权交给人;这是整条流水线**唯一**写锁的地方。
- **进入条件**:候选已 SHOW。
- **拥有的 skill**:orchestrator(收敛)+ `uiux-sdk lock.style` + `references/style-lens-registry.md`(6 lens 注册表 + 统一 Style-DNA + 3 层 token 契约)。
- **调度策略**:**门控人类决策(gated)** —— 硬停,等用户挑一个。orchestrator 按 `grounding.md` matched_references + 用户 mood 词,从 `style-lens-registry.md` **预选 1-3 个 lens 候选** SHOW 给用户挑(lens 选择 = 路由动作,非用户手点 skill;EXPLORE 的 N 方向各对应一个 lens 候选预览)。不准 orchestrator 替用户默认选(除非用户显式"你来定")。
- **产出状态产物**:`.uiux/lock/style-lock.yaml`(L3 此刻锁定,互斥从此 active)。
- **退出 gate**:恰好一个 L3 family 被锁(`taste` / `luxury` / `brutalist` 之一)+ 记 `active_lens`(registry 6 lens 之一);AI-native 产品可正交叠 Layer P。

### P3 — BUILD(锁定风格下落地,grounded)
- **目的**:在唯一锁定风格 + 选中参考下,把候选骨架建成真页面。
- **进入条件**:`style-lock.yaml` + `grounding.md` 都在。
- **拥有的 skill**:`frontend-design@claude-plugins-official`(默认;max 用 `anchor-prototype-wave` 多 surface)+ `vercel:nextjs`/`:react-best-practices`/`:shadcn`(技术栈匹配时 overlay)+ suite 级 `references/anti-slop-suite.md`(builder 上下文**必注入**——无论锁定哪个 lens,suite anti-slop 一律生效)。
- **调度策略**:**锁定单线 + surface fan-out loop**。
  - IF intent == multi-surface:FOR each surface in `surface-inventory.yaml` WHERE build_status==pending → 在唯一锁定 lens + grounding 下调 builder(optimal `frontend-design`;max `anchor-prototype-wave` 并行批)→ 产出后置 build_status=built(失败置 failed 并记原因)→ 直到 0 pending(见退出 gate)。**max dispatch `anchor-prototype-wave` 时,跨批续跑 / resume 由引擎在此 loop 层 owns(读 manifest 找 pending/failed 继续),不改 wave skill 内部(§9)。**
  - ELSE (single-surface):调一次 builder。
  - 推荐 grayscale-first 子序列(先灰度验层级再上色)。
- **产出状态产物**:`src/` 或 `design/prototype/` surfaces + `.uiux/lock/chassis.yaml`(GSD UI-SPEC 的机器镜像)+ 回填 ledger 的 build_status。
- **退出 gate**:① (multi-surface)`surface-inventory.yaml` 中 **0 个 build_status==pending**;任何 failed 必须**显式呈现给用户**("surface X 建 N 次仍 fail,原因 Y,继续还是跳过?"),不得静默吞掉。② chassis 与 style-lock 一致。**no-silent-truncation 铁律:还有 pending / 未交代的 failed → 不得 advance 到 P4,不得对用户说"建完了"。**

### P4 — UNIFY(细节统一,机械门)
- **目的**:把"看起来差不多"变成"全局一套系统"——字体/形状/圆角/间距/色调/动效一致。这是用户"揪细节统一"那一步。
- **进入条件**:BUILD 产出存在。
- **拥有的 skill**:`design-systems:tokenize` → `ux-principles` MODE B(refactoring-ui 战术数字)→ `visual-critique`(构图/排版/层级)。max 再叠 `ui-design:color-system`/`:type-system`/`:spacing-system` + `interaction-design`(状态一致)+ `emil-design-eng`(微交互)。
- **调度策略**:**横向叠加 + 机械 token-compliance 扫**(可自动化):字阶只命中模数标尺 / 间距只命中 4·8 网格 / 无硬编码 hex / **组件不直接消费 primitive(必走 semantic 层,防跨 surface 色彩漂移)** / 圆角嵌套规则 / 阴影 ≤4 级 / **background_atmosphere 已声明且非裸纯色平背景(除非 lens 显式 none + 理由)** / 每个交互元素全状态。**主观评审前必须全过。**
- **产出状态产物**:统一后的 `chassis.yaml` + `token-compliance` 通过记录。
- **退出 gate**:token-compliance 全绿。

### P5 — REVIEW(UX 优化 + 交叉评审,循环)
- **目的**:多视角对抗评审,迭代到好为止——"第一版惊艳"的机制保证。
- **进入条件**:UNIFY 通过。
- **拥有的 skill**:`ux-principles` MODE C(NN 10-heuristic + Built-for-Mars teardown)→ `gsd-ui-review`(6-pillar)→ `santa-loop`(双模型对抗)/ Codex 官方 plugin `/codex:adversarial-review`(跨 AI,max;额度耗尽 → 退第二个 Claude subagent reviewer)。
- **调度策略**:**循环(loop),不早退** —— 一个 agent 一个 lens(防单模型自评正偏 bias)。reviewer 未通过 → **回灌 P4(或 P3)修 → 重评**。optimal/max **不在第一趟退出**。**multi-surface 时,REVIEW 循环对照 `surface-inventory.yaml` 逐 surface 标 review_status,未覆盖的 surface 视为未通过。**
- **产出状态产物**:REVIEW 结论以 prompt-level 形式呈现(reviewer 反馈 + 是否通过)+ 回填 ledger 的 review_status。`review-verdict.yaml` **只在可选的项目 Harness Pack(reference-mode)装上后才落盘**(详 §5 honesty note)——默认引擎**不写它、不强制它**。
- **退出 gate**:① reviewer 通过(min 1 趟即可;optimal 双 reviewer 通过;max 多轮收敛);② **(multi-surface)`surface-inventory.yaml` 中每个 surface review_status==reviewed-pass**——即"是否所有 surface 都被 review",不只是"已建的那几个质量 OK"。任一 surface review_status ∈ {pending, reviewed-fail} → REVIEW 未完成,回灌 P4/P3 修对应 surface。→ 交 `uiux-sdk gate.ship` / 下游 QA·AppSec·L12。**注:这是设计质量的 prompt-level gate,不是 governed release verdict(§9)。**

---

## 3. 组合深度矩阵(min / optimal / max)

> **关键**:三档定义的是"**走哪些阶段 + 每阶段多深**",不是"挑几个 skill"。所有档**都过 GROUND + EXPLORE→PICK + REVIEW**——接地与"先给你挑"与"至少一趟评审"是质量地板,任何档不可省。

| 阶段 | **min**(快出/单页/补屏) | **optimal = 默认**(完整质量循环) | **max**(旗舰/客户发布/多 surface) |
|---|---|---|---|
| P0 GROUND | 本地 1-2 个匹配 DESIGN.md | 本地 + `competitive-teardown` 视觉抽取 + 1 web 源 | 深度:58-index 全扫 + 12 维 teardown + `imagegen` moodboard |
| P1 EXPLORE | 2-3 个 inline 方向 | 3-4 个 `prototyping` 候选(palette+tokens) | 4-6 个完整 prototype 包 + 对比报告 |
| P2 PICK | 用户挑 | 用户挑 | 用户挑(+ Layer P 若 AI-native) |
| P3 BUILD | 遍历 surface 清单(每 surface 1 build;单页=1)· `frontend-design` | 同左 + vercel overlay | `anchor-prototype-wave` 多 surface 并行批 + vercel + brandkit/theme-factory |
| P4 UNIFY | `ux-principles` MODE B | tokenize + MODE B + `visual-critique` | + ui-design token 三件套 + interaction-design + emil |
| P5 REVIEW | `gsd-ui-review` 1 趟 | MODE C + gsd-ui-review + santa-loop,循环到通过 | + codex 跨 AI、多轮、+ QA/AppSec/L12 handoff |
| 量级 | ~6 skill / 1 趟评审 | ~10 skill / 评审循环 | ~18 skill / 多轮循环 + 下游交付 |

> **两个 N 不要混**:**N_explore**(EXPLORE 出几个**风格方向**给你挑,由 tier 定)≠ **N_surface**(BUILD 要建几个**页面/界面**,由 `surface-inventory.yaml` 定)。EXPLORE 是"风格选几版",BUILD 是"页面铺几个"。default(optimal) 的 BUILD **遍历整个 surface 清单到 0 pending**,不是只做一个。

**触发分流**(§7 ask-first):
- **min**:用户说"快一点 / 先随便看看" / 单组件 / 已锁 anchor 只补一屏。
- **optimal**:任何"做一个 / 优化一个 / 重做这块"的默认建议档。
- **max**:flagship / hero surface / 对客户/老板发布 / 4+ surface / 品牌门面 / 用户说"全力以赴 / 旗舰"。

---

## 4. 参考接地协议(P0 详规)

**铁律**:写任何一行设计代码前,先完成接地。"AI 自由发挥"是 fallback,不是默认。

### 双源(本地优先,web 补充)
- **SOURCE A — 本地(优先,零联网延迟,实测够厚)**:`references/local-template-index.md` 索引的 58 个真实品牌 DESIGN.md。corpus 根由 **`local-template-index.md` §0 Corpus Resolution Protocol** 解析(`config.corpus_root` → `$UIUX_DESIGN_CORPUS` → Desktop canonical → 仓内 vendored),**presence-check 通过后**直接 `Read` `<resolved-root>/<slug>/DESIGN.md`(色板/字体/组件规格/明暗预览)+ 历史 `tokens.css`/`palette.json` + archetype 的 `reference-anchors.md`(标杆站点)+ `canvas-fonts/`(premium 字体)。**无中间 skill 层——`local-template-index.md` 是 corpus 路径的查找表 + 解析协议,GROUND 据它解析根并直接读 DESIGN.md。presence-check 0 命中 → 按 §0 STOP/ask,绝不静默降级到模型先验。**
- **SOURCE B — web(本地无品类匹配 / max 深度时)**:Godly.design `.md` 端点(免 auth,curl 即得)+ design-inspiration MCP(开源,`design_extract_tokens` 从 URL 抽 token)+ `competitive-teardown` 视觉模式做候选发现。**付费源(Mobbin/Refero/21st)暂不接**(用户决策:零成本起步)。

> **precedence(铁律)**:**local-first → web-fallback → 绝不凭空生造**。本地 58 桶有品类/mood 匹配就用本地;只有本地全无匹配才走 web SOURCE B。

### 机制(谁抓 / 落哪 / 怎么变 token)
1. **classify**:orchestrator 判产品类型 → 决定加载哪个 archetype + 本地有无匹配 DESIGN.md(查 `local-template-index.md` §2 桶 / §3 archetype 锚)。
2. **本地加载**:**直接 `Read` 1-3 个** `…/design-md/<slug>/DESIGN.md` + 匹配历史 tokens + archetype `reference-anchors.md` → 写 `design/grounding.md`(provenance = 本地路径)。
3. **web 抓取**(仅当本地无品类匹配):`competitive-teardown` 视觉模式 / design-inspiration MCP 抓 3-5 参考 + 抽 token → 同样落 `grounding.md`(带 provenance)。
4. **变 token/anchor**:`grounding.md` →(P1)`prototyping` 方向候选(oklch 色板/字体/motion)→(P3)`design-systems:tokenize` 完整 CSS 变量。
5. **持久化**:锁定后写项目 `DESIGN.md`(token + 文字理由),每趟生成 re-anchor 防 drift。

`grounding.md` 最小字段:`matched_references[]` / `palette` / `typography` / `spacing` / `motion` / `provenance`(本地路径或 web URL)/ `exemplar_anchors[]`。

---

## 5. 状态产物链(阶段间怎么连——不是口头接力)

```
P0 grounding.md
   └▶ P1 directions/<n>-<name>.md (N 份候选)
         └▶ P2 .uiux/lock/style-lock.yaml (锁定 1 个 L3)
               └▶ P3 src|prototype surfaces + .uiux/lock/chassis.yaml
                     └▶ P4 unified chassis + token-compliance
                           └▶ P5 review 结论(prompt-level;review-verdict.yaml 仅 Harness Pack 装上才落盘) ──▶ gate.ship
```

每阶段**读上游产物、写自己产物**——这是"结构化串联"取代"线性口头交接"的实质。落点:`design/`(探索/接地)+ `.uiux/`(lock/chassis/evidence,project-scoped)。**复用现有** reference-mode 的 anchor/prototype 机制 + chassis mirror,不另起炉灶。

> **Honesty note — `review-verdict.yaml` 是 opt-in,不是默认产物**:本引擎**默认不向 `.uiux/` 写 enforcement 产物、不加任何拦 dev 的 hook**(§9)。P5 REVIEW 默认是 **prompt-level guidance**——reviewer 反馈与"是否通过"在对话里呈现并驱动回灌循环,**不**强制落盘 yaml。`review-verdict.yaml` 与 `gate.ship` 的可执行检查**只在用户显式装上 project Harness Pack(reference-mode)后才存在**;`uiux-sdk` 当前**没有** `review-verdict` 的 write/check 命令(只有 `lock.style` / chassis mirror / `gate.ship` 镜像契约)。所以上面链路里的 `review-verdict.yaml` 框出来的是 *Harness-Pack-on 时的落点*,不是裸引擎承诺写的文件——避免把 prompt-level 设计评审误读成有 SDK enforcement 的 release gate。

---

## 6. L3 互斥保全协议(回应"别打破单选")

互斥与组合**在不同轴上运作**,不冲突:

1. **PHASE-SCOPE 互斥**:互斥的真正含义是"**BUILD 起(P3+)恰好一个 L3 在写 token/chassis**"。新模型完整尊重。
2. **EXPLORE = 采样(锁前,合法多版)**:P1 出 N 个候选是**采样不是锁定**——不写 chassis、无 style-lock。`uiux-style-mutex-guard.js` **按 LOCK 是否存在判定,不按 phase**:只要 `.uiux/lock/style-lock.yaml` 尚未写入,多个 L3 候选 invoke 都放行(EXPLORE 自然处于这个无锁窗口);一旦 lock 写入,就恰好强制一个 L3。所以"EXPLORE 不被拦"是无锁的**结果**,hook 本身不感知 phase。与现有 reference-mode 的 explore→审→lock 流一致。
3. **PICK = 唯一锁点**:P2 用户挑定后才 `lock.style`,此后第二个 L3 被拒(exit 2),行为不变。
4. **P4/P5 全是横切技能**:`design-systems` / `ux-principles` / `visual-critique` / `gsd-ui-review` / `emil` / `interaction-design` 是 L0/L6/L7/L11,**不是 L3 风格**,叠多少都不违互斥。`theme-factory` 唯一注意:排 build **之后**当资产步,绝不与 L3 并发。
5. **Layer P 正交**:`ai-native-interface` 是 paradigm 层,COMPOSES on top of L3,**绝不占 L3 锁**。
6. **循环在时间轴**:P5 反复 critique+fix 的是**同一个锁定风格**,多轮 ≠ 多风格。

**一句话**:多风格 = EXPLORE 采样(锁前,允许);单风格 = BUILD 起(锁后,互斥强制)。

---

## 7. Tier 选择(ask-first — 用户决策 2026-06-10)

任何 create/optimize 任务,orchestrator **先问一句**再跑:

> "这个要走哪档?**(1) min** 快出(仍接地+一趟评审)/ **(2) optimal** 完整质量循环(推荐,第一版即达标)/ **(3) max** 旗舰(深度参考+多轮对抗+下游交付)。"

- **默认建议 optimal**(高亮推荐)。
- **例外免问**:用户已说"快一点 / 先看看" → 直接 min;用户已说"全力 / 旗舰 / 给客户发布" → 直接 max。
- 选定后 orchestrator 按 §3 矩阵驱动 §2 state machine。
- **surface 计数(决定 ledger 是否 REQUIRED)**:从用户语义("整个/全套/这几个页面/N 个 surface/landing+dashboard+settings")+ GSD `.planning/phases/<phase>/UI-SPEC.md` 的 surface 列表推断。≥2 → `intent=multi-surface` → surface-inventory ledger **REQUIRED**(P0 产出)。含糊("做个后台"可能 1 也可能 N)→ **反问用户列 surface,不擅自当单页。**

---

## 8. 调度合同(orchestrator 实际怎么驱动)

orchestrator 作为 thin driver 跑这个循环(**不在此 authoring 设计内容**,内容在各 skill 里):

```
读 .uiux state + design/ 产物
  → 判定当前 phase(按已存在的状态产物)
  → 若入口:ask-first 选 tier(§7)
  → 跑该 phase 的调度策略(§2:GROUND 串行 / EXPLORE fan-out / PICK 门控 / BUILD 锁定 / UNIFY 叠加扫 / REVIEW 循环)
  → 查退出 gate;未过则留在本 phase(REVIEW 未过 → 回灌 P4/P3)
  → 持久化状态产物 → advance
  → P5 通过 → (Harness Pack on 时) uiux-sdk gate.ship → 下游 handoff;否则 prompt-level 收口 + 口头 handoff
```

触碰的现有机制:P2 `uiux-sdk lock.style`;P3 chassis mirror;P5 `gate.ship`(镜像契约,**Harness-Pack/reference-mode 装上才有可执行检查**;裸引擎下 P5 是 prompt-level 收口,见 §5 honesty note)。**尊重 GSD bridge**:不替代 `/gsd-ui-phase` / `/gsd-ui-review` / `gsd-ui-*` agent(它们仍是单一真相源),本引擎是 UIUX 主线**内部**的质量组合,镜像契约行为不变。

---

## 9. 不改动 / 保护边界(2026-06-10 user lock)

- 🚫 `sens-frontend-design`(用户自己的 Reference→Anchors→Prototype 提案流)—— 全程不碰。
- 🚫 `anchor-prototype-wave` 内部 —— 不改;只在 max 档 BUILD 引用它。
- 🚫 GSD bridge 核心(`gsd-ui-phase`/`gsd-ui-review`/`gsd-ui-researcher`/`gsd-ui-checker`/`gsd-ui-auditor`)—— GSD-owned,不动。
- 🚫 governed gate(spec_hash / ROE / 合规签字)—— 本引擎是**设计质量评审**,绝不进 release/安全/合规 verdict 路径。
- ✅ enforcement 全 **project-installed-only**;dev env 全程不拦;fresh project 无 `.uiux/config.json` 时零 enforcement。

---

## 10. 反模式(重塑后的新铁律)

- ❌ create/optimize 任务收敛成"单 skill 单趟"(旧默认,正是要根治的)。
- ❌ 无 `grounding.md` 就进 BUILD(凭空生造)。
- ❌ corpus 缺失/路径失效时退回模型先验编 design token(必须按 §0 STOP 或显式 web 授权,绝不静默生造)。
- ❌ multi-surface intent 下 BUILD 只建一个 surface 就声明完成(必须遍历 ledger 到 0 pending;failed 必须显式交代)。
- ❌ REVIEW 只评"已建的那几个"不检查"是否所有 surface 都被 review"(review_status 必须逐 surface 到 reviewed-pass)。
- ❌ PICK 之前 lock L3(EXPLORE 必须是无锁采样)。
- ❌ optimal/max 在 REVIEW 第一趟就退出(质量不收敛)。
- ❌ 同时把多个 L3 当锁定风格(互斥仍强制)。
- ❌ orchestrator 替用户默认选方向 / 默认选 tier(PICK 与 tier 都要问)。
- ❌ 把本引擎的质量循环当成 release/安全签字(它只是设计评审)。
