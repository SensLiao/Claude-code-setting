#!/usr/bin/env node
// qa-tasklist-required — PreToolUse[Bash] hook (P4 soft reminder, 2026-06-16)
//
// Platform honesty: native TaskCreate/TaskUpdate BYPASS hooks entirely (blueprint §1,
// issue #20243) and don't survive /clear, so the durable, hook-visible substitute is
// .qa/state/tasklist.json (a Write the hook CAN see, persisted across context resets).
// This hook is ADVISORY — it NEVER blocks: if a QA evidence/gate command runs with no
// tasklist.json, it nudges to build one. Mirrors the global plan-card-reminder pattern
// (soft, fail-open). NARROW match (same QA commands as qa-entry-ask-required).

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
  if (!/qa-sdk(?:\.sh)?["'\s]*\s+(?:evidence\.run|evidence\.append|gate\.check)\b/.test(cmd)) process.exit(0);

  const root = pre.projectRoot;
  if (!root) process.exit(0);
  const tlFile = path.join(root, '.qa', 'state', 'tasklist.json');
  if (fs.existsSync(tlFile)) process.exit(0);

  process.stderr.write('[qa-tasklist-required] reminder (advisory): no .qa/state/tasklist.json. SKILL §6 Step 0.5 should TaskCreate + `qa-sdk tasklist.write` a durable QA to-do that survives /clear.\n');
  process.exit(0); // NEVER blocks
} catch (e) {
  process.exit(0);
}
