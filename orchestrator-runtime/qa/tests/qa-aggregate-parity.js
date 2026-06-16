#!/usr/bin/env node
/**
 * tests/qa-aggregate-parity.js — behavioral parity between
 *   ~/.claude/orchestrator-runtime/shared/qa-aggregate-decision.js  (canonical module)
 *   ~/.claude/workflows/qa-orchestrator.js                          (inline DETERMINISTIC_OPS)
 *
 * WHY: the default-mode recompute gate (qa-recompute-gate.js) calls the canonical
 * module; the workflow-spec runner uses its inline copy. If the two verdict logics
 * diverge, default mode and workflow mode would disagree on PASS/WARN/BLOCK — the
 * exact "two judges" hole this upgrade closes. This test runs a fixture battery
 * through BOTH and asserts identical output. Mirrors spec-hash-parity.js precedent.
 *
 * The `ref*` functions below are COPY-PASTES of qa-orchestrator.js inline ops
 * (2026-06-16). MUST stay byte-identical with that file — update both together.
 *
 * ONE deliberate divergence (asserted separately, NOT a parity failure):
 *   perfGatePolicy — canonical BLOCKs when metrics present but perf_floor absent
 *   (default-mode fail-closed, audit #7). Inline copy silent-passes via `?? Infinity`.
 *   Parity fixtures therefore always configure perf_floor; the missing-floor case is
 *   checked as an ENHANCEMENT assertion against the canonical module only.
 *
 * Run:   node orchestrator-runtime/qa/tests/qa-aggregate-parity.js
 * Exit:  0 = PASS / 1 = FAIL with diff dump
 */

'use strict'

const path = require('path')
const fs   = require('fs')

const modPath = path.join(__dirname, '..', '..', 'shared', 'qa-aggregate-decision.js')
if (!fs.existsSync(modPath)) {
  console.error(`FAIL: canonical module missing at ${modPath}`)
  process.exit(1)
}
const M = require(modPath)

// ─── reference copies — VERBATIM from qa-orchestrator.js DETERMINISTIC_OPS ───
function refStableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(refStableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + refStableStringify(obj[k])).join(',') + '}'
}

function refRunStaticBaselinePolicy(ctx) {
  const sb = ctx.state.StaticBaseline ?? {}
  const floor = ctx.policy?.static_floor ?? {}
  const failed = []
  const advisory = []
  if ((sb.tsc_errors ?? 0) > (floor.max_tsc_errors ?? 0)) failed.push('tsc_errors_exceed_floor')
  if ((sb.eslint_findings?.errors ?? 0) > (floor.max_eslint_errors ?? 0)) failed.push('eslint_errors_exceed_floor')
  if ((sb.npm_audit_critical_count ?? 0) > (floor.max_npm_audit_critical ?? 0)) failed.push('npm_audit_critical_exceed_floor')
  if ((sb.npm_audit_high_count ?? 0) > (floor.max_npm_audit_high ?? 0)) advisory.push('npm_audit_high_advisory')
  if ((sb.git_secrets_hits ?? 0) > 0) failed.push('git_secrets_hits_nonzero')
  if (!Array.isArray(sb.command_evidence) || sb.command_evidence.length === 0) {
    failed.push('command_evidence_missing')
  }
  const decision = failed.length === 0 ? 'PASS' : 'BLOCK'
  return { static_decision: decision, failed_checks: failed, advisory_warnings: advisory }
}

function refComputeCriticalPathCoverage(ctx) {
  const paths = ctx.critical_release_paths ?? []
  const covered = []
  const uncovered = []
  for (const p of paths) {
    let found = false
    for (const layerName of Object.keys(ctx.state)) {
      const layerOut = ctx.state[layerName]
      const ref = refStableStringify(layerOut)
      if (ref.includes(p)) { found = true; break }
    }
    if (found) covered.push(p); else uncovered.push(p)
  }
  const total = paths.length
  const coverage_pct = total === 0 ? 100 : (covered.length / total) * 100
  return { covered_paths: covered, uncovered_paths: uncovered, coverage_pct }
}

