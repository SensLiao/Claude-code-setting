# BAD PRD — HOW leaks + downstream command leak + missing Executive Summary + goals stuffed into one sentence + Reader Test failure

This PRD looks superficially complete but fails on multiple dimensions:
- HOW leaks throughout (implementation details)
- Emits downstream orchestration commands (BLOCKER)
- Missing `## Executive Summary` section (gate MAJOR)
- Goals section is a stuffed prose sentence, not a structured table (gate finding)
- Machine-contract frontmatter field (`handoff_status` instead of `readiness`)
- Acceptance criteria are untestable (placeholders)
- Reader Test cannot pass

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
  backed by a PostgreSQL query on the orders table. The tool resolves support
  calls so agents don't need to escalate and also does phase 1 basic lookup
  with phase 2 phone number lookup coming later.

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
- /gsd:ingest-docs            (full bootstrap; classified as PRD)
- /gsd:plan-phase --prd PRD.md (lightweight single-doc)
```

---

## Why this PRD fails

### 1. MISSING `## Executive Summary` — gate MAJOR (`prd_has_executive_summary`)

The PRD has no `## Executive Summary` section. Under the v2 shape, the Executive Summary MUST
be the first section after the H1. Without it, a reader cannot orient quickly: there is no
problem statement, no desired outcome table, no explicit scope boundary, no locked decisions
summary, no readiness status. Gate finding: `prd_has_executive_summary` → MAJOR.

**Fix:** add the Executive Summary table as the first section:
```markdown
## Executive Summary

| Field | Value |
|---|---|
| Problem | Support agents navigate multiple systems to answer order-status calls |
| Desired outcome | Agents answer order-status calls without escalating |
| Primary users | Internal support agents |
| In scope | Read-only lookup of recent orders by email |
| Out of scope | Editing orders; phone lookup; public access |
| Locked decisions | Tool is read-only |
| Main risks | Stale status data misleads agents |
| Readiness | READY |
```

### 2. Goals stuffed into one prose sentence (not a structured table) — gate finding

```
- Build a React frontend with a search input that calls a Node.js REST API backed by a PostgreSQL
  query on the orders table. The tool resolves support calls so agents don't need to escalate and
  also does phase 1 basic lookup with phase 2 phone number lookup coming later.
```

This single sentence mixes HOW (React, Node.js, PostgreSQL, API), WHAT (lookup), WHY (resolve
calls), and WHEN (Phase 1 / Phase 2). The v2 Goals section must be a structured table:

```markdown
| Goal | Target | Source | Confidence |
|---|---|---|---|
| … | … | … | … |
```

**Fix:**
```markdown
## Goals

| Goal | Target | Source | Confidence |
|---|---|---|---|
| Support agents answer order-status calls without escalating | 90% resolved within the call | stated | high |
| Lookup is fast enough for a live call | p95 ≤ 2 seconds | stated | high |
```

Deferred items belong in Non-Goals:
```markdown
## Non-Goals
- (deferred) Lookup by phone number
```

### 3. Downstream orchestration commands emitted — gate BLOCKER (`DOWNSTREAM_COMMAND_LEAK`)

```markdown
## How to feed GSD
- /gsd:ingest-docs            (full bootstrap; classified as PRD)
- /gsd:plan-phase --prd PRD.md (lightweight single-doc)
```

I2R MUST NOT emit downstream orchestration commands. The `## How to feed GSD` section, the
`/gsd:ingest-docs` command, and the `/gsd:plan-phase --prd PRD.md` command are all BLOCKER
violations. CONTRACT §1: "I2R MUST NOT emit downstream orchestration commands."

Gate check: `no_downstream_commands` → BLOCKER (`DOWNSTREAM_COMMAND_LEAK`).

**Fix:** remove the entire `## How to feed GSD` section and both commands. Downstream systems
read the `out/` package and apply their own routing logic.

### 4. Machine-contract frontmatter field — gate MAJOR (`no_machine_contract_language`)

```yaml
handoff_status: READY
```

`handoff_status` is a v1 machine-contract field. In v2 the correct frontmatter field is
`readiness`. The six permitted frontmatter fields are: `title`, `source`, `run_id`, `readiness`,
`lang`, `generated_at`.

**Fix:**
```yaml
---
title: Order Lookup Tool
source: i2r
run_id: i2r-order-lookup-2026a
readiness: READY
lang: en
generated_at: 2026-06-22T10:00:00Z
---
```

