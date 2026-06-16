#!/usr/bin/env node
/**
 * qa-parse-coverage@1 — deterministic parser for coverage reports.
 *
 * PARSER CONTRACT:
 *   node qa-parse-coverage.js <input-file>
 *     → {"line_pct","branch_pct","statement_pct","function_pct","coverage_pct"} exit 0
 * Supports:
 *   - Istanbul/nyc coverage-summary.json  ({ total: { lines:{pct}, ... } })
 *   - lcov.info text                      (SF/LF/LH/BRF/BRH/FNF/FNH records)
 *   - Cobertura / coverage.py XML         (<coverage line-rate=".." branch-rate="..">)
 * coverage_pct mirrors line_pct (the headline number gates consume).
 */
'use strict'

const fs = require('fs')

function round2(n) { return Math.round(n * 100) / 100 }

function fromIstanbulSummary(j) {
  const t = j.total
  if (!t) return null
  const get = (k) => (t[k] && typeof t[k].pct === 'number') ? t[k].pct : 0
  const line_pct = get('lines')
  return {
    line_pct,
    branch_pct: get('branches'),
    statement_pct: get('statements'),
    function_pct: get('functions'),
    coverage_pct: line_pct,
  }
}

function fromLcov(text) {
  let LF = 0, LH = 0, BRF = 0, BRH = 0, FNF = 0, FNH = 0
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(LF|LH|BRF|BRH|FNF|FNH):(\d+)/)
    if (!m) continue
    const v = parseInt(m[2], 10)
    if (m[1] === 'LF') LF += v
    else if (m[1] === 'LH') LH += v
    else if (m[1] === 'BRF') BRF += v
    else if (m[1] === 'BRH') BRH += v
    else if (m[1] === 'FNF') FNF += v
    else if (m[1] === 'FNH') FNH += v
  }
  if (LF === 0 && FNF === 0 && BRF === 0) return null
  const pct = (h, f) => f === 0 ? 100 : round2((h / f) * 100)
  const line_pct = pct(LH, LF)
  return {
    line_pct,
    branch_pct: pct(BRH, BRF),
    statement_pct: line_pct, // lcov has no separate statement metric; mirror lines
    function_pct: pct(FNH, FNF),
    coverage_pct: line_pct,
  }
}

function fromCoberturaXml(text) {
  const m = text.match(/<coverage[^>]*\bline-rate="([0-9.]+)"/)
  if (!m) return null
  const line_pct = round2(parseFloat(m[1]) * 100)
  const br = text.match(/<coverage[^>]*\bbranch-rate="([0-9.]+)"/)
  return {
    line_pct,
    branch_pct: br ? round2(parseFloat(br[1]) * 100) : 0,
    statement_pct: line_pct,
    function_pct: line_pct,
    coverage_pct: line_pct,
  }
}

function parseCoverage(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    let j
    try { j = JSON.parse(trimmed) } catch { j = null }
    if (j && j.total) {
      const r = fromIstanbulSummary(j)
      if (r) return r
    }
  }
  if (/<coverage[^>]*line-rate=/.test(text)) {
    const r = fromCoberturaXml(text)
    if (r) return r
  }
  if (/^(LF|LH|SF|BRF|FNF):/m.test(text)) {
    const r = fromLcov(text)
    if (r) return r
  }
  throw new Error('unrecognized coverage format (expected istanbul summary json / lcov / cobertura xml)')
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-coverage: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-coverage: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseCoverage(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-coverage: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseCoverage }

if (require.main === module) {
  process.exit(main(process.argv))
}
