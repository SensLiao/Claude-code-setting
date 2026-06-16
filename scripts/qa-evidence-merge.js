#!/usr/bin/env node
/**
 * qa-evidence-merge.js — builds ONE command_evidence v2 record from SDK-computed
 * fields and merges it into the machine-facing per-layer JSON. Called only by
 * `qa-sdk evidence.run`, which is the SOLE writer of these files (the model never
 * types a metric). Layer file shape consumed by qa-recompute-gate.js:
 *   { layer, state_node, command_evidence: [ <v2 records> ],
 *     derived: { ...merged parsed_metrics..., command_evidence: [same] } }
 * `derived` is the raw state object the shared gate functions read; `command_evidence`
 * at top level is what the recompute's integrity loop re-hashes / re-parses.
 *
 * Exit: 0 = merged · 1 = error (fail-closed; evidence.run aborts on non-zero).
 */
'use strict'

const fs = require('fs')

function parseArgs(argv) {
  const o = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) { o[a.slice(2)] = argv[++i] }
  }
  return o
}

function main() {
  const a = parseArgs(process.argv)
  const layerFile = a['layer-file']
  if (!layerFile) { process.stderr.write('qa-evidence-merge: --layer-file required\n'); return 1 }

  let parsedMetrics = null
  if (a['parsed-metrics-file']) {
    try {
      const raw = fs.readFileSync(a['parsed-metrics-file'], 'utf8')
      parsedMetrics = JSON.parse(raw) // may be null
    } catch { parsedMetrics = null }
  }

  // Build the v2 record. Required fields always present; optionals only when non-empty.
  const ce = {
    command_id: a['command-id'],
    command: (a['command'] || '').trim(),
    exit_code: Number.parseInt(a['exit-code'], 10),
    started_at: a['started-at'],
    duration_ms: Number.parseInt(a['duration-ms'] || '0', 10),
    stdout_path: a['stdout-path'],
    stdout_sha256: a['stdout-sha256'],
    parser: a['parser'] || null,
    parser_input: a['parser-input'] || 'stdout',
    parser_input_sha256: a['parser-input-sha256'],
    parse_status: a['parse-status'] || 'OK',
    parsed_metrics: parsedMetrics,
    captured_by: a['captured-by'] || 'qa-sdk evidence.run',
  }
  if (a['stderr-path']) ce.stderr_path = a['stderr-path']
  if (a['stderr-sha256']) ce.stderr_sha256 = a['stderr-sha256']
  if (a['artifact-path']) ce.artifact_path = a['artifact-path']
  if (a['artifact-sha256']) ce.artifact_sha256 = a['artifact-sha256']
  if (a['git-head']) ce.git_head = a['git-head']
  if (a['git-dirty-sha256']) ce.git_dirty_sha256 = a['git-dirty-sha256']
  if (!ce.parser) ce.parser = undefined // omit null parser cleanly via JSON below

  let layer
  try { layer = JSON.parse(fs.readFileSync(layerFile, 'utf8')) }
  catch { layer = { layer: a['layer'], state_node: a['state-node'] || a['layer'], command_evidence: [], derived: {} } }
  if (!Array.isArray(layer.command_evidence)) layer.command_evidence = []
  if (!layer.derived || typeof layer.derived !== 'object') layer.derived = {}
  layer.layer = a['layer'] ?? layer.layer
  layer.state_node = a['state-node'] || layer.state_node || layer.layer

  // strip undefined (parser=null case) by round-trip
  const ceClean = JSON.parse(JSON.stringify(ce))
  layer.command_evidence.push(ceClean)

  // merge SDK-derived metrics into derived (the raw state the gate reads)
  if (parsedMetrics && typeof parsedMetrics === 'object' && !Array.isArray(parsedMetrics)) {
    Object.assign(layer.derived, parsedMetrics)
  }
  layer.derived.command_evidence = layer.command_evidence

  try { fs.writeFileSync(layerFile, JSON.stringify(layer, null, 2) + '\n') }
  catch (e) { process.stderr.write(`qa-evidence-merge: write failed: ${e.message}\n`); return 1 }
  return 0
}

process.exit(main())
