#!/usr/bin/env node
/**
 * appsec-preview-gate.js — PreToolUse hook for Workflow({name:'appsec-orchestrator'})
 *
 * Per overview.txt caveat 2, 8, 10:
 * - Block Workflow launch when no preview was approved for current (run_id, spec_hash).
 * - Sentinel binds BOTH run_id AND spec_hash (not just run_id).
 * - TTL check via Date.now() - approved_at_ms (this hook IS allowed Date.now —
 *   workflow body bans are only inside the workflow JS, not hooks).
 *
 * Install via project settings.json (NOT user-global per overview.txt):
 *   {
 *     "hooks": {
 *       "PreToolUse": [
 *         {
 *           "matcher": "Workflow",
 *           "hooks": [
 *             { "type": "command",
 *               "command": "node .claude/hooks/appsec-preview-gate.js" }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 *
 * Exit codes:
 *   0 — allow (not our concern, or valid sentinel)
 *   2 — block (with explanation on stderr)
 *
 * Sentinel file shape (written by Skill main thread after user approval):
 *   <project>/.appsec/state/preview-approved/<run_id>.json
 *   {
 *     "run_id": "v3.2.1-pre-release",
 *     "spec_hash": "a1b2c3d4",
 *     "preview_hash": "e5f6g7h8",
 *     "approved_at": "2026-05-28T04:20:59.123Z",
 *     "approval_text": "跑",
 *     "ttl_seconds": 300
 *   }
 */

'use strict'

const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const DEFAULT_TTL_SECONDS = 300
const ABSOLUTE_MAX_TTL    = 3600  // 1 hour cap regardless of file value
const ABSOLUTE_MIN_TTL    = 30    // floor

// Adversarial-finding hardening (2026-05-29): legacy djb2 is a 32-bit non-crypto hash with
// collision-feasible spec substitution. Its accept-during-transition path is now SUNSET — after
// DJB2_SUNSET only canonical sha256: is accepted (mirroring qa-preview-gate, sha256-only from start).
// ★ R3 (2026-06-14): sunset ACCELERATED to today. djb2 is a 32-bit non-crypto hash with
// demonstrated collision feasibility (adversarial sweep confirmed "t1r"/"t30" collide); during a
// hardening pass there is no reason to keep accepting it. sha256-only from now (matches qa-preview-gate).
const DJB2_SUNSET_MS = Date.parse('2026-06-14T00:00:00Z')

// ─── spec hash helpers ──────────────────────────────────────────────────
// §1.11 correction #3 (2026-05-28): spec_hash migrated from djb2 → SHA-256.
// All stored values use `sha256:` prefix. During the transition window the
// hook ALSO accepts legacy `djb2:`-prefixed values AND bare 8-hex legacy
// values (for backward-compat with existing sentinels / args produced
// before migration).
//
// Codex C1: hook MUST recompute spec_hash from args.spec to prevent
// approve-A-run-B (caller submits a spec hash that doesn't match args.spec).
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
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}
function computeSpecHash(spec) {
  // New canonical: sha256: prefix
  return 'sha256:' + sha256Hex(stableStringify(spec))
}
// Compute legacy djb2 form for accept-during-transition.
function computeSpecHashLegacyDjb2(spec) {
  return djb2(stableStringify(spec))
}
// Compare two spec_hash representations tolerantly during transition.
// Returns true if `claimed` equals either:
//   - canonical sha256 form computed from spec, OR
//   - legacy djb2 bare 8-hex form, OR
//   - legacy djb2: prefixed form
function specHashMatches(claimed, spec) {
  if (typeof claimed !== 'string') return false
  const canonical = computeSpecHash(spec)
  if (claimed === canonical) return true
  // Legacy djb2 — accepted ONLY before the sunset (2026-06-15), for in-flight legacy sentinels.
  // After sunset: sha256: only. djb2 is collision-feasible; do not accept indefinitely.
  if (Date.now() < DJB2_SUNSET_MS) {
    const legacy = computeSpecHashLegacyDjb2(spec)
    if (claimed === legacy) return true
    if (claimed === 'djb2:' + legacy) return true
  }
  return false
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
  process.stderr.write(`[appsec-preview-gate] BLOCKED: ${reason}\n`)
  process.exit(2)
}

function allow() { process.exit(0) }

