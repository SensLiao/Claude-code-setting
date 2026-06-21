// i2r-citation-gate.js — SubagentStop / Stop (BLOCKING, loop-safe).
// If search evidence was used (02b-evidence.json exists), it must be well-formed and every
// evidence card must carry a source_ref. Reuses `i2r.py evidence.validate` (exit 2 = malformed).
const { readStdin, projectRoot, isI2RProject, findActiveRun, py } = require('./_i2r-common.js');

const input = readStdin();
if (input.stop_hook_active) process.exit(0);
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);

const r = py(root, ['evidence.validate', run]);
if (r.code === 2) {
  process.stderr.write('[I2R citation-gate] evidence used without valid source_ref:\n' + (r.out || r.err));
  process.exit(2);
}
process.exit(0);
