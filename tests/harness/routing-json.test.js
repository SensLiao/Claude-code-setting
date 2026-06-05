#!/usr/bin/env node
'use strict';

/**
 * tests/harness/routing-json.test.js
 *
 * Verifies that every manifest JSON parses + exposes required top-level keys.
 *
 *   - skills.manifest.json       → primary_orchestrators, supporting_skills,
 *                                  agent_families, hooks, sdks, evidence_roots,
 *                                  name_freeze
 *   - harness.registry.json      → primary_orchestrators, downstream_gates,
 *                                  manual_first_skills, agents, hooks, sdks,
 *                                  evidence_roots, schemas, handoff_schemas,
 *                                  decision_semantics, name_freeze
 *   - hook-registry.json         → categories, enforcement_gaps_callout
 *   - skill-routing-policy.json  → intent_to_orchestrator, tie_break_rules,
 *                                  manual_first_skills
 */

const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('routing-json');

const MANIFEST_DIR = path.join(H.claudeRoot, 'manifests');

const expectations = [
  {
    file: 'skills.manifest.json',
    required: [
      'primary_orchestrators',
      'supporting_skills',
      'agent_families',
      'hooks',
      'sdks',
      'evidence_roots',
      'name_freeze',
    ],
  },
  {
    file: 'harness.registry.json',
    required: [
      'primary_orchestrators',
      'downstream_gates',
      'manual_first_skills',
      'agents',
      'hooks',
      'sdks',
      'evidence_roots',
      'schemas',
      'handoff_schemas',
      'decision_semantics',
      'name_freeze',
    ],
  },
  {
    file: 'hook-registry.json',
    required: [
      'categories',
      'enforcement_gaps_callout',
    ],
  },
  {
    file: 'skill-routing-policy.json',
    required: [
      'intent_to_orchestrator',
      'tie_break_rules',
      'manual_first_skills',
    ],
  },
];

for (const spec of expectations) {
  h.section(spec.file);
  const full = path.join(MANIFEST_DIR, spec.file);
  if (!H.existsSync(full)) {
    h.error(`Missing manifest file: ${H.rel(full)}`);
    continue;
  }
  let data;
  try {
    data = H.readJson(full);
    h.ok(`parses as valid JSON: ${spec.file}`);
  } catch (e) {
    h.error(`Parse error in ${spec.file}`, e.message);
    continue;
  }
  for (const key of spec.required) {
    const present = Object.prototype.hasOwnProperty.call(data, key);
    h.assert(
      present,
      `${spec.file} has top-level key "${key}"`,
      present ? null : `key "${key}" missing`
    );
  }

  // Schema version stamp soft-check
  if (typeof data.schema_version === 'string') {
    h.ok(`${spec.file} declares schema_version = ${data.schema_version}`);
  } else {
    h.assertSoft(false, `${spec.file} missing schema_version stamp (informational)`);
  }
}

process.exit(h.exit());
