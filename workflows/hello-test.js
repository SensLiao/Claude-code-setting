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
