# Repair Loop

Bounded repair loop for stage-07 failures. Maximum 3 iterations; iteration 4
is a hard stop to the human. Governed by `i2r-orchestrator`.

---

## Trigger

The repair loop activates when `gate.check` receives a FAIL verdict from either
`07-review.json` (Reviewer A) or `07-review.codex.json` (Reviewer B).

---

## 08-repair-notes.json contract

`i2r-orchestrator` writes `08-repair-notes.json` (schema:
`schemas/08-repair-notes.schema.json`) to initiate each repair iteration.

Required fields:
- `iteration` — integer 1–3 (the repair attempt number, not the review iteration)
- `failed_stage` — the specific stage where the root defect lives (not always stage-07;
  a SCOPE_LEAK finding means `failed_stage: "03-scope"`)
- `findings[]` — the subset of findings from `07-review.*.json` that must be
  repaired in this iteration (BLOCKER findings first; include all BLOCKERs)
- `repair_prompt` — a precise, bounded instruction to the stage-owner agent
  describing exactly what must change; do not ask for a full rewrite unless
  necessary; prefer surgical edits
- `previous_attempt_hash` — sha256 of the artifact being replaced (for audit)
- `new_attempt_required: true` — always true when the loop is active

---

## Loop execution

```
[Iteration 1, 2, or 3]

i2r-orchestrator:
  1. Read 07-review.json + 07-review.codex.json
  2. Identify failed_stage from the BLOCKER findings
  3. Write 08-repair-notes.json with repair_prompt targeting that stage
  4. Dispatch the stage-owner agent (NOT the reviewer)
     to rerun ONLY the failed stage
  5. Stage-owner produces a new artifact (overwrites old; old hash in previous_attempt_hash)
  6. i2r.py mark-stale marks all downstream stages STALE
  7. Downstream stages rerun in order through assemble
  8. Stage 07: santa-loop reruns (both reviewers, fresh context, new iteration number)
  9. If both PASS → exit repair loop
  10. If either FAIL → check iteration count
      iteration < 3 → repeat from Step 1
      iteration == 3 and still FAIL → HARD STOP (see §Hard stop)
```

---

## Rerun scope discipline

**Rerun only the failed stage and its downstream dependents.**
Do not rerun stages that are upstream of the defect — their artifacts are
correct and should not be re-generated unnecessarily (idempotency, CONTRACT §2).

Stage dependency order:
```
00-mode-routing → 01-intake → 02-context → [02b-evidence] →
03-scope → [03b-scope-debate] → 04-functional → 05-nfr →
06-acceptance → assemble → 07-review
```

If `failed_stage: "04-functional"`:
- Rerun: 04-functional → 05-nfr → 06-acceptance → assemble → 07-review
- Do NOT rerun: 00 through 03

If `failed_stage: "03-scope"`:
- Rerun: 03-scope → 04-functional → 05-nfr → 06-acceptance → assemble → 07-review
- Do NOT rerun: 00 through 02b

---

## Hard stop at iteration 3

If both reviewers still FAIL after the third repair attempt:

1. `i2r-orchestrator` does NOT write a 4th `08-repair-notes.json`.
2. `gate.check` emits `BLOCKED` with a special note:
   `"Repair loop exhausted after 3 iterations. Human review required."`
3. `run-log.md` records the hard stop with all three iteration hashes.
4. The orchestrator surfaces to the human:
   - The current `findings[]` (all open BLOCKERs)
   - The repair prompts that were attempted (from the three `08-repair-notes.json` files)
   - A recommendation for what the human should clarify or decide

The human may then:
- Provide additional clarification → restart the run from the affected stage
- Manually override a MAJOR finding (not a BLOCKER) → mark as accepted-risk in `run-log.md`
- Abandon the run

---

## Audit trail

Every repair iteration is recorded in `run-log.md` with:
- Iteration number
- `failed_stage`
- sha256 of the replaced artifact (`previous_attempt_hash`)
- `repair_prompt` (verbatim)
- Verdict of the subsequent review pass

This log is append-only (CONTRACT §17 rule 9). Do not edit prior entries.

---

## Relationship to `i2r-mode-gate` hook

The `i2r-mode-gate` hook (PreToolUse / Stop) will block any attempt to call
`i2r.py gate.check` for a READY verdict while an open `08-repair-notes.json`
exists with `new_attempt_required: true` and no subsequent PASS review.
The repair loop must complete (or hard-stop) before the gate evaluates.
