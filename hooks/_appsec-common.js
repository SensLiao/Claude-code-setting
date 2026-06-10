// _appsec-common — shared helpers for all appsec-security-orchestrator v3.0 hooks.
// Centralizes: project root resolution, config loading, secret regex bank,
// path-matcher utilities, active release tag lookup, fail-closed semantics.
//
// Contract: SKILL.md §18.0 (blocking semantics) + §18.1-§18.6 (per-hook).
// PreToolUse hooks: stderr + process.exit(2) to block.
// Stop hooks: emitStopBlock(reason) + process.exit(0) to block.
// Never use async; hooks are synchronous.

'use strict';

const fs = require('fs');
const path = require('path');

// ───── stdin / config ─────

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// ★ P7 fix (Tier 1 #1): JSON.parse failure must NOT silently become {} — that fails open.
// Returns { input, parseError } so callers can fail-closed appropriately for their hook type.
function readInputSafe() {
  const raw = readStdinSync();
  if (!raw) return { input: {}, parseError: null };
  try { return { input: JSON.parse(raw), parseError: null }; }
  catch (e) { return { input: null, parseError: e.message || 'JSON parse failed' }; }
}

// Legacy helper kept for hooks that explicitly want lenient input (none currently).
// New hooks MUST use readInputSafe + handle parseError.
function readInput() {
  const { input } = readInputSafe();
  return input || {};
}

function findProjectRoot(start) {
  if (!start) return null;
  let dir;
  try { dir = path.resolve(start); } catch { return null; }
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, '.appsec', 'config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function loadConfig(cwdHint) {
  const projectRoot = findProjectRoot(cwdHint || process.cwd());
  if (!projectRoot) return { config: null, projectRoot: null, error: 'absent' };
  const cfgPath = path.join(projectRoot, '.appsec', 'config.json');
  let raw;
  try { raw = fs.readFileSync(cfgPath, 'utf8'); }
  catch { return { config: null, projectRoot, error: 'unreadable' }; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { config: null, projectRoot, error: 'malformed' }; }
  return { config: parsed, projectRoot, error: null };
}

// ───── last-assistant-text extraction (Stop-hook payload + transcript fallback) ─────
//
// Stop-hook payloads on current Claude Code carry session_id / transcript_path /
// stop_hook_active and DO NOT carry the assistant's final message inline. Hooks that
// must scan the final assistant turn (secret-redaction, evidence-required claim
// detection) therefore have to fall back to the JSONL transcript.
//
// readLastAssistantText(payload, maxKB=256):
//   1. If payload carries last_assistant_message / assistant_message (string), use it.
//   2. Else if payload.transcript_path exists, read the tail (maxKB) of the JSONL,
//      parse each line, and return the concatenated text of the LAST assistant entry.
//   3. Any failure (no field, unreadable file, malformed JSONL) → return null. Never throw.
//
// Returns a string (possibly empty) when text is found, or null when nothing is available.
// Callers decide fail-open vs fail-closed; this helper is side-effect-free.
function _textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const c of content) {
      if (c && typeof c.text === 'string') parts.push(c.text);
    }
    return parts.join('\n');
  }
  return '';
}

function readLastAssistantText(payload, maxKB) {
  const cap = (typeof maxKB === 'number' && maxKB > 0 ? maxKB : 256) * 1024;
  // 1) inline payload fields (legacy / some Claude Code versions)
  if (payload) {
    if (typeof payload.last_assistant_message === 'string' && payload.last_assistant_message) {
      return payload.last_assistant_message;
    }
    if (typeof payload.assistant_message === 'string' && payload.assistant_message) {
      return payload.assistant_message;
    }
    if (Array.isArray(payload.messages)) {
      for (let i = payload.messages.length - 1; i >= 0; i--) {
        const m = payload.messages[i];
        if (m && m.role === 'assistant') {
          const t = _textFromContent(m.content);
          if (t) return t;
        }
      }
    }
  }
  // 2) transcript_path tail (current Claude Code Stop payload shape)
  const tp = payload && typeof payload.transcript_path === 'string' ? payload.transcript_path : '';
  if (!tp) return null;
  let content;
  try {
    if (!fs.existsSync(tp)) return null;
    const stat = fs.statSync(tp);
    const start = Math.max(0, stat.size - cap);
    const fd = fs.openSync(tp, 'r');
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      content = buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch { return null; }
  // Parse JSONL bottom-up; return the last assistant entry's text. Claude Code
  // transcript lines look like { type/role: 'assistant', message: { content: [...] } }
  // or { role:'assistant', content:[...] }. Tolerate both + skip non-JSON lines.
  const lines = content.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || line[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const role = obj.role || obj.type || (obj.message && obj.message.role);
    if (role !== 'assistant') continue;
    const msg = obj.message || obj;
    const t = _textFromContent(msg.content != null ? msg.content : msg.text);
    if (t) return t;
  }
  return null;
}

function getActiveReleaseTag(projectRoot) {
  if (!projectRoot) return { activeTag: null, activeDir: null };
  const statePath = path.join(projectRoot, '.appsec', 'state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state && typeof state.active_release_tag === 'string' && state.active_release_tag) {
        const dir = path.join(projectRoot, '.appsec', 'evidence', state.active_release_tag);
        if (fs.existsSync(dir)) return { activeTag: state.active_release_tag, activeDir: dir };
      }
    } catch {}
  }
  return { activeTag: null, activeDir: null };
}

