#!/usr/bin/env node
'use strict'
/**
 * provision-tools.js — per-project, demand-driven external-tool provisioning.
 *
 * Invoked by claude-env-bootstrap Step 5c (fresh install) and §8 --update.
 * Skills are markdown; their teeth are external CLIs/packages/credentials. This
 * script reads ~/.claude/manifests/tool-requirements.json, takes the project's
 * SELECTED skills, resolves the union of required tools, and provisions them:
 *
 *   tier=auto        -> AUTO-INSTALL (project-dev into the project, or a global CLI).
 *                       Degrades to a PRINTED command (never silent) when this
 *                       platform has no automatable path.
 *   tier=credential  -> never install; report "set env var X (obtain from Y)".
 *   tier=roe         -> offensive recon / authenticated-DAST / exploitation tool.
 *                       NOT installed unless --provision-offensive OR
 *                       <project>/.claude/bootstrap.config.json.provision_offensive_tools===true.
 *                       Otherwise reported as ROE-time (install at authorized-pentest time).
 *   tier=reference   -> planning-only reference (never executed); NEVER installed.
 *   tier=manual      -> cluster-side / build-plugin / heavy SDK / platform-locked;
 *                       never auto-run, reported with the exact command + reason.
 *
 * REPORT-ONLY: never blocks bootstrap. Always exits 0. Writes a structured
 * <project>/.claude/tool-status.json and prints a human summary.
 *
 * Usage:
 *   node provision-tools.js --project-root . --skills "a,b,c" [--provision-offensive] [--dry-run]
 *   node provision-tools.js --project-root .         # falls back to reading .claude/manifest.json
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const MANIFEST = path.join(__dirname, '..', '..', 'manifests', 'tool-requirements.json')

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  if (i < 0) return def
  const v = process.argv[i + 1]
  return (v && !v.startsWith('--')) ? v : true
}

const PROJECT = path.resolve(arg('project-root', process.cwd()))
const DRY = !!arg('dry-run', false)
let OFFENSIVE = !!arg('provision-offensive', false)

function run(cmd, opts) {
  return execSync(cmd, Object.assign({ stdio: 'pipe', encoding: 'utf8', timeout: 30000 }, opts || {}))
}
function ok(cmd, opts) { try { run(cmd, opts); return true } catch { return false } }

// ---- load tool-requirements manifest ------------------------------------
let M
try { M = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) }
catch (e) {
  console.error('[provision-tools] cannot read tool-requirements.json: ' + (e && e.message))
  process.exit(0) // report-only, never block
}

// ---- resolve the project's selected skills -------------------------------
function selectedSkills() {
  const csv = arg('skills', null)
  if (typeof csv === 'string') return csv.split(',').map(s => s.trim()).filter(Boolean)
  // fallback: parse <project>/.claude/manifest.json, tolerant of array or object shape
  try {
    const pm = JSON.parse(fs.readFileSync(path.join(PROJECT, '.claude', 'manifest.json'), 'utf8'))
    if (Array.isArray(pm.skills)) return pm.skills.map(s => typeof s === 'string' ? s : s && s.name).filter(Boolean)
    if (pm.skills && typeof pm.skills === 'object') return Object.keys(pm.skills)
  } catch {}
  return []
}

// ---- offensive opt-in from project config --------------------------------
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(PROJECT, '.claude', 'bootstrap.config.json'), 'utf8'))
  if (cfg && cfg.provision_offensive_tools === true) OFFENSIVE = true
} catch {}

// ---- detect available package managers / platform ------------------------
const plat = process.platform === 'win32' ? 'win' : (process.platform === 'darwin' ? 'mac' : 'linux')
const MGR = {
  npm: ok('npm --version'),
  pip: ok('pip --version') || ok('python -m pip --version') || ok('python3 -m pip --version'),
  go: ok('go version'),
  cargo: ok('cargo --version'),
  docker: ok('docker --version'),
  winget: ok('winget --version'),
  scoop: ok('scoop --version'),
  choco: ok('choco --version'),
  brew: ok('brew --version'),
  apt: ok('apt-get --version')
}
const hasPkgJson = fs.existsSync(path.join(PROJECT, 'package.json'))

const skills = selectedSkills()
const toolIds = [...new Set(skills.flatMap(s => M.skill_tools[s] || []))]
const consumers = id => skills.filter(s => (M.skill_tools[s] || []).includes(id))

const R = { already: [], installed: [], degraded: [], credentials: [], roe: [], reference: [], manual: [] }

function present(t) { return t.check ? ok(t.check, { cwd: PROJECT, timeout: 30000 }) : false }

function envSatisfied(spec) {
  const vars = (spec || '').match(/[A-Z][A-Z0-9_]{3,}/g) || []
  if (!vars.length) return false
  // "A + B" => all required; "A or B" => any. Heuristic on the connector.
  const anyMode = /\bor\b/i.test(spec)
  const set = vars.filter(v => process.env[v] && process.env[v].length)
  return anyMode ? set.length > 0 : set.length === vars.length
}

function resolveAutoInstall(t) {
  // returns { cmd, mgrOk, cwd } or { degrade: reason }
  const pm = t.pkgmgr
  if (pm === 'npm') {
    if (!MGR.npm) return { degrade: 'npm not found on PATH' }
    const npmCmd = t.install && t.install.npm
    if (npmCmd === 'noop') return { noop: true } // npx-on-demand, no install needed
    if (!hasPkgJson && /npm\s+(install|i)\b/.test(npmCmd || '')) return { degrade: 'no package.json in project yet (run npm init first)' }
    return { cmd: npmCmd, cwd: PROJECT }
  }
  if (pm === 'pip') {
    if (!MGR.pip) return { degrade: 'pip/python not found on PATH' }
    return { cmd: t.install && t.install.pip }
  }
  if (pm === 'go') {
    if (!MGR.go) return { degrade: 'go toolchain not found on PATH' }
    return { cmd: t.install && t.install.go }
  }
  if (pm === 'cargo') {
    if (!MGR.cargo) return { degrade: 'cargo not found on PATH' }
    return { cmd: t.install && t.install.cargo, cwd: (t.scope === 'project-dev' ? PROJECT : undefined) }
  }
  if (pm === 'binary' || pm === 'docker') {
    const cmd = t.install && t.install[plat]
    if (!cmd || /^\s*echo\b/.test(cmd)) return { degrade: 'no automatable install path on ' + plat + ' (see command)' , cmd }
    return { cmd }
  }
  return { degrade: 'unhandled pkgmgr ' + pm }
}

for (const id of toolIds) {
  const t = M.tools[id]
  if (!t) continue
  const cons = consumers(id)

  if (t.tier === 'reference') { R.reference.push({ id, consumers: cons, note: t.note }); continue }

  if (t.tier === 'credential') {
    R.credentials.push({ id, env: t.env, obtain: t.obtain, satisfied: envSatisfied(t.env), need: t.need, consumers: cons })
    continue
  }

  if (t.tier === 'roe' && !OFFENSIVE) {
    const cmd = (t.install && (t.install[plat] || t.install.go || t.install.npm || t.install.pip)) || ''
    R.roe.push({ id, offensive: !!t.offensive, cmd, consumers: cons, note: 'ROE-time install (set provision_offensive_tools=true to auto-install at bootstrap)' })
    continue
  }

  if (t.tier === 'manual') {
    const cmd = (t.install && t.install[plat]) || ''
    R.manual.push({ id, present: present(t), cmd, consumers: cons, note: t.note })
    continue
  }

  // tier === 'auto'  (or roe with OFFENSIVE opt-in)
  if (present(t)) { R.already.push({ id, consumers: cons }); continue }

  const res = resolveAutoInstall(t)
  if (res.noop) { R.already.push({ id, consumers: cons, note: 'used via npx on demand (no install)' }); continue }
  if (res.degrade) { R.degraded.push({ id, reason: res.degrade, cmd: res.cmd || (t.install && t.install[plat]) || '', consumers: cons }); continue }
  if (!res.cmd) { R.degraded.push({ id, reason: 'no install command for pkgmgr ' + t.pkgmgr, consumers: cons }); continue }

  if (DRY) { R.installed.push({ id, cmd: res.cmd, dry: true, consumers: cons }); continue }

  try {
    run(res.cmd, { cwd: res.cwd || process.cwd(), timeout: 600000, stdio: 'pipe' })
    if (present(t)) R.installed.push({ id, cmd: res.cmd, consumers: cons })
    else R.installed.push({ id, cmd: res.cmd, consumers: cons, note: 'install ran; post-check could not confirm (may need shell reload / PATH refresh)' })
  } catch (e) {
    const tail = ((e && (e.stderr || e.stdout || e.message)) || '').toString().split('\n').slice(-3).join(' ').slice(0, 240)
    R.degraded.push({ id, reason: 'install failed: ' + tail, cmd: res.cmd, consumers: cons })
  }
}

// ---- write structured status + human report -----------------------------
const status = {
  generated_at_note: 'written by provision-tools.js (per-project tool provisioning)',
  project: PROJECT, platform: plat, managers: MGR,
  offensive_provisioning: OFFENSIVE, dry_run: DRY,
  selected_skills: skills, resolved_tools: toolIds.length, result: R
}
try {
  fs.mkdirSync(path.join(PROJECT, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(PROJECT, '.claude', 'tool-status.json'), JSON.stringify(status, null, 2))
} catch (e) { /* report-only */ }

