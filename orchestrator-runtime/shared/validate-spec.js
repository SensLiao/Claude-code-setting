#!/usr/bin/env node
/**
 * validate-spec.js — Pre-launch spec validator (Skill main-thread helper)
 *
 * Used by domain Skills (appsec / qa / uiux / gsd) BEFORE calling
 *   Workflow({name: '<domain>-orchestrator', args:{spec,...}})
 * to fail-fast on a malformed spec — invalid spec spends 0 agent tokens.
 *
 * Usage:
 *   node validate-spec.js <spec-file.json>            # exit 0 OK, 2 INVALID
 *   node validate-spec.js --stdin                     # read spec from stdin
 *   node validate-spec.js <spec-file.json> --quiet    # no OK stdout
 *
 * Loader strategy (CAVEAT: ajv may not be in global PATH):
 *   1. Try to require('ajv') from a list of known plugin/marketplace install paths
 *   2. If ajv is loadable → strict full JSON-schema validation against
 *      ~/.claude/orchestrator-runtime/shared/orchestrator-spec.v1.json
 *   3. If ajv is NOT loadable → fall back to inline structural validator
 *      that enforces the spec-v1 hard invariants (engine_version, orchestrator,
 *      phases shape, prompts/schemas inline maps, ops_allowed shape,
 *      type-specific required fields per node, path-safe item_from / ref names).
 *
 * Exit codes (fail-fast contract):
 *   0  spec OK — safe to launch Workflow
 *   2  spec INVALID — DO NOT launch; stderr has detailed errors
 *   3  internal error (unreadable file, malformed JSON, etc.) — also DO NOT launch
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const os   = require('os')

const SCHEMA_PATH = path.join(
  os.homedir(), '.claude', 'orchestrator-runtime', 'shared', 'orchestrator-spec.v1.json'
)

// ─── arg parsing ──────────────────────────────────────────────────────
function parseArgs(argv) {
  let specPath = null
  let useStdin = false
  let quiet    = false
  for (const a of argv.slice(2)) {
    if (a === '--stdin')      useStdin = true
    else if (a === '--quiet') quiet    = true
    else if (a.startsWith('--')) {
      process.stderr.write(`validate-spec: unknown flag ${a}\n`)
      process.exit(3)
    }
    else if (!specPath)       specPath = a
  }
  if (!useStdin && !specPath) {
    process.stderr.write(
      'usage: validate-spec.js <spec.json> [--quiet]\n' +
      '       validate-spec.js --stdin [--quiet]\n')
    process.exit(3)
  }
  return { specPath, useStdin, quiet }
}

function readSpec(specPath, useStdin) {
  let raw
  try {
    raw = useStdin ? fs.readFileSync(0, 'utf8') : fs.readFileSync(specPath, 'utf8')
  } catch (e) {
    process.stderr.write(`validate-spec: cannot read spec (${e.code || ''} ${e.message})\n`)
    process.exit(3)
  }
  try { return JSON.parse(raw) }
  catch (e) {
    process.stderr.write(`validate-spec: spec is not valid JSON: ${e.message}\n`)
    process.exit(3)
  }
}

// ─── ajv loader (best-effort) ─────────────────────────────────────────
// Spec uses $schema "draft/2020-12"; stock Ajv defaults to draft-07 and
// rejects the meta-ref. Prefer the 2020 build (ajv/dist/2020) when present.
function tryLoadAjv() {
  const roots = [
    process.env.AJV_PATH,                                                   // explicit override (full path)
    path.join(process.cwd(), 'node_modules', 'ajv'),
    path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'everything-claude-code', 'node_modules', 'ajv'),
    path.join(os.homedir(), '.claude', 'mcp-servers', 'xmind-ultimate-mcp', 'node_modules', 'ajv'),
    path.join(os.homedir(), '.claude', 'node_modules', 'ajv'),
  ].filter(Boolean)

  for (const root of roots) {
    // Prefer ajv/dist/2020 (Ajv2020 class) — supports draft-2020-12 meta out of the box
    for (const sub of ['dist/2020.js', 'dist/2020', '']) {
      const target = sub ? path.join(root, sub) : root
      try {
        const mod = require(target)
        const Ajv = mod.default || mod.Ajv2020 || mod
        return { Ajv, path: target, draft2020: sub.startsWith('dist/2020') }
      } catch (_) { /* next */ }
    }
  }
  return null
}

