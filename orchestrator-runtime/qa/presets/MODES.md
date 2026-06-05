# QA orchestrator modes

Authoritative mode catalog. Mirrors `QA-PHASE-B-BLUEPRINT.md` §1, §2, §16 with R4/R5/R8/R9/R12/R13 corrections applied.

## §1. Mode catalog

| Mode | Preset | When | QA layers | Agents (count) | Budget (estimated) | Hard cap |
|---|---|---|---|---|---|---|
| `quick-check` | `quick-check.json` | PR feature branch / dev push / changed_lines<50 / no critical_path / no API contract / no component-behavior / no user-facing change (R5) | Static only | 3 single (fixed) | 30k–80k | 100k |
| `focused-qa-gate` | `focused-qa-gate.json` | PR-to-main / changed surface in {component, api-contract, single-feature} OR component-behavior / user-facing change (R5) | Static + Unit-TDD + Component + Contract (changed only) | 1 single + 1 single + 2-4 fanout (dynamic) + 1 single | 100k–250k | 300k |
| `release-readiness` | `release-readiness.json` | release_tag `/^v\d+\.\d+\.\d+/` (not pre-release) / staging→prod / user explicit | Above + Integration + Critical E2E + Smoke + Flaky governance | 2 single + 3-6 fanout + 1-3 pipeline items + 0-1 flaky + 1 evidence | 300k–800k | 1M |
| `commercial-cert` | `commercial-cert.json` | Customer-facing / regulated / explicit `/qa-commercial-cert` | All 9 + 3 cross-cutting (incl. Visual + A11y + Perf per R9) | ~10-15 single + 4-8 ComponentOrContract + 2-5 E2E + N Visual + 1 Perf | 1M–3M (REQUIRES BUDGET APPROVAL) | 3.5M |
| `smoke` (internal) | `smoke.json` | `bash tests/build-smoke-args.js` only | Static + Component (toy fixture) | 1 + 2 fixed-fanout + 1 = 4 agents | 100k–200k | 250k |
| `graph-smoke` (internal) | `graph-smoke.json` | Internal CI only | Static + Component + E2E (toy scenario) — all 4 node types | 3 single + 2 fixed-fanout + 1 pipeline | 180k–280k | 300k (R13) |

## §2. Mode selection algorithm

Per `QA-PHASE-B-BLUEPRINT.md` §2 (revised R4 + R5). Skill main thread runs this AFTER invoking `qa-risk-classifier` to obtain `risk_snapshot`.

```text
# Reviewer R4 architectural — RiskClassify is on Skill main thread, NOT a Workflow node.
# Skill invokes qa-risk-classifier via Agent tool BEFORE preview.
# Skill embeds risk_snapshot into BOTH mode selection AND spec.context.risk_snapshot.
# Workflow's first phase = LayerSelect (consumes risk_snapshot, does NOT re-classify).

# Floor Rule pre-check
if risk_snapshot.floor_rule_status.triggered == true AND mandated_layers not subset of current_signals:
    escalate_one_mode_up()  # §3.6 Floor Rules force escalation regardless of changed_lines

# Explicit mode wins
if user explicitly invokes /qa-commercial-cert OR mode_arg == "commercial-cert":
    mode = "commercial-cert"   # REQUIRES EXPLICIT BUDGET APPROVAL — render banner BEFORE preview

elif user explicitly invokes /qa-release-readiness
     OR release_tag matches /^v\d+\.\d+\.\d+$/ (not pre-release suffix)
     OR user message contains "release readiness" / "version cut" / "staging to prod":
    mode = "release-readiness"

elif changed_lines < 50
     AND no critical_path touched (auth / payment / checkout / signup / data-export / admin / billing)
     AND no API contract changed
     AND no component-behavior surface changed                  # R5 NEW
     AND no testable user-facing behavior changed:              # R5 NEW
    mode = "quick-check"

elif changed_surface in {component, api-contract, single-feature}
     OR component-behavior surface changed                       # R5 NEW
     OR user-facing behavior changed                             # R5 NEW
     AND no release_tag signal
     AND no visual/perf signal:
    mode = "focused-qa-gate"

elif lifecycle hint absent AND signals conflict:
    # NO silent fallback per §1.11 #4
    ASK user: "Pick quick-check / focused-qa-gate / release-readiness"
    recommended_default = "focused-qa-gate"

else:
    mode = "focused-qa-gate"   # default tie-break — cheapest functional mode

# Tie-break ordering (when 2 signals conflict, prefer SAFER mode for false-negative cost):
# release-readiness > focused-qa-gate > quick-check
# Tests that protect critical_release_paths always escalate one mode up.
```

## §3. Hook enforcement matrix (per registry.json + R12)

Registry hook entries declare `enforcement: {<mode>: "block"|"warn"|"skip"}`. Default per `hook_class`:
- `launch_gate` → always block (preflight HARD fail if missing)
- `safety_guard` → block in {release-readiness, commercial-cert}; warn elsewhere
- `evidence_quality` → block in {release-readiness, commercial-cert}; warn in {quick-check, focused-qa-gate}

`preflight-check.sh` per-mode behavior:
- HARD missing (block) → exit 2 + structured error
- SOFT missing (warn) → exit 0 + notes list

| Hook | Class | quick-check | focused-qa-gate | release-readiness | commercial-cert |
|---|---|---|---|---|---|
| `qa-preview-gate` (NEW) | launch_gate | block | block | block | block |
| `qa-block-update-snapshots` | safety_guard | warn | warn | block | block |
| `qa-floor-rule-prompt` | evidence_quality | warn | warn | warn | warn |
| `qa-detect-internal-mock` | evidence_quality | warn | warn | block | block |
| `qa-quarantine-accountability` | safety_guard | block | block | block | block |
| `qa-evidence-required` | evidence_quality | warn | warn | block | block |

## §4. Budget caps & abort rule

Per `_estimate.hard_budget_cap` in each preset:

| Mode | Estimated low | Estimated high | Hard cap | Abort rule |
|---|---|---|---|---|
| `quick-check` | 30k | 80k | 100k | If estimate_high > cap → do NOT launch |
| `focused-qa-gate` | 100k | 250k | 300k | If estimate_high > cap → do NOT launch |
| `release-readiness` | 300k | 800k | 1M | If estimate_high > cap → do NOT launch |
| `commercial-cert` | 1M | 3M | 3.5M | REQUIRES EXPLICIT BUDGET APPROVAL banner + sentinel cross-verify |
| `smoke` | 100k | 200k | 250k | Internal-only |
| `graph-smoke` | 180k | 280k | 300k (R13) | Internal-only |

Enforcement: **pre-launch estimate gate only**. Post-run actual tokens are reported in EvidenceBundle output.
Runtime kill-switch depends on Workflow tool metering availability.

## §5. Authoritative references

- Shapes / shape rationale: `QA-PHASE-B-BLUEPRINT.md` §1, §2, §8, §16
- Reviewer corrections (R1-R15): `QA-PHASE-B-BLUEPRINT.md` §22
- D1-D4 lock rationale: `QA-PHASE-B-BLUEPRINT.md` §23
- Capability registry contract: `../registry.json` + blueprint §7
- Deterministic ops vocabulary: `../ops.manifest.json` + blueprint §6
- Schema list: `../schemas/README.md`
- Main plan history: `ORCHESTRATION-MIGRATION-PLAN.md` §B + §1.11 corrections + §B.0.2
