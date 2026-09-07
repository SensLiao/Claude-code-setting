# Execution Preview Template — PLAN-PREVIEW CARD (表 + 流程图)

> Single source of truth for the card required by `CLAUDE.global.md` §0.6 and
> `rules/common/task-execution-protocol.md` Step 5. Rendered BEFORE execution by
> any multi-agent / Workflow / large-generation dispatch. It shows, as a
> **TABLE + dots-and-lines DIAGRAM**: WHAT will run, WHO does it (agent · model ·
> the tools it uses + what each tool does), and the data FLOW.
>
> **Instruction-layer only.** The card is the 坎: render → wait for confirm → run.
> There is no approval sentinel, no hash gate and no enforcement hook — the
> orchestrator line that owned those was removed 2026-08-25, and the hash-based
> remnants 2026-09-07. Two dormant hooks exist on disk but are NOT wired:
> `plan-card-reminder.js` (would soft-remind on an uncarded fan-out) and
> `report-gate.js`. Wiring state is `manifests/hook-registry.json`, never memory.
>
> **Design (`CLAUDE.global.md` §0.5 reporting style)**: business value first
> (目标 / 能力 / 做完得到 / 成本); agents · tools · flow readable at a glance;
> anything technical demoted to `<details>` and shown only on request.

---

## Default user-facing card (this is what the user sees before execution)

```
╔══════════════════════════════════════════════════════════════════════╗
║  执行计划预览 · PLAN PREVIEW — {{task_name}}
╚══════════════════════════════════════════════════════════════════════╝

🎯 目标:          {{goal_one_line}}
🧩 用到的能力:    {{capabilities_csv}}        ← 例: 风险分类 · 并行 fan-out · 落盘产物
✅ 做完你会得到:  {{outcome_one_line}}        ← 业务语言, 不是 schema 名
📦 规模 / 成本:   {{phase_count}} 步 · {{agent_count}} agent · ~{{tok_low}}k–{{tok_high}}k tokens · ~{{wallclock}} · {{model_mix}}
🚦 复杂度档:      {{tier}}   (简单 = 跳过本卡 / 中等 = 出表 / 复杂 = 表 + 图 + 成本)
🤔 为什么这个形状: {{shape_justification}}     ← 检测到什么 / 跳过了什么 / 为何这么排

── Agents 调度 ─────────────────────────────────────────────────────────
| # | 阶段 / Agent            | 模型        | 干什么 (一句话)            | 用的工具 = 作用                       |
|---|------------------------|-------------|---------------------------|--------------------------------------|
{{for each phase}}
| {{i}} | {{name}}{{ × N}}    | {{model}}   | {{job}}{{ (parallel)}}    | {{tool}}={{what}}; {{tool2}}={{what2}} |
{{end}}

── 流程 / 结构图 (dots & lines) ────────────────────────────────────────
{{ascii_flow_diagram}}

   图例:  ──► 串行   ═►parallel×N   ◇ gate/判定   ⟳ loop   [det] 纯代码无 agent   ? = 可跳过

── 产物 ────────────────────────────────────────────────────────────────
{{for each artifact path}}  - {{path}}
{{end}}
────────────────────────────────────────────────────────────────────────
确认执行?   回复  OK / 批准 / 跑 / 继续 / 同意 / 好 / 执行
            改:  说哪一步要改        停:  cancel / 取消
<details><summary>展开技术细节 (per-agent refs / hooks / risks)</summary>
{{technical_appendix — see "Technical appendix" block below}}
</details>
```

**The card has exactly the four things the user asked to always see:**
1. **A table** (`Agents 调度`) — `# · 阶段/Agent · 模型 · 干什么 · 用的工具=作用`. The
   **tools column** is mandatory.
2. **A dots-and-lines diagram** (`流程/结构图`) — the flow/structure, with a legend
   encoding serial / parallel / gate / loop / deterministic / skippable.
3. **Business-value top lines** (目标 / 能力 / 做完得到 / 成本) per §0.5.
4. **A confirmation 坎** — explicit approve / modify / cancel.

---

## ASCII flow diagram — generation rules

Walk the planned agent list IN ORDER and emit `{{ascii_flow_diagram}}`:

1. **serial single node** → `Name` on a horizontal chain, joined by `──►`.
2. **fanout node** → `Name × N` (N = planned width), arrow `═►`.
3. **pipeline node** → `Name × M items (P stages)`.
4. **code-only step** → `[Name: op_name]` (brackets = no agent).
5. **conditional node** → append `?` and a `(skip if <cond>)` note.
6. **gate / decision node** → mark with `◇`; show the ✗→stop / ✓→continue branch.
7. Long chains: break line + indent for readability; keep arrows.

**Worked example — a multi-file refactor:**
```
   Scope ──► Plan
     │
     ═► Review × 3            (parallel, one per dimension)
         └─► Dedup?           (skip if no_findings)
              └─► ◇ [Verify]  (each finding independently refuted or confirmed)
                    │ ✗→ 停下报告,不改代码
                    ▼ ✓
                  Apply ──► Test ──► Commit
```

---

## Step-shape vocabulary (human-readable)

| Shape | Human-name shown | Diagram arrow |
|---|---|---|
| serial | "serial" | `──►` |
| fanout (width N) | "parallel × N" | `═►` |
| pipeline (per-item × stages) | "pipeline × N items × M stages" | `══►` |
| code-only | "deterministic (no agent — pure code)" | `[name]` |

---

## Model column

Use the three global aliases — `opus` (决策层) / `sonnet` (执行层) / `haiku` (工具层)
— per `CLAUDE.global.md` §3 and `rules/common/performance.md`. Every spawn must
name one **explicitly**; the card shows the alias, not a versioned model id, so a
platform model swap does not invalidate the wording.

---

## Approval Keywords (whitelist only)

Exact match (case-insensitive, trimmed), no fuzzy match:

- English: `OK`, `okay`, `approve`, `approved`, `go`, `yes`, `proceed`, `ship it`, `LGTM`
- Chinese: `跑`, `批准`, `同意`, `继续`, `好`, `执行`

Any other reply (including `maybe`, `idk`, `..`, `?`, silence) = no approval → no launch.

---

## Technical appendix (the `<details>` block — debug preview)

```
Task:                {{task_name}}
Target:              {{target}}
Working set:         {{files_or_dirs}}

Per-agent refs + ops:
{{for each agent}}  {{name}}
    model:      {{model}}
    tools:      {{tools}}
    writes:     {{files_it_may_write|—}}   ← 多 agent 不得写同一文件
{{end}}

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
- **Tools column**: showing Type/Model/Agent/Job but not *which tools each agent
  uses and what each does* is the gap this column closes.
- **User-readable default**: a CFO / PM / owner should read this in 60 seconds and
  decide approve / modify / reject. Tech detail lives in `<details>`.
- **Alias not literal**: future model swaps don't break wording.
