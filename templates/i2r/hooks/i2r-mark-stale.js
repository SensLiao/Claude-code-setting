// i2r-mark-stale.js — PostToolUse[Write|Edit] (non-blocking).
// When an upstream artifact (00-raw/** or a stage NN-*.json) changes, mark downstream
// stages STALE so the gate forces a re-run. Never blocks the write.
const fs = require('fs');
const path = require('path');
const { readStdin, projectRoot, isI2RProject, findActiveRun } = require('./_i2r-common.js');

const input = readStdin();
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const run = findActiveRun(root);
if (!run) process.exit(0);

const ti = input.tool_input || {};
const fp = String(ti.file_path || ti.path || '').replace(/\\/g, '/');
const runNorm = run.replace(/\\/g, '/');
// Only react to edits INSIDE the active run, and only to true UPSTREAM artifacts —
// never 07-review / 08-repair (terminal, not upstream), never unrelated NN-*.json in app code.
if (!fp.includes(runNorm)) process.exit(0);
const base = fp.split('/').pop();
const UPSTREAM = ['00-mode-routing.json', '01-intake.json', '02-context.json', '02b-evidence.json', '03-scope.json', '03b-scope-debate.json'];
const isUpstream = fp.includes('/00-raw/') || UPSTREAM.includes(base);
if (!isUpstream) process.exit(0);

const sp = path.join(run, 'state.json');
let st;
try { st = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_) { st = { stale: [] }; }
st.stale = st.stale || [];
for (const s of ['02-context', '03-scope', '04-functional', '05-nfr', '06-acceptance']) {
  if (!st.stale.includes(s)) st.stale.push(s);
}
try { fs.writeFileSync(sp, JSON.stringify(st, null, 2)); } catch (_) {}
process.exit(0);
