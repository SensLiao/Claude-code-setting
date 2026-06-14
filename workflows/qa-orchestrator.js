/* @governance
 *   reviewed_by:             廖神 (harness author)
 *   reviewed_at:             2026-06-10
 *   allowed_scope:           governed-gate
 *   release_gate_allowed:    true    # deterministic QA spec-runner; walks a spec_hash-approved spec only
 *   destructive_ops_allowed: false
 */
export const meta = {
  name: 'qa-orchestrator',
  description: 'Spec-driven QA orchestrator meta-runner. Reads args.spec (phases + inline prompts + inline schemas + whitelisted ops), executes via Workflow primitives, returns phase_outputs for Skill-side persistence. Body is deterministic: no filesystem, no module loading, no Date.now / Math.random. R7: dropped fanout/pipeline items are recorded as MISSING, NEVER silently filtered. R15: hashNode folds node-specific upstream ctx (E2E branch_sha + viewport + baseline_dir_hash; Component surface_path_hash; RawAudit changed_files_hash) per QA-PHASE-B-BLUEPRINT §22.5.',
  whenToUse: 'Invoked by enterprise-qa-testing skill in workflow-spec mode after Execution Preview is approved AND the Workflow capability flag is enabled. Not for standalone use — spec is mandatory.',
  phases: [],
}

// ─── args normalization ──────────────────────────────────────────────
const input = typeof args === 'string'
  ? (() => { try { return JSON.parse(args) } catch { return null } })()
  : (args ?? null)

if (!input || typeof input !== 'object') {
  throw new Error('qa-orchestrator: args must be an object containing spec, release_tag, run_id')
}
if (!input.spec || typeof input.spec !== 'object') {
  throw new Error('qa-orchestrator: args.spec is required')
}
if (!input.run_id || typeof input.run_id !== 'string') {
  throw new Error('qa-orchestrator: args.run_id is required (non-empty string)')
}
if (!input.release_tag || typeof input.release_tag !== 'string') {
  throw new Error('qa-orchestrator: args.release_tag is required (non-empty string)')
}
if (input.spec.orchestrator !== 'qa') {
  throw new Error(`qa-orchestrator: spec.orchestrator must be "qa" (got "${input.spec.orchestrator}")`)
}
if (input.spec.engine_version !== '1.0') {
  throw new Error(`qa-orchestrator: unsupported spec.engine_version "${input.spec.engine_version}", expected "1.0"`)
}
if (!Array.isArray(input.spec.phases) || input.spec.phases.length === 0) {
  throw new Error('qa-orchestrator: spec.phases must be a non-empty array')
}
if (!input.spec.prompts || typeof input.spec.prompts !== 'object') {
  throw new Error('qa-orchestrator: spec.prompts must be an object (may be empty {})')
}
if (!input.spec.schemas || typeof input.spec.schemas !== 'object') {
  throw new Error('qa-orchestrator: spec.schemas must be an object (may be empty {})')
}

const spec       = input.spec
const releaseTag = input.release_tag
const runId      = input.run_id
const ctxIn      = input.context ?? {}
const riskSnapshot          = ctxIn.risk_snapshot ?? null
const criticalReleasePaths  = ctxIn.critical_release_paths ?? []
// §3.1 engine backstop (2026-06-05): fill any gate floor the Skill OMITTED from input.context.policy
// using the preset's baked spec.context.policy. perf_gate_policy treats a MISSING floor as Infinity
// (never blocks), so a Skill that forgot to pass policy (§18.5 step 5/13) would SILENTLY disable the
// perf gate. This closes that hole without silently loosening: runtime values win per-key (the Skill
// MAY tighten per project, per preset _policy_doc) — the preset only fills GAPS the runtime omitted.
// Pure/deterministic 2-level object merge. Release-time only; never runs in dev. spec.context.policy
// is the canonical floor and MUST remain the preset baked value (§18.5: do not overwrite it).
function fillPolicyFromPreset(runtime, preset) {
  const r = (runtime && typeof runtime === 'object' && !Array.isArray(runtime)) ? runtime : {}
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) return r
  const out = { ...preset, ...r }                 // runtime wins at top level
  for (const k of Object.keys(preset)) {
    const pv = preset[k], rv = r[k]
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && rv && typeof rv === 'object' && !Array.isArray(rv)) {
      out[k] = { ...pv, ...rv }                    // per-floor object: preset fills missing sub-keys, runtime tightens
    }
  }
  return out
}
const policy                = fillPolicyFromPreset(ctxIn.policy, (spec.context && spec.context.policy) || null)
// CROSS-SESSION resume engine — DO NOT shed (NATIVE-OVERLAP-AUDIT §6 #1 CORRECTION; re-verified 2026-05-29).
// previous_results + hashNode/djb2/stableStringify + phase_outputs_fingerprinted IS the cross-session resume
// mechanism. Native resumeFromRunId is SAME-session only and does NOT replace it. Code-reading confirmed there is
// NO separable same-session-only cache here, so deleting djb2/stableStringify or the fingerprint loop would break
// cross-session resume. Keep.
const previousResults       = input.previous_results ?? {}
const modelOverrides        = (input.model_policy && typeof input.model_policy === 'object') ? input.model_policy : null

