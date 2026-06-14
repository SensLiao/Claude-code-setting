// _uiux-common — shared helpers for uiux-product-orchestrator v2.1 hooks.
// Centralizes: project root resolution, config loading, fail-closed preflight,
// L3 skill recognition, workflow skill blacklist, GSD command recognition,
// release tag discovery, decision file lookup.
//
// Contract: SKILL.md §3-§7. PreToolUse hooks: stderr + process.exit(2) to block.
// Stop hooks: emitStopBlock(reason) + process.exit(0). Never use async.

'use strict';

const fs = require('fs');
const path = require('path');

// ───── stdin / input ─────

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function readInputSafe() {
  const raw = readStdinSync();
  if (!raw) return { input: {}, parseError: null };
  try { return { input: JSON.parse(raw), parseError: null }; }
  catch (e) { return { input: null, parseError: e.message || 'JSON parse failed' }; }
}

// ───── project root + config ─────

function findProjectRoot(start) {
  if (!start) return null;
  let dir;
  try { dir = path.resolve(start); } catch { return null; }
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, '.uiux', 'config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function loadConfig(cwdHint) {
  const projectRoot = findProjectRoot(cwdHint || process.cwd());
  if (!projectRoot) return { config: null, projectRoot: null, error: 'absent' };
  const cfgPath = path.join(projectRoot, '.uiux', 'config.json');
  let raw;
  try { raw = fs.readFileSync(cfgPath, 'utf8'); }
  catch { return { config: null, projectRoot, error: 'unreadable' }; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { config: null, projectRoot, error: 'malformed' }; }
  return { config: parsed, projectRoot, error: null };
}

function loadPlanningConfig(projectRoot) {
  if (!projectRoot) return null;
  const cfgPath = path.join(projectRoot, '.planning', 'config.json');
  if (!fs.existsSync(cfgPath)) return null;
  try { return JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { return null; }
}

function getActiveReleaseTag(projectRoot) {
  if (!projectRoot) return null;
  const statePath = path.join(projectRoot, '.uiux', 'state.json');
  if (!fs.existsSync(statePath)) return null;
  try {
    const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (s && typeof s.active_release_tag === 'string' && s.active_release_tag) return s.active_release_tag;
  } catch {}
  return null;
}

// Standard preflight for all uiux hooks.
// Returns:
//   { mode: 'silent' }                          — non-uiux project; silent-exit 0
//   { mode: 'fail-closed', reason }             — malformed config; block on PreToolUse
//   { mode: 'warn', config, projectRoot }       — strict_mode=lax
//   { mode: 'strict', config, projectRoot }     — strict_mode=strict (default)
function preflight(input) {
  const cwd = (input && input.cwd) || process.cwd();
  const { config, projectRoot, error } = loadConfig(cwd);
  if (error === 'absent') return { mode: 'silent' };
  if (error === 'malformed' || error === 'unreadable') {
    return { mode: 'fail-closed', projectRoot, reason: `.uiux/config.json ${error}` };
  }
  const sm = (config.strict_mode || 'strict').toLowerCase();
  if (sm === 'lax' || sm === 'warn') return { mode: 'warn', config, projectRoot };
  return { mode: 'strict', config, projectRoot };
}

// ───── last-assistant-text extraction (Stop-hook payload + transcript fallback) ─────
//
// Stop-hook payloads on current Claude Code carry session_id / transcript_path /
// stop_hook_active and DO NOT carry the assistant's final message inline. The Stop
// branch of uiux-release-guard must scan the final assistant turn for completion
// claims, so it falls back to the JSONL transcript when no inline field is present.
//
// Mirrors _appsec-common.js readLastAssistantText (kept as a local copy because the
// installer copies _uiux-common.js — not _appsec-common.js — into <project>/.claude/hooks/,
// so a cross-require would dangle at runtime). Returns string when found, else null. Never throws.
function _textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const c of content) {
      if (c && typeof c.text === 'string') parts.push(c.text);
    }
    return parts.join('\n');
  }
  return '';
}

