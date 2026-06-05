#!/usr/bin/env node
// Smoke test args builder: inlines prompts + schemas from disk into smoke spec,
// computes spec_hash (must match workflow body's djb2 algorithm exactly),
// and writes final args JSON for the smoke runner.

'use strict'

const fs   = require('fs')
 const crypto = require('crypto')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// ─── must match workflow body's algorithm ────────────────────────────
function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}
function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// ─── load spec preset and inline prompts/schemas ─────────────────────
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'presets', 'smoke.json'), 'utf8'))

// Walk all phases (and pipeline stages) to find prompt_ref / schema_ref
function collectRefs(spec) {
  const promptRefs = new Set()
  const schemaRefs = new Set()
  for (const node of spec.phases) {
    if (node.prompt_ref) promptRefs.add(node.prompt_ref)
    if (node.schema_ref) schemaRefs.add(node.schema_ref)
    for (const stage of (node.stages || [])) {
      if (stage.prompt_ref) promptRefs.add(stage.prompt_ref)
      if (stage.schema_ref) schemaRefs.add(stage.schema_ref)
    }
  }
  return { promptRefs: [...promptRefs], schemaRefs: [...schemaRefs] }
}

const { promptRefs, schemaRefs } = collectRefs(spec)

// Inline prompts: <ref>.md → spec.prompts[<ref>]
for (const ref of promptRefs) {
  const fname = ref.endsWith('.v1') ? `${ref}.md` : `${ref}.md`
  const p = path.join(ROOT, 'prompts', fname)
  if (!fs.existsSync(p)) {
    throw new Error(`prompt file not found: ${p}`)
  }
  spec.prompts[ref] = fs.readFileSync(p, 'utf8')
}

// Inline schemas: <REF>.json → spec.schemas[<REF>]
for (const ref of schemaRefs) {
  const fname = `${ref}.json`
  const p = path.join(ROOT, 'schemas', fname)
  if (!fs.existsSync(p)) {
    throw new Error(`schema file not found: ${p}`)
  }
  spec.schemas[ref] = JSON.parse(fs.readFileSync(p, 'utf8'))
}

// ─── construct args for smoke test ───────────────────────────────────
const args = {
  spec,
  target: 'smoke-test-mock-project',
  run_id: 'smoke-2026-05-28',
  severity_floor: 'low',
  // 2 finders only — small fanout
  finders: [
    { key: 'sca',    sub_skill: 'security-remediation-sca',  csf: ['Identify','Detect'], oracle_hints: [] },
    { key: 'secret', sub_skill: 'security-platform-secrets', csf: ['Protect','Detect'],  oracle_hints: [] },
  ],
  policy: {
    required_csf_functions: ['Govern','Identify','Protect','Detect','Respond','Recover'],
  },
  oracle: {
    oracle_findings: [],          // empty oracle → recall=1.0
    recall_metric: { minimum_acceptable: 0 },
  },
  previous_results: {},
}

// Compute spec_hash (would be passed to hook in real flow)
const specHash = 'sha256:' + crypto.createHash('sha256').update(stableStringify(spec),'utf8').digest('hex')
args.spec_hash = specHash

// ─── write output ─────────────────────────────────────────────────────
const outPath = process.argv[2] || '/tmp/smoke-args.json'
fs.writeFileSync(outPath, JSON.stringify(args, null, 2), 'utf8')
console.log(JSON.stringify({
  ok: true,
  out: outPath,
  spec_hash: specHash,
  phase_count: spec.phases.length,
  prompts_inlined: promptRefs.length,
  schemas_inlined: schemaRefs.length,
  args_size_bytes: fs.statSync(outPath).size,
}, null, 2))
