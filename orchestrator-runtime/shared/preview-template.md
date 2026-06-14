# Execution Preview Template — PLAN-PREVIEW CARD (Patch A.3 — 表 + 流程图)

> Rendered by the domain Skill (AppSec / QA / UIUX / GSD) — and by any ad-hoc
> multi-agent / Workflow dispatch — BEFORE execution. It shows, as a **TABLE +
> dots-and-lines DIAGRAM**: WHAT will run, WHO does it (agent · model · the tools
> it uses + what each tool does), and the data FLOW.
>
> Two modes, ONE card:
> - **workflow-spec mode** → the card IS the hard `spec_hash` approval gate
>   (enforced by `<domain>-preview-gate.js`: sentinel + hash + TTL). The card is
>   the human-readable *render*; the hook is the *enforcement*. They compose.
> - **prompt-only / ad-hoc mode** (DEFAULT, incl. Windows) → the card is the
>   instruction-layer **坎** (CLAUDE.md §0.6): render → wait for confirm → run.
>   No sentinel, no hash — just the visible plan + a confirmation reply.
>
> **Design (CLAUDE.md §0.5 reporting style)**: business value first (目标 / 能力 /
> 做完得到 / 成本); agents · tools · flow readable at a glance; `spec_hash`,
> fingerprints, sentinel paths demoted to `<details>` and shown only on request.

---

## Default user-facing card (this is what the user sees before execution)

```
╔══════════════════════════════════════════════════════════════════════╗
║  执行计划预览 · PLAN PREVIEW — {{Domain}} / {{mode_human_name}}
╚══════════════════════════════════════════════════════════════════════╝

🎯 目标:          {{goal_one_line}}
🧩 用到的能力:    {{capabilities_csv}}        ← 例: 风险分类 · 并行 fan-out · 证据落盘 · spec_hash 审批
✅ 做完你会得到:  {{outcome_one_line}}        ← 业务语言, 不是 schema 名
📦 规模 / 成本:   {{phase_count}} 步 · {{exec_count}} 执行 / {{cached_count}} 缓存 · ~{{tok_low}}k–{{tok_high}}k tokens · ~{{wallclock}} · {{model_mix}}
🚦 复杂度档:      {{tier}}   (简单 = 跳过本卡 / 中等 = 出表 / 复杂 = 表 + 图 + 成本)
🤔 为什么这个形状: {{shape_justification}}     ← 检测到什么 / 跳过了什么 / 为何选这个 mode

── Agents 调度 ─────────────────────────────────────────────────────────
| # | 阶段 / Agent            | 模型        | 干什么 (一句话)            | 用的工具 = 作用                       |
|---|------------------------|-------------|---------------------------|--------------------------------------|
{{for each phase}}
| {{i}} | {{name}}{{ × N}}    | {{model}}   | {{job}}{{ (parallel)}}    | {{tool}}={{what}}; {{tool2}}={{what2}} |
{{end}}

── 流程 / 结构图 (dots & lines) ────────────────────────────────────────
{{ascii_flow_diagram}}

   图例:  ──► 串行   ═►parallel×N   ◇ gate/判定   ⟳ loop   [det] 纯代码无 agent   ? = skip_if 可跳过

── 证据 / 产物 ─────────────────────────────────────────────────────────
{{for each evidence/artifact path}}  - {{path}}
{{end}}

🔒 spec_hash {{hash8}} · 审批后 TTL {{ttl}}s        ← 仅 workflow-spec 模式; happy-path 不展开
────────────────────────────────────────────────────────────────────────
确认执行?   回复  OK / 批准 / 跑 / 继续 / 同意 / 好 / 执行
            改:  说哪一步要改        停:  cancel / 取消
<details><summary>展开技术细节 (spec_hash / fingerprints / sentinel / hooks / refs)</summary>
{{technical_appendix — see "Technical appendix" block below}}
</details>
```

**The card has exactly the four things the user asked to always see:**
1. **A table** (`Agents 调度`) — `# · 阶段/Agent · 模型 · 干什么 · 用的工具=作用`. The
   **tools column** is mandatory and is the column the old template lacked.
2. **A dots-and-lines diagram** (`流程/结构图`) — the flow/structure, with a legend
   encoding serial / parallel / gate / loop / deterministic / skippable.
3. **Business-value top lines** (目标 / 能力 / 做完得到 / 成本) per §0.5.
4. **A confirmation 坎** — explicit approve / modify / cancel.

---