function readLastAssistantText(payload, maxKB) {
  const cap = (typeof maxKB === 'number' && maxKB > 0 ? maxKB : 256) * 1024;
  if (payload) {
    if (typeof payload.last_assistant_message === 'string' && payload.last_assistant_message) {
      return payload.last_assistant_message;
    }
    if (typeof payload.assistant_message === 'string' && payload.assistant_message) {
      return payload.assistant_message;
    }
    if (typeof payload.transcript_excerpt === 'string' && payload.transcript_excerpt) {
      return payload.transcript_excerpt;
    }
    if (Array.isArray(payload.messages)) {
      for (let i = payload.messages.length - 1; i >= 0; i--) {
        const m = payload.messages[i];
        if (m && m.role === 'assistant') {
          const t = _textFromContent(m.content);
          if (t) return t;
        }
      }
    }
  }
  const tp = payload && typeof payload.transcript_path === 'string' ? payload.transcript_path : '';
  if (!tp) return null;
  let content;
  try {
    if (!fs.existsSync(tp)) return null;
    const stat = fs.statSync(tp);
    const start = Math.max(0, stat.size - cap);
    const fd = fs.openSync(tp, 'r');
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      content = buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch { return null; }
  const lines = content.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || line[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const role = obj.role || obj.type || (obj.message && obj.message.role);
    if (role !== 'assistant') continue;
    const msg = obj.message || obj;
    const t = _textFromContent(msg.content != null ? msg.content : msg.text);
    if (t) return t;
  }
  return null;
}

// ───── L3 + workflow recognition ─────

// Canonical L3 family names → list of skill ids that map into that family.
// Current set (2026-06-10): taste / luxury / brutalist only.
// minimalist / soft / gpt-tasteskill were folded into taste-skill §11 variant modes (A/B/C) and deleted.
const L3_FAMILIES = {
  taste:           ['taste-skill', 'taste'],
  luxury:          ['luxury', 'luxury-editorial-site-builder'],
  brutalist:       ['brutalist-skill', 'brutalist'],
};

// Two-layer workflow-skill policy (split 2026-06-10 to stop the mutex hook from
// blocking the v2.3 engine's own pre-lock EXPLORE/import path — combination-policy.md
// P1 EXPLORE is an intentionally LOCK-FREE sampling window).
//
// NEVER_LOCKABLE — workflow skills that can NEVER be the L3 style itself
//   (style-lock-policy.md §5). The SDK lock.style command refuses these. Kept as the
//   superset for documentation/export parity. (The bash SDK keeps its own copy of this
//   list at lock.style; this set is the JS-side mirror.)
const NEVER_LOCKABLE = new Set([
  'redesign-skill', 'image-to-code-skill',
  'frontend-design', 'frontend-design@claude-plugins-official',
  'anchor-prototype-wave', 'sens-frontend-design', 'prototyping-ui-directions',
]);

// BLOCK_BEFORE_LOCK — the SUBSET the mutex hook Case 1 refuses while no L3 is locked
//   ("decide style first"). These are POST-lock production workflows (upgrade an
//   existing UI / mass-produce surfaces) that only make sense AFTER a style exists.
//   Deliberately EXCLUDES the pre-lock-legal flows:
//     - prototyping-ui-directions : P1 EXPLORE multi-direction sampler (runs lock-free)
//     - image-to-code-skill       : screenshot/reference/DESIGN.md import (can seed a lock)
//     - sens-frontend-design      : 3-stage proposal (legitimate pre-lock exploration)
//   These three stay NEVER_LOCKABLE (can't BE the style) but are NOT blocked pre-lock.
const BLOCK_BEFORE_LOCK = new Set([
  'redesign-skill',
  'frontend-design', 'frontend-design@claude-plugins-official',
  'anchor-prototype-wave',
]);

// Back-compat alias: existing import sites used WORKFLOW_NOT_STYLE for the "can't be L3"
// meaning — that semantic now lives in NEVER_LOCKABLE.
const WORKFLOW_NOT_STYLE = NEVER_LOCKABLE;

function skillToL3Family(skillName) {
  if (!skillName) return null;
  const norm = String(skillName).trim().toLowerCase().replace(/^skill:/, '').replace(/^\/+/, '');
  for (const [family, ids] of Object.entries(L3_FAMILIES)) {
    if (ids.some(id => id.toLowerCase() === norm)) return family;
  }
  return null;
}

// True if the skill can never be the L3 style itself (SDK lock.style refusal semantic).
function isWorkflowSkill(skillName) {
  if (!skillName) return false;
  const norm = String(skillName).trim().toLowerCase().replace(/^skill:/, '').replace(/^\/+/, '');
  return NEVER_LOCKABLE.has(norm);
}

// True if the mutex hook should block this skill while NO L3 is locked yet
// (post-lock-only production workflow). Pre-lock exploration/import skills return false.
function isBlockBeforeLock(skillName) {
  if (!skillName) return false;
  const norm = String(skillName).trim().toLowerCase().replace(/^skill:/, '').replace(/^\/+/, '');
  return BLOCK_BEFORE_LOCK.has(norm);
}

// ───── GSD command recognition ─────

// Heuristic: was this Skill / command invocation a GSD command?
function getInvokedSkillName(input) {
  if (!input) return null;
  // Skill matcher format: tool_input.skill or tool_input.name
  const ti = input.tool_input || {};
  return (
    ti.skill || ti.name || ti.skill_name ||
    input.skill_name || input.command || null
  );
}

function isGsdCommand(name, ...candidates) {
  if (!name) return false;
  const n = String(name).toLowerCase().replace(/^\/+/, '');
  return candidates.some(c => n === c || n.startsWith(c + ' ') || n.startsWith(c + ':'));
}

// ───── style-lock state ─────

function readStyleLockFamily(projectRoot) {
  if (!projectRoot) return null;
  const lockPath = path.join(projectRoot, '.uiux', 'lock', 'style-lock.yaml');
  if (!fs.existsSync(lockPath)) return null;
  try {
    const txt = fs.readFileSync(lockPath, 'utf8');
    // ★ R3 hardening (2026-06-14) — col-0 ONLY + dup guard: a nested `  l3_style:` decoy or a
    // duplicate must not corrupt the locked-family read (was `^[ \t]{0,4}` + first-match — the same
    // fail-open class fixed in the SDK's extract_scalar; this hook-side impl had not been synced).
    const all = txt.match(/^l3_style[ \t]*:[ \t]*(.+)$/gim) || [];
    if (all.length === 1) {
      const m = all[0].match(/^l3_style[ \t]*:[ \t]*(.+)$/i);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '').toLowerCase();
    }
  } catch {}
  return null;
}

