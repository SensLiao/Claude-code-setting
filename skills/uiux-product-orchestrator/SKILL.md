---
name: uiux-product-orchestrator
canonical_id: uiux.orchestrator
aliases: [uiux, uiux-orchestrator, ui-orchestrator, frontend-orchestrator]
version: 2.1.0
status: stable
created_date: 2026-05-23
last_updated: 2026-05-25
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion
upstream:
  - gsd-pipeline-orchestrator       # GSD master pipeline
  - gsd-ui-phase                    # produces UI-SPEC.md (source of truth)
  - gsd-ui-review                   # produces UI-REVIEW.md (source of truth)
downstream:
  - uiux-gsd-contract-validator     # the one bridge agent
  - enterprise-qa-testing           # visual regression baseline handoff
  - appsec-security-orchestrator    # frontend security review for user-data surfaces
description: >
  Use when UI/UX design, visual direction, reference research, style selection,
  design system, brand visual, screenshot-to-code, or UI audit work begins.
  GSD-native UIUX contract gate. v2.1 = thin bridge layer that mirrors GSD
  `.planning/phases/<N>/UI-SPEC.md` and `UI-REVIEW.md` into machine-readable
  `.uiux/lock/chassis.yaml` and `.uiux/decisions/<tag>/uiux_release_decision.yaml`,
  enforces L3 style mutex, and provides release gate for `/gsd-ship`. Does NOT
  replace `/gsd-ui-phase` / `/gsd-ui-review` / `gsd-ui-researcher` /
  `gsd-ui-checker` / `gsd-ui-auditor` — those are GSD-owned and remain the
  single source of truth. Routes UIUX skills (L0-L8 in references/uiux-routing-table.md).
  Trigger phrases: "UI/UX 设计 / 视觉方向 / 参考研究 / 风格选型 / design system /
  品牌视觉 / 前端 design / 截图还原 / UI audit / chassis lock / release readiness UI".
---

# UIUX Product Orchestrator v2.1 — GSD-native UI Contract Gate

> **Execution mode: SKILL-direct only**（2026-05-29 user lock）— 本 skill **NOT** migrating to Workflow tool workflow-spec mode. Reason: L3 风格互斥 + collection skill / workflow skill 边界 + ui-ux-pro-max 67 风格自动匹配是 inherently interactive 模式，单 pass DAG workflow 无法覆盖。所有 UIUX 工作通过 SKILL 主线 + `gsd-ui-*` agent + L3-L9 inline skill 派发。详 `~/.claude/CLAUDE.md §3.5`。

---

## 1. Mission

UIUX 主线 contract gate。把 GSD 已有的 UI 工作流（`/gsd-ui-phase` → `/gsd-ui-review`）
变成可 gate、可复用、可交给 QA/AppSec/GSD ship 的机器契约。

**职责**：
- 路由 UIUX skill（9 层 L0-L8，详 [references/uiux-routing-table.md](references/uiux-routing-table.md)）
- 把 GSD UI-SPEC.md mirror 成 `.uiux/lock/chassis.yaml`
- 把 GSD UI-REVIEW.md mirror 成 `.uiux/evidence/<tag>/gsd-ui-review.yaml`
- 锁定 L3 风格唯一（hook 强制 mutex）
- 在 `/gsd-plan-phase` / `/gsd-ship` 前做轻量 gate
- 输出 `uiux_release_decision.yaml` 给 GSD ship / QA / AppSec 消费

**不做**：
- ❌ 替代 `/gsd-ui-phase` 自己生成 UI-SPEC（GSD `gsd-ui-researcher` 的活）
- ❌ 替代 `/gsd-ui-review` 自己做 6-pillar 视觉审计（GSD `gsd-ui-auditor` 的活）
- ❌ 替代 `gsd-ui-checker` 自己校 UI-SPEC（已有 PASS/FLAG/BLOCK）
- ❌ binary 判断"设计好不好看"（审美不可机器化）
- ❌ 每次 UI 请求都从 Step 0 跑到 Step 8（event-driven only）
- ❌ 与 `.planning/` 抢 source of truth（mirror only）

