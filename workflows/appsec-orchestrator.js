/* @governance
 *   reviewed_by:             SensLiao (harness author)
 *   reviewed_at:             2026-06-10
 *   allowed_scope:           governed-gate
 *   release_gate_allowed:    true    # deterministic AppSec spec-runner; walks a spec_hash-approved spec only
 *   destructive_ops_allowed: false
 */
export const meta = {
  name: 'appsec-orchestrator',
  description: 'Spec-driven AppSec orchestrator meta-runner. Reads args.spec (phases plus inline prompts plus inline schemas plus whitelisted ops), executes via Workflow primitives, returns phase_outputs for Skill-side persistence. Body is deterministic: no filesystem, no module loading, no wall-clock or RNG calls.',
  whenToUse: 'Invoked by appsec-security-orchestrator skill in workflow-spec mode after Execution Preview is approved AND the Workflow capability flag is enabled. Not for standalone use — spec is mandatory.',
  phases: [],
}

// ─── args normalization ──────────────────────────────────────────────
const input = typeof args === 'string'
  ? (() => { try { return JSON.parse(args) } catch { return null } })()
  : (args ?? null)

if (!input || typeof input !== 'object') {
  throw new Error('appsec-orchestrator: args must be an object containing spec, target, run_id')
}
if (!input.spec || typeof input.spec !== 'object') {
  throw new Error('appsec-orchestrator: args.spec is required')
}
if (!input.run_id || typeof input.run_id !== 'string') {
  throw new Error('appsec-orchestrator: args.run_id is required (non-empty string)')
}
if (input.spec.orchestrator !== 'appsec') {
  throw new Error(`appsec-orchestrator: spec.orchestrator must be "appsec" (got "${input.spec.orchestrator}")`)
}
if (input.spec.engine_version !== '1.0') {
  throw new Error(`appsec-orchestrator: unsupported spec.engine_version "${input.spec.engine_version}", expected "1.0"`)
}
if (!Array.isArray(input.spec.phases) || input.spec.phases.length === 0) {
  throw new Error('appsec-orchestrator: spec.phases must be a non-empty array')
}
if (!input.spec.prompts || typeof input.spec.prompts !== 'object') {
  throw new Error('appsec-orchestrator: spec.prompts must be an object (may be empty {})')
}
if (!input.spec.schemas || typeof input.spec.schemas !== 'object') {
  throw new Error('appsec-orchestrator: spec.schemas must be an object (may be empty {})')
}

const spec    = input.spec
const target  = input.target ?? 'unknown-target'
const runId   = input.run_id
const severityFloor = input.severity_floor ?? 'low'
const finders = input.finders ?? []
const policy  = input.policy  ?? { required_csf_functions: ['Govern','Identify','Protect','Detect','Respond','Recover'] }
const oracle  = input.oracle  ?? { oracle_findings: [], recall_metric: { minimum_acceptable: 0 } }
// CROSS-SESSION resume engine — DO NOT shed (NATIVE-OVERLAP-AUDIT §6 #1 CORRECTION; re-verified 2026-05-29).
// previous_results + hashNode/djb2/stableStringify + phase_outputs_fingerprinted IS the cross-session resume
// mechanism. Native resumeFromRunId is SAME-session only and does NOT replace it. Code-reading confirmed there is
// NO separable same-session-only cache here, so deleting djb2/stableStringify or the fingerprint loop would break
// cross-session resume. Keep.
const previousResults = input.previous_results ?? {}
const modelOverrides  = (input.model_policy && typeof input.model_policy === 'object') ? input.model_policy : null
// runtime-appsec#3 (2026-06-10): seeded_state — a DISTINCT input channel from
// previous_results. previous_results is the fingerprinted resume cache
// ({<phase>:{node_fingerprint,output}}); seeding via it fails because the runner
// only consults previous_results[node.name] for phases that EXIST in spec.phases,
// and a bare seed has no node_fingerprint (logged as 'unfingerprinted cache entry'
// → cache miss). seeded_state injects raw phase outputs DIRECTLY into state for
// phases that are NOT nodes in this spec (e.g. incident-response seeds Normalize +
// Verify so the live Map node and the deterministic Gate op can read them).
const seededState = (input.seeded_state && typeof input.seeded_state === 'object' && !Array.isArray(input.seeded_state))
  ? input.seeded_state
  : {}

