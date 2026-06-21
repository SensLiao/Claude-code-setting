// i2r-handoff-gate.js — Stop (BLOCKING, loop-safe). The governance 坎.
// Once a PRD has been assembled, do not let the session end declaring requirements "ready"
// unless the deterministic gate passed. Escape is simple: run gate.check and resolve blockers.
const fs = require('fs');
const path = require('path');
const { readStdin, projectRoot, isI2RProject, findActiveRun } = require('./_i2r-common.js');

const input = readStdin();
if (input.stop_hook_active) process.exit(0);
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);

// Only gate at the handoff stage (PRD assembled). Earlier stops are fine.
if (!fs.existsSync(path.join(run, 'PRD.md'))) process.exit(0);

let verdict = null;
const gr = path.join(run, 'gate-result.yaml');
if (fs.existsSync(gr)) {
  const m = /verdict:\s*(\w+)/.exec(fs.readFileSync(gr, 'utf8'));
  verdict = m && m[1];
}
if (verdict === 'READY' || verdict === 'NEEDS_REVIEW') process.exit(0);

if (verdict === 'BLOCKED') {
  // hard stop: a known-bad handoff must not be declared ready. Escape is explicit + reachable.
  process.stderr.write('[I2R handoff-gate] gate.check is BLOCKED. Clear the blockers (both reviews PASS, '
    + 'no BLOCKER finding, reader-test PASS, no placeholders), then re-run '
    + '`python scripts/i2r.py gate.check ' + run + '` — or remove the draft PRD.md — before declaring ready for GSD.');
  process.exit(2);
}
// gate not yet run: warn (non-blocking) rather than trap the user at an ordinary Stop.
process.stderr.write('[I2R handoff-gate] note: a PRD is assembled but gate.check has not been run yet; '
  + 'run `python scripts/i2r.py gate.check ' + run + '` before declaring requirements ready for GSD.');
process.exit(0);
