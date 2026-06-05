# Execution Preview Template — User-facing default (Patch A.2)

> Rendered by the domain Skill (AppSec / QA / UIUX / GSD) BEFORE any
> `Workflow({name: '<domain>-orchestrator'})` launch. The preview is a HARD
> GATE — no explicit user approval, no launch. Enforced via
> `<domain>-preview-gate.js` hook.
>
> **Design**: The default template reads like a project plan, not a debug dump.
> Technical fields (spec_hash, prompt_ref, schema_ref, sentinel path, fingerprint
> tables) are hidden behind `<details>` and only shown if the user asks.

---

## Default user-facing template

```
══════════════════════════════════════════════════════════════════
{{Domain}} Workflow — Execution Preview
══════════════════════════════════════════════════════════════════

Mode:           {{mode_human_name}}
Why this shape: {{shape_justification}}                   ← 2-3 sentences: what was detected, what was skipped, why this mode picked

Workflow ({{phase_count}} steps; {{exec_count}} will execute, {{cached_count}} from cache):
─────────────────────────────────────────────────────────────────
{{for each phase}}
{{i}}. {{name}}
     Type:    {{type_human}}                              ← "serial" / "parallel × N" / "pipeline × N" / "deterministic"
     Model:   {{model_alias_human}}                        ← "current session model" / "cheap execution model" / "main model" / "strong verifier"
     Agent:   {{agentType|—}}
     Job:     {{job_description_one_line}}
{{end}}
─────────────────────────────────────────────────────────────────

Budget
  Estimated:   {{token_estimate_low}}k – {{token_estimate_high}}k tokens
  Hard cap:    {{hard_budget_cap}}k tokens
  Abort rule:  if estimated upper bound exceeds hard cap, do NOT launch — narrow the spec.

Evidence outputs:
{{for each layer}}  - {{path}}
{{end}}

Resume:        {{resume_source_description}}              ← "fresh start" / "continuing from <snapshot>; N cached phases"

Preflight:     {{preflight_summary_line}}                 ← e.g. "✓ 4 agents, 1 hook, 1 SDK, 4 aliases resolved"

Approve to proceed? Reply: OK / approve / 跑 / 批准 / 同意 / 继续 / 好 / 执行
══════════════════════════════════════════════════════════════════

<details>
<summary>Show technical details (debug preview)</summary>

Orchestrator:        {{orchestrator}}
Workflow base:       {{workflow_base_path}}
Spec preset:         {{preset_name}}{{overlay_chain}}
Spec hash:           {{spec_hash}}                          ← djb2 hex, 8 chars
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

</details>
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

| Internal type | Human-name shown |
|---|---|
| `single` | "serial" |
| `fanout` (width N) | "parallel × N" |
| `pipeline` (per-item × stages) | "pipeline × N items × M stages" |
| `deterministic` | "deterministic (no agent — pure code)" |

---

## Model alias vocabulary (human-readable)

| Alias | Human-name shown | Current resolution |
|---|---|---|
| `inherit` | "current session model" | session model |
| `cheap_fast` | "cheap execution model" | haiku (current: Haiku 4.5) |
| `balanced` | "main model" | sonnet (current: Sonnet 4.6) |
| `strongest_available` | "strong verifier" | opus (current: Opus 4.8) |

> User sees the alias, NOT the technical model name. Switching from
> opus → opus-5 is a single config-line change, not a fleet rewrite.

---

## Approval Keywords (CAVEAT 9, whitelist only)

Exact match (case-insensitive, trimmed), no fuzzy match:

- English: `OK`, `okay`, `approve`, `approved`, `go`, `yes`, `proceed`, `ship it`, `LGTM`
- Chinese: `跑`, `批准`, `同意`, `继续`, `好`, `执行`

Any other reply (including `maybe`, `idk`, `..`, `?`, silence) = no approval → no launch.

---

## Sentinel file (after approval)

```
<project>/.<domain>/state/preview-approved/<safe-run_id>.json
```

Contents:
```json
{
  "run_id": "v3.2.1-pre-release",
  "spec_hash": "sha256:<64-hex canonical, per shared/spec-hash.js>",
  "preview_hash": "sha256:<64-hex>",
  "approved_at": "<ISO8601 from Bash date>",
  "approval_text": "<exact user reply>",
  "ttl_seconds": 300
}
```

**TTL**: configurable via `.<domain>/config.json.preview_approval_ttl_seconds`;
hook clamps to `[30, 3600]` defensively.

---

## Hook validation logic (cross-domain identical)

```
sentinel exists
&& sentinel.run_id == tool_input.args.run_id
&& sentinel.spec_hash == tool_input.args.spec_hash
&& sentinel.spec_hash == recompute_sha256(stableStringify(args.spec))  ← defends against approved-A-run-B (canonical sha256: per shared/spec-hash.js; appsec also accepts legacy djb2 during transition)
&& sentinel.approved_at parses as ISO8601
&& now_ms - approved_at_ms in [0, ttl_seconds*1000]                    ← no future skew, no expiry
```

Any failure → `exit 2` + stderr explaining which check failed → Workflow tool blocks the launch.

---

## Why this template

- **User-readable default**: a CFO / PM should be able to read this in 60 seconds and decide approve / reject.
- **Debug hidden by default**: spec_hash / fingerprints / capability gate values matter when something is wrong, not for happy-path approval.
- **Preflight summary line**: 1 line confirming all capability gates passed before any token is spent. Failure surfaces structured "Cannot launch" with the gap list, not this preview.
- **Alias not literal**: future model swaps (opus → opus-5) don't break the preview wording.
- **Mode-name vocabulary**: every domain converges on the same word-shape so cross-domain experience is uniform.
