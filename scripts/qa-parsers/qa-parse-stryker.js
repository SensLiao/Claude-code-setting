#!/usr/bin/env node
/**
 * qa-parse-stryker@1 — deterministic parser for Stryker mutation report JSON.
 *
 * PARSER CONTRACT:
 *   node qa-parse-stryker.js <input-file>   (Stryker mutation-report.json /
 *                                            mutation-test-elements schema)
 *     → {"mutation_score","killed","survived","timeout","no_coverage","total"} exit 0
 *
 * mutation_score = (killed + timeout) / (killed + timeout + survived + noCoverage) * 100
 * (Stryker's definition — RuntimeError / CompileError / Ignored excluded from the
 * denominator as they are not valid test gaps). Counted from per-mutant status bytes.
 */
'use strict'

const fs = require('fs')

function round2(n) { return Math.round(n * 100) / 100 }

function collectStatuses(j) {
  const counts = { Killed: 0, Survived: 0, Timeout: 0, NoCoverage: 0, CompileError: 0, RuntimeError: 0, Ignored: 0 }
  const files = j.files && typeof j.files === 'object' ? j.files : null
  if (!files) return null
  for (const f of Object.values(files)) {
    if (!f || !Array.isArray(f.mutants)) continue
    for (const mut of f.mutants) {
      const s = mut && mut.status
      if (s && s in counts) counts[s]++
    }
  }
  return counts
}

function parseStryker(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('not valid JSON') }
  const c = collectStatuses(j)
  if (!c) throw new Error('not a Stryker mutation report (no .files{}.mutants[])')
  const killed = c.Killed
  const timeout = c.Timeout
  const survived = c.Survived
  const no_coverage = c.NoCoverage
  const detected = killed + timeout
  const validDenom = detected + survived + no_coverage
  const mutation_score = validDenom === 0 ? 0 : round2((detected / validDenom) * 100)
  const total = killed + timeout + survived + no_coverage + c.CompileError + c.RuntimeError + c.Ignored
  return { mutation_score, killed, survived, timeout, no_coverage, total }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-stryker: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-stryker: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseStryker(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-stryker: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseStryker }

if (require.main === module) {
  process.exit(main(process.argv))
}
