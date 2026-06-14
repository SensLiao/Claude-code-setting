#!/usr/bin/env node
'use strict';

/**
 * tests/harness/engine-hardening.test.js
 *
 * R3 adversarial-sweep (2026-06-14, cross-model Codex + main) regressions for the Wave JS gate
 * engines. 7 parallel agents found fail-opens in control-matrix / lifecycle / tool-risk /
 * evidence-export / budget; these lock the fail-closed behavior + the no-false-kill baselines so
 * they cannot regress. Pure-node (no bash dependency) — runs on every host.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('engine-hardening');
const S = (p) => path.join(H.claudeRoot, 'schemas', p);

function mkproj(files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-'));
  for (const rel of Object.keys(files)) {
    const fp = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, files[rel]);
  }
  return tmp;
}
function runNode(args, opts) {
  return cp.spawnSync('node', args, Object.assign({ encoding: 'utf8', timeout: 20000 }, opts || {}));
}
function cleanup(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }

// ─────────────────────────── control-matrix-verify ───────────────────────────
h.section('control-matrix-verify — evidence_ref containment + severity case');
{
  const ENG = S('control-matrix-verify.js');
  const mkmap = (status, ref, sev) => JSON.stringify({ bindings: [{ control_id: 'C1', status, evidence_ref: ref, severity_if_gap: sev }] });
  // [name, status, ref, sev, level, wantExit]
  const cases = [
    ['absolute system file -> FAIL', 'covered', process.platform === 'win32' ? 'C:/Windows/win.ini' : '/etc/hostname', 'high', 'regulated', 1],
    ['traversal escape -> FAIL', 'covered', '../../../../../../etc/hostname', 'high', 'regulated', 1],
    ['directory as evidence -> FAIL', 'covered', '.', 'high', 'regulated', 1],
    ['nonexistent file -> FAIL', 'covered', 'nope/missing.json', 'high', 'regulated', 1],
    ['gap Critical(cap) regulated -> BLOCK', 'gap', '', 'Critical', 'regulated', 2],
    ['gap HIGH regulated -> BLOCK', 'gap', '', 'HIGH', 'regulated', 2],
    ['not_assessed Critical regulated -> BLOCK', 'other', '', 'Critical', 'regulated', 2],
    ['regulated critical covered-by-# -> FAIL', 'covered', '#', 'critical', 'regulated', 1],
    ['baseline covered-by-# (anchor ok) -> PASS', 'covered', '#', 'critical', 'baseline', 0],
    ['gap low regulated -> PASS', 'gap', '', 'low', 'regulated', 0],
  ];
  for (const [name, status, ref, sev, level, want] of cases) {
    const tmp = mkproj({ 'map.json': mkmap(status, ref, sev) });
    try {
      const r = runNode([ENG, path.join(tmp, 'map.json'), tmp, '--level', level]);
      h.assert(r.status === want, `control-matrix: ${name}`, `got exit ${r.status} want ${want}; ${(r.stderr || '').slice(0, 100)}`);
    } finally { cleanup(tmp); }
  }
  // no-false-kill: a covered control with a REAL in-project file
  const tmp = mkproj({ 'map.json': mkmap('covered', 'evi/e.json', 'high'), 'evi/e.json': 'proof' });
  try {
    const r = runNode([ENG, path.join(tmp, 'map.json'), tmp, '--level', 'regulated']);
    h.assert(r.status === 0, 'control-matrix: real in-project file -> PASS (no false-kill)', `got exit ${r.status}`);
  } finally { cleanup(tmp); }
}

// ─────────────────────────── lifecycle-transition-verify ──────────────────────
h.section('lifecycle-transition-verify — sweep fail-closed + transitions');
{
  const ENG = S('lifecycle-transition-verify.js');
  const sweepCases = [
    ['future ISO -> clean', '[{"id":"V","status":"ACCEPTED_RISK","exception_expiry":"2099-01-01T00:00:00Z"}]', 0],
    ['date-only future -> clean (no false-kill)', '[{"id":"V","status":"ACCEPTED_RISK","exception_expiry":"2099-12-01"}]', 0],
    ['past -> flag', '[{"id":"V","status":"ACCEPTED_RISK","exception_expiry":"2020-01-01T00:00:00Z"}]', 1],
    ['missing expiry -> flag', '[{"id":"V","status":"ACCEPTED_RISK"}]', 1],
    ['unparseable -> flag', '[{"id":"V","status":"ACCEPTED_RISK","exception_expiry":"not-a-date"}]', 1],
    ['rollover 2026-13-99 -> flag', '[{"id":"V","status":"ACCEPTED_RISK","exception_expiry":"2026-13-99"}]', 1],
    ['locale 01/02/2099 -> flag', '[{"id":"V","status":"ACCEPTED_RISK","exception_expiry":"01/02/2099"}]', 1],
    ['lowercase status+past -> flag', '[{"id":"V","status":"accepted_risk","exception_expiry":"2000-01-01T00:00:00Z"}]', 1],
    ['malformed bare object -> fail-closed', '{"foo":"bar"}', 2],
    ['empty array -> clean', '[]', 0],
  ];
  for (const [name, json, want] of sweepCases) {
    const tmp = mkproj({ 'f.json': json });
    try {
      const r = runNode([ENG, '--sweep', path.join(tmp, 'f.json')]);
      h.assert(r.status === want, `lifecycle sweep: ${name}`, `got exit ${r.status} want ${want}`);
    } finally { cleanup(tmp); }
  }
  h.assert(runNode([ENG, 'OPEN', 'FIXED']).status === 1, 'lifecycle: OPEN->FIXED illegal (exit 1)');
  h.assert(runNode([ENG, 'OPEN', 'TRIAGED']).status === 0, 'lifecycle: OPEN->TRIAGED legal (exit 0)');
}

// ─────────────────────────── tool-risk-verify ────────────────────────────────
h.section('tool-risk-verify — anti-downgrade + capabilities + dup-id');
{
  const ENG = S('tool-risk-verify.js');
  const cases = [
    ['downgrade seed T5->T0 -> FAIL', '{"tools":[{"tool_id":"mcp__claude_ai_Google_Drive__authenticate","risk_tier":"T0"}]}', 1],
    ['array tier [T6] -> FAIL', '{"tools":[{"tool_id":"x","risk_tier":["T6"],"requires_approval":[],"evidence_required":[]}]}', 1],
    ['empty-element [""] T6 -> FAIL', '{"tools":[{"tool_id":"x","risk_tier":"T6","requires_approval":[""],"evidence_required":[""],"default_policy":"roe-manual-only"}]}', 1],
    ['T0 + secret cap -> FAIL', '{"tools":[{"tool_id":"sekret","risk_tier":"T0","capabilities":{"secret":true}}]}', 1],
    ['T0 + exec cap -> FAIL', '{"tools":[{"tool_id":"sh","risk_tier":"T0","capabilities":{"exec":true}}]}', 1],
    ['dup tool_id -> FAIL', '{"tools":[{"tool_id":"x","risk_tier":"T5","requires_approval":["a"],"evidence_required":["e"]},{"tool_id":"x","risk_tier":"T0"}]}', 1],
    ['Bash T2 all-caps -> PASS (no false-kill)', '{"tools":[{"tool_id":"Bash","risk_tier":"T2","capabilities":{"exec":true,"write":true,"secret":true,"network":true}}]}', 0],
    ['Read T0 read-only -> PASS', '{"tools":[{"tool_id":"Read","risk_tier":"T0","capabilities":{"network":false,"write":false,"secret":false,"exec":false}}]}', 0],
    ['pruned correct T6 -> PASS', '{"tools":[{"tool_id":"x","risk_tier":"T6","requires_approval":["sec"],"evidence_required":["roe"],"default_policy":"roe-manual-only"}]}', 0],
  ];
  for (const [name, json, want] of cases) {
    const tmp = mkproj({ 'r.json': json });
    try {
      const r = runNode([ENG, path.join(tmp, 'r.json')]);
      h.assert(r.status === want, `tool-risk: ${name}`, `got exit ${r.status} want ${want}; ${(r.stderr || '').slice(0, 100)}`);
    } finally { cleanup(tmp); }
  }
}

// ─────────────────────────── evidence-export redaction ───────────────────────
h.section('evidence-export — secret redaction at export boundary');
{
  const ENG = S('evidence-export.js');
  const leak = (fmt, json, needle) => {
    const r = runNode([ENG, '--format', fmt], { input: json });
    return String(r.stdout || '').includes(needle);
  };
  h.assert(!leak('sarif', '{"findings":[{"id":"R","description":"sk-proj-AAAABBBBCCCCDDDDEEEEFFFF"}]}', 'sk-proj-AAAABBBBCCCCDDDDEEEEFFFF'), 'evidence-export: sk-proj redacted in SARIF');
  h.assert(!leak('sarif', '{"findings":[{"id":"R","description":"AKIAIOSFODNN7EXAMPLE"}]}', 'AKIAIOSFODNN7EXAMPLE'), 'evidence-export: AKIA redacted');
  h.assert(!leak('cyclonedx', '{"components":[{"name":"sk_live_AbCdEfGhIjKlMnOpQrStUvWx"}]}', 'sk_live_AbCdEfGhIjKlMnOpQrStUvWx'), 'evidence-export: Stripe redacted in SBOM');
  h.assert(!leak('sarif', '{"findings":[{"id":"R","title":"t","asvs_mapping":["AKIAIOSFODNN7EXAMPLE"]}]}', 'AKIAIOSFODNN7EXAMPLE'), 'evidence-export: final-pass catches bypass field (asvs_mapping)');
  h.assert(leak('sarif', '{"findings":[{"id":"R","description":"XSS in search box line 42"}]}', 'XSS in search box line 42'), 'evidence-export: clean text preserved (no over-redaction)');
  // output remains parseable JSON after redaction
  const r = runNode([ENG, '--format', 'sarif'], { input: '{"findings":[{"id":"R","description":"sk-proj-AAAABBBBCCCCDDDDEEEE"}]}' });
  let ok = false; try { JSON.parse(r.stdout); ok = true; } catch (_e) { ok = false; }
  h.assert(ok, 'evidence-export: redacted SARIF is still valid JSON');
}

// ─────────────────────────── budget-reconcile ────────────────────────────────
h.section('budget-reconcile — strict integer token counts');
{
  const ENG = S('budget-reconcile.js');
  const cases = [
    ['valid within', ['--estimate-high', '100', '--actual', '50'], 0],
    ['valid overrun', ['--approved', '100', '--estimate-high', '100', '--actual', '200'], 1],
    ['negative actual reject', ['--estimate-high', '100', '--actual', '-1'], 2],
    ['hex actual reject', ['--estimate-high', '100', '--actual', '0x10'], 2],
    ['scientific reject', ['--approved', '100000', '--estimate-high', '100000', '--actual', '9e4'], 2],
    ['Infinity reject', ['--estimate-high', 'Infinity', '--actual', '1'], 2],
    ['decimal reject', ['--estimate-high', '100', '--actual', '1.5'], 2],
  ];
  for (const [name, args, want] of cases) {
    const r = runNode([ENG, ...args]);
    h.assert(r.status === want, `budget: ${name}`, `got exit ${r.status} want ${want}`);
  }
  const r = runNode([ENG, '--estimate-high', '100', '--actual', '50']);
  let flagged = false; try { flagged = JSON.parse(r.stdout).approved_missing === true; } catch (_e) { /* */ }
  h.assert(flagged, 'budget: approved_missing flag emitted when no --approved');
}

process.exit(h.exit());
