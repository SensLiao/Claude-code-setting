#!/usr/bin/env node
'use strict';
/**
 * shared/git-context.js — best-effort git provenance for the run ledger.
 *
 * The audit found git context (repo / branch / commit_before / commit_after)
 * was NEVER captured, so cross-run history was unanswerable. This helper folds
 * it in. Fully best-effort: a non-git dir, missing git, or any failure returns
 * nulls rather than throwing — the ledger append must never fail because of git.
 *
 * Usage (library):  const { gitContext } = require('./git-context.js')
 * Usage (CLI):      node shared/git-context.js [<cwd>]
 */
const cp = require('child_process');
const path = require('path');

function gitField(args, cwd) {
  try {
    const r = cp.spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    if (!r || r.status !== 0 || typeof r.stdout !== 'string') return null;
    const out = r.stdout.trim();
    return out.length ? out : null;
  } catch (_e) {
    return null;
  }
}

function gitContext(cwd) {
  cwd = cwd || process.cwd();
  const inside = gitField(['rev-parse', '--is-inside-work-tree'], cwd);
  if (inside !== 'true') {
    return { repo: null, repo_path: null, branch: null, commit_before: null, git_dirty: null };
  }
  const top = gitField(['rev-parse', '--show-toplevel'], cwd);
  const branch = gitField(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const commit = gitField(['rev-parse', 'HEAD'], cwd);
  const status = gitField(['status', '--porcelain'], cwd);
  return {
    repo: top ? path.basename(top) : null,
    repo_path: top || null,
    branch: branch === 'HEAD' ? '(detached)' : branch,
    commit_before: commit,
    git_dirty: status == null ? null : status.length > 0,
  };
}

module.exports = { gitContext, gitField };

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  process.stdout.write(JSON.stringify(gitContext(cwd), null, 2) + '\n');
}
