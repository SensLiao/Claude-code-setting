// _i2r-common.js — shared helpers for I2R project hooks.
// All hooks fail OPEN: if anything is off (not an i2r project, no active run,
// python missing, parse error), they exit 0 and never block a non-i2r project.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); }
  catch (_) { return {}; }
}

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

// An I2R project has the skill installed, a runs/i2r tree, or the SDK present.
function isI2RProject(root) {
  return fs.existsSync(path.join(root, '.claude', 'skills', 'idea-to-requirements-orchestrator'))
      || fs.existsSync(path.join(root, 'runs', 'i2r'))
      || fs.existsSync(path.join(root, 'scripts', 'i2r.py'));
}

// Most-recently-touched run folder under runs/i2r/<slug>/<timestamp>/.
function findActiveRun(root) {
  const base = path.join(root, 'runs', 'i2r');
  if (!fs.existsSync(base)) return null;
  let latest = null, latestM = 0;
  try {
    for (const slug of fs.readdirSync(base)) {
      const sp = path.join(base, slug);
      if (!fs.statSync(sp).isDirectory()) continue;
      for (const ts of fs.readdirSync(sp)) {
        const rp = path.join(sp, ts);
        if (!fs.existsSync(path.join(rp, '00-raw'))) continue;
        const m = fs.statSync(rp).mtimeMs;
        if (m > latestM) { latestM = m; latest = rp; }
      }
    }
  } catch (_) { return null; }
  return latest;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

// Run the deterministic SDK and return {code, out, err}. Fail-open whenever the SDK can't run
// (no python, or no scripts/i2r.py) so a partial/SDK-less i2r-ish checkout never hard-blocks a session.
function py(root, args) {
  const script = path.join(root, 'scripts', 'i2r.py');
  if (!fs.existsSync(script)) return { code: 0, out: '', err: '' };  // no engine -> fail open
  try {
    const out = execFileSync('python', [script, ...args], { encoding: 'utf8' });
    return { code: 0, out, err: '' };
  } catch (e) {
    const err = (e && e.stderr || '').toString();
    // launcher-level failure (interpreter missing, script unreadable) is NOT a gate verdict -> fail open
    if (!e || e.status == null || /No such file|can't open file|cannot find/i.test(err)) {
      return { code: 0, out: '', err: '' };
    }
    return { code: e.status, out: (e.stdout || '').toString(), err };
  }
}

module.exports = { readStdin, projectRoot, isI2RProject, findActiveRun, readJSON, py };