---

## 2. Activation

激活分四种模式（[references/gsd-bridge-contract.md](references/gsd-bridge-contract.md) §1）：

| 项目状态 | 行为 |
|---|---|
| 无 `.planning/` 且无 `.uiux/config.json` | 只按 §3 做普通 UIUX 路由建议；**不创建 `.uiux/`** |
| 有 `.planning/` 但无 `.uiux/config.json` | GSD 项目但 UIUX gate 未启用 → advisory only |
| 有 `.planning/` + `.uiux/config.json`，`strict_mode=lax` | gate hooks 只 warn，不 block |
| 有 `.planning/` + `.uiux/config.json`，`strict_mode=strict` | gate hooks hard block；release decision 必须 PASS/CONDITIONAL_PASS 才能 ship |

物理标识：`.uiux/config.json` 存在 = "UIUX gate enabled"。

**铁律**：UIUX orchestrator + hooks + sdk 在非 UIUX-enabled 项目下 **全部 silent exit 0**，绝不产生噪音、绝不落盘。

---

## 2.0 Entry-Situation Router（入口情景分流）— 路由第一步，必过 (v2.2, 2026-06-02)

> 起因：用户反馈「做前端不总是从头开始 —— 很多时候是先给了料（reference 图 / 要还原的截图 / 客户提案 / 现有项目）再做」。原 §2.0 只处理 reference 一种入口（2026-05-27），现升级为完整 7 入口分流。
> **核心原则：先看用户给了什么料，再动态决定进哪条线。** 不是每个 UI 任务都从 `ux-principles` 一路走到底。

### 入口判定表（从上往下匹配，命中即停 — 这是 §3-§7 的前置分流）

| # | 入口情景 | 触发信号（用户给了什么 / 说了什么） | 直接进 | 主力 skill / 路径 |
|---|---|---|---|---|
| **E1** | 从零想法 | 一句话需求、无任何视觉物料、"帮我做个 X / 做个 dashboard / landing" | 全流程 | `grill-with-docs`(需求模糊时) → `prototyping-ui-directions` → L3 → `frontend-design@official` |
| **E2** | 给了 reference 图 | 对话附 PNG/截图"我要这种感觉"、`design/reference/` 有图、history 已 lock anchor | Anchor 三步走（见下细则） | `image-to-code-skill`(mode=reference) → anchor lock → prototype → 实现 |
| **E3** | 给了截图要还原 | "照这张图做 / 1:1 还原 / 复刻这个页面" | 直接图生码 | `image-to-code-skill`(默认 image-first) → L3 overlay |
| **E4** | 客户提案（多方向） | "给客户/老板出几版高保真"、"提案 demo 不上线"、"N 个方向并行对比" | 3-stage 提案流 | `sens-frontend-design`（Reference→Anchors→Prototype，静态 HTML 可部署/截图进 PDF） |
| **E5** | 现有项目升级 | "我现有页面/项目改好看"、"redesign 整个 X"、给了现有代码或 URL | 扫描诊断修复 | `visual-critique`(先审截图) → `redesign-skill`(整页重做) |
| **E6** | 局部修补 | "这块 spacing/层级/对齐不对"、"调一下这个组件" | 战术修补 | `ux-principles` MODE B（战术查表，含并入的 `refactoring-ui-*.md` 5 份明细） |
| **E7** | 上线前审计 | "上线前体检 / UI 审一遍 / release 前 gate" | audit gate | `ux-principles` MODE C → `gsd-ui-review`(6-pillar) |
| **E8** | AI-native 对话式产品 | "对话式 AI 原生产品 / conversation-first / 生成式 UI / 骨架库 / show-then-ask / continuous-interface / URL-as-state / 没有页面只有一场对话" | paradigm + L3 并行 | `ai-native-interface`(范式层) **＋** 同时另选锁定的 L3（视觉皮肤，§4 单选）**＋** `ux-principles`（Show-Then-Ask / Give-Before-Take 两条新 law）**＋** `security-app-llm`（AI surface 安全） |

