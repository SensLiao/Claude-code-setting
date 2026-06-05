# AppSec Workflow Output Schemas

JSON Schema definitions for every agent node's output in the spec-driven
appsec orchestrator workflow. Each `*.json` file is inlined into
`spec.schemas[<REF>]` by the Skill builder before launch, and the
workflow body uses it as the `schema` parameter to `agent({schema: ...})`,
which forces StructuredOutput on the agent.

## Files

| File | $id | Consumed by phase |
|---|---|---|
| `SCOPE_SCHEMA.v1.json`     | `SCOPE_SCHEMA.v1`     | `Scope` (single) |
| `PLAN_SCHEMA.v1.json`      | `PLAN_SCHEMA.v1`      | `Plan` (single) |
| `FIND_SCHEMA.v1.json`      | `FIND_SCHEMA.v1`      | `Find` (fanout per finder) |
| `NORMALIZE_SCHEMA.v1.json` | `NORMALIZE_SCHEMA.v1` | `Normalize` (single) |
| `VOTE_SCHEMA.v1.json`      | `VOTE_SCHEMA.v1`      | `Verify` (pipeline, per vote) |
| `MAP_SCHEMA.v1.json`       | `MAP_SCHEMA.v1`       | `Map` (single) |
| `SYNTH_SCHEMA.v1.json`     | `SYNTH_SCHEMA.v1`     | `Synthesize` (single) |
| `PERSIST_SCHEMA.v1.json`   | `PERSIST_SCHEMA.v1`   | `PersistEvidence` / `Persist*Overlay` |

## Hard constraints (HARD-LEARNED)

### 1. `$schema` MUST be draft-07, NOT draft-2020-12

Discovered during P0 Step 2A smoke (2026-05-28). The Workflow tool's internal
`agent({schema: ...})` validator ships ONLY the draft-07 meta-schema. When given
a schema with `$schema: "https://json-schema.org/draft/2020-12/schema"`, the
workflow throws at the FIRST agent call with:

```
agent({schema}) received an invalid JSON Schema:
  no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
```

Zero tokens spent (fail-fast), but the launch fails. Every file in this
directory uses `$schema: "http://json-schema.org/draft-07/schema#"`.

The Skill-side `~/.claude/orchestrator-runtime/shared/validate-spec.js`
DOES support draft-2020-12 via the marketplace `ajv/dist/2020.js` build, so
external spec validation is unaffected. But agent-executed schemas must
target draft-07. If a new agent-executed schema is added, it MUST be draft-07.

This is enforced by convention only — there is no automated check that
schemas-under-`schemas/` are draft-07. A future hardening would add a CI
check like `grep -l 'draft/2020-12' schemas/*.json && exit 1`.

### 2. Schema features must be draft-07 compatible

Don't use draft-2019-09+ features even if the `$schema` says draft-07:
- ❌ `prefixItems` (use `items` with array form)
- ❌ `unevaluatedProperties` (use `additionalProperties`)
- ❌ `dependentSchemas` / `dependentRequired` (use `dependencies`)
- ❌ `$dynamicAnchor` / `$dynamicRef`

Currently-used (all safe): `type`, `additionalProperties`, `required`,
`properties`, `enum`, `pattern`, `minLength`, `minItems`, `minimum`, `maximum`.

### 3. `additionalProperties: false` everywhere

Strict by design — catches typos and extra fields immediately. Agent retries
on validation error, so strictness ≠ runtime fragility (it just costs retries).

## Validation tool

```bash
# Validate a single schema's spec-level use (run from this dir):
node ../shared/validate-spec.js ../presets/smoke.json

# Validate all 7 presets end-to-end with prompts/schemas inlined:
bash ../tests/validate-all-presets.sh
```

## Naming convention

`<UPPERCASE_NAME>.v<MAJOR>.json` where `MAJOR` is bumped on breaking changes.
Old version files SHOULD be kept (e.g. `FIND_SCHEMA.v1.json` and
`FIND_SCHEMA.v2.json` coexist) — presets pin their `schema_ref` to a specific
version, and bumping is opt-in per preset.
