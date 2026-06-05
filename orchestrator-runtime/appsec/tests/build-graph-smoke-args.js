#!/usr/bin/env node
// P0 Step 2A — Minimal Graph Smoke args builder.
// Inlines prompts + schemas from graph-smoke.json, computes spec_hash,
// builds ctx.finders (2 toy finders), oracle (empty), previous_results (empty).
// Writes args.json for Workflow launch. Identical algorithm to
// build-smoke-args.js but loads graph-smoke.json and uses synthetic target.

'use strict'

const fs   = require('fs')
 const crypto = require('crypto')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

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

// Load preset
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'presets', 'graph-smoke.json'), 'utf8'))

// Collect refs and inline bodies
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
for (const ref of promptRefs) {
  const p = path.join(ROOT, 'prompts', `${ref}.md`)
  if (!fs.existsSync(p)) throw new Error(`prompt file not found: ${p}`)
  spec.prompts[ref] = fs.readFileSync(p, 'utf8')
}
for (const ref of schemaRefs) {
  const p = path.join(ROOT, 'schemas', `${ref}.json`)
  if (!fs.existsSync(p)) throw new Error(`schema file not found: ${p}`)
  spec.schemas[ref] = JSON.parse(fs.readFileSync(p, 'utf8'))
}

// Build args — synthetic toy project, no real repo scan
const args = {
  spec,
  target: 'synthetic-toy-fixture (P0-Step-2A-minimal-graph-smoke)',
  run_id: 'smoke-2a-2026-05-28',
  severity_floor: 'low',
  // 2 finders only — minimal fanout
  finders: [
    { key: 'sca',          sub_skill: 'security-remediation-sca',  csf: ['Identify','Detect'], oracle_hints: [] },
    { key: 'code-review',  sub_skill: 'security-app-code-review',  csf: ['Identify','Protect','Detect'], oracle_hints: [] },
  ],
  policy: {
    // For smoke: just GV+ID+PR+DE so ensure_csf_coverage is satisfied without
    // forcing 11 finders. Skill in real run would pass all 6.
    required_csf_functions: ['Govern','Identify','Protect','Detect'],
  },
  oracle: {
    oracle_findings: [],
    recall_metric: { minimum_acceptable: 0 },
  },
  previous_results: {},
}

const specHash = 'sha256:' + crypto.createHash('sha256').update(stableStringify(spec),'utf8').digest('hex')
args.spec_hash = specHash

const outPath = process.argv[2] || path.join(process.env.LOCALAPPDATA || '/tmp', 'Temp', 'graph-smoke-args.json')
fs.writeFileSync(outPath, JSON.stringify(args, null, 2), 'utf8')

// Also emit a stripped spec-only file for separate validate-spec.js check
const specOnlyPath = outPath.replace(/\.json$/, '.spec.json')
fs.writeFileSync(specOnlyPath, JSON.stringify(spec, null, 2), 'utf8')

console.log(JSON.stringify({
  ok: true,
  args_out: outPath,
  spec_out: specOnlyPath,
  spec_hash: specHash,
  phase_count: spec.phases.length,
  prompts_inlined: promptRefs.length,
  schemas_inlined: schemaRefs.length,
  finder_count: args.finders.length,
  args_size_bytes: fs.statSync(outPath).size,
  // for preview rendering
  phase_summary: spec.phases.map(p => ({
    name: p.name,
    type: p.type,
    model: p.model || null,
    agentType: p.agentType || null,
    op: p.op || null,
    items_from: p.items_from || null,
    stages_count: (p.stages || []).length,
  })),
}, null, 2))
