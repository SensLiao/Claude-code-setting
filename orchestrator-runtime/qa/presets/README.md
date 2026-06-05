# QA orchestrator presets

A **preset** is a workflow-spec template with degrees of freedom. The Skill
(`enterprise-qa-testing`) selects a preset family at runtime, instantiates a
spec from it (picks fanout widths within range, resolves model aliases, inlines
prompts/schemas), and submits to `~/.claude/workflows/qa-orchestrator.js`.

## Files in this directory

| File | Purpose |
|---|---|
| [`MODES.md`](MODES.md) | Mode catalog + selection algorithm + budget/enforcement matrix |
| `smoke.json` | Internal harness validation (no E2E, no pipeline) — for `tests/build-smoke-args.js` |
| `graph-smoke.json` | Internal coverage test exercising all 4 node types (single + fanout + pipeline + deterministic) |
| `quick-check.json` | User mode — dev iteration / PR-feature-branch (Static only) |
| `focused-qa-gate.json` | User mode — PR-to-main (Static + Unit/Component + Contract) |
| `release-readiness.json` | User mode — version cut / staging→prod (above + Integration + Critical E2E + Flaky governance) |
| `commercial-cert.json` | User mode — customer-facing / regulated (REQUIRES EXPLICIT BUDGET APPROVAL) |

## Preset shape

Each preset is a JSON object honoring `shared/orchestrator-spec.v1.json`:

```jsonc
{
  "engine_version": "1.0",
  "orchestrator": "qa",
  "domain_runtime_version": "qa-0.1.0",
  "preset_name": "<name>",
  "mode": "<mode>",
  "context": { "_skill_fills": [...] },  // Skill main thread fills risk_snapshot etc.
  "phases": [
    {
      "name": "<NodeName>",
      "type": "single | fanout | pipeline | deterministic",
      "model": "<alias>",            // cheap_fast | balanced | strongest_available | inherit
      "resolved_model": "<literal>", // Skill resolves alias->literal per shared/model-policy.md
      "agentType": "<frontmatter name:>",
      "prompt_ref": "<key into spec.prompts>",
      "schema_ref": "<key into spec.schemas>",
      "stall_ms": <number>,          // R8 per-node timeout
      "timeout_policy": "<label>",
      "post_invariants": ["<op>", ...]
    }
    // ... more phases
  ],
  "prompts": { "_skill_inlines": "..." },  // Skill reads prompts/*.md and inlines content keyed by prompt_ref
  "schemas": { "_skill_inlines": "..." },  // Skill reads schemas/*.json and inlines content keyed by schema_ref
  "ops_allowed": {
    "deterministic": ["<op>", ...],
    "predicates":    ["<op>", ...],
    "invariants":    ["<op>", ...]
  },
  "_estimate": {
    "token_estimate_low":  <number>,
    "token_estimate_high": <number>,
    "hard_budget_cap":     <number>,
    "wallclock_estimate_minutes": <number>,
    "evidence_layers": ["<path>", ...]
  }
}
```

## Composition rules (recap of blueprint §3)

1. **Preset is a template with degrees of freedom**, not a frozen script. Fanout `_width_range` and pipeline `_items_range` are dynamic except in `smoke`/`graph-smoke` where `_smoke_pin_width=2` / `_smoke_pin_items=1` is FIXED per ORCHESTRATION-MIGRATION-PLAN.md §1.11 #14.
2. **Skill picks agent counts within range** based on `risk_snapshot` + changed-surface count.
3. **Every agent node carries `model_alias` AND `resolved_model`** (R4 + §1.11 #2). Workflow body uses `resolved_model` directly; never re-reads `model-policy.md`.
4. **Every agent node has `prompt_ref` + `schema_ref`** referencing files under `prompts/` / `schemas/`. Skill inlines content at launch.
5. **Each preset declares `ops_allowed`** — workflow body refuses any op not in the union of three lists.
6. **Per-node `stall_ms` + `timeout_policy`** declared per R8. Defaults: classification 180s; static/component 600s (10 min); E2E/Visual/Perf 900s (15 min); A11y 300s; EvidenceBundle 300s.
7. **Reviewer R4 architectural** — `RiskClassify` is NOT a Workflow node. Skill main thread invokes `qa-risk-classifier` via Agent tool BEFORE preview; `risk_snapshot` is passed in via `spec.context`.
8. **Reviewer R7 architectural** — every fanout/pipeline node MUST list `map_null_outputs_to_missing` in its tail `post_invariants` (or rely on EvidenceBundle's tail invariant). Null/dropped/timed-out items map to `dispatch_failures[]` with `decision: MISSING`. Gate counts MISSING toward BLOCK.
9. **Reviewer R9 architectural** — for commercial-cert: Visual / A11y / Perf use `<Layer>Audit (agent) → <Layer>Gate (deterministic)` pattern. Deterministic gates apply thresholds; agents run the external tools.

## Versioning

- `engine_version: "1.0"` — matches `shared/orchestrator-spec.v1.json`
- `domain_runtime_version: "qa-0.1.0"` — matches `registry.json`. Bump when QA preset/registry shape changes incompatibly.
- See `STATUS.md` (B.4 closeout) for shipped version triplet history.

## Tests

| Test | What it proves |
|---|---|
| `tests/validate-all-presets.sh` | Every preset honors `orchestrator-spec.v1.json` structure |
| `tests/lint-schemas.sh` | Every schema declares draft-07 (no draft-2020-12 regression) |
| `tests/preflight-check.sh` | Every `agentType` resolves; every required hook installed for mode; SDK reachable; model aliases known |
| `tests/workflow-lint.sh` (R14 NEW) | `qa-orchestrator.js` body has no `import`/`require`/`fs`/`Bash`/`process`/`Date.now`/`Math.random`/`new Date(`/`child_process` |
| `tests/build-graph-smoke-args.js` | Predictable args builder for `Workflow({scriptPath, args})` smoke launch |
| `tests/predict-resume-cache.js` | Same-session predictor cache-hit verification |
| `tests/hook-mock-test.sh` | `qa-preview-gate.js` block/allow scenarios incl. R11 running-sentinel mock |
