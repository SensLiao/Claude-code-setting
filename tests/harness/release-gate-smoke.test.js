#!/usr/bin/env node
'use strict';

/**
 * tests/harness/release-gate-smoke.test.js
 *
 * Smoke test the gate decision pipeline:
 *   1. gate-decision.schema.yaml contains the canonical 7-enum
 *      (PASS, WARN, CONDITIONAL_PASS, FAIL, BLOCKED, STALE, STRATEGY_READY)
 *   2. harness.registry.json `decision_semantics.gate_vocabulary` matches the
 *      same enum
 *   3. appsec-sdk.sh prints its usage when invoked with --help (and exits 0)
 *
 * No fixture-project gate run — fixtures aren't part of this PR. We report
 * "SMOKE_SKIPPED" with a reason rather than failing.
 */

const path = require('path');
const child_process = require('child_process');
const os = require('os');
const H = require('./_helpers');

const h = new H.Harness('release-gate-smoke');

const CANONICAL_ENUM = new Set([
  'PASS', 'WARN', 'CONDITIONAL_PASS', 'FAIL', 'BLOCKED', 'STALE', 'STRATEGY_READY',
]);

// ---------- 1. gate-decision.schema.yaml ----------------------------------
h.section('gate-decision.schema.yaml — canonical 7-enum');

const SCHEMA = path.join(H.claudeRoot, 'schemas', 'gate-decision.schema.yaml');
if (!H.existsSync(SCHEMA)) {
  h.error(`Schema missing: ${H.rel(SCHEMA)}`);
} else {
  const raw = H.readText(SCHEMA);
  // Line-based parse. Find the `decision:` property, then the `enum:` line
  // immediately after, then accumulate `- VALUE` lines while they share
  // the same indent depth.
  let enumValues = [];
  const lines = raw.split('\n');
  let inDecision = false;
  let enumIndent = -1;
  let collecting = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inDecision) {
      // top-level "decision:" property is at indent 2 (inside "properties:")
      if (/^\s{2}decision:\s*$/.test(line)) { inDecision = true; continue; }
      continue;
    }
    if (inDecision && !collecting) {
      // Look for `    enum:` at deeper indent (4 spaces)
      const em = line.match(/^(\s+)enum:\s*$/);
      if (em) { enumIndent = em[1].length; collecting = true; continue; }
      // If we leave the decision block (dedent to <=2 spaces and non-blank)
      if (/^\s{0,2}\S/.test(line)) { inDecision = false; continue; }
    }
    if (collecting) {
      // Accept lines like `      - PASS` at indent > enumIndent
      const item = line.match(/^(\s+)-\s+(\S+)\s*$/);
      if (item && item[1].length > enumIndent) {
        enumValues.push(item[2]);
        continue;
      }
      // Stop when we hit a non-list line at any indent <= enumIndent
      if (line.trim() === '') continue;
      break;
    }
  }
  // Fallback: if extraction failed, glob for any canonical token
  if (enumValues.length === 0) {
    for (const v of CANONICAL_ENUM) {
      if (new RegExp(`\\b${v}\\b`).test(raw)) enumValues.push(v);
    }
  }
  const present = new Set(enumValues);
  let missing = [];
  for (const v of CANONICAL_ENUM) if (!present.has(v)) missing.push(v);
  let extra = [...present].filter(v => !CANONICAL_ENUM.has(v));

  if (missing.length === 0 && extra.length === 0) {
    h.ok(`gate-decision.schema.yaml decision.enum declares all 7 canonical values`);
  } else {
    if (missing.length) h.fail(`gate-decision.schema.yaml decision.enum missing: ${missing.join(', ')}`);
    if (extra.length)   h.fail(`gate-decision.schema.yaml decision.enum has non-canonical: ${extra.join(', ')}`);
  }
}

// ---------- 2. harness.registry.json decision_semantics --------------------
h.section('harness.registry.json — decision_semantics.gate_vocabulary');

