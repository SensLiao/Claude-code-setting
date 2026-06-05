#!/usr/bin/env node
/**
 * Regression tests for pre-bash-commit-quality.js
 *
 * Created: 2026-05-23 (v4.0.3)
 * Backstop for: H2-B HIGH-3 finding (v4.1.0 batch 1 audit)
 *
 * Bug history:
 *   Before fix: `function run(rawInput) { return evaluate(rawInput).output; }`
 *               → returns a STRING (the .output property)
 *               → run-with-flags.js emitHookResult() treats string returns as
 *                 pass-through with exitCode 0
 *               → ALL blocking findings (debugger;, exposed secrets, etc.)
 *                 silently failed to block, despite evaluate() correctly
 *                 returning exitCode 2.
 *
 *   After fix:  `function run(rawInput) { return evaluate(rawInput); }`
 *               → returns the WHOLE object {output, exitCode}
 *               → emitHookResult() correctly propagates exit code
 *
 * Run: node __tests__/pre-bash-commit-quality.test.js
 * (No test framework needed — uses Node's built-in assert module)
 */

const assert = require('assert');
const path = require('path');

const HOOK_PATH = path.join(__dirname, '..', 'pre-bash-commit-quality.js');
const { run, evaluate } = require(HOOK_PATH);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${e.message}`);
    if (e.stack) console.error(`    ${e.stack.split('\n').slice(1, 3).join('\n    ')}`);
    failed++;
  }
}

console.log('pre-bash-commit-quality.js — regression suite');
console.log('================================================');

// ── Anti-regression: run() must return object, not string ────────────
test('run() returns object shape (H2-B HIGH-3 anti-regression)', () => {
  const input = JSON.stringify({ tool_input: { command: 'ls -la' } });
  const result = run(input);

  assert.notStrictEqual(
    typeof result, 'string',
    'REGRESSION: run() returns string instead of object. ' +
    'Did someone change "return evaluate(rawInput)" back to ' +
    '"return evaluate(rawInput).output"? See H2-B HIGH-3 finding ' +
    '(v4.1.0 batch 1 audit, fixed in v4.0.3).'
  );
  assert.strictEqual(typeof result, 'object', 'run() must return object');
  assert.ok(result !== null, 'run() must not return null');
  assert.ok('output' in result, 'result must have .output property');
  assert.ok('exitCode' in result, 'result must have .exitCode property');
  assert.strictEqual(
    typeof result.exitCode, 'number',
    'exitCode must be a number for emitHookResult() to use as process.exit()'
  );
});

// ── Behavior: non-git-commit pass-through ──────────────────────────
test('Non-git-commit command returns exitCode 0 (pass-through)', () => {
  const input = JSON.stringify({ tool_input: { command: 'ls -la' } });
  const result = run(input);
  assert.strictEqual(result.exitCode, 0,
    'Non-git command must pass through with exitCode 0');
  assert.strictEqual(result.output, input,
    'Non-git command must echo input through stdout (passthrough)');
});

// ── Behavior: --amend skip ────────────────────────────────────────
test('git commit --amend skips checks (exitCode 0)', () => {
  const input = JSON.stringify({
    tool_input: { command: 'git commit --amend --no-edit' }
  });
  const result = run(input);
  assert.strictEqual(result.exitCode, 0,
    'git commit --amend must skip checks');
});

// ── No information loss: run() === evaluate() ──────────────────────
test('run() returns identical value to evaluate() (no info loss)', () => {
  const input = JSON.stringify({ tool_input: { command: 'ls -la' } });
  const evalResult = evaluate(input);
  const runResult = run(input);
  assert.deepStrictEqual(
    runResult, evalResult,
    'run() must return EXACTLY what evaluate() returns. ' +
    'If they differ, the v4.0.3 fix has been broken again — run() is ' +
    'dropping or modifying the exitCode/output the runner needs.'
  );
});

// ── Malformed input handling ──────────────────────────────────────
test('Malformed JSON input does not throw, returns exitCode 0', () => {
  const result = run('not valid json at all');
  assert.strictEqual(typeof result, 'object',
    'Even malformed input must return object shape');
  assert.strictEqual(result.exitCode, 0,
    'Malformed JSON should fail-open (exitCode 0), not crash');
});

// ── Empty input handling ───────────────────────────────────────────
test('Empty input returns exitCode 0', () => {
  const result = run('');
  assert.strictEqual(typeof result, 'object');
  assert.strictEqual(result.exitCode, 0);
});

// ── Summary ────────────────────────────────────────────────────────
console.log('================================================');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\nRegression test suite FAILED.');
  console.error('Restore the v4.0.3 fix or document why the change was made.');
  process.exit(1);
}
process.exit(0);
