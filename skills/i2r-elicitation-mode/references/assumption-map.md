# Assumption Map — reference

> Owned by `i2r-elicitation-mode`. Source: BMAD analyst/brainstorming pattern + Product Requirement
> Craft (problem framing) — extracted and implemented as I2R-local discipline.

---

## Model

Every `assumed[]` entry carries four structured fields:

```json
{
  "text": "<the assumption>",
  "category": "<desirability|viability|feasibility|usability>",
  "importance": "<high|medium|low>",
  "evidence": "<high|medium|low>",
  "risk": "<high|medium|low>",
  "source_ref": "<pointer into raw/>"
}
```

### Categories

| Category | Asks | Typical examples |
|---|---|---|
| `desirability` | Do people actually want this? | "Users want X feature", demand claims, willingness to pay |
| `viability` | Can this be a sustainable product/service? | Business model, audience size, pricing |
| `feasibility` | Can it be built with available resources? | Tech constraints, integrations, timeline |
| `usability` | Will people be able to use it effectively? | Mental model fit, learning curve, accessibility |

---

## Risk scoring

**Risk = f(importance, evidence):**

| importance \ evidence | high | medium | low |
|---|---|---|---|
| **high** | medium | medium | **HIGH** |
| **medium** | low | medium | medium |
| **low** | low | low | medium |

**High importance + low evidence = riskiest assumption.** These must become blocking `open_questions`.

---

## Risk escalation rule

```
IF importance == "high" AND evidence == "low"
  → risk = "high"
  → add to open_questions[] with requires_discussion = "blocking"
  → i2r-orchestrator must surface to user before scope stage proceeds
```

All other assumptions: proceed, document, do not block. The agent records them so a human can audit later — not to stall the run.

---

## The STATED / ASSUMED / DECISION separation

This is the single most important split in I2R. Getting it wrong causes cascading defects downstream.

```
STATED   ← direct evidence of past/specific behavior, citable from raw/
ASSUMED  ← inference or generic claim, risk-scored, may block or proceed
DECISION ← explicit scoping lock from the founder/brief, respected as constraint
```

**Why the split matters for GSD readiness:**
- `stated` → becomes the grounded basis for requirements; critic can verify `source_ref`
- `assumed` → explicit surface area for human review; high-risk ones become open questions
- `decisions` → become `LOCKED` constraints in `requirements.json` that GSD must not override

Conflating them causes:
- `UNSOURCED` (MAJOR): requirement with no verifiable `source_ref`
- `PLACEHOLDER` (BLOCKER): assumed generic ("scalable") promoted to NFR text
- `DOWNSTREAM_REINTERPRETATION_RISK` (MAJOR): GSD receives a "requirement" that was actually a guess

---

## Examples

### High-risk assumption (blocks scope)

```json
{
  "text": "The product is B2B only, sold to enterprise accounts",
  "category": "viability",
  "importance": "high",
  "evidence": "low",
  "risk": "high",
  "source_ref": "raw/idea.md#L2"
}
```

The founder said "we're targeting businesses" but no specific deal, customer, or contract was mentioned. If this is wrong (actually B2C), the actor list, auth model, and pricing constraints all change → blocking open question.

### Medium-risk assumption (proceed with documentation)

```json
{
  "text": "Only internal support staff use this tool",
  "category": "viability",
  "importance": "high",
  "evidence": "medium",
  "risk": "medium",
  "source_ref": "raw/idea.md#L6"
}
```

From the good-run: inferred from context ("internal lookup tool"). Evidence is medium because the purpose implies internal. Risk is medium because if wrong (external customers also access it), auth and data exposure requirements change materially — but not so certain that it blocks.

### Low-risk assumption (document, don't surface)

```json
{
  "text": "English is the primary language of the UI",
  "category": "usability",
  "importance": "low",
  "evidence": "medium",
  "risk": "low",
  "source_ref": "raw/idea.md#L1"
}
```

Brief is written in English; no international market mentioned. Even if wrong, it is a `COULD` localization requirement, not a core MUST.

---

## Assumption audit checklist (before writing 01-intake.json)

- [ ] Every `stated[]` entry has a citable `source_ref`
- [ ] Every `assumed[]` entry has all four risk fields populated
- [ ] All high-risk assumptions (importance:high + evidence:low) appear in `open_questions[]` with `requires_discussion: "blocking"`
- [ ] No `assumed` text contains placeholder language from CONTRACT §9 (TBD, etc.)
- [ ] `decisions[]` contains only explicit locks from the brief, not agent inferences
