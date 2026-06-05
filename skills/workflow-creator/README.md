# claude-code-workflow-creator

A Claude Code **skill** that teaches Claude to author **workflows**: deterministic
multi-agent orchestration scripts that fan work out to fresh-context subagents
under plain JavaScript control flow.

A workflow is a JavaScript file. The loops, the conditionals, the fan-out are
ordinary code that you control. Only the leaf `agent()` calls spend model tokens,
and each one runs in its own clean context window. The result is multi-agent work
that behaves the same way every run and can be resumed if it stops partway.

This skill carries the file format, the judgement calls, and a tested authoring
procedure, so you can just ask Claude to "create a workflow for X" and get a
correct, runnable file back.

## Heads up: the Workflow tool is not released yet

This skill writes files for Claude Code's **Workflow tool**. As of right now that
tool is **unreleased and unannounced**.

It ships inside the Claude Code binary, but it stays hidden behind an environment
variable, and Anthropic has not officially documented or announced it. That can
change at any time, including how it is enabled and how it behaves.

**What this means for you:**

- You can install this skill today and read through it to understand workflows.
- The workflows it writes will only actually *run* once the Workflow tool is
  switched on in a released version of Claude Code.
- The right move is to wait for Anthropic to officially announce and release the
  feature, then come back and use this skill once it is live.

Treat this repo as a preview until then. When the feature ships, everything here
is ready to go.

## What is in this repo

The repo root is the skill itself. Drop it into your Claude Code skills folder
and Claude picks it up automatically.

| Path | What it is |
|------|------------|
| `SKILL.md` | The skill entry point: the procedure Claude follows to design and write a workflow. |
| `references/api-reference.md` | The complete manual: every global, every option, every cap and constant. |
| `references/patterns.md` | Copy-paste orchestration patterns (fan-out, pipeline, loop-until-budget, judge panel, and more). |
| `assets/templates/` | Starter files for the three core shapes: fan-out, pipeline, loop. |
| `assets/examples/` | Six complete, runnable example workflows, with a README mapping each one to a technique. |
| `scripts/validate-workflow.mjs` | A linter that checks a workflow file against the parser's hard rules before you run it. |

## Install

Copy the skill into your global Claude Code skills folder:

```bash
git clone https://github.com/ray-amjad/claude-code-workflow-creator.git
mkdir -p ~/.claude/skills
cp -R claude-code-workflow-creator ~/.claude/skills/workflow-creator
```

That is all. The next time Claude Code starts, the skill is available. Ask Claude
to "create a workflow" and it will trigger.

## Using it (once the Workflow tool is released)

1. Enable the Workflow tool. Today it is gated behind an environment variable:

   ```bash
   export CLAUDE_CODE_WORKFLOWS=1
   claude
   ```

   When the feature is officially released, follow Anthropic's instructions for
   turning it on, since the exact mechanism may change.

2. Ask Claude to build one, for example: "create a workflow that reviews my
   branch across bugs, security, and tests, then verifies each finding."

3. Claude uses this skill to write the file, validate it, and run it. Watch live
   progress with the `/workflows` command.

## A note on accuracy

The details in this skill (the file format, the determinism rules, the caps, how
to set a model, how structured output works) were checked directly against the
Claude Code binary, not guessed. Because the feature is pre-release, some of it
may shift before launch. If something stops matching once the feature is
officially out, open an issue.

## Credits

Built and maintained by [Ray Amjad](https://www.youtube.com/@RAmjad). If this is
useful, the channel covers more agentic coding workflows like this one.
