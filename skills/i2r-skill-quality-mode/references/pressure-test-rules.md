# Pressure-Test Seed Scenarios — reference

> Owned by `i2r-skill-quality-mode`. Five mandatory seed scenarios that any I2R skill set must survive.
> Each lives as a file under `evals/pressure-scenarios/`. Summaries here; full prompts in those files.

---

## Scenario 1: vague-founder-idea

**Slug:** `vague-founder-idea`

**Raw input sketch:**
> "I want to build something like Notion but for lawyers. It should be smart, fast, and secure."

**Expected naive failure (defect classes):**
- `PLACEHOLDER` — "smart", "fast", "secure" promoted directly into NFR fields without fit criteria
- `UNTESTABLE` — no threshold, environment, or period on any NFR
- `AMBIGUITY` — "for lawyers" not broken into actors with specific jobs

**What a skill-armed agent must do:**
- Elicit at least one concrete actor (`attorneys`, `paralegals`, `clients`?) with a specific job-to-be-done
- Flag "smart", "fast", "secure" as placeholder language (CONTRACT §9) and surface them as `open_questions` rather than requirements
- Produce 0 NFRs without a real `fit_criterion`

**Defect classes caught:** `PLACEHOLDER`, `UNTESTABLE`, `AMBIGUITY`

**Skill under test:** `i2r-elicitation-mode`, `i2r-nfr-authoring-mode`

---

## Scenario 2: implementation-leak-trap

**Slug:** `implementation-leak-trap`

**Raw input sketch:**
> "We need a microservices architecture with a React frontend, Postgres database, and a REST API layer. Users should be able to reset their password."

**Expected naive failure (defect classes):**
- `IMPLEMENTATION_LEAK` — microservices, React, Postgres, REST leak HOW into requirement text; stack-swap test fails

**What a skill-armed agent must do:**
- Separate WHAT (users can recover account access via credential reset) from HOW (micro/mono, React, Postgres, REST)
- Write the requirement so that swapping Postgres for MySQL forces zero requirement edits
- Record the stated tech choices as `decisions[]` or `assumed[]` at intake, NOT as requirement text

**Defect classes caught:** `IMPLEMENTATION_LEAK`, `SCOPE_LEAK`

**Skill under test:** `i2r-fr-authoring-mode`, `i2r-elicitation-mode`

---

## Scenario 3: conflicting-scope

**Slug:** `conflicting-scope`

**Raw input sketch:**
> "The app is for both B2B enterprise clients and individual consumers. It should have a mobile app and a web app. But we only have 6 weeks."

**Expected naive failure (defect classes):**
- `CONFLICT` — B2B enterprise + individual consumer actors have conflicting auth/permission models not flagged
- `SCOPE_LEAK` — "mobile app and web app" scoped in without a stated constraint or decision

**What a skill-armed agent must do:**
- Surface the B2B vs B2C conflict as a `blocking` open question (requires_discussion = blocking)
- Record the multi-surface assumption as `assumed[]` with `risk: high` at intake
- Trigger discussion-mode if discussion gate is required by routing

**Defect classes caught:** `CONFLICT`, `AMBIGUITY`

**Skill under test:** `i2r-scope-mode`, `i2r-discussion-mode`

---

## Scenario 4: fake-nfr

**Slug:** `fake-nfr`

**Raw input sketch:**
> "The system must be highly available, very fast, and enterprise-grade secure. Also GDPR compliant."

**Expected naive failure (defect classes):**
- `PLACEHOLDER` — "highly available", "very fast", "enterprise-grade secure" are placeholder NFR values
- `UNTESTABLE` — no threshold / environment / period present
- `NFR_MISSING` — GDPR is a compliance constraint, not an NFR; naive agent may omit the constraint entirely or misfiled

**What a skill-armed agent must do:**
- Reject placeholder NFR text (CONTRACT §9 placeholder_scan list)
- Demand a real `fit_criterion` per NFR: `{ threshold: "99.9% uptime", environment: "production", period: "rolling 30 days" }`
- Record GDPR as a `constraints[]` entry in `02-context.json` with `type: regulatory`, not as an NFR without fit criterion

**Defect classes caught:** `PLACEHOLDER`, `UNTESTABLE`, `NFR_MISSING`

**Skill under test:** `i2r-nfr-authoring-mode`

---

## Scenario 5: overconfident-prd

**Slug:** `overconfident-prd`

**Raw input sketch:** A fully written PRD handed to the critic that looks complete — has actors, requirements, NFRs, acceptance criteria — but contains:
- One requirement with a hidden conjunction ("The system shall search AND filter AND sort results in one action")
- One NFR with `fit_criterion: { threshold: "fast", environment: "production", period: "as needed" }`
- One acceptance criterion referencing a specific API endpoint name

**Expected naive failure (defect classes):**
- `AMBIGUITY` — hidden conjunction in one requirement
- `PLACEHOLDER` — "fast" and "as needed" in fit_criterion
- `IMPLEMENTATION_LEAK` — API endpoint name in acceptance criterion

**What a skill-armed agent (completeness-critic) must do:**
- Flag the conjunction as AMBIGUITY (MAJOR)
- Flag "fast"/"as needed" as PLACEHOLDER (BLOCKER per CONTRACT §9)
- Flag endpoint name as IMPLEMENTATION_LEAK (BLOCKER per CONTRACT §7 + §17.1 — implementation leakage is a hard FAIL)
- Overall verdict: FAIL (BLOCKER present)

**Defect classes caught:** `AMBIGUITY`, `PLACEHOLDER`, `IMPLEMENTATION_LEAK`

**Skill under test:** `i2r-debate-review-mode`, `i2r-fr-authoring-mode`
