#!/usr/bin/env node
/**
 * governed-gate-workflow-guard.js — PreToolUse[Workflow] hook (Governed Gate Mode, 2026-05-29)
 *
 * Closes the hole the domain preview-gates leave open. appsec-preview-gate /
 * qa-preview-gate only gate launches that target their orchestrator by `name`
 * or `scriptPath` (`if (!targetsX) return allow()`). An INLINE model-authored
 * `script` Workflow launch (a Dynamic Workflow / ultracode auto-orchestration)
 * has neither, so it slips straight past them. In a governed project during an
 * active gate, such a launch could mint a shadow "release verdict" outside the
 * spec_hash + evidence chain. This guard blocks exactly that.
 *
 * Governance contract: CLAUDE.md §3.7 Governed Gate Mode. Mechanism (Dynamic
 * Workflows for exploration/migration/research) belongs to the platform; the gate
 * VERDICT belongs to the deterministic spec-runner + human spec_hash approval.
 *
 * Behavior:
 *   - NO-OP (exit 0) unless cwd is inside a governed project (.appsec/config.json
 *     or .qa/config.json found walking up). Normal ultracode / exploration in
 *     non-governed projects is never touched.
 *   - Launch via `name` or `scriptPath` (deterministic runner / reviewed saved
 *     workflow) → allow. The domain preview-gates + saved-workflow review own those.
 *   - Launch via inline `script` (Dynamic Workflow) → governed_gate_mode decides:
 *       "off"          → allow (advisory note on stderr)
 *       "active-gate"  → block IFF a gate is active (unexpired preview sentinel or
 *                        <domain>/state.json gate_active===true); else allow+advise.  [DEFAULT]
 *       "always"       → block
 *   - resumeFromRunId-only / empty (no script/scriptPath/name) → allow.
 *
 * Config (.appsec/config.json and/or .qa/config.json):
 *   "governed_gate_mode": "off" | "active-gate" | "always"   (default "active-gate")
 *   When both domains present, the STRICTER mode wins.
 *
 * Install (project-scoped, via appsec-sdk init / qa-sdk init):
 *   <project>/.claude/settings.json PreToolUse[matcher:"Workflow"]:
 *     { "type":"command", "command":"node .claude/hooks/governed-gate-workflow-guard.js" }
 *
 * Exit: 0 allow · 2 block. (Date.now()/fs OK inside a hook — workflow-body bans
 * apply only inside workflow JS, not hooks.)
 */

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const TTL_DEFAULT = 300
const TTL_MIN = 30
const TTL_MAX = 3600
const MODES = ['off', 'active-gate', 'always']
const STRICTNESS = { off: 0, 'active-gate': 1, always: 2 }

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

// Walk up from `start` (max 12 levels) looking for a relative marker file.
function findUp(start, rel) {
  let dir
  try { dir = path.resolve(start) } catch { return null }
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, rel))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

// Resolve the on-disk file a name/scriptPath launch points at (best-effort).
// scriptPath: expand a leading ~, resolve relative to cwd. name: ~/.claude/workflows/<name>.js.
function resolveWorkflowFile(ti) {
  let p = ''
  if (typeof ti.scriptPath === 'string' && ti.scriptPath) p = ti.scriptPath
  else if (typeof ti.name === 'string' && ti.name) p = path.join(os.homedir(), '.claude', 'workflows', ti.name + '.js')
  if (!p) return null
  if (p[0] === '~') p = path.join(os.homedir(), p.slice(1).replace(/^[\\/]+/, ''))
  try { return path.resolve(p) } catch { return null }
}

// A saved workflow may drive a gate verdict ONLY if its @governance header declares
// release_gate_allowed: true (see workflows/README.md). Read the header directly from the file.
function governanceReleaseAllowed(file) {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 4096)
    return /release_gate_allowed\s*:\s*true/i.test(head)
  } catch { return false }
}

