# Native Platform Capabilities — single source of truth

> **Purpose**: the ONE place to record what Claude / Claude Code natively provides, so the
> harness can decide each release what to *consume* vs *shed* (Standing Adaptation Principle,
> `~/Desktop/architecture/NATIVE-OVERLAP-AUDIT-2026.05.29.md §8`). On every Claude Code update: edit THIS file, not docs scattered across CLAUDE.md / SKILLS-INDEX / rules.
>
> **Last verified**: 2026-06-10 (prior: 2026-05-29) · **Verifier**: Opus 4.8 (1M) session · **Source basis**: official Claude Code / Claude API docs cited inline + 2026-05-29 user-supplied research synthesis (`~/Desktop/architecture/NATIVE-OVERLAP-AUDIT-2026.05.29.md`) + 2026-06-10 session-confirmed tool availability (see "Session-confirmed natives (2026-06-10)" below).
>
> **Confidence legend**: `[session-confirmed]` = observed directly in this session's environment; `[doc-cited]` = from the cited official doc as of last-verified date, re-verify on update.
>
> **Sibling**: [`provider-portability.md`](provider-portability.md) — 换模型（含非-Claude / 中国模型）可移植性：哪些是 Claude-Code-绑定 vs 模型-绑定、网关接法、能力降级表、补充改造清单。本文件里标 `[doc-cited]` 的 Claude 专属能力，换 provider 后大多失效——降级处理见 sibling §3。

---

## Machine-readable snapshot

```json
{
  "claude_code_min_version_for_dynamic_workflows": "2.1.154",
  "dynamic_workflows": {
    "available": true,
    "research_preview": true,
    "plans": ["all paid plans", "Anthropic API", "Amazon Bedrock", "Google Vertex AI", "Microsoft Foundry"],
    "pro_requires_config_enable": true,
    "governance_use": "exploration | migration | research ONLY — never a release-gate verdict executor"
  },
  "ultracode": {
    "is": "xhigh effort + automatic Dynamic Workflow orchestration (Claude Code setting, not a plain effort level)",
    "governed_gate_use": "DISABLED for verdict path — scout only (CLAUDE.md §3.7)"
  },
  "effort_levels": ["low", "medium", "high", "xhigh", "max"],
  "effort_default_opus_4_8": "high",
  "fast_mode": {
    "same_model_weights": true,
    "purpose": "speed (up to ~2.5x output), premium priced",
    "not_a_smarter_model": true,
    "shares_prompt_cache_with_standard": false,
    "models": ["claude-opus-4-8", "claude-opus-4-7"]
  },
  "thinking": {
    "opus_4_8_and_4_7": "adaptive only",
    "manual_budget_tokens": "rejected on Opus 4.8/4.7"
  },
  "prompt_cache_min_tokens": { "opus-4-8": 1024, "opus-4-7": 4096, "opus-4-6": 4096 },
  "mid_conversation_system_messages": {
    "claude_api": true,
    "claude_platform_on_aws": true,
    "bedrock": false,
    "vertex": false,
    "foundry": false,
    "is_security_boundary": false
  },
  "model_aliases": ["opus", "sonnet", "haiku", "opus[1m]", "sonnet[1m]"],
  "model_ids_current": { "opus": "claude-opus-4-8", "sonnet": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5-20251001" },
  "workflow_tool": {
    "predates_4_8": true,
    "primitives": ["agent", "parallel", "pipeline", "phase", "log", "budget"],
    "named_and_scriptPath": true,
    "args_passthrough": true,
    "resume": "resumeFromRunId — SAME-SESSION only"
  }
}
```

---

## Notes per capability (consume vs shed)

