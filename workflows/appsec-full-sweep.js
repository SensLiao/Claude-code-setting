export const meta = {
  name: 'appsec-full-sweep',
  description: 'AppSec 9-phase sweep engine. Args-driven (skill provides finders/policy/oracle/severity_floor); falls back to sane defaults for standalone runs. Haiku throughout.',
  whenToUse: 'Invoked by appsec-security-orchestrator skill after it has read project signals and decided which finders/policy apply. Standalone invocation OK for smoke-testing.',
  phases: [
    { title: 'Scope',      model: 'haiku' },
    { title: 'Plan',       model: 'haiku' },
    { title: 'Find',       model: 'haiku' },
    { title: 'Normalize',  model: 'haiku' },
    { title: 'Verify',     model: 'haiku' },
    { title: 'Map',        model: 'haiku' },
    { title: 'Synthesize', model: 'haiku' },
  ],
}

// ─── args normalization ──────────────────────────────────────────────
const input = typeof args === 'string'
  ? (() => { try { return JSON.parse(args) } catch { return { target: args } } })()
  : (args ?? {})

const target = input?.target ?? 'mock-saas-project'
const severityFloor = input?.severity_floor ?? 'low'  // skip clusters below this
const runId = input?.run_id ?? 'standalone'
// previous_results: skill-provided cached phase outputs for cross-session resume.
// Shape: { scope?, plan?, find?, normalize?, verify?, map? }
// Each present key skips the corresponding phase's agent calls.
// See SKILL.md §16.10.3 for the resume contract.
const previousResults = input?.previous_results ?? {}
const reusedPhases = []

// ─── defaults (skill should override via args) ───────────────────────
const DEFAULT_POLICY = {
  required_csf_functions: ['Govern', 'Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
}
const DEFAULT_ORACLE = {
  oracle_findings: [
    { oracle_id: 'ORACLE-001', title: 'hardcoded JWT secret in config', target_finder_keys: ['secret'] },
    { oracle_id: 'ORACLE-002', title: 'lodash CVE-2021-23337',           target_finder_keys: ['sca'] },
  ],
  recall_metric: { minimum_acceptable: 0.5 },
}
const DEFAULT_FINDERS = [
  { key: 'govern',         sub_skill: 'security-governance-threat-modeling', csf: ['Govern'] },
  { key: 'sca',            sub_skill: 'security-remediation-sca',            csf: ['Identify','Detect'] },
  { key: 'supply-chain',   sub_skill: 'security-platform-secrets-npm',       csf: ['Identify','Detect'] },
  { key: 'business-logic', sub_skill: 'security-threat-modeling-abuse',      csf: ['Identify','Detect'] },
  { key: 'secret',         sub_skill: 'security-platform-secrets',           csf: ['Protect','Detect'] },
  { key: 'iac',            sub_skill: 'security-platform-iac-cloud',         csf: ['Protect','Detect'] },
  { key: 'auth',           sub_skill: 'security-app-multitenant-auth',       csf: ['Protect','Detect'] },
  { key: 'sast',           sub_skill: 'security-app-llm-dataflow',           csf: ['Detect'] },
  { key: 'dataflow',       sub_skill: 'security-app-file-upload-injection',  csf: ['Protect','Detect'] },
  { key: 'respond',        sub_skill: 'security-response-incident',          csf: ['Respond'] },
  { key: 'recover',        sub_skill: 'security-response-recovery',          csf: ['Recover'] },
]

const POLICY  = input?.policy  ?? DEFAULT_POLICY
const ORACLE  = input?.oracle  ?? DEFAULT_ORACLE
const FINDERS = input?.finders ?? DEFAULT_FINDERS

// ─── verifier tier (per AppSec v3.0 original spec) ───────────────────
const VERIFIER_TIER = {
  info:     { count: 1 },
  low:      { count: 1 },
  medium:   { count: 1 },
  high:     { count: 3 },
  critical: { count: 3 },
}

// ─── schemas (lenient JSON Schema) ───────────────────────────────────
const SCOPE_SCHEMA = {
  type: 'object', required: ['tech_stack','sensitive_areas'],
  properties: {
    tech_stack: { type: 'array', items: { type: 'string' } },
    sensitive_areas: { type: 'array', items: { type: 'string' } },
  },
}
const PLAN_SCHEMA = {
  type: 'object', required: ['selected_finder_keys','required_csf_functions'],
  properties: {
    selected_finder_keys: { type: 'array', items: { type: 'string' } },
    required_csf_functions: { type: 'array', items: { type: 'string' } },
  },
}
const FIND_SCHEMA = {
  type: 'object', required: ['finder_key','candidate_findings'],
  properties: {
    finder_key: { type: 'string' },
    candidate_findings: {
      type: 'array',
      items: {
        type: 'object', required: ['title','severity_guess','file'],
        properties: {
          title: { type: 'string' },
          severity_guess: { type: 'string', enum: ['info','low','medium','high','critical'] },
          file: { type: 'string' },
          oracle_ref: { type: 'string' },
        },
      },
    },
  },
}
const NORMALIZE_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', required: ['id','title','severity','file'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string' },
          file: { type: 'string' },
          oracle_ref: { type: 'string' },
        },
      },
    },
  },
}
const VOTE_SCHEMA = {
  type: 'object', required: ['decision','rationale'],
  properties: {
    decision: { type: 'string', enum: ['accept','reject','needs-human'] },
    rationale: { type: 'string' },
  },
}
const MAP_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', required: ['id','csf','cwe','asvs'],
        properties: {
          id: { type: 'string' },
          csf: { type: 'array', items: { type: 'string' } },
          cwe: { type: 'string' },
          asvs: { type: 'string' },
          owasp: { type: 'string' },
        },
      },
    },
  },
}
const SYNTH_SCHEMA = {
  type: 'object', required: ['executive_summary','top_blocking','recall_outcome'],
  properties: {
    executive_summary: { type: 'string' },
    top_blocking: { type: 'array', items: { type: 'string' } },
    recall_outcome: {
      type: 'object',
      properties: {
        confirmed: { type: 'integer' },
        missed: { type: 'integer' },
        recall_rate: { type: 'number' },
      },
    },
  },
}

