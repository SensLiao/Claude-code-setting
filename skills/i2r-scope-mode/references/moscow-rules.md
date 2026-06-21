# MoSCoW Rules

Rules for seeding `moscow` values on `in_scope[]` entries in `03-scope.json`.

---

## Definitions

These definitions are binding within I2R. `moscow` values in `03-scope.json` seed
downstream FR and NFR authoring; the FR author may refine within the same value
or escalate a SHOULD to MUST with evidence, but may not contradict without
a recorded `conflict` finding.

| Value | Meaning in I2R context |
|-------|------------------------|
| `MUST` | Without this capability the product fails its core job-to-be-done. Non-delivery = product failure. |
| `SHOULD` | High-value capability that the product works without, but is expected by users. Omit only with explicit user agreement. |
| `COULD` | Desirable enhancement. Include if effort is negligible relative to MUSTs; defer otherwise. |
| `WONT` | Explicitly out of this product's scope entirely — not a timing decision. Use sparingly; prefer `deferred` for timing deferrals. |

---

## Seeding procedure

### Step 1 — Start from user-stated priorities

Read `01-intake.json` `decisions[]` for any explicit priority signals. If a
decision records `priority: MUST`, the corresponding capability inherits MUST.
If the user said "nice to have", that is COULD or WONT.

### Step 2 — Apply the core-job test for MUSTs

A capability is MUST if removing it means the primary actor cannot complete the
job-to-be-done that motivated the product. Apply this test strictly:
- One or two capabilities per product typically qualify as MUST.
- More than four MUSTs in a simple product signals over-expansion of scope.

### Step 3 — Classify SHOULDs

Capabilities the user expects but that have a workaround (manual, external tool,
or later phase) are SHOULD.

### Step 4 — Classify COULDs

Capabilities mentioned positively but with hedging ("it would be nice", "eventually",
"if we have time") are COULD. They remain in `in_scope` but FR authors deprioritise
them if effort exceeds a session's capacity.

### Step 5 — Classify WONTs

Capabilities the user explicitly rejected, or that would require re-scoping the
entire product, are WONT. They still appear in `in_scope[]` with `moscow: "WONT"`
so that downstream agents know the decision was considered and deliberately excluded.
Do not silently omit them — silence is ambiguity.

---

## Prohibited MoSCoW anti-patterns

| Anti-pattern | Problem | Correction |
|--------------|---------|------------|
| All capabilities are MUST | Removes prioritisation signal for GSD | Apply core-job test rigorously |
| WONT used for timing deferrals | Conflates "never" with "not yet" | Use `deferred` bucket instead |
| SHOULD used for regulatory requirements | Implies optional; regulator may not agree | If legally mandated, escalate to MUST |
| No WONT in scope for any product | Implies no boundary was drawn | Every product excludes something; make it explicit |
| MoSCoW assigned without `source_ref` | Ungrounded priority; reviewers will flag UNSOURCED | Trace every MUST to a user statement |

---

## Relationship to downstream FR authoring

`i2r-functional-author` inherits MoSCoW seeds from `capability_inventory[]` and
`in_scope[].moscow`. It may:
- Split a SHOULD into a MUST sub-capability and a COULD enhancement if evidence supports it
- Record a `CONFLICT` finding if the evidence from `02-context.json` contradicts the seed

It may NOT:
- Upgrade a WONT to any other value (scope change requires orchestrator + user approval)
- Add a new MUST capability not present in `capability_inventory[]`
