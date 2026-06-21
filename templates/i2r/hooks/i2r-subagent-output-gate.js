// i2r-subagent-output-gate.js — SubagentStop (BLOCKING, loop-safe).
// Before a subagent's work is accepted, every present stage artifact must be schema-valid
// with a complete _meta block (owner check included). Reuses `i2r.py validate --stage all`.
const { readStdin, projectRoot, isI2RProject, findActiveRun, py } = require('./_i2r-common.js');

const input = readStdin();
if (input.stop_hook_active) process.exit(0);
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);

const r = py(root, ['validate', run, '--stage', 'all']);
if (r.code === 2) {
  process.stderr.write('[I2R subagent-output-gate] invalid artifact(s) — fix before continuing:\n' + (r.out || r.err));
  process.exit(2);
}
process.exit(0);
