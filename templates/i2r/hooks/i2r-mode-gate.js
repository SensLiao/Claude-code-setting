// i2r-mode-gate.js — Stop (BLOCKING, loop-safe).
// Reuses the deterministic SDK: if routing required search/discussion/scope-debate and
// the artifact is missing, block completion until it exists.
const { readStdin, projectRoot, isI2RProject, findActiveRun, py } = require('./_i2r-common.js');

const input = readStdin();
if (input.stop_hook_active) process.exit(0);
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);

const r = py(root, ['mode.check', run]);
if (r.code === 2) {
  process.stderr.write('[I2R mode-gate] routing-required artifact(s) missing:\n' + (r.out || r.err));
  process.exit(2);
}
process.exit(0);
