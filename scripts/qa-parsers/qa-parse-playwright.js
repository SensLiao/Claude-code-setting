#!/usr/bin/env node
/**
 * qa-parse-playwright@1 — deterministic parser for Playwright JSON report.
 *
 * PARSER CONTRACT:
 *   node qa-parse-playwright.js <input-file>   (`playwright test --reporter=json`)
 *     → {"passed","failed","flaky","skipped","tests"} to stdout, exit 0
 * Prefers the top-level `.stats` block (expected/unexpected/flaky/skipped);
 * falls back to walking suites→specs→tests counting `status`/`outcome`.
 * flaky is surfaced separately — pass-on-retry is NOT a clean pass (parent §9).
 */
'use strict'

const fs = require('fs')

function fromStats(s) {
  const passed = Number(s.expected ?? 0)
  const failed = Number(s.unexpected ?? 0)
  const flaky = Number(s.flaky ?? 0)
  const skipped = Number(s.skipped ?? 0)
  return { passed, failed, flaky, skipped, tests: passed + failed + flaky + skipped }
}

function walk(j) {
  let passed = 0, failed = 0, flaky = 0, skipped = 0
  const visitSpec = (spec) => {
    for (const test of spec.tests || []) {
      const outcome = test.outcome // 'expected' | 'unexpected' | 'flaky' | 'skipped'
      if (outcome === 'expected') passed++
      else if (outcome === 'unexpected') failed++
      else if (outcome === 'flaky') flaky++
      else if (outcome === 'skipped') skipped++
      else {
        // older shape: results[].status
        const st = (test.results || []).map(r => r.status)
        if (st.includes('passed')) passed++
        else if (st.includes('failed') || st.includes('timedOut')) failed++
        else if (st.includes('skipped')) skipped++
      }
    }
  }
  const visitSuite = (suite) => {
    for (const spec of suite.specs || []) visitSpec(spec)
    for (const child of suite.suites || []) visitSuite(child)
  }
  for (const suite of j.suites || []) visitSuite(suite)
  return { passed, failed, flaky, skipped, tests: passed + failed + flaky + skipped }
}

function parsePlaywright(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('not valid JSON') }
  if (j && j.stats && typeof j.stats === 'object' &&
      ('expected' in j.stats || 'unexpected' in j.stats || 'flaky' in j.stats)) {
    return fromStats(j.stats)
  }
  if (j && Array.isArray(j.suites)) return walk(j)
  throw new Error('not a Playwright JSON report (no .stats and no .suites)')
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-playwright: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-playwright: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parsePlaywright(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-playwright: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parsePlaywright }

if (require.main === module) {
  process.exit(main(process.argv))
}
