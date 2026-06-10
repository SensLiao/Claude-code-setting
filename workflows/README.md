# Saved Workflows — governance review gate

> **Governed Gate Mode (CLAUDE.md §3.7, post-4.8).** Saved workflow scripts under
> `~/.claude/workflows/` are reusable, team-shareable, and can be launched by `name`.
> That convenience is also a risk: a saved Dynamic Workflow could be wired to produce
> a release verdict without `spec_hash` approval. This README defines the review gate.

## The rule

A saved workflow may **drive a release/security gate verdict** ONLY if it is a
**deterministic spec-runner** that walks a human-authored, `spec_hash`-approved spec
(currently: `appsec-orchestrator.js`, `qa-orchestrator.js`). Every other saved workflow
is **scout/exploration/migration only** and must NOT produce a gate verdict — route its
findings back through the deterministic runner + `spec_hash` approval + evidence bundle.

## Governance header convention (every new saved workflow)

Add this comment block at the top of the file (above `export const meta`). It is a
comment, so it never interferes with the Workflow tool's `meta` parsing:

```js
/* @governance
 *   reviewed_by:            <human name | "unreviewed">
 *   reviewed_at:            <YYYY-MM-DD | "">
 *   allowed_scope:          exploration | migration | research | governed-gate
 *   release_gate_allowed:   false        # true ONLY for reviewed deterministic spec-runners
 *   destructive_ops_allowed: false
 */
```

- `release_gate_allowed: true` requires `reviewed_by` = a human + `allowed_scope: governed-gate`.
- An unreviewed / `release_gate_allowed: false` workflow that tries to emit a gate verdict
  is a governance violation. The `governed-gate-workflow-guard` hook enforces this two ways
  during an ACTIVE gate: (a) it blocks inline model-authored Dynamic Workflows (no name/scriptPath),
  and (b) it blocks a saved workflow launched by `name`/`scriptPath` whose `@governance` header does
  NOT declare `release_gate_allowed: true` (read directly from the resolved file). Gate verdicts only
  come from `appsec-sdk gate.check` / `qa-sdk gate.check` over the evidence bundle.

## Current inventory (2026-06-10)

| Workflow | scope | release_gate_allowed | notes |
|---|---|---|---|
| `appsec-orchestrator.js` | governed-gate | **true** | Deterministic AppSec spec-runner. Reviewed + runtime-proven (P0). Verdict path. Walks approved spec; never authors Dynamic Workflows. Carries the `@governance` header. |
| `qa-orchestrator.js` | governed-gate | **true** | Deterministic QA spec-runner. Reviewed + B.2/B.3 proven. Verdict path. Walks approved spec. Carries the `@governance` header. |
| `hello-test.js` | exploration | **false** | Demo / smoke-test workflow. Never a gate verdict. No `@governance` header → the guard blocks it by name/scriptPath during an active gate. |

> `appsec-full-sweep.js` (legacy, gate-shaped but never preview-gated) was **deleted 2026-06-10** — the
> canonical gate executor is `appsec-orchestrator.js`. Any release verdict goes through `appsec-sdk gate.check`.

> When adding a workflow: include the `@governance` header, default `release_gate_allowed: false`,
> and only flip to `true` after human review confirms it is a deterministic, spec_hash-bound runner.
