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

// ───── L3 + workflow recognition ─────

// Canonical L3 family names → list of skill ids that map into that family
const L3_FAMILIES = {
  taste:           ['taste-skill', 'taste'],
  luxury:          ['luxury', 'luxury-editorial-site-builder'],
  minimalist:      ['minimalist-skill', 'minimalist'],
  soft:            ['soft-skill', 'soft'],
  brutalist:       ['brutalist-skill', 'brutalist'],
  'gpt-tasteskill':['gpt-tasteskill'],
};

// Workflow skills that are NEVER allowed as L3 styles
const WORKFLOW_NOT_STYLE = new Set([
  'redesign-skill', 'image-to-code-skill', 'stitch-skill',
  'frontend-design-pro', 'frontend-design', 'frontend-design@frontend-design-pro',
  'frontend-pipeline', 'anchor-prototype-wave', 'sens-frontend-design',
]);

function skillToL3Family(skillName) {
  if (!skillName) return null;
  const norm = String(skillName).toLowerCase().replace(/^skill:/, '').replace(/^\/+/, '');
  for (const [family, ids] of Object.entries(L3_FAMILIES)) {
    if (ids.some(id => id.toLowerCase() === norm)) return family;
  }
  return null;
}

function isWorkflowSkill(skillName) {
  if (!skillName) return false;
  const norm = String(skillName).toLowerCase().replace(/^skill:/, '').replace(/^\/+/, '');
  return WORKFLOW_NOT_STYLE.has(norm);
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
    const m = txt.match(/^[ \t]{0,4}l3_style[ \t]*:[ \t]*(.+)$/mi);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '').toLowerCase();
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
    const m = txt.match(/^[ \t]{0,4}decision[ \t]*:[ \t]*(\w+)/mi);
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
  preflight,
  L3_FAMILIES,
  WORKFLOW_NOT_STYLE,
  skillToL3Family,
  isWorkflowSkill,
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