> **E8 关键边界**：`ai-native-interface` 是 **interaction-architecture / paradigm 层（orthogonal overlay）**，决定"对话怎么流、骨架库怎么取、状态怎么连续"；它**与 L3 组合（composes with L3），永远不是 L3 风格、不占 L3 锁、不违反 §4 L3 互斥**。E8 落地时仍要按 §4 单独锁一个 L3 当视觉皮肤（taste / luxury / brutalist 任一），两者同时存在：paradigm 决定 interaction，L3 决定 visual skin。orchestrator 只做 thin router —— **不在此 authoring 范式内容**，范式内容全在 `ai-native-interface` skill 里。

### 分流后的通用规则
- **E1/E2/E4 各自入口流程跑完后，仍回到 §3-§7**（GSD routing / style mutex / chassis lock / release gate / handoff）。入口路由是**前置分流**，不替代后续。
- **L3 风格（§4）在 E1/E2/E3/E5 里都要锁，一次只一个**：`taste`（默认，含 §11 三档变体 Editorial Monochrome / Double-Bezel Agency / GSAP Scrollytelling，已吸收原 soft / gpt-taste / minimalist）、`luxury`（暗色编辑）、`brutalist`（手动 user-invocable）。
- **无料但明显是 UI 任务、或入口模糊 → 必须先问用户走哪个入口**，不准擅自决定（细则见下方 E2/E1 判定表）。

---

### E2/E1 判定细则 — Reference 还是 taste-default（原 reference-mode 内容，2026-05-27 起）

当入口落在 **E1/E2**（从零想法 or 给了 reference 图）时，再用下表细分该走 reference-mode（提取 anchor）还是 taste-default-mode（Claude 自定风格）：

### 判定规则

| 信号 | 判定 |
|---|---|
| 用户对话直接附 PNG / 截图 | reference-mode |
| `design/reference/` 存在且含 `*.png\|*.jpg\|*.jpeg\|*.webp\|*.gif` | reference-mode |
| 历史 session 已 lock anchor（`STATE.machine.json` 中 `reference_mode.anchor_locked=true`） | reference-mode（已锁定，跳过 step 1-2，直奔 prototype） |
| 用户脑里有视觉、还没生图 | 写 prompt 给用户去生 → 等用户给回 PNG → 进 reference-mode |
| 用户 explicit 说 "不用 reference 你来决定" | L3-default-mode（仍要走 anchor + prototype，只是 anchor 是 Claude 自创） |
| 用户没说话 + 明显 UI 任务 + 上述信号都无 | **必须先问** "你有 reference 吗？还是想让我用 L3 风格 default？" — 不准擅自决定 |

### Reference-mode 强制三步走

```
Step 1 — Reference
  - PNG 已存在 design/reference/，或用户对话给图
  - orchestrator 不另外生图（区别于 image-to-code-skill 默认的 image-FIRST 行为）

Step 2 — Anchor
  - 跑 image-to-code-skill (mode=reference, see reference-mode.md) → 分析提取
  - 命名 anchor style（独立新名，不套 L3 标签）
  - 写 design/anchor/{ANCHOR-STYLE.md, PAGE-INDEX.md, tokens.json, pages/}
  - 用户审 → lock：`node .claude/scripts/harness-state.js lock-anchor`

Step 3 — Prototype
  - 跑 image-to-code-skill → 出 HTML/JSX 布局骨架（layout-only，无 data 无 copy）
  - 写 design/prototype/<phase>/<surface>.jsx
  - 用户审 → 改进 prompt → 重生 → 布局对齐 → lock：lock-prototype
  - 骨架进 .planning/phases/<phase>/UI-SPEC.md <layout_skeleton> 段

Step 4 — Implementation
  - 现在才能进 §3-§7 路由表的 L3-L6
  - executor 按 prototype 骨架施工 src/
```

**绝对禁止**：
- ❌ 有 reference 但跳过 anchor 直奔 executor（典型 Agent Atlas Wave 4 失败模式）
- ❌ 用 L3 风格 picker 当 layout contract（L3 决定调性，不决定 chassis）
- ❌ orchestrator 默默选 L3 default 而不问用户
- ❌ Step 2 用 image-to-code-skill 的默认 image-FIRST 模式重新生图（reference-mode 必须 mode=reference 跳过生图）