async function main() {
  let payload
  try {
    payload = await readStdinJSON()
  } catch (e) {
    block(`stdin read error: ${e.message}`)
    return
  }

  if (!payload || typeof payload !== 'object') {
    // Codex: empty stdin for a security gate should be fail-closed.
    block('empty or non-object stdin payload (expected Claude Code PreToolUse JSON)')
  }

  const toolName  = payload.tool_name
  const toolInput = payload.tool_input ?? {}

  // Only gate Workflow tool calls.
  if (toolName !== 'Workflow') return allow()

  // Only gate appsec-orchestrator (named or scriptPath ending with it).
  const targetsAppsec =
    toolInput.name === 'appsec-orchestrator' ||
    (typeof toolInput.scriptPath === 'string' && /appsec-orchestrator\.js$/.test(toolInput.scriptPath))

  if (!targetsAppsec) return allow()

  const wfArgs = toolInput.args ?? {}
  const runId  = wfArgs.run_id
  const claimedSpecHash = wfArgs.spec_hash
  const spec = wfArgs.spec

  if (!runId || typeof runId !== 'string') {
    block(`Workflow launch missing args.run_id`)
  }
  if (!claimedSpecHash || typeof claimedSpecHash !== 'string') {
    block(`Workflow launch missing args.spec_hash`)
  }
  if (!spec || typeof spec !== 'object') {
    block(`Workflow launch missing args.spec (required to recompute spec_hash for verification)`)
  }
  // ★ R3 hardening — structural spec validation, symmetric with qa-preview-gate (which checks
  // spec.orchestrator) and with what appsec-orchestrator.js itself requires. A structurally-empty
  // spec ({}) must NOT pass the gate even if a matching sentinel exists (the gate is the earlier,
  // defense-in-depth backstop). orchestrator + non-empty phases are the minimum real-spec markers.
  if (spec.orchestrator !== 'appsec') {
    block(`spec.orchestrator must be "appsec" (got "${spec.orchestrator}") — structurally-invalid spec rejected`)
  }
  if (!Array.isArray(spec.phases) || spec.phases.length === 0) {
    block(`spec.phases must be a non-empty array — an empty/structurally-invalid spec cannot drive a gate`)
  }

  // Governed Gate Mode (2026-05-29): a deterministic AppSec gate launch must not enable
  // model-authored Dynamic Workflows. They may only scout; the gate verdict comes from this
  // deterministic spec-runner. allow_dynamic_workflow is part of spec → bound into spec_hash.
  // ★ R3 hardening — strict-equality `=== true` was bypassed by non-boolean truthy values
  // ("true" / 1 / {enabled:true}). A governed spec's flag must be boolean false or omitted; ANY other
  // present value (including a "false" string) is non-canonical and rejected with a clear message.
  if ('allow_dynamic_workflow' in spec && spec.allow_dynamic_workflow !== false) {
    block(`Governed Gate Mode: spec.allow_dynamic_workflow must be boolean false or omitted ` +
          `(got ${JSON.stringify(spec.allow_dynamic_workflow)}). Dynamic Workflows may scout outside the gate only. See CLAUDE.md §3.7.`)
  }

  // Codex C1: recompute spec_hash from args.spec.
  // Verify caller's claim matches AND matches sentinel.
  // §1.11 correction #3: accept both new sha256: and legacy djb2 during transition.
  if (!specHashMatches(claimedSpecHash, spec)) {
    const canonical = computeSpecHash(spec)
    block(`args.spec_hash="${claimedSpecHash}" but recomputed from args.spec="${canonical}" ` +
          `(or legacy djb2). Caller either lied about spec_hash or used a different hash algorithm.`)
  }
  // Use canonical form for downstream sentinel comparison.
  const recomputed = computeSpecHash(spec)

  // Resolve project root via cwd (hook runs in project root per Claude Code hooks docs).
  const projectRoot = process.cwd()
  const safeId = runId.replace(/[^A-Za-z0-9._-]/g, '_')  // path-safe
  const sentinelPath = path.join(projectRoot, '.appsec', 'state', 'preview-approved', `${safeId}.json`)

  // Codex H3: collapse exists+read into a single try/catch to remove TOCTOU.
  let sentinelRaw
  try {
    sentinelRaw = fs.readFileSync(sentinelPath, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') {
      block(`no preview-approval sentinel at ${sentinelPath}\n` +
            `  Skill must render Execution Preview and obtain explicit user approval first.`)
    }
    block(`sentinel read error at ${sentinelPath}: ${e.code || ''} ${e.message}`)
  }
  let sentinel
  try {
    sentinel = JSON.parse(sentinelRaw)
  } catch (e) {
    block(`sentinel at ${sentinelPath} is not valid JSON: ${e.message}`)
  }

  if (sentinel.run_id !== runId) {
    block(`sentinel run_id mismatch: sentinel="${sentinel.run_id}" args="${runId}"`)
  }
  // §1.11 correction #3: sentinel may carry legacy djb2 (bare or prefixed) OR
  // new sha256: form. specHashMatches tolerates both.
  if (!specHashMatches(sentinel.spec_hash, spec)) {
    block(`sentinel spec_hash mismatch: sentinel="${sentinel.spec_hash}" recomputed canonical="${recomputed}"\n` +
          `  Spec was modified after approval. Re-render preview and obtain new approval.`)
  }

  const approvedAt = Date.parse(sentinel.approved_at)
  if (Number.isNaN(approvedAt)) {
    block(`sentinel.approved_at is not parseable ISO8601: "${sentinel.approved_at}"`)
  }

  let ttl = Number(sentinel.ttl_seconds ?? DEFAULT_TTL_SECONDS)
  if (!Number.isFinite(ttl) || ttl < ABSOLUTE_MIN_TTL) ttl = ABSOLUTE_MIN_TTL
  if (ttl > ABSOLUTE_MAX_TTL) ttl = ABSOLUTE_MAX_TTL

  const ageMs = Date.now() - approvedAt
  if (ageMs >= ttl * 1000) {  // ★ R3 — >= so the exact-TTL boundary is expired (no off-by-one extension)
    block(`preview approval expired (age=${Math.round(ageMs/1000)}s, ttl=${ttl}s). Re-approve.`)
  }
  if (ageMs < 0) {
    block(`sentinel.approved_at is in the future (skew? clock issue?) — ageMs=${ageMs}`)
  }

  // All checks passed.
  const ep = (spec && typeof spec._execution_profile === 'object') ? spec._execution_profile : {}
  const profile = `dyn_wf=${spec.allow_dynamic_workflow === true ? 'ALLOWED' : 'off'}` +
    (ep.effort ? ` effort=${ep.effort}` : '') + (ep.speed ? ` speed=${ep.speed}` : '')
  process.stderr.write(
    `[appsec-preview-gate] OK: run_id=${runId} spec_hash=${recomputed} ` +
    `age=${Math.round(ageMs/1000)}s/${ttl}s ${profile}\n`
  )
  allow()
}

main().catch(err => {
  process.stderr.write(`[appsec-preview-gate] internal error: ${err.message}\n`)
  process.exit(2)  // fail-closed on unexpected errors
})
