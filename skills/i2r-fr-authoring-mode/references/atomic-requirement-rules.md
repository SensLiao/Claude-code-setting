# Atomic Requirement Rules

---

## Rule 1 — One behaviour per requirement

A single requirement item in `requirements[]` must describe exactly one observable system behaviour.

**Detection heuristic:** Read `system_response` aloud. If you hear the word **"and"** or **"or"** between two distinct observable outcomes, the requirement must be split into two items.

**Examples of violations:**

| `system_response` (bad) | Problem | Fix |
|---|---|---|
| "return the order list and send a confirmation email" | Two distinct side effects | Split into two requirements: one for the list return, one for the email |
| "validate the input or show an error" | Two alternative responses collapsed | The validation success is one req; the error display is an `unwanted` sibling |
| "display the order status, highlight overdue items, and paginate results" | Three distinct behaviours | Three separate requirements |

**Schema enforcement:** The `i2r-completeness-critic` flags `AMBIGUITY` for hidden conjunctions.

---

## Rule 2 — Unwanted-behaviour sibling

Every `event_driven`, `state_driven`, or `optional` requirement that describes a happy-path response MUST have at least one `unwanted` sibling that covers its primary failure mode.

**When is a sibling required?**
- An action can produce a failure (empty result, invalid input, network error, auth failure, quota exceeded).
- The system stays in a broken state if not handled explicitly.

**When is a sibling NOT required?**
- `ubiquitous` requirements (always active, no trigger, no edge condition possible by definition).
- Requirements where the failure is already covered by a pre-existing `unwanted` requirement in the same capability cluster.

**Sibling pattern:**
```
Happy path:   event_driven — "When a user submits X, the system shall return Y."
Unwanted:     unwanted     — "If X submission fails validation, then the system shall return a specific error message."
```

Both items must live in `requirements[]` with adjacent IDs (e.g., `AUTH-01` and `AUTH-02`).

---

## Rule 3 — Source tagging

Every requirement must carry both `source` and `source_ref`.

| `source` value | Meaning | `source_ref` format |
|---|---|---|
| `stated` | The requirement was explicitly articulated by the user/client | `raw/<filename>#L<line>` |
| `assumed` | The requirement was inferred to prevent a gap; surfaced to the human | `raw/<filename>#L<line>` (best anchor) |
| `decision` | A locked architectural or product decision (see 03-scope.json decisions[]) | `ADR-NNNN` or `raw/<filename>#L<line>` |

**Discipline:**
- NEVER promote an `assumed` requirement to `stated` without explicit user confirmation.
- NEVER write `source_ref: ""` or `source_ref: "inferred"` — use the closest anchor in `raw/`.
- If the material has no line anchor, cite the file: `raw/idea.md`.

---

## Rule 4 — No implementation leakage (stack-swap test)

Before finalising any requirement, apply the **stack-swap test**:

> "If we swapped the database, changed the framework, or replaced the API provider, would this requirement need to be rewritten?"

If **yes** → the requirement has leaked HOW. Strip the implementation detail and restate in terms of the observable behaviour.

**Common HOW leaks and their fixes:**

| Leaked `system_response` | Fixed `system_response` |
|---|---|
| "store the record in the `orders` PostgreSQL table" | "persist the order so it can be retrieved later" |
| "call the Stripe `/v1/charges` endpoint" | "initiate a payment with the configured payment provider" |
| "render a React component with the order list" | "display a list of the matched orders" |
| "send a JWT with the user's role" | "return an authentication token that encodes the user's role" |

**Defect class:** `IMPLEMENTATION_LEAK` (BLOCKER).

---

## Rule 5 — No placeholder values

The following terms are **banned** in all requirement fields except `rationale` and `notes`:

`TBD` · `TODO` · `FIXME` · `nice to have` · `fast` · `secure` · `scalable` · `robust` ·
`user-friendly` · `performant` · `flexible` · `efficient` · `as appropriate` · `as needed` ·
`etc.` · `and so on` · `to be determined`

A hit in a requirement value → `PLACEHOLDER` finding (BLOCKER).

---

## Rule 6 — ID conventions

`id` format: `<CAT>-NN` where:
- `CAT` is an UPPER-CASE category slug derived from the capability cluster (e.g., `ORDER`, `AUTH`, `NOTIF`).
- `NN` is a zero-padded two-digit sequence (01, 02, …) within the category.
- IDs are stable once written; never renumber to fill gaps.

Example: `ORDER-01`, `ORDER-02`, `AUTH-01`, `NOTIF-01`.
