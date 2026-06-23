# BAD_EXAMPLE — Non-Functional Requirements

Each example shows the bad NFR, the defect class(es), why it is wrong, and the corrected version.

---

## Bad NFR 1 — Vague threshold ("must be fast")

```json
{
  "id": "NFR-PERF-01",
  "iso25010_category": "Performance Efficiency",
  "coverage_status": "required",
  "description": "The system must be fast and responsive",
  "fit_criterion": {
    "threshold": "fast response times",
    "environment": "production",
    "period": "always"
  },
  "priority": "MUST",
  "source_ref": "raw/idea.md#L3"
}
```

**Defect class:** `PLACEHOLDER` (BLOCKER)

**Why it is wrong:**
- "fast and responsive" in `description` contains two banned terms: "fast" and "responsive" (implied by "fast"). No measurable condition is given.
- "fast response times" in `threshold` is not a threshold — it is a paraphrase of the description. There is no number, no percentile, no comparison operator.
- "always" in `period` is too vague to drive a test schedule.
- A QA engineer cannot write a meaningful acceptance test from this NFR.

**Corrected version:**

```json
{
  "id": "NFR-PERF-01",
  "iso25010_category": "Performance Efficiency",
  "coverage_status": "required",
  "description": "A lookup returns results within the time an agent can hold a live call without the customer noticing a delay",
  "fit_criterion": {
    "threshold": "p95 lookup response time <= 2 seconds",
    "environment": "internal support workstation on the office network, under average weekday load",
    "period": "measured each release against a representative 500-order dataset"
  },
  "measurement_method": "timing instrumentation on the lookup action, sampled over 1 000 consecutive runs",
  "priority": "MUST",
  "source_ref": "raw/idea.md#L3"
}
```

The business meaning ("within the time an agent holds a live call") is preserved in `description`. The measurable condition (p95 ≤ 2 s) moves to `threshold`. The environment and period are explicit.

---

## Bad NFR 2 — Vague security requirement (no measurable threshold)

```json
{
  "id": "NFR-SEC-01",
  "iso25010_category": "Security",
  "coverage_status": "required",
  "description": "The system must be secure",
  "fit_criterion": {
    "threshold": "secure and protected",
    "environment": "all environments",
    "period": "at all times"
  },
  "priority": "MUST",
  "source_ref": "raw/idea.md#L6"
}
```

**Defect class:** `PLACEHOLDER` (BLOCKER) + `UNTESTABLE` (MAJOR)

**Why it is wrong:**
- "must be secure" and "secure and protected" are the two most-banned placeholder terms in security NFRs. They say nothing about WHAT must be protected, WHO is excluded, or HOW success is measured.
- "all environments" and "at all times" give no test boundary.
- There is no acceptance criterion that could be derived from this.

**Corrected version — split into two measurable NFRs:**

```json
[
  {
    "id": "NFR-SEC-01",
    "iso25010_category": "Security",
    "coverage_status": "required",
    "description": "Only authenticated internal staff can perform a lookup; unauthenticated requests are rejected",
    "fit_criterion": {
      "threshold": "100% of lookup requests require an authenticated internal session; 0% of unauthenticated requests return order data",
      "environment": "production",
      "period": "every request, verified by access-control review each release"
    },
    "measurement_method": "access-control review plus random audit-log sampling of 50 requests per release",
    "priority": "MUST",
    "source_ref": "raw/idea.md#L6"
  },
  {
    "id": "NFR-SEC-02",
    "iso25010_category": "Security",
    "coverage_status": "required",
    "description": "All access events are retained in an audit log so that a lookup can be traced to a specific staff member after the fact",
    "fit_criterion": {
      "threshold": "audit log retains 100% of lookup events for >= 90 days with no gaps",
      "environment": "production",
      "period": "continuously; verified by log-completeness check each release"
    },
    "measurement_method": "automated log-completeness script comparing event count against the transaction count in each release window",
    "priority": "MUST",
    "source_ref": "raw/idea.md#L6"
  }
]
```

---

## Bad NFR 3 — Missing fit_criterion on a required NFR + implementation leak

```json
{
  "id": "NFR-REL-01",
  "iso25010_category": "Reliability",
  "coverage_status": "required",
  "description": "The PostgreSQL database must be highly available using a read-replica failover configuration",
  "priority": "MUST",
  "source_ref": "raw/idea.md#L3"
}
```

**Defect class:** `IMPLEMENTATION_LEAK` (BLOCKER) + missing `fit_criterion` (gate block)

**Why it is wrong:**
- The `description` names a specific database product ("PostgreSQL"), a specific architecture pattern ("read-replica failover"), and an implementation configuration. This is a HOW leak. Stack-swap test fails: switching the data store forces a rewrite.
- There is no `fit_criterion` at all. A `required` NFR without `fit_criterion` → gate blocks unconditionally.
- "highly available" is a vague adjective without a number.

**Corrected version:**

```json
{
  "id": "NFR-REL-01",
  "iso25010_category": "Reliability",
  "coverage_status": "required",
  "description": "The lookup tool remains available during support-team working hours so agents are never blocked from accessing order data",
  "fit_criterion": {
    "threshold": "availability >= 99.5% across each calendar month, excluding scheduled maintenance windows announced >= 24 hours in advance",
    "environment": "production, during 08:00–20:00 local support-team hours",
    "period": "each calendar month"
  },
  "measurement_method": "uptime monitoring with 1-minute polling, automated monthly report",
  "priority": "MUST",
  "source_ref": "raw/idea.md#L3"
}
```

The availability target (99.5%) and time boundary (working hours) are expressed in business terms. No database or infrastructure technology is named.