### Dynamic Workflows `[doc-cited]`
Model writes the workflow JS at request time, fans out dozens–hundreds of subagents. **New in 4.8 (research preview).** Needs Claude Code **2.1.154+**; on all paid plans / Anthropic API / Bedrock / Vertex / Foundry; **Pro must enable in `/config`** (Dynamic workflows row).
- ✅ Consume for: exploration, codebase-scale audits/migrations, deep research, adversarial cross-checks.
- ⛔ NEVER for governed gate verdicts — non-deterministic, no `spec_hash`, can't be pre-approved by hash. See **CLAUDE.md §3.7 Governed Gate Mode**. CLI approval weakens under Auto/ultracode/`-p`/SDK — do not rely on it as human sign-off.
- Permission knobs: `CLAUDE_CODE_DISABLE_WORKFLOWS=1` env, or project settings `"disableWorkflows": true`. `[doc-cited]`

### ultracode `[session-confirmed]`
`/effort` confirms ultracode = "xhigh + dynamic workflow orchestration". Standing opt-in to author/run workflows by default. **Disabled for governed-gate verdict path** (scout only).

### Effort `[session-confirmed via /effort]` / `[doc-cited for level set]`
Levels: low / medium / high / xhigh / max. Opus 4.8 default **high**; `/effort xhigh` for hardest tasks; `max` only when justified (can over-think). Captured per-spec in `_execution_profile.effort` for audit — **NOT** a native `agent()` parameter as of 2.1.154 (do not pass per-agent).

### Fast mode `[session-confirmed]`
"Claude Opus with faster output (does not downgrade to a smaller model)", toggle `/fast`, on Opus 4.8/4.7. Same weights, premium price, faster. **Orthogonal to model tier** — never route a gate verdict node to fast by default; fast/standard don't share prompt cache (cache-miss cost in repeated gate runs).

### Thinking `[doc-cited]`
Opus 4.8/4.7 support **adaptive thinking only**; manual `budget_tokens` is rejected. Old MAX_THINKING_TOKENS / manual-budget logic is dead for these models — `_execution_profile.thinking` records `adaptive` for audit.

### Prompt caching `[doc-cited]`
Opus 4.8 min cacheable length **1024 tokens** (down from 4096 on 4.6/4.7). Cache aggressively the STABLE governance substrate (schemas, agent contracts, ASVS/CSF/QA floor rules). Do NOT cache (i.e. keep dynamic in the hash): per-run spec, approval sentinel, ROE, budget cap.

### Mid-conversation system messages `[doc-cited]`
Append system-level instructions mid-session without breaking the prompt-cache prefix. Available on **Claude API + Claude Platform on AWS**; NOT on Bedrock / Vertex / Foundry. **Explicitly NOT a security boundary** — fine for env/budget/policy refresh in a long-running API harness; must NOT replace hooks / spec_hash approval / redaction / ROE / pentest authorization.

### Model routing / aliases `[session-confirmed + doc-cited]`
Use unversioned tier aliases (`opus`/`sonnet`/`haiku`, `[1m]` variants) in policy docs — aliases track provider-recommended versions. Current ids: Opus 4.8 `claude-opus-4-8`, Sonnet 4.6 `claude-sonnet-4-6`, Haiku 4.5 `claude-haiku-4-5-20251001`. For an **auditable governed run**, resolve the alias to a concrete id at approval time and record it in `_execution_profile.resolved_model_at_approval` (does NOT change preset `resolved_model`, which stays test-capped per the dual-layer rule).

### Workflow tool / Subagents / Agent Teams / Hooks / Memory `[doc-cited, predate 4.8]`
The底座 the spec-injection meta-runners stand on. Consume; never rebuild fan-out scheduling, subagent lifecycle, run journaling, or same-session resume. `resumeFromRunId` is **same-session only** — cross-session continuity (`previous_results` / `phase_outputs_fingerprinted`) is the harness's own value, keep it.

---

## The three-layer boundary (where the line sits, post-4.8)

```
Layer 1 — Native substrate (consume, never rebuild):
  Workflow / Dynamic Workflows / Subagents / Agent Teams / Hooks / Memory / model aliases / effort / fast mode

Layer 2 — Thin adapters (wrap, delete as platform absorbs):
  spec runner, resolved_model injection, native-resume bridge, cache policy, command artifacts, capability detection

Layer 3 — Governance moat (own, strengthen every release):
  spec_hash approval, redaction, ROE, ASVS/CSF, QA floor rules, UIUX L3 mutex, evidence schema, release verdict, Governed Gate Mode
```