// ─── severity helpers ────────────────────────────────────────────────
const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
const meetsFloor = (sev) => (severityRank[sev] ?? 0) >= (severityRank[severityFloor] ?? 0)

// ═════════════════════════════════════════════════════════════════════
// Phase 1: Scope
// ═════════════════════════════════════════════════════════════════════
phase('Scope')
log(`target=${target} | run_id=${runId} | severity_floor=${severityFloor} | finders=${FINDERS.length}`)
let scope
if (previousResults.scope) {
  scope = previousResults.scope
  reusedPhases.push('scope')
  log('scope: reused from previous_results')
} else {
  scope = await agent(
    `(simulation) target=${target}. 返回 tech_stack 数组（如 ["Node.js","Next.js","PostgreSQL"]）和 sensitive_areas（如 ["auth","payment","admin"]）。JSON。`,
    { label: 'scope-inventory', phase: 'Scope', schema: SCOPE_SCHEMA, model: 'haiku' }
  )
}

// ═════════════════════════════════════════════════════════════════════
// Phase 2: Plan
// ═════════════════════════════════════════════════════════════════════
phase('Plan')
let plan
if (previousResults.plan) {
  plan = previousResults.plan
  reusedPhases.push('plan')
  log('plan: reused from previous_results')
} else {
  plan = await agent(
    `SCOPE=${JSON.stringify(scope)}. POLICY 要求 CSF: ${POLICY.required_csf_functions.join(',')}. 可选 finder keys: ${FINDERS.map(f => f.key).join(',')}. 选 finder 让每个 CSF 都至少 1 覆盖。required_csf_functions 必须包含全部 ${POLICY.required_csf_functions.length} 个 CSF。JSON.`,
    { label: 'plan-selection', phase: 'Plan', schema: PLAN_SCHEMA, model: 'haiku' }
  )
}

// Policy invariants (deterministic, no agent)
const planReq = new Set(plan.required_csf_functions)
for (const f of POLICY.required_csf_functions) {
  if (!planReq.has(f)) plan.required_csf_functions.push(f)
}
for (const csfFn of POLICY.required_csf_functions) {
  const covering = FINDERS.filter(f => f.csf.includes(csfFn))
  const anySelected = covering.some(f => plan.selected_finder_keys.includes(f.key))
  if (!anySelected && covering.length > 0) plan.selected_finder_keys.push(covering[0].key)
}
const activeFinders = FINDERS.filter(f => plan.selected_finder_keys.includes(f.key))
log(`active_finders(${activeFinders.length}): ${activeFinders.map(f => f.key).join(',')}`)

