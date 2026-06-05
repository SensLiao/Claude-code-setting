/**
 * dead-code-sweep — find and remove unused code, round by round.
 *
 * A loop-until-dry sweep. Each round, one finder agent scans for unused
 * exports, functions, variables and imports. Every dead symbol is removed in
 * parallel, and each removal agent runs the tests and reverts itself if
 * anything breaks. The loop stops once two rounds in a row come back clean,
 * because removing code can reveal more dead code underneath it.
 *
 * Workflow({ name: 'dead-code-sweep' })
 */

export const meta = {
  name: 'dead-code-sweep',
  description: 'Find and remove unused code, round by round, until a clean sweep turns up nothing',
  phases: [
    { title: 'Find' },
    { title: 'Remove', detail: 'one agent per dead symbol' },
  ],
}

const DEAD = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'symbol'],
        properties: {
          file: { type: 'string' },
          symbol: { type: 'string' },
          kind: { type: 'string', enum: ['export', 'function', 'variable', 'import'] },
        },
      },
    },
  },
}

const DRY_STREAK = 2 // stop after this many empty rounds in a row
const MAX_ROUNDS = 8 // hard cap so the loop always terminates

const removed = []
let emptyRounds = 0
let round = 0

while (emptyRounds < DRY_STREAK && round < MAX_ROUNDS) {
  round++

  phase('Find')
  const { items } = await agent(
    `Round ${round}. Scan the codebase for unused exports, functions, variables and imports ` +
    `that are not referenced anywhere. Ignore anything already removed: ` +
    `${removed.map(r => r.symbol).join(', ') || 'nothing yet'}.`,
    { label: `find:round-${round}`, phase: 'Find', schema: DEAD },
  )

  if (items.length === 0) {
    emptyRounds++
    log(`Round ${round}: clean (${emptyRounds}/${DRY_STREAK} empty rounds)`)
    continue
  }

  emptyRounds = 0
  log(`Round ${round}: ${items.length} dead symbol(s) found`)

  // Remove each one in parallel — every agent runs the tests and reverts
  // its own change if anything fails, so a bad removal cannot land.
  phase('Remove')
  const outcomes = await parallel(items.map(it => () =>
    agent(
      `Remove the unused ${it.kind ?? 'symbol'} "${it.symbol}" from ${it.file}. ` +
      `Then run the test suite. If anything fails, revert the removal and say it was kept.`,
      { label: `remove:${it.symbol}`, phase: 'Remove' },
    ).then(result => ({ ...it, result })),
  ))

  removed.push(...outcomes.filter(Boolean))
}

return { rounds: round, removedCount: removed.length, removed }
