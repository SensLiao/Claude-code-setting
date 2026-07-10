# Orchestrator routing fixtures (manual Tier-2 test)

Each row is a natural-language task. **Never name a skill in the prompt** — the whole point is to
see whether Claude auto-routes to the right orchestrator on its own. Run each prompt in a FRESH
session inside the throwaway target repo, then score the FIRST `Skill:`/`Agent:` invoked (see README).

## Clean cases — one per mainline
| # | Prompt (paste verbatim) | Expected first route | Notes |
|---|---|---|---|
| 1 | This landing page looks cheap and generic. Give it a proper premium, modern visual direction — set the overall look and feel of the whole page, not just a quick hero tweak. | `uiux-product-orchestrator` (or `ux-principles` = partial) | UI/UX — direction-level so the orchestrator is unambiguously warranted. `ux-principles` alone = partial (mainline engaged, orchestrator didn't fire). No UIUX skill / inline visual edit / wrong domain = missed. |
| 2 | We're about to release. Set up end-to-end tests for the login flow and a CI quality gate. | `enterprise-qa-testing` | QA |
| 3 | Before we deploy, review the login API and auth handling for security problems. | `appsec-security-orchestrator` | AppSec (defensive) |
| 4 | Let's plan and build the next feature: send an email when a user signs up. | `gsd-pipeline-orchestrator` | PM / delivery |
| 5 | Set this repo up with the right Claude environment. | RECOMMEND `claude-env-bootstrap` | manual — must NOT auto-fire; should suggest you run it |

> **#1 revised 2026-07-01.** The original ("make the hero section look more premium") was a
> single-section polish — a legitimate grey zone between inline work and full orchestration, so it
> could not cleanly test whether the UIUX mainline auto-fires (a real run under-routed: it did the
> visual work inline, invoking no skill). #1 is now **direction-level** (whole-page visual direction)
> to force the routing question. **Graded scoring:** `uiux-product-orchestrator` fires = correct ·
> `ux-principles` alone = partial (mainline foundation engaged, orchestrator gap = the trigger-strength
> issue to fix on the orchestrator side) · no UIUX skill at all = missed. If even this direction-level
> prompt only reaches `ux-principles` (or nothing), that is the evidence to tune the orchestrator's
> `description` triggers (the "A" fix).

## Boundary cases (test that it doesn't drop a dimension)
| # | Prompt | Expected | Miss looks like |
|---|---|---|---|
| 6 | Make the login page prettier and also make sure it's secure. | uiux **and** appsec engaged (or PM sequences both) | only one of the two fires |
| 7 | Help us rank higher on Google and get cited by ChatGPT. | `discoverability-orchestrator` (→ web-seo + web-aeo) | nothing fires / treated as generic |

## Negative cases (an orchestrator must NOT fire)
| # | Prompt | Expected | Over-trigger looks like |
|---|---|---|---|
| 8 | What does app/page.tsx render? | plain answer, no orchestrator | any orchestrator fires |
| 9 | Fix the typo "recieve" in README.md. | trivial edit, no orchestrator | any orchestrator fires |

## Scoring legend
- **correct-route** — first route == expected
- **wrong-route** — a different orchestrator fired
- **missed** — no orchestrator fired when one was expected
- **over-trigger** — an orchestrator fired on a negative fixture

Fix misses by tuning the orchestrator's `description` trigger phrases (and the SKILLS-INDEX
disambiguation table / `manifests/skill-routing-policy.json`), then re-run.
