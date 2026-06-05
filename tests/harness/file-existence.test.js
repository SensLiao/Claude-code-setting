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
  // Docs
  'docs/CANONICALS.md',
  'docs/ORCHESTRATOR-MAP.md',
  'docs/L12-DISCOVERABILITY.md',
  'docs/HANDOFFS.md',

  // Manifests
  'manifests/harness.registry.json',
  'manifests/hook-registry.json',

  // Schemas
  'schemas/gate-decision.schema.yaml',
  'schemas/handoff.schema.yaml',
  'schemas/pentest-roe.schema.yaml',
  'schemas/harness-registry.schema.json',
  'schemas/hook-registry.schema.json',

  // Tooling
  'tools/hooks/lint.js',
  'tools/docs-drift/lint.js',

  // Scripts
  'scripts/appsec-sdk.sh',
  'skills/discoverability-orchestrator/scripts/discoverability-sdk.py',

  // AppSec routing test fixtures
  'tests/appsec-routing/runner.sh',
  'tests/appsec-routing/expected-routes.json',
  'tests/appsec-routing/fixtures/refusal-tests.yaml',
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
