# Blocking Question Policy — reference

> Owned by `i2r-discussion-mode`. Source: Anthropic doc-coauthoring context-gathering discipline +
> Spec Kit clarify pattern — extracted as I2R-local rules.

---

## The single test for "blocking"

> Missing the answer causes the agent to write a materially different set of FRs, NFRs, or scope boundaries.

**Materially different** means: at least one `MUST` or `SHOULD` requirement would change its text, its actor, or its existence — not just a nuance of wording.

---

## Blocking question decision matrix

| Situation | Blocking? | Action |
|---|---|---|
| Actor identity unclear (2+ plausible actor classes with different auth models) | YES | Ask at Checkpoint A |
| Core outcome ambiguous (two plausible readings produce different MUST FRs) | YES | Ask at Checkpoint A |
| Hard constraint entirely absent and cannot be inferred | YES | Ask at Checkpoint A |
| In/out boundary contested for a MUST-level capability | YES | Ask at Checkpoint B |
| Deferred item blocks a MUST FR from being achievable | YES | Ask at Checkpoint B |
| Contradictory constraints between intake and scope | YES | Ask at Checkpoint B |
| Feature preference unclear ("should it look like X or Y?") | NO | Proceed; note as COULD |
| Technology preference absent | NO | Proceed; record as `assumed` (no HOW in I2R scope) |
| Non-MUST edge case behavior unclear | NO | Proceed; mark as `COULD` with `source: assumed` |
| Metric target range unclear for a SHOULD NFR | NO | Proceed; flag as open assumption in NFR rationale |
| Nice-to-have feature not mentioned | NO | Do not surface; out_of_scope or COULD |

---

## Checkpoint A — post-intake checklist

Run after `01-intake.json` exists. Open `open_questions[]` and check each:

```
FOR each q in open_questions:
  IF q.requires_discussion == "blocking":
    → batch into consolidated ask (max 3 questions per checkpoint)
    → state each question + decision_impact + default_assumption
  ELSE:
    → skip; proceed with documented assumption
```

**Hard limit:** max 3 questions per checkpoint. If more than 3 blocking issues exist, rank by `risk` (highest first) and ask the top 3. Lower-ranked ones become high-risk `assumed[]` entries with `risk: high`.

---

## Checkpoint B — post-scope checklist

Run after `03-scope.json` exists. Same loop, different signal source:

```
FOR each item in in_scope[] + out_of_scope[] + deferred[]:
  IF item.requires_discussion == "blocking":
    → same batch-and-ask logic as Checkpoint A
```

Additionally check: does `03-scope.json` conflict with any `decisions[]` in `01-intake.json`? If yes → blocking conflict → ask.

---

## Non-blocking resolution (what to do instead of asking)

When a question is non-blocking, the agent MUST:
1. Choose the most reasonable assumption given `00-raw/` context.
2. Add it to `assumed[]` with all four risk fields.
3. Set `importance` and `evidence` accurately (do not under-score to avoid surfacing it).
4. Do NOT mention the assumption to the user — it is documented in the artifact, not raised in conversation.

**Why:** asking non-blocking questions trains the user to expect excessive hand-holding, degrades run speed, and violates the I2R principle that agents should be autonomous within their WHAT/WHY boundary.

---

## Anti-patterns

| Anti-pattern | Why it is wrong | Correct action |
|---|---|---|
| Asking "just to confirm" something already in 00-raw/ | Wastes user time; agent already has the answer | Read 00-raw/ more carefully; don't ask |
| Asking about HOW (technology, architecture, frameworks) | Outside I2R boundary | Never ask; if founder volunteers it, record as `decisions[]` |
| Asking multiple non-MUST questions at once | Question overload; most are non-blocking | Apply blocking test; ask only if at least one is blocking |
| Subagent surfaces a question directly to the user | Violates orchestration contract | Subagent writes to `open_questions[]`; orchestrator asks at checkpoint |
| Asking at mid-stage (not at a checkpoint) | Unpredictable run flow | Questions only at Checkpoint A or B |
| Asking more than 3 questions per checkpoint | Cognitive overload; signals agent is not doing its job | Rank by risk; ask top 3; rest become high-risk assumptions |
