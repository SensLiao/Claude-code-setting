#!/usr/bin/env node
/**
 * Self-test for qa-bundle-write-guard.js. Spawns the guard with simulated PreToolUse stdin
 * JSON in temp project dirs and asserts exit codes (0 allow / 2 block). QA-scoped derivation
 * of the sandbox verdict-write-guard self-test (the proven, codex round-4 CONFIRM-CLEAN suite),
 * keeping every QA-relevant case + the new qa_enforcement:"off" NO-OP case.
 * Run: node tests/harness/qa-bundle-write-guard.test.js — exit 0 all pass, 1 any failure. No deps.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GUARD = path.join(__dirname, '..', '..', 'hooks', 'qa-bundle-write-guard.js');
let pass = 0, fail = 0; const fails = [];
function check(name, cond) {
  if (cond) pass++; else { fail++; fails.push(name); process.stderr.write(`  x ${name}\n`); }
}

// Build a temp project with the given config files (relative paths). Returns its dir.
function mkProject(configs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwg-'));
  for (const rel of configs) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, rel.endsWith('.yaml') ? 'harness: {}\n' : '{}', 'utf8');
  }
  return dir;
}

function runGuard(cwd, payloadOrRaw) {
  const input = typeof payloadOrRaw === 'string' ? payloadOrRaw : JSON.stringify(payloadOrRaw);
  const r = spawnSync(process.execPath, [GUARD], { cwd, input, encoding: 'utf8' });
  return r.status;
}
function write(filePath, content) {
  return { tool_name: 'Write', tool_input: { file_path: filePath, content } };
}
function edit(filePath) {
  return { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' } };
}
function multiEdit(filePath) {
  return { tool_name: 'MultiEdit', tool_input: { file_path: filePath, edits: [{ old_string: 'a', new_string: 'b' }] } };
}

const QA_MARK = '# written-by: qa-sdk@3.2.0\n';
const UIUX_MARK = '# written-by: uiux-sdk@2.1.0\n';
const BODY = 'decision: PASS\nreason: ok\n';

const created = [];
function P(configs) { const d = mkProject(configs); created.push(d); return d; }

// 1/2/6/7/8/10/11 — core QA guard behavior.
{
  const d = P(['.qa/config.json']);
  const f = path.join(d, '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('qa bundle write w/o marker -> BLOCK (2)', runGuard(d, write(f, BODY)) === 2);
  check('qa bundle write WITH marker -> ALLOW (0)', runGuard(d, write(f, QA_MARK + BODY)) === 0);
  check('qa project, normal file -> ALLOW (0)', runGuard(d, write(path.join(d, 'src', 'x.js'), 'code')) === 0);
  const trav = d + '/.qa/sub/../evidence/t1/qa_evidence_bundle.yaml';
  check('qa bundle via ../ traversal w/o marker -> BLOCK (2)', runGuard(d, write(trav, BODY)) === 2);
  check('qa bundle with uiux marker -> BLOCK (2)', runGuard(d, write(f, UIUX_MARK + BODY)) === 2);
  check('qa project, malformed stdin -> BLOCK (2)', runGuard(d, '{not json') === 2);
  const caseVar = path.join(d, '.QA', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('qa bundle case-variant .QA w/o marker -> BLOCK (2)', runGuard(d, write(caseVar, BODY)) === 2);
}

// 3 — NO config project: qa bundle write -> NO-OP allow.
{
  const d = P([]);
  const f = path.join(d, '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('no-config project, qa bundle write -> ALLOW NO-OP (0)', runGuard(d, write(f, BODY)) === 0);
}

// Edit / MultiEdit blocked outright on the QA verdict path.
{
  const d = P(['.qa/config.json']);
  const f = path.join(d, '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('qa bundle Edit -> BLOCK (2)', runGuard(d, edit(f)) === 2);
  check('qa bundle MultiEdit -> BLOCK (2)', runGuard(d, multiEdit(f)) === 2);
}

// R1 — nested QA project BELOW cwd must still be guarded (target-dir anchoring, no depth cap).
{
  const mono = P([]);
  const cfg = path.join(mono, 'packages', 'app', '.qa', 'config.json');
  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  fs.writeFileSync(cfg, '{}', 'utf8');
  const nestedBundle = path.join(mono, 'packages', 'app', '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('R1 nested-project bundle w/o marker (cwd=monorepo root) -> BLOCK (2)', runGuard(mono, write(nestedBundle, BODY)) === 2);
  check('R1 nested-project bundle WITH marker -> ALLOW (0)', runGuard(mono, write(nestedBundle, QA_MARK + BODY)) === 0);
  const deepBundle = path.join(mono, 'packages', 'app', '.qa', 'evidence', 'a', 'b', 'c', 'd', 'e', 'f', 'gate-result.yaml');
  check('R1 deep nested-tag gate-result w/o marker -> BLOCK (2)', runGuard(mono, write(deepBundle, BODY)) === 2);
}

// R4 — all canonical QA verdict basenames + json variant + multi-segment tags.
{
  const d = P(['.qa/config.json']);
  const relDec = path.join(d, '.qa', 'evidence', 't1', 'release-decision.yaml');
  check('R4 qa release-decision.yaml w/o marker -> BLOCK (2)', runGuard(d, write(relDec, BODY)) === 2);
  const grJson = path.join(d, '.qa', 'evidence', 't1', 'gate-result.json');
  check('R4 qa gate-result.json w/o marker -> BLOCK (2)', runGuard(d, write(grJson, '{"decision":"PASS"}')) === 2);
  const nestedTag = path.join(d, '.qa', 'evidence', 'release', 'v1.2', 'gate-result.yaml');
  check('R4 qa multi-segment tag gate-result w/o marker -> BLOCK (2)', runGuard(d, write(nestedTag, BODY)) === 2);
}

// R5 — symlink/junction ancestor: a lexically-innocuous path that REAL-resolves into
// .qa/evidence must still be blocked. Skipped if the FS can't make a junction/symlink.
{
  const d = P(['.qa/config.json']);
  const realEvidenceTag = path.join(d, '.qa', 'evidence', 't1');
  fs.mkdirSync(realEvidenceTag, { recursive: true });
  const link = path.join(d, 'linkdir');
  let linked = true;
  try {
    fs.symlinkSync(path.join(d, '.qa', 'evidence'), link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch { linked = false; }
  if (linked) {
    const aliased = path.join(link, 't1', 'qa_evidence_bundle.yaml');
    check('R5 symlinked-ancestor alias into .qa/evidence w/o marker -> BLOCK (2)', runGuard(d, write(aliased, BODY)) === 2);
  } else {
    check('R5 symlink test skipped (FS cannot create junction) — counted pass', true);
  }
}

// R6 — malformed Write/Edit payloads fail-closed in a guarded project; NO-OP otherwise.
{
  const d = P(['.qa/config.json']);
  check('R6 empty stdin in guarded project -> BLOCK (2)', runGuard(d, '') === 2);
  check('R6 missing tool_name in guarded project -> BLOCK (2)', runGuard(d, { tool_input: { file_path: 'x.yaml' } }) === 2);
  check('R6 Write missing file_path in guarded project -> BLOCK (2)', runGuard(d, { tool_name: 'Write', tool_input: { content: 'x' } }) === 2);
  check('R6 non-write tool (Read) in guarded project -> ALLOW (0)', runGuard(d, { tool_name: 'Read', tool_input: { file_path: 'x' } }) === 0);
  const n = P([]);
  check('R6 empty stdin in no-config project -> ALLOW (0)', runGuard(n, '') === 0);
  check('R6 Write missing file_path in no-config project -> ALLOW (0)', runGuard(n, { tool_name: 'Write', tool_input: { content: 'x' } }) === 0);
}

// R2-1 — symlink/junction alias whose QA config is NOT in the lexical ancestor chain (config
// lives in a nested project; the alias sits at the outer repo). Must still BLOCK via the
// real-target root search. Skipped if the FS can't make a junction/symlink.
{
  const mono = P([]);
  const appQa = path.join(mono, 'packages', 'app', '.qa');
  fs.mkdirSync(path.join(appQa, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(appQa, 'config.json'), '{}', 'utf8');
  const alias = path.join(mono, 'alias');
  let linked = true;
  try { fs.symlinkSync(path.join(appQa, 'evidence'), alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch { linked = false; }
  if (linked) {
    const aliased = path.join(alias, 'run', 'gate-result.yaml');
    check('R2-1 alias into nested .qa/evidence (config not in lexical chain) w/o marker -> BLOCK (2)', runGuard(mono, write(aliased, BODY)) === 2);
    check('R2-1 same alias WITH qa marker -> ALLOW (0)', runGuard(mono, write(aliased, QA_MARK + BODY)) === 0);
  } else {
    check('R2-1 alias test skipped (FS cannot create junction) — counted pass', true);
    check('R2-1 alias marker test skipped (FS cannot create junction) — counted pass', true);
  }
}

// R2-2 — non-string tool_name fails closed in a guarded project, NO-OP in an unrelated repo.
{
  const d = P(['.qa/config.json']);
  check('R2-2 non-string tool_name {} in guarded project -> BLOCK (2)', runGuard(d, { tool_name: {}, tool_input: { file_path: 'x.yaml' } }) === 2);
  const n = P([]);
  check('R2-2 non-string tool_name {} in no-config project -> ALLOW (0)', runGuard(n, { tool_name: {}, tool_input: { file_path: 'x.yaml' } }) === 0);
}

// R3-1 — a nested same-subsystem config nearer on the walk-up must NOT mask the OUTER protected
// evidence root. Target is inside the OUTER evidence but not the nested one.
{
  const out = P(['.qa/config.json']);
  const target = path.join(out, '.qa', 'evidence', 't1', 'gate-result.yaml');
  const maskCfg = path.join(out, '.qa', 'evidence', '.qa', 'config.json');
  fs.mkdirSync(path.dirname(maskCfg), { recursive: true });
  fs.writeFileSync(maskCfg, '{}', 'utf8');
  check('R3-1 nested config does not mask outer protected root -> BLOCK (2)', runGuard(out, write(target, BODY)) === 2);
}

// QA-specific — qa_enforcement switch. off => NO-OP allow; warn/strict => enforce (block).
{
  const off = P([]);
  fs.mkdirSync(path.join(off, '.qa'), { recursive: true });
  fs.writeFileSync(path.join(off, '.qa', 'config.json'), JSON.stringify({ qa_enforcement: 'off' }), 'utf8');
  const offBundle = path.join(off, '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('qa_enforcement=off, bundle write w/o marker -> ALLOW NO-OP (0)', runGuard(off, write(offBundle, BODY)) === 0);
  check('qa_enforcement=off, bundle Edit -> ALLOW NO-OP (0)', runGuard(off, edit(offBundle)) === 0);

  const warn = P([]);
  fs.mkdirSync(path.join(warn, '.qa'), { recursive: true });
  fs.writeFileSync(path.join(warn, '.qa', 'config.json'), JSON.stringify({ qa_enforcement: 'warn' }), 'utf8');
  const warnBundle = path.join(warn, '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('qa_enforcement=warn, bundle write w/o marker -> BLOCK (2)', runGuard(warn, write(warnBundle, BODY)) === 2);

  const strict = P([]);
  fs.mkdirSync(path.join(strict, '.qa'), { recursive: true });
  fs.writeFileSync(path.join(strict, '.qa', 'config.json'), JSON.stringify({ qa_enforcement: 'strict' }), 'utf8');
  const strictBundle = path.join(strict, '.qa', 'evidence', 't1', 'qa_evidence_bundle.yaml');
  check('qa_enforcement=strict, bundle write WITH marker -> ALLOW (0)', runGuard(strict, write(strictBundle, QA_MARK + BODY)) === 0);
}

for (const d of created) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

process.stdout.write(`\nqa-bundle-write-guard self-test: ${pass} passed, ${fail} failed\n`);
if (fail) { process.stderr.write(`FAILURES:\n  - ${fails.join('\n  - ')}\n`); process.exit(1); }
process.exit(0);