// ─── inline structural validator (ajv-free fallback) ─────────────────
const NODE_NAME_RE        = /^[A-Z][a-zA-Z0-9_-]+$/
const PROMPT_REF_RE       = /^[a-z][a-z0-9_.-]*$/
const SCHEMA_REF_RE       = /^[A-Z][A-Z0-9_]*(\.v[0-9]+)?$/
const ITEMS_FROM_RE       = /^(state|ctx)(\.[A-Za-z_][A-Za-z0-9_]*)+$/
const OP_NAME_RE          = /^[a-z][a-z0-9_]*$/
const AGENT_TYPE_RE       = /^[a-z][a-z0-9-]*$/
const LAYER_RE            = /^[a-z][a-z0-9_-]*$/

const VALID_NODE_TYPES = new Set(['single', 'fanout', 'pipeline', 'deterministic'])
const VALID_STAGE_TYPES = new Set(['single', 'fanout'])
// Patch A.4 (2026-05-28): accept aliases + bare legacy + versioned legacy.
// Aliases (preferred):    cheap_fast / balanced / strongest_available / inherit
// Bare legacy literals:   haiku / sonnet / opus
// Versioned legacy:       haiku-4.5 / sonnet-4.6 / opus-4.8 / future versions
//
// Cross-review Item F fix (2026-05-28): VALID_MODELS now matches preflight's
// LEGACY_LITERALS_RE and `model-policy.md` per-project override examples
// (which use literals like "haiku-5.0"). Versioned literals are accepted but
// preset authors should prefer aliases — versioning belongs in the override map.
const VALID_ALIASES     = new Set(['cheap_fast', 'balanced', 'strongest_available', 'inherit'])
const LEGACY_LITERAL_RE = /^(haiku|sonnet|opus)(-[0-9][a-z0-9.-]*)?$/
function isValidModel(m) {
  return VALID_ALIASES.has(m) || LEGACY_LITERAL_RE.test(m)
}
// Backward compat: VALID_MODELS preserved as a Set-shaped check for any callers
// that still call .has(); but the canonical check is now isValidModel().
const VALID_MODELS      = {
  has: (m) => isValidModel(m),
}
const VALID_ISOLATION   = new Set(['worktree'])
const VALID_ORCHS       = new Set(['appsec', 'qa', 'uiux', 'gsd'])

const ALLOWED_NODE_KEYS = new Set([
  'name','type','model','agentType','prompt_ref','schema_ref','items_from',
  'stages','op','params','skip_if','skip_default','post_invariants',
  'invariant_params','isolation','label','sdk',
])

const ALLOWED_STAGE_KEYS = new Set([
  'type','model','agentType','prompt_ref','schema_ref','vote_count_by_severity',
])

const ALLOWED_SDK_KEYS = new Set(['command', 'layer'])

const ALLOWED_TOP_KEYS = new Set([
  'engine_version','orchestrator','phases','prompts','schemas','ops_allowed',
])

const ALLOWED_OPS_ALLOWED_KEYS = new Set(['deterministic','predicates','invariants'])

function pushErr(errs, where, msg) { errs.push(`${where}: ${msg}`) }

function checkExtraKeys(errs, where, obj, allowed) {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) pushErr(errs, where, `unknown property "${k}"`)
  }
}

function checkStage(errs, where, stage) {
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
    pushErr(errs, where, 'must be object'); return
  }
  checkExtraKeys(errs, where, stage, ALLOWED_STAGE_KEYS)

  if (!VALID_STAGE_TYPES.has(stage.type))
    pushErr(errs, where, `type must be one of ${[...VALID_STAGE_TYPES].join(',')} (got "${stage.type}")`)

  if (stage.model !== undefined && !VALID_MODELS.has(stage.model))
    pushErr(errs, where, `model invalid: "${stage.model}"`)

  if (stage.agentType !== undefined && !AGENT_TYPE_RE.test(stage.agentType))
    pushErr(errs, where, `agentType "${stage.agentType}" violates ${AGENT_TYPE_RE}`)

  if (stage.prompt_ref !== undefined && !PROMPT_REF_RE.test(stage.prompt_ref))
    pushErr(errs, where, `prompt_ref "${stage.prompt_ref}" violates ${PROMPT_REF_RE}`)

  if (stage.schema_ref !== undefined && !SCHEMA_REF_RE.test(stage.schema_ref))
    pushErr(errs, where, `schema_ref "${stage.schema_ref}" violates ${SCHEMA_REF_RE}`)

  if (stage.vote_count_by_severity !== undefined) {
    const v = stage.vote_count_by_severity
    if (!v || typeof v !== 'object' || Array.isArray(v))
      pushErr(errs, where, 'vote_count_by_severity must be object')
    else {
      for (const [k, n] of Object.entries(v)) {
        if (!['info','low','medium','high','critical'].includes(k))
          pushErr(errs, where, `vote_count_by_severity unknown severity "${k}"`)
        if (!Number.isInteger(n) || n < 1 || n > 7)
          pushErr(errs, where, `vote_count_by_severity.${k} must be int 1..7 (got ${n})`)
      }
    }
  }
}

