#!/usr/bin/env node
/**
 * qa-parse-junit@1 — deterministic parser for JUnit XML test reports.
 *
 * PARSER CONTRACT:
 *   node qa-parse-junit.js <input-file>   (a JUnit/xUnit XML report)
 *     → {"tests","failures","errors","skipped","passed"} to stdout, exit 0
 * Prefers a root <testsuites> aggregate; otherwise sums every <testsuite>.
 * passed = tests - failures - errors - skipped (clamped ≥ 0). Counted from bytes.
 */
'use strict'

const fs = require('fs')

function attr(tag, name) {
  const m = tag.match(new RegExp('\\b' + name + '="([0-9]+)"'))
  return m ? parseInt(m[1], 10) : 0
}

function parseJunit(text) {
  // Prefer the single root <testsuites ...> opening tag if it carries counts.
  const suitesOpen = text.match(/<testsuites\b[^>]*>/)
  let tests = 0, failures = 0, errors = 0, skipped = 0
  if (suitesOpen && /\btests="/.test(suitesOpen[0])) {
    tests = attr(suitesOpen[0], 'tests')
    failures = attr(suitesOpen[0], 'failures')
    errors = attr(suitesOpen[0], 'errors')
    skipped = attr(suitesOpen[0], 'skipped')
  } else {
    // Sum every <testsuite ...> opening tag.
    const suiteTags = text.match(/<testsuite\b[^>]*>/g) || []
    if (suiteTags.length === 0) throw new Error('no <testsuite> / <testsuites> elements found')
    for (const t of suiteTags) {
      tests += attr(t, 'tests')
      failures += attr(t, 'failures')
      errors += attr(t, 'errors')
      skipped += attr(t, 'skipped')
    }
  }
  const passed = Math.max(0, tests - failures - errors - skipped)
  return { tests, failures, errors, skipped, passed }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-junit: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-junit: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseJunit(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-junit: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseJunit }

if (require.main === module) {
  process.exit(main(process.argv))
}