function refQaGatePolicy(ctx) {
  const layerSelect = ctx.state.LayerSelect ?? {}
  const selectedLayers = layerSelect.selected_layers ?? []
  const perLayer = {}
  const blocking = []
  const warned = []
  const layerToStateNode = {
    Static: 'StaticGate',
    'Unit-TDD': ['ComponentOrContract', 'UnitOrComponent'],
    Component: ['ComponentOrContract', 'UnitOrComponent'],
    Integration: 'Integration',
    Contract: ['ComponentOrContract', 'UnitOrComponent'],
    E2E: 'E2E',
    Visual: 'VisualGate',
    A11y: 'A11yGate',
    Perf: 'PerfGate',
    Smoke: 'Smoke',
    TestData: 'TestData',
    FlakyGovernance: 'FlakyQuarantineCheck',
  }
  function resolveStateNode(mapped, layer) {
    if (Array.isArray(mapped)) {
      for (const cand of mapped) {
        if (cand in ctx.state) return cand
      }
      return mapped[0]
    }
    return mapped ?? layer
  }
  for (const layer of selectedLayers) {
    const nodeName = resolveStateNode(layerToStateNode[layer], layer)
    const nodeOut = ctx.state[nodeName]
    let dec = 'MISSING'
    if (Array.isArray(nodeOut)) {
      if (nodeOut.length === 0) {
        dec = 'MISSING'
      } else {
        let anyFail = false
        let anyWarn = false
        for (const it of nodeOut) {
          if (!it || typeof it !== 'object') { anyFail = true; continue }
          const idec = it.decision ?? it.decision_hint ?? null
          const ec = it.exit_code
          if (idec === 'FAIL' || idec === 'BLOCK' || idec === 'BLOCKED' || idec === 'MISSING'
              || (typeof ec === 'number' && ec >= 1)) {
            anyFail = true
          } else if (idec === 'WARN' || idec === 'CONDITIONAL_PASS') {
            anyWarn = true
          }
        }
        dec = anyFail ? 'FAIL' : (anyWarn ? 'WARN' : 'PASS')
      }
    } else if (nodeOut && typeof nodeOut === 'object') {
      dec = nodeOut.decision ?? nodeOut.static_decision ?? nodeOut.visual_decision
           ?? nodeOut.a11y_decision ?? nodeOut.perf_decision ?? 'CONDITIONAL_PASS'
    }
    perLayer[layer] = dec
    if (dec === 'FAIL' || dec === 'BLOCK' || dec === 'BLOCKED' || dec === 'MISSING') blocking.push(layer)
    else if (dec === 'WARN' || dec === 'CONDITIONAL_PASS') warned.push(layer)
  }
  const failures = ctx.state.__dispatch_failures ?? []
  const dispatchBlocking = failures.some(f => f.blocks_release === true)
  let cpc = ctx.state.__critical_path_coverage ?? null
  if (cpc === null && ctx.policy?.require_full_coverage === true) {
    const paths = ctx.critical_release_paths ?? []
    const covered = []
    const uncovered = []
    for (const p of paths) {
      let found = false
      for (const layerName of Object.keys(ctx.state)) {
        if (layerName.startsWith('__')) continue
        if (refStableStringify(ctx.state[layerName]).includes(p)) { found = true; break }
      }
      if (found) covered.push(p); else uncovered.push(p)
    }
    const total = paths.length
    cpc = { covered_paths: covered, uncovered_paths: uncovered, coverage_pct: total === 0 ? 100 : (covered.length / total) * 100 }
  }
  let coverageBlocks = false
  if (cpc && Array.isArray(cpc.uncovered_paths) && cpc.uncovered_paths.length > 0
      && ctx.policy?.require_full_coverage === true) {
    coverageBlocks = true
  }
  const floorTriggers = ctx.risk_snapshot?.floor_rule_status?.triggers ?? []
  const mandated = new Set()
  for (const t of floorTriggers) {
    for (const m of (t.mandated_layers ?? [])) mandated.add(m)
  }
  const missingMandated = [...mandated].filter(m => !selectedLayers.includes(m))
  const floorTriggered = missingMandated.length > 0

  let decision
  if (blocking.length > 0 || dispatchBlocking || coverageBlocks || floorTriggered) decision = 'BLOCK'
  else if (warned.length > 0) decision = 'WARN'
  else decision = 'PASS'

  return {
    decision,
    blocking_layers: blocking,
    warned_layers: warned,
    per_layer_summary: perLayer,
    critical_path_coverage: cpc,
    floor_triggered: floorTriggered,
    floor_action: floorTriggered ? `missing mandated layers: ${missingMandated.join(',')}` : null,
    failed_checks: dispatchBlocking ? ['dispatch_failures_block_release'] : [],
  }
}

