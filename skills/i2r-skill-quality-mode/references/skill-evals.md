# Skill Evals Pipeline — reference

> Owned by `i2r-skill-quality-mode`. Run via `i2r.py evals.run [--skill <name>] [--stage <stage>]`.

## Pipeline stages

### Stage 1: bad-prompts

**Purpose:** Confirm that naive agent (skill NOT loaded) fails in the expected way.

**Inputs:** `evals/pressure-scenarios/<slug>.md` — the raw idea prompt.

**Check:** The naive agent output contains at least one defect from the scenario's `Expected failure` list. If the naive agent passes without the skill, the scenario is not a useful pressure test — mark it `low-value` and revise.

**PASS condition:** ≥ 1 expected defect class present in naive output.

---

### Stage 2: good-prompts

**Purpose:** Confirm that skill-armed agent eliminates the defect(s) caught in Stage 1.

**Inputs:** Same scenario prompt + skill preloaded.

**Check:** None of the expected-failure defect classes appear in the output; output schema-validates.

**PASS condition:** 0 expected defect classes in armed output AND schema valid.

---

### Stage 3: trigger-tests

**Purpose:** Verify the skill fires on the right invocation prompts.

**Inputs:** `evals/trigger-tests/<skill-name>.yaml` — 10 should-trigger + 10 should-not-trigger prompts.

**Check:** Auto-invocation signal (skill name appears in `_meta.skills_used`) ≥ 9/10 for should-trigger; < 2/10 for should-not-trigger.

**PASS condition:** ≥ 9 of 10 should-trigger fire; ≤ 1 of 10 near-miss fires. See `trigger-accuracy.md`.

---

### Stage 4: schema-tests

**Purpose:** Every artifact produced by the skill-armed agent validates against the CONTRACT §3 schema for that stage.

**Inputs:** Output artifact JSON from Stage 2.

**Check:** `i2r.py validate --stage N` exits 0. `_meta` block complete per CONTRACT §4. Required enums match CONTRACT §6. `fit_criterion` present on all `required` NFRs.

**PASS condition:** `validate` exit 0 on all touched stage files.

---

### Stage 5: downstream-GSD-readiness-tests

**Purpose:** The assembled `requirements.json` and `PRD.md` must pass the Reader Test Gate (CONTRACT §11) and `gate.check` (CONTRACT §8).

**Inputs:** Full run from intake through assembly using the skill.

**Checks:**
- `i2r.py gate.check` returns `READY` or `NEEDS_REVIEW` (not `BLOCKED`).
- Reader-test critic (fresh context, PRD.md only) can independently infer goals, scope boundary, constraints, acceptance.
- `prd_grade` ≤ 0.20 (CONTRACT §10).
- `placeholder_scan` clean (CONTRACT §9).

**PASS condition:** gate verdict ∈ {READY, NEEDS_REVIEW} AND reader-test PASS.

---

### Stage 6: description-trigger-accuracy-tests

**Purpose:** The skill's `description` and `when_to_use` frontmatter correctly attracts (and repels) auto-invocation in the harness. Runs last so a green pipeline doesn't ship with a skill that never fires.

**Inputs:** `evals/trigger-tests/<skill-name>.yaml`.

**Check:** Same 9/10 threshold as Stage 3 but evaluated against the *final committed* frontmatter — not a draft.

**PASS condition:** Identical to Stage 3 PASS, applied to committed frontmatter text.

---

## Adding a new pressure scenario

1. Create `evals/pressure-scenarios/<slug>.md` with fields:
   - `input`: verbatim raw idea handed to agent
   - `expected_failure_naive`: what a bare agent does wrong (list defect classes from CONTRACT §7)
   - `pass_condition`: what the armed agent must produce
   - `defect_classes_caught`: subset of CONTRACT §7 enum
   - `skill_under_test`: the i2r-* skill name

2. Run `i2r.py evals.run --stage 1 --scenario <slug>` to confirm Stage 1 shows naive failure. If it doesn't, revise the scenario.

3. Run the full pipeline through all six stages.

4. Commit both scenario file and the updated/new skill together so they're auditable as a pair.
