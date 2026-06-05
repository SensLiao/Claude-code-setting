// _disc-common — shared helpers for all L12 Discoverability harness hooks.
// Centralizes: project root resolution, YAML config loading (stdlib only),
// state.json reads, gate-result.yaml parsing, trigger-file regex banks,
// deploy-command matching, private-route patterns, atomic state updates,
// preflight semantics (silent / disabled / warn / strict / fail-closed).
//
// Contract: templates/discoverability/harness-contract.md §7 (Hook Behavior).
// PreToolUse hooks: stderr + process.exit(2) to block.
// Stop hooks: emitStopBlock(reason) + process.exit(0) to block.
// PostToolUse hooks: cannot block; stderr advisory + exit 0.
// Never use async; all hooks are synchronous.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ───── stdin / config ─────

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// JSON parse failure must NOT silently become {}. Returns { input, parseError }
// so callers can fail-closed for blocking hooks and silent-warn for advisory.
function readInputSafe() {
  const raw = readStdinSync();
  if (!raw) return { input: {}, parseError: null };
  try { return { input: JSON.parse(raw), parseError: null }; }
  catch (e) { return { input: null, parseError: e.message || 'JSON parse failed' }; }
}

// Walk upward from `start` looking for discoverability.config.yaml.
// We anchor on the config file, not .discoverability/state.json, since state
// may not exist before `discoverability-sdk init` runs.
function findProjectRoot(start) {
  if (!start) return null;
  let dir;
  try { dir = path.resolve(start); } catch { return null; }
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'discoverability.config.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// ───── minimal YAML reader ─────
// Stdlib-only. Handles the subset we need:
//   - scalar key:value
//   - nested blocks (key:\n  subkey: value)
//   - list items with `-` prefix
//   - quoted strings (single + double)
//   - inline comments (# ...)
// Does NOT support: flow style, anchors, aliases, multi-line scalars, complex types.
function parseSimpleYaml(text) {
  if (!text || typeof text !== 'string') return {};
  const lines = text.split(/\r?\n/);
  const root = {};
  // Stack tracks: [{ container, indent, kind }]
  // kind: 'map' or 'list'
  const stack = [{ container: root, indent: -1, kind: 'map' }];

  function stripCommentAndTrim(s) {
    // Remove inline comments while respecting quoted strings (simple pass).
    let inSingle = false, inDouble = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '#' && !inSingle && !inDouble) return s.slice(0, i).trimEnd();
    }
    return s.trimEnd();
  }

  function unquote(v) {
    if (v == null) return v;
    v = v.trim();
    if (v.length >= 2) {
      const f = v[0], l = v[v.length - 1];
      if ((f === '"' && l === '"') || (f === "'" && l === "'")) return v.slice(1, -1);
    }
    return v;
  }

  function coerce(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (s === 'null' || s === '~') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
    return unquote(s);
  }

  function popTo(indent) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
  }

  for (let raw of lines) {
    const stripped = stripCommentAndTrim(raw);
    if (!stripped.trim()) continue;
    const indent = stripped.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length;
    const body = stripped.slice(stripped.match(/^[ \t]*/)[0].length);

    popTo(indent);
    const top = stack[stack.length - 1];

    if (body.startsWith('- ') || body === '-') {
      // list item
      const rest = body === '-' ? '' : body.slice(2);
      // Ensure parent is a list container at this indent
      if (top.kind !== 'list') {
        // Try to convert top to list by finding its last set key
        // (shouldn't normally happen if YAML is well-formed)
      }
      // Detect "- key: value" inline-map list item
      const kv = rest.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
      if (kv) {
        const obj = {};
        const k = kv[1], v = kv[2];
        if (v === '') {
          // nested block starts on next line
          obj[k] = null;
          if (Array.isArray(top.container)) top.container.push(obj);
          stack.push({ container: obj, indent, kind: 'map', pendingKey: k });
        } else {
          obj[k] = coerce(v);
          if (Array.isArray(top.container)) top.container.push(obj);
          stack.push({ container: obj, indent, kind: 'map' });
        }
      } else {
        if (Array.isArray(top.container)) top.container.push(coerce(rest));
      }
      continue;
    }

    // map entry
    const kv = body.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2];

    // If top container is currently a list with pendingKey from "- key:" then
    // resolve by ensuring we are inside the inline object — handled above.

    if (top.kind === 'list' && Array.isArray(top.container)) {
      // shouldn't happen — keys inside list need `-` prefix
      continue;
    }

    if (value === '') {
      // Block follow-up; could be map or list (decided by next line's `-`).
      const newObj = {};
      top.container[key] = newObj;
      // Tentatively push as map; if next line starts with `-`, switch.
      stack.push({ container: newObj, indent, kind: 'map', tentativeKey: key, parent: top.container });
    } else {
      top.container[key] = coerce(value);
    }
  }

  // Post-process: any tentative-map containers whose only fact was that they
  // were created empty AND followed by list items — convert. (We approximate
  // by scanning: empty objects that should be lists.)
  // Simpler approach: re-scan and detect map→list mismatches. For our use
  // (deploy_commands list + hook_modes dict + harness scalars), the parser
  // above already handles lists when the line under "key:" starts with "- ".
  return root;
}

