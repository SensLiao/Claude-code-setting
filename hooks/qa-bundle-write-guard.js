#!/usr/bin/env node
/**
 * qa-bundle-write-guard.js — PreToolUse[Write|Edit|MultiEdit] guard that blocks DIRECT model
 * writes to QA verdict files (qa_evidence_bundle / gate-result / release-decision) unless the
 * write carries the canonical `# written-by: qa-sdk@<version>` provenance marker.
 *
 * This is the QA-scoped sibling of the appsec-finding-schema-prewrite.js pattern and a direct
 * derivation of the codex round-4 CONFIRM-CLEAN multi-subsystem guard
 * (Desktop/harness-eval-sandbox/experiments/write-guard/verdict-write-guard.js, 37 self-tests
 * green). Scoped to the single QA subsystem; logic, hardening, and exit-code contract are
 * preserved 1:1 from that proven guard.
 *
 * WHY: appsec already blocks non-SDK writes to .appsec/findings|decisions via a first-line
 * marker; QA verdict files had no equivalent guard. qa-sdk must stamp
 * `# written-by: qa-sdk@<v>` as the first non-empty line of
 * `.qa/evidence/<tag>/qa_evidence_bundle.yaml` (and any gate-result / release-decision it
 * writes) for this guard to pass its legitimate writes (see HOOK-BYPASS-MATRIX.md "SDK-side
 * change"). This is the canonical-write-path / accidental-drift enforcement layer.
 *
 * HONEST SCOPE: a first-line marker is ACCIDENTAL-DRIFT protection, NOT adversarial integrity.
 * It is spoofable, and a Write/Edit-matcher hook does NOT see Bash redirection (echo > file),
 * `git apply`, MCP filesystem writes, or external-editor writes. Those bypass paths are caught
 * downstream by verdict-validator.js (--require-provenance) at read / promotion / CI, where a
 * hand-authored verdict lacks a valid run_fingerprint. This guard + that validator are the two
 * layers; neither alone is sufficient.
 *
 * Behavior:
 *   - exit 0 (NO-OP) unless the TARGET file lives inside a project that declares .qa/config.json
 *     (found walking up FROM THE TARGET directory — nested QA projects must be guarded).
 *   - `.qa/config.json` present but `qa_enforcement: "off"` -> NO-OP (exit 0), honoring the QA
 *     enforcement switch (consistent with _qa-common.preflight). warn/strict both enforce.
 *   - Write to a protected QA verdict path WITHOUT the qa-sdk marker as first non-empty line
 *     -> block (exit 2).
 *   - Edit / MultiEdit to a protected QA verdict path -> block (verdicts are written wholesale
 *     by qa-sdk via Write, never partially edited).
 *   - Anything else -> allow (exit 0).
 *   - Malformed / empty / unparseable PreToolUse payload in a guarded QA project -> fail-closed
 *     block (exit 2).
 *
 * Hardening preserved from the proven guard:
 *   #1 activation walks up from the TARGET dir (not cwd) with no small depth cap.
 *   #2 MultiEdit is an edit-class tool and is blocked on protected paths.
 *   #3 protected match = root-relative containment under the evidence subtree + canonical
 *      basename allowlist (gate-result / release-decision / qa_evidence_bundle, .ya?ml|.json,
 *      arbitrarily nested run dirs).
 *   #4 symlink/junction defeat: realpath the nearest existing ancestor of BOTH the target and
 *      the protected root before the containment compare (path.resolve alone is lexical).
 *   #5 malformed Write/Edit/MultiEdit payloads in a guarded project fail closed.
 *
 * Exit: 0 allow · 2 block.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Optional reuse of the shared QA helper for the enforcement-mode switch. Loaded defensively:
// if it is ever absent/renamed, the guard still works (treats every .qa project as enforcing).
let qaCommon = null;
try { qaCommon = require('./_qa-common.js'); } catch { qaCommon = null; }

// QA subsystem descriptor (single-subsystem scope).
//   configRel   — relative path whose presence (walking up from the TARGET dir) activates
//                 guarding and anchors the project root.
//   evidenceRel — protected subtree, relative to that root. A file is protected iff its REAL
//                 path is contained in <root>/<evidenceRel> AND its basename is in `verdicts`.
//   verdicts    — canonical QA verdict / gate-result basenames (case-insensitive).
//   marker      — required first non-empty line qa-sdk provenance marker (Write only).
const QA = {
  key: 'qa',
  configRel: path.join('.qa', 'config.json'),
  evidenceRel: path.join('.qa', 'evidence'),
  verdicts: /^(qa_evidence_bundle|gate-result|release-decision)\.(ya?ml|json)$/i,
  marker: /^#\s*written-by:\s*qa-sdk@\S+/,
};

const WRITE_TOOLS = new Set(['Write']);            // content writes — marker-checked
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit']); // partial edits — blocked outright on protected paths

// Anti-pathology bound only; real termination is the filesystem root (parent === dir).
const MAX_WALK = 4096;

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function firstNonEmptyLine(content) {
  const lines = String(content).split(/\r?\n/);
  for (const l of lines) if (l.trim() !== '') return l;
  return '';
}

// Walk up from startDir looking for a relative config file; return the NEAREST dir holding it,
// or null. (Existence-only callers don't need every root.)
function findUpDir(startDir, relConfigPath) {
  let dir;
  try { dir = path.resolve(startDir); } catch { return null; }
  for (let i = 0; i < MAX_WALK; i++) {
    try { if (fs.existsSync(path.join(dir, relConfigPath))) return dir; } catch { /* ignore */ }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// Walk up from startDir collecting EVERY dir that contains the config (nearest → outermost),