function checkNode(errs, idx, node) {
  const where = `phases[${idx}]`
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    pushErr(errs, where, 'must be object'); return
  }
  checkExtraKeys(errs, where, node, ALLOWED_NODE_KEYS)

  if (typeof node.name !== 'string' || !NODE_NAME_RE.test(node.name))
    pushErr(errs, where, `name "${node.name}" violates ${NODE_NAME_RE}`)

  if (!VALID_NODE_TYPES.has(node.type))
    pushErr(errs, where, `type must be one of ${[...VALID_NODE_TYPES].join(',')} (got "${node.type}")`)

  if (node.model !== undefined && !VALID_MODELS.has(node.model))
    pushErr(errs, where, `model invalid: "${node.model}"`)
  if (node.agentType !== undefined && !AGENT_TYPE_RE.test(node.agentType))
    pushErr(errs, where, `agentType "${node.agentType}" violates ${AGENT_TYPE_RE}`)
  if (node.prompt_ref !== undefined && !PROMPT_REF_RE.test(node.prompt_ref))
    pushErr(errs, where, `prompt_ref "${node.prompt_ref}" violates ${PROMPT_REF_RE}`)
  if (node.schema_ref !== undefined && !SCHEMA_REF_RE.test(node.schema_ref))
    pushErr(errs, where, `schema_ref "${node.schema_ref}" violates ${SCHEMA_REF_RE}`)
  if (node.items_from !== undefined && !ITEMS_FROM_RE.test(node.items_from))
    pushErr(errs, where, `items_from "${node.items_from}" must match ${ITEMS_FROM_RE} (dot-chain only, starts with state. or ctx.)`)
  if (node.op !== undefined && !OP_NAME_RE.test(node.op))
    pushErr(errs, where, `op "${node.op}" violates ${OP_NAME_RE}`)
  if (node.skip_if !== undefined && !OP_NAME_RE.test(node.skip_if))
    pushErr(errs, where, `skip_if "${node.skip_if}" violates ${OP_NAME_RE}`)
  if (node.isolation !== undefined && !VALID_ISOLATION.has(node.isolation))
    pushErr(errs, where, `isolation invalid: "${node.isolation}"`)
  if (node.post_invariants !== undefined) {
    if (!Array.isArray(node.post_invariants))
      pushErr(errs, where, 'post_invariants must be array')
    else node.post_invariants.forEach((inv, j) => {
      if (typeof inv !== 'string' || !OP_NAME_RE.test(inv))
        pushErr(errs, `${where}.post_invariants[${j}]`, `invariant "${inv}" violates ${OP_NAME_RE}`)
    })
  }
  if (node.stages !== undefined) {
    if (!Array.isArray(node.stages) || node.stages.length < 1)
      pushErr(errs, where, 'stages must be non-empty array')
    else node.stages.forEach((s, j) => checkStage(errs, `${where}.stages[${j}]`, s))
  }
  if (node.sdk !== undefined) {
    if (!node.sdk || typeof node.sdk !== 'object' || Array.isArray(node.sdk))
      pushErr(errs, where, 'sdk must be object')
    else {
      checkExtraKeys(errs, `${where}.sdk`, node.sdk, ALLOWED_SDK_KEYS)
      if (typeof node.sdk.command !== 'string' || node.sdk.command.length < 1)
        pushErr(errs, `${where}.sdk`, 'command required (non-empty string)')
      if (node.sdk.layer !== undefined && !LAYER_RE.test(node.sdk.layer))
        pushErr(errs, `${where}.sdk`, `layer "${node.sdk.layer}" violates ${LAYER_RE}`)
    }
  }

  // type-specific required fields
  switch (node.type) {
    case 'single':
      if (!node.prompt_ref) pushErr(errs, where, 'single requires prompt_ref')
      if (!node.schema_ref) pushErr(errs, where, 'single requires schema_ref')
      if (!node.agentType)  pushErr(errs, where, 'single requires agentType')
      break
    case 'fanout':
      if (!node.items_from) pushErr(errs, where, 'fanout requires items_from')
      if (!node.prompt_ref) pushErr(errs, where, 'fanout requires prompt_ref')
      if (!node.schema_ref) pushErr(errs, where, 'fanout requires schema_ref')
      if (!node.agentType)  pushErr(errs, where, 'fanout requires agentType')
      break
    case 'pipeline':
      if (!node.items_from) pushErr(errs, where, 'pipeline requires items_from')
      if (!Array.isArray(node.stages) || node.stages.length < 1)
        pushErr(errs, where, 'pipeline requires non-empty stages[]')
      break
    case 'deterministic':
      if (!node.op) pushErr(errs, where, 'deterministic requires op')
      if (node.prompt_ref) pushErr(errs, where, 'deterministic must not set prompt_ref')
      if (node.schema_ref) pushErr(errs, where, 'deterministic must not set schema_ref')
      if (node.agentType)  pushErr(errs, where, 'deterministic must not set agentType')
      break
  }
}