## ASCII flow diagram — generation rules (Skill-side, from `spec.phases[]`)

The Skill walks `spec.phases[]` (or, in prompt-only/ad-hoc mode, its planned
agent list) IN ORDER and emits `{{ascii_flow_diagram}}`:

1. **serial single node** → `Name` on a horizontal chain, joined by `──►`.
2. **fanout node** → `Name × N` (N = resolved width, or `_width_range[0]–[1]` if dynamic), arrow `═►`.
3. **pipeline node** → `Name × M items (P stages)`.
4. **deterministic node** → `[Name: op_name]` (brackets = code-only, no agent).
5. **skip_if node** → append `?` and a `(skip if <cond>)` note.
6. **gate / decision node** → mark with `◇`; show the ✗→stop / ✓→continue branch.
7. Long chains: break line + indent for readability; keep arrows.

**Worked example — AppSec `l2-default` (release gate):**
```
   Scope ──► Plan
     │
     ═► Find × 4–8            (parallel, appsec-reviewer)
         └─► Normalize?       (skip if no_candidates)
              └─► [Dedup]     (det: fingerprint_cluster)
                   ═► Verify × clusters   (pipeline, votes low=1 med=1 high=3 crit=3)
                        └─► Map?          (skip if no_accepted)
                             └─► ◇ [Gate] (det: appsec_gate_policy)
                                   │ ✗→ 停下报告 BLOCKED/FAIL
                                   ▼ ✓
                                 Synthesize ──► PersistEvidence → .appsec/evidence/<tag>/
```

**Worked example — QA `release-readiness`:**
```
   LayerSelect ──► StaticBaseline ──► [StaticGate] (det)
     ═► ComponentOrContract × 3–6   (parallel, qa-component-runner)
     ═► E2E × 1–3                    (pipeline: prepare/sonnet → run-validate/opus)
         └─► FlakyTriage?            (skip if no_flaky_signal)
              └─► [FlakyQuarantineCheck] (det)
                   └─► ◇ [Gate] (det: qa_gate_policy)
                         ▼ ✓
                       EvidenceBundle → .qa/evidence/<tag>/
```

---

## Mode-name vocabulary (human-readable)

| Internal mode | Human-name shown in preview |
|---|---|
| `quick-check` | "quick check (dev iteration)" |
| `focused-review` | "focused review (PR / feature complete)" |
| `release-gate` | "release gate (full pre-release sweep)" |
| `incident-response` | "incident response (lifecycle_stage=incident)" |
| `deep-sweep` | "deep sweep (explicit audit)" |
| `chassis-lock-check` (UIUX) | "UIUX chassis lock check" |
| `style-mutex-audit` (UIUX) | "UIUX style mutex audit" |
| `focused-qa-gate` (QA) | "focused QA gate (PR-to-main)" |
| `release-readiness` (QA) | "QA release readiness" |
| `commercial-cert` (QA) | "QA commercial-cert (full)" |
| `focused-implementation` (GSD) | "GSD focused implementation" |
| `full-delivery` (GSD) | "GSD full delivery" |

---

## Node `type` vocabulary (human-readable)

| Internal type | Human-name shown | Diagram arrow |
|---|---|---|
| `single` | "serial" | `──►` |
| `fanout` (width N) | "parallel × N" | `═►` |
| `pipeline` (per-item × stages) | "pipeline × N items × M stages" | `══►` |
| `deterministic` | "deterministic (no agent — pure code)" | `[name]` |

---

## Model alias vocabulary (human-readable)

| Alias | Human-name shown | Current resolution |
|---|---|---|
| `inherit` | "current session model" | session model |
| `cheap_fast` | "cheap execution model" | haiku (current: Haiku 4.5) |
| `balanced` | "main model" | sonnet (current: Sonnet 4.6) |
| `strongest_available` | "strong verifier" | opus (current: Opus 4.8) |

> User sees the alias / human-name, NOT the technical model id. Switching from
> opus → opus-5 is a single config-line change, not a fleet rewrite.

---

## Approval Keywords (CAVEAT 9, whitelist only)

Exact match (case-insensitive, trimmed), no fuzzy match:

- English: `OK`, `okay`, `approve`, `approved`, `go`, `yes`, `proceed`, `ship it`, `LGTM`
- Chinese: `跑`, `批准`, `同意`, `继续`, `好`, `执行`

Any other reply (including `maybe`, `idk`, `..`, `?`, silence) = no approval → no launch.

---

## Sentinel file (after approval — workflow-spec mode only)

