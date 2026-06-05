// _qa-common — shared helpers for all QA hooks.
// Centralizes: project root resolution, config loading, fail-closed semantics,
// active release tag lookup, warn-mode handling.

const fs = require('fs');
const path = require('path');

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function readInput() {
  const raw = readStdinSync();
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

// Walk upward from `start` looking for .qa/config.json. Returns the directory
// containing .qa/ (project root), or null.
function findProjectRoot(start) {
  if (!start) return null;
  let dir;
  try { dir = path.resolve(start); } catch { return null; }
  // Cap at 12 levels to prevent runaway
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, '.qa', 'config.json');
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// Load .qa/config.json from project root. Returns { config, projectRoot, error }.
// If file exists but unparseable: returns { error: 'malformed', projectRoot }.
// Caller decides whether to fail closed.
function loadConfig(cwdHint) {
  const projectRoot = findProjectRoot(cwdHint || process.cwd());
  if (!projectRoot) return { config: null, projectRoot: null, error: 'absent' };
  const cfgPath = path.join(projectRoot, '.qa', 'config.json');
  let raw;
  try { raw = fs.readFileSync(cfgPath, 'utf8'); }
  catch { return { config: null, projectRoot, error: 'unreadable' }; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { config: null, projectRoot, error: 'malformed' }; }
  return { config: parsed, projectRoot, error: null };
}

// Read .qa/state.json if present (created by qa-sdk init). Falls back to mtime scan.
// Returns { activeTag, activeDir } or { activeTag: null, activeDir: null }.
function getActiveReleaseTag(projectRoot) {
  if (!projectRoot) return { activeTag: null, activeDir: null };
  const statePath = path.join(projectRoot, '.qa', 'state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state && typeof state.active_release_tag === 'string' && state.active_release_tag) {
        const dir = path.join(projectRoot, '.qa', 'evidence', state.active_release_tag);
        if (fs.existsSync(dir)) return { activeTag: state.active_release_tag, activeDir: dir };
      }
    } catch {}
  }
  // Fallback: most recently mtimed dir under .qa/evidence/
  const evidenceRoot = path.join(projectRoot, '.qa', 'evidence');
  if (!fs.existsSync(evidenceRoot)) return { activeTag: null, activeDir: null };
  try {
    const dirs = fs.readdirSync(evidenceRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const p = path.join(evidenceRoot, d.name);
        let mtime = 0;
        try { mtime = fs.statSync(p).mtimeMs; } catch {}
        return { name: d.name, path: p, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    if (dirs.length === 0) return { activeTag: null, activeDir: null };
    return { activeTag: dirs[0].name, activeDir: dirs[0].path };
  } catch { return { activeTag: null, activeDir: null }; }
}

// Standard hook prelude.
// Returns one of:
//   { mode: 'silent' }                          — non-QA project: silent exit 0
//   { mode: 'off' }                             — qa_enforcement=off: silent exit 0
//   { mode: 'fail-closed', reason: '...' }      — malformed/unreadable config: hook MUST block
//   { mode: 'warn', config, projectRoot }       — qa_enforcement=warn
//   { mode: 'strict', config, projectRoot }     — qa_enforcement=strict (default)
function preflight(input) {
  const cwd = (input && input.cwd) || process.cwd();
  const { config, projectRoot, error } = loadConfig(cwd);
  if (error === 'absent') return { mode: 'silent' };
  if (error === 'malformed' || error === 'unreadable') {
    return { mode: 'fail-closed', projectRoot, reason: `.qa/config.json ${error}` };
  }
  const enf = config.qa_enforcement || 'warn';
  if (enf === 'off') return { mode: 'off' };
  if (enf === 'warn') return { mode: 'warn', config, projectRoot };
  return { mode: 'strict', config, projectRoot };
}

// Helper: emit a PostToolUse advisory context block.
function emitAdvisory(eventName, lines) {
  const out = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: Array.isArray(lines) ? lines.join('\n') : String(lines),
    },
  };
  process.stdout.write(JSON.stringify(out));
}

// Helper: emit Stop hook block JSON.
function emitStopBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

module.exports = {
  readInput,
  findProjectRoot,
  loadConfig,
  getActiveReleaseTag,
  preflight,
  emitAdvisory,
  emitStopBlock,
};