const state = {}
const reusedPhases = []
const cacheMisses  = []
const seededPhases = []         // phase names injected via seeded_state (for return/preview transparency)
const phaseFingerprints = {}    // node.name → fingerprint captured at phase entry

// ─── seed state BEFORE the main loop (runtime-appsec#3) ─────────────────────
// A seeded key that COLLIDES with a real spec.phases node is IGNORED (the live
// phase is authoritative — never shadow real execution). Non-colliding keys are
// injected so deterministic ops / predicates / live nodes downstream can read them.
{
  const phaseNames = new Set((spec.phases || []).map(p => p && p.name))
  for (const key of Object.keys(seededState)) {
    if (phaseNames.has(key)) {
      log(`seeded_state: ignoring "${key}" — collides with a live spec.phases node (live phase wins)`)
      continue
    }
    state[key] = seededState[key]
    seededPhases.push(key)
    log(`seeded_state: injected "${key}" into state`)
  }
}

// ─── helpers: deterministic ────────────────────────────────────────────
function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

// djb2 hash — pure deterministic, no crypto module needed
function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// §1.11 correction #2 (2026-05-28): Skill is the SOURCE OF TRUTH for alias
// resolution. Skill writes node.resolved_model BEFORE launch; Workflow body
// just reads it. This function is the LEGACY backward-compat fallback for
// pre-v1.11 specs that did not pre-resolve.
//
// pickModel(node, overrides): prefer node.resolved_model. Fall back to
// resolveModel(node.model, overrides) if Skill did not pre-resolve.
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
    default:                      return specModel  // legacy literal: haiku/sonnet/opus or future
  }
}

