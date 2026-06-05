# QA orchestrator schemas

All schemas under this directory **MUST** declare:

```json
"$schema": "http://json-schema.org/draft-07/schema#"
```

## Why draft-07 only

The Claude Code Workflow tool's internal `ajv` validator ships only the
**draft-07** meta-schema. Schemas declaring `draft-2020-12` (the modern default)
will throw `no schema with key or ref ".../draft/2020-12/schema"` at
validation time — wasting tokens and producing confusing errors.

See: AppSec `schemas/README.md` (same constraint, same lesson) and
`ORCHESTRATION-MIGRATION-PLAN.md` §A.1.4 / N2 + reviewer R14.

## Enforcement

`tests/lint-schemas.sh` (B.1.d) greps every `*.json` here for the draft-07
literal string and fails with the offending file path if any drifts.

`tests/validate-all-presets.sh` (B.1.d) calls `lint-schemas.sh` as a sub-step
so a single `bash validate-all-presets.sh` proves both spec validity AND
schema draft compliance.

## Schema list

| Schema | Used by node | Purpose |
|---|---|---|
| `RISK_CLASSIFY_SCHEMA.v1.json` | (Skill main thread — pre-preview Agent call) | Risk snapshot output of `qa-risk-classifier` invoked BEFORE Workflow per reviewer R4 Option A |
| `LAYER_SELECT_SCHEMA.v1.json` | `LayerSelect` (single) | QA layer dispatch decision based on risk_snapshot + changed surfaces |
| `STATIC_BASELINE_SCHEMA.v1.json` | `StaticBaseline` (single agent) | tsc + eslint + prettier + npm-audit + git-secrets command_evidence + parsed counts |
| `COMPONENT_TEST_SCHEMA.v1.json` | `UnitOrComponent` / `ComponentOrContract` (fanout) | Per-surface component test run output |
| `CONTRACT_TEST_SCHEMA.v1.json` | `ComponentOrContract` (fanout, contract subset) | OpenAPI / Pact / GraphQL contract check output |
| `E2E_SCENARIO_SCHEMA.v1.json` | `E2E` (pipeline stage) | Playwright / Vercel-Agent-Browser scenario output |
| `FLAKY_TRIAGE_SCHEMA.v1.json` | `FlakyTriage` (single) | 8-category flaky classification + 8-field quarantine accountability |
| `EVIDENCE_BUNDLE_SCHEMA.v1.json` | `EvidenceBundle` (single) | Final aggregation + release decision + dispatch_failures + workflow-state persistence |
| `GATE_DECISION_SCHEMA.v1.json` | `Gate` / `StaticGate` / `VisualGate` / `A11yGate` / `PerfGate` (deterministic) | Documented schema for deterministic ops outputs (NOT agent-validated; for reference) |
| `PERF_AUDIT_SCHEMA.v1.json` | `PerfAudit` (single/fanout agent — commercial-cert only) | Lighthouse CI / bundle analyzer metrics evidence per reviewer R9 |
| `VISUAL_AUDIT_SCHEMA.v1.json` | `VisualAudit` (fanout agent — commercial-cert only) | Playwright/Storybook snapshot diff evidence per reviewer R9 |
| `A11Y_AUDIT_SCHEMA.v1.json` | `A11yAudit` (single agent — commercial-cert only) | axe-core / Lighthouse-a11y / pa11y violation evidence per reviewer R9 |

## Field discipline

- `additionalProperties: false` is **discouraged** at top level — Workflow agents commonly attach diagnostic fields. Use it only for nested strict sub-objects.
- Every schema includes `command_evidence` (array of `{cmd, stdout, exit_code}`) where the node runs external commands. This is the audit trail enterprise-qa-testing §16 schema_registry expects.
- `release_decision` enum: `PASS | FAIL | BLOCKED | CONDITIONAL_PASS | MISSING`. `MISSING` is the reviewer-R7 status injected by `map_null_outputs_to_missing` invariant for dropped fanout/pipeline items.
