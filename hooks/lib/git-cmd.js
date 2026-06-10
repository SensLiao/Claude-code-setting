'use strict';
/**
 * hooks/lib/git-cmd.js — canonical git-command-line classifier for GSD hooks.
 *
 * Used by hooks/gsd-validate-commit.sh (Conventional Commits gate). The .sh shells out:
 *     GIT_CMD_LIB=".../lib/git-cmd.js" node -e "
 *       const {isGitSubcommand}=require(process.env.GIT_CMD_LIB);
 *       process.exit(isGitSubcommand(process.argv[1],'commit')?0:1);
 *     " "$CMD"
 * i.e. isGitSubcommand(<full command string>, <subcommand name>) → boolean.
 *
 * Why this exists (HIGH gap hooks-B#3): without it the require() threw MODULE_NOT_FOUND,
 * the surrounding `if` treated EVERY commit as "not a git commit", and the gate silently
 * passed ALL commits in opt-in (hooks.community=true) projects. The .sh comment documented
 * the breakage but the file was never vendored.
 *
 * A naive /^git\s+commit/ regex misses three real invocation shapes the token-walk handles:
 *   1. env-prefix:        env GIT_AUTHOR_NAME=x git commit -m "..."
 *   2. -C / -c options:   git -C /path -c key=val commit -m "..."
 *   3. full-path git:     /usr/bin/git commit   ·   "C:\Program Files\Git\bin\git.exe" commit
 *
 * Node built-ins only. No throw — bad input returns false (fail-safe: a malformed command
 * is simply "not a commit", so the gate does not block it spuriously; real `git commit`
 * lines still classify correctly).
 */

// git global options that take a VALUE argument (so the next token is consumed, not the
// subcommand). From `git help` global options. -c/-C/--git-dir/--work-tree/--namespace/--exec-path(=)
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix']);

// Tokenize a shell-ish command line: respect single/double quotes, drop the quotes.
// Good enough for classification (we don't need perfect POSIX word-splitting, just to find
// the git binary token and the first non-option token after it).
function tokenize(cmd) {
  const tokens = [];
  let cur = '';
  let quote = null;
  let has = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) { quote = null; }
      else { cur += ch; }
      has = true;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; has = true; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (has) { tokens.push(cur); cur = ''; has = false; }
      continue;
    }
    cur += ch;
    has = true;
  }
  if (has) tokens.push(cur);
  return tokens;
}

// Is this token a `git` binary invocation? Handles bare `git`, full path `/usr/bin/git`,
// and Windows `...\git.exe` (case-insensitive on the .exe / basename).
function isGitBinary(tok) {
  if (!tok) return false;
  // strip a trailing ; or & that might cling after splitting on operators upstream
  const t = tok.replace(/[;&|]+$/, '');
  // basename after the last / or \
  const base = t.split(/[\\/]/).pop().toLowerCase();
  return base === 'git' || base === 'git.exe';
}

/**
 * isGitSubcommand(cmd, sub) — true iff `cmd` is a git invocation whose subcommand is `sub`.
 * @param {string} cmd  full command line (e.g. `git -C /r commit -m "x"`)
 * @param {string} sub  subcommand to match (e.g. 'commit')
 * @returns {boolean}
 */
function isGitSubcommand(cmd, sub) {
  if (typeof cmd !== 'string' || !cmd || typeof sub !== 'string' || !sub) return false;
  const tokens = tokenize(cmd);
  if (tokens.length === 0) return false;

  let i = 0;

  // 1) Skip a leading `env` prefix and its VAR=value assignments (env A=1 B=2 git ...).
  //    Also tolerate inline VAR=value assignments WITHOUT `env` (FOO=bar git commit).
  if (tokens[i] && tokens[i].replace(/[;&|]+$/, '') === 'env') {
    i++;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  } else {
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  }

  // 2) Current token must be the git binary.
  if (i >= tokens.length || !isGitBinary(tokens[i])) return false;
  i++;

  // 3) Walk git global options before the subcommand. Options starting with '-' are
  //    skipped; those in GIT_OPTS_WITH_VALUE also consume the following value token
  //    (unless given as --opt=value). The first NON-option token is the subcommand.
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.startsWith('-')) {
      // `--git-dir=/x` form embeds its value; `-C /path` / `-c k=v` consume the next token.
      if (GIT_OPTS_WITH_VALUE.has(t)) { i += 2; continue; }
      i += 1; // valueless option or --opt=value form
      continue;
    }
    // first bare token = subcommand
    return t === sub;
  }
  return false;
}

module.exports = { isGitSubcommand, tokenize, isGitBinary };
