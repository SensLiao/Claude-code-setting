#!/usr/bin/env node
// qa-evidence-required — Stop hook (synchronous, must NOT be async)
// HIGH fix: H-01 root walk-up, H-02 fail-closed, H-06 anchored regex + validated risk-acceptance
// MEDIUM fix: M-10 active tag from .qa/state.json (with mtime fallback)

const fs = require('fs');
const path = require('path');
const { readInput, preflight, getActiveReleaseTag, emitStopBlock } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);

// Avoid infinite block loops per Claude Code hook spec
if (input.stop_hook_active === true) {
  process.stderr.write(`[qa-evidence-required] stop_hook_active=true — yielding to avoid loop. Address findings manually.\n`);
  process.exit(0);
}

// Fail-closed on malformed config
if (pre.mode === 'fail-closed') {
  emitStopBlock(`QA evidence gate failed: .qa/config.json ${pre.reason}. Fix the config before claiming done.`);
  process.exit(0);
}

const projectRoot = pre.projectRoot;
const config = pre.config;
const gate = config.stop_gate || { block_on_missing_bundle: true, block_on_failed_decision: true, allow_conditional_pass: true };

const evidenceRoot = path.join(projectRoot, '.qa', 'evidence');
if (!fs.existsSync(evidenceRoot)) process.exit(0);  // no QA run ever happened in this project — nothing to gate

const { activeTag, activeDir } = getActiveReleaseTag(projectRoot);
if (!activeTag || !activeDir) process.exit(0);

// If the active dir was last touched > 24h ago and state.json is absent, this is a stale tag — don't gate
// (state.json takes precedence; only fall back to mtime when no state file)
const statePath = path.join(projectRoot, '.qa', 'state.json');
if (!fs.existsSync(statePath)) {
  let mtime = 0;
  try { mtime = fs.statSync(activeDir).mtimeMs; } catch {}
  if (Date.now() - mtime > 24 * 3600 * 1000) process.exit(0);
}

const bundlePath = path.join(activeDir, 'qa_evidence_bundle.yaml');
const acceptancePath = path.join(projectRoot, '.qa', 'risk-acceptance.yaml');

