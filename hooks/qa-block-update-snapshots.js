#!/usr/bin/env node
// qa-block-update-snapshots — PreToolUse Bash hook
// Blocks snapshot baseline updates without a valid, scoped, human-attestable approval.
// HIGH fixes: H-01 root via walk-up, H-02 fail-closed, H-09 stronger approval validation
// MEDIUM fixes: M-01 warn-mode advisory, M-08 narrower runner detection

const fs = require('fs');
const path = require('path');
const { readInput, preflight } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);

// Non-QA project — silent
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);

const tool = input.tool_name || input.tool || '';
if (tool !== 'Bash') process.exit(0);
const command = (input.tool_input && input.tool_input.command) || '';
if (!command) process.exit(0);

// Narrow snapshot-update detection — only match known test-runner invocations with their flags.
// Each pattern must include the runner name AND a snapshot-update flag.
const RUNNER_PATTERNS = [
  // Playwright
  /\bplaywright(\s+test)?\b[^|;&\n]*\s(?:--update-snapshots|-u)\b/,
  /\bnpx\s+playwright(\s+test)?\b[^|;&\n]*\s(?:--update-snapshots|-u)\b/,
  // Jest
  /\bjest\b[^|;&\n]*\s(?:--updateSnapshot|-u)\b/,
  /\bnpx\s+jest\b[^|;&\n]*\s(?:--updateSnapshot|-u)\b/,
  // Vitest
  /\bvitest\b[^|;&\n]*\s(?:--update|-u)\b/,
  /\bnpx\s+vitest\b[^|;&\n]*\s(?:--update|-u)\b/,
  // Cypress image snapshots (community plugin)
  /\bcypress\b[^|;&\n]*--env\s+updateSnapshots=true/,
];
const isSnapshotUpdate = RUNNER_PATTERNS.some(p => p.test(command));
if (!isSnapshotUpdate) process.exit(0);

// Fail-closed if config malformed
if (pre.mode === 'fail-closed') {
  process.stderr.write(`[qa-block-update-snapshots] BLOCKED (fail-closed): ${pre.reason}\n`);
  process.stderr.write(`  Fix .qa/config.json before running snapshot updates.\n`);
  process.exit(2);
}

const approvalPath = path.join(pre.projectRoot, '.qa', 'snapshot-update-approval.json');
function deny(reason, suggest) {
  process.stderr.write(`[qa-block-update-snapshots] BLOCKED: ${reason}\n`);
  process.stderr.write(`  Command: ${command}\n`);
  if (suggest) process.stderr.write(`  ${suggest}\n`);
  process.stderr.write(`  Required: ${approvalPath} must contain { approver, approved_at, expires_at, scope[], reason, command_pattern, human_attested }\n`);
  process.stderr.write(`  Run: bash "$HOME/.claude/scripts/qa-sdk.sh" approve.snapshot --scope "<route-list>" --reason "<text>" --hours <1-24> --pattern "<runner-pattern>"\n`);
  process.exit(2);
}
function warnOnly(reason) {
  process.stderr.write(`[qa-block-update-snapshots] WARN (qa_enforcement=warn): ${reason}\n`);
  process.stderr.write(`  Command: ${command}\n`);
  process.exit(0);
}
const reject = (pre.mode === 'warn') ? warnOnly : deny;

if (!fs.existsSync(approvalPath)) reject('no snapshot-update-approval.json found');

let approval;
try { approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8')); } catch { reject('approval file is not valid JSON'); }

const required = ['approver', 'approved_at', 'expires_at', 'scope', 'reason', 'command_pattern', 'human_attested'];
const missing = required.filter(f => approval[f] === undefined || approval[f] === null || approval[f] === '');
if (missing.length) reject(`approval missing required fields: ${missing.join(', ')}`);

if (approval.human_attested !== true) reject('approval.human_attested must be true (Claude cannot self-mint approvals)');

if (!Array.isArray(approval.scope) || approval.scope.length === 0) reject('approval.scope must be a non-empty array');
if (typeof approval.reason !== 'string' || approval.reason.trim().length < 8) reject('approval.reason too short or missing');
if (typeof approval.command_pattern !== 'string' || approval.command_pattern.length === 0) reject('approval.command_pattern missing');

const now = Date.now();
const approvedAt = Date.parse(approval.approved_at);
const expires = Date.parse(approval.expires_at);
if (!Number.isFinite(approvedAt)) reject('approval.approved_at is not a valid ISO8601 date');
if (!Number.isFinite(expires))   reject('approval.expires_at is not a valid ISO8601 date');
if (approvedAt > now + 5 * 60 * 1000) reject(`approval.approved_at is in the future (${approval.approved_at})`);
if (expires < now) reject(`approval expired at ${approval.expires_at}`);
if (expires - approvedAt > 24 * 3600 * 1000) reject('approval window exceeds 24 hours');
if (expires - approvedAt <= 0) reject('approval window non-positive');

// Command-pattern match — approval must specifically authorize this command shape.
let patternRe;
try { patternRe = new RegExp(approval.command_pattern); } catch { reject(`approval.command_pattern is not a valid regex: ${approval.command_pattern}`); }
if (!patternRe.test(command)) {
  reject(`approval.command_pattern (${approval.command_pattern}) does not match current command`,
    `If you intended to authorize this command, regenerate approval with the matching pattern.`);
}

process.exit(0);
