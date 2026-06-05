#!/usr/bin/env node
// qa-mark-stale — PostToolUse(Edit|Write|MultiEdit|Bash) hook (state-update only, NEVER blocks)
//
// Mirrors the L12 disc-mark-stale pattern (templates/discoverability/hooks/disc-mark-stale.js)
// for the QA harness. When the model edits a QA-relevant source/config/test file, or runs a
// deploy command, after a QA evidence bundle for the active release tag has been produced,
// this hook proactively marks that tag's evidence as STALE so that a re-run is forced before
// the evidence is trusted again.
//
// WHY this exists (active marking) on top of gate.check (passive aging):
//   - The freshness *threshold* lives in ONE place: .qa/config.json.evidence_freshness_hours
//     (default 24h). gate.check / the orchestrator decide STALE-by-age off that same number.
//   - This hook does NOT recompute or re-decide freshness; it records a *staleness event*
//     (a triggering edit/deploy happened AFTER the bundle was written) so age alone is not
//     the only staleness signal. It writes markers; it never emits a verdict.
//
// Contract (kept intentionally additive so nothing existing breaks):
//   1. Tag-scoped marker: .qa/evidence/<tag>/staleness.json  (new sidecar file; never touches
//      qa_evidence_bundle.yaml itself).
//   2. State annotation:  .qa/state.json gains gate_status="STALE" + a stale_reasons[] entry,
//      written additively (active_release_tag and every other existing key are preserved).
//      _qa-common.getActiveReleaseTag only reads active_release_tag, so unknown keys are inert.
//
// PostToolUse hooks cannot undo the edit/command; this only forces re-evaluation.
// Modes: qa_enforcement=off → exit 0; warn/strict → identical behavior (advisory marker only,
// PostToolUse is inherently non-blocking). Malformed config → silent exit 0 (never block here).

'use strict';

const fs = require('fs');
const path = require('path');

let readInput, preflight, getActiveReleaseTag;
try {
  ({ readInput, preflight, getActiveReleaseTag } = require('./_qa-common.js'));
} catch {
  // If the shared helper is unavailable for any reason, this advisory hook must not crash.
  process.exit(0);
}

// ───── input ─────
const input = readInput();
const pre = preflight(input);

// Non-QA project, enforcement disabled, or unparseable config → do nothing.
// (PostToolUse is advisory; we never block, so fail-closed is treated as silent here.)
if (pre.mode === 'silent' || pre.mode === 'off' || pre.mode === 'fail-closed') process.exit(0);

const projectRoot = pre.projectRoot;
if (!projectRoot) process.exit(0);

// Per-hook off switch via config (additive; absent => enabled). Supports either a flat
// `qa_mark_stale=off` or a nested `hook_modes.mark_stale=off`, mirroring disc's hook_modes.
const config = pre.config || {};
const hookModes = (config && typeof config.hook_modes === 'object' && config.hook_modes) || {};
if (config.qa_mark_stale === 'off' || hookModes.mark_stale === 'off') process.exit(0);

// ───── trigger detection ─────
const toolName = input.tool_name || input.tool || '';
const tinp = (input && input.tool_input) || {};

// QA-relevant edit targets: source code, config, and test/spec files. Deliberately broad —
// a STALE mark is cheap and only forces a re-run; missing a real change is the costly failure.
const QA_EDIT_TRIGGER_PATTERNS = [
  // Source code (common languages)
  /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|rb|php|swift|c|cc|cpp|h|hpp|cs|scala|vue|svelte)$/i,
  // Tests / specs explicitly (covered above too, but kept explicit for clarity)
  /(^|[\/\\]).*\.(test|spec)\.(t|j)sx?$/i,
  /(^|[\/\\])__tests__[\/\\]/i,
  // Build / dependency / config surfaces that change test outcomes
  /(^|[\/\\])package\.json$/i,
  /(^|[\/\\])(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb)$/i,
  /(^|[\/\\])tsconfig([^\/\\]*)\.json$/i,
  /(^|[\/\\])(vite|vitest|jest|playwright|cypress|webpack|rollup|babel|next)\.config\.(t|j)sx?$/i,
  /(^|[\/\\])(requirements\.txt|pyproject\.toml|poetry\.lock|go\.mod|go\.sum|Cargo\.(toml|lock)|Gemfile(\.lock)?|composer\.(json|lock)|pom\.xml|build\.gradle(\.kts)?)$/i,
  /(^|[\/\\])(Dockerfile|docker-compose\.(ya?ml)|\.dockerignore)$/i,
  // CI / pipeline definitions
  /(^|[\/\\])\.github[\/\\]workflows[\/\\].+\.(ya?ml)$/i,
  /(^|[\/\\])(\.gitlab-ci\.yml|\.circleci[\/\\]config\.yml|azure-pipelines\.yml|Jenkinsfile)$/i,
  // QA harness config itself
  /(^|[\/\\])\.qa[\/\\]config\.json$/i,
];

