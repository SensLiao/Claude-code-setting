# Agent Orchestration Patterns

> Reference doc for `gsd-pipeline-orchestrator`. Defines **how many agents and in what shape** to run at each step of the master pipeline.

GSD commands have their own internal agent fan-out. This doc covers orchestration the master pipeline does **on top of** GSD commands, or **instead of** when GSD isn't the right tool.

---

## Pattern Index

| # | Pattern | Trigger | Cost |
|---|---|---|---|
| 1 | Single-agent review | Default after writing code | Low |
| 2 | Parallel fan-out review | Security / cross-domain change | Med |
| 3 | Sequential agent chain | Greenfield feature (plan → tdd → impl → review) | Med |
| 4 | Research fan-out | Need to scan multiple dimensions of unknown codebase | Med |
| 5 | GAN team (planner / generator / evaluator) | High-craft feature needing iteration | High |
| 6 | Santa-loop (dual adversarial review) | Ship-critical merge | High |
| 7 | Plan-review convergence (Codex external) | Architecture or security plan | Med |
| 8 | Codex delegation | Long-chain施工 / parallel grunt work | Low (offloaded) |
| 9 | Debug session team | Multi-cycle debug across resets | Med |

---

## Pattern 1 — Single-Agent Review (Default)

**Trigger:** Default after any code change (Tier 1 step 7 in master pipeline is already this).

**Shape:**
```
Agent(subagent_type="code-reviewer", model="sonnet", prompt=<scoped to changed files>)
```

**When NOT to use:** Security-sensitive / architecture / AI features — escalate to Pattern 2 or Pattern 7.

**Notes:** `/gsd-code-review --fix --auto` already does this with auto-fix; only invoke a standalone `code-reviewer` if you've made changes OUTSIDE a GSD command flow.

---

## Pattern 2 — Parallel Fan-Out Review

**Trigger:**
- `SECURITY_SENSITIVE` is true (auth/payments/secrets/PII/RLS)
- Cross-domain change touching 2+ of {frontend, backend, DB, infra, AI}
- Pre-ship sanity sweep on a non-trivial PR

**Shape:** Send all sub-agent calls in ONE message (parallel by default):

```
Agent(subagent_type="code-reviewer",       model="sonnet")
Agent(subagent_type="security-reviewer",   model="opus")
Agent(subagent_type="typescript-reviewer", model="sonnet")  # if web
Agent(subagent_type="database-reviewer",   model="sonnet")  # if SQL changed
Agent(subagent_type="performance-optimizer", model="opus")  # if hot path
```

**Composition rule:** Pick 2-4 reviewers max. More than 4 wastes tokens without adding signal.

**After fan-out:** Synthesize findings → group by severity (CRITICAL/HIGH/MED/LOW) → present to user → fix CRITICAL+HIGH before proceeding to Tier 3.

---

## Pattern 3 — Sequential Agent Chain

**Trigger:** Greenfield feature where each step depends on the previous output.

**Canonical chain:**
```
1. planner (opus)          → produce implementation plan
2. tdd-guide (sonnet)      → write failing tests first
3. (you / executor)        → implement until tests pass
4. code-reviewer (sonnet)  → review the diff
5. security-reviewer (opus) [if sensitive] → catch security issues
```