const L = []
L.push('## Tool provisioning — ' + PROJECT)
L.push('Platform: ' + plat + ' | managers: ' + Object.entries(MGR).map(([k, v]) => k + (v ? '✓' : '✗')).join(' '))
L.push('Selected skills: ' + skills.length + ' | tools resolved: ' + toolIds.length + (DRY ? ' | DRY-RUN' : '') + (OFFENSIVE ? ' | OFFENSIVE-PROVISIONING-ON' : ''))
const line = (it) => '   - ' + it.id + (it.cmd ? '  →  ' + it.cmd : '') + (it.reason ? '  ('+it.reason+')' : '') + (it.consumers && it.consumers.length ? '  [' + it.consumers.join(', ') + ']' : '')
if (R.installed.length) { L.push(''); L.push((DRY ? '⬇ Would install (' : '⬇ Installed now (') + R.installed.length + '):'); R.installed.forEach(i => L.push(line(i))) }
if (R.already.length) { L.push(''); L.push('✓ Already present (' + R.already.length + '): ' + R.already.map(i => i.id).join(', ')) }
if (R.degraded.length) { L.push(''); L.push('⚠ Could not auto-install (' + R.degraded.length + ') — run yourself:'); R.degraded.forEach(i => L.push(line(i))) }
if (R.credentials.length) { L.push(''); L.push('🔑 Credentials to set (' + R.credentials.length + '):'); R.credentials.forEach(i => L.push('   - ' + i.env + (i.satisfied ? ' ✓set' : ' ✗missing') + '  (obtain: ' + i.obtain + ')  [' + i.consumers.join(', ') + ']')) }
if (R.roe.length) { L.push(''); L.push('🛡 ROE-time offensive tools (' + R.roe.length + ') — NOT installed (provision_offensive_tools=false):'); R.roe.forEach(i => L.push(line(i))) }
if (R.manual.length) { L.push(''); L.push('🔧 Manual / cluster-side (' + R.manual.length + ') — run yourself when needed:'); R.manual.forEach(i => L.push(line(i) + (i.present ? '  (already present)' : ''))) }
if (R.reference.length) { L.push(''); L.push('📖 Reference-only (' + R.reference.length + ') — never installed: ' + R.reference.map(i => i.id).join(', ')) }
L.push('')
L.push('Status written to .claude/tool-status.json. Re-run after installing a package manager / setting a credential.')
console.log(L.join('\n'))

process.exit(0)
