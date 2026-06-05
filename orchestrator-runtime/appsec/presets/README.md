# AppSec Workflow Presets

Spec presets consumed by `~/.claude/workflows/appsec-orchestrator.js`. Each
preset is a complete `spec` (engine_version + orchestrator + phases +
prompts/schemas inline maps + ops_allowed whitelist) with empty `prompts: {}`
and `schemas: {}` — the Skill main thread inlines prompt bodies (from
`../prompts/<ref>.md`) and schema bodies (from `../schemas/<ref>.json`)
before calling `Workflow()`.

| Preset | ASVS | Overlays | severity_floor (recommended) | Verify pipeline | Notes |
|---|---|---|---|---|---|
| `smoke.json`              | L1 | none      | low    | NO (no Verify phase)  | 7 phases, 2 finders, used for harness smoke test |
| `l1-default.json`         | L1 | none      | low    | NO (Normalize-only)   | 9 phases, low-tier production baseline |
| `l2-default.json`         | L2 | none      | low    | YES (1/1/3/3)         | 10 phases, default for most commercial backends |
| `l2-cn-data.json`         | L2 | cn_data   | medium | YES (1/1/3/3)         | 11 phases, +overlay-cn_data persist (PIPL/DSL/CSL) |
| `l3-payment.json`         | L3 | payment   | medium | YES (1/3/5/5 + sonnet pass) | 11 phases, strictest verify, +overlay-payment persist (PCI-DSS) |
| `incident-response.json`  | any | none     | n/a    | SKIPPED               | 8 phases, Skill MUST seed previous_results.Normalize with known findings |

## Skill-side responsibilities per preset

### l1-default
- `ctx.finders` = subset of available finders for L1 (sca / secret-scan / sast / code-review / headers-cookies typically sufficient)
- `severity_floor = "low"`
- `policy.required_csf_functions = ["Govern","Identify","Protect","Detect"]` (RS/RC optional at L1)

### l2-default
- Default `ctx.finders` = all 11 finders Skill discovered via §16.1 classifier
- `severity_floor` from `.appsec/config.json` (typically `low`)
- `policy.required_csf_functions = ["Govern","Identify","Protect","Detect","Respond","Recover"]` (all 6)

### l2-cn-data
- All of l2-default, PLUS inject
  `{key:"cn_data", sub_skill:"security-compliance-cn-data", csf:["Govern","Identify","Protect","Respond"], oracle_hints:["PIPL","DSL","CSL"]}` into `ctx.finders`
- `severity_floor = "medium"` recommended

### l3-payment
- All of l2-default, PLUS inject
  `{key:"payment", sub_skill:"security-compliance-payment", csf:["Govern","Identify","Protect","Detect","Respond","Recover"], oracle_hints:["PCI-DSS-v4"]}` into `ctx.finders`
- `severity_floor = "medium"` or `"low"` (NEVER `"high"` at L3)
- Verify pipeline runs 2 stages: stage-1 haiku 1/3/5/5 vote, stage-2 sonnet 1/1/1/1 final check

### incident-response
- Invoked when `.appsec/state.json.lifecycle_stage == "incident"`
- Skill MUST seed `ctx.previous_results.Normalize = { findings: [<the known incident findings>] }` so Map/Gate see them
- Skill MUST seed `ctx.previous_results.Find = { /* empty per-finder map, just to satisfy resume contract */ }`
- `policy.required_csf_functions = ["Respond","Recover"]` (scope down to incident-relevant)
- No Verify (the incident is already triaged)

## Validation

Run `bash ../tests/validate-all-presets.sh` to validate every preset against
`~/.claude/orchestrator-runtime/shared/orchestrator-spec.v1.json`.

JSON does not support inline comments. Use this README instead of `_comment`
fields — the spec schema is strict (`additionalProperties: false` at root).
