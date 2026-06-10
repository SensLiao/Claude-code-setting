#!/usr/bin/env node
/**
 * qa-preview-gate.js — PreToolUse hook for Workflow({name:'qa-orchestrator'})
 *
 * Mirrors appsec-preview-gate behavior plus QA-specific requirements:
 * - Block Workflow launch when no preview was approved for current (run_id, spec_hash).
 * - Sentinel binds (run_id, spec_hash, mode) — commercial-cert ADDITIONALLY requires
 *   approved_estimate_high (number, tokens) AND user_text matching approval phrase
 *   per registry _banner ("=== REQUIRES EXPLICIT BUDGET APPROVAL ===").
 * - Sentinel path: <project>/.qa/state/preview/<run_id>.json (project-scope per
 *   registry install_target).
 * - Date.now() / crypto OK inside hook — workflow-body ban does not apply to hooks.
 *
 * Install via qa-sdk init → <project>/.claude/settings.json:
 *   PreToolUse[matcher:"Workflow"] -> node .claude/hooks/qa-preview-gate.js
 *
 * Exit codes:
 *   0 — allow (not our concern, or valid sentinel)
 *   2 — block (with explanation on stderr)
 *
 * Sentinel shape (written by enterprise-qa-testing Skill main thread after user approval):
 *   <project>/.qa/state/preview/<run_id>.json
 *   {
 *     "run_id": "release-2026.05-rc3",
 *     "spec_hash": "sha256:...",          // canonical sha256
 *     "preview_hash": "sha256:...",
 *     "mode": "commercial-cert",          // ∈ {quick-check, focused-qa-gate, release-readiness, commercial-cert, smoke, graph-smoke}
 *     "approved_at": "2026-05-29T03:14:15.000Z",
 *     "approval_text": "approved",
 *     "ttl_seconds": 300,
 *     "approved_estimate_high": 1500000   // tokens; REQUIRED for commercial-cert
 *   }
 */

'use strict'

const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const DEFAULT_TTL_SECONDS = 300
const ABSOLUTE_MAX_TTL    = 3600
const ABSOLUTE_MIN_TTL    = 30

// sdk-bash#1: keep in lockstep with qa-sdk.sh cmd_sentinel_write mode case (6 modes). smoke /
// graph-smoke are internal harness presets launched via the same Workflow tool, so their
// sentinels must pass this gate too — omitting them made every internal smoke launch self-reject.
const QA_MODES = ['quick-check', 'focused-qa-gate', 'release-readiness', 'commercial-cert', 'smoke', 'graph-smoke']
const COMMERCIAL_CERT_APPROVAL_PATTERNS = [
  /\b(approved|approve)\b/i,
  /批准|确认|同意/,
  /=== REQUIRES EXPLICIT BUDGET APPROVAL ===/,
]

function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}
function computeSpecHash(spec) {
  return 'sha256:' + sha256Hex(stableStringify(spec))
}
function specHashMatches(claimed, spec) {
  if (typeof claimed !== 'string') return false
  return claimed === computeSpecHash(spec)
}

function readStdinJSON() {
  return new Promise((resolve, reject) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { buf += chunk })
    process.stdin.on('end',  () => {
      if (!buf.trim()) return resolve(null)
      try { resolve(JSON.parse(buf)) }
      catch (e) { reject(new Error('malformed stdin JSON: ' + e.message)) }
    })
    process.stdin.on('error', reject)
  })
}

function block(reason) {
  process.stderr.write(`[qa-preview-gate] BLOCKED: ${reason}\n`)
  process.exit(2)
}
function allow() { process.exit(0) }

