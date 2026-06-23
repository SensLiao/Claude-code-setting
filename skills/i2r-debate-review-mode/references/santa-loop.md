# Santa-Loop Protocol

Dual-reviewer independent review protocol for stage 07. Named for the
double-blind adversarial review pattern (no reviewer sees the other's notes
until both verdicts are recorded).

---

## Roles

| Role | Identity | Context rule |
|------|----------|-------------|
| Reviewer A | `i2r-completeness-critic` (opus, fresh context) | Must not be an author of any upstream stage artifact in this run. |
| Reviewer B | Codex `/codex:adversarial-review` (double-blind) | Must not share context with Reviewer A. Receives only the assembled bundle. |
| Reader (Reader Test Gate) | 3rd fresh context (opus) | Receives ONLY `PRD.md` — no run folder, no schemas, no intermediate files. |

---

## Protocol steps

### Step 1 — Assemble the review bundle

Before either reviewer starts, `i2r.py assemble` must have completed successfully,
producing:
- `requirements.json` (rigorous layer)
- `PRD.md` (GSD-native layer)

Both reviewers receive the same bundle snapshot. Record the sha256 of both files
in `_meta.input_hashes` of each review output.

### Step 2 — Reviewer A pass

`i2r-completeness-critic` (fresh context, no memory of authoring decisions):

1. Read `requirements.json` and `PRD.md`.
2. Run the 8-class completeness checklist (`references/defect-taxonomy.md §8-class`).
3. Run the GSD ambiguity precheck (`references/defect-taxonomy.md §gsd-ambiguity`).
4. Run the Reader Test Gate (see §Reader Test Gate below).
5. Produce `07-review.json` with `reviewer: "claude"`.

### Step 3 — Reviewer B pass (Codex, double-blind)

Invoke: `codex:adversarial-review` with the assembled bundle as input.

Reviewer B:
1. Receives `requirements.json` + `PRD.md` only (no run metadata, no other stage files).
2. Runs its own independent completeness and adversarial check.
3. Produces `07-review.codex.json` with `reviewer: "codex"`.

**Codex quota / rate-limit fallback:**
- On any Codex error (rate limit, quota, 402, unavailable):
  - Log the fallback in `run-log.md`: `"Codex unavailable: <error>; fallback to 2nd fresh critic"`.
  - Spawn a 2nd `i2r-completeness-critic` instance with `reviewer: "fallback-critic"`.
  - This instance must have a completely fresh context — no shared state with Reviewer A.
  - Produce `07-review.codex.json` with `reviewer: "fallback-critic"`.

### Step 4 — Gate evaluation

`i2r.py gate.check` reads both review files:
- Both `verdict: "PASS"` → proceed to gate.check full evaluation.
- Either `verdict: "FAIL"` → enter repair loop (see `references/repair-loop.md`).

The orchestrator (`i2r-orchestrator`) coordinates Steps 2–4. It does not read
one reviewer's output before dispatching the other (double-blind is enforced by
spawn order and context isolation).

---

## Reader Test Gate

A standalone gate that lives inside Reviewer A's pass (and independently
inside Reviewer B's pass).

### Protocol

1. A fresh context (no run folder access) receives ONLY `PRD.md`.
2. It reads `PRD.md` as if it had never seen any other artifact.
3. It must independently infer and record:
   - `inferred_goals` — the business purpose and user problem being solved
   - `inferred_boundary` — what is in scope and what is explicitly out
   - `inferred_constraints` — non-functional ceilings, hard limits, compliance requirements
   - `inferred_acceptance` — what constitutes a successful delivery
4. For each dimension, the fresh reader records what it could infer.
5. If any dimension cannot be inferred → `verdict: "FAIL"`.

### Pass criteria

All four dimensions must be independently inferable from `PRD.md` alone.
The bar is not "was it mentioned?" but "could a developer reading only this
document know what success looks like without asking a follow-up question?"

### Failure handling

`reader_test.verdict: "FAIL"` → add a finding:
```json
{
  "defect_class": "READER_TEST_FAIL",
  "severity": "BLOCKER",
  "evidence": "Dimension '<name>' could not be inferred from PRD.md alone. <What was missing.>",
  "suggested_fix": "<Specific addition to PRD.md that would make the dimension inferable.>"
}
```

`READER_TEST_FAIL` is always BLOCKER; it can never be downgraded.
`gate.check` emits BLOCKED on any open READER_TEST_FAIL.

### Where the result is recorded

- In `07-review.json` under `reader_test` (Reviewer A's version).
- In `07-review.codex.json` under `reader_test` (Reviewer B's version).
- Both reader_test results must PASS for gate.check to proceed.

---

## Hard rules

1. Reviewer A and Reviewer B are never spawned in a shared context.
2. Neither reviewer is an author of any upstream stage artifact in this run.
3. The Reader Test Gate receives ONLY `PRD.md` — no other file, no context injection.
4. Both `verdict` fields must be `"PASS"` before `gate.check` evaluates READY.
5. Codex fallback is `"fallback-critic"` (a 2nd `i2r-completeness-critic`), not
   a downgrade to a single-reviewer pass. Two independent verdicts are always required.
6. The fallback instance must have a fresh context — never the same instance as Reviewer A.