function structuralValidate(spec) {
  const errs = []
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return ['root: must be object']
  }
  checkExtraKeys(errs, 'root', spec, ALLOWED_TOP_KEYS)

  if (spec.engine_version !== '1.0')
    pushErr(errs, 'engine_version', `must be "1.0" (got ${JSON.stringify(spec.engine_version)})`)

  if (!VALID_ORCHS.has(spec.orchestrator))
    pushErr(errs, 'orchestrator', `must be one of ${[...VALID_ORCHS].join(',')} (got "${spec.orchestrator}")`)

  if (!Array.isArray(spec.phases) || spec.phases.length < 1)
    pushErr(errs, 'phases', 'must be non-empty array')
  else spec.phases.forEach((node, i) => checkNode(errs, i, node))

  // duplicate phase name detection — not in schema but real footgun
  if (Array.isArray(spec.phases)) {
    const seen = new Set()
    for (const n of spec.phases) {
      if (n && typeof n.name === 'string') {
        if (seen.has(n.name)) pushErr(errs, 'phases', `duplicate phase name "${n.name}"`)
        seen.add(n.name)
      }
    }
  }

  if (!spec.prompts || typeof spec.prompts !== 'object' || Array.isArray(spec.prompts))
    pushErr(errs, 'prompts', 'must be object (may be {})')
  else for (const [k, v] of Object.entries(spec.prompts)) {
    if (typeof v !== 'string' || v.length < 1)
      pushErr(errs, `prompts.${k}`, 'must be non-empty string')
  }

  if (!spec.schemas || typeof spec.schemas !== 'object' || Array.isArray(spec.schemas))
    pushErr(errs, 'schemas', 'must be object (may be {})')
  else for (const [k, v] of Object.entries(spec.schemas)) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
      pushErr(errs, `schemas.${k}`, 'must be object')
  }

  if (spec.ops_allowed !== undefined) {
    if (!spec.ops_allowed || typeof spec.ops_allowed !== 'object' || Array.isArray(spec.ops_allowed))
      pushErr(errs, 'ops_allowed', 'must be object')
    else {
      checkExtraKeys(errs, 'ops_allowed', spec.ops_allowed, ALLOWED_OPS_ALLOWED_KEYS)
      for (const k of ['deterministic','predicates','invariants']) {
        if (spec.ops_allowed[k] === undefined) continue
        if (!Array.isArray(spec.ops_allowed[k]))
          pushErr(errs, `ops_allowed.${k}`, 'must be array')
        else spec.ops_allowed[k].forEach((op, j) => {
          if (typeof op !== 'string' || !OP_NAME_RE.test(op))
            pushErr(errs, `ops_allowed.${k}[${j}]`, `"${op}" violates ${OP_NAME_RE}`)
        })
      }
    }
  }

  // cross-check: every prompt_ref / schema_ref referenced in phases (or stages)
  // must appear in spec.prompts / spec.schemas inline maps. Skill builder is
  // responsible for inlining these BEFORE launch; if missing, workflow body
  // will throw mid-run. Fail-fast catches it here.
  if (Array.isArray(spec.phases)) {
    const allRefs = []
    for (const n of spec.phases) {
      if (n && typeof n === 'object') {
        if (n.prompt_ref) allRefs.push({kind:'prompt', ref:n.prompt_ref, where:n.name})
        if (n.schema_ref) allRefs.push({kind:'schema', ref:n.schema_ref, where:n.name})
        for (const s of (n.stages || [])) {
          if (s && s.prompt_ref) allRefs.push({kind:'prompt', ref:s.prompt_ref, where:`${n.name}.stage`})
          if (s && s.schema_ref) allRefs.push({kind:'schema', ref:s.schema_ref, where:`${n.name}.stage`})
        }
      }
    }
    const promptsMap = spec.prompts || {}
    const schemasMap = spec.schemas || {}
    for (const r of allRefs) {
      const map = r.kind === 'prompt' ? promptsMap : schemasMap
      if (!(r.ref in map))
        pushErr(errs, `phases[${r.where}]`,
          `${r.kind}_ref "${r.ref}" not found in spec.${r.kind}s — Skill must inline body before launch`)
    }
  }

  // cross-check: op / skip_if / post_invariants names must be in ops_allowed
  if (Array.isArray(spec.phases) && spec.ops_allowed) {
    const det = new Set(spec.ops_allowed.deterministic || [])
    const pre = new Set(spec.ops_allowed.predicates    || [])
    const inv = new Set(spec.ops_allowed.invariants    || [])
    for (const n of spec.phases) {
      if (!n || typeof n !== 'object') continue
      if (n.type === 'deterministic' && n.op && !det.has(n.op))
        pushErr(errs, `phases[${n.name}]`, `op "${n.op}" not in ops_allowed.deterministic`)
      if (n.skip_if && !pre.has(n.skip_if))
        pushErr(errs, `phases[${n.name}]`, `skip_if "${n.skip_if}" not in ops_allowed.predicates`)
      for (const i of (n.post_invariants || [])) {
        if (!inv.has(i))
          pushErr(errs, `phases[${n.name}]`, `post_invariants entry "${i}" not in ops_allowed.invariants`)
      }
    }
  }

  return errs
}

