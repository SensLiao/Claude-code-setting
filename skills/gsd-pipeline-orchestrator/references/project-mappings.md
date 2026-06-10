# Project Default Mappings

> Reference doc for `gsd-pipeline-orchestrator`. Per-project default pipeline configurations. These are starting points — always classify the actual phase against the 8 flags, but use the project's defaults to bias the classification when ambiguous.

---

## AI agents 应用 / Mission Control (this repo)

**Stack:** Next.js (dashboard), local services, port-managed multi-case repo.
**Repo layout:** `dashboard/` + `toB/<case>/` (independent Git) + `toC/<case>/` (independent Git) + `tech-db/` + `templates/` + `infra/`.

### Where to run GSD
| Goal | Run inside |
|---|---|
| Cross-case infrastructure (ports, templates, dashboard core) | Repo root `AI agents应用/` |
| Dashboard self-development | `dashboard/` |
| Single case (e.g., toB customer-service) | `toB/<case>/` |

### Default flag bias

| Phase type | Likely flags |
|---|---|
| `dashboard/` UI / panel work | FRONTEND_OR_UI_HEAVY=true (most dashboard work) |
| `dashboard/` scanning / service work | CORE_LOGIC_TDD_RECOMMENDED=true |
| `dashboard/` chat dock + AI integration | AI_INTEGRATION=true |
| New case bootstrap | CRITICAL_ARCHITECTURE_OR_NEW_FRAMEWORK=true (touches templates + ports + manifest) |
| Port allocation / infra change | SECURITY_SENSITIVE=false unless touching auth, but treat with care |

### Hard project rules (from project CLAUDE.md + memory)

1. **Verify via Docker only.** No `pnpm dev`. Use `docker compose up` on 4100-4199 ports. See `feedback_always_use_docker_for_verify.md`. Bake into Tier 3 `/gsd-verify-work` instructions.
2. **Temp review docs** (cross-review, audit) live in `dashboard/_review-temp/`, NOT in formal docs. See `feedback_temp_review_docs.md`.
3. **Large multi-step tasks use Opus, not Sonnet.** See `feedback_model_routing_for_large_tasks.md`. Apply to `/gsd-execute-phase`, `/gsd-plan-phase` (large scope), big code reviews.
4. **Case contract:** independent Git per case, independent `status.yaml` / `tech.yaml` / `monitor.yaml`, independent `runs/runs.jsonl`, no inter-case dependency.

### Default pipeline for dashboard UI phase

```
1. /gsd-spec-phase N           (if requirements unclear)
2. /gsd-discuss-phase N --analyze
3. /gsd-ui-phase N
4. UI BRIDGE (Track B or C depending on surface count)
   - Existing v2-anchor chassis already locked → Track B/C
5. /gsd-plan-phase N            (--tdd if touching scanner/services)
6. /gsd-execute-phase N         (Opus model bias for large waves)
7. /gsd-code-review N --fix --auto
8. (no Tier 3 unless AI dock features)
9. /gsd-verify-work N            (Docker only — port 4100)
10. /gsd-pr-branch main
11. /gsd-ship N
12. /gsd-extract-learnings N
```

---

## UniBoard

**Stack:** FastAPI + Next.js + Supabase + Claude API.

### Default flag bias

| Phase type | Likely flags |
|---|---|
| Backend FastAPI route | CORE_LOGIC_TDD_RECOMMENDED=true |
| Frontend Next.js page/component | FRONTEND_OR_UI_HEAVY=true |
| Claude API integration (eval, classification, summarization) | AI_INTEGRATION=true |
| Auth / billing / Supabase RLS / tokens | SECURITY_SENSITIVE=true |
| Schema migration | SECURITY_SENSITIVE=true + CRITICAL_ARCHITECTURE_OR_NEW_FRAMEWORK=true |

### Canonical AI + UI phase (UniBoard most common)

```
1. /gsd-spec-phase N
2. /gsd-discuss-phase N --analyze
3. /gsd-ui-phase N
4. UI BRIDGE (Track A or B)
5. /gsd-ai-integration-phase N
6. /gsd-plan-phase N --tdd
7. /gsd-plan-review-convergence N --codex --max-cycles 3   (if arch-sensitive)
8. /gsd-execute-phase N
9. /gsd-code-review N --fix --auto
10. /gsd-eval-review N           (AI gates)
11. /gsd-secure-phase N           (if auth/billing/RLS touched)
12. /gsd-validate-phase N         (TDD edge-case sweep)
13. /gsd-verify-work N
14. /gsd-pr-branch main
15. /gsd-ship N
16. /gsd-extract-learnings N
```

### UniBoard agent orchestration defaults

- AI evaluation phases → **Pattern 5** (GAN team) for first-version of new eval feature; **Pattern 1** for iteration
- Auth / billing changes → **Pattern 2** parallel fan-out (code + security + database reviewers) → **Pattern 6** santa-loop before ship
- Schema migration → **Pattern 7** plan-review convergence with Codex

---

## Borealis Fabrics / New Sight

**Status:** Production live. Conservative bias on everything.

### Default flag bias

| Phase type | Likely flags |
|---|---|
| Any user-facing change | SECURITY_SENSITIVE=true (raise default) |
| Backend behavior | CORE_LOGIC_TDD_RECOMMENDED=true |
| Frontend | FRONTEND_OR_UI_HEAVY=true |
| Data migration | SECURITY_SENSITIVE + CRITICAL_ARCHITECTURE_OR_NEW_FRAMEWORK both true |