function refFlakyQuarantineDecision(ctx) {
  const tests = ctx.state.FlakyTriage?.tests ?? []
  const critical = new Set(ctx.critical_release_paths ?? [])
  let admissible = 0
  let rejected = 0
  for (const t of tests) {
    const isCritical = t.is_critical_release_path === true
                       || (t.critical_path_category && critical.has(t.critical_path_category))
    if (isCritical) {
      rejected += 1
    } else if (t.quarantine && t.quarantine.owner) {
      admissible += 1
    }
  }
  return {
    admissible_quarantines: admissible,
    rejected_critical_path: rejected,
    decision: rejected > 0 ? 'BLOCK' : (admissible > 0 ? 'WARN' : 'PASS'),
  }
}

function refVisualGatePolicy(ctx) {
  const va = ctx.state.VisualAudit
  if (!Array.isArray(va)) {
    return { visual_decision: 'MISSING', regressed_surfaces: [], missing_baselines: [] }
  }
  const floor = ctx.policy?.visual_floor ?? {}
  const maxPixelDiff = floor.max_pixel_diff_count ?? 0
  const allowMissing = floor.allow_missing_baseline === true
  const regressed = []
  const missing = []
  for (const s of va) {
    if (!s || typeof s !== 'object') continue
    if (s.baseline_present === false) missing.push(s.surface?.path ?? 'unknown')
    else if ((s.pixel_diff_count ?? 0) > maxPixelDiff) regressed.push(s.surface?.path ?? 'unknown')
  }
  let decision = 'PASS'
  if (regressed.length > 0) decision = 'BLOCK'
  else if (missing.length > 0 && !allowMissing) decision = 'WARN'
  return { visual_decision: decision, regressed_surfaces: regressed, missing_baselines: missing }
}

function refA11yGatePolicy(ctx) {
  const aa = ctx.state.A11yAudit ?? {}
  const floor = ctx.policy?.a11y_floor ?? {}
  const maxCritical = floor.max_critical ?? 0
  const maxSerious = floor.max_serious ?? 0
  const violations = aa.violations ?? []
  let criticalCount = 0
  let seriousCount = 0
  for (const v of violations) {
    if (v.impact === 'critical') criticalCount += 1
    else if (v.impact === 'serious') seriousCount += 1
  }
  const violating = aa.surfaces?.filter(s => (s.violation_count ?? 0) > 0).map(s => s.path) ?? []
  let decision = 'PASS'
  if (criticalCount > maxCritical) decision = 'BLOCK'
  else if (seriousCount > maxSerious) decision = 'WARN'
  return {
    a11y_decision: decision,
    violating_surfaces: violating,
    violation_summary: { critical: criticalCount, serious: seriousCount, total: violations.length },
  }
}

// reference perf = CURRENT inline (with `?? Infinity`, NO fail-closed guard).
function refPerfGatePolicy(ctx) {
  const pa = ctx.state.PerfAudit ?? {}
  const floor = ctx.policy?.perf_floor ?? {}
  const metrics = pa.metrics ?? {}
  const regressed = []
  const checks = [
    ['lcp_ms', floor.max_lcp_ms ?? Infinity],
    ['inp_ms', floor.max_inp_ms ?? Infinity],
    ['cls', floor.max_cls ?? Infinity],
    ['tbt_ms', floor.max_tbt_ms ?? Infinity],
    ['bundle_size_bytes', floor.max_bundle_size_bytes ?? Infinity],
  ]
  for (const [metric, threshold] of checks) {
    const current = metrics[metric]
    if (typeof current === 'number' && current > threshold) {
      regressed.push({ metric, current, threshold })
    }
  }
  const decision = regressed.length === 0 ? 'PASS'
                 : regressed.some(r => r.metric === 'lcp_ms' || r.metric === 'inp_ms') ? 'BLOCK'
                 : 'WARN'
  return { perf_decision: decision, regressed_metrics: regressed }
}

// ─── fixture battery ───────────────────────────────────────────────────
// Each: { fn, name, ctx }. fn = key into both M.* and ref* maps.
const refMap = {
  runStaticBaselinePolicy: refRunStaticBaselinePolicy,
  computeCriticalPathCoverage: refComputeCriticalPathCoverage,
  qaGatePolicy: refQaGatePolicy,
  flakyQuarantineDecision: refFlakyQuarantineDecision,
  visualGatePolicy: refVisualGatePolicy,
  a11yGatePolicy: refA11yGatePolicy,
  perfGatePolicy: refPerfGatePolicy,
}

