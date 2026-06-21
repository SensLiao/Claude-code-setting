// i2r-write-boundary.js — PreToolUse[Write|Edit|MultiEdit] (BLOCKING).
// While an I2R run is active, block writes into implementation directories — I2R must
// not do GSD's job. Allowed: runs/i2r, docs/requirements, docs/adr, the skill dir.
const { readStdin, projectRoot, isI2RProject, findActiveRun } = require('./_i2r-common.js');

const input = readStdin();
const root = projectRoot();
if (!isI2RProject(root) || !findActiveRun(root)) process.exit(0);

const tool = input.tool_name || '';
if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) process.exit(0);

const ti = input.tool_input || {};
const fp = String(ti.file_path || ti.path || '').replace(/\\/g, '/');
if (!fp) process.exit(0);

// Allowlist wins (CONTRACT §14): I2R's own trees are always writable, even if a path segment
// happens to contain a denied substring (e.g. a raw mirror runs/i2r/.../00-raw/src/, docs/requirements/api/).
const allowed = ['/runs/i2r/', '/docs/requirements/', '/docs/adr/', '/.claude/skills/idea-to-requirements-orchestrator/'];
if (allowed.some(a => fp.includes(a))) process.exit(0);

const denied = ['/src/', '/app/', '/lib/', '/packages/', '/tests/', '/database/',
  '/migrations/', '/api/', '/routes/', '/components/', '/ui/'];
if (denied.some(d => fp.includes(d))) {
  process.stderr.write('[I2R write-boundary] BLOCKED: write to an implementation path while I2R is active:\n  '
    + fp + '\nI2R produces requirements only (WHAT/WHY). Implementation belongs to GSD downstream.');
  process.exit(2);
}
process.exit(0);
