# Scope Boundary Rules

Rules for `i2r-scope-architect` when drawing the boundary in `03-scope.json`.

---

## The boundary test (the stack-swap check)

For every candidate capability before writing it to `in_scope[]`, ask:

> If we swapped the database or framework, would this capability statement need
> to be rewritten?

- **Yes** → the statement describes HOW, not WHAT → rewrite at the WHAT level
  or move to `out_of_scope` / `deferred`.
- **No** → it is a genuine WHAT statement; proceed.

This is the CONTRACT §1 stack-swap test applied at scope time. Catching HOW
leakage here costs nothing; catching it after FR authoring wastes multiple stages.

---

## Capability inventory

`capability_inventory[]` is a flat slug list (kebab-case) of every `in_scope`
capability. It serves as the canonical checklist for FR authors: every FR in
`04-functional.json` must trace to exactly one capability slug.

Rules:
- One slug per distinct user-observable capability.
- Slugs are stable identifiers — once set, downstream agents reference them.
- Do not include architecture components, services, or implementation units.
- Example good slugs: `order-lookup-by-email`, `order-status-display`, `export-to-csv`
- Example bad slugs: `postgres-query`, `rest-api-endpoint`, `react-component`

---

## Anti-scope-creep checklist

Before finalising `03-scope.json`, run through this list:

1. **Single-mention check** — Is this capability mentioned only once in passing,
   without being tied to a core job-to-be-done? → Move to `deferred`.

2. **Placeholder language check** — Does the capability description use vague
   intensifiers ("better", "fast", "flexible", "robust")? → It is not a WHAT
   statement; rewrite to observable behaviour or move to `deferred`.

3. **User-stated vs model-inferred** — Did the user state this need, or did the
   scope-architect infer it as "probably needed"? If inferred with no
   `source_ref`, move to `deferred` and surface as `requires_discussion`.

4. **HOW language check** — Does the capability name or description mention a
   specific technology, data format, API verb, or implementation pattern?
   → Strip it or rewrite to behaviour-level.

5. **Out-of-scope completeness** — For every capability not included, is there
   an explicit `out_of_scope` or `deferred` record with a reason? Silence is
   ambiguity; downstream agents may assume it is allowed.

---

## in_scope vs out_of_scope vs deferred

| Bucket | Meaning | When to use |
|--------|---------|-------------|
| `in_scope` | Confirmed capabilities for this product | User-stated, traceable, no HOW leak |
| `out_of_scope` | Explicitly excluded, not just deferred | Will not be built, ever (for this product) |
| `deferred` | Out of scope for now, not forever | Validated need, wrong phase / not MVP |

The distinction between `out_of_scope` and `deferred` matters: GSD planners use
`deferred` items as candidates for future phases; `out_of_scope` items are ignored.

---

## Scope risks

For every `in_scope` capability that is likely to be misread or over-extended
downstream, add a `scope_risks[]` entry:

```json
{
  "risk": "FR authors may interpret 'order status display' as requiring real-time push updates",
  "mitigation": "Clarify in the capability description: display is poll-on-demand, not push"
}
```

Scope risks are non-blocking but are surfaced to FR authors and reviewers.

---

## Poisoning effect of wrong scope

A wrong boundary at stage 03 propagates silently:
- FR authors write requirements for out-of-scope capabilities → wasted work.
- NFR authors add constraints for capabilities that do not exist → conflicting NFRs.
- Acceptance authors write criteria for features never agreed upon → impossible gate.
- GSD planners plan phases for the wrong product → expensive rework.

The scope-architect is the last agent before this amplification begins.
Get the boundary right before `scope_confirmed: true`.
