// i2r-mark-stale.js — PostToolUse[Write|Edit] (non-blocking).
// When an upstream artifact (raw/** or a stage NN-*.json) changes, mark downstream
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
// Canonical authoring order; a write to one content-upstream artifact dirties the authorable stages
// STRICTLY AFTER it. raw/** counts as the first upstream.
const ORDER = ['raw', '01-intake', '02-context', '02b-evidence', '03-scope', '03b-scope-debate', '04-functional', '05-nfr', '06-acceptance'];
const AUTHORABLE = ['02-context', '03-scope', '04-functional', '05-nfr', '06-acceptance'];
const key = fp.includes('/raw/') ? 'raw' : base.replace(/\.json$/, '');
const idx = ORDER.indexOf(key);
// Only true content-upstreams trigger (raw + 01..03b). Routing, the authorable outputs themselves,
// 07/08, and unrelated app NN-*.json never do.
if (idx < 0 || idx > ORDER.indexOf('03b-scope-debate')) process.exit(0);
// Mark only authorable stages that come AFTER the edit AND already exist on disk — so the initial
// sequential authoring pass (downstream files not yet written) produces ZERO false-positive STALE.
const stagesDir = path.join(run, 'internal', 'stages');
const downstream = AUTHORABLE.filter(s => ORDER.indexOf(s) > idx && fs.existsSync(path.join(stagesDir, s + '.json')));
if (!downstream.length) process.exit(0);

const sp = path.join(run, 'ops', 'state.json');
let st;
try { st = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_) { st = { stale: [] }; }
st.stale = st.stale || [];
for (const s of downstream) { if (!st.stale.includes(s)) st.stale.push(s); }
try { fs.writeFileSync(sp, JSON.stringify(st, null, 2)); } catch (_) {}
process.exit(0);