// Second-pass: convert empty-map placeholders into arrays when their
// child structure was actually a list. We handle this by re-parsing in
// a list-aware way: detect lines like "key:" followed (next non-blank
// at deeper indent) by "-" prefix.
function parseYamlWithListFixup(text) {
  if (!text || typeof text !== 'string') return {};
  const lines = text.split(/\r?\n/);

  // Build a structure-aware tokenizer.
  function indentOf(s) {
    const m = s.match(/^[ \t]*/);
    return (m ? m[0] : '').replace(/\t/g, '  ').length;
  }
  function stripComment(s) {
    let inS = false, inD = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"' && !inS) inD = !inD;
      else if (c === "'" && !inD) inS = !inS;
      else if (c === '#' && !inS && !inD) return s.slice(0, i).trimEnd();
    }
    return s.trimEnd();
  }
  function unquote(v) {
    if (v == null) return v;
    v = v.trim();
    if (v.length >= 2) {
      const f = v[0], l = v[v.length - 1];
      if ((f === '"' && l === '"') || (f === "'" && l === "'")) return v.slice(1, -1);
    }
    return v;
  }
  function coerce(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (s === 'null' || s === '~') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
    return unquote(s);
  }

  const tokens = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) continue;
    const ind = indentOf(raw);
    const body = raw.slice(raw.match(/^[ \t]*/)[0].length);
    tokens.push({ indent: ind, body, lineNo: i });
  }

  // Recursive parser.
  let idx = 0;
  function parseBlock(parentIndent) {
    // Look ahead: if first token at indent > parentIndent starts with "-", it's a list.
    if (idx >= tokens.length) return null;
    const first = tokens[idx];
    if (first.indent <= parentIndent) return null;

    if (first.body.startsWith('- ') || first.body === '-') {
      // List
      const list = [];
      const listIndent = first.indent;
      while (idx < tokens.length && tokens[idx].indent === listIndent &&
             (tokens[idx].body.startsWith('- ') || tokens[idx].body === '-')) {
        const t = tokens[idx];
        const rest = t.body === '-' ? '' : t.body.slice(2);
        idx++;
        if (!rest) {
          // Nested block under this list item
          const sub = parseBlock(listIndent);
          list.push(sub == null ? null : sub);
        } else {
          // Inline; could be "key: value" (inline map) or scalar
          const kv = rest.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
          if (kv) {
            const obj = {};
            const k = kv[1], v = kv[2];
            if (v === '') {
              const sub = parseBlock(listIndent);
              obj[k] = sub;
            } else {
              obj[k] = coerce(v);
            }
            // Continue absorbing more keys at the same list-item indent+2
            while (idx < tokens.length && tokens[idx].indent > listIndent &&
                   !(tokens[idx].body.startsWith('- ') || tokens[idx].body === '-')) {
              const t2 = tokens[idx];
              const kv2 = t2.body.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
              if (!kv2) break;
              idx++;
              if (kv2[2] === '') {
                const sub2 = parseBlock(t2.indent);
                obj[kv2[1]] = sub2;
              } else {
                obj[kv2[1]] = coerce(kv2[2]);
              }
            }
            list.push(obj);
          } else {
            list.push(coerce(rest));
          }
        }
      }
      return list;
    }

    // Map
    const map = {};
    const mapIndent = first.indent;
    while (idx < tokens.length && tokens[idx].indent === mapIndent) {
      const t = tokens[idx];
      if (t.body.startsWith('- ') || t.body === '-') break;  // Belongs to parent
      const kv = t.body.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
      if (!kv) { idx++; continue; }
      idx++;
      const k = kv[1], v = kv[2];
      if (v === '') {
        const sub = parseBlock(mapIndent);
        map[k] = sub;
      } else {
        map[k] = coerce(v);
      }
    }
    return map;
  }

  const result = parseBlock(-1);
  return result == null ? {} : result;
}