// ─── main ────────────────────────────────────────────────────────────
function main() {
  const { specPath, useStdin, quiet } = parseArgs(process.argv)
  const spec = readSpec(specPath, useStdin)

  let schema = null
  try { schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) }
  catch (e) {
    process.stderr.write(`validate-spec: WARN cannot read shared schema at ${SCHEMA_PATH}: ${e.message}\n`)
    // continue with structural fallback only
  }

  const ajvMod = tryLoadAjv()
  let errors = []
  let used   = 'structural'

  if (ajvMod && schema) {
    try {
      const ajv = new ajvMod.Ajv({strict: false, allErrors: true})
      const validate = ajv.compile(schema)
      if (!validate(spec)) {
        for (const e of (validate.errors || [])) {
          errors.push(`${e.instancePath || 'root'}: ${e.message} ${e.params ? JSON.stringify(e.params) : ''}`)
        }
      }
      used = `ajv (from ${ajvMod.path})`
    } catch (e) {
      process.stderr.write(`validate-spec: WARN ajv failed (${e.message}), falling back to structural\n`)
      errors = structuralValidate(spec)
    }
  } else {
    errors = structuralValidate(spec)
  }

  if (errors.length > 0) {
    process.stderr.write(`validate-spec: SPEC INVALID (${used}) — ${errors.length} error(s):\n`)
    for (const e of errors) process.stderr.write(`  - ${e}\n`)
    process.exit(2)
  }

  if (!quiet) {
    process.stdout.write(JSON.stringify({
      ok: true,
      validator: used,
      orchestrator: spec.orchestrator,
      phase_count: Array.isArray(spec.phases) ? spec.phases.length : 0,
      prompt_inline_count: Object.keys(spec.prompts || {}).length,
      schema_inline_count: Object.keys(spec.schemas || {}).length,
    }, null, 2) + '\n')
  }
  process.exit(0)
}

main()