const state = {}
const reusedPhases = []
const cacheMisses  = []
const phaseFingerprints = {}    // node.name → fingerprint captured at phase entry
const dispatchFailures  = []    // R7 — populated as fanout/pipeline items drop; fed into map_null_outputs_to_missing

// B.2 fix 2026-05-30: prompts reference {{ state.context.* }} for run-context.
// Expose ctxIn under state.context NON-ENUMERABLY so render() resolves it, while
// Object.keys(state) / stableStringify(state) (path-coverage ops, evidence {{ state }},
// hashNode upstream_state) still see ONLY phase outputs — no pollution, fingerprint stable.
Object.defineProperty(state, 'context', { value: ctxIn, enumerable: false, writable: false, configurable: true })

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

// ORCHESTRATION-MIGRATION-PLAN §1.11 #2 (2026-05-28): Skill is source of truth
// for alias resolution. Skill writes node.resolved_model BEFORE launch;
// Workflow body just reads it. Fallback resolveModel keeps legacy specs working.
// Per user 2026-05-28 dual-layer rule: preset JSON pre-bakes resolved_model to
// haiku/sonnet for test/dev; production-mode skill overrides before launch.
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
    default:                      return specModel
  }
}

// Enrich stage entries with referenced prompt/schema bodies so changes to those
// invalidate cache for pipeline phases.
function enrichStagesForHash(stages, specRef, parentNode) {
  if (!Array.isArray(stages)) return null
  return stages.map(s => {
    const promptRef = s.prompt_ref ?? parentNode.prompt_ref ?? null
    const schemaRef = s.schema_ref ?? parentNode.schema_ref ?? null
    return {
      type: s.type,
      model: pickModelFromStage(s, parentNode, modelOverrides),
      model_alias: s.model ?? parentNode.model ?? null,
      agentType: s.agentType ?? null,
      prompt_ref: promptRef,
      prompt_body: promptRef ? (specRef.prompts[promptRef] ?? null) : null,
      schema_ref: schemaRef,
      schema_body: schemaRef ? (specRef.schemas[schemaRef] ?? null) : null,
      stall_ms: s.stall_ms ?? parentNode.stall_ms ?? null,
      timeout_policy: s.timeout_policy ?? parentNode.timeout_policy ?? null,
    }
  })
}

// R15 — node-specific upstream context extras. Returns object folded into
// hashNode so per-node upstream changes invalidate cache.
function r15NodeExtras(node, ctx) {
  // E2E pipeline — branch_sha + viewport + baseline_dir_hash
  if (node.name === 'E2E') {
    return {
      r15_e2e_branch_sha: ctx.branch_sha ?? null,
      r15_e2e_viewport: ctx.viewport ?? null,
      r15_e2e_playwright_config_hash: ctx.playwright_config_hash ?? null,
      r15_e2e_screenshot_baseline_dir_hash: ctx.screenshot_baseline_dir_hash ?? null,
      r15_e2e_runner_version: ctx.e2e_runner_version ?? null,
    }
  }
  // Component fanout — surface_path_hash
  if (node.name === 'UnitOrComponent' || node.name === 'ComponentOrContract') {
    const surfaces = ctx?.state?.LayerSelect?.changed_surfaces ?? []
    const surfacePathHash = djb2(stableStringify(surfaces.map(s => s.path).sort()))
    return { r15_component_surface_path_hash: surfacePathHash }
  }
  // VisualAudit — baseline_dir_hash
  if (node.name === 'VisualAudit') {
    return { r15_visual_baseline_dir_hash: ctx.visual_baseline_dir_hash ?? null }
  }
  // StaticBaseline / RawAudit — changed_files_hash
  if (node.name === 'StaticBaseline') {
    const surfaces = ctx?.state?.LayerSelect?.changed_surfaces ?? []
    const changedFilesHash = djb2(stableStringify(surfaces.map(s => s.path).sort()))
    return { r15_static_changed_files_hash: changedFilesHash }
  }
  return {}
}

