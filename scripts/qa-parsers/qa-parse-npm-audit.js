#!/usr/bin/env node
/**
 * qa-parse-npm-audit@1 — deterministic parser for `npm audit --json` output.
 *
 * PARSER CONTRACT:
 *   node qa-parse-npm-audit.js <input-file>   (raw stdout of `npm audit --json`)
 *     → {"npm_audit_critical_count":N,"npm_audit_high_count":M} to stdout, exit 0
 * Keys match qa-aggregate-decision.js runStaticBaselinePolicy
 * (sb.npm_audit_critical_count / sb.npm_audit_high_count). Counted from bytes.
 *
 * Handles both npm v7+ (`metadata.vulnerabilities.{critical,high}` +
 * `vulnerabilities` map) and v6 (`metadata.vulnerabilities` + `advisories`).
 */
'use strict'

const fs = require('fs')

function parseNpmAudit(text) {
  let j
  try { j = JSON.parse(text) } catch (e) { throw new Error('not valid JSON') }
  let critical = null
  let high = null
  // npm v7+ / v6 both expose metadata.vulnerabilities counts — most reliable.
  const mv = j && j.metadata && j.metadata.vulnerabilities
  if (mv && typeof mv === 'object') {
    if (typeof mv.critical === 'number') critical = mv.critical
    if (typeof mv.high === 'number') high = mv.high
  }
  // Fallback: count from the vulnerabilities map (v7) or advisories (v6).
  if (critical === null || high === null) {
    let c = 0, h = 0
    if (j.vulnerabilities && typeof j.vulnerabilities === 'object') {
      for (const v of Object.values(j.vulnerabilities)) {
        if (v && v.severity === 'critical') c++
        else if (v && v.severity === 'high') h++
      }
    } else if (j.advisories && typeof j.advisories === 'object') {
      for (const a of Object.values(j.advisories)) {
        if (a && a.severity === 'critical') c++
        else if (a && a.severity === 'high') h++
      }
    }
    if (critical === null) critical = c
    if (high === null) high = h
  }
  return { npm_audit_critical_count: critical || 0, npm_audit_high_count: high || 0 }
}

function main(argv) {
  const file = argv[2]
  if (!file) { process.stderr.write('qa-parse-npm-audit: missing <input-file>\n'); return 1 }
  let text
  try { text = fs.readFileSync(file, 'utf8') }
  catch (e) { process.stderr.write(`qa-parse-npm-audit: cannot read ${file}: ${e.message}\n`); return 1 }
  try {
    process.stdout.write(JSON.stringify(parseNpmAudit(text)) + '\n')
    return 0
  } catch (e) {
    process.stderr.write(`qa-parse-npm-audit: parse error: ${e.message}\n`); return 1
  }
}

module.exports = { parseNpmAudit }

if (require.main === module) {
  process.exit(main(process.argv))
}