// Load discoverability.config.yaml. Returns { config, projectRoot, error }.
// error ∈ { null, 'absent', 'unreadable', 'malformed' }
function loadConfig(cwdHint) {
  const projectRoot = findProjectRoot(cwdHint || process.cwd());
  if (!projectRoot) return { config: null, projectRoot: null, error: 'absent' };
  const cfgPath = path.join(projectRoot, 'discoverability.config.yaml');
  let raw;
  try { raw = fs.readFileSync(cfgPath, 'utf8'); }
  catch { return { config: null, projectRoot, error: 'unreadable' }; }
  let parsed;
  try { parsed = parseYamlWithListFixup(raw); }
  catch (e) { return { config: null, projectRoot, error: 'malformed' }; }
  if (!parsed || typeof parsed !== 'object') {
    return { config: null, projectRoot, error: 'malformed' };
  }
  return { config: parsed, projectRoot, error: null };
}

// Read .discoverability/state.json. Returns { activeTag, activeRun, gateStatus,
// staleReasons, lastGateAt, raw }. All null/false if state.json absent.
function getActiveRunTag(projectRoot) {
  if (!projectRoot) return { activeTag: null, activeRun: false, gateStatus: null, staleReasons: [], lastGateAt: null, raw: null };
  const statePath = path.join(projectRoot, '.discoverability', 'state.json');
  if (!fs.existsSync(statePath)) {
    return { activeTag: null, activeRun: false, gateStatus: null, staleReasons: [], lastGateAt: null, raw: null };
  }
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      activeTag: (typeof state.active_run_tag === 'string' && state.active_run_tag) ? state.active_run_tag : null,
      activeRun: state.active_run === true,
      gateStatus: typeof state.gate_status === 'string' ? state.gate_status : null,
      staleReasons: Array.isArray(state.stale_reasons) ? state.stale_reasons : [],
      lastGateAt: typeof state.last_gate_at === 'string' ? state.last_gate_at : null,
      raw: state,
    };
  } catch {
    return { activeTag: null, activeRun: false, gateStatus: null, staleReasons: [], lastGateAt: null, raw: null };
  }
}

