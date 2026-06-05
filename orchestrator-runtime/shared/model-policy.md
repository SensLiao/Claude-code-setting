# Model Policy — alias-based (Patch A.4, 2026-05-28)

> Cross-orchestrator. Continues the global policy in `~/.claude/CLAUDE.md` §4.5
> and `~/.claude/rules/common/performance.md`. Per-node `model` field overrides
> default; missing field = `inherit` from session.
>
> **Design (v2)**: Specs MUST NOT hardcode `haiku` / `sonnet` / `opus`. They use
> **aliases** that resolve at runtime via this file or per-project override.
> Switching from Opus 4.8 → Opus 5 is then a 1-line config change, not a fleet
> rewrite.
>
> **Definition (governed workflow)**: 模板是静态的，运行是参数化的，选择是动态的 —
> a governed workflow is a *frozen, hashable orchestration contract*, NOT a free
> dynamic base the model rewrites. Dynamic happens ONLY in a controlled injection
> layer (project context / fanout width / model-alias resolution). Tier rules and
> the allowed-vs-forbidden-dynamic whitelist are in **Policy A** below.
>
> **Non-Claude / 中国模型 provider**: switching the underlying provider (not just the
> Claude version) is covered in [`~/.claude/docs/provider-portability.md`](../../docs/provider-portability.md)
> — gateway接法 (P4), the `model` regex relax + provider-profile (P1/P2), capability
> degradation. Minimal path = gateway alias-mapping, no schema change.

---

## Aliases

| Alias | Current resolution | When to use |
|---|---|---|
| `cheap_fast` | `haiku` (current: Haiku 4.5) | high-volume simulation, format transforms, classification, per-finder Find phase, taxonomy Map, structured Normalize |
| `balanced` | `sonnet` (current: Sonnet 4.6) | day-to-day execution, mid-complexity Synthesize, Verify high/critical votes |
| `strongest_available` | `opus` (current: Opus 4.8) | final decisions, security review, architecture, Scope / Plan in release-gate or incident-response modes |

> Resolution returns the **bare unversioned tier** (`haiku`/`sonnet`/`opus`); the concrete version is platform-decided. Current ids + effort/fast/cache facts: [`~/.claude/docs/native-capabilities.md`](../../docs/native-capabilities.md).
| `inherit` | session model | when Skill judges the session model is the right pick (rare; explicit) |

---

## Resolution

At workflow body entry, each `node.model` field is one of:
- An alias from the table above (preferred — what migrated presets use)
- A literal model name (legacy / deprecated — accept but A.4 migration replaces all)
- Missing / null → defaults to `inherit`

Resolution algorithm (workflow body, before each `agent({...})` call):

```js
function resolveModel(specModel, overrides) {
  // Per-project override wins (checked with `in` not truthy — supports null override values)
  if (overrides && typeof overrides === 'object' && specModel in overrides) {
    return overrides[specModel];
  }
  switch (specModel) {
    case 'cheap_fast':            return 'haiku';
    case 'balanced':              return 'sonnet';
    case 'strongest_available':   return 'opus';
    case 'inherit':
    case null:
    case undefined:               return 'inherit';   // string passthrough — agent({model:'inherit'}) lets workflow tool inherit session
    default:                      return specModel;   // legacy literal (haiku/sonnet/opus/haiku-4.5/...) — pass through unchanged
  }
}
```

---

## Per-project override

`.appsec/config.json` (or `.qa/config.json` / `.uiux/config.json` / `.gsd/config.json`):

```json
{
  "model_policy_overrides": {
    "cheap_fast": "haiku-4.5",
    "balanced":   "sonnet-5.0",
    "strongest_available": "opus-5.0"
  }
}
```

Override is read by the Skill at bootstrap and passed to workflow body via
`args.model_policy`. Workflow body resolves via `resolveModel(node.model, args.model_policy)`.

**Cross-review Item F2 note (2026-05-28)**: The doc previously claimed `inherit` →
`null`. Actual implementation (workflow body + predictor + unit tests) returns
the STRING `'inherit'` so the Workflow tool's `agent({model: 'inherit'})` accepts
it as a passthrough alias. The doc is now corrected to match implementation.

---

## Cache invariance

`hashNode` MUST include the **resolved model name**, not the alias. So:

- alias `cheap_fast` → resolves to `haiku-4.5` → fingerprint includes `"haiku-4.5"`
- alias `cheap_fast` → resolves to `haiku-5.0` (after override) → fingerprint includes `"haiku-5.0"`

Switching the alias mapping is therefore an **intentional cache invalidation**:
the resume cache rightly misses because the executed configuration changed.

---

## Preview shows the alias (not the literal)

The user-facing preview (see `shared/preview-template.md`) shows the human-name
of the alias:

| Alias | Preview shows |
|---|---|
| `cheap_fast` | "cheap execution model" |
| `balanced` | "main model" |
| `strongest_available` | "strong verifier" |
| `inherit` | "current session model" |

The literal resolution (e.g. `haiku-4.5`) only appears in the `<details>` debug
section. This way, future model swaps don't require re-writing every preview.

---

## AppSec node-by-node defaults (alias form)

| Phase | Default alias | Rationale |
|---|---|---|
| Scope | `inherit` (focused-review/quick-check) or `strongest_available` (release-gate/incident-response/deep-sweep) | classifier-style decision; SAFE mode upgrades to opus |
| Plan  | `inherit` (focused-review/quick-check) or `strongest_available` (release-gate/incident-response/deep-sweep) | finder selection has judgment |
| Find  | `cheap_fast` | per-finder simulation; high-volume, structured |
| Normalize | `cheap_fast` | data shape transform |
| Verify (low/med) | `cheap_fast` | single vote, default-reject |
| Verify (high/crit) | `balanced` (release-gate) or `strongest_available` (deep-sweep) | 3-5 votes |
| Map   | `cheap_fast` | taxonomy lookup |
| Synthesize | `balanced` | short report from structured input |
| PersistEvidence | `cheap_fast` | Bash invocation wrapper |