### 与 §3-§7 的关系

完成 Reference Mode 三步走 + lock 之后，§3-§7（GSD-native routing / style mutex / chassis lock / release gate / handoff）仍照常跑。Reference Mode 不替代它们，是它们的**前置入口**。

### 项目级 harness hook 兜底

若项目装了 Harness Pack v1（即 `.claude/hooks/harness-gate.js` 存在），任何尝试在 anchor/prototype 未 lock 时 Edit `src/**` 会被 `exit 2` 阻断。不是建议，是物理强制。

---

## 3. GSD-native Routing

完整 9 层 routing table（L0 Foundation → L8 Brand/Assets）保留在
[references/uiux-routing-table.md](references/uiux-routing-table.md)。这一节只列**新增的 GSD 触发节点**：

| GSD 节点 | 本 orchestrator 行为 |
|---|---|
| 用户问"UI 怎么样" / "改个样式" | advisory only（L3-L6 routing），无 `.uiux/` 副作用 |
| `/gsd-discuss-phase` 收集 design intent | 允许收集 style_intent，但**不**锁 |
| 准备 `/gsd-plan-phase` 且 phase 是 frontend | hook `uiux-gsd-plan-guard.js` 校验 UI-SPEC 存在；缺则建议先跑 `/gsd-ui-phase` |
| `/gsd-ui-phase` 完成（写出 UI-SPEC.md） | `uiux-sdk mirror.gsd-ui-spec <phase> <tag>` → `.uiux/lock/chassis.yaml` |
| 用户 invoke L3 style skill | hook `uiux-style-mutex-guard.js` 校验/写 style-lock |
| `/gsd-execute-phase` | 不额外 audit，只检查 chassis lock 仍 consistent |
| `/gsd-ui-review` 完成 | `uiux-sdk mirror.gsd-ui-review <phase> <tag>` → `.uiux/evidence/<tag>/gsd-ui-review.yaml` |
| `/gsd-ship` | hook `uiux-release-guard.js` 跑 `uiux-sdk gate.ship` |

详细 Step 0-8 dispatch contract → [references/gsd-bridge-contract.md](references/gsd-bridge-contract.md) §3。

---

## 4. Style Lock Policy

**核心规则**：同一 release_tag 内只能锁一个 L3 风格。

允许的 L3 候选（由 `.uiux/config.json.allowed_l3_styles` 项目级白名单决定，全局默认）：

- `taste-skill` — **默认通用 premium craft**，含 §11 三档变体模式（A Editorial Monochrome / B Double-Bezel Agency / C GSAP Scrollytelling）。已吸收原 `soft-skill` / `gpt-tasteskill` / `minimalist-skill` 三者风格，用语义切换即可。
- `luxury` — 暗色编辑 / 高端品牌（Oswald / 黑底 / fashion）
- `brutalist-skill` — user-invocable only（Swiss / 数据密集 / 工业粗野）

**永远不允许作为 L3**：
- `redesign-skill` — workflow，不是 style
- `image-to-code-skill` — workflow
- `frontend-design@official` — production workflow
- `luxury-editorial-site-builder` — landing-page workflow（不占 L3 锁）

> 注：`soft-skill` / `gpt-tasteskill` / `minimalist-skill` / `stitch-skill` / `frontend-design-pro` 已于 2026-06-02 删除；前三者的独特风格规则已并入 `taste-skill §11`。

详细 policy + unlock/relock 流程 → [references/style-lock-policy.md](references/style-lock-policy.md)。

---

## 5. Chassis Lock Policy

`.uiux/lock/chassis.yaml` 是 **GSD UI-SPEC.md 的机器可读 mirror**，不是另一个 source of truth。

| 字段 | 来源 | 谁写 |
|---|---|---|
| `palette` | UI-SPEC "## Color" 段 | `uiux-sdk mirror.gsd-ui-spec` |
| `typography` | UI-SPEC "## Typography" 段 | 同上 |
| `spacing` | UI-SPEC "## Spacing" 段 | 同上 |
| `copywriting` | UI-SPEC "## Copywriting" 段 | 同上 |
| `registry_safety` | UI-SPEC registry safety block | 同上 |

