/* @governance
 *   reviewed_by:             廖神 (harness author)
 *   reviewed_at:             2026-06-14
 *   allowed_scope:           exploration
 *   release_gate_allowed:    false   # smoke probe only — never a release gate
 *   destructive_ops_allowed: false
 */
export const meta = {
  name: 'hello-test',
  description: 'Smoke test: confirm the Workflow tool runtime works at all',
  whenToUse: 'One-off probe — call Workflow({ name: "hello-test" }) and inspect the return.',
}

const greeting = await agent(
  'Reply with exactly the single word: OK',
  { label: 'probe' }
)

return { probeReturned: greeting }
