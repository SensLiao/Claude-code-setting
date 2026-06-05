#!/usr/bin/env node
// Build args.json for P0 Step 2A.7 Resume verification.
// Same spec + same ctx as graph-smoke, but with previous_results loaded from
// the SDK-persisted workflow-state snapshot. Uses fresh run_id so sentinel is
// distinct from the original run.

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

// Load same preset + inline (byte-identical to original run)
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'presets', 'graph-smoke.json'), 'utf8'))
function collectRefs(s) {
  const p = new Set(), c = new Set()
  for (const n of s.phases) {
    if (n.prompt_ref) p.add(n.prompt_ref)
    if (n.schema_ref) c.add(n.schema_ref)
    for (const st of (n.stages || [])) {
      if (st.prompt_ref) p.add(st.prompt_ref)
      if (st.schema_ref) c.add(st.schema_ref)
    }
  }
  return { promptRefs: [...p], schemaRefs: [...c] }
}
const { promptRefs, schemaRefs } = collectRefs(spec)
for (const ref of promptRefs) spec.prompts[ref] = fs.readFileSync(path.join(ROOT, 'prompts', `${ref}.md`), 'utf8')
for (const ref of schemaRefs) spec.schemas[ref] = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', `${ref}.json`), 'utf8'))

// Load previous_results from explicit snapshot file (must be pre-extracted from SDK YAML body)
const snapshotPath = process.argv[2]
if (!snapshotPath || !fs.existsSync(snapshotPath)) {
  process.stderr.write(`usage: build-resume-args.js <snapshot.json> <out-args.json>\n`)
  process.stderr.write(`  snapshot.json must contain phase_outputs_fingerprinted body\n`)
  process.exit(2)
}
const previous_results = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))

const args = {
  spec,
  target: 'synthetic-toy-fixture (P0-Step-2A-minimal-graph-smoke)',  // BYTE-IDENTICAL to original
  run_id: 'smoke-2a-resume-2026-05-28',                              // FRESH (sentinel uniqueness)
  severity_floor: 'low',
  finders: [
    { key: 'sca',          sub_skill: 'security-remediation-sca',  csf: ['Identify','Detect'], oracle_hints: [] },
    { key: 'code-review',  sub_skill: 'security-app-code-review',  csf: ['Identify','Protect','Detect'], oracle_hints: [] },
  ],
  policy: { required_csf_functions: ['Govern','Identify','Protect','Detect'] },
  oracle: { oracle_findings: [], recall_metric: { minimum_acceptable: 0 } },
  previous_results,
}

const specHash = 'sha256:' + crypto.createHash('sha256').update(stableStringify(spec),'utf8').digest('hex')
args.spec_hash = specHash

const outPath = process.argv[3] || path.join(process.env.LOCALAPPDATA || '/tmp', 'Temp', 'resume-args.json')
fs.writeFileSync(outPath, JSON.stringify(args, null, 2), 'utf8')

console.log(JSON.stringify({
  ok: true,
  args_out: outPath,
  spec_hash: specHash,
  phase_count: spec.phases.length,
  previous_results_phase_count: Object.keys(previous_results).length,
  expected_match_with_original_spec_hash: 'f0868886',
}, null, 2))