**Inside GSD:** This is largely what `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-code-review` does. **Only invoke this raw chain outside a GSD phase context** (e.g., a hotfix that's too small for a phase but too sensitive for `/gsd-fast`).

---

## Pattern 4 — Research Fan-Out

**Trigger:**
- New repo / unfamiliar codebase → invoked by `/gsd-map-codebase` automatically
- Need to scan 3+ independent dimensions in parallel (tech, arch, quality, concerns)
- User asks "where is X / which files reference Y" with broad scope

**Shape (manual):**
```
Agent(subagent_type="Explore", description="quick targeted lookup")
Agent(subagent_type="Explore", description="medium exploration")
Agent(subagent_type="general-purpose", description="open-ended research")
```

All in one message for parallel execution.

**Shape (via GSD):** `/gsd-map-codebase` spawns 4 `gsd-codebase-mapper` agents (tech, arch, quality, concerns) in parallel and writes structured docs to `.planning/codebase/`. Prefer this for any repo-mapping work.

---

## Pattern 5 — GAN Team (Planner / Generator / Evaluator)

**Trigger:**
- High-craft feature where output quality is hard to spec upfront (interactive UI, AI-generated content, novel UX)
- Eval-driven AI features where iterative improvement against a rubric is needed
- The user explicitly wants "GAN harness" or "adversarial generation"

**Shape:**
```
1. gan-planner (opus)
   → expand one-line prompt into full spec + sprint plan + eval rubric

2. LOOP until rubric threshold met (or max-cycles reached):
   a. gan-generator (sonnet)
      → implement against spec; read evaluator feedback if cycle > 1
   b. gan-evaluator (opus)
      → run live app via Playwright; score against rubric; produce actionable feedback

3. Final output: passing implementation + score + rubric trail
```

**Invocation:** Use `/gan-design` or `/gan-build` slash commands (they wire up planner / generator / evaluator internally).

**When NOT to use:**
- Ordinary CRUD (Pattern 3 is cheaper)
- Bug fixes (Pattern 1 + 2)
- Anything where the rubric isn't clear (you'll burn cycles on noise)

**Cost note:** Each cycle = 1 generator + 1 evaluator call. Cap max-cycles at 3-5.

---

## Pattern 6 — Santa-Loop (Dual Adversarial Review)

**Trigger:**
- Ship-critical merge to a production-live repo (Borealis, New Sight)
- Security-sensitive change after Pattern 2 already passed but stakes warrant a second independent opinion
- User explicitly says "santa-loop" or "dual review"

**Shape:** Two **independent** model reviewers must BOTH approve before code ships.

```
/santa-loop
  ├─ reviewer A (e.g., opus + code-reviewer agent)
  └─ reviewer B (e.g., codex-dispatch → GPT-5.4)

Both must return APPROVE. If either returns CHANGES_REQUESTED → fix → re-review.
Converge before /gsd-ship.
```

**Inside master pipeline:** Insert between `/gsd-verify-work` and `/gsd-ship` for ship-critical phases.

**When NOT to use:** Internal-only repos / experimental features / non-prod environments — Pattern 1 or 2 is enough.

---

## Pattern 7 — Plan-Review Convergence (Codex External)

**Trigger:**
- `CRITICAL_ARCHITECTURE_OR_NEW_FRAMEWORK` is true
- `SECURITY_SENSITIVE` is true and the plan touches the threat model
- New persistence model / new integration boundary / cross-service contract

**Shape:** Codex CLI (GPT-5.4) reviews the Claude-produced PLAN.md; Claude re-plans against feedback; loop until no HIGH concerns remain.

```
/gsd-plan-review-convergence N --codex --max-cycles 3
  ├─ cycle 1: codex reviews PLAN.md → returns findings
  ├─ Claude re-plans incorporating findings
  ├─ cycle 2: codex re-reviews → ...
  └─ converge OR hit max-cycles (escalate to user)
```

**Pipeline position:** AFTER `/gsd-plan-phase`, BEFORE `/gsd-execute-phase`. Already wired into master pipeline Tier 1 step 5.

---

## Pattern 8 — Codex Delegation

**Trigger:**
- Long-chain施工 / batch refactor / boring grunt work
- High-noise investigation (lots of file reads, log scans)
- Cross-AI second opinion
- Claude's context budget is getting tight for the current task

**Shape:**
```
Skill("codex-dispatch", args="<task description with explicit IO contract>")
  → Codex CLI executes (GPT-5.4)
  → Returns structured result
  → Falls back to Claude subagent if Codex quota is out
```

