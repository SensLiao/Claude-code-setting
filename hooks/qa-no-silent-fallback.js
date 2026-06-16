#!/usr/bin/env node
// qa-no-silent-fallback — PreToolUse[Write|Edit|MultiEdit] + Stop hook (P3, 2026-06-16)
//
// A QA evidence/bundle that records fallback_used:true (a degraded path was taken —
// e.g. a tool was missing and a weaker check substituted) MUST carry human
// attestation: a valid .qa/fallback-approval.json minted by
// `qa-sdk fallback.approve --human-attested`. Otherwise the degradation is silent.
//   PreToolUse[Write|Edit] writing fallback_used:true into .qa/** w/o approval → exit 2
//   Stop: any active-tag evidence with fallback_used:true w/o approval → block
//
// ADDITIVE: no fallback_used markers anywhere → NO-OP. Trust model mirrors
// approve.snapshot: --human-attested is a contract attestation (a human asserts the
// degraded path is acceptable), not a cryptographic proof — documented, not hidden.

const fs = require('fs');
const path = require('path');
const { readInput, preflight, getActiveReleaseTag, emitStopBlock } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);

const FALLBACK_RE = /fallback_used\s*[:=]\s*true|"fallback_used"\s*:\s*true/i;

function approvalValid(projectRoot) {
  if (!projectRoot) return false;
  const p = path.join(projectRoot, '.qa', 'fallback-approval.json');
  if (!fs.existsSync(p)) return false;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j.human_attested !== true) return false;
    if (j.expires_at) { const e = Date.parse(j.expires_at); if (Number.isFinite(e) && e < Date.now()) return false; }
    return true;
  } catch { return false; }
}

const tool = input.tool_name || input.tool || '';

// ── PreToolUse[Write|Edit|MultiEdit] branch ──
if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') {
  const ti = input.tool_input || {};
  const fp = String(ti.file_path || ti.path || '');
  if (!/\.qa[\\/]/.test(fp)) process.exit(0); // only guard writes under .qa/
  let content = '';
  if (typeof ti.content === 'string') content += ti.content;
  if (typeof ti.new_string === 'string') content += '\n' + ti.new_string;
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') content += '\n' + e.new_string;
  if (!FALLBACK_RE.test(content)) process.exit(0);
  const pRoot = pre.projectRoot;
  if (approvalValid(pRoot)) process.exit(0);
  if (pre.mode === 'warn') {
    process.stderr.write('[qa-no-silent-fallback] WARN: writing fallback_used:true without a valid .qa/fallback-approval.json\n');
    process.exit(0);
  }
  process.stderr.write('[qa-no-silent-fallback] BLOCKED: evidence records fallback_used:true but there is no valid .qa/fallback-approval.json (human attestation).\n');
  process.stderr.write('  Fix: bash "$HOME/.claude/scripts/qa-sdk.sh" fallback.approve --scope <layer> --reason <why> --hours <n> --human-attested\n');
  process.exit(2);
}

// ── Stop branch ──
if (input.stop_hook_active === true) process.exit(0);
if (pre.mode === 'fail-closed') { emitStopBlock(`QA no-silent-fallback: .qa/config.json ${pre.reason}.`); process.exit(0); }
const projectRoot = pre.projectRoot;
const { activeTag, activeDir } = getActiveReleaseTag(projectRoot);
if (!activeTag || !activeDir) process.exit(0);
if (approvalValid(projectRoot)) process.exit(0);

const offenders = [];
try {
  for (const f of fs.readdirSync(activeDir)) {
    let txt = ''; try { txt = fs.readFileSync(path.join(activeDir, f), 'utf8'); } catch { continue; }
    if (FALLBACK_RE.test(txt)) offenders.push(f);
  }
} catch {}
if (offenders.length === 0) process.exit(0);
if (pre.mode === 'warn') {
  process.stderr.write(`[qa-no-silent-fallback] WARN: fallback_used in ${offenders.join(', ')} without approval\n`);
  process.exit(0);
}
emitStopBlock([
  'QA no-silent-fallback gate failed — a degraded path was taken without human attestation:',
  ...offenders.map(o => `  - ${o} records fallback_used:true`),
  '',
  'Fix: bash "$HOME/.claude/scripts/qa-sdk.sh" fallback.approve --scope <layer> --reason <why> --hours <n> --human-attested,',
  'or remove the fallback and produce real evidence for that layer.',
].join('\n'));
process.exit(0);
