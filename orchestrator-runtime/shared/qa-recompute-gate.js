#!/usr/bin/env node
/**
 * shared/qa-recompute-gate.js — DEFAULT-mode deterministic verdict recompute.
 *
 * Closes audit holes #1/#2/#3: in default (prompt-only) mode the release verdict was
 * a model-written YAML field that nothing re-derived from evidence. This engine:
 *   1. RE-VERIFIES every command_evidence item that carries a hash: re-reads the raw
 *      stdout file, re-hashes its bytes, and re-runs the named parser — any mismatch
 *      with the recorded stdout_sha256 / parsed_metrics is a fabricated number → BLOCK.
 *   2. RE-DERIVES each layer's pass/fail from its metrics via the CANONICAL shared
 *      module (qa-aggregate-decision.js — same logic the workflow runner uses).
 *   3. RE-AGGREGATES into a computed release decision and COMPARES it to the model's
 *      declared release_decision; if the declared verdict is MORE LENIENT than computed
 *      (or any integrity check failed), it BLOCKs. It NEVER loosens a model-stricter call.
 *
 * Invoked by `qa-sdk gate.check` (which runs from ~/.claude, so this can `require` the
 * canonical sibling module — true single source of truth, no duplication). It is NOT a
 * project-installed hook (those must be self-contained and couldn't reach the shared module).
 *
 * Additive / back-compat: if a run produced no machine evidence (no recompute-context.json
 * and no <layer>.json), this is a NO-OP (exit 0) so existing flows are unaffected. Full
 * default-mode activation = the SKILL/SDK emitting recompute-context.json + per-layer JSON
 * (via evidence.run); the engine + wiring + verification are in place now.
 *
 * CLI:  node qa-recompute-gate.js --tag <tag> --project-root <root> [--declared <DECISION>]
 * Exit: 0 = agree / declared-stricter / no-op · 2 = BLOCK (lenient mismatch or integrity fail)
 *       (1 reserved; release-blocking conditions all use 2 to match gate.check BLOCKED semantics)
 */
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const G = require(path.join(__dirname, 'qa-aggregate-decision.js'))

// layer → (raw state key, sub-gate fn, gate output node). Sub-gate layers re-derive their
// decision from raw metrics via the shared module; all other layers carry .decision directly.
const SUBGATES = {
  Static: { rawKey: 'StaticBaseline', fn: 'runStaticBaselinePolicy', outKey: 'StaticGate' },
  Visual: { rawKey: 'VisualAudit', fn: 'visualGatePolicy', outKey: 'VisualGate' },
  A11y:   { rawKey: 'A11yAudit', fn: 'a11yGatePolicy', outKey: 'A11yGate' },
  Perf:   { rawKey: 'PerfAudit', fn: 'perfGatePolicy', outKey: 'PerfGate' },
}

