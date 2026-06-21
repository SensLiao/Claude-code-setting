// i2r-session-context.js — SessionStart (advisory, never blocks).
// Injects the active I2R run + current stage pointer so a fresh session resumes fast.
const { readStdin, projectRoot, isI2RProject, findActiveRun, py } = require('./_i2r-common.js');

readStdin();
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);
const r = py(root, ['status', run]);
if (r.out) process.stdout.write('[I2R] active run — resume pointer:\n' + r.out);
process.exit(0);
