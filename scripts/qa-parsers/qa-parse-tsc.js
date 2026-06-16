#!/usr/bin/env node
/**
 * qa-parse-tsc@1 — deterministic parser for `tsc --noEmit` output.
 *
 * PARSER CONTRACT (shared by qa-sdk evidence.run AND qa-recompute-gate.js):
 *   node qa-parse-tsc.js <input-file>
 *     - reads the raw captured file (stdout of tsc)
 *     - writes parsed_metrics JSON to stdout, e.g. {"tsc_errors": 3}
 *     - exit 0 on parse success, non-zero on parse failure
 * The parser NEVER trusts a model-supplied number — it counts from the bytes.
 * Determinism: same input bytes → same JSON, always.
 *
 * Why a parser per tool: the recompute gate re-runs THIS over the same raw file
 * and deep-compares the result to the recorded parsed_metrics. A hand-edited
 * number therefore mismatches the re-parse and BLOCKs the release (audit #2).
 */
'use strict'

const fs = require('fs')

function parseTsc(text) {
  // tsc emits one diagnostic per line: `file.ts(12,5): error TS2304: ...`
  // plus an optional summary `Found N errors in M files.` / `Found 1 error`.
  // Count the canonical `error TSxxxx` diagnostics — robust to summary presence.
  const re = /:\s*error\s+TS\d+:/g
  const diagnostics = (text.match(re) || []).length
  // Cross-check against the summary line when present; prefer the larger (fail-loud
  // toward MORE errors so a truncated capture can't under-report to PASS).
  let summary = null
  const m = text.match(/Found\s+(\d+)\s+error/i)
  if (m) summary = parseInt(m[1], 10)
  const tsc_errors = summary !== null ? Math.max(diagnostics, summary) : diagnostics
  return { tsc_errors }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-tsc: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-tsc: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseTsc(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-tsc: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseTsc }

if (require.main === module) {
  process.exit(main(process.argv))
}
