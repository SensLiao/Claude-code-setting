#!/usr/bin/env node
/**
 * qa-parse-eslint@1 — deterministic parser for `eslint --format json` output.
 *
 * PARSER CONTRACT (shared by qa-sdk evidence.run AND qa-recompute-gate.js):
 *   node qa-parse-eslint.js <input-file>   (the raw stdout of `eslint --format json`)
 *     → writes {"eslint_findings":{"errors":N,"warnings":M}} to stdout, exit 0
 * Keys match what qa-aggregate-decision.js runStaticBaselinePolicy reads
 * (sb.eslint_findings.errors). The number is COUNTED from the bytes, never trusted.
 * Determinism: same input bytes → same JSON.
 */
'use strict'

const fs = require('fs')

function parseEslint(text) {
  // ESLint --format json emits an array of file results, each with errorCount /
  // warningCount (and messages[] with severity 2=error 1=warning). Prefer the
  // per-file counts; fall back to counting messages by severity if absent.
  let arr
  try { arr = JSON.parse(text) } catch { arr = null }
  if (!Array.isArray(arr)) {
    // ESLint sometimes wraps with leading non-JSON (e.g. deprecation notices);
    // extract the first top-level JSON array.
    const m = text.match(/\[[\s\S]*\]/)
    if (m) { try { arr = JSON.parse(m[0]) } catch { arr = null } }
  }
  if (!Array.isArray(arr)) throw new Error('not an ESLint JSON array')
  let errors = 0
  let warnings = 0
  for (const f of arr) {
    if (!f || typeof f !== 'object') continue
    if (typeof f.errorCount === 'number') errors += f.errorCount
    else if (Array.isArray(f.messages)) errors += f.messages.filter(x => x && x.severity === 2).length
    if (typeof f.warningCount === 'number') warnings += f.warningCount
    else if (Array.isArray(f.messages)) warnings += f.messages.filter(x => x && x.severity === 1).length
  }
  return { eslint_findings: { errors, warnings } }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-eslint: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-eslint: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseEslint(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-eslint: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseEslint }

if (require.main === module) {
  process.exit(main(process.argv))
}
