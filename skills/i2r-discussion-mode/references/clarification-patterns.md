# Clarification Patterns — reference

> Owned by `i2r-discussion-mode`. Source: Anthropic doc-coauthoring context-gathering patterns +
> Spec Kit clarify. Reader-oriented, decision-changing question patterns for use by `i2r-orchestrator`
> at Checkpoint A and B.

---

## Core format

Every clarification question the orchestrator sends to the user has three parts:

```
1. THE ISSUE: what is ambiguous or missing
2. THE DECISION IMPACT: what changes if the answer goes one way vs. another
3. THE DEFAULT: what the agent will assume if the user does not answer
```

Never skip the decision impact. A question without it sounds like chit-chat. A question with it is obviously necessary.

---

## Pattern library

### Pattern 1: Actor disambiguation

Use when: "users" is mentioned but 2+ plausible actor classes exist with different requirements.

**Template:**
> The brief mentions [actor term]. I see two plausible readings: (A) [actor class 1], (B) [actor class 2]. This matters because [A] would require [auth/permission implication A] while [B] would require [auth/permission implication B]. Which is correct? If neither, please describe who the primary actor is. *(Default: I'll assume [most constrained reading] unless told otherwise.)*

**Example (good-run adjacent):**
> The brief mentions "agents" accessing the lookup tool. I see two plausible readings: (A) only internal support staff on a company network, or (B) outsourced support contractors on external networks. This matters because (A) would mean internal-auth only is sufficient, while (B) would require external identity federation. Which is it? *(Default: I'll assume internal staff only.)*

---

### Pattern 2: Outcome boundary

Use when: the core job-to-be-done has two plausible success definitions that produce different MUST FRs.

**Template:**
> The goal seems to be [job]. I need to understand where success ends: does [boundary condition A] count as in-scope, or only [narrower boundary B]? This changes whether [downstream FR] is a MUST or out of scope. *(Default: I'll assume [narrower / more conservative] unless you confirm broader.)*

**Example:**
> The goal is to resolve order-status calls without escalation. Does "resolve" mean the agent can view only current status, or also view order history (past orders)? This changes whether order-history lookup is a MUST FR or out of scope. *(Default: I'll assume current order status only unless you tell me history is needed.)*

---

### Pattern 3: Hard constraint reveal

Use when: a constraint that fences the entire scope is absent from the brief and cannot be inferred.

**Template:**
> I need a constraint to bound [aspect] before writing requirements. Specifically: [constraint question]. Without this, [consequence — e.g., I cannot determine whether X is in or out of scope]. *(Default: I'll assume [conservative bound] and flag it as a high-risk assumption.)*

**Example:**
> I need a data constraint before writing requirements. Specifically: is order data stored in a system I2R can treat as a black-box read source, or is there no existing system and the data store must be defined as part of this product? Without this, I cannot determine whether data-access requirements are in scope. *(Default: I'll assume an existing order system exists and treat it as a read source.)*

---

### Pattern 4: Scope boundary (Checkpoint B)

Use when: a MUST-level capability is on the in/out fence and staying deferred could block the FR from being achievable.

**Template:**
> [Capability X] is currently marked deferred/out-of-scope. However, [MUST FR Y] may depend on it — specifically, [dependency reasoning]. If [X] stays out of scope, [Y] cannot be satisfied as written. Should [X] stay deferred, or should it move in-scope? *(Default: I'll keep [X] deferred and flag [Y] as conditionally achievable, with a note on the dependency.)*

---

### Pattern 5: Conflict resolution (Checkpoint B)

Use when: a `decisions[]` lock from intake directly contradicts a scope item.

**Template:**
> There's a conflict between two inputs: [Decision D from intake] says [constraint], but [scope item S] implies [contradicting behavior]. These cannot both be true. Which takes precedence? *(Default: I'll treat [decision D] as the lock and adjust scope item S.)*

---

## Consolidation rules (multi-question batches)

When multiple blocking issues exist at one checkpoint:

1. Group related issues (same actor, same boundary) into one question if possible.
2. Use a numbered list inside a single message — no separate conversation turns.
3. State the decision impact for each item separately.
4. Offer a default for each.
5. Maximum 3 items per batch.

**Example of consolidated batch:**
> Before I proceed to scope, I have two questions:
>
> **1. Actor scope:** [Pattern 1 text]
> **2. Data access:** [Pattern 3 text]
>
> If you're short on time, I'll use the defaults for both and continue.

---

## Tone and format rules

- No preambles ("Just to make sure I understand...", "I was wondering if...", "Could you help me clarify...")
- No trailing hedges ("or whatever you prefer", "if that makes sense")
- No validation-seeking ("Does that sound right?", "Is that correct?")
- Concise: a question + its impact should fit in 3 sentences
- Decision-first: name the decision consequence before asking the question when possible
