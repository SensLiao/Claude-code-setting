// loop.template.js — keep spawning agents until a goal is met.
// Topology: unknown count · accumulate until a target, or until the budget is low.
// Replace the TODOs, rename the file to <your-name>.js, drop it in .claude/workflows/.

/* @governance
 *   reviewed_by:             TODO (human reviewer) — fill before saving to a workflows/ dir
 *   reviewed_at:             TODO (YYYY-MM-DD)
 *   allowed_scope:           exploration            # exploration | migration | research
 *   release_gate_allowed:    false   # leave false; true REQUIRES human review (CLAUDE.md §3.7 #6)
 *   destructive_ops_allowed: false
 */
export const meta = {
  name: 'TODO-loop',
  description: 'TODO: one line — what this produces',
  phases: [{ title: 'Collect' }],
}

const RESULT_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: { type: 'array', items: { type: 'string' } },
  },
}

phase('Collect')
const collected = []

// CHOOSE ONE STOP CONDITION — never leave a loop unbounded.
//
// (a) Fixed target:
//        while (collected.length < 10) { ... }
//
// (b) Budget-scaled — depth follows the user's "+500k"-style token target.
//     The `budget.total &&` guard is REQUIRED: with no target set,
//     budget.remaining() is Infinity and the loop runs to the 1000-agent cap.
//
while (budget.total && budget.remaining() > 50_000 && collected.length < 200) {
  const r = await agent(
    'TODO: instruction. Do not repeat anything already found below.\n\n'
    + JSON.stringify(collected),
    { schema: RESULT_SCHEMA })

  collected.push(...(r?.items ?? []))
  log(`${collected.length} collected · ${Math.round(budget.remaining() / 1000)}k tokens left`)
}

return { collected }