// Standard preflight for all hooks.
// Returns:
//   { mode: 'silent' }                          — non-appsec project; hook silent-exits 0
//   { mode: 'fail-closed', reason }             — malformed config; hook MUST block (security default)
//   { mode: 'warn', config, projectRoot }       — strict_mode=lax
//   { mode: 'strict', config, projectRoot }     — strict_mode=strict (default)
function preflight(input) {
  const cwd = (input && input.cwd) || process.cwd();
  const { config, projectRoot, error } = loadConfig(cwd);
  if (error === 'absent') return { mode: 'silent' };
  if (error === 'malformed' || error === 'unreadable') {
    return { mode: 'fail-closed', projectRoot, reason: `.appsec/config.json ${error}` };
  }
  const sm = (config.strict_mode || 'strict').toLowerCase();
  if (sm === 'lax' || sm === 'warn') return { mode: 'warn', config, projectRoot };
  return { mode: 'strict', config, projectRoot };
}

// ───── Secret regex bank ─────
// Used by: appsec-secret-redaction (Stop scan), appsec-finding-schema-prewrite (body scan),
// appsec-secret-access-guard (matched-content check on Read targets).
// Patterns mirror appsec-sdk redact_stdin (single source of truth).

// ★ P7 fix (Tier 1 #4): openai_key updated to include `_` `-` for sk-proj-* keys.
// ★ P7 fix (Tier 2 #6): credential_kv has upper bound {8,256} to prevent ReDoS on adversarial input.
// Order matters: more-specific patterns (sk-ant-) MUST precede less-specific (sk-) so the broader
// rule doesn't first-claim and partially redact an Anthropic key.
const SECRET_PATTERNS = [
  { name: 'aws_access_key',    re: /AKIA[0-9A-Z]{16}/g },
  { name: 'aws_session_key',   re: /ASIA[0-9A-Z]{16}/g },
  { name: 'aws_secret',        re: /aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{30,256}/gi },
  { name: 'github_pat',        re: /ghp_[A-Za-z0-9]{30,256}/g },
  { name: 'github_oauth',      re: /gho_[A-Za-z0-9]{30,256}/g },
  { name: 'github_user',       re: /ghu_[A-Za-z0-9]{30,256}/g },
  { name: 'github_server',     re: /ghs_[A-Za-z0-9]{30,256}/g },
  { name: 'github_refresh',    re: /ghr_[A-Za-z0-9]{30,256}/g },
  { name: 'anthropic_key',     re: /sk-ant-[A-Za-z0-9_-]{20,256}/g },
  { name: 'openai_key',        re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,256}/g },
  { name: 'slack_token',       re: /xox[abprs]-[A-Za-z0-9-]{10,256}/g },
  { name: 'jwt',               re: /eyJ[A-Za-z0-9_-]{10,512}\.[A-Za-z0-9_-]{10,512}\.[A-Za-z0-9_-]{10,512}/g },
  { name: 'pem_private_key',   re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'credential_kv',     re: /\b(PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|APIKEY|PRIVATE_KEY)\s{0,8}[:=]\s{0,8}["']?[^"'\s]{8,256}["']?/gi },
];

// ★ P7 fix (Tier 2 #6): cap scanned input at 1 MiB to bound regex CPU.
// Any input larger than this is detected as "oversized" and treated as a positive hit
// (defense-in-depth: assume the worst on truly massive payloads).
const SCAN_INPUT_CAP_BYTES = 1024 * 1024;

