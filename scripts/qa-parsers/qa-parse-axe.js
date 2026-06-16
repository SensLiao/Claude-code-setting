#!/usr/bin/env node
/**
 * qa-parse-axe@1 — deterministic parser for axe-core JSON results.
 *
 * PARSER CONTRACT:
 *   node qa-parse-axe.js <input-file>   (axe.run() / @axe-core/* JSON, single object
 *                                        OR an array of per-surface results)
 *     → {"violations":[{rule_id,impact}],"violation_summary":{critical,serious,moderate,minor,total},
 *        "violating_surfaces_count"} exit 0
 * `violations[].impact` matches qa-aggregate-decision.js a11yGatePolicy (counts
 * critical/serious). Impact buckets counted from bytes; never trusted.
 */
'use strict'

const fs = require('fs')

function parseAxe(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('not valid JSON') }
  const results = Array.isArray(j) ? j : [j]
  const violations = []
  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 }
  let violatingSurfaces = 0
  for (const r of results) {
    if (!r || typeof r !== 'object') continue
    const vs = Array.isArray(r.violations) ? r.violations : []
    if (vs.length > 0) violatingSurfaces++
    for (const v of vs) {
      if (!v || typeof v !== 'object') continue
      const impact = v.impact || 'minor'
      violations.push({ rule_id: v.id || v.rule_id || 'unknown', impact })
      if (impact in summary) summary[impact]++
      summary.total++
    }
  }
  return { violations, violation_summary: summary, violating_surfaces_count: violatingSurfaces }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-axe: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-axe: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseAxe(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-axe: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseAxe }

if (require.main === module) {
  process.exit(main(process.argv))
}
