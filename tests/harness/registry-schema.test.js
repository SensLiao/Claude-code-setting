#!/usr/bin/env node
'use strict';
/**
 * tests/harness/registry-schema.test.js
 *
 * T1.3 — keeps manifests/harness.registry.json in lockstep with its (realigned)
 * schema. The audit (C3) found the schema was dead AND drifted; this test makes
 * "registry conforms to schema" a CI invariant so it can never silently drift
 * again. Uses schemas/validate-registry.js (dependency-free — no ajv).
 */
const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('registry-schema');

const reg = path.join(H.claudeRoot, 'manifests', 'harness.registry.json');
const sch = path.join(H.claudeRoot, 'schemas', 'harness-registry.schema.json');
const validatorPath = path.join(H.claudeRoot, 'schemas', 'validate-registry.js');

h.section('wiring present');
h.assert(H.existsSync(validatorPath), 'schemas/validate-registry.js exists');
h.assert(H.existsSync(reg), 'manifests/harness.registry.json exists');
h.assert(H.existsSync(sch), 'schemas/harness-registry.schema.json exists');

h.section('registry conforms to realigned schema');
let result;
try {
  ({ run: result } = { run: require(validatorPath).run });
} catch (e) {
  h.error('cannot load validate-registry.js', e.message);
  process.exit(h.exit());
}
const { code, errors } = result(reg, sch);
if (code === 2) {
  h.error('registry/schema unreadable', (errors || []).join('; '));
} else {
  h.assert(code === 0, 'harness.registry.json validates against harness-registry.schema.json',
    (errors || []).slice(0, 20).join(' | '));
}

process.exit(h.exit());
