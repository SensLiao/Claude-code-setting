#!/usr/bin/env node
'use strict';

/**
 * tests/harness/manifest-versions.test.js
 *
 * Verifies canonical version references across:
 *   - manifests/skills.manifest.json   (appsec-security-orchestrator → 3.0.0)
 *   - manifests/harness.registry.json  (orchestrator v3.0.0; L12 v1.2.0)
 *   - CLAUDE.md                        (AppSec v3.0, ROE 11/13 dual-track, L12 v1.2)
 *   - SKILLS-INDEX.md                  (AppSec v3.0, ROE 11/13 dual-track)
 *
 * Exit codes per PR-6 spec: 0=PASS, 1=FAIL (drift), 2=ERROR (infra)
 */

const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('manifest-versions');

// ---------- Pre-flight: required files exist ----------------------------
const FILES = {
  skillsManifest: path.join(H.claudeRoot, 'manifests', 'skills.manifest.json'),
  harnessRegistry: path.join(H.claudeRoot, 'manifests', 'harness.registry.json'),
  claudeMd: path.join(H.claudeRoot, 'CLAUDE.md'),
  skillsIndex: path.join(H.claudeRoot, 'SKILLS-INDEX.md'),
};
for (const [k, p] of Object.entries(FILES)) {
  if (!H.existsSync(p)) {
    h.error(`Required file missing: ${k} (${H.rel(p)})`);
  }
}
if (h.infraErrors > 0) process.exit(h.exit());

// ---------- Parse JSON manifests ----------------------------------------
let skillsManifest; let harnessRegistry;
try { skillsManifest = H.readJson(FILES.skillsManifest); }
catch (e) {
  h.error(`Failed to parse skills.manifest.json`, e.message);
  process.exit(h.exit());
}
try { harnessRegistry = H.readJson(FILES.harnessRegistry); }
catch (e) {
  h.error(`Failed to parse harness.registry.json`, e.message);
  process.exit(h.exit());
}

const claudeMd = H.readText(FILES.claudeMd);
const skillsIndex = H.readText(FILES.skillsIndex);

// ---------- 1. AppSec v3.0 in skills.manifest.json ----------------------
h.section('skills.manifest.json — AppSec orchestrator v3.0.0');

function findOrchestrator(manifest, predicate) {
  const arr = manifest.primary_orchestrators || [];
  return arr.find(predicate);
}

const skillsAppSec = findOrchestrator(skillsManifest, (o) => {
  return o.name === 'appsec-security-orchestrator'
    || o.canonical_id === 'security.orchestrator'
    || (Array.isArray(o.aliases) && o.aliases.includes('appsec'));
});

if (!skillsAppSec) {
  h.fail('appsec-security-orchestrator entry not found in skills.manifest.json primary_orchestrators');
} else {
  h.assert(
    skillsAppSec.version === '3.0.0',
    `skills.manifest.json appsec-security-orchestrator.version === "3.0.0"`,
    `got: ${JSON.stringify(skillsAppSec.version)}`
  );
}

// ---------- 2. harness.registry.json — orchestrator + L12 ---------------
h.section('harness.registry.json — version refs');

const regAppSec = findOrchestrator(harnessRegistry, (o) =>
  o.name === 'appsec-security-orchestrator'
);
h.assert(
  regAppSec && regAppSec.version === '3.0.0',
  `harness.registry.json primary_orchestrators[appsec-security-orchestrator].version === "3.0.0"`,
  regAppSec ? `got: ${JSON.stringify(regAppSec.version)}` : 'entry not found'
);

const regL12 = (harnessRegistry.downstream_gates || []).find(g =>
  g.name === 'discoverability-orchestrator'
);
h.assert(
  regL12 && regL12.version === '1.2.0',
  `harness.registry.json downstream_gates[discoverability-orchestrator].version === "1.2.0"`,
  regL12 ? `got: ${JSON.stringify(regL12.version)}` : 'entry not found'
);

// ---------- 3. CLAUDE.md — AppSec v3.0 ----------------------------------
h.section('CLAUDE.md — AppSec v3.0 reference');

const claudeMdHasV3 = /AppSec\s+v3\.0/i.test(claudeMd);
h.assert(
  claudeMdHasV3,
  'CLAUDE.md contains "AppSec v3.0"',
  claudeMdHasV3 ? null : 'No "AppSec v3.0" found in CLAUDE.md'
);

// Disallow stray "AppSec v2.0" outside deprecation context
// A "deprecation context" line is one mentioning v3 or words like
// upgrade/migration/replaced/legacy.
const legacyV2Lines = claudeMd.split('\n')
  .map((line, idx) => ({ line, idx: idx + 1 }))
  .filter(({ line }) => /AppSec\s+v2\.0/i.test(line))
  .filter(({ line }) =>
    !/(deprecat|legacy|upgrade|migrat|升级|废弃|淘汰|v2\s*[-->]+\s*v3|→\s*v3|v3.*replace)/i.test(line)
  );
h.assert(
  legacyV2Lines.length === 0,
  'CLAUDE.md has no bare "AppSec v2.0" reference outside deprecation context',
  legacyV2Lines.length
    ? `legacy lines: ${legacyV2Lines.map(x => `L${x.idx}`).join(', ')}`
    : null
);

// ---------- 4. SKILLS-INDEX.md — v3.0 ----------------------------------
h.section('SKILLS-INDEX.md — AppSec v3.0 reference');

const skillsIndexHasV3 = /(AppSec[^\n]*?v3\.0|appsec-security-orchestrator[^\n]*?v3\.0|v3\.0[^\n]*?(GSD-lite|AppSec))/i.test(skillsIndex);
h.assert(
  skillsIndexHasV3,
  'SKILLS-INDEX.md references AppSec orchestrator v3.0',
  skillsIndexHasV3 ? null : 'No v3.0 reference associated with AppSec found in SKILLS-INDEX.md'
);

// ---------- 5. ROE 11/13 dual-track in both docs -----------------------
h.section('ROE dual-track — 11 user-visible / 13 internal');

for (const [name, body] of [
  ['CLAUDE.md', claudeMd],
  ['SKILLS-INDEX.md', skillsIndex],
]) {
  const has11 = /11\s*user[- ]?visible/i.test(body);
  const has13 = /13\s*internal/i.test(body);
  h.assert(
    has11,
    `${name} contains "11 user-visible"`,
    has11 ? null : 'missing literal "11 user-visible"'
  );
  h.assert(
    has13,
    `${name} contains "13 internal"`,
    has13 ? null : 'missing literal "13 internal"'
  );
}

// ---------- 6. L12 v1.2 reference --------------------------------------
h.section('L12 discoverability — v1.2 references');

const claudeL12 = /v1\.2(\.\d+)?/.test(claudeMd) && /discoverability/i.test(claudeMd);
h.assert(
  claudeL12,
  'CLAUDE.md contains v1.2 reference associated with discoverability',
  claudeL12 ? null : 'no "v1.2" found near discoverability in CLAUDE.md'
);

const regL12HasV12 = regL12 && (regL12.version === '1.2.0' || /1\.2/.test(regL12.version || ''));
h.assert(
  regL12HasV12,
  'harness.registry.json downstream_gates[discoverability-orchestrator] references v1.2',
  regL12 ? `got: ${regL12.version}` : 'entry not found'
);

// ---------- Finalize ---------------------------------------------------
process.exit(h.exit());
