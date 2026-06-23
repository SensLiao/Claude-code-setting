// i2r-readiness-gate.js — Stop (BLOCKING, loop-safe). The governance 坎.
// Once the out/ package has been assembled, do not let the session end declaring requirements
// "ready" unless the deterministic gate passed. Escape is simple: run gate.check, resolve blockers.
// (Renamed from i2r-handoff-gate.js — same enforcement, neutral framing, no downstream commands.)
const fs = require('fs');
const path = require('path');
const { readStdin, projectRoot, isI2RProject, findActiveRun } = require('./_i2r-common.js');

const input = readStdin();
if (input.stop_hook_active) process.exit(0);
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);

// Only gate once the package is assembled (out/PRD.md exists). Earlier stops are fine.
if (!fs.existsSync(path.join(run, 'out', 'PRD.md'))) process.exit(0);

let verdict = null;
const gr = path.join(run, 'audit', 'gate-result.yaml');
if (fs.existsSync(gr)) {
  const m = /verdict:\s*(\w+)/.exec(fs.readFileSync(gr, 'utf8'));
  verdict = m && m[1];
}
if (verdict === 'READY' || verdict === 'NEEDS_REVIEW') process.exit(0);

if (verdict === 'BLOCKED') {
  // hard stop: a known-bad package must not be declared ready. Escape is explicit + reachable.
  process.stderr.write('[I2R readiness-gate] gate.check is BLOCKED. Clear the blockers (both reviews PASS, '
    + 'no BLOCKER finding, reader-test PASS, no placeholders, out/ Markdown-only with no downstream commands), '
    + 'then re-run `python scripts/i2r.py gate.check ' + run + '` — or remove the draft out/PRD.md — '
    + 'before declaring the requirements package ready.');
  process.exit(2);
}
// gate not yet run: warn (non-blocking) rather than trap the user at an ordinary Stop.
process.stderr.write('[I2R readiness-gate] note: the out/ package is assembled but gate.check has not been run yet; '
  + 'run `python scripts/i2r.py gate.check ' + run + '` before declaring the requirements package ready.');
process.exit(0);
