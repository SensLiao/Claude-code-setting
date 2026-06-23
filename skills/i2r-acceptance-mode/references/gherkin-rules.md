# Gherkin Rules for i2r-acceptance-mode

Source: Gherkin/Cucumber specification; vendored pattern — not a runtime import.

---

## Structure

Every scenario has exactly three clause types, each an **array of strings**:

```json
{
  "given": ["<precondition>", "<additional precondition>"],
  "when":  ["<trigger action>"],
  "then":  ["<observable outcome>", "<additional outcome if same behaviour>"]
}
```

- `given` — the world state before the action. Use past or present tense. Describes WHO and WHAT exists.
- `when` — the single triggering event or action. Usually one item. If you need two items they must be
  part of the same atomic trigger, not a sequence of steps.
- `then` — the observable outcome(s). What the system shows, returns, or records. WHAT not HOW.

## One scenario = one behaviour

**Wrong** (two behaviours hidden behind "and"):
```
"then": ["the system sends an email and logs the event"]
```

**Right** — split into two scenarios:
```
Scenario A  "then": ["the system sends a confirmation email"]
Scenario B  "then": ["the lookup event is logged"]
```

Heuristic: if you can describe the failure of part A without failing part B, they are separate
behaviours. Separate behaviours → separate scenarios → separate AC IDs.

## Given/When/Then discipline

| Clause | Allowed | Not allowed |
|--------|---------|-------------|
| `given` | State, data, user role, precondition | Implementation details (DB tables, API calls) |
| `when` | User action, system event, time trigger | Multi-step flows in one `when` |
| `then` | Observable output, visible state change, system response | Internal mechanism ("the DB updates…") |

## Arrays vs prose

All three fields are arrays. A single step is still an array of one string:
```json
"when": ["the agent submits that customer's email"]
```
Never collapse to a plain string — the schema validates `type: array`.

## Scenario title (`scenario` field)

A short noun-phrase title, not a full sentence. Identifies what behaviour is being tested.
- Good: `"Lookup returns recent orders"`
- Bad: `"Test that when user enters email the system shows orders from last 90 days"`

## Conjunctions are a smell

Phrases like `and`, `or`, `but also` inside a single clause item are a split signal:
- `and` in `then` → almost always two scenarios
- `or` in `given` → write one scenario per branch
- `but also` in `when` → decompose the trigger

## Verifiability (ISO 29148 backcheck)

Before writing the prose, confirm:
1. Can an independent person reproduce the precondition? (given checkable)
2. Is the trigger clearly defined? (when unambiguous)
3. Is the expected outcome observable without access to internals? (then verifiable)

If any answer is "no" → the FR may need tightening before acceptance can be written.
Flag to i2r-completeness-critic as UNTESTABLE.