// Returns array of { name, sample (redacted) } if any secret found, else [].
// Caller MUST NOT include `sample` raw in any output; sample is already redacted.
function detectSecrets(text) {
  if (!text || typeof text !== 'string') return [];
  // ★ P7 fix (Tier 2 #6): truncate oversized inputs to bound regex CPU; treat as positive hit.
  if (text.length > SCAN_INPUT_CAP_BYTES) {
    return [{ name: 'oversized_input', sample: `<REDACTED:oversized_input ${text.length}B>` }];
  }
  const hits = [];
  for (const { name, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) hits.push({ name, sample: `<REDACTED:${name}>` });
  }
  return hits;
}

// Pure redaction — for echoing user-supplied content back through hook output.
// Mirrors appsec-sdk redact_stdin semantics.
function redactText(text) {
  if (!text || typeof text !== 'string') return text;
  // ★ P7 fix (Tier 2 #6): cap input length to bound regex CPU.
  if (text.length > SCAN_INPUT_CAP_BYTES) {
    return `<REDACTED:oversized_input ${text.length}B>`;
  }
  let t = text;
  // PEM blocks first (multiline)
  t = t.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '<REDACTED:pem_private_key>');
  for (const { name, re } of SECRET_PATTERNS) {
    if (name === 'pem_private_key') continue;  // already handled
    t = t.replace(re, (m) => {
      // For KEY=VALUE patterns, preserve the KEY= prefix
      if (name === 'aws_secret' || name === 'credential_kv') {
        const eqIdx = m.search(/[:=]/);
        if (eqIdx >= 0) {
          return m.slice(0, eqIdx + 1) + ` <REDACTED:${name}>`;
        }
      }
      return `<REDACTED:${name}>`;
    });
  }
  return t;
}

// ───── Path-matcher utilities ─────

// Sensitive paths that secret-access-guard.js blocks reads on.
// .env.example / .env.sample are explicitly allowlisted.
const SENSITIVE_PATH_PATTERNS = [
  /(^|[\/\\])\.env$/,
  /(^|[\/\\])\.env\.[a-z]+$/i,                                // .env.local / .env.production etc.
  /(^|[\/\\])secrets[\/\\]/,
  /\.pem$/i,
  /\.key$/i,
  /(^|[\/\\])credentials\.json$/i,
  /(^|[\/\\])id_rsa(\.|$)/,
  /\.kdbx$/i,
  /(^|[\/\\])\.keyring(\.|$)/,
];

const SENSITIVE_PATH_ALLOWLIST = [
  /(^|[\/\\])\.env\.example$/,
  /(^|[\/\\])\.env\.sample$/,
  /(^|[\/\\])\.env\.template$/,
];

// ───── Dev/test env stage carve-out (user charter 2026-06-03) ─────
// During DEVELOPMENT the dev/test/local env files MUST be readable + editable + bash-sourceable
// by the agent — obstructing them blocks normal development ("先能开发完，再保证安全"). Only
// PRODUCTION secrets stay off-limits (human-only; program must never read/edit/source them).
// This encodes the stage boundary:
//   ALLOWED (treated NON-sensitive): .env.dev .env.development .env.local .env.test .env.testing
//        .env.ci .env.e2e  (+ optional second suffix, e.g. .env.development.local)
//   PROTECTED (stay blocked): bare .env, .env.production, .env.prod, .env.staging, .env.stg,
//        secrets/, *.pem, *.key, credentials.json, id_rsa*, *.kdbx, .keyring
// Projects may EXTEND the dev allowlist via .appsec/config.json:
//   "dev_secret_globs": ["<regex source>", ...]   (matched case-insensitively)
// e.g. ["\\.env\\.staging$"] to also treat staging env as dev-editable. See SKILL.md §18.6.
const DEV_ENV_STAGES = '(dev|development|local|test|testing|ci|e2e)';
const DEV_ENV_ALLOWLIST = [
  new RegExp(`(^|[\\/\\\\])\\.env\\.${DEV_ENV_STAGES}$`, 'i'),
  new RegExp(`(^|[\\/\\\\])\\.env\\.${DEV_ENV_STAGES}\\.[a-z0-9]+$`, 'i'),
];

// Compile project-supplied dev globs (regex source strings); skip malformed entries (fail-safe:
// a bad glob simply does not widen the allowlist — it never weakens the protected list).
function compileDevGlobs(config) {
  if (!config || !Array.isArray(config.dev_secret_globs)) return [];
  const out = [];
  for (const g of config.dev_secret_globs) {
    if (typeof g !== 'string' || !g) continue;
    try { out.push(new RegExp(g, 'i')); } catch { /* ignore malformed glob */ }
  }
  return out;
}