async function main() {
  let payload
  try { payload = await readStdinJSON() }
  catch (e) { block(`stdin read error: ${e.message}`); return }

  if (!payload || typeof payload !== 'object') {
    block('empty or non-object stdin payload (expected Claude Code PreToolUse JSON)')
  }

  const toolName  = payload.tool_name
  const toolInput = payload.tool_input ?? {}

  if (toolName !== 'Workflow') return allow()

  const targetsQA =
    toolInput.name === 'qa-orchestrator' ||
    (typeof toolInput.scriptPath === 'string' && /qa-orchestrator\.js$/.test(toolInput.scriptPath))
  if (!targetsQA) return allow()

  const wfArgs = toolInput.args ?? {}
  const runId           = wfArgs.run_id
  const releaseTag      = wfArgs.release_tag
  const claimedSpecHash = wfArgs.spec_hash
  const spec            = wfArgs.spec

  if (!runId || typeof runId !== 'string') {
    block('Workflow launch missing args.run_id')
  }
  if (!releaseTag || typeof releaseTag !== 'string') {
    block('Workflow launch missing args.release_tag')
  }
  if (!claimedSpecHash || typeof claimedSpecHash !== 'string') {
    block('Workflow launch missing args.spec_hash')
  }
  if (!spec || typeof spec !== 'object') {
    block('Workflow launch missing args.spec (required to recompute spec_hash for verification)')
  }
  if (spec.orchestrator !== 'qa') {
    block(`spec.orchestrator must be "qa" (got "${spec.orchestrator}")`)
  }

  // Governed Gate Mode (2026-05-29): a deterministic gate launch must not enable
  // model-authored Dynamic Workflows. Dynamic Workflows / ultracode may only scout;
  // the gate verdict comes from this deterministic spec-runner. allow_dynamic_workflow
  // is part of spec → already bound into spec_hash, so this is also approval-pinned.
  if (spec.allow_dynamic_workflow === true) {
    block(
      'Governed Gate Mode: spec.allow_dynamic_workflow=true is forbidden for a QA gate launch. ' +
      'Set it false or omit it. Dynamic Workflows may scout outside the gate only. See CLAUDE.md §3.7.'
    )
  }

  // Recompute spec_hash and verify caller's claim. Approve-A-run-B defense.
  if (!specHashMatches(claimedSpecHash, spec)) {
    const canonical = computeSpecHash(spec)
    block(
      `args.spec_hash="${claimedSpecHash}" but recomputed from args.spec="${canonical}". ` +
      `Caller spec mismatch.`
    )
  }
  const recomputed = computeSpecHash(spec)

  // Resolve sentinel.
  const projectRoot = process.cwd()
  const safeId = runId.replace(/[^A-Za-z0-9._-]/g, '_')
  const sentinelPath = path.join(projectRoot, '.qa', 'state', 'preview', `${safeId}.json`)

  let sentinelRaw
  try { sentinelRaw = fs.readFileSync(sentinelPath, 'utf8') }
  catch (e) {
    if (e.code === 'ENOENT') {
      block(
        `no preview-approval sentinel at ${sentinelPath}\n` +
        `  enterprise-qa-testing Skill must render Execution Preview and obtain explicit user approval first.`
      )
    }
    block(`sentinel read error at ${sentinelPath}: ${e.code || ''} ${e.message}`)
  }

  let sentinel
  try { sentinel = JSON.parse(sentinelRaw) }
  catch (e) { block(`sentinel at ${sentinelPath} is not valid JSON: ${e.message}`) }

  if (sentinel.run_id !== runId) {
    block(`sentinel run_id mismatch: sentinel="${sentinel.run_id}" args="${runId}"`)
  }
  if (!specHashMatches(sentinel.spec_hash, spec)) {
    block(
      `sentinel spec_hash mismatch: sentinel="${sentinel.spec_hash}" recomputed="${recomputed}"\n` +
      `  Spec was modified after approval. Re-render preview and obtain new approval.`
    )
  }

  const approvedAt = Date.parse(sentinel.approved_at)
  if (Number.isNaN(approvedAt)) {
    block(`sentinel.approved_at is not parseable ISO8601: "${sentinel.approved_at}"`)
  }

  let ttl = Number(sentinel.ttl_seconds ?? DEFAULT_TTL_SECONDS)
  if (!Number.isFinite(ttl) || ttl < ABSOLUTE_MIN_TTL) ttl = ABSOLUTE_MIN_TTL
  if (ttl > ABSOLUTE_MAX_TTL) ttl = ABSOLUTE_MAX_TTL

  const ageMs = Date.now() - approvedAt
  if (ageMs > ttl * 1000) {
    block(`preview approval expired (age=${Math.round(ageMs/1000)}s, ttl=${ttl}s). Re-approve.`)
  }
  if (ageMs < 0) {
    block(`sentinel.approved_at is in the future (clock skew?) — ageMs=${ageMs}`)
  }

  // Mode validation.
  const mode = sentinel.mode
  if (!QA_MODES.includes(mode)) {
    block(`sentinel.mode "${mode}" not in allowed QA modes ${JSON.stringify(QA_MODES)}`)
  }
  if (spec.mode && spec.mode !== mode) {
    block(`spec.mode "${spec.mode}" differs from sentinel.mode "${mode}"`)
  }

  // Commercial-cert hard gate: budget approval mandatory.
  if (mode === 'commercial-cert') {
    if (typeof sentinel.approved_estimate_high !== 'number' || sentinel.approved_estimate_high <= 0) {
      block(
        `commercial-cert mode requires sentinel.approved_estimate_high (positive number, tokens).\n` +
        `  Got ${JSON.stringify(sentinel.approved_estimate_high)}.`
      )
    }
    const userText = sentinel.approval_text ?? ''
    const matched = COMMERCIAL_CERT_APPROVAL_PATTERNS.some(re => re.test(userText))
    if (!matched) {
      block(
        `commercial-cert mode requires explicit budget approval text. ` +
        `approval_text="${userText.slice(0, 80)}" did not match required patterns.`
      )
    }
  }

  const ep = (spec && typeof spec._execution_profile === 'object') ? spec._execution_profile : {}
  const profile = `dyn_wf=${spec.allow_dynamic_workflow === true ? 'ALLOWED' : 'off'}` +
    (ep.effort ? ` effort=${ep.effort}` : '') + (ep.speed ? ` speed=${ep.speed}` : '')
  process.stderr.write(
    `[qa-preview-gate] OK: run_id=${runId} mode=${mode} spec_hash=${recomputed} ` +
    `age=${Math.round(ageMs/1000)}s/${ttl}s ${profile}\n`
  )
  allow()
}

main().catch(err => {
  process.stderr.write(`[qa-preview-gate] internal error: ${err.message}\n`)
  process.exit(2)  // fail-closed on unexpected errors
})
