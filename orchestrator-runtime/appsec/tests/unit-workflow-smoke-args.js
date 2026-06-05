#!/usr/bin/env node
//
// unit-workflow-smoke-args.js — Patch A.4 minimal real-Workflow smoke
//
// Builds a 1-phase spec that exercises the load-bearing path:
//   - alias "cheap_fast" resolution (Patch A.4)
//   - agent({model: 'haiku'}) actually launches via Workflow tool
//   - validate-spec + preflight gates fire correctly
//
// Cost: ~30-60k tokens (1 haiku agent call + Workflow overhead)
//
// Output: args.json suitable for `Workflow({scriptPath, args: <load>})`
//
// The 1-phase spec uses a trivial scope.v1 prompt + tiny SCOPE_SCHEMA so we
// can verify the dispatch path without scanning a real codebase.

'use strict'
const fs = require('fs')
 const crypto = require('crypto'), path = require('path')
const ROOT = path.resolve(__dirname, '..')

function stableStringify(o) {
  if (o === null || o === undefined) return 'null'
  if (typeof o !== 'object') return JSON.stringify(o)
  if (Array.isArray(o)) return '[' + o.map(stableStringify).join(',') + ']'
  const k = Object.keys(o).sort()
  return '{' + k.map(x => JSON.stringify(x) + ':' + stableStringify(o[x])).join(',') + '}'
}
function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16).padStart(8, '0'); }

// Minimal 1-phase spec — single node, alias model, no overlays, no invariants
const spec = {
  engine_version: "1.0",
  orchestrator: "appsec",
  phases: [
    {
      name: "Scope",
      type: "single",
      model: "cheap_fast",                    // ← Patch A.4: alias
      agentType: "appsec-risk-classifier",
      prompt_ref: "scope-tiny.v1",
      schema_ref: "SCOPE_TINY_SCHEMA.v1"
    }
  ],
  prompts: {
    "scope-tiny.v1":
`You are testing the AppSec orchestrator's alias-resolution path. Your only job:
return a JSON object that matches the SCOPE_TINY_SCHEMA schema. Specifically:

  {
    "ok": true,
    "alias_test": "Patch A.4 working",
    "csf_targets": ["GV", "ID"]
  }

Do not scan any files. Do not run any commands. Just produce that exact JSON.`
  },
  schemas: {
    "SCOPE_TINY_SCHEMA.v1": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["ok", "alias_test", "csf_targets"],
      "properties": {
        "ok": { "type": "boolean" },
        "alias_test": { "type": "string" },
        "csf_targets": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": true
    }
  }
}

const args = {
  spec,
  target: "Patch-A.4-unit-smoke (no real codebase scan)",
  run_id: "patch-a4-smoke-" + Math.floor(Date.now() / 1000),  // Skill main thread can use Date.now()
  severity_floor: "low",
  finders: [],   // empty — no fanout dispatch
  policy: { required_csf_functions: ['Govern','Identify'] },   // minimal
  oracle: { oracle_findings: [], recall_metric: { minimum_acceptable: 0 } },
  previous_results: {}
}
args.spec_hash = 'sha256:' + crypto.createHash('sha256').update(stableStringify(spec),'utf8').digest('hex')

const outPath = process.argv[2] || path.join(process.env.LOCALAPPDATA || '/tmp', 'Temp', 'patch-a4-smoke-args.json')
fs.writeFileSync(outPath, JSON.stringify(args, null, 2), 'utf8')

console.log(JSON.stringify({
  ok: true,
  args_out: outPath,
  spec_hash: args.spec_hash,
  run_id: args.run_id,
  phase_count: 1,
  args_size_bytes: fs.statSync(outPath).size,
  phase_summary: spec.phases.map(p => ({ name: p.name, type: p.type, model: p.model, agentType: p.agentType }))
}, null, 2))
