# I2R Quality Gates

Three layers of enforcement: **deterministic SDK** (schema + gate logic, $0), **dual independent review**
(santa-loop), and **project hooks** (block bad states). The model proposes; the gates dispose.

## 1. Schema validation (every stage)
`python scripts/i2r.py validate <run> --stage <n>` validates a stage artifact under `internal/stages/`
against its draft-07 schema and checks `_meta.generated_by_agent` matches the stage owner. The
`i2r-subagent-output-gate` hook runs this on every SubagentStop. A schema-invalid artifact never flows
downstream.

## 2. Mode completeness
`i2r.py mode.check` + the `i2r-mode-gate` hook: routing-required search/discussion/scope-debate/codex-review
artifacts must exist in `internal/stages/` before the run can complete.

## 3. Santa-loop dual review (PHASE 6) — both must PASS
- **Reviewer A** = `i2r-completeness-critic` (Claude opus, fresh context, never an author): the completeness
  defect checklist + `gsd_ambiguity_precheck` + the Reader Test. Reads the whole `out/` Markdown package.
- **Reviewer B** = Codex `/codex:adversarial-review` (double-blind — does not see A's findings). On Codex
  quota/rate-limit, fall back to a **2nd fresh-context `i2r-completeness-critic`**. Also reads the `out/`
  package.
- Convergence: **both PASS** → proceed. Any FAIL → REVIEW-LOOP. Bounded: **max 3 iterations**, then stop and
  surface to the human. Dispatch Codex per the `codex-dispatch` discipline (Windows UTF-8, quota fallback).

## 4. The final gate — `i2r.py gate.check` → `audit/gate-result.yaml` + `audit/gate-result.md` + `out/READINESS.md`
Deterministic aggregate. Verdict READY only if ALL semantic checks AND all structural checks hold.

### Semantic checks
1. Every required stage present in `internal/stages/` + schema-valid (per routing; SKIPPED stubs count as satisfied-absent).
2. **Both** reviews PASS.
3. No open `BLOCKER` finding.
4. **placeholder_scan** clean — rejects TBD/TODO/"nice to have"/fast/secure/scalable/… used as a requirement
   value or a required NFR missing its fit_criterion (vendored: PRD Taskmaster).
5. **prd_grade** ≤ 0.20 ambiguity (the critic's `gsd_ambiguity_precheck.score`).
6. **Reader Test** PASS — a fresh critic receives ONLY the `out/` Markdown package (no `internal/`, no
   `raw/`). It must independently infer: what to build · why · who benefits · what is explicitly out · which
   decisions are locked · which assumptions are still open · how it is accepted · current readiness · no
   HOW/WHEN/WHO leakage. FAIL ⇒ `READER_TEST_FAIL` (BLOCKER). (Vendored: doc-coauthoring.)

### Markdown-first structural checks (new in v2; deterministic, over `out/`)
Each maps to a gate finding:

| Check | Condition | Severity |
|---|---|---|
| `out_markdown_only` | `out/` contains only `*.md` (+ `decisions/*.md`); any `.json/.yaml` → FAIL | **BLOCKER** |
| `no_downstream_commands` | No `/gsd:`, `plan-phase`, `ingest-docs`, `next_command_hint`, `consumer_contract_version`, `handoff.gsd` in any `out/*.md` | **BLOCKER** (`DOWNSTREAM_COMMAND_LEAK`) |
| `prd_has_executive_summary` | `out/PRD.md` contains the `## Executive Summary` section | **MAJOR** |
| `requirements_are_narrative` | `out/REQUIREMENTS.md` has per-requirement sections, not just a single table | **MAJOR** |
| `acceptance_has_plain_language` | Every Gherkin block in `out/ACCEPTANCE.md` is followed by a plain-language explanation | **MAJOR** |
| `readiness_markdown_exists` | `out/READINESS.md` exists and is non-empty | **BLOCKER** |
| `traceability_markdown_exists` | `out/TRACEABILITY.md` exists and is non-empty | **BLOCKER** |
| `constraints_visible` | `out/CONSTRAINTS.md` exists and is non-empty | **BLOCKER** |
| `questions_assumptions_visible` | `out/QUESTIONS.md` exists and is non-empty | **BLOCKER** |
| `no_machine_contract_language` | `out/` free of machine-contract phrases (`consumer_contract_version`, `required_gsd_behavior`, `handoff_status`, `next_command_hint`) | **MAJOR** |

### Verdict
- **READY** — all semantic + structural checks hold.
- **NEEDS_REVIEW** — open MAJOR finding(s), no BLOCKER; gate-soft.
- **BLOCKED** — any BLOCKER, missing required stage, failed Reader Test, placeholder hit, or `out/` structural BLOCKER.

Exit codes: 0 (READY) / 1 (NEEDS_REVIEW) / 2 (BLOCKED).

`out/READINESS.md` renders the verdict for humans. `audit/gate-result.yaml` is the machine record.
`audit/gate-result.md` is the human-readable explanation (what passed, what failed, how to fix).

## 5. The readiness gate (governance 坎)
The `i2r-readiness-gate` hook (Stop; file: `i2r-readiness-gate.js`) blocks ending the session with a
"requirements ready" claim unless the `out/` package is assembled AND `audit/gate-result.yaml` ∈
{READY, NEEDS_REVIEW} AND no open BLOCKER. The hook emits **no downstream command**. The escape is simple:
run `gate.check` and clear blockers. A more capable model does not get to self-certify — the deterministic
gate + dual review decide.

## Debugging a failure
`i2r.py explain-fail <run>` prints the gate result + root-cause findings (structural BLOCKERs first, then
placeholder/NFR hits). Fix the named stage or `out/` document, re-validate, re-review — never relax the
check to make it pass.