// Load gate-result.yaml for a given tag. We only need `decision` + `generated_at`,
// so simple regex extraction is enough — no full YAML parse required.
function loadGateResult(projectRoot, tag) {
  if (!projectRoot || !tag) return { exists: false, decision: null, generatedAt: null, path: null };
  const p = path.join(projectRoot, 'evidence', 'discoverability', tag, 'gate-result.yaml');
  if (!fs.existsSync(p)) return { exists: false, decision: null, generatedAt: null, path: p };
  let txt = '';
  try { txt = fs.readFileSync(p, 'utf8'); }
  catch { return { exists: false, decision: null, generatedAt: null, path: p }; }
  const noComments = txt.replace(/^\s*#.*$/gm, '');
  const dm = noComments.match(/^[ \t]{0,4}decision[ \t]*:[ \t]*([A-Z_]+)\s*$/m);
  const tm = noComments.match(/^[ \t]{0,4}generated_at[ \t]*:[ \t]*(.+)$/m);
  return {
    exists: true,
    decision: dm ? dm[1] : null,
    generatedAt: tm ? tm[1].trim().replace(/^["']|["']$/g, '') : null,
    path: p,
  };
}

// Standard preflight for all disc-* hooks.
// Returns:
//   { mode: 'silent' }                                — no config; silent exit 0
//   { mode: 'disabled' }                              — harness.enabled=false; silent exit 0
//   { mode: 'fail-closed', reason }                   — config malformed; blocking hooks block
//   { mode: 'warn', config, projectRoot }             — strict_mode=false
//   { mode: 'strict', config, projectRoot }           — strict_mode=true (default)
function preflight(input) {
  const cwd = (input && input.cwd) || process.cwd();
  const { config, projectRoot, error } = loadConfig(cwd);
  if (error === 'absent') return { mode: 'silent' };
  if (error === 'malformed' || error === 'unreadable') {
    return { mode: 'fail-closed', projectRoot, reason: `discoverability.config.yaml ${error}` };
  }
  const harness = (config && config.harness) || {};
  if (harness.enabled === false) return { mode: 'disabled' };
  // strict_mode default true (matches contract §5 default + §7.2)
  const strict = harness.strict_mode !== false;
  return { mode: strict ? 'strict' : 'warn', config, projectRoot };
}

// ───── Path / command pattern banks ─────

// Files whose Edit/Write triggers mark-stale (contract §7.2 trigger list).
const DISC_TRIGGER_PATTERNS = [
  /(^|[\/\\])robots\.txt$/i,
  /(^|[\/\\])sitemap[^\/\\]*\.xml$/i,
  /(^|[\/\\])app[\/\\]robots\.(ts|tsx|js|jsx)$/i,
  /(^|[\/\\])app[\/\\]sitemap(\.|[\/\\])/i,
  /(^|[\/\\])app[\/\\]metadata\.(ts|tsx|js|jsx)$/i,
  /(^|[\/\\])pages[\/\\]metadata\.(ts|tsx|js|jsx)$/i,
  /(^|[\/\\])app[\/\\]layout\.(tsx|jsx)$/i,
  /(^|[\/\\])app[\/\\].+[\/\\]layout\.(tsx|jsx)$/i,
  /(^|[\/\\])app[\/\\]head\.(tsx|jsx)$/i,
  /(^|[\/\\])app[\/\\].+[\/\\]head\.(tsx|jsx)$/i,
  /(^|[\/\\])llms(-full)?\.txt$/i,
  /(^|[\/\\])app[\/\\]structured-data[\/\\]/i,
  /(^|[\/\\])schema\.org[\/\\].+\.json$/i,
  /(^|[\/\\]).*jsonld[^\/\\]*$/i,
  /(^|[\/\\])public[\/\\]robots\.txt$/i,
  /(^|[\/\\])public[\/\\]sitemap[^\/\\]*\.xml$/i,
  /(^|[\/\\])public[\/\\]llms(-full)?\.txt$/i,
  /(^|[\/\\])fastlane[\/\\]metadata[\/\\]/i,
  /(^|[\/\\])app-store[\/\\].+\.(json|md|yaml|yml)$/i,
  /(^|[\/\\])google-play[\/\\].+\.(json|md|yaml|yml)$/i,
  /(^|[\/\\])store-listing[\/\\]/i,
  /(^|[\/\\])discoverability\.config\.yaml$/i,
];

// Default deploy commands. Project config can extend via harness.deploy_commands.
const DEFAULT_DEPLOY_COMMANDS = [
  'vercel deploy',
  'vercel --prod',
  'vercel deploy --prod',
  'netlify deploy --prod',
  'wrangler deploy',
  'firebase deploy',
  'pnpm release',
  'pnpm run release',
  'npm run deploy',
  'yarn deploy',
  'gsd-ship',
];

// Build deploy-command regex bank, merging config-supplied commands.
function buildDeployPatterns(config) {
  const harness = (config && config.harness) || {};
  const extra = Array.isArray(harness.deploy_commands) ? harness.deploy_commands : [];
  const merged = Array.from(new Set([...DEFAULT_DEPLOY_COMMANDS, ...extra.map(s => String(s))]));
  // Compile to regex: match as whole word (start-of-cmd or after ; & | && ||)
  return merged.map(s => {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return { command: s, re: new RegExp(`(^|[\\s;&|])${escaped}(\\s|$|[;&|<>])`, 'i') };
  });
}

// Private routes / token-bearing query strings (contract §7.3 scenarios 3-5).
const PRIVATE_ROUTE_PATTERNS = [
  /\/admin(\/|$|\?)/i,
  /\/api\/internal(\/|$|\?)/i,
  /\/auth\//i,
  /\/preview(\/|$|\?)/i,
  /\/staging(\/|$|\?)/i,
  /\/internal(\/|$|\?)/i,
  /\/private(\/|$|\?)/i,
  /\/_next\/data\//i,
  /\?token=/i,
  /\?api_key=/i,
  /\?apikey=/i,
  /\?key=[^&\s]{16,}/i,
  /\?access_token=/i,
];

function pathMatchesAny(filePath, patterns) {
  if (!filePath || !Array.isArray(patterns)) return false;
  // Normalize slashes for cross-platform matching
  const fp = String(filePath).replace(/\\/g, '/');
  for (const re of patterns) if (re.test(fp)) return true;
  return false;
}

function contentContainsPrivateRoute(content) {
  if (!content || typeof content !== 'string') return null;
  for (const re of PRIVATE_ROUTE_PATTERNS) {
    const m = content.match(re);
    if (m) return m[0];
  }
  return null;
}

// ───── state.json atomic update ─────

// Update .discoverability/state.json with a stale event. Uses .tmp + rename
// for atomicity. Creates the file with sane defaults if it does not exist.
function markStaleInState(projectRoot, reason, filePath, markedBy) {
  if (!projectRoot) return false;
  const dir = path.join(projectRoot, '.discoverability');
  const statePath = path.join(dir, 'state.json');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  let state = null;
  if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { state = null; }
  }
  if (!state || typeof state !== 'object') {
    state = {
      _schema_version: '1.0.0',
      active_run_tag: null,
      active_run: false,
      gate_status: 'PENDING',
      stale_reasons: [],
      last_gate_at: null,
      last_gate_result: null,
      last_gate_evidence_hash: null,
      config_path: 'discoverability.config.yaml',
      config_hash: null,
      harness_version: '1.0.0',
    };
  }
  state.gate_status = 'STALE';
  if (!Array.isArray(state.stale_reasons)) state.stale_reasons = [];
  state.stale_reasons.push({
    reason: String(reason || 'unspecified'),
    file_path: filePath ? String(filePath) : null,
    marked_at: new Date().toISOString(),
    marked_by: String(markedBy || 'disc-hook'),
  });
  const tmp = statePath + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, statePath);
    return true;
  } catch {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    return false;
  }
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

function preToolBlockMessage(reason) {
  process.stderr.write(`[disc] ${reason}\n`);
}

// ───── claim-pattern bank for Stop hook (contract §7.5) ─────

function claimPatternsForStop() {
  return [
    /discoverability\s+(done|complete)/i,
    /L12\s+(done|audit\s+complete|complete)/i,
    /SEO\s+audit\s+(done|complete|passed?)/i,
    /AEO\s+audit\s+(done|complete|passed?)/i,
    /ASO\s+audit\s+(done|complete|passed?)/i,
    /ai[- ]search\s+audit\s+(done|complete|passed?)/i,
    /release\s+ready/i,
    // 中文 (per contract §7.5)
    /可发现性\s*审查\s*通过/,
    /L12\s*完成/,
    /SEO\s*审查\s*完成/,
    /AEO\s*审查\s*完成/,
    /ASO\s*审查\s*完成/,
  ];
}

// ───── evidence freshness ─────

// Compare last_gate_at against now; return true if older than freshness_hours.
function isGateStale(lastGateAt, freshnessHours) {
  if (!lastGateAt) return true;
  const t = Date.parse(lastGateAt);
  if (!Number.isFinite(t)) return true;
  const hours = Number(freshnessHours);
  if (!Number.isFinite(hours) || hours <= 0) return false;
  return (Date.now() - t) > hours * 3600 * 1000;
}

module.exports = {
  // input
  readInputSafe,
  // discovery
  findProjectRoot,
  loadConfig,
  parseYamlWithListFixup,
  // state
  getActiveRunTag,
  loadGateResult,
  markStaleInState,
  isGateStale,
  // preflight
  preflight,
  // patterns
  DISC_TRIGGER_PATTERNS,
  DEFAULT_DEPLOY_COMMANDS,
  PRIVATE_ROUTE_PATTERNS,
  buildDeployPatterns,
  pathMatchesAny,
  contentContainsPrivateRoute,
  // claims
  claimPatternsForStop,
  // output
  emitStopBlock,
  emitAdvisory,
  preToolBlockMessage,
};
