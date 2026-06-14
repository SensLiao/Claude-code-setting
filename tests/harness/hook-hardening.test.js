#!/usr/bin/env node
'use strict';

/**
 * tests/harness/hook-hardening.test.js
 *
 * R3 adversarial-sweep (2026-06-14, Codex + main cross-model) regressions for the HOOK control-plane.
 * Locks the fail-closed behavior found by 6 parallel agents: pentest-auth time-window {0,4}/dup
 * smuggle + strict-ISO; governed-gate name+script inline-dominance; uiux-mutex readStyleLockFamily
 * col-0; preview-gate non-boolean allow_dynamic_workflow; _appsec-common detectSecrets unicode evasion.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('hook-hardening');
const HK = (p) => path.join(H.claudeRoot, 'hooks', p);
const ISO_NOW = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function mkproj(files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-'));
  for (const rel of Object.keys(files)) {
    const fp = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, files[rel]);
  }
  return tmp;
}
function runHook(hook, payload, cwd) {
  return cp.spawnSync('node', [HK(hook)], { input: payload, cwd, encoding: 'utf8', timeout: 15000 });
}
function clean(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* */ } }

// ── governed-gate-workflow-guard: inline script must dominate name/scriptPath ──
h.section('governed-gate-workflow-guard — inline script dominance');
{
  const base = { '.appsec/config.json': '{"schema_version":"1.0"}', '.appsec/state/preview-approved/g.json': `{"approved_at":"${ISO_NOW}","ttl_seconds":300}` };
  const cases = [
    ['name+string-script -> BLOCK', '{"tool_name":"Workflow","tool_input":{"name":"approved","script":"phase(1)","args":{}}}', 2],
    ['name+object-script -> BLOCK', '{"tool_name":"Workflow","tool_input":{"name":"approved","script":{"x":1},"args":{}}}', 2],
    ['script-only -> BLOCK', '{"tool_name":"Workflow","tool_input":{"script":"phase(1)"}}', 2],
    ['name-only -> allow (no false-kill)', '{"tool_name":"Workflow","tool_input":{"name":"approved","args":{}}}', 0],
  ];
  for (const [name, payload, want] of cases) {
    const tmp = mkproj(base);
    try { const r = runHook('governed-gate-workflow-guard.js', payload, tmp); h.assert(r.status === want, `governed-gate: ${name}`, `got ${r.status} want ${want}`); }
    finally { clean(tmp); }
  }
}

// ── uiux-style-mutex-guard: readStyleLockFamily col-0 ──
h.section('uiux-style-mutex-guard — readStyleLockFamily col-0');
{
  const decoy = mkproj({ '.uiux/config.json': '{}', '.uiux/lock/style-lock.yaml': 'metadata:\n  l3_style: luxury\nl3_style: taste\n' });
  try {
    h.assert(runHook('uiux-style-mutex-guard.js', '{"tool_name":"Skill","tool_input":{"skill_name":"luxury"}}', decoy).status === 2, 'uiux: nested decoy + conflicting luxury -> BLOCK (reads real col-0 taste)');
    h.assert(runHook('uiux-style-mutex-guard.js', '{"tool_name":"Skill","tool_input":{"skill_name":"taste"}}', decoy).status === 0, 'uiux: same family taste -> allow (no false-kill)');
  } finally { clean(decoy); }
}

// ── preview-gate: allow_dynamic_workflow must be boolean false or omitted ──
h.section('appsec-preview-gate — allow_dynamic_workflow non-boolean');
{
  const tmp = mkproj({ '.appsec/config.json': '{"schema_version":"1.0"}' });
  const mk = (v) => `{"tool_name":"Workflow","tool_input":{"name":"appsec-orchestrator","args":{"run_id":"r","spec_hash":"h","spec":{"orchestrator":"appsec","phases":[{"name":"p"}],"allow_dynamic_workflow":${v}}}}}`;
  try {
    for (const v of ['"true"', '1', '{"enabled":true}', 'null']) {
      const r = runHook('appsec-preview-gate.js', mk(v), tmp);
      h.assert(r.status === 2 && /allow_dynamic_workflow must be boolean false/.test(r.stderr || ''), `preview-gate: allow_dynamic_workflow=${v} -> BLOCK`);
    }
    // false must NOT be blocked by the dyn check (it will block later on the missing sentinel — different reason)
    const rf = runHook('appsec-preview-gate.js', mk('false'), tmp);
    h.assert(!/allow_dynamic_workflow must be boolean false/.test(rf.stderr || ''), 'preview-gate: allow_dynamic_workflow=false passes the dyn check (no false-kill)');
  } finally { clean(tmp); }
}

