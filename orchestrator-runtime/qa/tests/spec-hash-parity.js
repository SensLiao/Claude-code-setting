#!/usr/bin/env node
/**
 * tests/spec-hash-parity.js — byte-identical algorithm parity between
 *   ~/.claude/orchestrator-runtime/shared/spec-hash.js  (canonical helper)
 *   ~/.claude/hooks/qa-preview-gate.js                  (PreToolUse gate)
 *
 * If these ever diverge, the hook will reject every Skill-written sentinel
 * (spec_hash mismatch) and silently break workflow-spec launches.
 *
 * Run:    node tests/spec-hash-parity.js
 * Exit:   0 = PASS / 1 = FAIL with diff dump
 */

'use strict'

const path   = require('path')
const fs     = require('fs')
const crypto = require('crypto')

// ── Helper-under-test ─────────────────────────────────────────────
const helperPath = path.join(__dirname, '..', '..', 'shared', 'spec-hash.js')
if (!fs.existsSync(helperPath)) {
  console.error(`FAIL: helper missing at ${helperPath}`)
  process.exit(1)
}
const helper = require(helperPath)

// ── Hook reference — copy-paste of qa-preview-gate.js algorithm ───
// MUST stay byte-identical with hook source. Update both together.
function refStableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(refStableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + refStableStringify(obj[k])).join(',') + '}'
}
function refSha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}
function refSpecHash(spec) {
  return 'sha256:' + refSha256Hex(refStableStringify(spec))
}

// ── Fixtures: synthetic + real presets + edge cases ───────────────
const fixtures = [
  { name: 'empty obj',           input: {} },
  { name: 'empty arr',           input: [] },
  { name: 'primitive str',       input: 'hello' },
  { name: 'primitive num',       input: 42 },
  { name: 'primitive bool',      input: true },
  { name: 'null',                input: null },
  { name: 'key-order sort {b,a}',input: { b: 1, a: 2 } },
  { name: 'nested deep',         input: { a: { b: { c: { d: { e: 'leaf' } } } } } },
  { name: 'mixed types',         input: { s:'x', n:1, b:true, n2:null, a:[1,2,3], o:{ k:'v'} } },
  { name: 'unicode keys',        input: { '中文': 1, 'emoji_x': 2 } },
  { name: 'array of objects',    input: [{ a: 1 }, { b: 2 }, { c: 3 }] },
  { name: 'special chars',       input: { 'key with "quotes"': 'value\\with\\backslash' } },
]

const presetsDir = path.join(__dirname, '..', 'presets')
if (fs.existsSync(presetsDir)) {
  for (const f of fs.readdirSync(presetsDir).filter(x => x.endsWith('.json'))) {
    fixtures.push({
      name: `real preset: ${f}`,
      input: JSON.parse(fs.readFileSync(path.join(presetsDir, f), 'utf8')),
    })
  }
}

// AppSec presets too (cross-domain assurance — same algo used by appsec-preview-gate)
const appsecPresets = path.join(__dirname, '..', '..', 'appsec', 'presets')
if (fs.existsSync(appsecPresets)) {
  for (const f of fs.readdirSync(appsecPresets).filter(x => x.endsWith('.json'))) {
    fixtures.push({
      name: `appsec preset: ${f}`,
      input: JSON.parse(fs.readFileSync(path.join(appsecPresets, f), 'utf8')),
    })
  }
}

// ── Run parity ────────────────────────────────────────────────────
let pass = 0
let fail = 0
for (const fx of fixtures) {
  const lib  = helper.specHash(fx.input)
  const ref  = refSpecHash(fx.input)
  if (lib === ref) { pass++ }
  else {
    fail++
    console.error(`FAIL: ${fx.name}\n  helper: ${lib}\n  hook  : ${ref}\n  payload(truncated): ${JSON.stringify(fx.input).slice(0,200)}`)
  }
}

// stableStringify parity (independent of hash)
const stringifyTests = [
  { a: 1, b: 2 },
  { b: 2, a: 1 },         // expect identical output
  [{ z: 1 }, { a: 2 }],
  null,
  undefined,
]
for (const t of stringifyTests) {
  const lib = helper.stableStringify(t)
  const ref = refStableStringify(t)
  if (lib === ref) { pass++ }
  else {
    fail++
    console.error(`FAIL stableStringify: ${JSON.stringify(t)} lib=${lib} ref=${ref}`)
  }
}

console.log(`spec-hash parity: ${pass}/${pass+fail}`)
if (fail > 0) {
  console.error(`FAIL: ${fail} divergences — fix shared/spec-hash.js OR qa-preview-gate.js`)
  process.exit(1)
}
process.exit(0)