**Composition with other patterns:**
- Pattern 6 santa-loop can use Codex as reviewer B
- Pattern 7 already uses Codex for plan review
- Pattern 3 sequential chain can swap step 3 (implement) to Codex for grunt portions

**When NOT to use:** Tasks needing the current Claude session's conversation context — Codex won't have it. Always pass an explicit IO contract.

---

## Pattern 9 — Debug Session Team

**Trigger:**
- Multi-cycle debug across context resets
- Production incident requiring scientific-method bug isolation
- "I've tried 3 things and the bug is still there"

**Shape:** `/gsd-debug` invokes `gsd-debug-session-manager` which:
1. Spawns `gsd-debugger` sub-agents per hypothesis
2. Persists state to `.planning/debug-sessions/<id>/` between cycles
3. Uses `AskUserQuestion` at checkpoints for human decisions
4. Returns compact summary to main context after session ends

**Pipeline position:** Out-of-band — debug is NOT part of phase pipeline. Pause current phase via `/gsd-pause-work`, run debug, resume via `/gsd-resume-work`.

---

## Cross-Pattern Composition Rules

### Don't double up on review

If you ran Pattern 2 (parallel fan-out) AND your phase has Pattern 7 (plan-review convergence) AND you're considering Pattern 6 (santa-loop) — pick the two most relevant, skip the third. Reviewer fatigue is real and tokens compound.

### Reserve Patterns 5-6 for the top decile

GAN teams and santa-loops are expensive. Default to Patterns 1-4 + 7 for 90% of phases. Reserve 5-6 for:
- New flagship features
- Production-live merges
- Anything that touches money or auth in a customer-facing product

### Stack with caution: GAN + Codex

GAN evaluator + Codex external reviewer = 3 model voices on the same code. Powerful but slow. Only use when shipping a flagship feature to production.

### Parallel patterns within a single phase

You CAN run Pattern 2 (parallel reviewer fan-out) AT THE SAME TIME as Pattern 4 (research fan-out) when they look at different things — e.g., parallel reviewers on the code while research agents scan adjacent modules for impact. Send all Agent() calls in ONE message.

---

## Model Routing Inside Patterns

Default per `~/.claude/rules/common/performance.md`:

| Role | Model | Why |
|---|---|---|
| Planner / architect | **opus** | High-stakes decisions, errors expensive |
| Security reviewer | **opus** | Same |
| GAN evaluator | **opus** | The judge needs to be smarter than the maker |
| Final reviewer in santa-loop | **opus** | Ship gate |
| code-reviewer / tdd-guide / general dev agents | **sonnet** | Day-to-day execution |
| GAN generator | **sonnet** | Maker; cheaper iteration |
| doc-updater / format conversion | **haiku** | Mechanical |

**Project-level override (user's memory):** For **large multi-step executor tasks, big planners, or large-scope reviews**, default to **opus** to avoid Sonnet's mid-task compaction degradation. See `feedback_model_routing_for_large_tasks.md`.

---

## Decision Cheatsheet

Answer these in order; first YES picks the pattern:

1. Is this a 1-3 line bugfix? → **No pattern, just do it.**
2. Is this an out-of-band debug session? → **Pattern 9** (`/gsd-debug`)
3. Is this codebase mapping / 4+ dimension scan? → **Pattern 4** (`/gsd-map-codebase`)
4. Is this a critical architecture or security plan? → **Pattern 7** (already in Tier 1)
5. Is this a high-craft / eval-driven feature? → **Pattern 5** (GAN team)
6. Is this a ship-critical merge to production? → **Pattern 6** (santa-loop) BEFORE `/gsd-ship`
7. Is this security-sensitive or cross-domain? → **Pattern 2** (parallel fan-out)
8. Is this long-chain施工 / grunt work? → **Pattern 8** (codex delegation)
9. Is this a greenfield feature with clear spec? → **Pattern 3** (sequential chain via `/gsd-*`)
10. Otherwise → **Pattern 1** (single-agent review via `/gsd-code-review`)
