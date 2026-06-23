# Mom Test Filter — reference

> Owned by `i2r-elicitation-mode`. Source: The Mom Test (Rob Fitzpatrick) — pattern extracted
> and implemented as I2R-local discipline. No runtime dependency on external skill.

---

## The core problem

A founder will naturally say things that sound like evidence but are not:
- "My users always want faster load times." ← generic, no specific event
- "People would definitely pay for this." ← future promise, no past behavior
- "I might add reporting later." ← hypothetical, scope-creep vector

A naive agent treats all of these as `stated` evidence. The result: requirements built on opinions masquerading as facts, which fail the Reader Test Gate (CONTRACT §11) because a critic cannot find the real source_ref.

---

## What counts as STATED evidence

**Requirement:** the claim describes a **specific past behavior** or a **directly observable fact**, AND the agent can point to a concrete `source_ref` in `raw/`.

| Text | Classification | Why |
|---|---|---|
| "Last month three support agents spent 20 min each call looking up orders manually" | `stated` | Specific event, specific actor, measurable time, citable |
| "The founder's demo shows a lookup screen used by 5 people" | `stated` | Observable from artifact in raw/ |
| "The brief states the system is read-only and never modifies orders" | `stated` (also `decisions`) | Explicit constraint, citable |

---

## What must be EXCLUDED from STATED

### Generic / habitual statements

Pattern words: *usually*, *always*, *often*, *normally*, *generally*, *typically*, *in general*

| Text | Classification | Action |
|---|---|---|
| "Users usually want to see the full order history" | `assumed` | Importance: medium; evidence: low |
| "Agents always check status before escalating" | `assumed` | Could be stated if there is a specific observation |

### Future promises

Pattern words: *will*, *would*, *going to*, *plan to*, *intend to*, *expect to*

| Text | Classification | Action |
|---|---|---|
| "We will need multi-language support" | `assumed` | Viability/desirability; evidence: none |
| "Users would pay for premium reports" | `assumed` | Desirability; importance: high if revenue-critical |

### Hypotheticals

Pattern words: *might*, *could*, *maybe*, *possibly*, *if users want*

| Text | Classification | Action |
|---|---|---|
| "We might add a mobile app later" | `assumed` | Scope signal; surface as open_question if it affects boundary |
| "It could integrate with Salesforce" | `assumed` | Feasibility; risk depends on how central integration is |

---

## Classification decision tree

```
Is there a specific past event or directly observable fact?
├── YES → Does raw/ contain a citable source?
│         ├── YES → stated[]
│         └── NO  → assumed[] (evidence: medium)
└── NO  → Is it a generic/future/hypothetical?
           ├── generic/future/hypothetical → assumed[]
           └── explicit scoping lock         → decisions[]
```

---

## Examples anchored to the good-run

From `examples/good-run/01-intake.json`:

```json
"stated": [
  {
    "text": "A support agent can enter a customer email to find that customer's orders",
    "source_ref": "raw/idea.md#L4"
  }
]
```

This is `stated` because it describes a specific actor (support agent), a specific action (email lookup), and cites the exact line.

```json
"assumed": [
  {
    "text": "Only internal support staff use this tool",
    "category": "viability",
    "importance": "high",
    "evidence": "medium",
    "risk": "medium",
    "source_ref": "raw/idea.md#L6"
  }
]
```

This is `assumed` because "internal only" is inferred from context, not an explicit constraint in the brief. It carries a `source_ref` to the line that prompted the inference.

---

## Anti-patterns

| Anti-pattern | What goes wrong | Correct action |
|---|---|---|
| Treating "users want X" as stated | Creates UNSOURCED requirement | Demote to assumed; surface as open_question if high importance |
| Creating a stated entry without source_ref | UNSOURCED finding from critic | Never fabricate; if no citable source, it is assumed |
| Ignoring hypotheticals | Hidden scope creep enters requirements | Classify as assumed; flag if it changes boundary |
| Asking about non-blocking unknowns | Wastes user time; violates discussion-mode rules | Proceed with explicit assumption; document it |
