# Prose Pass/Fail Projection

The `prose` field in each scenario is the **GSD-native layer** — plain English, no Gherkin syntax.
It is what lands verbatim in `PRD.md ## Acceptance Criteria`.

---

## The projection rule

One scenario → ONE `prose` sentence. Formula:

```
"Passes when <observable outcome> [given <minimal context if needed>]."
```

- Start with `"Passes when"` (positive) or `"Passes when not"` (negative / unwanted behaviour).
- Compress `given` + `when` + `then` into ONE readable sentence. Omit context that is obvious.
- The sentence must be independently readable — a GSD agent consuming only `PRD.md` must understand
  what passing looks like without seeing the Gherkin.

## Projection algorithm (step by step)

```
1. Take the `then` outcome(s) as the core of the sentence.
2. Add the minimum `given`/`when` context needed to disambiguate.
3. Strip implementation detail — no mention of DB, API, framework, file path, SQL.
4. Strip measurement units that belong in NFRs, not acceptance criteria.
5. One sentence, ≤ 25 words preferred, ≤ 40 words max.
6. Run placeholder_scan: reject fast / secure / TBD / as needed / etc.
```

## Examples

| Scenario summary | Prose (correct) |
|---|---|
| Lookup returns orders from last 90 days | Passes when submitting a known customer's email lists that customer's orders from the last 90 days. |
| Empty result shows explicit message | Passes when an email with no matching orders shows an explicit no-orders-found message. |
| Unauthenticated access is denied | Passes when a lookup attempt without an authenticated session is rejected. |
| Duplicate submission is idempotent | Passes when submitting the same request twice produces the same result without creating duplicates. |

## What NOT to include in prose

| Avoid | Reason |
|---|---|
| "…via a REST call to /api/orders" | HOW leaks |
| "…and the database row is updated" | Internal mechanism |
| "…within 2 seconds" | Belongs in NFR fit_criterion |
| "…using the new React component" | HOW / WHEN (implementation) |
| "…it should be fast" | Placeholder (CONTRACT §9 blocker) |
| "…etc." | Placeholder (CONTRACT §9 blocker) |

## Negation (unwanted behaviour)

For EARS `unwanted` pattern requirements, invert:

```
"Passes when not <bad outcome> [given <context>]."
```

Example: `"Passes when not granting access to a lookup submitted without an authenticated session."`

## GSD consumption note

`PRD.md ## Acceptance Criteria` lists these as a bullet list:
```markdown
- AC-ORDER-01-01: Passes when submitting a known customer's email lists that customer's orders from the last 90 days.
```

The `AC-<FR_ID>-NN` prefix is prepended by `i2r.py assemble`. The `prose` field must not repeat the ID.
