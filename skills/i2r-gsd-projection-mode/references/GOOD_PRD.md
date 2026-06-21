---
type: prd
source: idea-to-requirements-orchestrator
handoff_status: READY
---
# An internal lookup tool that lets a support agent enter a customer email and see

## Goals
- An internal lookup tool that lets a support agent enter a customer email and see that customer's recent orders and their status, so order-status calls are answered without escalation.
- Order-status calls resolved without escalation: 90% resolved within the call

## Non-Goals / Out of Scope
- Editing or cancelling orders — Tool is read-only per locked decision
- (deferred) Lookup by phone number

## Requirements
### ORDER
ORDER-01: When a support agent submits a customer email, the lookup tool shall return the orders associated with that email from the last 90 days.
ORDER-02: When orders are returned for a lookup, the lookup tool shall display each order's current status.
ORDER-03: If a lookup finds no orders for the email, then the lookup tool shall show an explicit no-orders-found message rather than an empty screen.

## Acceptance Criteria
- AC-ORDER-01-01: Passes when submitting a known customer's email lists that customer's orders from the last 90 days.
- AC-ORDER-02-01: Passes when every order in the results shows its current status.
- AC-ORDER-03-01: Passes when an email with no matching orders shows an explicit no-orders-found message.

## Constraints
- NFR-PERF-01 [Performance Efficiency]: A lookup returns results within the time an agent can hold a live call (fit: p95 lookup response time <= 2 seconds @ internal support workstation on the office network, measured each release)
- NFR-SEC-01 [Security]: Only authenticated internal staff can perform a lookup (fit: 100% of lookups require an authenticated internal session @ production, every request)
- access: Internal support staff only

## Locked Decisions
- The tool is read-only and never changes or cancels an order

## Open Questions
- (none)

## How to feed GSD
- /gsd:ingest-docs            (full bootstrap; classified as PRD)
- /gsd:plan-phase --prd PRD.md (lightweight single-doc)