// ───── release decision lookup ─────

function findReleaseDecision(projectRoot, tag) {
  if (!projectRoot || !tag) return null;
  const p = path.join(projectRoot, '.uiux', 'decisions', tag, 'uiux_release_decision.yaml');
  if (!fs.existsSync(p)) return null;
  try {
    const txt = fs.readFileSync(p, 'utf8');
    // ★ R3 hardening — col-0 ONLY (a nested `  decision:` decoy is not the release decision).
    const m = txt.match(/^decision[ \t]*:[ \t]*(\w+)/mi);
    return m ? { path: p, decision: m[1].toUpperCase() } : { path: p, decision: 'UNKNOWN' };
  } catch { return null; }
}

// ───── UI-SPEC presence for a phase ─────

function findUiSpecForPhase(projectRoot, phase) {
  if (!projectRoot || !phase) return null;
  const phasesDir = path.join(projectRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // Match dir starting with phase (e.g. "01" or "01-dashboard")
      if (e.name === phase || e.name.startsWith(phase + '-') || e.name.startsWith(phase + '_')) {
        const dir = path.join(phasesDir, e.name);
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (/UI-SPEC\.md$/.test(item)) {
            return path.join(dir, item);
          }
        }
      }
    }
  } catch {}
  return null;
}

// Detect whether a phase is a frontend/UI phase by inspecting CONTEXT.md / REQUIREMENTS.md
function phaseIsFrontend(projectRoot, phase) {
  if (!projectRoot || !phase) return false;
  const phasesDir = path.join(projectRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return false;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === phase || e.name.startsWith(phase + '-') || e.name.startsWith(phase + '_')) {
        const dir = path.join(phasesDir, e.name);
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (/CONTEXT\.md$|REQUIREMENTS\.md$|PLAN\.md$/.test(item)) {
            try {
              const content = fs.readFileSync(path.join(dir, item), 'utf8').toLowerCase();
              if (/\b(frontend|ui|design|screen|page|component|tsx|jsx|vue|svelte|tailwind|shadcn|css)\b/.test(content)) {
                return true;
              }
            } catch {}
          }
        }
      }
    }
  } catch {}
  return false;
}

// ───── output helpers ─────

function emitStopBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

function preToolBlockMessage(reason) {
  process.stderr.write(`[uiux] ${reason}\n`);
}

function preToolWarnMessage(reason) {
  process.stderr.write(`[uiux warn] ${reason}\n`);
}

module.exports = {
  readInputSafe,
  findProjectRoot,
  loadConfig,
  loadPlanningConfig,
  getActiveReleaseTag,
  readLastAssistantText,  // ★ Stop-hook payload + transcript_path fallback (last assistant turn)
  preflight,
  L3_FAMILIES,
  WORKFLOW_NOT_STYLE,    // back-compat alias of NEVER_LOCKABLE
  NEVER_LOCKABLE,        // ★ 2026-06-10 — can-never-be-L3 set (SDK lock refusal)
  BLOCK_BEFORE_LOCK,     // ★ 2026-06-10 — mutex hook Case 1 pre-lock-block subset
  skillToL3Family,
  isWorkflowSkill,
  isBlockBeforeLock,     // ★ 2026-06-10 — mutex hook Case 1 predicate
  getInvokedSkillName,
  isGsdCommand,
  readStyleLockFamily,
  findReleaseDecision,
  findUiSpecForPhase,
  phaseIsFrontend,
  emitStopBlock,
  preToolBlockMessage,
  preToolWarnMessage,
};
