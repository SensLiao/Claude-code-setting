# BAD PRD — HOW leaks + Reader Test failure

This PRD looks complete but contains implementation details (HOW), a task list (WHEN),
and is ambiguous enough to fail the Reader Test Gate.

---

## The bad PRD

```markdown
---
type: prd
source: idea-to-requirements-orchestrator
handoff_status: READY
---
# Order Lookup Tool

## Goals
- Build a React frontend with a search input that calls a Node.js REST API
  backed by a PostgreSQL query on the orders table.
- Phase 1: basic lookup. Phase 2: add phone number lookup.

## Non-Goals / Out of Scope
- Mobile app (we'll do this in Q3)

## Requirements
### ORDER
ORDER-01: Implement a /api/orders?email={email} endpoint that queries
          the PostgreSQL orders table and returns JSON.
ORDER-02: The React component should display the OrderCard component for
          each result with status badge.
ORDER-03: Return HTTP 204 when no results found.

## Acceptance Criteria
- The endpoint returns data fast.
- The UI doesn't crash.

## Constraints
- Use PostgreSQL because the CTO decided.
- p95 < 2s

## Locked Decisions
- We'll use JWT for auth with a 24-hour expiry and refresh tokens via Redis.

## Open Questions
- (none)

## How to feed GSD
- /gsd:ingest-docs
```

---

## Why this PRD fails

### 1. HOW leaks throughout (CONTRACT §1 stack-swap test)

| Location | HOW leak | Why it fails the stack-swap test |
|---|---|---|
| Goals | "React frontend", "Node.js REST API", "PostgreSQL" | Swapping to Vue or MongoDB forces a Goals edit |
| ORDER-01 | "`/api/orders?email={email}`", "PostgreSQL orders table", "JSON" | Swapping to GraphQL or MySQL forces an FR edit |
| ORDER-02 | "`OrderCard` component", "status badge", "React" | Swapping to a server-rendered template forces an FR edit |
| ORDER-03 | "HTTP 204" | An HTTP status code is HOW the system signals "no results" |
| Constraints | "Use PostgreSQL because the CTO decided" | Technology choice belongs in Locked Decisions if decided; in Constraints it reads as a tech requirement |
| Locked Decisions | "JWT", "24-hour expiry", "refresh tokens", "Redis" | Auth implementation detail; the WHAT is "authenticated staff only" — the HOW is JWT + Redis |

**Fix:** replace all HOW with WHAT:
- ORDER-01 WHAT: "When a support agent submits a customer email, the tool shall return that customer's orders from the last 90 days."
- ORDER-03 WHAT: "If a lookup finds no orders, the tool shall show an explicit no-orders-found message rather than an empty screen."
- Locked Decision WHAT: "The tool is read-only and never changes or cancels an order." (Auth mechanism → Constraints NFR-SEC-01 as WHAT: "Only authenticated internal staff can perform a lookup.")

### 2. Goals contains a phase plan (WHEN leak)

```
Phase 1: basic lookup. Phase 2: add phone number lookup.
```

I2R never emits phases. GSD derives the phase breakdown. This line is a WHEN leak.

**Fix:** Goals = WHAT + WHY. Deferred items go in Non-Goals / Out of Scope:
```
## Non-Goals / Out of Scope
- (deferred) Lookup by phone number
```

### 3. Acceptance Criteria are untestable (placeholder hits)

```
- The endpoint returns data fast.
- The UI doesn't crash.
```

- `"fast"` is a placeholder (CONTRACT §9: `performant`-equivalent) → BLOCKER.
- "doesn't crash" is not a pass condition — it is the absence of an observable outcome, not a
  positive testable statement.
- Neither item uses the `"Passes when …"` format.
- Neither item has an AC ID.

**Fix:**
```
- AC-ORDER-01-01: Passes when submitting a known customer's email lists that customer's orders from the last 90 days.
- AC-ORDER-03-01: Passes when an email with no matching orders shows an explicit no-orders-found message.
```

### 4. Reader Test failure (CONTRACT §11)

A fresh reader receiving ONLY this PRD cannot infer:
- **Scope boundary**: is editing orders in scope? Not stated (only "mobile app" is excluded).
- **Constraints**: "p95 < 2s" — under what conditions? What environment?
- **Acceptance**: "The endpoint returns data fast" — no independent tester can verify this.

Result: `READER_TEST_FAIL` → gate verdict `BLOCKED`.

**Fix:** Every section must be self-contained. A reader with no other context must be able to
answer: what does this product do, what is out of scope, what are the performance/security
expectations, and what does passing look like?

---

## Summary of defects

| Defect class | Location | Severity |
|---|---|---|
| `IMPLEMENTATION_LEAK` | Goals, ORDER-01, ORDER-02, ORDER-03, Locked Decisions | BLOCKER |
| `IMPLEMENTATION_LEAK` | Constraints (PostgreSQL as constraint) | MAJOR |
| `PLACEHOLDER` | Acceptance ("fast", "doesn't crash") | BLOCKER |
| `SCOPE_LEAK` | Goals (Phase 1/Phase 2 roadmap) | MAJOR |
| `READER_TEST_FAIL` | Constraints (p95 without context), Acceptance (untestable) | BLOCKER |
| `UNTESTABLE` | Both acceptance criteria | BLOCKER |
