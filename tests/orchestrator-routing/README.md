# Orchestrator routing test (manual Tier-2)

**Question this answers:** without naming a skill, does Claude auto-route a plain task to the RIGHT
orchestrator? Auto-invocation is a live main-loop property, so this is a **manual** test — you run
real prompts in fresh sessions and observe. (Automated subagents only approximate the main loop.)

## Setup (once)
- Target repo: a throwaway, **not-bootstrapped** project. Default here:
  `D:/Project/Project_from_Other/routing-test` (a sibling of the config repo).
- Do **not** run `claude-env-bootstrap` in the target — it would install project-local skills and
  change the routing surface, invalidating the test.

## Run (per fixture)
1. Open a **FRESH** Claude Code session in the target repo. One fresh session per fixture
   (one transcript = one fixture, so attribution is clean).
2. Paste ONE prompt from `fixtures.md` **verbatim**. Never name a skill.
3. **Method ① (live):** watch the TUI — the first `Skill(...)` / `Agent(...)` line is the route.
4. **Method ② (audit):** after the session settles, score from the transcript:
   ```
   node tests/orchestrator-routing/first-skill.js "D:/Project/Project_from_Other/routing-test"
   ```
   It prints, per session: first user prompt → first route → full Skill/Agent order.

## Score against fixtures.md
correct-route / wrong-route / missed / over-trigger. Fix misses by tuning the orchestrator's
`description` trigger phrases (+ SKILLS-INDEX disambiguation / `manifests/skill-routing-policy.json`),
then re-run.

## Honesty notes
- A correct route may appear as an `Agent:` (gsd-*/appsec-* subagent) with no explicit `Skill:` — both count.
- A live, in-progress session may not be flushed to disk yet — read the transcript after it settles.
- Don't trust "global latest transcript" — the probe scopes to the target project's transcript dir.
