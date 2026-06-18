#!/usr/bin/env node
// Local block-no-verify guard — PreToolUse[Bash]
// Blocks `git commit/push --no-verify`, which silently bypasses git hooks.
// Zero-overhead local replacement for `npx block-no-verify` (no per-Bash npx spawn).
// Soft scope: only triggers when the command literally contains --no-verify.

let data = '';
const t = setTimeout(() => { process.stdout.write(data); process.exit(0); }, 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { data += c; });
process.stdin.on('end', () => {
  clearTimeout(t);
  try {
    const input = JSON.parse(data);
    if (input.tool_name === 'Bash') {
      const cmd = input.tool_input?.command || '';
      if (/\bgit\b/.test(cmd) && /\b(commit|push)\b/.test(cmd) && /--no-verify\b/.test(cmd)) {
        process.stderr.write(
          'BLOCKED: --no-verify bypasses git hooks (lint/tests/secret-scan). ' +
          'Fix the underlying issue instead of skipping the hook. ' +
          'If this is genuinely intended, ask the user to run the command manually.\n'
        );
        process.exit(2);
      }
    }
  } catch { /* never block on parse error */ }
  process.stdout.write(data);
  process.exit(0);
});
