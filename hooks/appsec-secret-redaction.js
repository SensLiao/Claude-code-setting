#!/usr/bin/env node
// appsec-secret-redaction — Stop hook (SYNC block, strict, NEVER downgradable)
// SKILL.md §18.1. Last-line defense: scan final assistant message for raw secrets.
// Strict for all modes (including lax) — secret leakage is terminal.

'use strict';

const { readInputSafe, preflight, detectSecrets, readLastAssistantText, emitStopBlock } = require('./_appsec-common.js');

// ★ P7 fix (Tier 1 #1): JSON.parse failure must NOT silently fall through.
// Stop-hook fail-closed: emitStopBlock + exit 0 per SKILL.md §18.0 Stop block contract.
const { input, parseError } = readInputSafe();
if (parseError) {
  emitStopBlock(`secret-redaction fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(0);
}
const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

// Avoid infinite block loop
if (input.stop_hook_active === true) {
  process.stderr.write(`[appsec-secret-redaction] stop_hook_active=true — yielding to avoid loop. Address secret leakage manually.\n`);
  process.exit(0);
}

if (pre.mode === 'fail-closed') {
  emitStopBlock(`AppSec secret-redaction gate failed: ${pre.reason}. Fix the config before continuing.`);
  process.exit(0);
}

// Scan the final assistant turn. On current Claude Code the Stop payload omits the
// message text inline, so readLastAssistantText falls back to the transcript_path JSONL
// tail — this is what lets the last-line defense actually see what the model said.
const candidates = [];
const finalText = readLastAssistantText(input, 256);
if (finalText) candidates.push(finalText);
// Defense-in-depth: also serialize the raw payload (catches secrets that leaked into
// hook metadata even when transcript reading fails).
candidates.push(JSON.stringify(input));

const allHits = [];
for (const text of candidates) {
  const hits = detectSecrets(text);
  for (const h of hits) {
    if (!allHits.find(x => x.name === h.name)) allHits.push(h);
  }
}

if (allHits.length === 0) process.exit(0);

// NEVER downgradable. Strict block in all modes (lax/warn ignored here — secret leak is terminal).
const message = [
  'AppSec secret-redaction gate (§18.1) failed — cannot stop session:',
  `  Detected ${allHits.length} secret pattern(s) in assistant output:`,
  ...allHits.map(h => `    - ${h.name} → ${h.sample}`),
  '',
  'Raw secret values must NEVER reach chat / transcript / report.',
  'Pipe outputs through `appsec-sdk redact` before responding.',
  'See SKILL.md §18.1.',
].join('\n');
emitStopBlock(message);
process.exit(0);
