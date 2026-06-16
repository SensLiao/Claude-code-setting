#!/usr/bin/env node
/**
 * shared/qa-aggregate-decision.js — CANONICAL QA verdict aggregation logic.
 *
 * This is the SINGLE SOURCE OF TRUTH for how per-layer QA evidence becomes a
 * PASS / WARN / BLOCK release decision. It exists so that BOTH execution modes
 * compute the verdict with identical logic:
 *
 *   - workflow-spec mode  → ~/.claude/workflows/qa-orchestrator.js  (inline copy
 *                            of these ops; the workflow BODY cannot `import`/`require`
 *                            per ops.manifest.json §_note, so it keeps an inline copy)
 *   - default/prompt-only → ~/.claude/orchestrator-runtime/shared/qa-recompute-gate.js
 *                            (invoked by `qa-sdk gate.check`; REQUIRES this module)
 *
 * Parity between the inline copy and this canonical module is enforced by:
 *   ~/.claude/orchestrator-runtime/qa/tests/qa-aggregate-parity.js
 * (mirrors the spec-hash.js ↔ qa-preview-gate.js parity precedent). If you edit a
 * gate function HERE, mirror it in qa-orchestrator.js AND update the parity reference.
 *
 * Functions are PURE: no FS, no shell, no network, no Date.now / Math.random.
 * They take an already-assembled `ctx` (the recompute driver builds ctx from
 * on-disk evidence; the workflow builds ctx from phase state) and return a verdict
 * object. Mirror of qa-orchestrator.js DETERMINISTIC_OPS (2026-06-16 extraction).
 *
 * INTENTIONAL DIVERGENCE FROM THE INLINE COPY (documented, fail-closed direction only):
 *   perfGatePolicy — when PerfAudit reports metrics but NO perf_floor is configured at
 *   all, this returns BLOCK ('perf_floor_unconfigured') instead of the inline copy's
 *   silent PASS (`?? Infinity`). Closes audit hole #7 for DEFAULT mode, which has no
 *   fillPolicyFromPreset backstop. Workflow mode is UNAFFECTED: fillPolicyFromPreset
 *   (qa-orchestrator.js) bakes the floor before the gate runs, so floor is always
 *   present there and the per-metric logic below is byte-identical for that case.
 *
 * Library mode:
 *   const G = require('.../shared/qa-aggregate-decision.js')
 *   G.qaGatePolicy(ctx) / G.perfGatePolicy(ctx) / ...
 */

'use strict'

// ── deterministic stringify (identical to spec-hash.js / qa-orchestrator.js) ──
function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

// ── static baseline gate (qa-orchestrator.js run_static_baseline_policy) ──
function runStaticBaselinePolicy(ctx) {
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

// ── critical path coverage (qa-orchestrator.js compute_critical_path_coverage) ──
function computeCriticalPathCoverage(ctx) {
  const paths = ctx.critical_release_paths ?? []
  const covered = []
  const uncovered = []
  for (const p of paths) {
    let found = false
    for (const layerName of Object.keys(ctx.state)) {
      const layerOut = ctx.state[layerName]
      const ref = stableStringify(layerOut)
      if (ref.includes(p)) { found = true; break }
    }
    if (found) covered.push(p); else uncovered.push(p)
  }
  const total = paths.length
  const coverage_pct = total === 0 ? 100 : (covered.length / total) * 100
  return { covered_paths: covered, uncovered_paths: uncovered, coverage_pct }
}

// ── main release gate (qa-orchestrator.js qa_gate_policy) ──
function qaGatePolicy(ctx) {
  const layerSelect = ctx.state.LayerSelect ?? {}
  const selectedLayers = layerSelect.selected_layers ?? []
  const perLayer = {}
  const blocking = []
  const warned = []
  // layer → state node name. Array value = ordered candidates; pick first present.
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
      return mapped[0]  // none present yet → first candidate (will read as MISSING)
    }
    return mapped ?? layer
  }
  for (const layer of selectedLayers) {
    const nodeName = resolveStateNode(layerToStateNode[layer], layer)
    const nodeOut = ctx.state[nodeName]
    let dec = 'MISSING'
    if (Array.isArray(nodeOut)) {
      // fanout/pipeline → array of per-item results. Any item FAIL/BLOCK/MISSING or
      // numeric exit_code >= 1 fails the whole layer. Empty array = MISSING.
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
  // dispatch_failures from R7 invariant feed
  const failures = ctx.state.__dispatch_failures ?? []
  const dispatchBlocking = failures.some(f => f.blocks_release === true)
  // critical path coverage — inline-compute when policy demands it and no upstream phase did.
  let cpc = ctx.state.__critical_path_coverage ?? null
  if (cpc === null && ctx.policy?.require_full_coverage === true) {
    const paths = ctx.critical_release_paths ?? []
    const covered = []
    const uncovered = []
    for (const p of paths) {
      let found = false
      for (const layerName of Object.keys(ctx.state)) {
        if (layerName.startsWith('__')) continue
        if (stableStringify(ctx.state[layerName]).includes(p)) { found = true; break }
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
  // floor rule (mandated layers from risk_snapshot)
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

// ── flaky quarantine (qa-orchestrator.js flaky_quarantine_decision) ──
function flakyQuarantineDecision(ctx) {
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

// ── visual gate (qa-orchestrator.js visual_gate_policy) ──
function visualGatePolicy(ctx) {
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

// ── a11y gate (qa-orchestrator.js a11y_gate_policy) ──
function a11yGatePolicy(ctx) {
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

// ── perf gate (qa-orchestrator.js perf_gate_policy + P0 fail-closed fix) ──
function perfGatePolicy(ctx) {
  const pa = ctx.state.PerfAudit ?? {}
  const floor = ctx.policy?.perf_floor ?? {}
  const metrics = pa.metrics ?? {}
  // P0 fail-closed (audit hole #7): default mode has no fillPolicyFromPreset backstop.
  // A PerfAudit that reports metrics but has NO configured floor at all must BLOCK,
  // not silently pass via `?? Infinity`. Workflow mode never hits this (floor pre-filled).
  const hasMetrics = metrics && typeof metrics === 'object' && Object.keys(metrics).length > 0
  const floorConfigured = floor && typeof floor === 'object' && Object.keys(floor).length > 0
  if (hasMetrics && !floorConfigured) {
    return { perf_decision: 'BLOCK', regressed_metrics: [], reason: 'perf_floor_unconfigured' }
  }
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

module.exports = {
  stableStringify,
  runStaticBaselinePolicy,
  computeCriticalPathCoverage,
  qaGatePolicy,
  flakyQuarantineDecision,
  visualGatePolicy,
  a11yGatePolicy,
  perfGatePolicy,
}