function sha256File(p) {
  const buf = fs.readFileSync(p) // raw BYTES — newlines NOT normalized
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function parseArgs(argv) {
  const out = { tag: null, projectRoot: null, declared: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--tag') out.tag = argv[++i]
    else if (a === '--project-root') out.projectRoot = argv[++i]
    else if (a === '--declared') out.declared = argv[++i]
  }
  return out
}

// strictness rank (higher = stricter / more blocking)
function rank(decision) {
  switch (decision) {
    case 'PASS': return 0
    case 'WARN':
    case 'CONDITIONAL_PASS':
    case 'STRATEGY_READY': return 1
    case 'FAIL':
    case 'BLOCKED':
    case 'STALE': return 2
    // computed values from qaGatePolicy
    case 'BLOCK': return 2
    default: return 2 // unknown → treat as blocking (default-deny)
  }
}

function main(argv) {
  const { tag, projectRoot, declared: declaredArg } = parseArgs(argv)
  if (!tag || !projectRoot) {
    process.stderr.write('qa-recompute-gate: --tag and --project-root are required\n')
    return 2 // fail-closed: a gate invoked without its inputs must not pass silently
  }
  const evDir = path.join(projectRoot, '.qa', 'evidence', tag)
  const ctxPath = path.join(evDir, 'recompute-context.json')

  // Discover machine evidence layer files (written by evidence.run): <layer>.json with a
  // command_evidence array and/or derived metrics. Exclude known non-layer json artifacts.
  let layerFiles = []
  try {
    layerFiles = fs.readdirSync(evDir)
      .filter(f => f.endsWith('.json'))
      .filter(f => !['recompute-context.json', 'recompute-verdict.json'].includes(f))
  } catch { /* no evidence dir */ }

  const hasContext = fs.existsSync(ctxPath)
  if (!hasContext && layerFiles.length === 0) {
    // Additive no-op: nothing machine-readable to recompute. (Back-compat with legacy runs.)
    process.stdout.write('qa-recompute-gate: NO-OP (no recompute-context.json / machine evidence present)\n')
    return 0
  }

  let context = {}
  if (hasContext) {
    try { context = JSON.parse(fs.readFileSync(ctxPath, 'utf8')) }
    catch (e) { process.stderr.write(`qa-recompute-gate: BLOCK — recompute-context.json unparseable: ${e.message}\n`); return 2 }
  }

  const selectedLayers = context.selected_layers ?? []
  const policy = context.policy ?? {}
  const riskSnapshot = context.risk_snapshot ?? null
  const criticalReleasePaths = context.critical_release_paths ?? []
  const declared = declaredArg ?? context.declared_release_decision ?? null

  const findings = []   // integrity violations (fabrication / missing files)
  const state = {}

  // ── load + integrity-verify each layer file ──
  const forcedBlockLayers = new Set()
  const layerPlacement = {}   // layerName → the ctx.state node key its decision lands on
  for (const fname of layerFiles) {
    let layer
    try { layer = JSON.parse(fs.readFileSync(path.join(evDir, fname), 'utf8')) }
    catch (e) { findings.push(`${fname}: unparseable layer JSON (${e.message})`); continue }
    const layerName = layer.layer ?? fname.replace(/\.json$/, '')
    const stateNode = layer.state_node ?? layerName
    const cmdEv = Array.isArray(layer.command_evidence) ? layer.command_evidence : []

    let layerIntegrityFailed = false
    for (const ce of cmdEv) {
      // Only items that CLAIM tamper-evidence are verifiable. A legacy item without
      // stdout_sha256 is UNVERIFIABLE — flagged, not silently trusted.
      if (!ce.stdout_sha256 || !ce.stdout_path) {
        findings.push(`${layerName}/${ce.command_id ?? '?'}: command_evidence without stdout_sha256 — UNVERIFIABLE (legacy v1)`)
        continue
      }
      const rawPath = path.join(projectRoot, ce.stdout_path)
      if (!fs.existsSync(rawPath)) {
        findings.push(`${layerName}/${ce.command_id}: stdout_path missing on disk (${ce.stdout_path})`)
        layerIntegrityFailed = true
        continue
      }
      const actual = sha256File(rawPath)
      if (actual !== ce.stdout_sha256) {
        findings.push(`${layerName}/${ce.command_id}: STDOUT_HASH_MISMATCH (recorded ${ce.stdout_sha256.slice(0, 12)}… actual ${actual.slice(0, 12)}…)`)
        layerIntegrityFailed = true
        continue
      }
      // Re-run the named parser over the parser_input file and deep-compare parsed_metrics.
      if (ce.parse_status === 'OK' && ce.parser && ce.parsed_metrics) {
        const base = String(ce.parser).replace(/@\d+$/, '')
        const parserPath = path.join(__dirname, '..', '..', 'scripts', 'qa-parsers', base + '.js')
        const inputRel = ce.parser_input === 'artifact' ? ce.artifact_path : ce.stdout_path
        const inputAbs = path.join(projectRoot, inputRel || ce.stdout_path)
        if (!fs.existsSync(parserPath)) {
          findings.push(`${layerName}/${ce.command_id}: parser '${base}' not found at ${parserPath} — cannot re-derive`)
          layerIntegrityFailed = true
          continue
        }
        let reparsed
        try {
          const out = execFileSync(process.execPath, [parserPath, inputAbs], { encoding: 'utf8' })
          reparsed = JSON.parse(out)
        } catch (e) {
          findings.push(`${layerName}/${ce.command_id}: parser re-run failed (${e.message})`)
          layerIntegrityFailed = true
          continue
        }
        if (G.stableStringify(reparsed) !== G.stableStringify(ce.parsed_metrics)) {
          findings.push(`${layerName}/${ce.command_id}: PARSED_METRICS_FABRICATED (recorded ${G.stableStringify(ce.parsed_metrics)} ≠ re-parsed ${G.stableStringify(reparsed)})`)
          layerIntegrityFailed = true
        }
      }
    }
    if (layerIntegrityFailed) forcedBlockLayers.add(layerName)

    // place layer evidence into ctx.state
    const derived = layer.derived
    if (SUBGATES[layerName]) {
      state[SUBGATES[layerName].rawKey] = derived
      layerPlacement[layerName] = SUBGATES[layerName].outKey   // decision lands on the *Gate node
    } else {
      // non-subgate layer (E2E / Component / Integration / Contract): carry its decision.
      // If the runner didn't record one, derive it from command_evidence exit codes
      // (any nonzero → FAIL) so a failing command can't read as a soft CONDITIONAL_PASS.
      if (derived && typeof derived === 'object' && !Array.isArray(derived) && derived.decision === undefined) {
        const ces = Array.isArray(layer.command_evidence) ? layer.command_evidence : []
        const anyFail = ces.some(c => typeof c.exit_code === 'number' && c.exit_code >= 1)
        if (ces.length > 0) derived.decision = anyFail ? 'FAIL' : 'PASS'
      }
      state[stateNode] = derived
      layerPlacement[layerName] = stateNode
    }
  }

  // ── re-derive sub-gate layer decisions via the canonical module ──
  state.LayerSelect = { selected_layers: selectedLayers }
  if (Array.isArray(context.dispatch_failures) && context.dispatch_failures.length) {
    state.__dispatch_failures = context.dispatch_failures
  }
  const ctx = { state, policy, risk_snapshot: riskSnapshot, critical_release_paths: criticalReleasePaths }
  for (const layer of selectedLayers) {
    const sg = SUBGATES[layer]
    if (sg) {
      // run the sub-gate (e.g. perfGatePolicy) from the raw metrics
      state[sg.outKey] = G[sg.fn](ctx)
    }
  }
  // integrity-forced blocks override the node decision so qaGatePolicy blocks the layer.
  // Uses the placement recorded at load time (handles layer-file name ≠ state-node key).
  for (const layerName of forcedBlockLayers) {
    const node = layerPlacement[layerName] ?? layerName
    state[node] = { decision: 'FAIL', integrity_block: true }
  }

  // ── aggregate ──
  const computed = G.qaGatePolicy(ctx)
  const computedDecision = computed.decision // PASS | WARN | BLOCK

  const verdict = {
    tag,
    computed_release_decision: computedDecision,
    declared_release_decision: declared,
    integrity_findings: findings,
    blocking_layers: computed.blocking_layers,
    warned_layers: computed.warned_layers,
    per_layer_summary: computed.per_layer_summary,
    forced_block_layers: [...forcedBlockLayers],
  }
  try { fs.writeFileSync(path.join(evDir, 'recompute-verdict.json'), JSON.stringify(verdict, null, 2) + '\n') } catch { /* best-effort */ }

  // ── decide exit ──
  // Any integrity finding that forced a block (fabrication / missing raw) → BLOCK.
  const hardIntegrity = forcedBlockLayers.size > 0
  if (hardIntegrity) {
    process.stderr.write(`qa-recompute-gate: BLOCK — evidence integrity failure(s):\n  - ${findings.join('\n  - ')}\n`)
    return 2
  }
  if (declared !== null) {
    if (rank(declared) < rank(computedDecision)) {
      process.stderr.write(`qa-recompute-gate: BLOCK — declared release_decision='${declared}' is MORE LENIENT than evidence-computed '${computedDecision}' (blocking_layers: ${computed.blocking_layers.join(',') || 'none'})\n`)
      return 2
    }
  }
  // surface non-blocking UNVERIFIABLE warnings (legacy items) without failing
  if (findings.length) {
    process.stderr.write(`qa-recompute-gate: PASS-with-warnings — ${findings.length} unverifiable/legacy evidence note(s):\n  - ${findings.join('\n  - ')}\n`)
  }
  process.stdout.write(`qa-recompute-gate: OK — computed='${computedDecision}'${declared !== null ? `, declared='${declared}' (declared not more lenient)` : ''}\n`)
  return 0
}

module.exports = { rank }

if (require.main === module) {
  process.exit(main(process.argv))
}
