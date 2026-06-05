# Orchestrator Spec — Node Type Vocabulary v1

> Shared by AppSec / QA / UIUX / GSD orchestrator workflow bases. Each domain workflow base interprets these node types and dispatches to its domain-specific OPS / agents.

## 4 Node Types

### `single`
One agent call. Required fields: `name`, `type`, `prompt_ref`, `schema_ref`, `agentType`. Optional: `model`, `isolation`, `sdk`, `skip_if`, `skip_default`, `post_invariants`.

### `fanout`
Parallel agent calls — one per item resolved from `items_from`. Required fields: `name`, `type`, `items_from`, `prompt_ref`, `schema_ref`, `agentType`. Output is array (filtered via `.filter(Boolean)` per workflow-creator gotcha).

### `pipeline`
Per-item multi-stage execution. Each item flows through all stages independently — no barrier between stages. Required: `name`, `type`, `items_from`, `stages`. Each stage is either `fanout` (with optional `vote_count_by_severity` for AppSec verify) or `single`.

### `deterministic`
Pure-JS op invocation. No agent, no model token cost. Required: `name`, `type`, `op`. The op must be in domain workflow base's `DETERMINISTIC_OPS` registry AND in `spec.ops_allowed.deterministic` whitelist.

## Skip + Invariant Cross-Cutting

- `skip_if`: predicate op name from `PREDICATE_OPS` registry. If returns true, phase output = `skip_default` and agents are not invoked.
- `post_invariants`: array of invariant op names from `INVARIANT_OPS` registry. Applied after main dispatch; each mutates the phase output deterministically.

## SDK Hint (overview §3)

Optional `sdk: { command, layer }` field. **Workflow body does NOT execute the SDK.** The hint is rendered into the agent's prompt context so the agent can invoke SDK via Bash. Hooks and permissions guard the actual Bash call.

## Resume Semantics (CAVEAT 4)

Each cached phase output carries a `node_fingerprint` SHA / djb2 hash derived from:

```
name + type + model + agentType + prompt_ref + prompt body +
schema_ref + schema body + op + params + items_from + stages +
isolation + engine_version + orchestrator
```

Cache hit only if fingerprint matches exactly. Otherwise cache miss with explicit reason.

## Path Expressions (`items_from`)

Restricted to **dot chain only** starting with `state.` or `ctx.`. No JS expressions, no method calls, no bracket access. Examples:

- `state.Plan.selected_finders` ✓
- `state.Dedup.eligible_clusters` ✓
- `ctx.finders` ✓
- `state.Plan.selected_finders.map(...)` ✗
- `state['Plan']` ✗

## Determinism Bans (workflow-creator)

Inside workflow body:
- No `Date.now()` / `Math.random()` / argless `new Date()`
- No `import` / `require` / `fs` / `process`
- No Bash, no network

Templates rendered via strict literal substitution `{{ state.X.Y }}`. Missing variable = hard fail (CAVEAT 6).
