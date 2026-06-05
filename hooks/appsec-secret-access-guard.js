#!/usr/bin/env node
// appsec-secret-access-guard — PreToolUse(Read|Bash) hook (sync block, exit 2)
// SKILL.md §18.6. Blocks reads/cats/printenv against PRODUCTION secrets: bare .env /
// .env.production / .env.prod / .env.staging / *.pem / *.key / credentials.json /
// id_rsa* / *.kdbx / .keyring.
// Stage carve-out (2026-06-03): dev/test env files (.env.dev / .env.development /
// .env.local / .env.test / .env.testing / .env.ci / .env.e2e, + project dev_secret_globs)
// are ALLOWED for read/edit/source — only production secrets stay off-limits.
// Explicitly allows .env.example / .env.sample / .env.template (shape references).

'use strict';

const {
  readInputSafe, preflight, isSensitivePath, bashAttemptsSecretRead, preToolBlockMessage,
} = require('./_appsec-common.js');

// ★ P7 fix (Tier 1 #1): fail-closed PreToolUse on JSON parse failure
const { input, parseError } = readInputSafe();
if (parseError) {
  preToolBlockMessage(`secret-access-guard fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}
const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

const toolName = input.tool_name || input.tool || '';
const tinp = input.tool_input || {};

if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`secret-access-guard fail-closed: ${pre.reason}`);
  process.exit(2);
}

if (toolName === 'Read') {
  const fp = tinp.file_path || tinp.path || '';
  if (isSensitivePath(fp, pre.config)) {
    preToolBlockMessage(
      `secret-access-guard BLOCKED: Read of sensitive path '${fp}' is forbidden. ` +
      `Per SKILL.md §18.6, production secrets (.env / .env.production / *.pem / *.key / ` +
      `credentials.json / id_rsa* / *.kdbx / .keyring) are off-limits. ` +
      `Dev/test env (.env.dev / .env.local / .env.test …) IS editable — use those during development, ` +
      `or .env.example for shape reference.`
    );
    process.exit(2);
  }
  process.exit(0);
}

if (toolName === 'Bash') {
  const cmd = tinp.command || '';
  const reason = bashAttemptsSecretRead(cmd, pre.config);
  if (reason) {
    preToolBlockMessage(
      `secret-access-guard BLOCKED: ${reason}. Bash command: ${cmd.slice(0, 200)}${cmd.length > 200 ? '…' : ''}. ` +
      `Per SKILL.md §18.6. (Dev/test env files are allowlisted — only production secrets are blocked.)`
    );
    process.exit(2);
  }
  process.exit(0);
}

// Other tools — let through
process.exit(0);