```
<project>/.<domain>/state/preview-approved/<safe-run_id>.json
```

Contents:
```json
{
  "run_id": "v3.2.1-pre-release",
  "spec_hash": "sha256:<64-hex canonical, per shared/spec-hash.js>",
  "preview_hash": "sha256:<64-hex over the rendered card text>",
  "approved_at": "<ISO8601 from Bash date>",
  "approval_text": "<exact user reply>",
  "ttl_seconds": 300
}
```

**TTL**: configurable via `.<domain>/config.json.preview_approval_ttl_seconds`;
hook clamps to `[30, 3600]` defensively.

> `preview_hash` is computed over the **rendered card text** (the block above).
> Upgrading this template to the card changes the rendered text → `preview_hash`
> changes, but `spec_hash` (computed over `spec`, not over the render) is
> **unchanged**, so the hook contract and all existing tests stay valid. The card
> is a richer *render* of the same gate, not a new gate.

---

## Hook validation logic (cross-domain identical — workflow-spec mode)

```
sentinel exists
&& sentinel.run_id == tool_input.args.run_id
&& sentinel.spec_hash == tool_input.args.spec_hash
&& sentinel.spec_hash == recompute_sha256(stableStringify(args.spec))  ← defends against approved-A-run-B (canonical sha256: per shared/spec-hash.js; appsec also accepts legacy djb2 during transition)
&& sentinel.approved_at parses as ISO8601
&& now_ms - approved_at_ms in [0, ttl_seconds*1000]                    ← no future skew, no expiry
&& spec.allow_dynamic_workflow !== true                                ← Governed Gate Mode (CLAUDE.md §3.7)
```

Any failure → `exit 2` + stderr explaining which check failed → Workflow tool blocks the launch.

---

## Technical appendix (the `<details>` block — debug preview)

```
Orchestrator:        {{orchestrator}}
Workflow base:       {{workflow_base_path}}
Spec preset:         {{preset_name}}{{overlay_chain}}
Spec hash:           {{spec_hash}}                          ← canonical sha256 (8-char display)
Spec validator:      ✓ ajv (or structural fallback)
Target:              {{target}}
Release tag:         {{release_tag}}
Run id:              {{run_id}}
Sentinel path:       {{sentinel_path}}

Capability gates:
  CLAUDE_CODE_WORKFLOWS:  {{value_or_unset}}
  DISABLE_TELEMETRY:      {{value_or_unset}}
  Platform compat:        {{platform_compat}}

Per-node fingerprints:
{{for each node}}  {{name}}  fp={{fingerprint}}  cached={{is_cached}}  cache_miss_reason={{reason|—}}
{{end}}

Per-node refs + ops:
{{for each node}}  {{name}}
    prompt_ref: {{prompt_ref|—}}
    schema_ref: {{schema_ref|—}}
    ops_allowed (this node): {{ops|—}}
    sdk: {{sdk.command|—}} --layer {{sdk.layer|—}}
{{end}}

Resume source detail: {{resume_source_path|none}}
                      → {{cached_count}} phases cached
                      → cache misses: {{cache_misses_list|none}}

Hooks that will fire:
{{for each hook}}  {{name}}  on {{event}}:{{matcher}}
{{end}}

Risks:
{{for each risk}}  - {{risk_text}}
{{end}}

Model mix: {{model_distribution}}
Wall-clock estimate: ~{{wallclock_estimate}}
```

---

## Why this template

- **Table + diagram, not walls of text**: the user explicitly asked to see, before
  execution, a table and a dots-and-lines diagram of which agents run, which tools
  each uses, and the flow. The card delivers exactly that; prose is minimized.
- **Tools column**: the previous template showed Type/Model/Agent/Job but never
  *which tools each agent uses and what each does* — added as a first-class column.
- **User-readable default**: a CFO / PM / owner should read this in 60 seconds and
  decide approve / modify / reject. Tech detail (spec_hash / fingerprints / gates)
  lives in `<details>`.
- **Works in the DEFAULT path**: this card is rendered in prompt-only / ad-hoc mode
  too (the 坎), not just workflow-spec — closing the gap where the default Windows
  path showed nothing.
- **Composes with spec_hash gates**: in workflow-spec mode the card is the render at
  the existing preview step; `spec_hash` + sentinel + hook are unchanged.
- **Alias not literal**: future model swaps (opus → opus-5) don't break wording.
- **Mode-name vocabulary**: every domain converges on the same word-shape so
  cross-domain experience is uniform.
