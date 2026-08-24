#!/usr/bin/env node
'use strict';

/**
 * tests/harness/file-existence.test.js
 *
 * Asserts every canonical file produced by Waves 1+2 exists on disk.
 */

const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('file-existence');

const REQUIRED = [
  // Manifests
  'manifests/harness.registry.json',
  'manifests/hook-registry.json',
  'manifests/skill-overrides.recommended.json',

  // Schemas
  'schemas/harness-registry.schema.json',
  'schemas/hook-registry.schema.json',

  // Tooling
  'tools/hooks/lint.js',
  'tools/skill-visibility/generate.js',

  // Evidence kit
  'scripts/appsec-sdk.sh',
  'scripts/qa-sdk.sh',
  'orchestrator-runtime/shared/run-ledger.js',
  'orchestrator-runtime/shared/preview-template.md',
];

h.section(`Required files (${REQUIRED.length})`);
for (const relPath of REQUIRED) {
  // Normalize to OS path
  const full = path.join(H.claudeRoot, ...relPath.split('/'));
  h.assert(
    H.existsSync(full),
    `${relPath} exists`,
    `expected at: ${H.rel(full)}`
  );
}

process.exit(h.exit());
