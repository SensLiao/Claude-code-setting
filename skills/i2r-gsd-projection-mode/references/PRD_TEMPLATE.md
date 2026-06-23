---
title: <Product or feature name>
source: i2r
run_id: i2r-<slug>-<run-id>
readiness: <READY|NEEDS_REVIEW|BLOCKED>
lang: <zh|en>
generated_at: <ISO-8601>
---
# <Product or feature name>

## Executive Summary

| Field | Value |
|---|---|
| Problem | <One sentence: what pain/gap this addresses and for whom> |
| Desired outcome | <One sentence: what success looks like after this product exists> |
| Primary users | <Who uses this — role/persona, not technical group> |
| In scope | <Core capability boundary — what is definitely included> |
| Out of scope | <Explicit exclusions — what is definitely NOT included> |
| Locked decisions | <Decisions already made and not revisited — or "(none)"> |
| Main risks | <Top 1–2 risks if requirements are wrong or incomplete> |
| Readiness | <READY / NEEDS_REVIEW / BLOCKED — from gate-result.yaml> |

---

## Goals

| Goal | Target | Source | Confidence |
|---|---|---|---|
| <What the product achieves + why — one phrase> | <Measurable target, e.g. "90% resolved without escalation"> | <stated \| assumed \| decision> | <high \| medium \| low> |
| <Second goal if present> | <Target> | <Source> | <Confidence> |

---

## Non-Goals

- <Explicit exclusion — what this product does NOT do>
- (deferred) <Item deferred to a later phase>

---

## Scope

**In scope:** <One sentence or short list of what is included.>

**Out of scope:** <One sentence or short list of what is explicitly excluded.>

**Deferred:** <Items that are explicitly deferred for a later phase, if any. Otherwise "(none)".>

---

## Users, Actors, and Jobs-to-be-Done

| Actor | Role | Primary job | Success condition |
|---|---|---|---|
| <Actor name> | <Role/persona> | <What they are trying to accomplish> | <How they know they succeeded> |

---

## Requirements Overview

Detailed requirements, NFRs, and acceptance criteria are in the sibling documents:

- Full requirements (FR + NFR): see [REQUIREMENTS.md](./REQUIREMENTS.md)
- Acceptance criteria (Gherkin + plain language): see [ACCEPTANCE.md](./ACCEPTANCE.md)
- Locked decisions and ADRs: see [DECISIONS.md](./DECISIONS.md)
- Readiness verdict and checks: see [READINESS.md](./READINESS.md)

**Functional summary by category:**

### <CATEGORY_SLUG>

<CAT>-01: <EARS prose — WHAT the system shall do, not HOW. One behaviour per requirement.>
<CAT>-02: <EARS prose>

### <CATEGORY_SLUG_2>

<CAT2>-01: <EARS prose>

**NFR summary:**

- NFR-<ISOCAT>-01 [<iso25010_category>]: <One-sentence NFR statement with threshold if brief.>
- NFR-<ISOCAT>-02 [<iso25010_category>]: <One-sentence NFR statement.>
