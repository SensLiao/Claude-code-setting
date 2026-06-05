#!/usr/bin/env node
// qa-quarantine-accountability — PreToolUse Bash hook (gated on git commit)
// HIGH fix: H-01 root walk-up, H-02 fail-closed, H-07 use spawnSync array args (no shell injection)
// MEDIUM fix: M-01 warn-mode advisory, M-07 strip quotes + accept empty list

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { readInput, preflight } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);

const tool = input.tool_name || input.tool || '';
if (tool !== 'Bash') process.exit(0);
const command = (input.tool_input && input.tool_input.command) || '';
if (!/^\s*git\s+commit\b/.test(command)) process.exit(0);

if (pre.mode === 'fail-closed') {
  process.stderr.write(`[qa-quarantine-accountability] BLOCKED (fail-closed): ${pre.reason}\n`);
  process.exit(2);
}

const projectRoot = pre.projectRoot;

function gitRun(args) {
  const r = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return r.stdout || '';
}

const stagedNames = gitRun(['diff', '--cached', '--name-only']);
if (stagedNames === null) process.exit(0);
const stagedFiles = stagedNames.split('\n').map(s => s.trim()).filter(Boolean);

// Normalize for matching
const normalized = stagedFiles.map(f => f.replace(/\\/g, '/'));
const quarantineStaged = normalized.some(f => f === '.qa/quarantine.yaml');
const testFilesAdded = stagedFiles.filter(f => /\.(test|spec)\.(t|j)sx?$/i.test(f));

if (!quarantineStaged && testFilesAdded.length === 0) process.exit(0);

function deny(reasons) {
  process.stderr.write(`[qa-quarantine-accountability] BLOCKED: git commit rejected\n`);
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.stderr.write(`\nRequired 8 fields per quarantine entry: test_name, failure_class, owner, issue_id, expiry_date, reproduction_command, last_seen, unblock_condition\n`);
  process.stderr.write(`Use: bash "$HOME/.claude/scripts/qa-sdk.sh" quarantine.add --test <name> --owner <id> --issue <url> --expiry <YYYY-MM-DD> --repro "<cmd>" --unblock "<cond>"\n`);
  process.exit(2);
}
function warnEmit(reasons) {
  process.stderr.write(`[qa-quarantine-accountability] WARN (qa_enforcement=warn):\n`);
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.exit(0);
}
const reject = (pre.mode === 'warn') ? warnEmit : deny;

const REQUIRED = ['test_name', 'failure_class', 'owner', 'issue_id', 'expiry_date', 'reproduction_command', 'last_seen', 'unblock_condition'];

function stripQuotes(s) {
  if (typeof s !== 'string') return s;
  let v = s.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

function parseQuarantine(text) {
  const lines = text.split(/\r?\n/);
  // First, detect explicit empty list: `quarantine: []`
  for (const lineRaw of lines) {
    const l = lineRaw.trim();
    if (/^#/.test(l) || l === '') continue;
    const emptyMatch = l.match(/^quarantine\s*:\s*\[\s*\]\s*$/);
    if (emptyMatch) return { entries: [], emptyList: true };
    if (/^quarantine\s*:/.test(l)) break;
  }
  const entries = [];
  let cur = null;
  let inList = false;
  for (const lineRaw of lines) {
    const line = lineRaw.replace(/\t/g, '    ');
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    if (/^quarantine\s*:\s*$/.test(line)) { inList = true; continue; }
    if (!inList) continue;
    const newEntry = line.match(/^\s*-\s+(\w+)\s*:\s*(.*)$/);
    if (newEntry) {
      if (cur) entries.push(cur);
      cur = {};
      cur[newEntry[1]] = stripQuotes(newEntry[2]);
      continue;
    }
    const kv = line.match(/^\s+(\w+)\s*:\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = stripQuotes(kv[2]);
  }
  if (cur) entries.push(cur);
  return { entries, emptyList: false };
}

const reasons = [];

if (quarantineStaged) {
  const stagedYaml = gitRun(['show', ':./.qa/quarantine.yaml']);
  if (stagedYaml === null || stagedYaml.trim() === '') {
    // empty file is OK only if it's truly empty
  } else {
    const { entries, emptyList } = parseQuarantine(stagedYaml);
    if (!emptyList && entries.length === 0) {
      // YAML present but no list parsed — only fail if file is non-trivial
      if (stagedYaml.trim().length > 30) reasons.push('.qa/quarantine.yaml staged but no `quarantine:` list parsed');
    }
    entries.forEach((entry, idx) => {
      const placeholders = /^(\?|tbd|todo|n\/a|none|null)$/i;
      const missing = REQUIRED.filter(k => {
        const v = entry[k];
        return v === undefined || v === '' || placeholders.test(String(v));
      });
      if (missing.length) {
        const name = entry.test_name || `<entry #${idx + 1}>`;
        reasons.push(`quarantine entry '${name}' missing/placeholder fields: ${missing.join(', ')}`);
      }
      if (entry.expiry_date) {
        const exp = Date.parse(entry.expiry_date);
        if (!Number.isFinite(exp)) {
          reasons.push(`quarantine entry '${entry.test_name}' expiry_date is not a valid date`);
        } else {
          const days = (exp - Date.now()) / 86400000;
          if (days < 0) reasons.push(`quarantine entry '${entry.test_name}' expiry_date already past`);
          if (days > 14) reasons.push(`quarantine entry '${entry.test_name}' expiry_date > 14 days (max 14 days, 7 for critical paths)`);
        }
      }
    });
  }
}

if (testFilesAdded.length > 0) {
  // Use array args — no shell, no injection (H-07)
  const args = ['diff', '--cached', '--unified=0', '--'].concat(testFilesAdded);
  const stagedDiff = gitRun(args);
  if (stagedDiff !== null) {
    const skipPattern = /^\+(?!\+\+).*\b((?:test|it|describe)\.skip|xit\b|xtest\b|xdescribe\b)/m;
    if (skipPattern.test(stagedDiff) && !quarantineStaged) {
      reasons.push('staged test files add `.skip` / `xit` / `xtest` but no matching .qa/quarantine.yaml entry staged');
    }
  }
}

if (reasons.length > 0) reject(reasons);
process.exit(0);
