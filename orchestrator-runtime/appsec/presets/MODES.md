# AppSec dynamic modes — `presets/MODES.md`

> **Patch A.3 (Path B v2, 2026-05-28)** — replaces "preset has fixed agent count"
> with "preset is a **template with degrees of freedom**". The Skill picks the
> mode based on task signals, then picks an agent count within the preset's
> range, then picks a model tier per node.
>
> A preset is a **template with ranges**, NOT a frozen script.

---

## Mode 1 — `quick-check`

```
When:                 dev iteration / PR-on-feature-branch / lightweight check
Shape:
  Scope (single)
  → FocusedFind (fanout × 1-2)
  → Gate (deterministic)
  → Synthesize (single)
Agent count:          1-2 finders
Verify votes:         0 (skip Verify phase entirely)
Target budget:        50k – 120k tokens
Hard budget cap:      150k tokens
Model mix:            cheap_fast for all
Overlays:             skipped unless explicitly requested
Preset base:          `l1-default.json` (trimmed at runtime)
```

---

## Mode 2 — `focused-review`

```
When:                 PR-on-main / feature complete / single-area review
Shape:
  Scope → Plan → Find (fanout × 2-4) → Normalize → Gate → Synthesize
Agent count:          2-4 finders
Verify votes:         skipped (1-vote default-reject would be dishonest at this scale)
Target budget:        100k – 250k tokens
Hard budget cap:      300k tokens
Model mix:
  - Scope / Plan:     balanced
  - Find / Normalize: cheap_fast
  - Synthesize:       balanced
Overlays:             enabled per `.appsec/state.json.overlays`
Preset base:          `l2-default.json`
```

---

## Mode 3 — `release-gate`

```
When:                 pre-release / version cut / staging→prod promotion
Shape (full):
  Scope → Plan → Find (fanout × 4-8) → Normalize → Dedup
  → Verify (pipeline; vote_count_by_severity: low=1 medium=1 high=3 critical=3)
  → Map → Gate → Synthesize → PersistEvidence
Agent count:          4-8 finders (per overlay) + 1-3 votes per high/critical cluster
Target budget:        300k – 800k tokens
Hard budget cap:      1M tokens
Model mix:
  - Scope / Plan:     strongest_available  (decision quality matters)
  - Find:             cheap_fast            (high-volume simulation)
  - Verify low/med:   cheap_fast            (single vote, default-reject)
  - Verify high/crit: balanced              (3 votes)
  - Synthesize:       balanced
  - Persist:          cheap_fast
Overlays:             enabled per `.appsec/state.json.overlays`
Preset base:          `l2-default.json` or `l3-payment.json` (if payment overlay)
```

---

## Mode 4 — `incident-response`

```
When:                 lifecycle_stage == "incident" (manual escalation)
Shape:
  Scope → Plan
  → (Skill seeds previous_results.Find/Normalize with KNOWN incident findings —
     no fresh Find phase, we already know what's wrong)
  → Map → Gate
  → Synthesize → PersistIncidentResponse → PersistRecovery → PersistEvidence
Agent count:          0 finders (no rediscovery), 1-3 votes for confirmation if needed
Target budget:        80k – 200k tokens
Hard budget cap:      300k tokens
Model mix:
  - Scope / Plan / Synthesize:  strongest_available  (intentional — classification quality
                                                       matters during incidents)
  - Other nodes:                balanced
Overlays:             often `incident-response` + `recovery`
Preset base:          `incident-response.json` (already exists)
Notes:                Scope uses opus to ensure classification quality during
                      incidents. This is an intentional override of the cheap_fast
                      default for Scope.
```

---

## Mode 5 — `deep-sweep`

```
When:                 explicit user request / quarterly audit / new-acquired-codebase
Shape:                release-gate, but with 8+ finders, all 6 CSF functions strictly
                      enforced, verify all severities at 3+ votes
Agent count:          8+ finders, 3-5 votes per cluster
Target budget:        1M – 3M tokens
Hard budget cap:      EXPLICIT user budget approval required — no default
Model mix:
  - Find:             balanced (quality vs cheap_fast simulation)
  - Verify high/crit: strongest_available  (3-5 votes)
Overlays:             ALL applicable enabled
Preset base:          `l3-payment.json` if payment surface, else `l2-default.json`
Notes:                NEVER auto-selected. Always opt-in. Preview MUST flag the
                      large budget hard-cap absence as a "REQUIRES BUDGET APPROVAL"
                      banner.
```

---

## Mode selection algorithm (SKILL.md §16.1.5)

```
Skill main thread, after §16.1 Classifier returns:

if user invokes /authorized-pentest-validation     → OUT OF SCOPE (manual path, §16.8)
if .appsec/state.json.lifecycle_stage == "incident" → mode = "incident-response"
if user explicitly asks                            → mode = user's choice
   ("audit everything" / "deep sweep" / "quarterly" /
    "full audit" / "comprehensive review")
if changed_lines < 100
   AND no auth/payment/user-data touched           → mode = "quick-check"
if release_tag matches /^v\d+\.\d+\.\d+/
   AND not pre-release suffix                      → mode = "release-gate"
otherwise                                          → mode = "focused-review"   ← default
```

**Tie-break**: when two signals point different directions, prefer the SAFER
mode (release-gate > focused-review > quick-check). False positive on the
heavier mode wastes tokens but catches more; false negative on the lighter
mode lets bugs slip.

---

## How presets compose with modes

A preset file (e.g. `l2-default.json`) defines:
- the **shape** (phase list, node types)
- the **upper-bound width** for fanout phases (e.g. `width: 8`)
- the **upper-bound stages** for pipelines (e.g. `stages: 3`)
- the **upper-bound vote_count_by_severity** (e.g. `critical: 3, high: 3`)
- the **upper-bound overlays** (e.g. all 7 overlays available)

The Skill, at runtime, **trims down** based on mode:
- `quick-check` mode + `l1-default.json` preset → finders 1-2 (Skill picks 2), Verify skipped, overlays empty
- `release-gate` mode + `l2-default.json` preset → finders 4-8 (Skill picks 6), Verify enabled with vote counts per severity, overlays enabled per state.json

This is what "**preset is a template with ranges, not a frozen script**" means.

---

## Skill responsibilities

Per ORCHESTRATION-MIGRATION-PLAN.md §1.1, the Skill MUST:

1. Classify the task (mode + shape signals)
2. Pick a preset family (e.g. `l2-default` vs `l3-payment`)
3. **Customize the spec at runtime**:
   - choose agent count within the preset's range
   - pick model tier per node based on task complexity
   - prune nodes that don't apply (e.g. overlays not in state.json)
4. Inline prompts / schemas
5. Compute `spec_hash`
6. Run `validate-spec.js`
7. Run `preflight-check.sh` (§1.10 capability gate)
8. Render user-facing preview (per `shared/preview-template.md`)
9. Wait for approval
10. Write sentinel
11. Launch Workflow

Steps 2 + 3 are where mode selection translates into a customized spec. The
mode is the lens; the preset is the template; the Skill's customization is
where dynamic scaling happens.