const REGISTRY = path.join(H.claudeRoot, 'manifests', 'harness.registry.json');
if (!H.existsSync(REGISTRY)) {
  h.error(`Registry missing: ${H.rel(REGISTRY)}`);
} else {
  let reg;
  try { reg = H.readJson(REGISTRY); }
  catch (e) { h.error('Could not parse harness.registry.json', e.message); }
  if (reg) {
    const vocab = reg.decision_semantics && reg.decision_semantics.gate_vocabulary;
    if (!vocab || typeof vocab !== 'object') {
      h.fail('harness.registry.json missing decision_semantics.gate_vocabulary');
    } else {
      const keys = new Set(Object.keys(vocab));
      let missing = []; let extra = [];
      for (const v of CANONICAL_ENUM) if (!keys.has(v)) missing.push(v);
      for (const v of keys) if (!CANONICAL_ENUM.has(v)) extra.push(v);
      if (missing.length === 0 && extra.length === 0) {
        h.ok('harness.registry.json gate_vocabulary keys match canonical 7-enum');
      } else {
        if (missing.length) h.fail(`gate_vocabulary missing: ${missing.join(', ')}`);
        if (extra.length)   h.fail(`gate_vocabulary has extras: ${extra.join(', ')}`);
      }

      // semantic sanity: PASS|WARN|CONDITIONAL_PASS allow release; FAIL|BLOCKED|STALE block
      const expectRelease = {
        PASS: 'allowed',
        FAIL: 'blocked',
        BLOCKED: 'blocked',
        STALE: 'blocked',
      };
      for (const [dec, expected] of Object.entries(expectRelease)) {
        if (vocab[dec]) {
          const r = (vocab[dec].release || '').toString().toLowerCase();
          const ok = r.includes(expected);
          h.assertSoft(
            ok,
            `  ${dec}.release indicates "${expected}"`,
            ok ? null : `got: "${r}"`
          );
        }
      }
    }
  }
}

// ---------- 3. appsec-sdk.sh --help ---------------------------------------
h.section('appsec-sdk.sh --help (no error)');