// Deploy commands that should invalidate prior QA evidence (a deploy implies the tested
// artifact is now in flight; re-verify before trusting the bundle again).
const QA_DEPLOY_COMMANDS = [
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

function buildDeployPatterns(extra) {
  const list = Array.isArray(extra) ? extra.map(String) : [];
  const merged = Array.from(new Set([...QA_DEPLOY_COMMANDS, ...list]));
  return merged.map((s) => {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return { command: s, re: new RegExp(`(^|[\\s;&|])${escaped}(\\s|$|[;&|<>])`, 'i') };
  });
}

function pathMatchesAny(filePath, patterns) {
  if (!filePath) return false;
  const fp = String(filePath).replace(/\\/g, '/');
  for (const re of patterns) if (re.test(fp)) return true;
  return false;
}

let triggerKind = null; // 'edit' | 'deploy'
let triggerDetail = null;

if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
  const filePath = tinp.file_path || tinp.path || '';
  if (!filePath) process.exit(0);
  if (!pathMatchesAny(filePath, QA_EDIT_TRIGGER_PATTERNS)) process.exit(0);
  triggerKind = 'edit';
  try { triggerDetail = path.relative(projectRoot, filePath) || filePath; } catch { triggerDetail = filePath; }
} else if (toolName === 'Bash') {
  const cmd = tinp.command || '';
  if (!cmd) process.exit(0);
  const deployExtra = config.deploy_commands || (hookModes && hookModes.deploy_commands);
  const deployPatterns = buildDeployPatterns(Array.isArray(deployExtra) ? deployExtra : []);
  let matched = null;
  for (const dp of deployPatterns) { if (dp.re.test(cmd)) { matched = dp.command; break; } }
  if (!matched) process.exit(0);
  triggerKind = 'deploy';
  triggerDetail = matched;
} else {
  process.exit(0);
}

// ───── locate active evidence bundle ─────
// Only mark stale if a bundle for the active tag already exists. If no QA run has happened,
// there is nothing to invalidate (an edit before any audit is normal development).
let activeTag = null;
let activeDir = null;
try { ({ activeTag, activeDir } = getActiveReleaseTag(projectRoot)); } catch { /* fall through */ }
if (!activeTag || !activeDir) process.exit(0);

const bundlePath = path.join(activeDir, 'qa_evidence_bundle.yaml');
if (!fs.existsSync(bundlePath)) process.exit(0); // no bundle yet → nothing to mark stale

// ───── 1) tag-scoped staleness.json marker (atomic) ─────
const reasonText =
  triggerKind === 'deploy'
    ? `Deploy command run after evidence bundle: ${triggerDetail}`
    : `Edit/Write touched QA-relevant file after evidence bundle: ${triggerDetail}`;

const nowIso = new Date().toISOString();
const stalenessPath = path.join(activeDir, 'staleness.json');

// ★ E7 codex hooks finding LOW-1 (2026-06-05): cap retained reasons so a busy session cannot grow
// staleness.json / .qa/state.json without bound; dedupe a push that is identical to the most
// recent entry (reason + detail). The marker only needs to PROVE staleness + carry recent context.
const MAX_STALE_REASONS = 50;
function pushBounded(arr, entry) {
  const last = arr[arr.length - 1];
  if (!last || last.reason !== entry.reason || last.detail !== entry.detail) arr.push(entry);
  if (arr.length > MAX_STALE_REASONS) arr.splice(0, arr.length - MAX_STALE_REASONS);
  return arr;
}
// ★ E7 codex hooks finding LOW-2 (2026-06-05): PID-unique temp name so two concurrent hook
// processes cannot clobber each other's atomic-write temp file.
function tmpFor(p) { return `${p}.${process.pid}.tmp`; }

function appendStalenessMarker() {
  let marker = null;
  if (fs.existsSync(stalenessPath)) {
    try { marker = JSON.parse(fs.readFileSync(stalenessPath, 'utf8')); } catch { marker = null; }
  }
  if (!marker || typeof marker !== 'object') {
    marker = {
      _schema_version: '1.0.0',
      release_tag: activeTag,
      stale: true,
      reasons: [],
    };
  }
  marker.release_tag = activeTag;
  marker.stale = true;
  if (!Array.isArray(marker.reasons)) marker.reasons = [];
  pushBounded(marker.reasons, {
    reason: reasonText,
    trigger_kind: triggerKind,
    detail: triggerDetail ? String(triggerDetail) : null,
    marked_at: nowIso,
    marked_by: 'qa-mark-stale-hook',
  });
  const tmp = tmpFor(stalenessPath);
  try {
    fs.writeFileSync(tmp, JSON.stringify(marker, null, 2), 'utf8');
    fs.renameSync(tmp, stalenessPath);
    return true;
  } catch {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    return false;
  }
}

// ───── 2) additive .qa/state.json annotation (atomic, preserves existing keys) ─────
function annotateState() {
  const statePath = path.join(projectRoot, '.qa', 'state.json');
  let state = null;
  if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { state = null; }
  }
  // If state.json is absent/corrupt we still create a minimal one rather than fabricate
  // an active tag we don't own: preserve active_release_tag exactly as discovered.
  if (!state || typeof state !== 'object') {
    state = {};
  }
  // Never clobber an existing active_release_tag; only set it if missing and we know it.
  if (!state.active_release_tag && activeTag) state.active_release_tag = activeTag;
  state.gate_status = 'STALE';
  if (!Array.isArray(state.stale_reasons)) state.stale_reasons = [];
  pushBounded(state.stale_reasons, {
    reason: reasonText,
    release_tag: activeTag,
    trigger_kind: triggerKind,
    detail: triggerDetail ? String(triggerDetail) : null,
    marked_at: nowIso,
    marked_by: 'qa-mark-stale-hook',
  });
  state.last_stale_at = nowIso;
  const tmp = tmpFor(statePath);
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
  } catch {}
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, statePath);
    return true;
  } catch {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    return false;
  }
}

const okMarker = appendStalenessMarker();
const okState = annotateState();

if (okMarker || okState) {
  process.stderr.write(
    `[qa-mark-stale] tag '${activeTag}' marked STALE (${triggerKind}: ${triggerDetail}); ` +
    `re-run enterprise-qa-testing for this tag before trusting the evidence bundle.\n`
  );
} else {
  process.stderr.write(
    `[qa-mark-stale] failed to write staleness markers for tag '${activeTag}'; ` +
    `check filesystem permissions under .qa/.\n`
  );
}

process.exit(0);
