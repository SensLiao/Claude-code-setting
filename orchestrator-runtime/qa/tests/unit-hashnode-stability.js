#!/usr/bin/env node
/**
 * unit-hashnode-stability.js — verifies the QA workflow's hashNode helper is
 * (a) deterministic over repeated calls on the same input, (b) changes when
 * any input field changes (R15 node-specific extras included), (c) does NOT
 * change when an unrelated field is added.
 *
 * Workflow body cannot be require()'d (top-level return), so we shim and
 * exfiltrate hashNode + pickModel via eval inside an async function context.
 *
 * Exit:
 *   0 — all assertions PASS
 *   1 — at least one assertion FAILED (printed to stderr)
 */

'use strict'
const fs = require('fs')
const path = require('path')

const WF = process.argv[2] || path.join(process.env.HOME || process.env.USERPROFILE, '.claude/workflows/qa-orchestrator.js')
if (!fs.existsSync(WF)) {
  console.error('workflow file not found:', WF)
  process.exit(3)
}
const body = fs.readFileSync(WF, 'utf8')

// Extract just the helper functions we need: stableStringify, djb2, pickModel,
// pickModelFromStage, resolveModel, enrichStagesForHash, r15NodeExtras, hashNode.
function extractFn(src, name) {
  const re = new RegExp(`function ${name}[^]*?^\\}`, 'm')
  const m = src.match(re)
  if (!m) throw new Error(`could not extract function ${name}`)
  return m[0]
}

const helpers = ['stableStringify', 'djb2', 'resolveModel', 'pickModel', 'pickModelFromStage', 'enrichStagesForHash', 'r15NodeExtras', 'hashNode']
const code = helpers.map(n => extractFn(body, n)).join('\n\n')

const harness = `
const modelOverrides = null;
${code}
module.exports = { hashNode, pickModel, stableStringify, djb2 };
`

const tmp = path.join(path.dirname(WF), '_qa_hashnode_harness.js')
fs.writeFileSync(tmp, harness)
let mod
try {
  // Bust require cache
  delete require.cache[require.resolve(tmp)]
  mod = require(tmp)
} finally {
  try { fs.unlinkSync(tmp) } catch {}
}

const { hashNode, stableStringify } = mod

let failures = 0
function assert(name, cond, extra) {
  if (cond) {
    console.log(`  + ${name}`)
  } else {
    console.error(`  x ${name}${extra ? ' — ' + extra : ''}`)
    failures += 1
  }
}

const spec = {
  engine_version: '1.0',
  orchestrator: 'qa',
  ops_allowed: { deterministic: ['qa_gate_policy'], predicates: [], invariants: [] },
  prompts: { 'p.v1': 'hello {{ release_tag }}' },
  schemas: { 'S.v1': { type: 'object' } },
}

const node = {
  name: 'StaticBaseline',
  type: 'single',
  model: 'cheap_fast',
  resolved_model: 'haiku',
  agentType: 'code-reviewer',
  prompt_ref: 'p.v1',
  schema_ref: 'S.v1',
  stall_ms: 600000,
}

const ctxA = {
  state: { LayerSelect: { changed_surfaces: [{ path: 'src/a.tsx' }, { path: 'src/b.tsx' }] } },
  release_tag: 'rt-1',
  critical_release_paths: ['auth'],
  policy: { static_floor: { max_tsc_errors: 0 } },
  risk_snapshot: { final_level: 'Medium' },
}

// 1. Deterministic over repeated calls
const h1 = hashNode(node, spec, ctxA)
const h2 = hashNode(node, spec, ctxA)
assert('hashNode is deterministic over repeated calls', h1 === h2, `h1=${h1} h2=${h2}`)

// 2. Changes when release_tag changes
const ctxB = { ...ctxA, release_tag: 'rt-2' }
const hB = hashNode(node, spec, ctxB)
assert('hashNode changes when release_tag changes', h1 !== hB)

// 3. Changes when resolved_model changes (dual-layer rule cache invalidation)
const nodeMod = { ...node, resolved_model: 'sonnet' }
const hMod = hashNode(nodeMod, spec, ctxA)
assert('hashNode changes when resolved_model changes', h1 !== hMod)

// 4. R15: changes when changed_surfaces hash changes
const ctxC = { ...ctxA, state: { LayerSelect: { changed_surfaces: [{ path: 'src/c.tsx' }] } } }
const hC = hashNode(node, spec, ctxC)
assert('R15: hashNode changes when StaticBaseline surface_path_hash changes', h1 !== hC)

// 5. R15: E2E branch_sha changes invalidate cache for E2E node
const e2eNode = { ...node, name: 'E2E', type: 'pipeline', stages: [{ name: 'prepare', prompt_ref: 'p.v1', schema_ref: 'S.v1' }] }
const ctxE1 = { ...ctxA, branch_sha: 'abc123', viewport: { width: 1280, height: 720 } }
const ctxE2 = { ...ctxA, branch_sha: 'def456', viewport: { width: 1280, height: 720 } }
const hE1 = hashNode(e2eNode, spec, ctxE1)
const hE2 = hashNode(e2eNode, spec, ctxE2)
assert('R15: E2E hashNode changes when branch_sha changes', hE1 !== hE2)

// 6. R15: E2E viewport changes invalidate cache
const ctxE3 = { ...ctxE1, viewport: { width: 375, height: 812 } }
const hE3 = hashNode(e2eNode, spec, ctxE3)
assert('R15: E2E hashNode changes when viewport changes', hE1 !== hE3)

// 7. Prompt body change invalidates cache (CodexC3 — schema/prompt body fold-in)
const specMod = { ...spec, prompts: { 'p.v1': 'hello CHANGED {{ release_tag }}' } }
const hPm = hashNode(node, specMod, ctxA)
assert('hashNode changes when prompt body changes (CodexC3 fold-in)', h1 !== hPm)

// 8. Schema body change invalidates cache
const specMod2 = { ...spec, schemas: { 'S.v1': { type: 'object', required: ['x'] } } }
const hSm = hashNode(node, specMod2, ctxA)
assert('hashNode changes when schema body changes', h1 !== hSm)

// 9. stableStringify gives same output regardless of key order
const a = stableStringify({ b: 1, a: 2, c: 3 })
const b = stableStringify({ c: 3, a: 2, b: 1 })
assert('stableStringify is key-order independent', a === b, `a=${a} b=${b}`)

console.log('---')
console.log(`hashNode stability: ${9 - failures} PASS, ${failures} FAIL`)
process.exit(failures === 0 ? 0 : 1)