**强约束**（由 `gsd-ui-checker` 在 UI-SPEC 阶段已校验，本 orchestrator 不重复）：
- typography 最多 4 个 distinct sizes
- spacing 必须是 base_unit (4px) 倍数
- accent color 不可"reserved for all interactive elements"

Drift 检测：`uiux-sdk drift.check <tag>` 比对 `.uiux/lock/chassis.yaml` vs UI-SPEC.md（mid-release 修改 UI-SPEC 但 lock 未更新 → 报警）。

详细 schema → [references/chassis-schema.md](references/chassis-schema.md)。

---

## 6. Release Gate Policy

`/gsd-ship` 前必须通过 `uiux-sdk gate.ship <tag> --phase <N>`，输出
`.uiux/decisions/<tag>/uiux_release_decision.yaml`。

退出码（与 appsec-sdk / qa-sdk 对齐）：

| Code | Meaning | When |
|---|---|---|
| 0 | PASS | UI-SPEC + chassis + UI-REVIEW + style lock 全 consistent，无 blocker |
| 1 | FAIL | UI-REVIEW 有 blocker / chassis drift detected |
| 2 | BLOCKED | 缺 UI-SPEC / 缺 chassis / 缺 required handoff |
| 3 | CONDITIONAL_PASS | UI-REVIEW 有 warning 但无 blocker（需 `--allow-conditional` 才放行） |

详细 schema → [references/release-decision-schema.md](references/release-decision-schema.md)。

---

## 7. Handoff to QA / AppSec / GSD

| 下游 | handoff 内容 | 字段 |
|---|---|---|
| `enterprise-qa-testing` | visual regression baseline 是否就绪 | `qa_handoff.visual_regression_required` + `qa_handoff.baseline_ready` |
| `appsec-security-orchestrator` | frontend review 范围（含 user data 的 surface） | `appsec_handoff.frontend_review_required` + `appsec_handoff.user_data_surfaces[]` |
| `gsd-ship` / `gsd-verify-work` | 整体 release decision | `decision` + `hard_block_reasons[]` + `conditional_reasons[]` |

详细 handoff 协议 → [references/gsd-handoff.md](references/gsd-handoff.md)。

---

## 8. References

- [gsd-bridge-contract.md](references/gsd-bridge-contract.md) — Step 0-8 dispatch contract + activation matrix
- [uiux-routing-table.md](references/uiux-routing-table.md) — 9 层 L0-L8 完整路由（v1 substance preserved）
- [style-lock-policy.md](references/style-lock-policy.md) — L3 mutex + unlock/relock 流程 + blacklist
- [chassis-schema.md](references/chassis-schema.md) — `.uiux/lock/chassis.yaml` schema + extraction rules
- [release-decision-schema.md](references/release-decision-schema.md) — `uiux_release_decision.yaml` schema
- [gsd-handoff.md](references/gsd-handoff.md) — QA / AppSec / GSD ship handoff protocol
- [templates/dot-uiux-skeleton/](templates/dot-uiux-skeleton/) — project-level `.uiux/` skeleton
- `~/.claude/scripts/uiux-sdk.sh` — SDK helper (init / detect.gsd / mirror.* / lock.style / gate.*)
- `~/.claude/agents/uiux-gsd-contract-validator.md` — the one bridge agent
- `~/.claude/hooks/uiux-gsd-plan-guard.js` / `uiux-style-mutex-guard.js` / `uiux-release-guard.js`

### GSD 官方 source of truth（不要重写）

- `~/.claude/agents/gsd-ui-researcher.md` — 写 UI-SPEC.md
- `~/.claude/agents/gsd-ui-checker.md` — 校 UI-SPEC.md (PASS/FLAG/BLOCK)
- `~/.claude/agents/gsd-ui-auditor.md` — 写 UI-REVIEW.md (6-pillar)
- `/gsd-ui-phase` / `/gsd-ui-review` commands
