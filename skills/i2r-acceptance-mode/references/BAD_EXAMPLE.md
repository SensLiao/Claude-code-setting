# BAD Acceptance — Anti-patterns + Fixes

Each example shows the bad scenario object, why it fails, and the corrected version.

---

## BAD 1: Untestable prose (vague outcome)

```json
{
  "id": "AC-ORDER-01-01",
  "requirement_id": "ORDER-01",
  "scenario": "Order lookup works",
  "given": ["a customer exists"],
  "when": ["the agent looks up the customer"],
  "then": ["the system shows the order information"],
  "prose": "Passes when the system shows order information quickly."
}
```

**Why it fails:**
- `given` is too vague — "a customer exists" does not define the observable precondition (does the
  customer have orders? in what time window?).
- `then` is vague — "order information" is undefined; an independent tester cannot know what to check.
- `prose` contains `"quickly"` → placeholder hit (CONTRACT §9: `performant`-equivalent) → BLOCKER.
- `scenario` title is not specific enough to distinguish from other order scenarios.

**Fixed:**
```json
{
  "id": "AC-ORDER-01-01",
  "requirement_id": "ORDER-01",
  "scenario": "Lookup returns recent orders",
  "given": ["a customer has orders within the last 90 days"],
  "when": ["the agent submits that customer's email"],
  "then": ["the tool lists those orders"],
  "prose": "Passes when submitting a known customer's email lists that customer's orders from the last 90 days."
}
```

---

## BAD 2: Multi-behaviour scenario (hidden conjunction)

```json
{
  "id": "AC-ORDER-02-01",
  "requirement_id": "ORDER-02",
  "scenario": "Order results are complete",
  "given": ["a lookup returned orders"],
  "when": ["the results are displayed"],
  "then": ["each order shows its current status and the customer's full name is shown at the top and the lookup is logged for audit"],
  "prose": "Passes when orders show status and name is shown and the event is logged."
}
```

**Why it fails:**
- `then` contains three behaviours joined by `and` — status display, customer name display, audit
  logging. These are different requirements and should have separate FR IDs.
- `prose` has multiple outcomes — a reader cannot tell which part failing means the AC fails.
- Conjunctions in `then` are a split signal (see gherkin-rules.md).

**Fixed** (split into three scenarios across the relevant FRs):
```json
[
  {
    "id": "AC-ORDER-02-01",
    "requirement_id": "ORDER-02",
    "scenario": "Each order shows its status",
    "given": ["a lookup returned at least one order"],
    "when": ["the results are displayed"],
    "then": ["each listed order shows its current status"],
    "prose": "Passes when every order in the results shows its current status."
  },
  {
    "id": "AC-ORDER-02-02",
    "requirement_id": "ORDER-02",
    "scenario": "Customer name shown in results header",
    "given": ["a lookup returned orders for a customer"],
    "when": ["the results are displayed"],
    "then": ["the customer's full name appears at the top of the results"],
    "prose": "Passes when the customer's full name appears at the top of the order results."
  }
]
```
(Audit logging belongs on a separate FR; create its own AC once that FR is authored.)

---

## BAD 3: No prose mirror (GSD layer missing)

```json
{
  "id": "AC-AUTH-01-01",
  "requirement_id": "AUTH-01",
  "scenario": "Unauthenticated access denied",
  "given": ["a user is not authenticated"],
  "when": ["the user attempts a lookup"],
  "then": ["the lookup is rejected"],
  "prose": ""
}
```

**Why it fails:**
- `prose` is empty — the GSD-native layer is missing entirely.
- `i2r.py validate --stage 6` will fail schema validation (prose is a required non-empty string).
- `PRD.md ## Acceptance Criteria` will have a blank entry for this AC.

**Fixed:**
```json
{
  "prose": "Passes when a lookup attempt without an authenticated session is rejected."
}
```

---

## BAD 4: HOW leaks into prose (implementation detail)

```json
{
  "prose": "Passes when the REST endpoint returns a 401 HTTP status code for a request without a valid JWT."
}
```

**Why it fails:**
- "REST endpoint", "401", "HTTP status code", "JWT" are implementation details — they describe HOW the
  system enforces auth, not WHAT the user or agent observes.
- Stack-swap test (CONTRACT §1): if the team switches from JWT to session cookies, this AC forces an
  edit even though the requirement (auth required) has not changed → implementation leakage → FAIL.

**Fixed:**
```json
{
  "prose": "Passes when a lookup attempt without an authenticated session is rejected."
}
```
