#!/usr/bin/env node
/**
 * shared/spec-hash.js — canonical spec_hash computation
 *
 * Algorithm MUST match byte-for-byte with:
 *   ~/.claude/hooks/qa-preview-gate.js         (sha256Hex + stableStringify + computeSpecHash)
 *   ~/.claude/hooks/appsec-preview-gate.js     (same algorithm)
 *
 * Used by:
 *   - qa-sdk.sh spec.hash / sentinel.write
 *   - appsec-sdk.sh (planned consumer)
 *   - Skill main thread workflow-spec launchers (per SKILL §18.5 / §16.11)
 *
 * Output: 'sha256:<64-hex>'
 *
 * Usage:
 *   node shared/spec-hash.js <spec.json>         # read file
 *   node shared/spec-hash.js -                   # read stdin
 *   echo "$spec" | node shared/spec-hash.js -    # stdin pipe
 *
 * Exit:
 *   0 — hash written to stdout
 *   1 — read / parse / hash failure (message on stderr)
 *
 * Library mode:
 *   const { stableStringify, specHash } = require('./shared/spec-hash.js')
 */

'use strict'

const crypto = require('crypto')

function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}

function specHash(spec) {
  return 'sha256:' + sha256Hex(stableStringify(spec))
}

module.exports = { stableStringify, sha256Hex, specHash }

if (require.main === module) {
  const fs = require('fs')
  let raw
  try {
    const src = process.argv[2]
    if (!src || src === '-') {
      raw = fs.readFileSync(0, 'utf8')
    } else {
      raw = fs.readFileSync(src, 'utf8')
    }
  } catch (e) {
    process.stderr.write(`spec-hash: read error: ${e.message}\n`)
    process.exit(1)
  }
  let spec
  try {
    spec = JSON.parse(raw)
  } catch (e) {
    process.stderr.write(`spec-hash: JSON parse error: ${e.message}\n`)
    process.exit(1)
  }
  try {
    process.stdout.write(specHash(spec) + '\n')
  } catch (e) {
    process.stderr.write(`spec-hash: hash error: ${e.message}\n`)
    process.exit(1)
  }
}