// so a nested same-subsystem config cannot mask an OUTER protected evidence root.
function findAllUpDirs(startDir, relConfigPath) {
  const roots = [];
  let dir;
  try { dir = path.resolve(startDir); } catch { return roots; }
  for (let i = 0; i < MAX_WALK; i++) {
    try { if (fs.existsSync(path.join(dir, relConfigPath))) roots.push(dir); } catch { /* ignore */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return roots;
}

// Canonical real path of p: realpath the nearest EXISTING ancestor (defeats symlinked /
// junctioned ancestors), then re-append the non-existent tail (the verdict file usually does
// not exist yet). Falls back to the lexical absolute path.
function resolveReal(p) {
  let abs;
  try { abs = path.resolve(String(p)); } catch { return null; }
  const tail = [];
  let cur = abs;
  for (let i = 0; i < MAX_WALK; i++) {
    try {
      const real = fs.realpathSync.native(cur);
      return tail.length ? path.join(real, ...tail) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs; // reached root, nothing along the path existed
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
  return abs;
}

// Cross-platform containment: is `child` the same as, or inside, `parent`?
// Separator-normalized + lowercased — Windows-correct, and a SAFE over-approximation on
// case-sensitive FS (it can only ever block more, never less).
function normForCompare(p) {
  return String(p).replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
}
function isInside(child, parent) {
  const c = normForCompare(child);
  const b = normForCompare(parent);
  return c === b || c.startsWith(b + '/');
}

// Is cwd inside a guarded QA project? Used only for the malformed-payload fail-closed decision,
// where no target path is available to anchor on.
function isGuardedProjectFromCwd(cwd) {
  return findUpDir(cwd, QA.configRel) !== null;
}

// True when the QA project rooted at `root` has enforcement switched OFF. Uses the shared
// _qa-common preflight semantics when available; defaults to ENFORCING (false) on any
// uncertainty so the guard can only ever block more, never less.
function isEnforcementOff(root) {
  if (!root || !qaCommon || typeof qaCommon.loadConfig !== 'function') return false;
  try {
    const { config, error } = qaCommon.loadConfig(root);
    // malformed/unreadable config -> NOT "off": keep enforcing (fail-closed posture).
    if (error || !config || typeof config !== 'object') return false;
    return config.qa_enforcement === 'off';
  } catch {
    return false;
  }
}

// Walk up from each candidate start dir collecting ALL QA config roots (not just the nearest,
// so a nested config can't mask an outer protected root); for every distinct discovered root,
// test whether `realTarget` is inside that root's real evidence subtree. Returns the matching
// protected root, or null. (dual lexical+real anchoring.)
function findProtectedRoot(startDirs, realTarget) {
  const seen = new Set();
  for (const start of startDirs) {
    for (const root of findAllUpDirs(start, QA.configRel)) {
      if (seen.has(root)) continue;
      seen.add(root);
      const protectedRoot = resolveReal(path.join(root, QA.evidenceRel));
      if (protectedRoot && isInside(realTarget, protectedRoot)) {
        return { protectedRoot, root };
      }
    }
  }
  return null;
}

// Like findProtectedRoot, but returns EVERY distinct protected root whose evidence subtree contains
// realTarget (nearest → outermost). E7 codex hooks finding HIGH-1 (2026-06-05): the single-root
// version lets a nested `.qa/config.json` with qa_enforcement:"off" — placed INSIDE an outer
// enforcing root's `.qa/evidence/**` — mask that outer root. The caller must enforce if ANY
// containing root is enforcing, so it needs the full set, not just the nearest.
function findProtectedRoots(startDirs, realTarget) {
  const seen = new Set();
  const matches = [];
  for (const start of startDirs) {
    for (const root of findAllUpDirs(start, QA.configRel)) {
      if (seen.has(root)) continue;
      seen.add(root);
      const protectedRoot = resolveReal(path.join(root, QA.evidenceRel));
      if (protectedRoot && isInside(realTarget, protectedRoot)) {
        matches.push({ protectedRoot, root });
      }
    }
  }
  return matches;
}

/**
 * decide(payload, cwd) -> { code, message }. Pure w.r.t. its cwd argument (uses no
 * process.cwd()), so it is unit-testable against real temp project dirs. code: 0 allow · 2 block.
 */
function decide(payload, cwd) {
  // ── malformed payload: fail-closed in a guarded QA project, NO-OP otherwise ──
  if (!payload || typeof payload !== 'object') {
    return isGuardedProjectFromCwd(cwd)
      ? { code: 2, message: 'malformed/empty PreToolUse payload in a guarded QA project (fail-closed).' }
      : { code: 0 };
  }

  // tool_name must be a non-empty STRING. A present-but-non-string value (e.g. `{}`) is
  // malformed → fail-closed in a guarded project.
  const rawTool = payload.tool_name !== undefined ? payload.tool_name : payload.tool;
  if (typeof rawTool !== 'string' || rawTool === '') {
    return isGuardedProjectFromCwd(cwd)
      ? { code: 2, message: 'PreToolUse payload has missing/non-string tool_name in a guarded QA project (fail-closed).' }
      : { code: 0 };
  }
  const toolName = rawTool;
  const isWrite = WRITE_TOOLS.has(toolName);
  const isEdit = EDIT_TOOLS.has(toolName);
  if (!isWrite && !isEdit) return { code: 0 }; // not a write-class tool → NO-OP

  const ti = (payload.tool_input && typeof payload.tool_input === 'object') ? payload.tool_input : {};
  const filePathRaw = ti.file_path || ti.path || '';
  if (typeof filePathRaw !== 'string' || filePathRaw.trim() === '') {
    return isGuardedProjectFromCwd(cwd)
      ? { code: 2, message: `${toolName} with missing/invalid file_path in a guarded QA project (fail-closed).` }
      : { code: 0 };
  }

  const lexicalAbs = path.resolve(cwd, filePathRaw);
  const realTarget = resolveReal(lexicalAbs);
  if (!realTarget) {
    return isGuardedProjectFromCwd(cwd)
      ? { code: 2, message: `${toolName} target path could not be resolved in a guarded QA project (fail-closed).` }
      : { code: 0 };
  }

  // Cheap pre-filter: a write is only a candidate if its (real OR lexical) basename is a
  // canonical QA verdict name. Normal source writes skip all fs work below.
  const lexicalBase = path.basename(lexicalAbs);
  const realBase = path.basename(realTarget);
  const matchesBasename = QA.verdicts.test(realBase) || QA.verdicts.test(lexicalBase);
  if (!matchesBasename) return { code: 0 };

  // Anchor to the discovered QA project root by walking up from the TARGET dir. Search from
  // BOTH the lexical and the REAL target dir, so a symlink/junction alias whose QA config is
  // not in the lexical ancestor chain (but IS above the real location) is still caught.
  const startDirs = [...new Set([path.dirname(lexicalAbs), path.dirname(realTarget)])];
  // ★ E7 codex hooks finding HIGH-1 (2026-06-05): collect EVERY protected root containing this
  // target, not just the nearest. A nested `.qa/config.json` with qa_enforcement:"off" inside an
  // outer enforcing root's evidence tree must NOT mask the outer root (guard hardening #1/#3).
  const matches = findProtectedRoots(startDirs, realTarget);
  if (matches.length === 0) return { code: 0 }; // QA not active above this target → not its verdict

  // Honor the QA enforcement switch, but fail-safe across nesting: enforce if ANY containing root
  // is enforcing; NO-OP only when EVERY containing root is qa_enforcement:"off".
  const enforcingMatches = matches.filter((m) => !isEnforcementOff(m.root));
  if (enforcingMatches.length === 0) return { code: 0 };
  const found = enforcingMatches[0]; // representative enforcing root (for the block message)

  // Target is a protected QA verdict file for an active, enforcing project.
  if (isEdit) {
    return { code: 2, message:
      `direct ${toolName} of a QA verdict file is not allowed (${realTarget}). Verdicts are ` +
      `written wholesale by qa-sdk, never partially edited. Use the qa-sdk write path.` };
  }
  const content = ti.content !== undefined ? ti.content : ti.new_string;
  if (!QA.marker.test(firstNonEmptyLine(content || ''))) {
    return { code: 2, message:
      `direct Write to a QA verdict file (${realTarget}) must be produced by qa-sdk: first ` +
      `non-empty line must be \`# written-by: qa-sdk@<version>\`. (Canonical-write-path / drift ` +
      `guard; integrity is enforced separately by verdict-validator --require-provenance at ` +
      `read/CI. See HOOK-BYPASS-MATRIX.md.)` };
  }
  return { code: 0, message: 'QA verdict write carries the qa-sdk marker — allowed.' };
}

// Parse stdin into a payload, or fail-closed in a guarded QA project.
// Returns { payload } on success, or { result } when the payload is empty/unparseable.
function parsePayload(raw, cwd) {
  if (!raw || raw.trim() === '') {
    return { result: isGuardedProjectFromCwd(cwd)
      ? { code: 2, message: 'empty PreToolUse payload in a guarded QA project (fail-closed).' }
      : { code: 0 } };
  }
  try { return { payload: JSON.parse(raw) }; }
  catch {
    return { result: isGuardedProjectFromCwd(cwd)
      ? { code: 2, message: 'unparseable PreToolUse payload in a guarded QA project (fail-closed).' }
      : { code: 0 } };
  }
}

function main() {
  const cwd = process.cwd();
  const { payload, result: parseResult } = parsePayload(readStdin(), cwd);
  const result = parseResult || decide(payload, cwd);

  if (result.code === 2) process.stderr.write(`[qa-bundle-write-guard] BLOCKED: ${result.message}\n`);
  else if (result.message) process.stderr.write(`[qa-bundle-write-guard] ${result.message}\n`);
  return result.code;
}

module.exports = {
  QA, WRITE_TOOLS, EDIT_TOOLS,
  findUpDir, findAllUpDirs, firstNonEmptyLine, resolveReal, isInside, normForCompare,
  isGuardedProjectFromCwd, isEnforcementOff, findProtectedRoot, findProtectedRoots, parsePayload, decide,
};

if (require.main === module) {
  process.exit(main());
}
