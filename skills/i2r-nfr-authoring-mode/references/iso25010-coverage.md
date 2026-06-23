# ISO/IEC 25010:2023 Coverage Guide

Source: ISO/IEC 25010:2023 "Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model".

> Every NFR set must address all 9 characteristics below — explicitly required, not_applicable, or deferred. No characteristic may be silently skipped.

---

## The 9 Quality Characteristics (2023 edition)

The 2023 revision replaced "Usability" with **Interaction Capability** and "Portability" with **Flexibility**. Use 2023 names; the schema accepts the 2017 aliases as input but normalises them.

| # | Characteristic | Short ID (for NFR id prefix) | Core question |
|---|---|---|---|
| 1 | Functional Suitability | `FUNC` | Does the product do what users need it to do correctly and completely? |
| 2 | Performance Efficiency | `PERF` | How fast, how much resource, under what load? |
| 3 | Compatibility | `COMPAT` | Does it coexist and exchange data with other systems? |
| 4 | Interaction Capability | `INT` | Can users operate it effectively, efficiently, and without errors? |
| 5 | Reliability | `REL` | How available and fault-tolerant is it over time? |
| 6 | Security | `SEC` | Does it protect data and resist unauthorised access? |
| 7 | Maintainability | `MAINT` | How easy is it to modify, test, and fix? |
| 8 | Flexibility | `FLEX` | How well can it adapt to different environments or configurations? |
| 9 | Safety | `SAFETY` | Does it avoid unacceptable risk of harm to people or assets? |

---

## Characteristic-by-characteristic guidance

### 1. Functional Suitability (`FUNC`)
- Sub-qualities: Functional Completeness, Functional Correctness, Functional Appropriateness.
- **When required:** almost always — write at least one NFR for data-correctness or completeness if the product handles records, calculations, or reports.
- **When NA:** rarely; only for purely infrastructure components with no user-facing function.
- **Fit criterion examples:** "100% of orders returned by a lookup match the customer's email with zero false negatives, verified against a regression dataset of 500 known orders." / "Calculated totals match the reference formula to within ±0.01 currency units."

### 2. Performance Efficiency (`PERF`)
- Sub-qualities: Time Behaviour, Resource Utilisation, Capacity.
- **When required:** any product with a user-facing response or a throughput constraint.
- **Common thresholds:** p50 / p95 / p99 latency; requests-per-second; CPU/memory ceiling; max concurrent users.
- **Fit criterion example:** "p95 response time ≤ 2 s, measured over 100 concurrent sessions on a representative staging environment, in each release cycle."
- **Benign failure lens — cost-capacity:** write an NFR for what happens when throughput or storage approaches a limit (graceful degradation, cost ceiling, capacity alarm).

### 3. Compatibility (`COMPAT`)
- Sub-qualities: Co-existence, Interoperability.
- **When required:** integrations with external systems; import/export; browsers; API consumers.
- **When NA:** fully self-contained tools with no integration surface.
- **Fit criterion example:** "All data exports conform to the agreed schema version so any consumer can parse them without modification."

### 4. Interaction Capability (`INT`)
- Sub-qualities: Appropriateness Recognisability, Learnability, Operability, User Error Protection, User Engagement, Inclusivity, User Assistance, Self-Descriptiveness.
- **When required:** any product with a human-facing interface.
- **Common thresholds:** WCAG conformance level; task-completion rate; error rate; first-use learnability time.
- **When deferred:** if the target user group or accessibility level is not yet agreed, mark deferred + `deferred_missing_info`.
- **Fit criterion example:** "A first-time support agent completes the order-lookup task without assistance in ≤ 3 minutes, tested with 5 representative users during UAT."

### 5. Reliability (`REL`)
- Sub-qualities: Faultlessness, Availability, Fault Tolerance, Recoverability.
- **When required:** any product used in production or by paying customers.
- **Common thresholds:** uptime % (99.5%, 99.9%); MTTR; max data loss window; recovery time objective.
- **Fit criterion example:** "The service is available ≥ 99.5% of time in each calendar month, excluding scheduled maintenance windows announced ≥ 24 h in advance."
- **Benign failure lens — retry storms:** write an NFR for back-off behaviour when a dependency is unavailable.
- **Benign failure lens — concurrent invocation:** write an NFR for the maximum number of simultaneous requests without degraded correctness.

### 6. Security (`SEC`)
- Sub-qualities: Confidentiality, Integrity, Non-Repudiation, Accountability, Authenticity, Resistance.
- **When required:** any product that handles personal data, financial data, or access-controlled resources.
- **Common thresholds:** "100% of authenticated endpoints require a valid session"; "audit log retains all access events for ≥ 90 days"; "no PII transmitted without encryption".
- **Fit criterion example:** "100% of order-lookup requests require an authenticated internal session, verified by access-control review and audit-log sampling each release."

### 7. Maintainability (`MAINT`)
- Sub-qualities: Modularity, Reusability, Analysability, Modifiability, Testability.
- **When required:** any product expected to evolve beyond v1.
- **Common thresholds:** test coverage %; cyclomatic complexity ceiling; max coupling metric.
- **When NA:** one-off throwaway scripts with no future maintenance expectation.
- **Fit criterion example:** "Automated test suite covers ≥ 80% of branching paths, verified by CI on each merge."

### 8. Flexibility (`FLEX`)
- Sub-qualities: Adaptability, Scalability, Installability, Replaceability.
- **When required:** products deployed to multiple environments, expected to scale, or replacing an existing system.
- **When NA:** fixed single-tenant deployments with no scalability requirement.
- **Fit criterion example:** "The product can be configured for a new tenant by changing only environment-level settings, without source code changes."
- **Benign failure lens — failure cascade:** write an NFR for how the product behaves when a dependency fails (circuit-breaker, fallback, graceful degradation).

### 9. Safety (`SAFETY`)
- Sub-qualities: Operational Constraint, Risk Identification, Fail Safe, Hazard Warning, Safe Integration.
- **When required:** products controlling physical systems, healthcare, financial transactions, or any domain where failure causes harm to people or assets.
- **When NA:** purely informational, read-only products in low-risk domains — state the reason explicitly.
- **Fit criterion example:** "Any transaction above the approval threshold is held for manual review before execution, with zero exceptions, tested on 100% of staging transactions in each release."

---

## Benign-failure lenses (supplement to the 9 characteristics)

These are systematic failure modes that are not attacker-driven. They should be covered under the relevant characteristic.

| Lens | Where to add | What to cover |
|---|---|---|
| **Retry storms** | Reliability (`REL`) | Back-off policy when a dependency is unavailable; max retry budget |
| **Concurrent invocation** | Reliability (`REL`) or Performance (`PERF`) | Correct behaviour under simultaneous requests; no data corruption |
| **Unbounded resource** | Performance (`PERF`) | CPU, memory, storage, or cost ceiling before graceful degradation |
| **Failure cascade** | Flexibility (`FLEX`) or Reliability (`REL`) | Partial-dependency failure handled without total outage |
| **Cost runaway** | Performance (`PERF`) | Hard stop or alerting before spend exceeds agreed ceiling |
| **Capacity ceiling** | Performance (`PERF`) or Flexibility (`FLEX`) | Defined maximum load; graceful degradation beyond it |

---

## Coverage matrix (use as a writing checklist)

```
For each characteristic:
  [ ] At least one nfr[] item present
  [ ] coverage_status is explicitly set (required / not_applicable / deferred)
  [ ] If not_applicable: na_reason explains WHY
  [ ] If deferred: deferred_missing_info names WHAT information is missing
  [ ] If required: fit_criterion has threshold + environment + period (all non-empty)
```