### 5. HOW leaks throughout (CONTRACT §1 stack-swap test)

| Location | HOW leak | Why it fails the stack-swap test |
|---|---|---|
| Goals | "React frontend", "Node.js REST API", "PostgreSQL" | Swapping to Vue or MongoDB forces a Goals edit |
| ORDER-01 | "`/api/orders?email={email}`", "PostgreSQL orders table", "JSON" | Swapping to GraphQL or MySQL forces an FR edit |
| ORDER-02 | "`OrderCard` component", "status badge", "React" | Swapping to a server-rendered template forces an FR edit |
| ORDER-03 | "HTTP 204" | An HTTP status code is HOW the system signals "no results" |
| Constraints | "Use PostgreSQL because the CTO decided" | Technology choice belongs in Locked Decisions; as a Constraint it reads as a tech requirement |
| Locked Decisions | "JWT", "24-hour expiry", "refresh tokens", "Redis" | Auth implementation detail; the WHAT is "authenticated staff only" |

**Fix:** replace all HOW with WHAT:
```
ORDER-01: When a support agent submits a customer email, the lookup tool shall return the
          orders associated with that email from the last 90 days.
ORDER-03: If a lookup finds no orders for the submitted email, the lookup tool shall show
          an explicit no-orders-found message rather than an empty screen.
```
Locked Decision WHAT: "The tool is read-only and never changes or cancels an order."
Auth mechanism → NFR-SEC-01: "Only authenticated internal support staff may perform a lookup."

### 6. Acceptance Criteria are untestable (placeholder hits — CONTRACT §9)

```
- The endpoint returns data fast.
- The UI doesn't crash.
```

- `"fast"` is a placeholder (`performant`-equivalent, CONTRACT §9) → BLOCKER.
- "doesn't crash" is the absence of an observable outcome, not a positive testable statement.
- Neither uses the `"Passes when …"` format.
- Neither has an AC ID.

**Fix (in ACCEPTANCE.md, per v2 shape):**
```gherkin
## AC-ORDER-01-01: Agent email lookup returns orders

**Covers:** ORDER-01

**Type:** functional

```gherkin
Given a customer email that has orders in the last 90 days
When a support agent submits that email in the lookup tool
Then the tool displays the customer's orders from the last 90 days
```

**Plain-language explanation:** A support agent types a customer's email and sees a list of
that customer's recent orders. This confirms the lookup returns real data and not an empty
or error screen.

**Observable evidence:** The listed orders match records in the system for that customer within
the 90-day window.
```

### 7. Reader Test failure (CONTRACT §11)

A fresh reader receiving ONLY this PRD cannot infer:
- **Problem / desired outcome** — no Executive Summary, no problem statement
- **Scope boundary** — is editing orders in scope? Not stated (only "mobile app" excluded)
- **Constraints** — "p95 < 2s" — under what conditions? What environment?
- **Acceptance** — "returns data fast" / "doesn't crash" — no independent tester can verify these
- **Readiness** — `handoff_status: READY` is machine-contract language, not a human verdict section

Result: `READER_TEST_FAIL` → gate verdict `BLOCKED`.

---

## Summary of defects

| Defect class | Location | Severity |
|---|---|---|
| `DOWNSTREAM_COMMAND_LEAK` | "How to feed GSD" section, `/gsd:ingest-docs`, `/gsd:plan-phase` | BLOCKER |
| `IMPLEMENTATION_LEAK` | Goals, ORDER-01, ORDER-02, ORDER-03, Locked Decisions | BLOCKER |
| `IMPLEMENTATION_LEAK` | Constraints ("Use PostgreSQL") | MAJOR |
| `PLACEHOLDER` | Acceptance ("fast", "doesn't crash") | BLOCKER |
| `SCOPE_LEAK` | Goals (Phase 1/Phase 2 roadmap in a single stuffed sentence) | MAJOR |
| `READER_TEST_FAIL` | No Executive Summary; untestable ACs; p95 without context | BLOCKER |
| `UNTESTABLE` | Both acceptance criteria | BLOCKER |
| Missing `## Executive Summary` | PRD.md structure | MAJOR (`prd_has_executive_summary`) |
| Goals not a structured table | PRD.md structure | gate finding |
| Machine-contract frontmatter (`handoff_status`) | Frontmatter | MAJOR (`no_machine_contract_language`) |