// Extract an explicit mode from config; tolerant of string or {scope/mode/...} object.
function modeFromConfig(cfg) {
  if (!cfg) return null
  let m = cfg.governed_gate_mode
  if (m && typeof m === 'object') m = m.mode || m.scope || m.block_inline_dynamic_workflows
  if (typeof m === 'string' && MODES.includes(m)) return m
  return null
}

// A gate is "active" when <domain>/state.json gate_active===true OR an unexpired
// preview sentinel exists under <domain>/<sentinelSub>/. Mirrors preview-gate TTL.
function gateActive(root, domainDir, sentinelSub) {
  const st = readJSON(path.join(root, domainDir, 'state.json'))
  if (st && st.gate_active === true) return true
  const dir = path.join(root, domainDir, sentinelSub)
  let entries
  try { entries = fs.readdirSync(dir) } catch { return false }
  const now = Date.now()
  for (const f of entries) {
    if (!f.endsWith('.json')) continue
    const s = readJSON(path.join(dir, f))
    if (!s) continue
    const at = Date.parse(s.approved_at)
    if (Number.isNaN(at)) continue
    let ttl = Number(s.ttl_seconds)
    if (!Number.isFinite(ttl) || ttl < TTL_MIN) ttl = (ttl === 0 ? 0 : TTL_DEFAULT)
    if (ttl < TTL_MIN) ttl = TTL_MIN
    if (ttl > TTL_MAX) ttl = TTL_MAX
    const age = now - at
    if (age >= 0 && age <= ttl * 1000) return true
  }
  return false
}

function block(reason) {
  process.stderr.write(`[governed-gate-guard] BLOCKED: ${reason}\n`)
  process.exit(2)
}
function allow(note) {
  if (note) process.stderr.write(`[governed-gate-guard] ${note}\n`)
  process.exit(0)
}

