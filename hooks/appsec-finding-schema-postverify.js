#!/usr/bin/env node
// appsec-finding-schema-postverify — PostToolUse(Write|Edit) hook (audit-only)
// SKILL.md §18.5b. Cannot undo a write that already happened — instead:
//   1. Re-parse landed YAML
//   2. If schema drift detected, move to .appsec/findings/<tag>/.quarantine/
//   3. Emit advisory via updatedToolOutput so Claude sees the failure

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readInputSafe, preflight, detectSecrets, emitAdvisory,
} = require('./_appsec-common.js');

// ★ P7 fix (Tier 1 #1): PostToolUse is audit-only, but a malformed input still gets surfaced
const { input, parseError } = readInputSafe();
if (parseError) {
  emitAdvisory('PostToolUse', [`[appsec-finding-schema-postverify] stdin parse failed: ${parseError}`]);
  process.exit(0);
}
const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

const toolName = input.tool_name || input.tool || '';
if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'MultiEdit') process.exit(0);

const tinp = input.tool_input || {};
const filePath = tinp.file_path || tinp.path || '';
const norm = String(filePath).replace(/\\/g, '/');
const isFinding = /\/\.appsec\/findings\/.+\.yaml$/i.test(norm) || /^\.appsec\/findings\/.+\.yaml$/i.test(norm);
if (!isFinding) process.exit(0);

if (pre.mode === 'fail-closed') {
  emitAdvisory('PostToolUse', [`[appsec-finding-schema-postverify] fail-closed: ${pre.reason}`]);
  process.exit(0);
}

let raw = '';
try { raw = fs.readFileSync(filePath, 'utf8'); } catch (e) {
  emitAdvisory('PostToolUse', [
    `[appsec-finding-schema-postverify] could not read landed file ${filePath}: ${e.message}`,
  ]);
  process.exit(0);
}

const stripped = raw.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');

const issues = [];

// ASVS 4.x in data
if (/\bV\d+\.\d+\.\d+\b/.test(stripped)) {
  issues.push(`ASVS 4.x identifier detected (V<n>.<n>.<n>)`);
}

// ASVS 5.0 regex on entries
const asvsBlock = stripped.match(/asvs_mapping\s*:\s*\[([^\]]*)\]/);
if (asvsBlock) {
  const entries = asvsBlock[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  for (const e of entries) {
    if (!/^v5\.0\.0-\d+\.\d+\.\d+$/.test(e)) {
      issues.push(`asvs_mapping entry '${e}' violates ^v5\\.0\\.0-\\d+\\.\\d+\\.\\d+$`);
    }
  }
}

// Secret detection
const secrets = detectSecrets(stripped);
if (secrets.length > 0) {
  issues.push(`raw secret patterns: ${secrets.map(s => s.name).join(', ')}`);
}

// Required fields
const required = ['schema_version', 'id', 'source', 'detector', 'severity', 'confidence', 'asvs_mapping', 'csf_function', 'description'];
const missing = required.filter(k => !new RegExp(`^[ \\t]{0,4}${k}[ \\t]*:`, 'm').test(stripped));
if (missing.length > 0) {
  issues.push(`required fields missing: ${missing.join(', ')}`);
}

if (issues.length === 0) process.exit(0);

// Quarantine the file
try {
  const dir = path.dirname(filePath);
  const qDir = path.join(dir, '.quarantine');
  fs.mkdirSync(qDir, { recursive: true });
  const base = path.basename(filePath);
  const qPath = path.join(qDir, base);
  fs.renameSync(filePath, qPath);
  fs.writeFileSync(
    path.join(qDir, `${base}.reason.txt`),
    `Quarantined by appsec-finding-schema-postverify at ${new Date().toISOString()}\n\nIssues:\n` +
    issues.map(i => `  - ${i}`).join('\n') + '\n\nSee SKILL.md §18.5.\n',
  );
} catch (e) {
  // If quarantine itself fails, surface the failure as advisory only
  emitAdvisory('PostToolUse', [
    `[appsec-finding-schema-postverify] schema drift detected but quarantine failed: ${e.message}`,
    ...issues.map(i => `  - ${i}`),
  ]);
  process.exit(0);
}

emitAdvisory('PostToolUse', [
  `[appsec-finding-schema-postverify] finding ${filePath} failed schema v1.0 — quarantined.`,
  ...issues.map(i => `  - ${i}`),
  `Rewrite using \`appsec-sdk finding.add\` (canonical path per SKILL.md §18.5a).`,
]);
process.exit(0);
