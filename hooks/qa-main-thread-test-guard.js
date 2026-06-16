#!/usr/bin/env node
// qa-main-thread-test-guard — PreToolUse Bash hook (P1, 2026-06-16)
//
// 承重柱 2: enforce SUBAGENT-ONLY test execution. The enterprise-qa contract is that
// the main orchestrator thread DISPATCHES test work to subagents and never runs tests
// itself (so the main context stays an auditable conductor, and every test run is an
// isolated, evidence-producing subagent). This is the ONE gate the platform can make a
// TRUE technical lock: the hook payload carries `agent_id` ONLY when a tool call
// originates inside a subagent (harness-set, unforgeable by the model). So:
//   test-runner command + NO agent_id (main thread)  → BLOCK (exit 2)
//   test-runner command + agent_id present (subagent) → ALLOW (exit 0)
//   non-test command / non-Bash / non-QA project     → ALLOW (exit 0)
//
// Honest caveats (documented, not hidden):
//   - Detection relies on the harness setting agent_id for subagent Bash calls. A
//     `--agent`-launched main session or a `fork` may not surface agent_id reliably;
//     QA dispatch must use named Agent-tool subagents (not fork) for the lock to hold.
//   - warn mode → advisory only; fresh/non-QA projects → silent (project-scoped enforcement).
//
// Pairs with qa-recompute-gate.js (承重柱 1). Installed project-local by `qa-sdk init`.

const { readInput, preflight } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);

// Non-QA project / enforcement off → silent allow.
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);

const tool = input.tool_name || input.tool || '';
if (tool !== 'Bash') process.exit(0);
const command = (input.tool_input && input.tool_input.command) || '';
if (!command) process.exit(0);

// Test-runner detection. Each pattern matches an actual test EXECUTION, narrowly, to
// avoid blocking unrelated build/dev commands. (Linters/typecheck alone are NOT here —
// this targets test/coverage/e2e/load/mutation/a11y/perf runners.)
const TEST_RUNNERS = [
  /\b(?:npx\s+)?vitest\b/,
  /\b(?:npx\s+)?jest\b/,
  /\b(?:npx\s+)?playwright\s+test\b/,
  /\b(?:npx\s+)?cypress\s+(?:run|open)\b/,
  /\b(?:npx\s+)?mocha\b/,
  /\b(?:npx\s+)?ava\b/,
  /\b(?:npx\s+)?nyc\b/,
  /\b(?:npx\s+)?stryker\s+run\b/,
  /\b(?:npx\s+)?newman\s+run\b/,
  /\b(?:npx\s+)?pa11y\b/,
  /\b(?:npx\s+)?lhci\b/,
  /\blighthouse\b/,
  /\bk6\s+run\b/,
  /\bpytest\b/,
  /\bpython\s+-m\s+pytest\b/,
  /\bgo\s+test\b/,
  /\bcargo\s+(?:test|mutants)\b/,
  /\bmutmut\s+run\b/,
  /\bmaestro\s+test\b/,
  /\bdetox\s+test\b/,
  /\bschemathesis\s+run\b/,
  /\bmvn\b[^|;&\n]*\btest\b/,
  /\bgradle\b[^|;&\n]*\btest\b/,
  /\bnpm\s+(?:run\s+)?test\b/,
  /\bnpm\s+run\s+test:[\w.-]+/,
  /\b(?:yarn|pnpm)\s+(?:run\s+)?test\b/,
];
const isTestRun = TEST_RUNNERS.some((re) => re.test(command));
if (!isTestRun) process.exit(0);

// Subagent origin? agent_id (or agent_type) present ⇒ a dispatched subagent ⇒ ALLOW.
const agentId = input.agent_id || input.agentId || input.subagent_id || '';
const agentType = input.agent_type || input.agentType || '';
const isSubagent = (typeof agentId === 'string' && agentId.trim() !== '')
                || (typeof agentType === 'string' && agentType.trim() !== '');
if (isSubagent) process.exit(0);

// Main thread running a test command.
if (pre.mode === 'warn') {
  process.stderr.write('[qa-main-thread-test-guard] WARN (qa_enforcement=warn): test command on the MAIN thread.\n');
  process.stderr.write(`  Command: ${command}\n`);
  process.stderr.write('  Policy: dispatch tests to a subagent (e.g. qa-static-baseline-runner / e2e-runner) so each run is isolated + evidence-producing.\n');
  process.exit(0);
}

// strict OR fail-closed (malformed config) → BLOCK.
process.stderr.write('[qa-main-thread-test-guard] BLOCKED: tests must run in a SUBAGENT, not the main orchestrator thread.\n');
process.stderr.write(`  Command: ${command}\n`);
if (pre.mode === 'fail-closed') process.stderr.write(`  (fail-closed: ${pre.reason})\n`);
process.stderr.write('  Why: the enterprise-qa contract keeps the main thread a dispatch-only conductor; every test run must be an isolated subagent that produces hashed evidence (qa-sdk evidence.run).\n');
process.stderr.write('  Fix: dispatch via the Agent tool to a qa-* runner subagent (qa-static-baseline-runner, qa-component-runner, e2e-runner, …). Do NOT use fork/--agent (agent_id must be set for the subagent allow-path).\n');
process.exit(2);