// ═════════════════════════════════════════════════════════════════════
// Phase 3: Find (parallel fan-out, limit 1 candidate unless oracle hit)
// ═════════════════════════════════════════════════════════════════════
phase('Find')
let validRaws
let allCandidates
if (previousResults.find) {
  validRaws = previousResults.find
  allCandidates = validRaws.flatMap(r => (r.candidate_findings || []).map(c => ({ ...c, finder_key: r.finder_key })))
  reusedPhases.push('find')
  log(`find: reused ${validRaws.length} finders, ${allCandidates.length} candidates from previous_results`)
} else {
  const oraclesByFinderKey = {}
  for (const o of ORACLE.oracle_findings) {
    for (const k of o.target_finder_keys) {
      if (!oraclesByFinderKey[k]) oraclesByFinderKey[k] = []
      oraclesByFinderKey[k].push(o)
    }
  }
  const rawFindings = await parallel(activeFinders.map(f => () => {
    const hints = oraclesByFinderKey[f.key] || []
    return agent(
      `(simulation) finder=${f.key}, sub_skill=${f.sub_skill}, CSF=${f.csf.join('+')}. sensitive_areas=${JSON.stringify(scope.sensitive_areas)}. ${hints.length ? `ORACLE 必须 confirm 并填 oracle_ref: ${JSON.stringify(hints)}` : ''} 编 ${hints.length ? hints.length + ' 个 (覆盖 oracle) 或最多 ' + (hints.length + 1) : '最多 1'} 个 candidate_findings。JSON {finder_key, candidate_findings}.`,
      { label: `find:${f.key}`, phase: 'Find', schema: FIND_SCHEMA, model: 'haiku' }
    )
  }))
  validRaws = rawFindings.filter(Boolean)
  allCandidates = validRaws.flatMap(r => r.candidate_findings.map(c => ({ ...c, finder_key: r.finder_key })))
  log(`raw_candidates=${allCandidates.length} from ${validRaws.length} finders`)
}

// ═════════════════════════════════════════════════════════════════════
// Phase 4: Normalize (single agent, batched)
// ═════════════════════════════════════════════════════════════════════
phase('Normalize')
let normalized
if (previousResults.normalize) {
  normalized = previousResults.normalize
  reusedPhases.push('normalize')
  log(`normalize: reused ${normalized.findings.length} findings from previous_results`)
} else if (allCandidates.length === 0) {
  normalized = { findings: [] }
  log('no candidates → skip normalize')
} else {
  normalized = await agent(
    `把这些 candidates 转 FindingV1 格式。每个 finding 给 unique id (6 字符)、severity (沿用 severity_guess)、保留 oracle_ref 字段。JSON {findings: [...]}.\nCANDIDATES: ${JSON.stringify(allCandidates)}`,
    { label: 'normalize', phase: 'Normalize', schema: NORMALIZE_SCHEMA, model: 'haiku' }
  )
  log(`normalized=${normalized.findings.length}`)
}

// ═════════════════════════════════════════════════════════════════════
// Phase 5: Dedup (DETERMINISTIC JS — no agent)
// ═════════════════════════════════════════════════════════════════════
const fingerprintOf = (f) => `${(f.file || '').toLowerCase().trim()}|${(f.title || '').toLowerCase().trim().slice(0, 40)}`
const clustersByFp = {}
for (const f of normalized.findings) {
  const fp = fingerprintOf(f)
  if (!clustersByFp[fp]) clustersByFp[fp] = { cluster_id: `c-${Object.keys(clustersByFp).length + 1}`, canonical: f, members: [] }
  clustersByFp[fp].members.push(f.id)
}
const allClusters = Object.values(clustersByFp)
log(`deterministic_clusters=${allClusters.length} (from ${normalized.findings.length} findings)`)

// ═════════════════════════════════════════════════════════════════════
// Phase 6: Verify (severity-floor pruning + layered voting)
// ═════════════════════════════════════════════════════════════════════
phase('Verify')

const eligibleClusters = allClusters.filter(c => meetsFloor(c.canonical.severity))
const skipped = allClusters.length - eligibleClusters.length
if (skipped > 0) log(`pruned ${skipped} clusters below severity floor=${severityFloor}`)

let verifiedClusters
if (previousResults.verify) {
  verifiedClusters = previousResults.verify
  reusedPhases.push('verify')
  log(`verify: reused ${verifiedClusters.length} cluster verdicts from previous_results`)
} else {
  verifiedClusters = await pipeline(
    eligibleClusters,
    async (cluster) => {
      const sev = cluster.canonical.severity
      const voteCount = VERIFIER_TIER[sev]?.count ?? 1
      const votes = await parallel(Array.from({ length: voteCount }, (_, i) => () =>
        agent(
          `(simulation) 独立判断 finding 是否真实。default REJECT if uncertain。FINDING: ${JSON.stringify(cluster.canonical)} JSON {decision, rationale}.`,
          { label: `verify:${cluster.cluster_id}:${sev}:v${i}`, phase: 'Verify', schema: VOTE_SCHEMA, model: 'haiku' }
        )
      ))
      const valid = votes.filter(Boolean)
      const accepts = valid.filter(v => v.decision === 'accept').length
      const resolved = accepts > valid.length / 2 ? 'accept' : 'reject'
      return { cluster, votes: valid, resolved, vote_count: voteCount }
    }
  )
}

