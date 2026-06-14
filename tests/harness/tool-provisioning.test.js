#!/usr/bin/env node
'use strict';

/**
 * tests/harness/tool-provisioning.test.js
 *
 * Guards the per-project tool-provisioning capability (ask #2):
 *   - catalog.json carries the 14 Wave A/B skills + new agent_addon wiring
 *   - tool-requirements.json is well-formed with NO offensive tool at tier=auto
 *   - provision-tools.js dry-run holds offensive (roe) tools back + never installs reference tools
 *   - claude-env-bootstrap SKILL.md wires Step 5c PROVISION
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('tool-provisioning');
const root = H.claudeRoot;
const manifestPath = path.join(root, 'manifests', 'tool-requirements.json');
const catalogPath = path.join(root, 'skills', 'claude-env-bootstrap', 'catalog.json');
const provPath = path.join(root, 'scripts', 'bootstrap', 'provision-tools.js');
const skillMd = path.join(root, 'skills', 'claude-env-bootstrap', 'SKILL.md');

const NEW_SKILLS = [
  'design-token-pipeline', 'motion-engineering', 'shadcn-registry',
  'security-app-fuzzing', 'security-app-sast-deep', 'dast-authenticated',
  'security-pentest-recon-scan', 'security-pentest-ai-redteam', 'security-pentest-exploitation-planning',
  'qa-load-stress-reliability', 'qa-mutation-effectiveness', 'qa-mobile-native-e2e', 'qa-resilience-fault-injection',
  'discoverability-growth',
];

h.section('Files exist');
h.assert(H.existsSync(manifestPath), 'manifests/tool-requirements.json exists');
h.assert(H.existsSync(provPath), 'scripts/bootstrap/provision-tools.js exists');

let M = null; let C = null;
try { M = H.readJson(manifestPath); h.ok('tool-requirements.json parses'); } catch (e) { h.error('tool-requirements.json parse', e.message); }
try { C = H.readJson(catalogPath); h.ok('catalog.json parses'); } catch (e) { h.error('catalog.json parse', e.message); }

if (C && C.skills) {
  h.section('catalog.json — 14 Wave A/B skills present');
  for (const s of NEW_SKILLS) h.assert(!!C.skills[s], `catalog has ${s}`);

  h.section('catalog.json — new agent_addon wiring');
  const uiux = C.skills['uiux-product-orchestrator'] || {};
  h.assert((uiux.agent_addon || []).includes('uiux-surface-builder') && (uiux.agent_addon || []).includes('uiux-design-reviewer'),
    'uiux-product-orchestrator agent_addon has surface-builder + design-reviewer');
  const disc = C.skills['discoverability-orchestrator'] || {};
  h.assert((disc.agent_addon || []).includes('disc-measurement-puller'), 'discoverability-orchestrator agent_addon has disc-measurement-puller');
  h.assert((C.skills['qa-load-stress-reliability'] || {}).agent_addon && C.skills['qa-load-stress-reliability'].agent_addon.includes('qa-load-stress-runner'), 'qa-load-stress-reliability agent_addon has its runner');

  h.section('catalog.json — pentest skills Q-pentest manual-gated');
  for (const s of ['dast-authenticated', 'security-pentest-recon-scan', 'security-pentest-exploitation-planning']) {
    h.assert((C.skills[s] || {}).manual_only_question === 'Q-pentest', `${s} is Q-pentest manual-gated`);
  }
}

if (M && M.tools) {
  const toolIds = Object.keys(M.tools);
  h.section(`tool-requirements.json invariants (${toolIds.length} tools)`);
  h.assert(toolIds.length > 0, 'tools registry non-empty');

  const refs = new Set(Object.values(M.skill_tools || {}).flat());
  const dangling = [...refs].filter(r => !M.tools[r]);
  h.assert(dangling.length === 0, 'no dangling skill_tools refs', dangling.join(', '));

  // SAFETY INVARIANT: an offensive tool must NEVER be tier=auto (would auto-install at bootstrap)
  const offensiveAuto = toolIds.filter(t => M.tools[t].offensive && M.tools[t].tier === 'auto');
  h.assert(offensiveAuto.length === 0, 'no offensive tool at tier=auto (bootstrap never auto-installs attack tools)', offensiveAuto.join(', '));

  // every offensive tool is roe (ROE-time) or reference (never installed)
  const offensiveBad = toolIds.filter(t => M.tools[t].offensive && !['roe', 'reference'].includes(M.tools[t].tier));
  h.assert(offensiveBad.length === 0, 'every offensive tool is tier roe|reference', offensiveBad.join(', '));

  h.section('skill_tools covers the new skills');
  for (const s of NEW_SKILLS) {
    h.assert(Array.isArray(M.skill_tools[s]) && M.skill_tools[s].length > 0, `skill_tools maps ${s}`);
  }
}

h.section('provision-tools.js dry-run smoke (offensive held back)');
try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'provtest-'));
  const out = cp.spawnSync(process.execPath, [
    provPath, '--project-root', tmp, '--dry-run',
    '--skills', 'security-pentest-recon-scan,qa-load-stress-reliability,security-app-sast-deep,security-pentest-exploitation-planning',
  ], { encoding: 'utf8', timeout: 60000 });
  const so = out.stdout || '';
  h.assert(out.status === 0, 'dry-run exits 0 (report-only, never blocks)', 'exit=' + out.status);
  h.assert(/ROE-time offensive tools/.test(so), 'reports a ROE-time offensive section');
  h.assert(/ROE-time offensive tools[\s\S]*nuclei/.test(so), 'nuclei classified ROE-time (not auto-installed)');
  h.assert(/Reference-only[\s\S]*metasploit/.test(so), 'metasploit reference-only (never installed)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
} catch (e) { h.error('dry-run smoke', e.message); }

h.section('claude-env-bootstrap SKILL.md wiring');
try {
  const md = H.readText(skillMd);
  h.assert(/Step 5c/.test(md) && /PROVISION/.test(md), 'SKILL.md has Step 5c PROVISION');
  h.assert(/provision-tools\.js/.test(md), 'SKILL.md references provision-tools.js');
} catch (e) { h.error('SKILL.md read', e.message); }

process.exit(h.exit());