// isSensitivePath(p, config?) — stage-aware.
// Backward compatible: with no config the built-in dev/test carve-out still applies; only the
// project-specific dev_secret_globs extension requires passing config. Precedence:
//   shape-reference allowlist  >  dev/test stage carve-out  >  protected secret material.
function isSensitivePath(p, config) {
  if (!p || typeof p !== 'string') return false;
  // 1) explicit shape-reference allowlist (.env.example / .sample / .template)
  for (const allow of SENSITIVE_PATH_ALLOWLIST) {
    if (allow.test(p)) return false;
  }
  // 2) dev/test stage carve-out — built-in defaults + project dev_secret_globs
  for (const allow of DEV_ENV_ALLOWLIST) {
    if (allow.test(p)) return false;
  }
  for (const allow of compileDevGlobs(config)) {
    if (allow.test(p)) return false;
  }
  // 3) protected secret material (production env + key files)
  for (const block of SENSITIVE_PATH_PATTERNS) {
    if (block.test(p)) return true;
  }
  return false;
}

// Bash commands that attempt to read / dump sensitive content.
// Combined check: command verb + sensitive path target OR known dumper.
function bashAttemptsSecretRead(cmd, config) {
  if (!cmd || typeof cmd !== 'string') return null;
  const c = cmd.trim();
  // Direct env dumpers (printenv / env with NO args). Anchored to STATEMENT boundaries
  // (start / ; / & / | / newline) — NOT a bare space — so the word "env" appearing INSIDE a
  // quoted echo string or a comment is no longer a false positive (charter 2026-06-03: don't
  // obstruct dev). `printenv FOO` / `env FOO` targeting a single named var is allowed (not a dump).
  if (/(^|[;&|\n])\s*(printenv|env)\b\s*(?:$|[;&|\n>])/.test(c)) {
    return 'printenv/env dumps process environment';
  }
  // env VAR=val cmd form — injects secret into child process env (statement-boundary anchored).
  if (/(^|[;&|\n])\s*env\s+[A-Z_][A-Z0-9_]*\s*=/.test(c)) {
    return 'env VAR=value command form — secret injected into subprocess environment';
  }
  // reader / copier verbs against a PROTECTED path. (dev/test env files are allowlisted by
  // isSensitivePath — reading/sourcing them is fine.) Includes cp/mv/dd/tee so copy-then-read
  // exfiltration of a protected file (`cp .env.production /tmp/x; cat /tmp/x`) is caught at the copy.
  const verbMatch = c.match(/(^|[\s;&|])(cat|less|more|head|tail|nl|tac|awk|sed|grep|xxd|od|strings|base64|dd|cp|mv|tee|mapfile|readarray)\b/);
  if (verbMatch) {
    // Pull out potential file argument(s); match anything that looks path-like.
    // Also strip a leading `key=` (handles `dd if=<path>` / `of=<path>` forms).
    const args = c.split(/[\s;&|<>]+/).filter(Boolean);
    for (const a of args) {
      if (isSensitivePath(a, config) || isSensitivePath(a.replace(/^[a-z]+=/i, ''), config)) {
        return `command reads sensitive path: ${a}`;
      }
    }
  }
  // `source FILE` / `. FILE` of a protected path leaks its secrets into the shell environment.
  const srcMatch = c.match(/(^|[\s;&|])(?:source|\.)\s+(\S+)/);
  if (srcMatch && isSensitivePath(srcMatch[2], config)) {
    return `command sources sensitive path: ${srcMatch[2]}`;
  }
  // grep -r for SECRET / TOKEN etc.
  if (/grep\s+(-r|-R|--recursive)\s+(['"]?)(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)\2/i.test(c)) {
    return 'recursive grep for credential keywords';
  }
  return null;
}

// ★ P7 fix (typescript-reviewer HIGH #3): Canonical path resolution + case-insensitive matching
// to defeat Windows .APPSEC / .. traversal bypass attempts. Returns the resolved absolute path
// (lowercased on Windows-style FS comparison) and a boolean indicating whether the path lives
// inside `<projectRoot>/<dotDir>/<subPath>`.
function matchesProtectedPath(filePath, projectRoot, dotDir, subPath) {
  if (!filePath || !projectRoot) return false;
  const path = require('path');
  let resolved;
  try { resolved = path.resolve(projectRoot, filePath); }
  catch { return false; }
  const expectedPrefix = path.resolve(projectRoot, dotDir, subPath || '');
  // Normalize separators and lowercase for cross-platform compare
  const a = resolved.replace(/\\/g, '/').toLowerCase();
  const b = expectedPrefix.replace(/\\/g, '/').toLowerCase();
  return a === b || a.startsWith(b + '/');
}

// Active-scan tooling that requires ROE.
const ACTIVE_SCAN_TOOLS = [
  { name: 'sqlmap',     re: /(^|[\s;&|])(?:python[0-9.]*\s+-m\s+)?sqlmap\b/ },
  { name: 'nmap',       re: /(^|[\s;&|])nmap\b/ },
  { name: 'nuclei',     re: /(^|[\s;&|])nuclei\b/ },
  { name: 'ffuf',       re: /(^|[\s;&|])ffuf\b/ },
  { name: 'gobuster',   re: /(^|[\s;&|])gobuster\b/ },
  { name: 'wfuzz',      re: /(^|[\s;&|])wfuzz\b/ },
  { name: 'burp',       re: /(^|[\s;&|])burp(suite)?\b/ },
  { name: 'zap-active', re: /(^|[\s;&|])zap-cli\b.*\bactive\b/ },
  { name: 'zap-full',   re: /(^|[\s;&|])zap-full-scan/ },
  { name: 'masscan',    re: /(^|[\s;&|])masscan\b/ },
  { name: 'hydra',      re: /(^|[\s;&|])hydra\b/ },
  { name: 'msfconsole', re: /(^|[\s;&|])msfconsole\b/ },
  { name: 'msfvenom',   re: /(^|[\s;&|])msfvenom\b/ },
];

function detectActiveScanTool(cmd) {
  if (!cmd || typeof cmd !== 'string') return null;
  for (const { name, re } of ACTIVE_SCAN_TOOLS) {
    if (re.test(cmd)) return name;
  }
  return null;
}

// Extract target hostnames from a command line (best effort, host-shape only).
function extractTargetHosts(cmd) {
  if (!cmd) return [];
  const hosts = new Set();
  // URL form: https://host/...
  const urlRe = /https?:\/\/([A-Za-z0-9.-]+)(?:[\/:?]|\b)/g;
  let m;
  while ((m = urlRe.exec(cmd)) !== null) hosts.add(m[1].toLowerCase());
  // Bare hostname after nmap/sqlmap/etc.
  const bareRe = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/g;
  while ((m = bareRe.exec(cmd)) !== null) {
    // Skip obvious non-hosts (file extensions, version strings)
    const h = m[1].toLowerCase();
    if (/\.(js|ts|py|go|md|json|yml|yaml|sh|txt|log|exe)$/.test(h)) continue;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) hosts.add(h);  // IP
    else if (h.split('.').length >= 2) hosts.add(h);
  }
  return Array.from(hosts);
}

// ───── output helpers ─────

function emitStopBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

function emitAdvisory(eventName, lines) {
  const out = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: Array.isArray(lines) ? lines.join('\n') : String(lines),
    },
  };
  process.stdout.write(JSON.stringify(out));
}

