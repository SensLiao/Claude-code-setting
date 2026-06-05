#!/usr/bin/env node
// uiux-release-guard — dual-mode hook:
//   PreToolUse(Skill) matching /gsd-ship → require uiux_release_decision.yaml present with PASS|CONDITIONAL_PASS
//   Stop                                  → if assistant text claims "UI done / shipping ready / 上线就绪" without valid decision, block
//
// SKILL.md §6 + references/gsd-bridge-contract.md §3 Step 8.
// Strict: hard block. Lax: warn. Silent if no .uiux/config.json.

'use strict';

const {
  readInputSafe, preflight,
  getInvokedSkillName, isGsdCommand,
  getActiveReleaseTag, findReleaseDecision,
  emitStopBlock,
  preToolBlockMessage, preToolWarnMessage,
} = require('./_uiux-common.js');

const { input, parseError } = readInputSafe();
if (parseError) {
  const pre0 = preflight({});
  if (pre0.mode === 'silent') process.exit(0);
  // For Stop hook fail-closed via emitStopBlock; for PreToolUse via stderr+exit2.
  // Detect event by hookEventName if available
  const evName = (input && input.hook_event_name) || '';
  if (evName === 'Stop') {
    emitStopBlock(`release-guard fail-closed: stdin JSON parse failed (${parseError})`);
    process.exit(0);
  }
  preToolBlockMessage(`release-guard fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}

const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

const eventName = input.hook_event_name || '';
const toolName = input.tool_name || input.tool || '';

const projectRoot = pre.projectRoot;

function getDecision() {
  const tag = getActiveReleaseTag(projectRoot);
  if (!tag) return { tag: null, dec: null };
  const d = findReleaseDecision(projectRoot, tag);
  return { tag, dec: d };
}

// ───── PreToolUse branch ─────
if (toolName === 'Skill') {
  const skill = getInvokedSkillName(input);
  if (!isGsdCommand(skill, 'gsd-ship')) process.exit(0);

  if (pre.mode === 'fail-closed') {
    preToolBlockMessage(`release-guard fail-closed: ${pre.reason}`);
    process.exit(2);
  }

  const { tag, dec } = getDecision();
  if (!tag) {
    const reason = `release-guard BLOCKED: no active release tag in .uiux/state.json. Run 'uiux-sdk init <tag>' first.`;
    if (pre.mode === 'warn') { preToolWarnMessage(reason); process.exit(0); }
    preToolBlockMessage(reason);
    process.exit(2);
  }
  if (!dec) {
    const reason = `release-guard BLOCKED: no uiux_release_decision.yaml for tag '${tag}'. ` +
      `Run 'uiux-sdk decision.write ${tag}' or invoke uiux-gsd-contract-validator agent.`;
    if (pre.mode === 'warn') { preToolWarnMessage(reason); process.exit(0); }
    preToolBlockMessage(reason);
    process.exit(2);
  }
  if (dec.decision !== 'PASS' && dec.decision !== 'CONDITIONAL_PASS') {
    const reason = `release-guard BLOCKED: uiux_release_decision='${dec.decision}' (not PASS/CONDITIONAL_PASS). See ${dec.path}.`;
    if (pre.mode === 'warn') { preToolWarnMessage(reason); process.exit(0); }
    preToolBlockMessage(reason);
    process.exit(2);
  }
  process.exit(0);
}

// ───── Stop branch ─────
if (eventName === 'Stop' || (!toolName && !eventName)) {
  // Inspect last assistant message for "ui done" / "shipping ready" / "上线就绪" / etc.
  // NOTE: JS regex \b is ASCII-only and never matches a boundary adjacent to CJK characters,
  // so CJK triggers MUST NOT be inside the \b group.
  const lastMsg = (input.last_assistant_message || input.transcript_excerpt || '') + '';
  const claimPatternEN = /\b(ui\s*done|shipping\s*ready|design\s*complete)\b/i;
  const claimPatternCJK = /(上线就绪|UI\s*完成|UIUX\s*完成|设计完成|前端完成)/i;
  if (!claimPatternEN.test(lastMsg) && !claimPatternCJK.test(lastMsg)) process.exit(0);

  if (pre.mode === 'fail-closed') {
    emitStopBlock(`release-guard fail-closed: ${pre.reason}`);
    process.exit(0);
  }

  const { tag, dec } = getDecision();
  // FIX 2026-06-01 (uiux premature-arm false-positive): the Stop hook is a SOFT nag,
  // NOT the hard release gate (that is the /gsd-ship PreToolUse branch above +
  // `uiux-sdk gate.ship`). It only fires on a GENUINE contradiction — a release
  // decision that EXISTS and is not PASS/CONDITIONAL_PASS while completion is claimed.
  // "No active release tag" (no release in progress) and "tag armed but decision not
  // yet written" (normal mid-build) are NOT violations → must pass, otherwise any
  // stray completion phrase in ordinary output blocks the turn. Hard release safety
  // is unchanged: /gsd-ship still requires a PASS/CONDITIONAL_PASS decision.
  if (tag && dec && dec.decision !== 'PASS' && dec.decision !== 'CONDITIONAL_PASS') {
    if (pre.mode === 'warn') { preToolWarnMessage(`release-guard Stop warn: decision is ${dec.decision}`); process.exit(0); }
    emitStopBlock(`release-guard Stop BLOCKED: assistant claimed UI/shipping completion but decision='${dec.decision}'.`);
    process.exit(0);
  }
  process.exit(0);
}

process.exit(0);
