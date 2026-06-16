#!/usr/bin/env node
/**
 * qa-parse-lighthouse@1 — deterministic parser for a Lighthouse JSON report.
 *
 * PARSER CONTRACT:
 *   node qa-parse-lighthouse.js <input-file>   (lighthouse --output=json)
 *     → {"metrics":{lcp_ms,tbt_ms,cls,fcp_ms,speed_index,lighthouse_perf_score}} exit 0
 * Nested under `metrics` to match qa-aggregate-decision.js perfGatePolicy, which
 * reads ctx.state.PerfAudit.metrics.lcp_ms / inp_ms / cls / tbt_ms. (Lab Lighthouse
 * has no INP — it is a field metric — so inp_ms is omitted, not faked.) From bytes.
 */
'use strict'

const fs = require('fs')

function numAudit(audits, id) {
  const a = audits && audits[id]
  return a && typeof a.numericValue === 'number' ? a.numericValue : null
}

function parseLighthouse(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('not valid JSON') }
  const audits = j.audits
  if (!audits || typeof audits !== 'object') throw new Error('no .audits in Lighthouse report')
  const metrics = {}
  const lcp = numAudit(audits, 'largest-contentful-paint')
  const tbt = numAudit(audits, 'total-blocking-time')
  const cls = numAudit(audits, 'cumulative-layout-shift')
  const fcp = numAudit(audits, 'first-contentful-paint')
  const si = numAudit(audits, 'speed-index')
  if (lcp !== null) metrics.lcp_ms = Math.round(lcp)
  if (tbt !== null) metrics.tbt_ms = Math.round(tbt)
  if (cls !== null) metrics.cls = Math.round(cls * 1000) / 1000
  if (fcp !== null) metrics.fcp_ms = Math.round(fcp)
  if (si !== null) metrics.speed_index = Math.round(si)
  const perfCat = j.categories && j.categories.performance
  if (perfCat && typeof perfCat.score === 'number') {
    metrics.lighthouse_perf_score = Math.round(perfCat.score * 100)
  }
  if (Object.keys(metrics).length === 0) throw new Error('no recognizable Core Web Vitals audits present')
  return { metrics }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-lighthouse: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-lighthouse: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseLighthouse(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-lighthouse: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseLighthouse }

if (require.main === module) {
  process.exit(main(process.argv))
}