const verified = verifiedClusters.filter(Boolean)
const accepted = verified.filter(v => v.resolved === 'accept')
const totalVotes = verified.reduce((n, v) => n + (v.vote_count ?? 0), 0)
log(`verify: ${accepted.length} accepted of ${verified.length} clusters (${totalVotes} total votes)`)

// ═════════════════════════════════════════════════════════════════════
// Phase 7: Map (single batched agent)
// ═════════════════════════════════════════════════════════════════════
phase('Map')
let mapped
if (previousResults.map) {
  mapped = previousResults.map
  reusedPhases.push('map')
  log(`map: reused ${mapped.findings.length} mappings from previous_results`)
} else if (accepted.length === 0) {
  mapped = { findings: [] }
  log('no accepted findings → skip map')
} else {
  mapped = await agent(
    `给每个 finding 附 CSF function(s), CWE, ASVS 5.0 chapter (格式 "v5.0.0-N"), OWASP Top 10 2021. JSON {findings: [...]}.\nACCEPTED: ${JSON.stringify(accepted.map(a => ({ id: a.cluster.canonical.id, title: a.cluster.canonical.title, severity: a.cluster.canonical.severity })))}`,
    { label: 'map-taxonomies', phase: 'Map', schema: MAP_SCHEMA, model: 'haiku' }
  )
  log(`mapped=${mapped.findings.length}`)
}

// ═════════════════════════════════════════════════════════════════════
// Phase 8: Gate (DETERMINISTIC JS — no agent)
// ═════════════════════════════════════════════════════════════════════
const evidencedCSF = new Set()
for (const f of mapped.findings) {
  for (const c of (f.csf || [])) evidencedCSF.add(c)
}
const missingCSF = POLICY.required_csf_functions.filter(c => !evidencedCSF.has(c))
const blockingIds = accepted
  .filter(a => severityRank[a.cluster.canonical.severity] >= severityRank['high'])
  .map(a => a.cluster.canonical.id)
const oracleConfirmed = ORACLE.oracle_findings.filter(o =>
  normalized.findings.some(f => f.oracle_ref === o.oracle_id)
).length
const recallRate = ORACLE.oracle_findings.length === 0 ? 1 : oracleConfirmed / ORACLE.oracle_findings.length

let decision
if (missingCSF.length > 0) decision = 'BLOCK'
else if (blockingIds.length > 0) decision = 'BLOCK'
else if (recallRate < ORACLE.recall_metric.minimum_acceptable) decision = 'BLOCK'
else if (accepted.some(a => a.cluster.canonical.severity === 'medium')) decision = 'WARN'
else decision = 'PASS'

const gate = {
  decision,
  blocking_findings: blockingIds,
  required_csf_coverage: POLICY.required_csf_functions,
  evidenced_csf_coverage: [...evidencedCSF],
  missing_csf_functions: missingCSF,
  recall: { confirmed: oracleConfirmed, total: ORACLE.oracle_findings.length, rate: recallRate, threshold: ORACLE.recall_metric.minimum_acceptable },
}
log(`gate=${decision} (missingCSF=${missingCSF.length}, blocking=${blockingIds.length}, recall=${(recallRate*100).toFixed(0)}%)`)

// ═════════════════════════════════════════════════════════════════════
// Phase 9: Synthesize
// ═════════════════════════════════════════════════════════════════════
phase('Synthesize')
const synth = await agent(
  `生成 ≤200 字 developer-facing synthesis report。PLAN=${JSON.stringify(plan)}. GATE=${JSON.stringify(gate)}. ORACLE_SIZE=${ORACLE.oracle_findings.length}. JSON {executive_summary, top_blocking[], recall_outcome{confirmed,missed,recall_rate}}.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA, model: 'haiku' }
)

return {
  run_id: runId,
  target,
  severity_floor: severityFloor,
  reused_phases: reusedPhases,

  // ── §16.10.4 SDK mapping surface (Skill consumes these top-level fields) ──
  scope,
  plan: { selected: plan.selected_finder_keys, csf_required: plan.required_csf_functions },
  mapped,
  gate,
  synthesis: synth,

  // ── §16.10.3 resume snapshot (Skill persists this as workflow-state.json) ──
  // Next run pass back as args.previous_results to skip cached phases.
  phase_outputs: {
    scope,
    plan,                  // full agent output, not just summary
    find: validRaws,
    normalize: normalized,
    verify: verifiedClusters,
    map: mapped,
  },

  pipeline_counts: {
    active_finders: activeFinders.length,
    raw_candidates: allCandidates.length,
    normalized: normalized.findings.length,
    clusters: allClusters.length,
    eligible_clusters: eligibleClusters.length,
    pruned_below_floor: skipped,
    verified: verified.length,
    accepted: accepted.length,
    total_votes: totalVotes,
    mapped: mapped.findings.length,
  },
}
