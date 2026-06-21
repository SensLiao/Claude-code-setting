# I2R Quality Gates

Three layers of enforcement: **deterministic SDK** (schema + gate logic, $0), **dual independent review**
(santa-loop), and **project hooks** (block bad states). The model proposes; the gates dispose.

## 1. Schema validation (every stage)
`python scripts/i2r.py validate <run> --stage <n>` validates a stage artifact against its draft-07 schema and
checks `_meta.generated_by_agent` matches the stage owner. The `i2r-subagent-output-gate` hook runs this on
every SubagentStop. A schema-invalid artifact never flows downstream.

## 2. Mode completeness
`i2r.py mode.check` + the `i2r-mode-gate` hook: routing-required search/discussion/scope-debate/codex-review
artifacts must exist before the run can complete.

## 3. Santa-loop dual review (PHASE 6) — both must PASS
- **Reviewer A** = `i2r-completeness-critic` (Claude opus, fresh context, never an author): the 8-class
  defect checklist + `gsd_ambiguity_precheck` + the Reader Test.
- **Reviewer B** = Codex `/codex:adversarial-review` (double-blind — does not see A's findings). On Codex
  quota/rate-limit, fall back to a **2nd fresh-context `i2r-completeness-critic`**.
- Convergence: **both PASS** → proceed. Any FAIL → REVIEW-LOOP. Bounded: **max 3 iterations**, then stop and
  surface to the human. Dispatch Codex per the `codex-dispatch` discipline (Windows UTF-8, quota fallback).

## 4. The final gate — `i2r.py gate.check` → `gate-result.yaml`
Deterministic aggregate. Verdict READY only if ALL hold:
1. every required stage present + schema-valid (per routing);
2. both reviews PASS;
3. no open BLOCKER finding;
4. **placeholder_scan** clean — rejects TBD/TODO/"nice to have"/fast/secure/scalable/… used as a requirement
   value or a required NFR missing its fit_criterion (vendored: PRD Taskmaster);
5. **prd_grade** ≤ 0.20 ambiguity (the critic's `gsd_ambiguity_precheck.score`);
6. **Reader Test** PASS — a fresh critic, given ONLY `PRD.md`, can infer goals/boundary/constraints/
   acceptance (vendored: doc-coauthoring). FAIL ⇒ the handoff is not GSD-ready.

Verdict: **READY** (all hold) · **NEEDS_REVIEW** (open MAJOR, no BLOCKER) · **BLOCKED** (any BLOCKER, missing
required stage, placeholder hit, or failed Reader Test). Exit codes 0 / 1 / 2.

## 5. The handoff gate (governance 坎)
The `i2r-handoff-gate` hook blocks ending the session with a "requirements ready for GSD" claim unless a PRD
is assembled AND `gate-result.yaml` ∈ {READY, NEEDS_REVIEW}. The escape is simple: run `gate.check` and clear
blockers. A more capable model does not get to self-certify — the deterministic gate + dual review decide.

## Debugging a failure
`i2r.py explain-fail <run>` prints the gate result + root-cause findings (placeholder/NFR hits first). Fix the
named stage, re-validate, re-review — never relax the check to make it pass.
