#!/usr/bin/env node
/**
 * qa-parse-k6@1 — deterministic parser for k6 summary JSON (`--summary-export`).
 *
 * PARSER CONTRACT:
 *   node qa-parse-k6.js <input-file>
 *     → {"thresholds_ok","failed_thresholds","p95_ms","error_rate","checks_pass_rate"} exit 0
 *
 * CRITICAL (blueprint §4.8): k6's `checks` do NOT affect the process exit code —
 * only `thresholds` make k6 exit non-zero. So a gate MUST read threshold .ok, never
 * the exit code. This parser derives thresholds_ok from EVERY metric's thresholds map;
 * any failed threshold ⇒ thresholds_ok=false. Numbers counted from bytes.
 */
'use strict'

const fs = require('fs')

function parseK6(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('not valid JSON') }
  const metrics = j.metrics || {}
  const failed = []
  let sawThreshold = false
  for (const [name, m] of Object.entries(metrics)) {
    if (!m || typeof m !== 'object' || !m.thresholds) continue
    for (const [expr, res] of Object.entries(m.thresholds)) {
      sawThreshold = true
      // k6 represents a threshold result as { ok: bool } (newer) or a bare bool (older).
      const ok = (res && typeof res === 'object') ? res.ok !== false : res !== false
      if (!ok) failed.push(`${name}:${expr}`)
    }
  }
  const dur = metrics.http_req_duration && metrics.http_req_duration.values
  const p95 = dur ? (dur['p(95)'] ?? dur.p95 ?? null) : null
  const failedMetric = metrics.http_req_failed && metrics.http_req_failed.values
  const error_rate = failedMetric ? (failedMetric.rate ?? null) : null
  const checksMetric = metrics.checks && metrics.checks.values
  const checks_pass_rate = checksMetric ? (checksMetric.rate ?? null) : null
  return {
    thresholds_ok: sawThreshold ? failed.length === 0 : null,
    failed_thresholds: failed,
    p95_ms: typeof p95 === 'number' ? Math.round(p95 * 100) / 100 : null,
    error_rate: typeof error_rate === 'number' ? error_rate : null,
    checks_pass_rate: typeof checks_pass_rate === 'number' ? checks_pass_rate : null,
  }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-k6: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-k6: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseK6(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-k6: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseK6 }

if (require.main === module) {
  process.exit(main(process.argv))
}
