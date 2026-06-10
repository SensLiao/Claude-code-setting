#!/usr/bin/env node
'use strict';

/**
 * tests/harness/docs-drift.test.js
 *
 * Part 1: delegates to tools/docs-drift/lint.js — propagates its exit code.
 * Part 2 (added 2026-06-10): static drift assertions that pin the post-audit
 *   state of CLAUDE.md / SKILLS-INDEX / ORCHESTRATOR-MAP / skills.manifest.json
 *   so the cleaned-up references cannot silently regress.
 */

const path = require('path');
const child_process = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('docs-drift (delegates to tools/docs-drift/lint.js + static assertions)');

const LINTER = path.join(H.claudeRoot, 'tools', 'docs-drift', 'lint.js');
if (!H.existsSync(LINTER)) {
  h.error(`Linter not found: ${H.rel(LINTER)}`);
  process.exit(h.exit());
}

h.section('Running tools/docs-drift/lint.js');
const out = child_process.spawnSync(
  process.execPath,
  [LINTER, '--root', H.claudeRoot],
  { stdio: 'inherit' }
);

const code = out.status == null ? 2 : out.status;
if (code === 0) {
  h.ok('tools/docs-drift/lint.js exit 0 (clean)');
} else if (code === 1) {
  h.fail(`tools/docs-drift/lint.js exit 1 (drift detected)`);
} else {
  h.error(`tools/docs-drift/lint.js exit ${code}`, out.error ? out.error.message : null);
}

// ---------------------------------------------------------------------------
// Static drift assertions (2026-06-10 harness audit refresh)
// ---------------------------------------------------------------------------
h.section('Static drift assertions');

function readClaude(rel) {
  const full = path.join(H.claudeRoot, ...rel.split('/'));
  if (!H.existsSync(full)) { h.error(`expected file missing: ${rel}`); return null; }
  return H.readText(full);
}

const claudeMd = readClaude('CLAUDE.md');
const skillsManifestRaw = readClaude('manifests/skills.manifest.json');
const orchMap = readClaude('docs/ORCHESTRATOR-MAP.md');

// (a) CLAUDE.md must not carry a LIVE Desktop/architecture path reference or
//     the deleted _backup-20260523 backup dir (cleaned up in the 2026-06-10 pass).
//     A "live path reference" = backtick-wrapped, ~/-prefixed, or pointing at a
//     concrete file under Desktop/architecture/. Bare prose noting the path was
//     *cleaned up / removed* (e.g. "已随 Desktop/architecture 清理移除") is NOT
//     drift — same negative-example tolerance the docs-drift linter applies.
if (claudeMd != null) {
  // Live = tilde-prefixed (~/Desktop/architecture) OR a concrete file path
  // (Desktop/architecture/<file>). Bare prose "Desktop/architecture <汉字>"
  // (no trailing /file, no ~/ prefix) is a cleaned-up mention, not a live ref.
  const liveDesktopArchRef = /(?:~\/Desktop\/architecture|Desktop\/architecture\/[A-Za-z0-9._-])/;
  h.assert(
    !liveDesktopArchRef.test(claudeMd),
    'CLAUDE.md has no live "Desktop/architecture" path reference',
    'stale absolute Desktop path — should be removed (prose noting it was cleaned up is fine)'
  );
  h.assert(
    !claudeMd.includes('_backup-20260523'),
    'CLAUDE.md does not reference "_backup-20260523"',
    'backup dir was cleaned up; current backups live under ~/.claude/backups/'
  );
}

// (b) CLAUDE.md AppSec hook-scope line must point at the registry SSOT
//     (instead of hardcoding a per-family hook count).
if (claudeMd != null) {
  h.assert(
    /AppSec[\s\S]{0,400}hook-registry\.json/i.test(claudeMd)
      || /hook-registry\.json[\s\S]{0,400}AppSec/i.test(claudeMd),
    'CLAUDE.md AppSec hook-scope text references "hook-registry.json"',
    'hook enumeration must point at manifests/hook-registry.json, not a hardcoded count'
  );
}

// (c) skills.manifest.json must register the 3 AppSec skills added 2026-06-10
//     in their correct families.
if (skillsManifestRaw != null) {
  let manifest = null;
  try { manifest = JSON.parse(skillsManifestRaw); }
  catch (e) { h.error('skills.manifest.json failed to parse', e.message); }
  if (manifest) {
    const ss = manifest.supporting_skills || {};
    const overlay = ss.appsec_app_overlay || [];
    const platform = ss.appsec_platform || [];
    const compliance = ss.appsec_compliance || [];
    h.assert(
      overlay.includes('security-app-api'),
      'skills.manifest.json appsec_app_overlay includes security-app-api'
    );
    h.assert(
      platform.includes('security-platform-supply-chain'),
      'skills.manifest.json appsec_platform includes security-platform-supply-chain'
    );
    h.assert(
      compliance.includes('security-compliance-privacy'),
      'skills.manifest.json appsec_compliance includes security-compliance-privacy'
    );
  }
}

// (d) ORCHESTRATOR-MAP.md must not carry the dead subsystem hook template paths.
if (orchMap != null) {
  h.assert(
    !orchMap.includes('templates/uiux/hooks'),
    'ORCHESTRATOR-MAP.md does not reference "templates/uiux/hooks"',
    'dead path — hooks are sourced from manifests/hook-registry.json'
  );
  h.assert(
    !orchMap.includes('templates/appsec/hooks'),
    'ORCHESTRATOR-MAP.md does not reference "templates/appsec/hooks"',
    'dead path — hooks are sourced from manifests/hook-registry.json'
  );
}

process.exit(h.exit());
