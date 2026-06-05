#!/usr/bin/env node
// disc-evidence-required — Stop hook (sync block via decision:'block' JSON)
// L12 Discoverability harness contract §7.5.
//
// When the assistant claims discoverability work is done (English + 中文
// patterns per claimPatternsForStop()) AND there is an active L12 run AND
// the evidence is missing / failing / stale, emit a Stop block.
// `stop_hook_active === true` short-circuits to avoid infinite loops.

'use strict';

const {
  readInputSafe,
  preflight,
  getActiveRunTag,
  loadGateResult,
  claimPatternsForStop,
  emitStopBlock,
} = require('./_disc-common.js');

const { input, parseError } = readInputSafe();
if (parseError) {
  emitStopBlock(`evidence-required fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(0);
}
const safeInput = input || {};

// Avoid Stop loops
if (safeInput.stop_hook_active === true) {
  process.stderr.write(`[disc-evidence-required] stop_hook_active=true — yielding to avoid loop.\n`);
  process.exit(0);
}

const pre = preflight(safeInput);
if (pre.mode === 'silent' || pre.mode === 'disabled') process.exit(0);
if (pre.mode === 'fail-closed') {
  emitStopBlock(`L12 evidence-required gate failed: ${pre.reason}. Fix discoverability.config.yaml before continuing.`);
  process.exit(0);
}

const harness = (pre.config && pre.config.harness) || {};
const hookModes = harness.hook_modes || {};
const modeSetting = hookModes.evidence_required || 'block';
if (modeSetting === 'off') process.exit(0);

const projectRoot = pre.projectRoot;
const { activeTag, activeRun, gateStatus } = getActiveRunTag(projectRoot);

// If there's no active L12 run, this hook is a no-op (don't gate every Stop).
if (!activeRun) process.exit(0);

// Extract assistant text from common fields
function extractAssistantText(inp) {
  const parts = [];
  if (typeof inp.last_assistant_message === 'string') parts.push(inp.last_assistant_message);
  if (typeof inp.assistant_message === 'string') parts.push(inp.assistant_message);
  if (Array.isArray(inp.messages)) {
    for (const m of inp.messages) {
      if (m && m.role === 'assistant') {
        if (typeof m.content === 'string') parts.push(m.content);
        if (Array.isArray(m.content)) {
          for (const c of m.content) if (c && typeof c.text === 'string') parts.push(c.text);
        }
      }
    }
  }
  return parts.join('\n');
}

const text = extractAssistantText(safeInput);
if (!text) process.exit(0);

const claimRes = claimPatternsForStop();
const claimed = claimRes.some(re => re.test(text));
if (!claimed) process.exit(0);

// Claim made — now verify evidence.
const reasons = [];

if (!activeTag) {
  reasons.push(
    `assistant claimed "discoverability/SEO/AEO/ASO done" but no active_run_tag in .discoverability/state.json`
  );
} else {
  const gr = loadGateResult(projectRoot, activeTag);
  if (!gr.exists) {
    reasons.push(
      `evidence/discoverability/${activeTag}/gate-result.yaml does not exist — ` +
      `cannot mark L12 done without running \`discoverability-sdk gate.check ${activeTag}\``
    );
  } else if (!gr.decision) {
    reasons.push(`gate-result.yaml exists but decision field is missing or malformed`);
  } else if (gr.decision !== 'PASS' && gr.decision !== 'WARN') {
    reasons.push(`gate-result.yaml decision='${gr.decision}' — only PASS or WARN are valid; FAIL/BLOCKED/STALE cannot be claimed as done`);
  }
  if (gateStatus === 'STALE') {
    reasons.push(`state.json gate_status=STALE — a triggering file was edited after the last gate.check; rerun gate.check before claiming done`);
  }
}

if (reasons.length === 0) {
  process.exit(0);  // claim verified
}

// Warn mode
if (modeSetting === 'warn' || pre.mode === 'warn') {
  process.stderr.write(`[disc-evidence-required] WARN (claim not blocked):\n`);
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.exit(0);
}

// Block mode
const message = [
  'L12 Discoverability evidence-required gate (§7.5) failed — cannot mark session done:',
  ...reasons.map(r => `  - ${r}`),
  '',
  activeTag ? `Active tag: ${activeTag}` : `No active tag — run \`discoverability-sdk init <tag>\` first.`,
  'Resolve by completing the 8-step orchestrator workflow (discoverability-orchestrator SKILL.md §10)',
  'and ensuring gate-result.yaml decision is PASS or WARN.',
].join('\n');
emitStopBlock(message);
process.exit(0);