> Mechanism belongs to the platform — consume it, never rebuild it. Governance & domain discipline belong to us — own it, strengthen it. The boundary moves toward the platform each release; shed exactly that much, no more.

---

## Session-confirmed natives (2026-06-10)

> Tools/capabilities **observed directly available in this session's environment** on 2026-06-10. Each is `[session-confirmed 2026-06-10]`. Names + one-line purpose only — **parameter details are intentionally not transcribed here** (consult the live tool schema / official docs at use time; do not infer args from this list). These confirm the platform now natively covers a large slice of fan-out / scheduling / isolation / messaging that the harness must NOT rebuild (Layer-1 substrate per the three-layer boundary above). Governance moat (Layer 3) is unchanged: none of these may issue a release-gate verdict or replace `spec_hash` approval / redaction / ROE.

### Agent Teams `[session-confirmed 2026-06-10]`
- `TeamCreate` — create a named multi-agent team.
- `TeamDelete` — tear down a team.
- Consume for: durable multi-agent collaboration. Never rebuild team lifecycle.

### Tasks (background/async agent work) `[session-confirmed 2026-06-10]`
- `TaskCreate` — spawn a tracked task / background agent.
- `TaskUpdate` — update task status/fields.
- `TaskList` — enumerate tasks.
- `TaskGet` — fetch a single task.
- `TaskOutput` — read a task's output.
- (`TaskStop` also present in the deferred-tool set.)
- Consume for: durable task tracking + background execution. The harness keeps its own evidence/spec semantics; it does NOT need a parallel task store.

### Cron / scheduled agents `[session-confirmed 2026-06-10]`
- `CronCreate` — register a cron-scheduled agent (routine).
- `CronList` — list scheduled routines.
- `CronDelete` — remove a routine.
- Consume for: recurring/scheduled runs. Do not hand-roll a scheduler.

### Worktree isolation `[session-confirmed 2026-06-10]`
- `EnterWorktree` / `ExitWorktree` — run inside an isolated git worktree.
- Agent `isolation: "worktree"` — per-agent worktree isolation for parallel write-safety.
- Consume for: write-conflict-free parallel agents (the Universal Execution Discipline parallel-vs-serial rule). Strong fit for fan-out that touches files.

### Monitoring & messaging `[session-confirmed 2026-06-10]`
- `Monitor` — wait-on-condition / watch loop (replaces foreground `sleep` polling).
- `PushNotification` — push a notification to the user.
- `SendUserFile` — deliver a file to the user.
- `SendMessage` — message an already-spawned agent (continue a thread).
- Consume for: long-running orchestration ergonomics. Not a security boundary; not a verdict channel.

### Tool discovery / deferred tools `[session-confirmed 2026-06-10]`
- `ToolSearch` + deferred-tool mechanism — large tool catalogs are deferred by name; fetch schemas on demand before calling.
- Consume for: keeping context lean when many MCP/native tools exist.

### Workflow journal resume `[session-confirmed 2026-06-10]`
- `Workflow` `resumeFromRunId` — resume a workflow run from its journal (cache-backed). Confirms the same-session resume note above; cross-session continuity (`previous_results` / fingerprinted phase outputs) remains the harness's own value.

### Plugin CLI `[session-confirmed 2026-06-10]`
- `claude plugin marketplace add` / `claude plugin install` / `list` / `uninstall` / `update` — manage marketplace plugins from CLI. This is how `codex@openai-codex` (replacement for the deleted `codex-dispatch` skill) is managed.

> **Governance reminder**: Teams / Tasks / Cron / Worktree / Monitor / messaging are all **Layer-1 mechanism** — consume, never rebuild. They do NOT weaken Governed Gate Mode (CLAUDE.md §3.7): a scheduled or backgrounded agent still cannot self-approve a release verdict, exempt redaction, or authorize its own pentest.
