#!/usr/bin/env node
// uiux-gsd-plan-guard — PreToolUse(Skill) hook (sync block on /gsd-plan-phase when UI-SPEC missing)
// SKILL.md §3 Step 3. Strict: exit 2. Lax: warn + exit 0. Silent if no .uiux/config.json.

'use strict';

const {
  readInputSafe, preflight, loadPlanningConfig,
  getInvokedSkillName, isGsdCommand,
  findUiSpecForPhase, phaseIsFrontend,
  preToolBlockMessage, preToolWarnMessage,
} = require('./_uiux-common.js');

const { input, parseError } = readInputSafe();
if (parseError) {
  // PreToolUse fail-closed when uiux is enabled; silent when not
  const pre0 = preflight({});
  if (pre0.mode === 'silent') process.exit(0);
  preToolBlockMessage(`gsd-plan-guard fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}

const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

// Only act on Skill invocations
const toolName = input.tool_name || input.tool || '';
if (toolName !== 'Skill') process.exit(0);

const skill = getInvokedSkillName(input);
if (!isGsdCommand(skill, 'gsd-plan-phase')) process.exit(0);

if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`gsd-plan-guard fail-closed: ${pre.reason}`);
  process.exit(2);
}

// Extract phase number — try tool_input.args / phase / N
const ti = input.tool_input || {};
let phase = ti.phase || ti.N || ti.args || '';
// Try to extract a leading number/word from args string
if (typeof phase === 'string') {
  const m = phase.match(/^\s*([A-Za-z0-9._-]+)/);
  if (m) phase = m[1];
}
if (!phase) {
  // Couldn't determine phase — be conservative; don't block
  process.exit(0);
}

const projectRoot = pre.projectRoot;

// Respect GSD config: if workflow.ui_safety_gate === false, skip
const pl = loadPlanningConfig(projectRoot);
if (pl && pl.workflow && pl.workflow.ui_safety_gate === false) {
  process.exit(0);
}

// Respect GSD config: if workflow.ui_phase === false, skip
if (pl && pl.workflow && pl.workflow.ui_phase === false) {
  process.exit(0);
}

// If not a frontend phase, skip
if (!phaseIsFrontend(projectRoot, String(phase))) {
  process.exit(0);
}

// Check UI-SPEC presence
const ui_spec = findUiSpecForPhase(projectRoot, String(phase));
if (ui_spec) {
  process.exit(0);
}

const reason = `gsd-plan-guard BLOCKED: phase '${phase}' is frontend/UI but no UI-SPEC.md found ` +
  `under .planning/phases/${phase}*/. Run /gsd-ui-phase ${phase} before /gsd-plan-phase ${phase}.`;

if (pre.mode === 'warn') {
  preToolWarnMessage(reason);
  process.exit(0);
}

preToolBlockMessage(reason);
process.exit(2);
