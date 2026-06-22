# GOOD PRD — correct new-shape example

This PRD follows the v2 Markdown-first shape: Executive Summary first, structured Goals table,
correct scope sections, no HOW leaks, no downstream orchestration commands, Reader Test passes.

---

```markdown
---
title: Customer Order Lookup Tool
source: i2r
run_id: i2r-order-lookup-2026a
readiness: READY
lang: en
generated_at: 2026-06-22T10:00:00Z
---
# Customer Order Lookup Tool

## Executive Summary

| Field | Value |
|---|---|
| Problem | Support agents must manually navigate multiple internal systems to answer order-status calls, adding hold time and causing escalations |
| Desired outcome | Support agents can answer order-status calls within the call, without escalating |
| Primary users | Internal support agents handling customer order enquiries |
| In scope | Read-only lookup of a customer's recent orders and their statuses by email |
| Out of scope | Editing or cancelling orders; lookup by phone number; public-facing access |
| Locked decisions | Tool is read-only and never modifies or cancels an order |
| Main risks | If status data is delayed or stale, agents may give incorrect information to customers |
| Readiness | READY |

---

## Goals

| Goal | Target | Source | Confidence |
|---|---|---|---|
| Support agents can answer order-status calls without escalating | 90% of order-status calls resolved within the call | stated | high |
| Lookup is fast enough for a live call | p95 lookup response ≤ 2 seconds | stated | high |

---

## Non-Goals

- Editing or cancelling orders — the tool is read-only per locked decision
- (deferred) Lookup by phone number
- Public-facing customer self-service

---

## Scope

**In scope:** Read-only lookup of a customer's orders from the last 90 days, by email address.
Each result shows the order and its current status. An explicit no-results message when no orders
are found. Access limited to authenticated internal support staff.

**Out of scope:** Writing to orders (edit, cancel, refund). Phone-number lookup. Any public or
customer-facing interface.

**Deferred:** Lookup by phone number may be added in a later phase.

---

## Users, Actors, and Jobs-to-be-Done

| Actor | Role | Primary job | Success condition |
|---|---|---|---|
| Support agent | Internal staff, customer-facing | Quickly confirm a customer's order status during a live call | Finds the answer without putting the customer on hold or escalating |
| Support manager | Internal staff, oversight | Ensure calls are resolved without escalation | Escalation rate for order-status calls drops |

---

## Requirements Overview

Full requirements detail: see [REQUIREMENTS.md](./REQUIREMENTS.md).
Acceptance criteria: see [ACCEPTANCE.md](./ACCEPTANCE.md).
Locked decisions: see [DECISIONS.md](./DECISIONS.md).
Readiness verdict: see [READINESS.md](./READINESS.md).

### ORDER
ORDER-01: When a support agent submits a customer email, the lookup tool shall return the orders
          associated with that email from the last 90 days.
ORDER-02: When orders are returned for a lookup, the lookup tool shall display each order's
          current status.
ORDER-03: If a lookup finds no orders for the submitted email, the lookup tool shall show an
          explicit no-orders-found message rather than an empty screen.

**NFR summary:**
- NFR-PEF-01 [Performance Efficiency]: A lookup shall return results within the time an agent
  can hold a live call (p95 ≤ 2 seconds, measured each release on the internal network).
- NFR-SEC-01 [Security]: Only authenticated internal support staff may perform a lookup.
```

---

## Why this PRD is GOOD

### 1. Executive Summary is first (new requirement)

The `## Executive Summary` section appears immediately after the H1, before any other section.
It gives any reader — human or AI — an instant orientation: problem, outcome, users, scope
boundary, locked decisions, risks, and readiness. Gate check: `prd_has_executive_summary` ✓

### 2. Goals are a structured table, not a stuffed sentence

```markdown
| Goal | Target | Source | Confidence |
|---|---|---|---|
| Support agents can answer order-status calls without escalating | 90% … | stated | high |
```

Each goal has a signal phrase, a measurable target, a source, and a confidence. This is machine-
parseable AND human-readable. It is NOT a single sentence trying to do everything at once.

### 3. No HOW — stack-swap test passes

Every requirement states WHAT the system shall do, not HOW:
- "shall return orders" — not "query the orders table" or "call the REST endpoint"
- "shall display each order's current status" — not "render an OrderCard component"
- "shall show an explicit no-orders-found message" — not "return HTTP 204"

Swapping the database, framework, or API protocol requires zero edits to this PRD. ✓

### 4. No downstream orchestration commands

No `/gsd:*`, no `plan-phase`, no `ingest-docs`, no `next_command_hint`. A downstream AI system
reads this document the same way a PM does — and derives its own planning. ✓
Gate check: `no_downstream_commands` ✓

### 5. Correct light frontmatter

Six fields only: `title`, `source`, `run_id`, `readiness`, `lang`, `generated_at`.
No `handoff_status`, no `consumer_contract_version`, no machine-contract fields. ✓
Gate check: `no_machine_contract_language` ✓

### 6. Reader Test passes

A fresh reader with only this PRD can independently answer all nine questions:
1. **What to build** — read-only order lookup by email ✓
2. **Why** — resolve support calls without escalation ✓
3. **Who benefits** — internal support agents ✓
4. **What is explicitly out** — editing orders, phone lookup, public access ✓
5. **Which decisions are locked** — read-only, no modifications ✓
6. **Which assumptions are open** — none (all resolved) ✓
7. **How it is accepted** — ORDER-01/02/03 ACs in ACCEPTANCE.md, linked ✓
8. **Current readiness** — READY in Executive Summary and frontmatter ✓
9. **No HOW/WHEN/WHO leakage** — no tech stack, no phases, no tasks ✓

Gate check: `reader_test` = PASS ✓

---

## Summary of qualities

| Quality | Status |
|---|---|
| Executive Summary present and first | ✓ |
| Goals as structured table | ✓ |
| No HOW leaks | ✓ |
| No downstream orchestration commands | ✓ |
| No machine-contract frontmatter | ✓ |
| Scope explicit in all three dimensions | ✓ |
| Links to sibling docs | ✓ |
| Reader Test passes | ✓ |
