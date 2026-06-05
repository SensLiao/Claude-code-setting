#!/usr/bin/env node
// Resume cache predictor — extracts hashNode logic from the workflow body
// (must stay byte-identical) and predicts CACHED/RUN for each phase given
// args.spec + args.ctx + args.previous_results.
//
// Used by P0 Step 2A.7 Resume verification to gate-check that a launch
// would 100% cache-hit BEFORE spending tokens.
//
// Usage:
//   node predict-resume-cache.js <args.json>
//
// Output:
//   - per-phase line: [CACHED|RUN] PhaseName  (reason if RUN)
//   - JSON summary on stdout (last line)
//   - exit 0 if all CACHED, exit 1 if any RUN (caller must NOT launch)

'use strict'

const fs = require('fs')

const argsPath = process.argv[2]
if (!argsPath) {
  process.stderr.write('usage: predict-resume-cache.js <args.json>\n')
  process.exit(2)
}

const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'))
const spec = args.spec
const prev = args.previous_results || {}

// ─── BYTE-IDENTICAL copy of hashNode + helpers from workflow body ────────
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
// Patch A.4 + §1.11 #2 (2026-05-28): alias resolution — MUST stay byte-identical
// to workflows/appsec-orchestrator.js pickModel/pickModelFromStage/resolveModel
// so the predictor agrees with the workflow body on fingerprints.
const modelOverrides = (args.model_policy && typeof args.model_policy === 'object') ? args.model_policy : null
function resolveModel(specModel, overrides) {
  if (overrides && typeof overrides === 'object' && specModel in overrides) {
    return overrides[specModel]
  }
  switch (specModel) {
    case 'cheap_fast':            return 'haiku'
    case 'balanced':              return 'sonnet'
    case 'strongest_available':   return 'opus'
    case 'inherit':
    case null:
    case undefined:               return 'inherit'
    default:                      return specModel
  }
}
function pickModel(node, overrides) {
  if (node && typeof node === 'object' && typeof node.resolved_model === 'string') {
    return node.resolved_model
  }
  return resolveModel(node ? node.model : undefined, overrides)
}
function pickModelFromStage(stage, parentNode, overrides) {
  if (stage && typeof stage === 'object' && typeof stage.resolved_model === 'string') {
    return stage.resolved_model
  }
  if (parentNode && typeof parentNode === 'object' && typeof parentNode.resolved_model === 'string'
      && (!stage || stage.model === undefined)) {
    return parentNode.resolved_model
  }
  return resolveModel((stage && stage.model) ?? (parentNode && parentNode.model), overrides)
}
function enrichStagesForHash(stages, specRef, parentNode) {
  if (!Array.isArray(stages)) return null
  return stages.map(s => {
    const promptRef = s.prompt_ref ?? parentNode.prompt_ref ?? null
    const schemaRef = s.schema_ref ?? parentNode.schema_ref ?? null
    return {
      type: s.type,
      // Patch A.4 + §1.11 #2: fingerprint with RESOLVED literal model
      model: pickModelFromStage(s, parentNode, modelOverrides),
      model_alias: s.model ?? parentNode.model ?? null,
      agentType: s.agentType ?? null,
      prompt_ref: promptRef,
      prompt_body: promptRef ? (specRef.prompts[promptRef] ?? null) : null,
      schema_ref: schemaRef,
      schema_body: schemaRef ? (specRef.schemas[schemaRef] ?? null) : null,
      vote_count_by_severity: s.vote_count_by_severity ?? null,
    }
  })
}
function hashNode(node, specRef, upstreamCtx) {
  const sig = {
    name: node.name,
    type: node.type,
    // Patch A.4 + §1.11 #2: hash RESOLVED literal; prefer Skill-pre-resolved value
    model: pickModel(node, modelOverrides),
    model_alias: node.model ?? null,
    model_policy_version: specRef.model_policy_version ?? null,
    agentType: node.agentType ?? null,
    prompt_ref: node.prompt_ref ?? null,
    prompt_body: node.prompt_ref ? (specRef.prompts[node.prompt_ref] ?? null) : null,
    schema_ref: node.schema_ref ?? null,
    schema_body: node.schema_ref ? (specRef.schemas[node.schema_ref] ?? null) : null,
    op: node.op ?? null,
    params: node.params ?? null,
    invariant_params: node.invariant_params ?? null,
    items_from: node.items_from ?? null,
    stages: enrichStagesForHash(node.stages, specRef, node),
    isolation: node.isolation ?? null,
    skip_if: node.skip_if ?? null,
    skip_default: node.skip_default ?? null,
    post_invariants: node.post_invariants ?? null,
    engine_version: specRef.engine_version,
    orchestrator: specRef.orchestrator,
    spec_ops_allowed: specRef.ops_allowed ?? null,
    ctx_target: upstreamCtx?.target ?? null,
    ctx_severity_floor: upstreamCtx?.severity_floor ?? null,
    ctx_policy: upstreamCtx?.policy ?? null,
    ctx_oracle: upstreamCtx?.oracle ?? null,
    ctx_finders: upstreamCtx?.finders ?? null,
    upstream_state: upstreamCtx?.state ?? null,
  }
  return djb2(stableStringify(sig))
}

// ─── walk phases & predict ────────────────────────────────────────────────
const state = {}
const rows = []
let allCached = true

for (const node of spec.phases) {
  const upstreamCtx = {
    target: args.target,
    severity_floor: args.severity_floor,
    policy: args.policy,
    oracle: args.oracle,
    finders: args.finders,
    state: JSON.parse(JSON.stringify(state)),  // snapshot at entry
  }
  const computed = hashNode(node, spec, upstreamCtx)
  const cached = prev[node.name]
  if (cached && cached.node_fingerprint === computed) {
    state[node.name] = cached.output
    rows.push({ phase: node.name, status: 'CACHED', fingerprint: computed })
  } else {
    allCached = false
    let reason
    if (!cached) reason = 'no previous_results entry for this phase'
    else if (cached.node_fingerprint !== computed)
      reason = `fingerprint mismatch (snapshot=${cached.node_fingerprint} computed=${computed})`
    else reason = 'unknown'
    rows.push({ phase: node.name, status: 'RUN', fingerprint: computed, reason })
    // We CANNOT continue with a "what would the output be?" — we'd need to actually run.
    // For predictor purposes, treat downstream as RUN-cascading.
    // But we still walk to surface all mismatches; just use null state for downstream.
    state[node.name] = null
  }
}

for (const r of rows) {
  if (r.status === 'CACHED') {
    process.stdout.write(`  [CACHED]  ${r.phase.padEnd(15)} fingerprint=${r.fingerprint}\n`)
  } else {
    process.stdout.write(`  [RUN]     ${r.phase.padEnd(15)} fingerprint=${r.fingerprint}  reason: ${r.reason}\n`)
  }
}

const summary = {
  all_cached: allCached,
  total_phases: rows.length,
  cached_count: rows.filter(r => r.status === 'CACHED').length,
  run_count: rows.filter(r => r.status === 'RUN').length,
  run_phases: rows.filter(r => r.status === 'RUN').map(r => ({phase: r.phase, reason: r.reason})),
}

process.stdout.write('\n' + JSON.stringify(summary, null, 2) + '\n')
process.exit(allCached ? 0 : 1)