const fixtures = [
  // static baseline
  { fn: 'runStaticBaselinePolicy', name: 'static PASS', ctx: { state: { StaticBaseline: { tsc_errors: 0, eslint_findings: { errors: 0 }, npm_audit_critical_count: 0, git_secrets_hits: 0, command_evidence: [{ cmd: 'tsc', exit_code: 0 }] } }, policy: { static_floor: {} } } },
  { fn: 'runStaticBaselinePolicy', name: 'static BLOCK tsc', ctx: { state: { StaticBaseline: { tsc_errors: 3, command_evidence: [{ cmd: 'tsc', exit_code: 2 }] } }, policy: { static_floor: { max_tsc_errors: 0 } } } },
  { fn: 'runStaticBaselinePolicy', name: 'static BLOCK no evidence', ctx: { state: { StaticBaseline: { tsc_errors: 0 } }, policy: {} } },
  { fn: 'runStaticBaselinePolicy', name: 'static advisory high', ctx: { state: { StaticBaseline: { npm_audit_high_count: 5, command_evidence: [{ cmd: 'audit', exit_code: 0 }] } }, policy: { static_floor: { max_npm_audit_high: 0 } } } },

  // critical path coverage
  { fn: 'computeCriticalPathCoverage', name: 'cpc all covered', ctx: { state: { E2E: [{ note: 'covers auth flow' }] }, critical_release_paths: ['auth'] } },
  { fn: 'computeCriticalPathCoverage', name: 'cpc uncovered', ctx: { state: { Static: { x: 1 } }, critical_release_paths: ['payment'] } },
  { fn: 'computeCriticalPathCoverage', name: 'cpc empty', ctx: { state: {}, critical_release_paths: [] } },

  // qa gate
  { fn: 'qaGatePolicy', name: 'gate PASS', ctx: { state: { LayerSelect: { selected_layers: ['Static', 'E2E'] }, StaticGate: { decision: 'PASS' }, E2E: [{ decision: 'PASS' }] }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate WARN conditional', ctx: { state: { LayerSelect: { selected_layers: ['Static'] }, StaticGate: { decision: 'CONDITIONAL_PASS' } }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK fail layer', ctx: { state: { LayerSelect: { selected_layers: ['E2E'] }, E2E: [{ decision: 'FAIL' }] }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK missing layer', ctx: { state: { LayerSelect: { selected_layers: ['Perf'] } }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK array exit_code', ctx: { state: { LayerSelect: { selected_layers: ['Component'] }, ComponentOrContract: [{ exit_code: 1 }] }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK empty array', ctx: { state: { LayerSelect: { selected_layers: ['Component'] }, ComponentOrContract: [] }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK dispatch failure', ctx: { state: { LayerSelect: { selected_layers: ['Static'] }, StaticGate: { decision: 'PASS' }, __dispatch_failures: [{ blocks_release: true }] }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK floor trigger', ctx: { state: { LayerSelect: { selected_layers: ['Static'] }, StaticGate: { decision: 'PASS' } }, policy: {}, risk_snapshot: { floor_rule_status: { triggers: [{ mandated_layers: ['E2E', 'Integration'] }] } }, critical_release_paths: [] } },
  { fn: 'qaGatePolicy', name: 'gate BLOCK coverage', ctx: { state: { LayerSelect: { selected_layers: ['Static'] }, StaticGate: { decision: 'PASS' } }, policy: { require_full_coverage: true }, risk_snapshot: null, critical_release_paths: ['payment'] } },
  { fn: 'qaGatePolicy', name: 'gate array WARN', ctx: { state: { LayerSelect: { selected_layers: ['Component'] }, ComponentOrContract: [{ decision: 'PASS' }, { decision: 'WARN' }] }, policy: {}, risk_snapshot: null, critical_release_paths: [] } },

  // flaky
  { fn: 'flakyQuarantineDecision', name: 'flaky PASS', ctx: { state: { FlakyTriage: { tests: [] } }, critical_release_paths: [] } },
  { fn: 'flakyQuarantineDecision', name: 'flaky WARN admissible', ctx: { state: { FlakyTriage: { tests: [{ quarantine: { owner: 'x' } }] } }, critical_release_paths: [] } },
  { fn: 'flakyQuarantineDecision', name: 'flaky BLOCK critical', ctx: { state: { FlakyTriage: { tests: [{ is_critical_release_path: true }] } }, critical_release_paths: [] } },

  // visual
  { fn: 'visualGatePolicy', name: 'visual MISSING', ctx: { state: {}, policy: {} } },
  { fn: 'visualGatePolicy', name: 'visual PASS', ctx: { state: { VisualAudit: [{ surface: { path: 'a' }, baseline_present: true, pixel_diff_count: 0 }] }, policy: { visual_floor: { max_pixel_diff_count: 0 } } } },
  { fn: 'visualGatePolicy', name: 'visual BLOCK regress', ctx: { state: { VisualAudit: [{ surface: { path: 'a' }, baseline_present: true, pixel_diff_count: 99 }] }, policy: { visual_floor: { max_pixel_diff_count: 0 } } } },
  { fn: 'visualGatePolicy', name: 'visual WARN missing baseline', ctx: { state: { VisualAudit: [{ surface: { path: 'a' }, baseline_present: false }] }, policy: { visual_floor: {} } } },

  // a11y
  { fn: 'a11yGatePolicy', name: 'a11y PASS', ctx: { state: { A11yAudit: { violations: [], surfaces: [] } }, policy: { a11y_floor: {} } } },
  { fn: 'a11yGatePolicy', name: 'a11y BLOCK critical', ctx: { state: { A11yAudit: { violations: [{ impact: 'critical' }], surfaces: [{ path: 'a', violation_count: 1 }] } }, policy: { a11y_floor: {} } } },
  { fn: 'a11yGatePolicy', name: 'a11y WARN serious', ctx: { state: { A11yAudit: { violations: [{ impact: 'serious' }], surfaces: [] } }, policy: { a11y_floor: {} } } },

  // perf — floor ALWAYS configured here (parity holds; missing-floor checked separately)
  { fn: 'perfGatePolicy', name: 'perf PASS', ctx: { state: { PerfAudit: { metrics: { lcp_ms: 1000, inp_ms: 50, cls: 0.01 } } }, policy: { perf_floor: { max_lcp_ms: 2500, max_inp_ms: 200, max_cls: 0.1 } } } },
  { fn: 'perfGatePolicy', name: 'perf BLOCK lcp', ctx: { state: { PerfAudit: { metrics: { lcp_ms: 5000 } } }, policy: { perf_floor: { max_lcp_ms: 2500 } } } },
  { fn: 'perfGatePolicy', name: 'perf WARN bundle', ctx: { state: { PerfAudit: { metrics: { bundle_size_bytes: 9999999 } } }, policy: { perf_floor: { max_bundle_size_bytes: 1000 } } } },
  { fn: 'perfGatePolicy', name: 'perf no metrics no floor PASS', ctx: { state: {}, policy: {} } },
]

// ─── run parity ─────────────────────────────────────────────────────────
let pass = 0
let fail = 0
for (const fx of fixtures) {
  const got = M[fx.fn](fx.ctx)
  const ref = refMap[fx.fn](fx.ctx)
  if (refStableStringify(got) === refStableStringify(ref)) {
    pass++
  } else {
    fail++
    console.error(`FAIL parity: [${fx.fn}] ${fx.name}\n  canonical: ${refStableStringify(got)}\n  inline   : ${refStableStringify(ref)}`)
  }
}

// ─── enhancement assertions (canonical-only, deliberate divergence) ──────
let enh = 0, enhFail = 0
// perf fail-closed: metrics present, NO floor → canonical BLOCK, inline would PASS.
{
  const ctx = { state: { PerfAudit: { metrics: { lcp_ms: 1234 } } }, policy: {} }
  const got = M.perfGatePolicy(ctx)
  const inline = refPerfGatePolicy(ctx)
  if (got.perf_decision === 'BLOCK' && got.reason === 'perf_floor_unconfigured') enh++
  else { enhFail++; console.error(`FAIL enhancement: perf fail-closed expected BLOCK/perf_floor_unconfigured, got ${refStableStringify(got)}`) }
  if (inline.perf_decision !== 'PASS') { enhFail++; console.error(`FAIL enhancement: inline ref expected PASS (documents the divergence), got ${inline.perf_decision}`) }
  else { enh++ }
}

console.log(`qa-aggregate parity: ${pass}/${pass + fail} parity fixtures, ${enh}/${enh + enhFail} enhancement checks`)
if (fail > 0 || enhFail > 0) {
  console.error(`FAIL: ${fail} parity divergence(s), ${enhFail} enhancement failure(s) — fix shared/qa-aggregate-decision.js OR qa-orchestrator.js inline ops (keep them in sync)`)
  process.exit(1)
}
console.log('PASS: canonical module is behavior-identical to qa-orchestrator.js inline ops (perf fail-closed enhancement verified)')
process.exit(0)
