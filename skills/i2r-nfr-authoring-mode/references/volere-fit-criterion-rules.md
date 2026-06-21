# Volere Fit Criterion Rules

Source: Suzanne Robertson & James Robertson, "Mastering the Requirements Process" (3rd ed.), Shell Spiral §5 Fit Criterion; Volere Requirements Specification Template.

---

## What is a fit criterion?

A **fit criterion** is the measurable condition that, when satisfied, proves the NFR has been met. It is not a test procedure — it is the acceptance threshold against which any test or measurement can be compared.

Every `required` NFR in `05-nfr.json` must have a `fit_criterion` with all three sub-fields:

```json
"fit_criterion": {
  "threshold": "<the measurable condition — a number, percentage, enumerated value, or specific observable outcome>",
  "environment": "<the context in which the threshold must hold — environment type, user group, load level, hardware tier>",
  "period": "<when or how often the measurement is taken — per request, per release, per calendar period, at launch>"
}
```

---

## The three sub-fields explained

### `threshold`
The quantitative or enumerated condition that must be met.

**Rules:**
- Must contain a number, percentage, rate, level, or explicitly named enumerated value.
- Vague adjectives are banned: "fast", "high", "good", "acceptable", "reasonable", "secure", "robust".
- Comparators must be explicit: `≤`, `≥`, `=`, `>`, `<`, `between X and Y`.
- For "100% of something" requirements, say "100%", not "all" or "every".

**Good threshold examples:**
- `p95 response time ≤ 2 s`
- `availability ≥ 99.5% per calendar month`
- `100% of requests require an authenticated session`
- `task completion rate ≥ 90% on first use`
- `audit log retention ≥ 90 days`
- `WCAG 2.2 Level AA conformance`

**Bad threshold examples (banned):**
- "fast" → rewrite as a latency p-value
- "secure" → rewrite as a specific access-control or audit condition
- "scalable" → rewrite as a concurrent-user or throughput figure
- "minimal downtime" → rewrite as an availability percentage
- "as needed" / "TBD" / "to be determined" → placeholder; gate blocks

---

### `environment`
The context — technical, organisational, or operational — under which the threshold must hold.

**Rules:**
- Name the environment type, not a specific product (not "on AWS", not "in PostgreSQL").
- Describe the relevant load, user group, or deployment tier in business terms.
- If the threshold changes by environment, write one NFR per environment tier.

**Good environment examples:**
- `internal support workstation on the office network`
- `production, under average weekday load`
- `staging environment with a representative 10 k-record dataset`
- `100 concurrent sessions`
- `mobile device on a 4G connection`

**Bad environment examples:**
- "in AWS us-east-1" → says WHERE not WHAT (leaks infrastructure)
- "on the server" → too vague
- "" (empty) → gate blocks

---

### `period`
When or how frequently the threshold is checked.

**Rules:**
- Must be specific enough to drive a test schedule or CI gate.
- Do not leave it empty.

**Good period examples:**
- `measured each release`
- `every request`
- `each calendar month`
- `at first user session after onboarding`
- `per sprint during UAT`
- `on every CI run against the staging environment`

**Bad period examples:**
- "" (empty) → gate blocks
- "when needed" → placeholder

---

## `measurement_method` (optional but strongly recommended)

The `measurement_method` field (not part of `fit_criterion` but a top-level NFR field) describes HOW the threshold will be observed. It is not required by the schema for gate pass, but is required for the acceptance author to write a testable AC.

**Good measurement_method examples:**
- `timing instrumentation on the lookup action, sampled over 1 000 runs`
- `access-control review plus audit-log sampling on each release`
- `automated axe-core scan on each CI run`
- `uptime monitoring dashboard, 5-minute polling interval`

**Bad:** naming a specific tool brand as the sole method (the method should be observable-independent of tooling where possible).

---

## The "no vague adjective" rule — quick reference

Any of these terms in `description`, `threshold`, `environment`, or `period` (outside `rationale`) trigger `PLACEHOLDER` (BLOCKER):

`fast` · `secure` · `scalable` · `robust` · `performant` · `user-friendly` · `flexible` · `efficient` ·
`reliable` (without a number) · `available` (without a percentage) · `accessible` (without a level) ·
`TBD` · `TODO` · `as appropriate` · `as needed` · `to be determined` · `etc.`

**Fix pattern:** "The system must be fast" → find the relevant ISO 25010:2023 characteristic, pick a concrete threshold (e.g., p95 latency), and write a proper `fit_criterion`.

---

## NA and Deferred — what must be provided

### `not_applicable`
Set when the characteristic is genuinely irrelevant to this product.

- Required field: `na_reason` — must explain WHY, not just assert "not applicable".
- Good: `"na_reason": "This is a read-only reporting tool with no physical actuators or financial transactions; no safety hazard is possible."`
- Bad: `"na_reason": "N/A"` — insufficient; gate may flag.

### `deferred`
Set when the characteristic is relevant but the information needed to write a measurable threshold is not yet available.

- Required field: `deferred_missing_info` — must name WHAT specific information is missing.
- Good: `"deferred_missing_info": "Target WCAG conformance level not yet agreed with the accessibility team."`
- Bad: `"deferred_missing_info": "TBD"` — placeholder; gate blocks.