### Rules

- Plan reviews are **mandatory** for any backend behavior change → always run `/gsd-plan-review-convergence`
- Ship gate: **Pattern 6 santa-loop** mandatory before `/gsd-ship`
- No `/gsd-fast` shortcuts on prod-touching code
- Prefer extra Tier 3 gates over speed

### Default pipeline (backend behavior change)

```
1. /gsd-spec-phase N
2. /gsd-discuss-phase N --analyze
3. /gsd-plan-phase N --tdd
4. /gsd-plan-review-convergence N --codex --max-cycles 3   (mandatory)
5. /gsd-execute-phase N
6. /gsd-code-review N --fix --auto
7. /gsd-secure-phase N             (mandatory)
8. /gsd-validate-phase N
9. /gsd-verify-work N
10. /santa-loop                    (Pattern 6, mandatory)
11. /gsd-pr-branch main
12. /gsd-ship N
13. /gsd-extract-learnings N
```

---

## canvas-ed-mcp

**Stack:** MCP server (Model Context Protocol).

### Default flag bias

| Phase type | Likely flags |
|---|---|
| Protocol / API behavior | CORE_LOGIC_TDD_RECOMMENDED=true |
| Tool registration / capability surface | CRITICAL_ARCHITECTURE_OR_NEW_FRAMEWORK=true (cross-service contract) |
| Auth / scopes / resource access | SECURITY_SENSITIVE=true |
| New MCP tool implementation | AI_INTEGRATION=true (tool is invoked by LLM) |

### Default pipeline

```
1. /gsd-spec-phase N            (protocol changes need explicit contract)
2. /gsd-discuss-phase N --analyze
3. (if AI tool) /gsd-ai-integration-phase N
4. /gsd-plan-phase N --tdd
5. /gsd-plan-review-convergence N --codex   (if protocol surface changes)
6. /gsd-execute-phase N
7. /gsd-code-review N --fix --auto
8. /gsd-eval-review N            (if AI tool)
9. /gsd-secure-phase N            (if scopes / auth touched)
10. /gsd-verify-work N
11. /gsd-pr-branch main
12. /gsd-ship N
13. /gsd-extract-learnings N
```

### Issue / PR backlog management

When the backlog accumulates, run `/gsd-inbox` to triage outside the phase pipeline.

---

## ClaudePulse

**Stack:** Swift HUD / macOS UI.

### Default flag bias

| Phase type | Likely flags |
|---|---|
| HUD / overlay UI | FRONTEND_OR_UI_HEAVY=true |
| HUD state machine | CORE_LOGIC_TDD_RECOMMENDED=true |
| Permissions (Accessibility, Screen Recording, etc.) | SECURITY_SENSITIVE=true |
| Local file access / process visibility | SECURITY_SENSITIVE=true |

### UI bridge notes

- Track A/B/C all apply, but the 5-skill combo's HTML mocks need to be **translated to SwiftUI** in the implementation phase. Bridge Stage 4 backfill should note: "anchor.md tokens map to SwiftUI Color/Font/Spacing constants — see ColorPalette.swift / Typography.swift".
- `anchor-prototype-wave` HTML output is the visual spec; implementation translates it.

### Default pipeline (HUD UI phase)

```
1. /gsd-spec-phase N
2. /gsd-discuss-phase N --analyze
3. /gsd-ui-phase N
4. UI BRIDGE (Track B for single HUD; Track C if multiple panels)
   - HTML anchor → SwiftUI translation note in handoff.md
5. /gsd-plan-phase N --tdd
6. /gsd-execute-phase N
7. /gsd-code-review N --fix --auto       (consider swift-reviewer if available)
8. /gsd-secure-phase N                    (if permissions/file access touched)
9. /gsd-verify-work N
10. /gsd-pr-branch main
11. /gsd-ship N
12. /gsd-extract-learnings N
```

---

## Default for Unmapped Project

When the user is in a repo that doesn't match any of the above:

1. Run `/gsd-map-codebase` first to understand stack + structure (Pattern 4 research fan-out)
2. Read `.planning/PROJECT.md` if it exists
3. Apply Tier 1 baseline + classify Tier 2/3 from actual phase content
4. Don't bias flags from project — let the phase content drive

---

## Flag Bias Override Rules

The project default is a STARTING bias, not the verdict. Always:

1. Read actual phase content (CONTEXT.md, SPEC.md, repo files in scope)
2. Update flags based on what the phase actually touches
3. If the phase contradicts the project default (e.g., a UniBoard phase that touches ONLY docs), trust the phase content
4. Print the final flag verdict + which override fired in the plan output

---

## Cross-Project Skill Reuse Notes

- `ux-principles`, `taste-skill`, `prototyping-ui-directions`, `anchor-prototype-wave` — global, apply to every front-end project
- Codex official plugin (`codex@openai-codex`) — cross-model review/delegation (`/codex:review`, `/codex:adversarial-review`, `/codex:rescue`); available everywhere; quota out → fall back to Claude subagent
- `grill-with-docs` — useful for any project's spec-phase
- `competitive-teardown` — only when product-strategy work appears
- `remotion-best-practices` — for any project producing product videos
- `meeting-analyzer` — out-of-band; not part of phase pipeline

Per-project rules from `~/.claude/CLAUDE.md` apply to all projects unless explicitly overridden in the project's own `CLAUDE.md`.