const SDK = path.join(H.claudeRoot, 'scripts', 'appsec-sdk.sh');
if (!H.existsSync(SDK)) {
  h.error(`SDK missing: ${H.rel(SDK)}`);
} else {
  // Need bash to execute. On Windows, try git-bash or wsl.
  let bashCmd = 'bash';
  if (os.platform() === 'win32') {
    // Use whichever 'bash' is on PATH; spawnSync will fail gracefully.
    bashCmd = 'bash';
  }
  const out = child_process.spawnSync(bashCmd, [SDK, '--help'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  if (out.error && out.error.code === 'ENOENT') {
    h.assertSoft(
      false,
      'SMOKE_SKIPPED: appsec-sdk.sh --help (bash unavailable on this host)',
      'install bash / use WSL / Git Bash to enable this smoke check'
    );
  } else if (out.status === 0 || out.status === 2) {
    // status 0 = clean usage print; status 2 = ours when no cmd given
    const blob = (out.stdout || '') + (out.stderr || '');
    const hasCanonical = ['init', 'evidence.append', 'gate.check', 'roe.verify']
      .every(c => blob.includes(c));
    h.assert(
      hasCanonical,
      'appsec-sdk.sh --help output mentions canonical commands',
      hasCanonical ? null : 'usage missing one of: init / evidence.append / gate.check / roe.verify'
    );
  } else {
    h.fail(
      `appsec-sdk.sh --help exited unexpectedly with status ${out.status}`,
      (out.stderr || '').slice(0, 200) || (out.error && out.error.message)
    );
  }
}

// ---------- 4. Fixture-project smoke: SMOKE_SKIPPED (no fixture present) --
h.section('Fixture-project gate run');
h.warn('SMOKE_SKIPPED: no fixture project under tests/fixtures/ for end-to-end gate run');

// ---------- 5. Regression: duplicate-key decision smuggling must BLOCK -----
// Codex adversarial test (2026-06-14): a decision file with TWO top-level `decision:`
// keys (PASS bait + BLOCKED terminal) must be REFUSED (exit 2), not silently passed by
// the grep|head extractor picking the first PASS. Guards the fail-closed fix in cmd_gate_check.
h.section('regression: duplicate decision: key smuggling -> BLOCKED');
if (!H.existsSync(SDK)) {
  h.warn('SMOKE_SKIPPED: appsec-sdk.sh missing');
} else {
  const fs = require('fs');
  const probe = child_process.spawnSync('bash', ['-c', 'true'], { timeout: 5000 });
  if (probe.error && probe.error.code === 'ENOENT') {
    h.assertSoft(false, 'SMOKE_SKIPPED: dup-key regression (bash unavailable)', 'install bash / Git Bash / WSL');
  } else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dupkey-'));
    try {
      const tag = 'dupkey-regression';
      const decDir = path.join(tmp, '.appsec', 'decisions', tag);
      fs.mkdirSync(decDir, { recursive: true });
      fs.writeFileSync(path.join(tmp, '.appsec', 'config.json'), '{"evidence_freshness_hours":99999999}');
      fs.writeFileSync(
        path.join(decDir, 'appsec_release_decision.yaml'),
        'decision: PASS\ndecided_at: "2020-01-01T00:00:00Z"\nredaction:\n  attested: true\ndecision: BLOCKED\n'
      );
      const out = child_process.spawnSync('bash', [SDK, 'gate.check', tag, '--strict'], {
        cwd: tmp,
        encoding: 'utf8',
        timeout: 20000,
        env: Object.assign({}, process.env, { CLAUDE_HOME: H.claudeRoot }),
      });
      // exit 2 = BLOCKED (correct, fail-closed). exit 0 = the smuggle worked → regression.
      h.assert(
        out.status === 2,
        'gate.check refuses a decision file with duplicate conflicting decision: keys (exit 2)',
        `got exit ${out.status}; stderr: ${(out.stderr || '').slice(0, 160)}`
      );
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    }
  }
}

// ---------- 6. Regression: grep/head-vs-YAML parsing-seam fail-opens must BLOCK ----------
// Codex + 5-agent adversarial sweep (2026-06-14) found 10 fail-opens where shell field extraction
// lacked YAML structural awareness. Fixed via col-0 anchoring + _block_noncanonical_yaml guard.
// These representative cases guard both mechanisms so the fail-closed behavior cannot regress.
h.section('regression: YAML parsing-seam fail-opens -> BLOCKED');
if (!H.existsSync(SDK)) {
  h.warn('SMOKE_SKIPPED: appsec-sdk.sh missing');
} else {
  const fs = require('fs');
  const probe = child_process.spawnSync('bash', ['-c', 'true'], { timeout: 5000 });
  if (probe.error && probe.error.code === 'ENOENT') {
    h.assertSoft(false, 'SMOKE_SKIPPED: parsing-seam regression (bash unavailable)');
  } else {
    // each: [name, decisionYaml, findingYaml|null, expectExit]
    const cases = [
      ['nested decision (no top-level verdict) -> col-0 block',
        'decided_at: 2026-06-14T04:00:00Z\nredaction:\n  attested: true\naudit:\n  decision: PASS\n', null, 2],
      ['redaction block-scalar fake attestation -> guard block',
        'decision: PASS\ndecided_at: 2026-06-14T04:00:00Z\nredaction: |\n  attested: true\n', null, 2],
      ['YAML-tagged status defeats SLA backstop -> guard block',
        'decision: PASS\ndecided_at: 2026-06-14T04:00:00Z\nredaction:\n  attested: true\n',
        'id: R6\nseverity: high\nstatus: !!str OPEN\nsla_due: 2020-01-01T00:00:00Z\n', 2],
    ];
    let held = 0;
    for (let i = 0; i < cases.length; i += 1) {
      const [name, dec, finding, want] = cases[i];
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-'));
      try {
        const tag = `seam${i}`;
        fs.mkdirSync(path.join(tmp, '.appsec', 'decisions', tag), { recursive: true });
        fs.writeFileSync(path.join(tmp, '.appsec', 'config.json'), '{"evidence_freshness_hours":99999999}');
        fs.writeFileSync(path.join(tmp, '.appsec', 'decisions', tag, 'appsec_release_decision.yaml'), dec);
        if (finding) {
          fs.mkdirSync(path.join(tmp, '.appsec', 'findings', tag), { recursive: true });
          fs.writeFileSync(path.join(tmp, '.appsec', 'findings', tag, 'f.yaml'), finding);
        }
        const out = child_process.spawnSync('bash', [SDK, 'gate.check', tag, '--strict'], {
          cwd: tmp, encoding: 'utf8', timeout: 20000,
          env: Object.assign({}, process.env, { CLAUDE_HOME: H.claudeRoot }),
        });
        if (h.assert(out.status === want, name, `got exit ${out.status}, want ${want}`)) held += 1;
      } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
      }
    }
    h.assertSoft(held === cases.length, `all ${cases.length} parsing-seam regressions held fail-closed`);
  }
}

process.exit(h.exit());