function main() {
  const cwd = process.cwd()

  // Domain detection (standalone — no dependency on _appsec-common / _qa-common,
  // so the guard works even if those are not wired in this project).
  const appsecRoot = findUp(cwd, path.join('.appsec', 'config.json'))
  const qaRoot = findUp(cwd, path.join('.qa', 'config.json'))
  if (!appsecRoot && !qaRoot) return allow()  // non-governed project → silent NO-OP

  // Matcher already restricts to Workflow. In a governed project, fail-closed on a
  // payload we cannot read.
  const raw = readStdin()
  let payload
  try { payload = JSON.parse(raw || '{}') }
  catch { block('unparseable PreToolUse payload in a governed project (fail-closed).') }
  if (!payload || typeof payload !== 'object') {
    block('empty/non-object PreToolUse payload in a governed project (fail-closed).')
  }

  if (payload.tool_name !== 'Workflow') return allow()  // defensive; matcher should guarantee Workflow
  const ti = payload.tool_input || {}

  const hasName = typeof ti.name === 'string' && ti.name.length > 0
  const hasScriptPath = typeof ti.scriptPath === 'string' && ti.scriptPath.length > 0
  // ★ R3 hardening (Codex cross-review) — an inline `script` of ANY present non-empty value (string,
  // object, array) is an inline Dynamic Workflow and must be inspected fail-closed; do not require it
  // to be a non-empty string (an object/array script would otherwise slip past as "not inline").
  const hasInlineScript = ('script' in ti) && ti.script != null &&
    !(typeof ti.script === 'string' && ti.script.trim().length === 0)

  // Is a gate actually in progress right now? (unexpired preview sentinel or state.gate_active)
  let active = false
  if (appsecRoot) active = active || gateActive(appsecRoot, '.appsec', path.join('state', 'preview-approved'))
  if (qaRoot)     active = active || gateActive(qaRoot, '.qa', path.join('state', 'preview'))

  // Saved-workflow / deterministic-runner launches (name or scriptPath). The domain preview-gates
  // own the spec_hash/sentinel check for the real runner. NEW (2026-06-10, closes the README's
  // documentation-only gap): during an ACTIVE gate, a saved workflow launchable by name/scriptPath
  // whose @governance header does NOT declare `release_gate_allowed: true` must not run — it could
  // print a shadow "verdict" while a gate is in progress. Fail-open on an unreadable / ~-unresolved
  // path (the domain preview-gate is the backstop for the real runner).
  if ((hasName || hasScriptPath) && !hasInlineScript) {
    // ★ R3 hardening (2026-06-14) — only take the name/scriptPath fast-path when there is NO inline
    // script. A payload carrying BOTH a benign `name` AND an inline `script` previously early-returned
    // here, leaving the Dynamic Workflow script un-inspected. An inline script must DOMINATE — fall
    // through to the inline-script governance below when one is present.
    if (active) {
      const wfFile = resolveWorkflowFile(ti)
      if (wfFile && fs.existsSync(wfFile) && !governanceReleaseAllowed(wfFile)) {
        block(
          'saved Workflow launched by ' + (hasScriptPath ? 'scriptPath' : 'name') + ' during an ACTIVE governed gate, ' +
          'but its @governance header does not declare `release_gate_allowed: true` (' + wfFile + '). Only a ' +
          'human-reviewed deterministic spec-runner may run during a gate. See CLAUDE.md §3.7 + workflows/README.md.'
        )
      }
    }
    return allow()
  }
  if (!hasInlineScript) return allow()

  // Inline model-authored script = Dynamic Workflow. Strictest mode across present domains.
  let mode = 'active-gate'
  const cfgs = []
  if (appsecRoot) cfgs.push(readJSON(path.join(appsecRoot, '.appsec', 'config.json')))
  if (qaRoot)     cfgs.push(readJSON(path.join(qaRoot, '.qa', 'config.json')))
  const explicit = cfgs.map(modeFromConfig).filter(Boolean)
  if (explicit.length) mode = explicit.reduce((a, b) => (STRICTNESS[b] > STRICTNESS[a] ? b : a))

  // Hardening (2026-05-29 adversarial finding): a bare governed_gate_mode="off" is a silent
  // single-key opt-out. Honor "off" ONLY when an explicit justification reason is present
  // (governed_gate_mode_off_reason, non-empty string); otherwise fail-SAFE to active-gate.
  if (mode === 'off') {
    const justified = cfgs.some(c => c && typeof c.governed_gate_mode_off_reason === 'string' && c.governed_gate_mode_off_reason.trim().length > 0)
    if (!justified) {
      process.stderr.write('[governed-gate-guard] governed_gate_mode="off" IGNORED — no governed_gate_mode_off_reason justification in config; failing safe to active-gate.\n')
      mode = 'active-gate'
    }
  }

  const baseMsg =
    'inline model-authored Workflow `script` (Dynamic Workflow / ultracode auto-orchestration) ' +
    'in a governed project. Dynamic Workflows may SCOUT but must not drive a gate verdict — route ' +
    'findings back through the deterministic spec-runner (qa-orchestrator.js / appsec-orchestrator.js) ' +
    'with spec_hash approval + evidence bundle. See CLAUDE.md §3.7.'

  if (mode === 'off') return allow('advisory: ' + baseMsg + ' [governed_gate_mode=off]')
  if (mode === 'always') block(baseMsg + ' [governed_gate_mode=always]')

  // active-gate (default): block only while a gate is actually in progress (computed above).
  if (active) block(baseMsg + ' [governed_gate_mode=active-gate; an approved gate is in progress]')
  return allow('advisory: ' + baseMsg + ' [governed_gate_mode=active-gate; no active gate — allowed, but DO NOT present this as a gate verdict]')
}

try {
  main()
} catch (e) {
  // Fail-closed: an unexpected throw inside a governed-gate guard must NOT fall through to Node's
  // default handler (exit 1 = non-blocking). In a governed project we cannot prove the launch is safe.
  process.stderr.write(`[governed-gate-guard] internal error (fail-closed): ${e && e.message ? e.message : e}\n`)
  process.exit(2)
}
