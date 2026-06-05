#!/usr/bin/env node
// uiux-style-mutex-guard — PreToolUse(Skill) hook (sync block on L3 style mutex violations)
// SKILL.md §4 + references/style-lock-policy.md.
// Behavior:
//   1. If invoked skill is in WORKFLOW_NOT_STYLE list AND there's no L3 lock yet → block as "cannot use workflow skill before L3 lock"
//   2. If invoked skill is an L3 family AND a different L3 family is already locked → block
//   3. Same L3 family / not an L3 at all → pass through
// Silent if no .uiux/config.json.

'use strict';

const {
  readInputSafe, preflight,
  getInvokedSkillName,
  skillToL3Family, isWorkflowSkill,
  readStyleLockFamily,
  preToolBlockMessage, preToolWarnMessage,
} = require('./_uiux-common.js');

const { input, parseError } = readInputSafe();
if (parseError) {
  const pre0 = preflight({});
  if (pre0.mode === 'silent') process.exit(0);
  preToolBlockMessage(`style-mutex-guard fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}

const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

const toolName = input.tool_name || input.tool || '';
if (toolName !== 'Skill') process.exit(0);

if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`style-mutex-guard fail-closed: ${pre.reason}`);
  process.exit(2);
}

const skill = getInvokedSkillName(input);
if (!skill) process.exit(0);

const projectRoot = pre.projectRoot;
const lockedFamily = readStyleLockFamily(projectRoot);
const invokedFamily = skillToL3Family(skill);
const isWorkflow = isWorkflowSkill(skill);

// Case 1: workflow skill before L3 is locked → block (a.k.a. "decide style first")
if (isWorkflow && !lockedFamily) {
  const reason = `style-mutex-guard BLOCKED: workflow skill '${skill}' invoked before any L3 style locked. ` +
    `Decide and lock an L3 style first (taste|luxury|minimalist|soft|brutalist|gpt-tasteskill) via uiux-sdk lock.style.`;
  if (pre.mode === 'warn') { preToolWarnMessage(reason); process.exit(0); }
  preToolBlockMessage(reason);
  process.exit(2);
}

// Case 2: L3 invoked but a different L3 already locked
if (invokedFamily && lockedFamily && invokedFamily !== lockedFamily) {
  const reason = `style-mutex-guard BLOCKED: L3 style mutex violation. Locked='${lockedFamily}', attempted='${invokedFamily}' ` +
    `(via skill '${skill}'). Use 'uiux-sdk lock.style <tag> <skill> --force --reason "<≥30 chars>"' to relock.`;
  if (pre.mode === 'warn') { preToolWarnMessage(reason); process.exit(0); }
  preToolBlockMessage(reason);
  process.exit(2);
}

// Case 3: L3 invoked with no current lock → permissible (the orchestrator should call lock.style after)
// Case 4: same family → permissible
// Case 5: not an L3 and not a workflow blacklist → permissible

process.exit(0);