// Enrich stage entries with referenced prompt/schema bodies so changes to those
// invalidate cache for pipeline phases (codex C3).
function enrichStagesForHash(stages, specRef, parentNode) {
  if (!Array.isArray(stages)) return null
  return stages.map(s => {
    const promptRef = s.prompt_ref ?? parentNode.prompt_ref ?? null
    const schemaRef = s.schema_ref ?? parentNode.schema_ref ?? null
    return {
      type: s.type,
      // Patch A.4 + §1.11 #2: fingerprint with RESOLVED literal model so alias
      // remap = cache invalidation. Prefer Skill-pre-resolved value.
      model: pickModelFromStage(s, parentNode, modelOverrides),
      // Capture alias separately for fingerprint clarity
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

// hashNode now also folds in upstream ctx (codex C2). Any change to target,
// policy, oracle, finders, severity_floor, OR any upstream phase output
// invalidates this node's resume cache.
function hashNode(node, specRef, upstreamCtx) {
  const sig = {
    // node definition
    name: node.name,
    type: node.type,
    // Patch A.4 + §1.11 #2: hash the RESOLVED literal (e.g. 'haiku'), not the
    // alias. Prefer Skill-pre-resolved node.resolved_model; fall back to
    // runtime resolveModel for backward-compat with pre-v1.11 specs.
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
    // spec-global
    engine_version: specRef.engine_version,
    orchestrator: specRef.orchestrator,
    spec_ops_allowed: specRef.ops_allowed ?? null,    // codex R2: invalidate cache when whitelist tightens
    // upstream ctx — any change invalidates cache
    ctx_target: upstreamCtx?.target ?? null,
    ctx_severity_floor: upstreamCtx?.severity_floor ?? null,
    ctx_policy: upstreamCtx?.policy ?? null,
    ctx_oracle: upstreamCtx?.oracle ?? null,
    ctx_finders: upstreamCtx?.finders ?? null,
    // upstream state — any change invalidates cache
    upstream_state: upstreamCtx?.state ?? null,
  }
  return djb2(stableStringify(sig))
}

// Severity normalize (codex H2)
function normSeverity(s) {
  if (typeof s !== 'string') return 'info'
  return s.toLowerCase().trim()
}
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
function sevRank(s) { return SEVERITY_RANK[normSeverity(s)] ?? 0 }

// strict path resolver — hard fails on missing variable (CAVEAT 6)
function resolvePathStrict(path, locals) {
  const parts = path.split('.')
  let cur = locals
  for (const p of parts) {
    if (cur === null || cur === undefined || !(p in cur)) {
      throw new Error(`missing template variable: {{ ${path} }} (failed at "${p}")`)
    }
    cur = cur[p]
  }
  return cur
}

function render(tmpl, locals) {
  if (typeof tmpl !== 'string') {
    throw new Error('render: template must be a string')
  }
  // Codex M2: validate the TEMPLATE (not output) for malformed placeholders.
  // Substituted JSON values legitimately contain `}}` at nested-object tails, so
  // scanning the output produces false positives. Validate template only.
  const placeholderRe = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g
  const wellFormedCount = (tmpl.match(placeholderRe) || []).length
  const openCount  = (tmpl.match(/\{\{/g) || []).length
  const closeCount = (tmpl.match(/\}\}/g) || []).length
  if (openCount !== wellFormedCount || closeCount !== wellFormedCount) {
    // find first malformed occurrence for diagnostic
    const tmp = tmpl.replace(placeholderRe, '')
    const idxOpen  = tmp.indexOf('{{')
    const idxClose = tmp.indexOf('}}')
    const idx = idxOpen !== -1 ? idxOpen : idxClose
    const snippet = tmp.slice(Math.max(0, idx - 20), idx + 40)
    throw new Error(`render: malformed placeholder in template near "${snippet}" (open=${openCount}, close=${closeCount}, well-formed=${wellFormedCount})`)
  }
  return tmpl.replace(placeholderRe, (_, path) => {
    const v = resolvePathStrict(path, locals)
    if (v === undefined) {
      throw new Error(`render: variable {{ ${path} }} resolved to undefined`)
    }
    return typeof v === 'string' ? v : JSON.stringify(v)
  })
}

// items_from resolver — dot chain only, no JS expressions.
// Codex L1: undefined path is an error, not a silent empty array.
function resolveItems(pathSpec, ctxObj) {
  if (typeof pathSpec !== 'string') throw new Error('items_from must be a string')
  if (!/^(state|ctx)(\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(pathSpec)) {
    throw new Error(`items_from "${pathSpec}" must be a dot-chain starting with state. or ctx.`)
  }
  const parts = pathSpec.split('.')
  const root = parts.shift()
  const startObj = (root === 'state') ? ctxObj.state : ctxObj
  let cur = startObj
  for (const k of parts) {
    if (cur == null || !(k in cur)) {
      throw new Error(`items_from "${pathSpec}" failed at "${k}" (upstream not produced yet?)`)
    }
    cur = cur[k]
  }
  if (cur == null) {
    throw new Error(`items_from "${pathSpec}" resolved to null/undefined`)
  }
  if (!Array.isArray(cur)) {
    throw new Error(`items_from "${pathSpec}" must resolve to an array (got ${typeof cur})`)
  }
  return cur
}

// fanout item normalizer (runtime-appsec#1, 2026-06-10).
// Plan.selected_finders is a string[] (finder keys, produced by ensure_csf_coverage),
// but fanout prompts (find.v1) reference item.key / item.sub_skill / item.csf /
// item.oracle_hints. A bare string fails the strict render's `in` operator (TypeError).
// Normalize each item: if it is a string primitive, resolve it to the full finder
// object from ctx.finders by key; fall back to {key:<string>} when no finder matches.
// Object items pass through UNCHANGED (preserves prior behavior for object fanouts).
function normalizeFanoutItem(item, ctxObj) {
  if (typeof item !== 'string') return item
  const finders = Array.isArray(ctxObj.finders) ? ctxObj.finders : []
  const match = finders.find(f => f && typeof f === 'object' && f.key === item)
  return match ? match : { key: item }
}

// ─── 3 OPS registries (CAVEAT 7) ───────────────────────────────────────
const DETERMINISTIC_OPS = {
  fingerprint_cluster: (ctx, _params) => {
    const findings = ctx.state.Normalize?.findings ?? []
    const floor = sevRank(ctx.severity_floor)
    const clustersByFp = {}
    for (const f of findings) {
      const fp = `${(f.file || '').toLowerCase().trim()}|${(f.title || '').toLowerCase().trim().slice(0, 40)}`
      if (!clustersByFp[fp]) {
        clustersByFp[fp] = {
          cluster_id: `c-${Object.keys(clustersByFp).length + 1}`,
          fingerprint: fp,
          canonical: f,                    // tentative; replaced below if higher-severity dup found
          members: [],
        }
      } else {
        // Codex H1: keep the highest-severity finding as canonical to avoid
        // hiding a critical/high dup behind an earlier low canonical.
        if (sevRank(f.severity) > sevRank(clustersByFp[fp].canonical?.severity)) {
          clustersByFp[fp].canonical = f
        }
      }
      clustersByFp[fp].members.push(f.id)
    }
    const all_clusters = Object.values(clustersByFp)
    const eligible_clusters = all_clusters.filter(c => sevRank(c.canonical?.severity) >= floor)
    return {
      all_clusters,
      eligible_clusters,
      pruned_count: all_clusters.length - eligible_clusters.length,
    }
  },

  appsec_gate_policy: (ctx, _params) => {
    const accepted = []
    const verifyOut = ctx.state.Verify ?? []
    for (const cluster of verifyOut) {
      if (cluster?.resolved === 'accept') accepted.push(cluster)
    }
    const mappedFindings = ctx.state.Map?.findings ?? []
    const evidencedCSF = new Set()
    for (const f of mappedFindings) {
      for (const c of (f.csf || [])) evidencedCSF.add(c)
    }
    const required = ctx.policy?.required_csf_functions ?? []
    const missingCSF = required.filter(c => !evidencedCSF.has(c))

    const blockingIds = accepted
      .filter(a => sevRank(a.canonical?.severity) >= SEVERITY_RANK['high'])
      .map(a => a.canonical?.id ?? null)
      .filter(Boolean)

    const oracleFindings = ctx.oracle?.oracle_findings ?? []
    const normFindings = ctx.state.Normalize?.findings ?? []
    const oracleConfirmed = oracleFindings.filter(o =>
      normFindings.some(f => f.oracle_ref === o.oracle_id)
    ).length
    const recallRate = oracleFindings.length === 0 ? 1 : oracleConfirmed / oracleFindings.length
    const recallThreshold = ctx.oracle?.recall_metric?.minimum_acceptable ?? 0

    let decision
    if (missingCSF.length > 0) decision = 'BLOCK'
    else if (blockingIds.length > 0) decision = 'BLOCK'
    else if (recallRate < recallThreshold) decision = 'BLOCK'
    else if (accepted.some(a => normSeverity(a.canonical?.severity) === 'medium')) decision = 'WARN'
    else decision = 'PASS'

    return {
      decision,
      blocking_findings: blockingIds,
      evidenced_csf: [...evidencedCSF],
      missing_csf: missingCSF,
      recall: {
        confirmed: oracleConfirmed,
        total: oracleFindings.length,
        rate: recallRate,
        threshold: recallThreshold,
      },
    }
  },

  compute_recall: (ctx, _params) => {
    const oracleFindings = ctx.oracle?.oracle_findings ?? []
    const normFindings = ctx.state.Normalize?.findings ?? []
    const confirmed = oracleFindings.filter(o =>
      normFindings.some(f => f.oracle_ref === o.oracle_id)
    ).length
    return {
      confirmed,
      total: oracleFindings.length,
      rate: oracleFindings.length === 0 ? 1 : confirmed / oracleFindings.length,
    }
  },
}

const PREDICATE_OPS = {
  no_candidates: (ctx) => {
    const findOut = ctx.state.Find ?? []
    const total = findOut.reduce((n, r) => n + (r?.candidate_findings?.length ?? 0), 0)
    return total === 0
  },
  no_accepted: (ctx) => {
    const verifyOut = ctx.state.Verify ?? []
    return !verifyOut.some(v => v?.resolved === 'accept')
  },
}

const INVARIANT_OPS = {
  ensure_csf_coverage: (output, ctx, _params) => {
    const required = ctx.policy?.required_csf_functions ?? []
    if (!output || typeof output !== 'object') return output
    const reqSet = new Set(output.required_csf_functions ?? [])
    for (const f of required) reqSet.add(f)
    output.required_csf_functions = [...reqSet]
    const selected = new Set(output.selected_finders ?? [])
    for (const csfFn of required) {
      const covering = (ctx.finders || []).filter(f => (f.csf || []).includes(csfFn))
      const anySelected = covering.some(f => selected.has(f.key))
      if (!anySelected && covering.length > 0) selected.add(covering[0].key)
    }
    output.selected_finders = [...selected]
    return output
  },
  prune_below_floor: (output, ctx, _params) => {
    if (!output || !Array.isArray(output.all_clusters)) return output
    const floor = sevRank(ctx.severity_floor)
    output.eligible_clusters = output.all_clusters.filter(c => sevRank(c.canonical?.severity) >= floor)
    output.pruned_count = output.all_clusters.length - output.eligible_clusters.length
    return output
  },
}

// ─── ops_allowed whitelist enforcement (codex M1: fail-closed if partial) ──
// Policy:
//   - if spec.ops_allowed absent entirely → no whitelist (fail-open by design)
//   - if spec.ops_allowed PRESENT → ALL kinds must be present arrays; missing
//     kind treated as empty whitelist → reject every op of that kind.
function assertOpAllowed(opName, kind) {
  if (!spec.ops_allowed) return  // no whitelist → permit
  const kindList = spec.ops_allowed[kind]
  if (!Array.isArray(kindList)) {
    throw new Error(`op "${opName}" rejected: spec.ops_allowed.${kind} is missing or not an array (partial whitelist is fail-closed)`)
  }
  if (!kindList.includes(opName)) {
    throw new Error(`op "${opName}" (${kind}) not in spec.ops_allowed.${kind} whitelist`)
  }
}

// ─── pipeline stage runner ─────────────────────────────────────────────
// Codex C3: validate schema_ref resolves to an object before each agent() call.
function resolveStageSchema(stage, parentNode, specRef) {
  const schemaRef = stage.schema_ref ?? parentNode.schema_ref
  if (!schemaRef) {
    throw new Error(`pipeline stage in node ${parentNode.name}: no schema_ref on stage or parent`)
  }
  const schemaObj = specRef.schemas[schemaRef]
  if (!schemaObj || typeof schemaObj !== 'object' || Array.isArray(schemaObj)) {
    throw new Error(`pipeline stage schema_ref "${schemaRef}" did not resolve to a schema object in spec.schemas`)
  }
  return schemaObj
}
function resolveStagePrompt(stage, parentNode, specRef) {
  const promptRef = stage.prompt_ref ?? parentNode.prompt_ref
  if (!promptRef) {
    throw new Error(`pipeline stage in node ${parentNode.name}: no prompt_ref on stage or parent`)
  }
  const tmpl = specRef.prompts[promptRef]
  if (typeof tmpl !== 'string' || tmpl.length === 0) {
    throw new Error(`pipeline stage prompt_ref "${promptRef}" not found in spec.prompts (or empty)`)
  }
  return tmpl
}

async function runStage(stage, item, ctx, specRef, parentNode) {
  if (stage.type === 'single') {
    const tmpl = resolveStagePrompt(stage, parentNode, specRef)
    const schemaObj = resolveStageSchema(stage, parentNode, specRef)
    return await agent(render(tmpl, { ...ctx, item }), {
      label: `${parentNode.name}:stage`,
      phase: parentNode.name,
      schema: schemaObj,
      model: pickModelFromStage(stage, parentNode, modelOverrides),
      agentType: stage.agentType ?? parentNode.agentType,
    })
  }
  if (stage.type === 'fanout') {
    const sev = normSeverity(item?.canonical?.severity ?? 'low')
    const voteCount = stage.vote_count_by_severity?.[sev] ?? 1
    const tmpl = resolveStagePrompt(stage, parentNode, specRef)
    const schemaObj = resolveStageSchema(stage, parentNode, specRef)
    const votes = await parallel(Array.from({ length: voteCount }, (_, i) => () =>
      agent(render(tmpl, { ...ctx, item, vote_index: i }), {
        label: `${parentNode.name}:${item?.cluster_id ?? 'item'}:v${i}`,
        phase: parentNode.name,
        schema: schemaObj,
        model: pickModelFromStage(stage, parentNode, modelOverrides),
        agentType: stage.agentType ?? parentNode.agentType,
      })
    ))
    const valid = votes.filter(Boolean)
    const accepts = valid.filter(v => v.decision === 'accept').length
    const resolved = accepts > valid.length / 2 ? 'accept' : 'reject'
    return { cluster: item, canonical: item?.canonical, votes: valid, resolved, vote_count: voteCount }
  }
  throw new Error(`unknown pipeline stage type "${stage.type}"`)
}

// ─── main loop ─────────────────────────────────────────────────────────
for (const node of spec.phases) {
  phase(node.name)

  // Build ctx BEFORE cache check so hashNode sees current upstream state (codex C2).
  const ctxBase = { state, target, run_id: runId, severity_floor: severityFloor, finders, policy, oracle }
  // runtime-appsec#2 (2026-06-10): persist prompts must NOT hard-reference fixed
  // per-phase state keys ({{ state.Verify }} etc.) — presets that skip phases
  // (l1-default has no Verify; incident-response has no Find/Normalize/Dedup/Verify)
  // would hard-throw at the Persist node. Expose a single summary of ONLY the
  // phase outputs that actually exist so persist-evidence.v1 renders for every preset.
  // NOTE: read only by the {{ state_summary_json }} / {{ present_phases }} render
  // path; NOT folded into hashNode (which reads ctxBase.state directly), so resume
  // fingerprints are unchanged.
  ctxBase.present_phases = Object.keys(state)
  ctxBase.state_summary_json = JSON.stringify(state)
  // Capture fingerprint of THIS phase against upstream state, store for use at completion.
  const nodeFingerprint = hashNode(node, spec, ctxBase)
  phaseFingerprints[node.name] = nodeFingerprint

  // 1. resume cache check — fingerprint must match (codex C2 + node + ctx)
  const cached = previousResults[node.name]
  if (cached !== undefined) {
    if (cached && typeof cached === 'object' && 'node_fingerprint' in cached && 'output' in cached) {
      const currentFp = nodeFingerprint
      if (cached.node_fingerprint === currentFp) {
        state[node.name] = cached.output
        reusedPhases.push(node.name)
        log(`${node.name}: reused (fingerprint ${currentFp})`)
        continue
      } else {
        cacheMisses.push({ name: node.name, reason: 'fingerprint changed', expected: currentFp, cached: cached.node_fingerprint })
        log(`${node.name}: cache miss (fingerprint changed: cached=${cached.node_fingerprint} current=${currentFp})`)
      }
    } else {
      cacheMisses.push({ name: node.name, reason: 'unfingerprinted cache entry' })
      log(`${node.name}: cache miss (legacy unfingerprinted entry)`)
    }
  }

  // 2. skip_if (predicate)
  if (node.skip_if) {
    assertOpAllowed(node.skip_if, 'predicates')
    const predicate = PREDICATE_OPS[node.skip_if]
    if (!predicate) throw new Error(`unknown predicate "${node.skip_if}" (not in PREDICATE_OPS registry)`)
    if (predicate(ctxBase)) {
      state[node.name] = node.skip_default ?? null
      log(`${node.name}: skipped by predicate ${node.skip_if}`)
      continue
    }
  }

  // 3. dispatch by type
  switch (node.type) {
    case 'single': {
      const tmpl = spec.prompts[node.prompt_ref]
      if (typeof tmpl !== 'string') {
        throw new Error(`${node.name}: prompt_ref "${node.prompt_ref}" not found in spec.prompts`)
      }
      const schemaObj = spec.schemas[node.schema_ref]
      if (!schemaObj || typeof schemaObj !== 'object') {
        throw new Error(`${node.name}: schema_ref "${node.schema_ref}" not found in spec.schemas`)
      }
      state[node.name] = await agent(render(tmpl, ctxBase), {
        label: node.label ?? node.name,
        phase: node.name,
        schema: schemaObj,
        model: pickModel(node, modelOverrides),
        agentType: node.agentType,
        isolation: node.isolation,
      })
      break
    }

    case 'fanout': {
      const items = resolveItems(node.items_from, ctxBase)
      log(`${node.name}: fanout over ${items.length} item(s)`)
      const tmpl = spec.prompts[node.prompt_ref]
      if (typeof tmpl !== 'string') {
        throw new Error(`${node.name}: prompt_ref "${node.prompt_ref}" not found in spec.prompts`)
      }
      const schemaObj = spec.schemas[node.schema_ref]
      if (!schemaObj || typeof schemaObj !== 'object') {
        throw new Error(`${node.name}: schema_ref "${node.schema_ref}" not found in spec.schemas`)
      }
      const results = await parallel(items.map((rawItem, i) => {
        const item = normalizeFanoutItem(rawItem, ctxBase)
        return () => agent(
          render(tmpl, { ...ctxBase, item, index: i }),
          {
            label: `${node.name}:${item?.key ?? i}`,
            phase: node.name,
            schema: schemaObj,
            model: pickModel(node, modelOverrides),
            agentType: node.agentType,
            isolation: node.isolation,
          }
        )
      }))
      state[node.name] = results.filter(Boolean)
      break
    }

    case 'pipeline': {
      const items = resolveItems(node.items_from, ctxBase)
      log(`${node.name}: pipeline over ${items.length} item(s), ${node.stages.length} stage(s)`)
      const stageFns = node.stages.map(stage => async (carry, _orig, _idx) => {
        // For first stage, `carry` is the original item.
        // For subsequent stages, `carry` is the previous stage's output for this item.
        const inputItem = carry
        return await runStage(stage, inputItem, ctxBase, spec, node)
      })
      const results = await pipeline(items, ...stageFns)
      state[node.name] = results.filter(Boolean)
      break
    }

    case 'deterministic': {
      assertOpAllowed(node.op, 'deterministic')
      const op = DETERMINISTIC_OPS[node.op]
      if (!op) throw new Error(`unknown deterministic op "${node.op}" (not in DETERMINISTIC_OPS registry)`)
      state[node.name] = op(ctxBase, node.params)
      log(`${node.name}: deterministic op ${node.op} executed`)
      break
    }

    default:
      throw new Error(`unknown node type "${node.type}" at phase ${node.name}`)
  }

  // 4. post_invariants
  for (const inv of (node.post_invariants ?? [])) {
    assertOpAllowed(inv, 'invariants')
    const invOp = INVARIANT_OPS[inv]
    if (!invOp) throw new Error(`unknown invariant "${inv}" (not in INVARIANT_OPS registry)`)
    state[node.name] = invOp(state[node.name], ctxBase, node.invariant_params)
    log(`${node.name}: post_invariant ${inv} applied`)
  }
}

// ─── return: phase_outputs are fingerprinted for next-run resume ───────
// Fingerprints were captured at each phase's entry (against upstream state at
// that moment), so they correctly describe the cache validity precondition.
const fingerprintedOutputs = {}
for (const node of spec.phases) {
  if (node.name in state && node.name in phaseFingerprints) {
    fingerprintedOutputs[node.name] = {
      node_fingerprint: phaseFingerprints[node.name],
      output: state[node.name],
    }
  }
}

return {
  run_id: runId,
  target,
  reused_phases: reusedPhases,
  cache_misses: cacheMisses,
  seeded_phases: seededPhases,
  phase_outputs: state,
  phase_outputs_fingerprinted: fingerprintedOutputs,
}
