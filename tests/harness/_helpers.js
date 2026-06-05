'use strict';

/**
 * tests/harness/_helpers.js
 *
 * Tiny shared assertion + IO helpers for the harness tests. Built-ins only.
 *
 * Exit code convention (per PR-6 spec):
 *   0 = PASS  (all checks clean)
 *   1 = FAIL  (drift / assertion failed)
 *   2 = ERROR (infrastructure: missing file, parse error)
 *
 * Each test file should:
 *   const H = require('./_helpers');
 *   const h = new H.Harness('manifest-versions');
 *   h.assert(cond, "label");      // FAIL on false
 *   h.ok("label");                // PASS line
 *   h.warn("label");              // WARN line (non-blocking)
 *   h.error("label");             // INFRA error (sets exit 2)
 *   process.exit(h.exit());
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------- ANSI ---------------------------------------------------------
const isTTY = process.stdout.isTTY === true;
const noColor = process.env.NO_COLOR != null || process.env.CI === 'true';
function useColor() { return isTTY && !noColor; }
function color(c, s) {
  if (!useColor()) return s;
  const codes = {
    red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36,
    gray: 90, bold: 1, dim: 2, reset: 0,
  };
  return `\x1b[${codes[c] || 0}m${s}\x1b[0m`;
}

// ---------- Path resolution ---------------------------------------------
const claudeRoot = (function resolveRoot() {
  // tests/harness/<file>.js → claude root is two levels up
  return path.resolve(__dirname, '..', '..');
}());

function rel(p) {
  return path.relative(claudeRoot, p) || p;
}

// ---------- File IO -----------------------------------------------------
function existsSync(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; }
  catch (_e) { return false; }
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function stripJsonComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function readJson(p) {
  const raw = readText(p);
  return JSON.parse(stripJsonComments(raw));
}

// Walks every file under a directory non-recursively for a specific extension
function listFilesRecursive(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
    catch (_e) { continue; }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        // Skip vendor/node_modules / __pycache__ / .git
        if (
          ent.name === 'node_modules' ||
          ent.name === '__pycache__' ||
          ent.name === '.git' ||
          ent.name === '_backup-20260523-v4'
        ) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        if (!predicate || predicate(full, ent.name)) out.push(full);
      }
    }
  }
  return out;
}

// ---------- Harness class -----------------------------------------------
class Harness {
  constructor(name) {
    this.name = name;
    this.passes = 0;
    this.fails = 0;
    this.warns = 0;
    this.infraErrors = 0;
    this.startedAt = Date.now();
    this.printHeader();
  }

  printHeader() {
    const line = '='.repeat(72);
    console.log(color('cyan', line));
    console.log(color('bold', `  HARNESS TEST: ${this.name}`));
    console.log(color('cyan', line));
  }

  ok(label) {
    this.passes += 1;
    console.log(`  ${color('green', '[PASS]')} ${label}`);
  }

  fail(label, hint) {
    this.fails += 1;
    console.log(`  ${color('red', '[FAIL]')} ${label}`);
    if (hint) console.log(`         ${color('gray', hint)}`);
  }

  warn(label) {
    this.warns += 1;
    console.log(`  ${color('yellow', '[WARN]')} ${label}`);
  }

  error(label, hint) {
    this.infraErrors += 1;
    console.log(`  ${color('magenta', '[ERROR]')} ${label}`);
    if (hint) console.log(`          ${color('gray', hint)}`);
  }

  // True/false assertion. Returns true if passed (useful for chaining).
  assert(cond, label, hint) {
    if (cond) { this.ok(label); return true; }
    this.fail(label, hint);
    return false;
  }

  // Soft assert — records a warn rather than a fail
  assertSoft(cond, label, hint) {
    if (cond) { this.ok(label); return true; }
    this.warn(`${label}${hint ? ` — ${hint}` : ''}`);
    return false;
  }

  section(title) {
    console.log('');
    console.log(color('blue', `--- ${title} ---`));
  }

  exit() {
    const dur = Date.now() - this.startedAt;
    const line = '-'.repeat(72);
    console.log(color('gray', line));
    const parts = [
      `${color('green', `PASS:${this.passes}`)}`,
      `${color('red', `FAIL:${this.fails}`)}`,
      `${color('yellow', `WARN:${this.warns}`)}`,
      `${color('magenta', `ERROR:${this.infraErrors}`)}`,
      `${color('gray', `${dur}ms`)}`,
    ];
    const status =
      this.infraErrors > 0 ? color('magenta', 'ERROR')
      : this.fails > 0 ? color('red', 'FAIL')
      : color('green', 'PASS');
    console.log(`  Result: ${status}  ${parts.join('  ')}`);
    console.log('');
    if (this.infraErrors > 0) return 2;
    if (this.fails > 0) return 1;
    return 0;
  }
}

// ---------- Exports -----------------------------------------------------
module.exports = {
  Harness,
  claudeRoot,
  rel,
  existsSync,
  readText,
  readJson,
  stripJsonComments,
  listFilesRecursive,
  color,
};
