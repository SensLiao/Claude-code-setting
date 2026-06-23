# INVEST Rules — Validating the Upstream Story Before Decomposing

Source: Bill Wake, "INVEST in Good Stories, and SMART Tasks" (XP123, 2003); PM Skills user-story framework.

---

## Why INVEST comes before EARS

EARS decomposes a story into atomic requirements. If the upstream story itself is broken (too large, untestable, dependent on another story in a cycle), the decomposition inherits the defect. Check INVEST **before** writing the first `ears_pattern`.

---

## The 6 INVEST criteria

### I — Independent
The story can be scheduled and completed without requiring another story to be done first.
**Check:** Can you drag this story to any sprint without breaking another story?
**Failure signal:** "This only works after Story X is merged." → split or reorder; do not carry the dependency silently into requirements.

---

### N — Negotiable
The story is a conversation placeholder, not a binding contract. Details are negotiable until implementation begins.
**Check:** Could the team choose a different interaction pattern to meet the same goal?
**Failure signal:** The story specifies a UI component, an API endpoint, or a database column. That is a HOW leak — strip it and record it as a decision if it is genuinely locked.
**I2R implication:** Requirements authored from a non-Negotiable story inherit HOW leaks. Fix the story first.

---

### V — Valuable
The story delivers end-to-end value to an actor (user, operator, or business), not just a technical layer.
**Check:** Can you name the actor and what they can do after this story ships that they could not do before?
**Failure signal:** "Refactor the auth module." — technical value only; needs a wrapper story that states the actor benefit.

---

### E — Estimable
The team can size the story (even roughly). If it cannot be estimated, it is either too large or too undefined.
**Check:** Could a developer give a T-shirt size right now?
**Failure signal:** "Rework the entire pipeline." → split until each chunk is estimable.

---

### S — Small
The story is completable within one sprint (or one delivery cycle).
**Check:** Can one developer finish this in ≤ 5 days?
**Failure signal:** The story spans multiple capability clusters in 03-scope.json. Split it.
**I2R implication:** A large story produces many FRs in 04-functional.json; consider whether the scope chunk should be split across runs.

---

### T — Testable
The story has clear, observable acceptance conditions. "The user can do X" is testable; "the user is happy" is not.
**Check:** Could a QA engineer write a test for this story right now, without asking the author?
**Failure signal:** Vague outcomes like "improve performance", "be more secure", "feel faster". These fail `placeholder_scan` and produce untestable requirements. Convert to measurable fit criteria before decomposing.

---

## INVEST pre-flight checklist (run before authoring FRs)

```
[ ] I — No hard dependency on an undelivered story
[ ] N — No HOW in the story description (no framework/table/endpoint names)
[ ] V — Named actor + named capability they gain
[ ] E — Story has a rough size estimate
[ ] S — Story fits within one delivery cycle
[ ] T — Acceptance condition is observable and measurable
```

If any box is unchecked, surface it in `07-review.json` as a `GSD_INCOMPATIBLE` or `UNTESTABLE` finding rather than papering over it with FRs.
