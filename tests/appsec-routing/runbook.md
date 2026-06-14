# AppSec Routing Test — Runbook

How to actually run the test harness.

---

## Mode 1: Human reviewer (manual)

For each test in `expected-routes.json`:

1. Open a **fresh** Claude Code session (clean context)
2. Paste the `prompt_pattern` verbatim
3. Observe behavior:
   - Which skill / orchestrator activates first?
   - Does it refuse / delegate / proceed?
   - What output schema does it produce?
   - Does it respect the boundary rules?
4. Record in `results/<YYYY-MM-DD>-manual.md`:
   ```
   ## ROUTE-XXX
   - Expected: <from expected-routes.json>
   - Observed: <what actually happened>
   - Status: PASS / FAIL / PARTIAL
   - Notes: <details>
   ```
5. Aggregate: ratio passed + which failed + severity

---

## Mode 2: Subagent automated (Phase 9 of restructure)

Spawn one subagent per test fixture in parallel. Each subagent:
1. Reads the assigned fixture's `prompt_pattern`
2. Simulates what behavior the prompt would trigger by:
   - Inspecting which skill's frontmatter matches the trigger phrases
   - Verifying alias resolution
   - Checking sub_orchestrators routing in `manifests/skill-routing-policy.json`
   - Reading the resulting skill's SKILL.md to verify expected behavior
3. Compares against `expected_behavior` / `expected_primary_orchestrator` / `expected_downstream_consideration`
4. Reports PASS/FAIL with evidence (file paths + line numbers)

### Subagent template prompt

```
You are a routing verification subagent. Your job: verify ONE routing test
from C:\Users\廖神\.claude\tests\appsec-routing\expected-routes.json.

Your assignment: test ID = "ROUTE-XXX"

Steps:
1. Read C:\Users\廖神\.claude\tests\appsec-routing\expected-routes.json
2. Find the test case with id == "ROUTE-XXX"
3. For the prompt_pattern, determine which skill SHOULD activate by:
   a. Searching skill frontmatter for matching trigger_phrases
   b. Searching manifests/skill-routing-policy.json for matching intent_keywords
   c. Reading the matched skill's full SKILL.md
4. Compare actual matched skill vs expected_primary_orchestrator
5. Verify expected_behavior is documented in the matched skill
6. Verify must_NOT_activate skills do not match (or are properly gated)
7. Verify expected_downstream_consideration skills exist on disk
8. Write a one-page report to C:\Users\廖神\.claude\tests\appsec-routing\results\<test-id>.md with:
   - PASS / FAIL / PARTIAL verdict
   - Evidence (file paths + line numbers)
   - Recommendations if FAIL

Be strict. The test exists because routing drift kills the architecture silently.
```

---

## Mode 3: CI integration (future)

When/if added to CI, this harness should:
1. Parse all SKILL.md frontmatter
2. Verify all aliases resolve to existing skill directories
3. Verify all upstream/downstream references point to existing skills
4. Verify standards_versions are pinned (no "latest" except where intentional)
5. Verify no ASVS 4.x identifiers in new content
6. Fail build on any deviation

This level of automation is out of scope for current wave but the JSON contract
is designed to support it.

---

## Failure Triage

When a test fails, classify:

| Class | Example | Fix |
|---|---|---|
| **Routing miss** | Skill doesn't match trigger phrase | Add to trigger_phrases or sub_orchestrators |
| **Safety regression** | Manual gate accidentally weakened | Restore gate + add anti-pattern entry |
| **Dead reference** | Downstream skill doesn't exist | Either create skill or remove reference |
| **Schema drift** | Output uses ASVS 4.x / forked schema | Realign to canonical schema |
| **Alias collision** | Two skills claim same alias | Pick winner, remove from loser |
| **Boundary violation** | GSD skill merged into AppSec / etc. | Restore namespace separation |

---

## Where to file failures

- HIGH severity (safety regression / dead reference) → fix immediately
- MEDIUM severity (routing miss / schema drift) → fix in next phase
- LOW severity (docs drift / minor inconsistency) → backlog

---

## Test inventory at-a-glance

Activation tests: ROUTE-001, 002, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013
Refusal tests:   ROUTE-003, 018
Handoff tests:   ROUTE-014, 021
Boundary tests:  ROUTE-015, 022
Schema tests:    ROUTE-016, 017, 023
Alias tests:     ROUTE-019, 020

Total: 23 fixtures covering 18 skills + cross-namespace + safety properties.
