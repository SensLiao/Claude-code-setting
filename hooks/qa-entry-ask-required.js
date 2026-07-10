#!/usr/bin/env node
// qa-entry-ask-required — PreToolUse[Bash] hook (P4 entry gate; intake upgrade 2026-06-22)
//
// Platform honesty (CLAUDE.md §0.1 / blueprint §1): a hook CANNOT see AskUserQuestion
// or which skill is active, so "the ask MUST be the first action" is NOT enforceable.
// What IS enforceable: block QA EVIDENCE/GATE commands until a COMPLETE intake was
// recorded — keyed off the substitute file .qa/state/intake.json that SKILL §6 Step 0
// writes (via `qa-sdk intake.write`) right after the AskUserQuestion.
//
// Upgrade (2026-06-22): the bar is no longer "a level was picked" — it is "all four
// required intake fields are present": level / scope (change-set) / mode /
// acceptance_criteria.source. This mirrors GSD's required-populated-artifact pattern and
// closes the "QA runs without asking the user anything / no change-set / no standard"
// gap. Legacy .qa/state/level-selected.json alone NO LONGER unblocks.
//
// NARROW by design — only `qa-sdk … evidence.run|evidence.append|gate.check` is gated;
// every other Bash command is untouched (zero collateral). intake.write / level.select /
// init / sentinel are NOT matched (they are the unblocking/setup actions). FAIL-OPEN on
// any internal error: this is a productivity gate, not a safety gate — a bug must never
// brick a QA run.

const fs = require('fs');
const path = require('path');
const { readInput, preflight } = require('./_qa-common.js');

try {
  const input = readInput();
  const pre = preflight(input);
  if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);

  const tool = input.tool_name || input.tool || '';
  if (tool !== 'Bash') process.exit(0);
  const cmd = (input.tool_input && input.tool_input.command) || '';
  // Gate ONLY QA evidence/gate-producing commands.
  if (!/qa-sdk(?:\.sh)?["'\s]*\s+(?:evidence\.run|evidence\.append|gate\.check)\b/.test(cmd)) process.exit(0);

  const root = pre.projectRoot;
  if (!root) process.exit(0);

  // Resolve which intake fields are missing/empty.
  const intakeFile = path.join(root, '.qa', 'state', 'intake.json');
  let intake = null;
  try { intake = JSON.parse(fs.readFileSync(intakeFile, 'utf8')); } catch {}
  const missing = [];
  if (!intake || typeof intake !== 'object') {
    missing.push('intake.json (run `qa-sdk intake.write`)');
  } else {
    if (!intake.level) missing.push('level (L1-L4)');
    if (!intake.scope || !intake.scope.kind || !intake.scope.detail) missing.push('scope.kind + scope.detail (the change-set / target under test)');
    if (!intake.mode) missing.push('mode (execution|plan-only|design-only)');
    if (!intake.acceptance_criteria || !intake.acceptance_criteria.source) missing.push('acceptance_criteria.source (what defines "correct" — gsd-plan|user-inline|none-acknowledged)');
    if (!intake.decided_by) missing.push('decided_by (must be "user" — real user intake)');
    else if (intake.decided_by !== 'user') missing.push(`decided_by='${intake.decided_by}' — QA requires REAL user input; a self-defaulted (model-default) intake is NOT accepted. Re-run Step 0's AskUserQuestion with the user present, then qa-sdk intake.write --decided-by user.`);
  }
  if (missing.length === 0) process.exit(0); // complete intake → allow

  const list = missing.map(m => '    - ' + m).join('\n');
  if (pre.mode === 'warn') {
    process.stderr.write('[qa-entry-ask-required] WARN: a QA evidence/gate command ran before intake was complete. Missing:\n' + list + '\n');
    process.stderr.write('  SKILL §6 Step 0 should AskUserQuestion (level / scope / mode / acceptance) then `qa-sdk intake.write ...`.\n');
    process.exit(0);
  }
  process.stderr.write('[qa-entry-ask-required] BLOCKED: collect the QA intake before producing evidence. Missing:\n' + list + '\n');
  process.stderr.write('  Honest note: the platform cannot force "ask first"; this gate instead blocks QA evidence/gate commands until a COMPLETE .qa/state/intake.json exists.\n');
  process.stderr.write('  Fix: SKILL §6 Step 0 — AskUserQuestion (level L1-L4 / scope=change-set / mode / acceptance-criteria source), then:\n');
  process.stderr.write('    bash "$HOME/.claude/scripts/qa-sdk.sh" intake.write --level L<n> --scope-kind <k> --scope-detail "<...>" --mode <m> --acceptance <src> [--acceptance-detail "<...>"]\n');
  process.exit(2);
} catch (e) {
  // FAIL-OPEN — never brick a QA run on this productivity gate's own error.
  process.exit(0);
}