function loadBundleDecision() {
  if (!fs.existsSync(bundlePath)) return { found: false };
  let text = '';
  try { text = fs.readFileSync(bundlePath, 'utf8'); } catch { return { found: false }; }
  // Strip comments before parsing
  const noComments = text.replace(/^\s*#.*$/gm, '');
  // Anchored to start-of-line + indent up to top-level OR one-nested under qa_evidence_bundle:
  // Accept either `release_decision: X` at column 0 or `  release_decision: X` directly inside `qa_evidence_bundle:`
  const m = noComments.match(/^[ \t]{0,4}release_decision[ \t]*:[ \t]*([A-Z_]+)\s*$/m);
  if (!m) return { found: true, decisionUnknown: true };
  return { found: true, decision: m[1] };
}

function validateRiskAcceptance(forTag) {
  if (!fs.existsSync(acceptancePath)) return { ok: false, reason: 'not present' };
  let text = '';
  try { text = fs.readFileSync(acceptancePath, 'utf8'); } catch { return { ok: false, reason: 'unreadable' }; }
  const noComments = text.replace(/^\s*#.*$/gm, '');
  // Required fields: approver, approved_at, expires_at, release_tag, accepted_decision, scope, reason
  function field(name) {
    const re = new RegExp(`^[ \\t]{0,4}${name}[ \\t]*:[ \\t]*(.+)$`, 'm');
    const m = noComments.match(re);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  }
  const approver = field('approver');
  const approvedAt = field('approved_at');
  const expiresAt = field('expires_at');
  const releaseTag = field('release_tag');
  const acceptedDecision = field('accepted_decision');
  const reason = field('reason');
  const missing = [];
  if (!approver)         missing.push('approver');
  if (!approvedAt)       missing.push('approved_at');
  if (!expiresAt)        missing.push('expires_at');
  if (!releaseTag)       missing.push('release_tag');
  if (!acceptedDecision) missing.push('accepted_decision');
  if (!reason)           missing.push('reason');
  if (missing.length) return { ok: false, reason: `missing fields: ${missing.join(', ')}` };
  if (releaseTag !== forTag) return { ok: false, reason: `release_tag '${releaseTag}' does not match active '${forTag}'` };
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'expires_at not parseable' };
  if (exp < Date.now()) return { ok: false, reason: 'risk-acceptance expired' };
  if (approver.toLowerCase().includes('claude')) return { ok: false, reason: 'approver must not be "claude" (human attestation required)' };
  return { ok: true, acceptedDecision };
}

const reasons = [];
const bundleInfo = loadBundleDecision();
if (!bundleInfo.found) {
  if (gate.block_on_missing_bundle) reasons.push(`qa_evidence_bundle.yaml missing in ${activeDir}`);
} else if (bundleInfo.decisionUnknown) {
  if (gate.block_on_missing_bundle) reasons.push(`qa_evidence_bundle.yaml present but release_decision is missing/malformed at top level`);
} else {
  const decision = bundleInfo.decision;
  if (decision === 'PASS' || decision === 'STRATEGY_READY') {
    // STRATEGY_READY only allowed if config.default_mode is design-only — otherwise gate
    if (decision === 'STRATEGY_READY' && (config.default_mode || 'execution') === 'execution') {
      if (gate.block_on_failed_decision) reasons.push(`release_decision=STRATEGY_READY is not valid in execution mode (default_mode=${config.default_mode})`);
    }
  } else if (decision === 'FAIL') {
    if (gate.block_on_failed_decision) {
      const ra = validateRiskAcceptance(activeTag);
      if (!ra.ok) reasons.push(`release_decision=FAIL and no valid risk-acceptance.yaml (${ra.reason})`);
      else if (ra.acceptedDecision !== 'FAIL') reasons.push(`risk-acceptance.accepted_decision='${ra.acceptedDecision}' does not authorize FAIL`);
    }
  } else if (decision === 'BLOCKED') {
    if (gate.block_on_failed_decision) reasons.push(`release_decision=BLOCKED — Claude must not claim done`);
  } else if (decision === 'CONDITIONAL_PASS') {
    if (!gate.allow_conditional_pass) {
      reasons.push(`release_decision=CONDITIONAL_PASS but config disallows`);
    } else {
      const ra = validateRiskAcceptance(activeTag);
      if (!ra.ok) reasons.push(`CONDITIONAL_PASS requires valid .qa/risk-acceptance.yaml (${ra.reason})`);
      else if (ra.acceptedDecision !== 'CONDITIONAL_PASS') reasons.push(`risk-acceptance.accepted_decision='${ra.acceptedDecision}' does not authorize CONDITIONAL_PASS`);
    }
  } else {
    // Unknown decision — block
    if (gate.block_on_failed_decision) reasons.push(`release_decision='${decision}' is not a recognized value (expected PASS|FAIL|BLOCKED|CONDITIONAL_PASS|STRATEGY_READY)`);
  }
}

// dispatch-failures.log non-empty
const failuresLog = path.join(activeDir, 'dispatch-failures.log');
if (fs.existsSync(failuresLog)) {
  try {
    const txt = fs.readFileSync(failuresLog, 'utf8');
    if (txt.trim().length > 0) reasons.push(`dispatch-failures.log non-empty — at least one dispatch failed`);
  } catch {}
}

if (reasons.length === 0) process.exit(0);

if (pre.mode === 'warn') {
  process.stderr.write(`[qa-evidence-required] WARN (qa_enforcement=warn):\n`);
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.exit(0);
}

const message = [
  'QA evidence gate failed — cannot mark session done:',
  ...reasons.map(r => `  - ${r}`),
  '',
  `Active tag: ${activeTag}`,
  `Inspect: ${activeDir}`,
  `Resolve by running enterprise-qa-testing §6 Step 9 to produce qa_evidence_bundle.yaml,`,
  `or write .qa/risk-acceptance.yaml (approver+expires_at+release_tag+accepted_decision+scope+reason) with human sign-off.`,
].join('\n');
emitStopBlock(message);
process.exit(0);
