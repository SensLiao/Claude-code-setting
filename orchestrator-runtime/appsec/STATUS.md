# AppSec Path B Status

> **Current**: `COMPLETE Path B` (orchestration functionality)
> **Last updated**: 2026-05-28
> **Plan**: `Desktop/architecture/ORCHESTRATION-MIGRATION-PLAN.md` v2

## Phase progression

```
BUILDING (P0)         ✓ done — all artifacts exist
  ↓
RUNTIME_PASS (P0.2A)  ✓ done — graph-smoke 10 agents / 392k tokens / 3min, all 4 node types
  ↓
RESUME_PASS (P0.2A.7) ✓ done — predictor 8/8 match + live 0-token cache hit
  ↓
CLOSEOUT (P0.A.1)     ✓ done — R7 / R8 / R10 / N2 / HASHES / registry+preflight / P0_CLOSEOUT
  ↓
PATH_B_COMPLETE       ← we are here
  ↓
PILOT_PASS (Phase E)  pending — real-task pilot in user project
```

## Confidence claims

- **Skill is the brain, Workflow is the muscle**: Skill builds spec; Workflow interprets it.
- **0-token capability fail-fast**: Preflight check blocks launches with missing agents / hooks / SDK / aliases before any token is spent.
- **Sentinel + spec_hash + ttl**: Preview gate is fail-closed; tampering with sentinel.ttl_seconds is bounded by hook clamp `[30, 3600]`.
- **Cross-session resume**: predictor verified; same-session live confirmed 0 tokens / 9ms.
- **Draft-07 hard constraint**: enforced by `tests/lint-schemas.sh`; wired into `validate-all-presets.sh`.
- **Preservation principle**: all existing SKILL.md §1-§17 / agents / hooks / SDK unchanged.

## Open patches (non-blocking)

All A.1.x + A.2 + A.3 + A.4 — **COMPLETE**.

## Cross-review round 1 (2026-05-28)

Independent opus-model code-reviewer audited 10 critical items across all
Phase A changes (resolveModel identity, closure scope, hashNode invariance,
preflight tilde fix, mode cascade, registry asymmetry, etc).

| Result | Count | Notes |
|---|---|---|
| PASS | 6 | A (resolveModel byte-identity), B (closure), C (alias chain), D (tilde fix), G (cache invariance), H (hook spec_hash recompute) |
| WARN → fixed | 3 | F (VALID_MODELS now accepts versioned legacy), F2-doc-drift (model-policy.md inherit returns string), I (cascade "first match wins" clarified), J (asymmetry documented in registry) |
| FAIL → fixed | 1 | E — preflight silently passed when settings.json missing + workflow-spec mode. Now HARD FAILS in that combination. 3 regression scenarios verified. |

Real-world workflow smoke (1 haiku agent, ~33k tokens, 3.4s wall): cleanly
returned schema-valid output; predictor agrees with runtime on fingerprint
`70e34736` (alias resolution chain proven end-to-end).

## Architecture review round 2 (2026-05-28)

Third-party architecture review (external; recorded in
`Desktop/architecture/ORCHESTRATION-MIGRATION-PLAN.md §1.11`) classified the
plan as **ACCEPT-WITH-CAVEATS**. 20 corrections applied:

| Tier | Count | Sample |
|---|---|---|
| Must-change (1-12) | 12 | #1 real-task pilot → Phase E / #2 alias resolution in Skill / #3 spec_hash → SHA-256 / #4 explicit fallback rules / #5 budget gate semantics / #6 shared resolver / #7 hook-scope distinction / #8 hook classification / #9 PersistDecision / #10 SDK smoke proof / #11 GSD mandatory deterministic / #12 GSD dispatches agents not slash commands |
| Recommended (13-20) | 8 | #13 UIUX SurfaceSelect / #14 QA fanout N=2 / #15 plan-only blueprints / #16 runtime version triplets / #17 exit code contract / #18 GSD smoke sandboxed / #19 architectural anti-mega / #20 workflow-spec opt-in wording |

**Code-side application in this session**:
- ✅ `spec_hash` migrated to SHA-256 with `sha256:` prefix (hook accepts both new + legacy djb2 during transition)
- ✅ All 4 args builders emit canonical sha256 form
- ✅ 4 new hook regression tests (test 20–23) verify migration + backward-compat
- ✅ Spec schema adds `resolved_model` + `model_policy_version` fields
- ✅ Workflow body adds `pickModel` / `pickModelFromStage` — prefer Skill-pre-resolved; falls back to legacy `resolveModel` for old specs
- ✅ `hashNode` now includes `model_alias` + `model_policy_version` so policy changes invalidate cache
- ✅ `predict-resume-cache.js` mirrors the new picker logic byte-for-byte
- ✅ Registry adds `hook_class` + `fail_policy` + `install_scope` per hook (§1.11 #8)
- ✅ Registry adds `shared_runtime_version: 1.0.0` + `domain_runtime_version: appsec-0.2.0` (§1.11 #16)
- ✅ SKILL.md §16.0 explicit-fallback rules (§1.11 #4)
- ✅ SKILL.md §16.11 Step 7.5 Skill-side alias resolution mandate (§1.11 #2)

**Code-side deferred to Phase B kickoff** (documented in plan, not blocking AppSec):
- `shared/resolve-capabilities.js` (replaces grep-only preflight per §1.11 #6) — Phase B builds this once + reuses for AppSec / QA / UIUX / GSD
- Workflow body node_fingerprint sha256 (full uniformity per §1.11 #3 — currently node_fingerprint stays djb2 because Workflow body has no module import; documented as transition)
- UIUX `PersistDecision` (Phase C implementation per §1.11 #9)
- GSD `PlanGate` / `ShipGate` deterministic ops (Phase D per §1.11 #11)
- Exit code contract table enforcement (§1.11 #17 — documented as plan-level table; per-component conformance happens as each is touched)

## Regression after corrections

| Suite | Result |
|---|---|
| validate-all-presets | 7/7 OK |
| lint-schemas | 8/8 draft-07 |
| hook-mock-test | 23/23 (added test 20–23 for SHA-256 + djb2-legacy compat) |
| unit-resolve-model | 17/17 |
| preflight positive | exit 0 ✓ |
| preflight workflow-spec + no settings.json | exit 2 ✓ (Item E regression) |

## Cross-domain status

| Domain | Path B status | Last update |
|---|---|---|
| **AppSec** | COMPLETE Path B (this doc) | 2026-05-28 |
| **QA** | COMPLETE Phase B (incl. B.1.a-B.1.f + B.2 graph-smoke runtime + B.3 resume verify + B.4 closeout) — see `Desktop/architecture/QA-PHASE-B-CLOSEOUT.md` | 2026-05-29 |
| UIUX | PLANNING (Phase C not started) | — |
| GSD | PLANNING (Phase D not started) | — |

## How to verify status manually

```bash
# Spec validation + draft-07 lint
bash ~/.claude/orchestrator-runtime/appsec/tests/validate-all-presets.sh

# Preview-gate hook (19 unit tests)
bash ~/.claude/orchestrator-runtime/appsec/tests/hook-mock-test.sh

# Capability preflight (against any inlined spec)
PREFLIGHT_SKIP_SETTINGS=1 bash ~/.claude/orchestrator-runtime/appsec/tests/preflight-check.sh <inlined-spec.json>
```