// PreToolUse block: stderr + exit(2). Caller should immediately process.exit(2).
function preToolBlockMessage(reason) {
  process.stderr.write(`[appsec] ${reason}\n`);
}

module.exports = {
  readInput,
  readInputSafe,         // ★ P7 — preferred new API; surfaces parseError sentinel
  findProjectRoot,
  loadConfig,
  getActiveReleaseTag,
  readLastAssistantText,  // ★ Stop-hook payload + transcript_path fallback (last assistant turn)
  preflight,
  // secrets
  SECRET_PATTERNS,
  SCAN_INPUT_CAP_BYTES,  // ★ P7 — exposed for hook-side awareness
  detectSecrets,
  redactText,
  // paths
  SENSITIVE_PATH_PATTERNS,
  SENSITIVE_PATH_ALLOWLIST,
  DEV_ENV_ALLOWLIST,     // ★ 2026-06-03 — stage carve-out (dev/test env editable)
  compileDevGlobs,       // ★ 2026-06-03 — project dev_secret_globs extension
  isSensitivePath,
  bashAttemptsSecretRead,
  matchesProtectedPath,  // ★ P7 — case-insensitive + path.resolve protected-path matcher
  // scan
  ACTIVE_SCAN_TOOLS,
  detectActiveScanTool,
  extractTargetHosts,
  // output
  emitStopBlock,
  emitAdvisory,
  preToolBlockMessage,
};
