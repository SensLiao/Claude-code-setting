#!/usr/bin/env node
'use strict';

/**
 * tests/harness/gate-hooks.test.js
 *
 * Guards the two GLOBAL deterministic gate hooks (ask #3, hybrid strictness):
 *   - report-gate.js (Stop, HARD block): non-trivial turn with no closing report -> block
 *   - plan-card-reminder.js (PreToolUse[Agent|Workflow], SOFT remind): fan-out/Workflow w/o card -> remind
 * Asserts both exist, are registered in settings.json, and behave correctly on
 * synthetic transcripts (native paths -> works cross-platform).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('gate-hooks');
const root = H.claudeRoot;
const reportGate = path.join(root, 'hooks', 'report-gate.js');
const planCard = path.join(root, 'hooks', 'plan-card-reminder.js');
const RID = String(Date.now()); // unique session ids per run -> plan-card sentinel never suppresses across runs

h.section('Files exist');
h.assert(H.existsSync(reportGate), 'hooks/report-gate.js exists');
h.assert(H.existsSync(planCard), 'hooks/plan-card-reminder.js exists');

h.section('Registered in settings.json');
let S = null;
try { S = H.readJson(path.join(root, 'settings.json')); h.ok('settings.json parses'); } catch (e) { h.error('settings.json parse', e.message); }
if (S && S.hooks) {
  h.assert(JSON.stringify(S.hooks.Stop || []).includes('report-gate.js'), 'report-gate.js registered on Stop');
  const pc = (S.hooks.PreToolUse || []).find(e => JSON.stringify(e).includes('plan-card-reminder.js'));
  h.assert(!!pc, 'plan-card-reminder.js registered on PreToolUse');
  h.assert(!!pc && /Agent|Workflow/.test(pc.matcher || ''), 'plan-card matcher targets Agent|Workflow', pc && pc.matcher);
}

// ---- synthetic-transcript helpers ----
function writeTranscript(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gatetest-'));
  const f = path.join(dir, 'tr.jsonl');
  fs.writeFileSync(f, entries.map(o => JSON.stringify(o)).join('\n'));
  return f;
}
const userMsg = t => ({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: t }] } });
const asst = blocks => ({ type: 'assistant', message: { role: 'assistant', content: blocks } });
const toolUse = name => ({ type: 'tool_use', name, input: {} });
const text = t => ({ type: 'text', text: t });
function runHook(hookPath, payload) {
  const out = cp.spawnSync(process.execPath, [hookPath], { input: JSON.stringify(payload), encoding: 'utf8', timeout: 30000 });
  return { code: out.status, stdout: out.stdout || '' };
}
const LONG = 'X'.repeat(260);
const LONG2 = 'Y'.repeat(650); // > MIN_TURN (600): exercises the flush-race fallback

h.section('report-gate.js behavior');
let tr = writeTranscript([userMsg('refactor these files'), asst([toolUse('Edit')]), asst([toolUse('Edit')]), asst([toolUse('Edit')]), asst([text('done')])]);
let r = runHook(reportGate, { transcript_path: tr, stop_hook_active: false });
h.assert(r.code === 0 && /"decision"\s*:\s*"block"/.test(r.stdout), 'non-trivial (3 edits) + short close -> BLOCK', 'stdout=' + r.stdout.slice(0, 80));

tr = writeTranscript([userMsg('investigate'), asst([toolUse('Agent')]), asst([text(LONG)])]);
r = runHook(reportGate, { transcript_path: tr, stop_hook_active: false });
h.assert(r.code === 0 && !/decision/.test(r.stdout), 'fan-out + long report -> ALLOW');

tr = writeTranscript([userMsg('fix typo'), asst([toolUse('Edit')]), asst([text('fixed')])]);
r = runHook(reportGate, { transcript_path: tr, stop_hook_active: false });
h.assert(r.code === 0 && !/decision/.test(r.stdout), 'trivial 1-edit -> ALLOW (not gated)');

tr = writeTranscript([userMsg('refactor'), asst([toolUse('Edit')]), asst([toolUse('Edit')]), asst([toolUse('Edit')]), asst([text('done')])]);
r = runHook(reportGate, { transcript_path: tr, stop_hook_active: true });
h.assert(r.code === 0 && !/decision/.test(r.stdout), 'stop_hook_active=true -> ALLOW (loop-safe)');

// flush-race fallback: a Stop hook can fire before the final report is written to the
// transcript -> hook sees a short/tool-ending last message. Substantial EARLIER turn text
// (already flushed) must satisfy "reported". Without this fallback the gate false-positives.
tr = writeTranscript([userMsg('big task'), asst([text(LONG2)]), asst([toolUse('Edit')]), asst([toolUse('Edit')]), asst([toolUse('Edit')]), asst([text('ok')])]);
r = runHook(reportGate, { transcript_path: tr, stop_hook_active: false });
h.assert(r.code === 0 && !/decision/.test(r.stdout), 'flush-race: substantial earlier text + short close -> ALLOW (race-proof fallback)');

h.section('plan-card-reminder.js behavior');
tr = writeTranscript([userMsg('big audit'), asst([toolUse('Agent')]), asst([toolUse('Agent')])]);
r = runHook(planCard, { tool_name: 'Workflow', transcript_path: tr, session_id: 'gt-' + RID + '-1' });
h.assert(r.code === 0 && /additionalContext/.test(r.stdout), 'Workflow + no card -> REMINDER');

tr = writeTranscript([userMsg('audit'), asst([text('执行计划预览 · PLAN PREVIEW — table + flow here')])]);
r = runHook(planCard, { tool_name: 'Workflow', transcript_path: tr, session_id: 'gt-' + RID + '-2' });
h.assert(r.code === 0 && !/additionalContext/.test(r.stdout), 'card already shown -> no reminder (suppressed)');

tr = writeTranscript([userMsg('small task')]);
r = runHook(planCard, { tool_name: 'Agent', transcript_path: tr, session_id: 'gt-' + RID + '-3' });
h.assert(r.code === 0 && !/additionalContext/.test(r.stdout), '1st agent (no fan-out, <3) -> no reminder');

process.exit(h.exit());
