# BAD_EXAMPLE — Functional Requirements

Each example shows the bad requirement, the defect class, why it is wrong, and the corrected version.

---

## Bad FR 1 — Implementation leak

```json
{
  "id": "ORDER-01",
  "capability": "order-lookup-by-email",
  "ears_pattern": "event_driven",
  "trigger": "a support agent submits a customer email",
  "system_name": "the lookup tool",
  "system_response": "query the `orders` PostgreSQL table via the `/api/v2/orders?email=` endpoint and return matching rows as JSON",
  "rendered": "When a support agent submits a customer email, the lookup tool shall query the `orders` PostgreSQL table via the `/api/v2/orders?email=` endpoint and return matching rows as JSON.",
  "priority": "MUST",
  "source": "stated",
  "source_ref": "raw/idea.md#L4",
  "acceptance_ids": ["AC-ORDER-01-01"]
}
```

**Defect class:** `IMPLEMENTATION_LEAK` (BLOCKER)

**Why it is wrong:** The `system_response` names a specific database table (`orders`), a database engine (`PostgreSQL`), an API path (`/api/v2/orders?email=`), and a wire format (`JSON`). Stack-swap test fails: switching from PostgreSQL to any other store, or renaming the endpoint, forces a rewrite of this requirement.

**Corrected version:**

```json
{
  "system_response": "return the orders associated with that email from the last 90 days",
  "rendered": "When a support agent submits a customer email, the lookup tool shall return the orders associated with that email from the last 90 days."
}
```

The WHAT (return matching orders) is preserved. The HOW (table, engine, endpoint, format) is gone.

---

## Bad FR 2 — Hidden conjunction (two behaviours in one requirement)

```json
{
  "id": "NOTIF-01",
  "capability": "order-status-notification",
  "ears_pattern": "event_driven",
  "trigger": "an order status changes",
  "system_name": "the notification service",
  "system_response": "send an email to the customer and update the order status badge in the agent dashboard",
  "rendered": "When an order status changes, the notification service shall send an email to the customer and update the order status badge in the agent dashboard.",
  "priority": "MUST",
  "source": "stated",
  "source_ref": "raw/idea.md#L7",
  "acceptance_ids": ["AC-NOTIF-01-01"]
}
```

**Defect class:** `AMBIGUITY` (MAJOR)

**Why it is wrong:** The word "and" joins two completely distinct, independently testable behaviours: (1) sending a customer email; (2) updating a UI badge in a different surface. They have different actors, different channels, and different acceptance criteria. Lumping them makes individual verification impossible.

**Corrected version — split into two requirements:**

```json
[
  {
    "id": "NOTIF-01",
    "system_response": "send a notification to the customer that their order status has changed",
    "rendered": "When an order status changes, the notification service shall send a notification to the customer that their order status has changed."
  },
  {
    "id": "NOTIF-02",
    "system_response": "reflect the updated order status in the agent's current view without requiring a manual refresh",
    "rendered": "When an order status changes, the agent dashboard shall reflect the updated order status in the agent's current view without requiring a manual refresh."
  }
]
```

---

## Bad FR 3 — Vague / placeholder term + missing unwanted sibling

```json
{
  "id": "AUTH-01",
  "capability": "agent-authentication",
  "ears_pattern": "event_driven",
  "trigger": "a support agent attempts to log in",
  "system_name": "the authentication system",
  "system_response": "securely authenticate the agent and grant access quickly",
  "rendered": "When a support agent attempts to log in, the authentication system shall securely authenticate the agent and grant access quickly.",
  "priority": "MUST",
  "source": "stated",
  "source_ref": "raw/idea.md#L2",
  "acceptance_ids": ["AC-AUTH-01-01"]
}
```

**Defect class:** `PLACEHOLDER` (BLOCKER) + `AMBIGUITY` (MAJOR)

**Why it is wrong:**
- "securely" and "quickly" are placeholder adjectives banned by `placeholder_scan`. Neither is measurable without a threshold.
- There is no `unwanted` sibling for the case where authentication fails — a critical missing behaviour for any access-control requirement.

**Corrected version — strip vague terms, add measurable intent in rationale, and add unwanted sibling:**

```json
[
  {
    "id": "AUTH-01",
    "ears_pattern": "event_driven",
    "trigger": "a support agent submits valid credentials",
    "system_name": "the authentication system",
    "system_response": "grant the agent an authenticated session",
    "rendered": "When a support agent submits valid credentials, the authentication system shall grant the agent an authenticated session.",
    "rationale": "Speed and security thresholds are captured as NFRs (NFR-PERF-xx, NFR-SEC-xx); this requirement states only the observable access outcome.",
    "priority": "MUST",
    "source": "stated",
    "source_ref": "raw/idea.md#L2",
    "acceptance_ids": ["AC-AUTH-01-01"]
  },
  {
    "id": "AUTH-02",
    "ears_pattern": "unwanted",
    "trigger": "a support agent submits invalid credentials",
    "system_name": "the authentication system",
    "system_response": "deny access and show a specific authentication-failure message without revealing which part of the credentials was wrong",
    "rendered": "If a support agent submits invalid credentials, then the authentication system shall deny access and show a specific authentication-failure message without revealing which part of the credentials was wrong.",
    "priority": "MUST",
    "source": "assumed",
    "source_ref": "raw/idea.md#L2",
    "acceptance_ids": ["AC-AUTH-02-01"]
  }
]
```

Note: measurable performance and security thresholds move to `05-nfr.json` with a proper `fit_criterion`.