Modes override these defaults. See `~/.claude/orchestrator-runtime/appsec/presets/MODES.md`.

---

## Policy A — model tiers per gate (user lock 2026-05-30)

**Tier rule.** `haiku` (cheap_fast) is for SMOKE / "does it run" ONLY. Every
non-smoke ("real gate") preset uses at least `balanced` (sonnet); judgment /
verdict nodes use `strongest_available` (opus); fanout is capped at `balanced`
(no opus fanout). Quality first; the cost lever is fanout/context, not verdict tier.

| node kind | tier |
|---|---|
| smoke / "does it run" | `cheap_fast` (haiku) — smoke presets only |
| mechanical (persist / static-runner / format) | `balanced` (sonnet) |
| execution / fanout scan | `balanced` (sonnet) — fanout **HARD CAP** |
| judgment / verdict (risk classify · gate decision · evidence verdict · security Scope/Plan) | `strongest_available` (opus) |

**Machine-enforced** by `shared/lint-model-policy.js` (wired into both
`qa|appsec/tests/validate-all-presets.sh`): non-smoke haiku → FAIL; fanout opus →
FAIL. Smoke-exempt presets: `quick-check`, `smoke`, `graph-smoke`.

### Allowed-dynamic vs forbidden-dynamic (governance whitelist)

| area | dynamic? | rule |
|---|---|---|
| preset structure / phase order / node types | **NO** | frozen into spec_hash |
| agentType / prompt_ref / schema_ref | **NO** (version-upgrade only) | PR + re-hash |
| deterministic gate logic | **NO** | runner whitelist op only |
| project context / risk snapshot / paths / diff scope | YES | this IS spec-injection |
| fanout width | YES, capped | by risk/surface; hard upper bound |
| model alias resolution | YES, recorded | preview MUST show `resolved_model` |
| tool permissions | **not in spec** | agent frontmatter + allowlist + hooks |

### Dynamic Workflow (Claude Code native) — safe usage

| use | allowed? | handling |
|---|---|---|
| explore unknown surface | yes | produce candidate findings |
| draft a workflow | yes | proposal only — never runs a gate |
| auto-save as command | cautious | must become preset/spec + hash first |
| release / security verdict | **NO** | frozen spec + runner only |
| modify gate policy | **NO** | PR to runner / op whitelist |

> In governed workflow-spec mode the spec does NOT grant tools; the tool boundary
> comes from agent frontmatter + allowlist + hooks. (This is OUR architecture's
> rule, not a general fact about Claude Code Dynamic Workflows, whose
> model-authored script coordinates agents that still carry their own model/tools.)

### Execution fingerprint (run_hash) — provenance, not the gate

`spec_hash` is the **pre-launch approval gate** (validated by `{qa,appsec}-preview-gate.js`).
But spec_hash does NOT capture agent-definition drift, AppSec's runtime-resolved
model, or the policy/lint version that ran. So at **persist time** the Skill also
records an `execution_fingerprint` via `shared/run-fingerprint.js`, folding:
`spec_hash + resolved_models + agent_hashes + prompt_hashes + schema_hashes +
policy_version + lint_version + fanout_expansion`. Two runs with the same spec_hash
but a drifted agent/policy/lint/fanout get DIFFERENT fingerprints — the evidence
bundle is anchored to *what actually ran*, not just the approved template.
It is recorded in `.{qa,appsec}/evidence/<tag>/workflow-state.yaml`; it is **not**
a launch gate (the gate stays spec_hash).

---

## Hard rules (no override)

1. **No `strongest_available` in fanout** without explicit per-spec opt-in. Default fanout = `cheap_fast` to avoid 11×opus = budget kill. (Policy A 2026-05-30 strengthens this: fanout is `balanced`-capped in real gates AND the cap is machine-enforced by `lint-model-policy.js`.)
2. **`agent({model})` is authoritative** — `meta.phases[].model` is only for the permission dialog display per workflow-creator docs.
3. **Determinism bans apply across all models** — no `Date.now()` / `Math.random()` in workflow body regardless of model.
4. **Preflight verifies alias resolution** — `tests/preflight-check.sh` rejects unknown aliases (not in `registry.json.model_aliases` and not a known legacy literal).

---

## Cost estimation formula (used by preview)

```
agent_count × (system_prompt_overhead ≈ 30-50k + user_prompt + output_estimate)
```

System prompt overhead is model-independent. `cheap_fast` saves on output cost,
not on overhead. Per-agent floor ≈ 50-100k tokens regardless of alias.

**Cost reality (correction, 2026-05-30) — do NOT claim "token count is unchanged".**
Under a frozen spec with the same fanout + context, raising a node's tier changes
mainly **unit price + latency**, not token *count*. Token *count* DOES grow when:
effort rises, Dynamic Workflows are enabled, fanout widens, or more context is
injected (Workflow runs spawn many agents → a single run can dwarf a normal chat).
So the lever to save tokens is **not** downgrading verdict quality — it is: cut
useless context, cap fanout, let hooks pre-filter, let skills supply project knowledge.

---

## Migration status (2026-05-28)

| Domain | Presets migrated to aliases | Workflow body resolves aliases |
|---|---|---|
| AppSec | 7/7 (via Patch A.4) | yes |
| QA | 6/6 (Phase B closed 2026-05-29) | yes |
| UIUX | N/A — not migrating (user lock 2026-05-29) | n/a |
| GSD | N/A — not migrating (user lock 2026-05-29) | n/a |
