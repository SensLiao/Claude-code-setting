#!/usr/bin/env node
'use strict';
/**
 * shared/run-ledger.js — append-only run ledger (the harness "black box").
 *
 * WHY: run-fingerprint.js computed the hard 80% (execution_fingerprint, agent/
 * policy hashes) but wrote it to stdout and threw it away; sentinel + gate
 * decision + git context were never joined. Cross-run history was unanswerable.
 * This joins them into ONE append-only row per run.
 *
 * WHERE: <project>/.harness/runs.jsonl when a project root is found (portable —
 * travels with the repo, handoff-ready). Else ~/.claude/state/run-ledger.jsonl
 * (harness-self runs). One JSON object per line (JSONL).
 *
 * This is NOT a gate. It records; it never decides. (Governed verdicts stay with
 * the deterministic gate.check + spec_hash approval — CLAUDE.md §3.7.)
 *
 * CLI:
 *   echo '<json>' | node run-ledger.js append --stdin [--project <root>] [--k=v ...]
 *   node run-ledger.js append --record '<json>' [--project <root>]
 *   node run-ledger.js list  [--project <root>] [--limit N]
 *   node run-ledger.js show  --run-id <id> [--project <root>]
 *   node run-ledger.js path  [--project <root>]            # print resolved ledger path
 *
 * Library: const { appendRun, readRows, resolveLedgerPath } = require('./run-ledger.js')
 *
 * Date note: this is a normal Node CLI (NOT a Workflow script), so new Date() is
 * allowed and correct here — the Workflow-resumability ban does not apply.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { gitContext } = require('./git-context.js');

const LEDGER_SCHEMA_VERSION = '1.0.0';
const ARRAY_FIELDS = new Set(['skills_used', 'agents_used', 'hooks_triggered', 'mcp_tools_used', 'evidence_refs', 'human_approvals']);
const PROJECT_MARKERS = ['.harness', '.appsec', '.qa', '.uiux', '.planning', '.git', 'package.json', 'discoverability.config.yaml', 'go.mod', 'Cargo.toml', 'pyproject.toml'];

function findProjectRoot(start) {
  let dir = path.resolve(start || process.cwd());
  const root = path.parse(dir).root;
  // guard against pointing at the harness home itself (that is "no project")
  const harnessHome = path.join(os.homedir(), '.claude');
  for (;;) {
    if (dir !== harnessHome) {
      for (const m of PROJECT_MARKERS) {
        if (fs.existsSync(path.join(dir, m))) return dir;
      }
    }
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

function resolveLedgerPath(opts = {}) {
  if (opts.file) return path.resolve(opts.file);
  const projectRoot = opts.project ? path.resolve(opts.project) : findProjectRoot(opts.cwd);
  if (projectRoot) return path.join(projectRoot, '.harness', 'runs.jsonl');
  return path.join(os.homedir(), '.claude', 'state', 'run-ledger.jsonl');
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function coerceArrays(rec) {
  for (const k of Object.keys(rec)) {
    if (ARRAY_FIELDS.has(k) && typeof rec[k] === 'string') {
      rec[k] = rec[k].split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return rec;
}

function appendRun(record, opts = {}) {
  const ledgerPath = resolveLedgerPath(opts);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const cwdForGit = opts.project || record.repo_path || opts.cwd || path.dirname(ledgerPath);
  const git = opts.noGit ? {} : gitContext(cwdForGit);
  const row = Object.assign(
    { ledger_schema_version: LEDGER_SCHEMA_VERSION, ts: record.ts || nowIso() },
    git,
    coerceArrays({ ...record }),
  );
  if (!row.run_id) row.run_id = `run-${String(row.ts).replace(/[:.TZ-]/g, '')}`;
  if (!row.decision) row.decision = 'RECORDED';
  fs.appendFileSync(ledgerPath, JSON.stringify(row) + '\n', 'utf8');
  return { ledgerPath, row };
}

function readRows(opts = {}) {
  const ledgerPath = resolveLedgerPath(opts);
  if (!fs.existsSync(ledgerPath)) return { ledgerPath, rows: [] };
  const rows = fs.readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  return { ledgerPath, rows };
}

module.exports = { appendRun, readRows, resolveLedgerPath, findProjectRoot, LEDGER_SCHEMA_VERSION };

// --------------------------- CLI -------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'help';
  const opts = { cwd: process.cwd() };
  const fields = {};
  let recordJson = null;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') opts.project = argv[++i];
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--record') recordJson = argv[++i];
    else if (a === '--stdin') { try { recordJson = fs.readFileSync(0, 'utf8'); } catch { recordJson = ''; } }
    else if (a === '--no-git') opts.noGit = true;
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a === '--run-id') opts.runId = argv[++i];
    else if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      fields[a.slice(2, eq)] = a.slice(eq + 1);
    }
  }

  function buildRecord() {
    let base = {};
    if (recordJson && recordJson.trim()) {
      try { base = JSON.parse(recordJson); }
      catch (e) { process.stderr.write(`run-ledger: bad --record/--stdin JSON: ${e.message}\n`); process.exit(1); }
    }
    return Object.assign(base, fields);
  }

  if (cmd === 'append') {
    const { ledgerPath, row } = appendRun(buildRecord(), opts);
    process.stdout.write(`run-ledger: appended → ${ledgerPath}\n`);
    process.stdout.write(`  ${row.ts}  ${row.decision}  ${row.run_id}  ${row.subsystem || '-'}/${row.stage || '-'}\n`);
    process.exit(0);
  } else if (cmd === 'list') {
    const { ledgerPath, rows } = readRows(opts);
    const slice = opts.limit ? rows.slice(-opts.limit) : rows;
    process.stdout.write(`run-ledger: ${ledgerPath} (${rows.length} rows)\n`);
    for (const r of slice) {
      process.stdout.write(`  ${r.ts}  ${String(r.decision).padEnd(16)}  ${r.run_id}  ${r.subsystem || '-'}/${r.stage || '-'}  ${r.commit_before ? r.commit_before.slice(0, 8) : '--------'}\n`);
    }
    process.exit(0);
  } else if (cmd === 'show') {
    const { rows } = readRows(opts);
    const hits = rows.filter((r) => !opts.runId || r.run_id === opts.runId);
    process.stdout.write(JSON.stringify(hits, null, 2) + '\n');
    process.exit(0);
  } else if (cmd === 'path') {
    process.stdout.write(resolveLedgerPath(opts) + '\n');
    process.exit(0);
  } else {
    process.stderr.write('Usage: run-ledger.js <append|list|show|path> [--project <root>] [--stdin|--record <json>] [--k=v] [--limit N] [--run-id <id>]\n');
    process.exit(cmd === 'help' ? 0 : 2);
  }
}