// ── _appsec-common detectSecrets: unicode evasion ──
h.section('_appsec-common detectSecrets — unicode evasion');
{
  let detectSecrets;
  try { ({ detectSecrets } = require(path.join(H.claudeRoot, 'hooks', '_appsec-common.js'))); } catch (_e) { /* */ }
  if (typeof detectSecrets !== 'function') { h.warn('SMOKE_SKIPPED: detectSecrets not exported'); }
  else {
    const hit = (t) => detectSecrets(t).length > 0;
    h.assert(hit('AKIAIOSFODNN7EXAMPLE'), 'detectSecrets: control AKIA detected');
    h.assert(hit('sk-proj-AAAABBBB​CCCCDDDDEEEEFFFF'), 'detectSecrets: zero-width-split sk-proj detected');
    h.assert(hit('sk-proj-AAAABBBB­CCCCDDDDEEEEFFFF'), 'detectSecrets: soft-hyphen-split detected');
    h.assert(hit('AKIA͏IOSF͏ODNN͏7EXA͏MPLE'), 'detectSecrets: combining-mark-split AKIA detected');
    h.assert(hit('ＡＫＩＡIOSFODNN7EXAMPLE'), 'detectSecrets: full-width (NFKC) detected');
    h.assert(!hit('SQL injection in the login form, see line 42'), 'detectSecrets: clean text not flagged (no false-positive)');
    h.assert(!hit('well-architected multi-tenant design'), 'detectSecrets: hyphenated words not flagged');
  }
}

// ── appsec-pentest-authorization: time-window col-0 + strict-ISO ──
h.section('appsec-pentest-authorization — time-window col-0 + strict ISO');
{
  const FIELDS = ['target_identification','authorization_proof','environment','scope','allowed_methods','disallowed_methods','time_window','rate_limits','test_accounts','data_handling','emergency_contact','rollback','reporting_format'];
  const roe = (extra) => FIELDS.map(k => `${k}: x`).join('\n') + '\n' + extra;
  const base = (roeBody) => ({ '.appsec/config.json': '{"schema_version":"1.0"}', '.appsec/state/pentest-signoff': 'I authorize this pentest validation per ROE', '.planning/PENTEST-ROE.md': roeBody });
  const payload = '{"tool_name":"Skill","tool_input":{"skill_name":"authorized-pentest-validation"}}';
  const cases = [
    ['nested future decoy + real expired -> BLOCK', roe('  time_window_end: 2099-01-01T00:00:00Z\ntime_window_end: 2020-01-01T00:00:00Z\n'), 2],
    ['dup future-first -> BLOCK', roe('time_window_end: 2099-01-01T00:00:00Z\ntime_window_end: 2020-01-01T00:00:00Z\n'), 2],
    ['locale date (non-ISO) -> BLOCK', roe('time_window_end: 01/02/2099\n'), 2],
    ['open window (no false-kill) -> allow', roe('time_window_start: 2020-01-01T00:00:00Z\ntime_window_end: 2099-01-01T00:00:00Z\n'), 0],
  ];
  for (const [name, roeBody, want] of cases) {
    const tmp = mkproj(base(roeBody));
    try { const r = runHook('appsec-pentest-authorization.js', payload, tmp); h.assert(r.status === want, `pentest-auth: ${name}`, `got ${r.status} want ${want}; ${(r.stderr||'').slice(0,90)}`); }
    finally { clean(tmp); }
  }
}

process.exit(h.exit());