// hashNode folds in upstream ctx — any change to release_tag, policy,
// critical_release_paths, risk_snapshot, OR any upstream phase output
// invalidates this node's resume cache. R15 adds node-specific extras.
function hashNode(node, specRef, upstreamCtx) {
  const sig = {
    name: node.name,
    type: node.type,
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
    stall_ms: node.stall_ms ?? null,
    timeout_policy: node.timeout_policy ?? null,
    // spec-global
    engine_version: specRef.engine_version,
    orchestrator: specRef.orchestrator,
    spec_ops_allowed: specRef.ops_allowed ?? null,
    // upstream ctx — any change invalidates cache
    ctx_release_tag: upstreamCtx?.release_tag ?? null,
    ctx_critical_release_paths: upstreamCtx?.critical_release_paths ?? null,
    ctx_policy: upstreamCtx?.policy ?? null,
    ctx_risk_snapshot: upstreamCtx?.risk_snapshot ?? null,
    upstream_state: upstreamCtx?.state ?? null,
    // R15 node-specific extras
    r15_extras: r15NodeExtras(node, upstreamCtx),
  }
  return djb2(stableStringify(sig))
}

// strict path resolver — hard fails on missing variable
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
  const placeholderRe = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g
  const wellFormedCount = (tmpl.match(placeholderRe) || []).length
  const openCount  = (tmpl.match(/\{\{/g) || []).length
  // B.2 lesson 2026-05-29: only validate that every `{{` opens a valid placeholder.
  // Stray `}}` in prompt body (e.g. JSON object literals in agent boundary docs) is
  // harmless — the substitution regex only touches well-formed `{{ ident }}` spans.
  // Previous check also counted closeCount, which gave false positives on prompts
  // that document expected JSON output shapes.
  if (openCount !== wellFormedCount) {
    const tmp = tmpl.replace(placeholderRe, '')
    const idx = tmp.indexOf('{{')
    const snippet = tmp.slice(Math.max(0, idx - 20), idx + 40)
    throw new Error(`render: malformed placeholder in template near "${snippet}" (open=${openCount}, well-formed=${wellFormedCount} — every {{ must form a valid placeholder; stray }} is tolerated)`)
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
// Undefined path is an error, not a silent empty array.
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

// ─── ops registries ────────────────────────────────────────────────────
// All ops are PURE-CODE per ops.manifest.json — no FS, no shell, no network.
// QA agents (StaticBaseline, ComponentOrContract, E2E, etc.) run external tools;
// deterministic ops classify already-collected evidence.

const DETERMINISTIC_OPS = {
  run_static_baseline_policy: (ctx) => {
    const sb = ctx.state.StaticBaseline ?? {}
    const floor = ctx.policy?.static_floor ?? {}
    const failed = []
    const advisory = []
    if ((sb.tsc_errors ?? 0) > (floor.max_tsc_errors ?? 0)) failed.push('tsc_errors_exceed_floor')
    if ((sb.eslint_findings?.errors ?? 0) > (floor.max_eslint_errors ?? 0)) failed.push('eslint_errors_exceed_floor')
    if ((sb.npm_audit_critical_count ?? 0) > (floor.max_npm_audit_critical ?? 0)) failed.push('npm_audit_critical_exceed_floor')
    if ((sb.npm_audit_high_count ?? 0) > (floor.max_npm_audit_high ?? 0)) advisory.push('npm_audit_high_advisory')
    if ((sb.git_secrets_hits ?? 0) > 0) failed.push('git_secrets_hits_nonzero')
    if (!Array.isArray(sb.command_evidence) || sb.command_evidence.length === 0) {
      failed.push('command_evidence_missing')
    }
    const decision = failed.length === 0 ? 'PASS' : 'BLOCK'
    return { static_decision: decision, failed_checks: failed, advisory_warnings: advisory }
  },

  compute_critical_path_coverage: (ctx) => {
    const paths = ctx.critical_release_paths ?? []
    const covered = []
    const uncovered = []
    for (const p of paths) {
      // Scan state.* for any layer evidence referencing the path category.
      let found = false
      for (const layerName of Object.keys(ctx.state)) {
        const layerOut = ctx.state[layerName]
        const ref = stableStringify(layerOut)
        if (ref.includes(p)) { found = true; break }
      }
      if (found) covered.push(p); else uncovered.push(p)
    }
    const total = paths.length
    const coverage_pct = total === 0 ? 100 : (covered.length / total) * 100
    return { covered_paths: covered, uncovered_paths: uncovered, coverage_pct }
  },

  qa_gate_policy: (ctx) => {
    const layerSelect = ctx.state.LayerSelect ?? {}
    const selectedLayers = layerSelect.selected_layers ?? []
    const perLayer = {}
    const blocking = []
    const warned = []
    // Map each selected layer to a decision drawn from the corresponding state.
    // runtime-qa#2: component/unit/contract layers map to DIFFERENT node names across presets
    // (production presets name the fanout node `ComponentOrContract`; smoke/graph-smoke name it
    // `UnitOrComponent`). A static single-name map mis-pointed `Component`→`UnitOrComponent`, so a
    // production run with real ComponentOrContract evidence reported the layer as MISSING→BLOCK.
    // An array value = ordered candidates; pick the first that actually exists in state.
    const layerToStateNode = {
      Static: 'StaticGate',
      'Unit-TDD': ['ComponentOrContract', 'UnitOrComponent'],
      Component: ['ComponentOrContract', 'UnitOrComponent'],
      Integration: 'Integration',
      Contract: ['ComponentOrContract', 'UnitOrComponent'],
      E2E: 'E2E',
      Visual: 'VisualGate',
      A11y: 'A11yGate',
      Perf: 'PerfGate',
      Smoke: 'Smoke',
      TestData: 'TestData',
      FlakyGovernance: 'FlakyQuarantineCheck',
    }
    function resolveStateNode(mapped, layer) {
      if (Array.isArray(mapped)) {
        for (const cand of mapped) {
          if (cand in ctx.state) return cand
        }
        return mapped[0]  // none present yet → first candidate (will read as MISSING)
      }
      return mapped ?? layer
    }
    for (const layer of selectedLayers) {
      const nodeName = resolveStateNode(layerToStateNode[layer], layer)
      const nodeOut = ctx.state[nodeName]
      let dec = 'MISSING'
      if (Array.isArray(nodeOut)) {
        // runtime-qa#1 / P0-3: fanout (ComponentOrContract / VisualAudit) and pipeline (E2E)
        // produce an ARRAY of per-item results — an array has no `.decision`, so the old
        // object path silently fell through to 'CONDITIONAL_PASS' (a FAILing component layer
        // downgraded to WARN, never BLOCK). Scan every item: any item FAIL/BLOCK/BLOCKED or a
        // numeric exit_code >= 1 makes the WHOLE layer FAIL. Empty array (no items produced for
        // a selected layer) = MISSING. Otherwise the layer is the worst non-failing item state.
        if (nodeOut.length === 0) {
          dec = 'MISSING'
        } else {
          let anyFail = false
          let anyWarn = false
          for (const it of nodeOut) {
            if (!it || typeof it !== 'object') { anyFail = true; continue }
            const idec = it.decision ?? it.decision_hint ?? null
            const ec = it.exit_code
            if (idec === 'FAIL' || idec === 'BLOCK' || idec === 'BLOCKED' || idec === 'MISSING'
                || (typeof ec === 'number' && ec >= 1)) {
              anyFail = true
            } else if (idec === 'WARN' || idec === 'CONDITIONAL_PASS') {
              anyWarn = true
            }
          }
          dec = anyFail ? 'FAIL' : (anyWarn ? 'WARN' : 'PASS')
        }
      } else if (nodeOut && typeof nodeOut === 'object') {
        dec = nodeOut.decision ?? nodeOut.static_decision ?? nodeOut.visual_decision
             ?? nodeOut.a11y_decision ?? nodeOut.perf_decision ?? 'CONDITIONAL_PASS'
      }
      perLayer[layer] = dec
      if (dec === 'FAIL' || dec === 'BLOCK' || dec === 'BLOCKED' || dec === 'MISSING') blocking.push(layer)
      else if (dec === 'WARN' || dec === 'CONDITIONAL_PASS') warned.push(layer)
    }
    // dispatch_failures from R7 invariant feed
    const failures = ctx.state.__dispatch_failures ?? []
    const dispatchBlocking = failures.some(f => f.blocks_release === true)
    // critical path coverage
    // runtime-qa#5: no production preset wires a compute_critical_path_coverage phase, so
    // state.__critical_path_coverage was always null and require_full_coverage could never block.
    // When the policy demands full coverage but no upstream phase computed it, inline-compute here
    // using the SAME logic as the compute_critical_path_coverage deterministic op (scan every
    // state.* layer for an evidence reference to each critical path). Makes the BLOCK reachable
    // without adding a phase. If an upstream phase already produced it, reuse that verbatim.
    let cpc = ctx.state.__critical_path_coverage ?? null
    if (cpc === null && ctx.policy?.require_full_coverage === true) {
      const paths = ctx.critical_release_paths ?? []
      const covered = []
      const uncovered = []
      for (const p of paths) {
        let found = false
        for (const layerName of Object.keys(ctx.state)) {
          if (layerName.startsWith('__')) continue
          if (stableStringify(ctx.state[layerName]).includes(p)) { found = true; break }
        }
        if (found) covered.push(p); else uncovered.push(p)
      }
      const total = paths.length
      cpc = { covered_paths: covered, uncovered_paths: uncovered, coverage_pct: total === 0 ? 100 : (covered.length / total) * 100 }
    }
    let coverageBlocks = false
    if (cpc && Array.isArray(cpc.uncovered_paths) && cpc.uncovered_paths.length > 0
        && ctx.policy?.require_full_coverage === true) {
      coverageBlocks = true
    }
    // floor rule (mandated layers from risk_snapshot)
    const floorTriggers = ctx.risk_snapshot?.floor_rule_status?.triggers ?? []
    const mandated = new Set()
    for (const t of floorTriggers) {
      for (const m of (t.mandated_layers ?? [])) mandated.add(m)
    }
    const missingMandated = [...mandated].filter(m => !selectedLayers.includes(m))
    const floorTriggered = missingMandated.length > 0

    let decision
    if (blocking.length > 0 || dispatchBlocking || coverageBlocks || floorTriggered) decision = 'BLOCK'
    else if (warned.length > 0) decision = 'WARN'
    else decision = 'PASS'

    return {
      decision,
      blocking_layers: blocking,
      warned_layers: warned,
      per_layer_summary: perLayer,
      critical_path_coverage: cpc,
      floor_triggered: floorTriggered,
      floor_action: floorTriggered ? `missing mandated layers: ${missingMandated.join(',')}` : null,
      failed_checks: dispatchBlocking ? ['dispatch_failures_block_release'] : [],
    }
  },

  flaky_quarantine_decision: (ctx) => {
    const tests = ctx.state.FlakyTriage?.tests ?? []
    const critical = new Set(ctx.critical_release_paths ?? [])
    let admissible = 0
    let rejected = 0
    for (const t of tests) {
      const isCritical = t.is_critical_release_path === true
                         || (t.critical_path_category && critical.has(t.critical_path_category))
      if (isCritical) {
        rejected += 1
      } else if (t.quarantine && t.quarantine.owner) {
        admissible += 1
      }
    }
    return {
      admissible_quarantines: admissible,
      rejected_critical_path: rejected,
      decision: rejected > 0 ? 'BLOCK' : (admissible > 0 ? 'WARN' : 'PASS'),
    }
  },

  visual_gate_policy: (ctx) => {
    const va = ctx.state.VisualAudit
    if (!Array.isArray(va)) {
      return { visual_decision: 'MISSING', regressed_surfaces: [], missing_baselines: [] }
    }
    const floor = ctx.policy?.visual_floor ?? {}
    const maxPixelDiff = floor.max_pixel_diff_count ?? 0
    const allowMissing = floor.allow_missing_baseline === true
    const regressed = []
    const missing = []
    for (const s of va) {
      if (!s || typeof s !== 'object') continue
      if (s.baseline_present === false) missing.push(s.surface?.path ?? 'unknown')
      else if ((s.pixel_diff_count ?? 0) > maxPixelDiff) regressed.push(s.surface?.path ?? 'unknown')
    }
    let decision = 'PASS'
    if (regressed.length > 0) decision = 'BLOCK'
    else if (missing.length > 0 && !allowMissing) decision = 'WARN'
    return { visual_decision: decision, regressed_surfaces: regressed, missing_baselines: missing }
  },

  a11y_gate_policy: (ctx) => {
    const aa = ctx.state.A11yAudit ?? {}
    const floor = ctx.policy?.a11y_floor ?? {}
    const maxCritical = floor.max_critical ?? 0
    const maxSerious = floor.max_serious ?? 0
    const violations = aa.violations ?? []
    let criticalCount = 0
    let seriousCount = 0
    for (const v of violations) {
      if (v.impact === 'critical') criticalCount += 1
      else if (v.impact === 'serious') seriousCount += 1
    }
    const violating = aa.surfaces?.filter(s => (s.violation_count ?? 0) > 0).map(s => s.path) ?? []
    let decision = 'PASS'
    if (criticalCount > maxCritical) decision = 'BLOCK'
    else if (seriousCount > maxSerious) decision = 'WARN'
    return {
      a11y_decision: decision,
      violating_surfaces: violating,
      violation_summary: { critical: criticalCount, serious: seriousCount, total: violations.length },
    }
  },

  perf_gate_policy: (ctx) => {
    const pa = ctx.state.PerfAudit ?? {}
    const floor = ctx.policy?.perf_floor ?? {}
    const metrics = pa.metrics ?? {}
    const regressed = []
    const checks = [
      ['lcp_ms', floor.max_lcp_ms ?? Infinity],
      ['inp_ms', floor.max_inp_ms ?? Infinity],
      ['cls', floor.max_cls ?? Infinity],
      ['tbt_ms', floor.max_tbt_ms ?? Infinity],
      ['bundle_size_bytes', floor.max_bundle_size_bytes ?? Infinity],
    ]
    for (const [metric, threshold] of checks) {
      const current = metrics[metric]
      if (typeof current === 'number' && current > threshold) {
        regressed.push({ metric, current, threshold })
      }
    }
    const decision = regressed.length === 0 ? 'PASS'
                   : regressed.some(r => r.metric === 'lcp_ms' || r.metric === 'inp_ms') ? 'BLOCK'
                   : 'WARN'
    return { perf_decision: decision, regressed_metrics: regressed }
  },
}

const PREDICATE_OPS = {
  no_layers_active: (ctx) => {
    const sel = ctx.state.LayerSelect?.selected_layers ?? []
    return sel.length === 0
  },
  critical_path_not_covered: (ctx) => {
    const cpc = ctx.state.__critical_path_coverage
    return !!(cpc && Array.isArray(cpc.uncovered_paths) && cpc.uncovered_paths.length > 0
              && ctx.policy?.require_full_coverage === true)
  },
  evidence_bundle_incomplete: (ctx) => {
    const eb = ctx.state.EvidenceBundle
    if (!eb || typeof eb !== 'object') return true
    const sel = ctx.state.LayerSelect?.selected_layers ?? []
    const per = eb.per_layer_decisions ?? {}
    return sel.some(l => !per[l])
  },
  no_flaky_signal: (ctx) => {
    const e2e = ctx.state.E2E ?? []
    const sigs = Array.isArray(e2e)
      ? e2e.some(r => r?.flaky_signal && r.flaky_signal.kind && r.flaky_signal.kind !== 'none')
      : false
    return !sigs
  },
  fanout_item_dropped: (ctx) => {
    const failures = ctx.state.__dispatch_failures ?? []
    return failures.length > 0
  },
}

const INVARIANT_OPS = {
  critical_release_paths_have_owner: (output, ctx) => {
    if (!output || !Array.isArray(output.tests)) return output
    const critical = new Set(ctx.critical_release_paths ?? [])
    let rejected = 0
    let admissible = 0
    for (const t of output.tests) {
      const isCritical = t.is_critical_release_path === true
                         || (t.critical_path_category && critical.has(t.critical_path_category))
      if (isCritical) {
        t.rejected_critical_path = true
        delete t.quarantine  // Floor Rule §3.6 — critical paths cannot be quarantined
        rejected += 1
      } else if (t.quarantine && t.quarantine.owner && t.quarantine.issue_url
                 && t.quarantine.expiry_iso && t.quarantine.reproducer
                 && t.quarantine.unblock_criteria && t.quarantine.rollback_plan
                 && t.quarantine.compensating_test && t.quarantine.scope_note) {
        admissible += 1
      } else if (t.quarantine) {
        // Quarantine present but missing required fields — invalidate.
        delete t.quarantine
      }
    }
    output.admissible_quarantines = admissible
    output.rejected_critical_path_count = rejected
    return output
  },

  ensure_evidence_bundle_layers: (output, ctx) => {
    if (!output || typeof output !== 'object') return output
    const sel = ctx.state.LayerSelect?.selected_layers ?? []
    output.per_layer_decisions = output.per_layer_decisions ?? {}
    for (const l of sel) {
      if (!output.per_layer_decisions[l]) {
        output.per_layer_decisions[l] = { decision: 'MISSING', notes: 'not_produced_by_workflow' }
      }
    }
    return output
  },

  // R7 — convert null/dropped items in upstream fanout/pipeline phases into
  // structured MISSING records. NEVER silently filter.
  map_null_outputs_to_missing: (output, ctx) => {
    if (!output || typeof output !== 'object') return output
    const failures = ctx.state.__dispatch_failures ?? []
    output.dispatch_failures = output.dispatch_failures ?? []
    for (const f of failures) {
      output.dispatch_failures.push({
        node: f.node,
        item_id: f.item_id ?? f.index,
        status: f.status ?? 'DISPATCH_FAILED_OR_SKIPPED',
        decision: 'MISSING',
        blocks_release: f.blocks_release !== false,
        stderr_excerpt: f.stderr_excerpt ?? null,
      })
      // Also surface into per_layer_decisions for Gate consumption.
      output.per_layer_decisions = output.per_layer_decisions ?? {}
      const k = `${f.node}#${f.item_id ?? f.index}`
      output.per_layer_decisions[k] = { decision: 'MISSING', notes: `dispatch_failure:${f.status}` }
    }
    return output
  },
}

// ─── ops_allowed whitelist enforcement (fail-closed if partial) ────────
function assertOpAllowed(opName, kind) {
  if (!spec.ops_allowed) return  // no whitelist → permit
  const kindList = spec.ops_allowed[kind]
  if (!Array.isArray(kindList)) {
    throw new Error(`op "${opName}" rejected: spec.ops_allowed.${kind} missing or not an array (partial whitelist is fail-closed)`)
  }
  if (!kindList.includes(opName)) {
    throw new Error(`op "${opName}" (${kind}) not in spec.ops_allowed.${kind} whitelist`)
  }
}

// ─── pipeline stage runner ─────────────────────────────────────────────
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
  if (stage.type === 'single' || stage.type === undefined) {
    const tmpl = resolveStagePrompt(stage, parentNode, specRef)
    const schemaObj = resolveStageSchema(stage, parentNode, specRef)
    return await agent(render(tmpl, { ...ctx, item }), {
      label: `${parentNode.name}:${stage.name ?? 'stage'}`,
      phase: parentNode.name,
      schema: schemaObj,
      model: pickModelFromStage(stage, parentNode, modelOverrides),
      agentType: stage.agentType ?? parentNode.agentType,
    })
  }
  throw new Error(`unknown pipeline stage type "${stage.type}" in node ${parentNode.name}`)
}

// ─── R7: record dropped fanout/pipeline items as MISSING ───────────────
function recordDispatchFailure(nodeName, itemId, status, stderrExcerpt) {
  dispatchFailures.push({
    node: nodeName,
    item_id: itemId,
    status: status ?? 'DISPATCH_FAILED_OR_SKIPPED',
    blocks_release: true,
    stderr_excerpt: stderrExcerpt ?? null,
  })
}

// Collect results without filtering: keep all items, but record failures.
function collectResults(nodeName, items, results) {
  const kept = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const itemId = items[i]?.surface_id ?? items[i]?.scenario_id ?? items[i]?.key ?? items[i]?.id ?? i
    if (r === null || r === undefined) {
      recordDispatchFailure(nodeName, itemId, 'DISPATCH_FAILED_OR_SKIPPED', null)
    } else if (typeof r === 'object' && r.__error) {
      recordDispatchFailure(nodeName, itemId, r.__error_status ?? 'AGENT_ERROR', r.__stderr ?? null)
    } else {
      kept.push(r)
    }
  }
  return kept
}

// ─── main loop ─────────────────────────────────────────────────────────
for (const node of spec.phases) {
  phase(node.name)

  const ctxBase = {
    state,
    release_tag: releaseTag,
    run_id: runId,
    risk_snapshot: riskSnapshot,
    critical_release_paths: criticalReleasePaths,
    policy,
    // Spec-level context for prompts that need mode / spec_hash.
    mode: spec.mode ?? null,
    spec_hash: input.spec_hash ?? null,
    // Per-phase upstream extras carried in input.context (e.g. branch_sha, viewport).
    branch_sha: ctxIn.branch_sha ?? null,
    viewport: ctxIn.viewport ?? null,
    playwright_config_hash: ctxIn.playwright_config_hash ?? null,
    screenshot_baseline_dir_hash: ctxIn.screenshot_baseline_dir_hash ?? null,
    visual_baseline_dir_hash: ctxIn.visual_baseline_dir_hash ?? null,
    e2e_runner_version: ctxIn.e2e_runner_version ?? null,
    // B.2 fix 2026-05-30: prompt-facing run-context the qa prompts reference but the
    // orchestrator previously did not pass through (hard-failed render). NOT folded into
    // hashNode (resume cache unaffected).
    changed_files: ctxIn.changed_files ?? [],
    repo_signals: ctxIn.repo_signals ?? null,
    repo_root: ctxIn.repo_root ?? '.',
    // runtime-qa#3: additional prompt-facing run-context referenced by e2e / a11y / perf prompts.
    // render() hard-throws on an undefined variable, so every {{ placeholder }} a prompt can hit
    // MUST resolve to a defined value here. These are project signals the Skill MAY supply via
    // input.context; defaults keep render total. NOT folded into hashNode (provenance-neutral,
    // mirrors the B.2 precedent). Per-item placeholders ({{ item.* }}) resolve from the fanout/
    // pipeline item, not from here.
    target_url_candidate: ctxIn.target_url_candidate ?? '',
    target_url: ctxIn.target_url ?? '',
    target_urls: ctxIn.target_urls ?? [],
    retry_budget: ctxIn.retry_budget ?? 0,
    wcag_level_target: ctxIn.wcag_level_target ?? 'AA',
    thresholds: ctxIn.thresholds ?? {},
    baseline_metrics_ref: ctxIn.baseline_metrics_ref ?? '',
    context: ctxIn,
    ops_invariant_outputs: { map_null_outputs_to_missing: dispatchFailures },
  }
  // expose dispatch_failures for R7 predicates/invariants
  state.__dispatch_failures = dispatchFailures

  const nodeFingerprint = hashNode(node, spec, ctxBase)
  phaseFingerprints[node.name] = nodeFingerprint

  // 1. resume cache check
  const cached = previousResults[node.name]
  if (cached !== undefined) {
    if (cached && typeof cached === 'object' && 'node_fingerprint' in cached && 'output' in cached) {
      if (cached.node_fingerprint === nodeFingerprint) {
        state[node.name] = cached.output
        reusedPhases.push(node.name)
        log(`${node.name}: reused (fingerprint ${nodeFingerprint})`)
        continue
      } else {
        cacheMisses.push({ name: node.name, reason: 'fingerprint changed', expected: nodeFingerprint, cached: cached.node_fingerprint })
        log(`${node.name}: cache miss (fingerprint changed)`)
      }
    } else {
      cacheMisses.push({ name: node.name, reason: 'unfingerprinted cache entry' })
      log(`${node.name}: cache miss (legacy unfingerprinted entry)`)
    }
  }

  // 2. skip_if
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
      // contracts-qa#2: component-or-contract.v1 prompt branches on item.kind and promises a
      // `_dispatched_schema` routing field. The agent's StructuredOutput schema is forced at
      // call-time, so honor the routing by selecting the per-item schema BEFORE the call, keyed
      // on item.kind. api-contract/schema kinds → CONTRACT_TEST_SCHEMA.v1 when the spec registers
      // it; everything else → the node's default schema. Non-routing nodes (VisualAudit etc.)
      // have a single kind and fall through to the default unchanged.
      const CONTRACT_KINDS = new Set(['api-contract', 'schema'])
      function schemaForItem(item) {
        if (item && typeof item === 'object' && CONTRACT_KINDS.has(item.kind)) {
          const contractSchema = spec.schemas['CONTRACT_TEST_SCHEMA.v1']
          if (contractSchema && typeof contractSchema === 'object') return contractSchema
        }
        return schemaObj
      }
      const results = await parallel(items.map((item, i) => () => agent(
        render(tmpl, { ...ctxBase, item, index: i }),
        {
          label: `${node.name}:${item?.surface_id ?? item?.scenario_id ?? item?.key ?? i}`,
          phase: node.name,
          schema: schemaForItem(item),
          model: pickModel(node, modelOverrides),
          agentType: node.agentType,
          isolation: node.isolation,
        }
      )))
      // R7: record dropped items, but keep observable results for downstream.
      state[node.name] = collectResults(node.name, items, results)
      break
    }

    case 'pipeline': {
      const items = resolveItems(node.items_from, ctxBase)
      log(`${node.name}: pipeline over ${items.length} item(s), ${node.stages.length} stage(s)`)
      const stageFns = node.stages.map(stage => async (carry, _orig, _idx) => {
        return await runStage(stage, carry, ctxBase, spec, node)
      })
      const results = await pipeline(items, ...stageFns)
      state[node.name] = collectResults(node.name, items, results)
      break
    }

    case 'deterministic': {
      assertOpAllowed(node.op, 'deterministic')
      const op = DETERMINISTIC_OPS[node.op]
      if (!op) throw new Error(`unknown deterministic op "${node.op}" (not in DETERMINISTIC_OPS registry)`)
      // Critical-path coverage is a special pre-Gate op surfaced under a fixed key.
      const result = op(ctxBase, node.params)
      state[node.name] = result
      if (node.op === 'compute_critical_path_coverage') {
        state.__critical_path_coverage = result
      }
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
const fingerprintedOutputs = {}
for (const node of spec.phases) {
  if (node.name in state && node.name in phaseFingerprints) {
    fingerprintedOutputs[node.name] = {
      node_fingerprint: phaseFingerprints[node.name],
      output: state[node.name],
    }
  }
}

// Strip internal scratch keys before return
delete state.__dispatch_failures
delete state.__critical_path_coverage

return {
  run_id: runId,
  release_tag: releaseTag,
  reused_phases: reusedPhases,
  cache_misses: cacheMisses,
  dispatch_failures: dispatchFailures,
  phase_outputs: state,
  phase_outputs_fingerprinted: fingerprintedOutputs,
}
