#!/usr/bin/env node
// qa-entry-ask-required — PreToolUse[Bash] hook (P4 soft entry gate, 2026-06-16)
//
// Platform honesty (CLAUDE.md §0.1 / blueprint §1): a hook CANNOT see AskUserQuestion
// or which skill is active, so "the ask MUST be the first action" is NOT enforceable.
// What IS enforceable: block QA EVIDENCE/GATE commands until a level was chosen — keyed
// off the substitute file .qa/state/level-selected.json that SKILL §6 Step 0 writes
// (via `qa-sdk level.select`) right after the AskUserQuestion.
//
// NARROW by design — only `qa-sdk … evidence.run|evidence.append|gate.check` is gated;
// every other Bash command is untouched (zero collateral). level.select / init / sentinel
// are NOT matched (they are the unblocking/setup actions). FAIL-OPEN on any internal error:
// this is a productivity gate, not a safety gate — a bug must never brick a QA run.

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
  const levelFile = path.join(root, '.qa', 'state', 'level-selected.json');
  if (fs.existsSync(levelFile)) process.exit(0); // level chosen → allow

  if (pre.mode === 'warn') {
    process.stderr.write('[qa-entry-ask-required] WARN: a QA evidence/gate command ran before a QA level (L1-L4) was selected.\n');
    process.stderr.write('  SKILL §6 Step 0 should AskUserQuestion then `qa-sdk level.select L<n>`.\n');
    process.exit(0);
  }
  process.stderr.write('[qa-entry-ask-required] BLOCKED: select a QA level before producing evidence.\n');
  process.stderr.write('  Honest note: the platform cannot force "ask first"; this gate instead blocks QA evidence/gate commands until a level-selected.json exists.\n');
  process.stderr.write('  Fix: SKILL §6 Step 0 — AskUserQuestion (L1 quick / L2 PR-gate / L3 release / L4 commercial-cert), then `bash "$HOME/.claude/scripts/qa-sdk.sh" level.select L<n>`.\n');
  process.exit(2);
} catch (e) {
  // FAIL-OPEN — never brick a QA run on this productivity gate's own error.
  process.exit(0);
}
