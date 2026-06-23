# EARS Rules — Easy Approach to Requirements Syntax

Source: Alistair Mavin, "EASY APPROACH TO REQUIREMENTS SYNTAX (EARS)" (RE 2009).

---

## The canonical sentence template

```
While <pre-condition>, when <trigger>, the <system name> shall <system response>.
```

Not every clause is used in every pattern — the table below shows which clauses each pattern uses. The `rendered` field in 04-functional.json must be the fully constructed English sentence using this template (with unused clauses omitted).

---

## The 6 EARS patterns

### 1. `ubiquitous`
**Used for:** requirements that hold at all times, with no trigger and no pre-condition.
**Template:** `The <system name> shall <system response>.`
**Fields:** `trigger` = omit or `null`; `preconditions` = `[]`.
**When to choose:** The behaviour is always active (e.g., "The system shall log every state change.").
**Watch-out:** Most requirements are NOT ubiquitous. If there is any condition or trigger, use a more specific pattern.

---

### 2. `event_driven`
**Used for:** requirements triggered by a discrete event.
**Template:** `When <trigger>, the <system name> shall <system response>.`
**Fields:** `trigger` = the event; `preconditions` = `[]` (or list preconditions separately if they exist, and then use `complex`).
**When to choose:** A user action, external signal, or message arrives and the system must respond.
**Example trigger phrases:** "a user submits…", "a message is received…", "the payment gateway returns a failure…"

---

### 3. `state_driven`
**Used for:** requirements that hold while the system is in a particular state.
**Template:** `While <pre-condition>, the <system name> shall <system response>.`
**Fields:** `preconditions` = `["<state description>"]`; `trigger` = omit.
**When to choose:** The system must maintain a behaviour as long as a condition persists (e.g., "While the session is expired, the system shall deny access to all protected resources.").

---

### 4. `optional`
**Used for:** requirements that only apply when a configurable feature or user preference is enabled.
**Template:** `Where <feature is included>, the <system name> shall <system response>.`
**Fields:** Use `preconditions` to describe the optional condition; `trigger` may also be present (in which case use `complex`).
**When to choose:** The product has an optional feature flag, subscription tier, or user-configured capability.
**Watch-out:** `optional` means "optional in the product", NOT "nice to have". MoSCoW priority handles the latter.

---

### 5. `unwanted`
**Used for:** error conditions, edge cases, and failure responses.
**Template:** `If <unwanted condition>, then the <system name> shall <system response>.`
**Fields:** `trigger` = the unwanted condition; `preconditions` = `[]`.
**When to choose:** Something goes wrong — invalid input, empty result, timeout, rate-limit, downstream failure.
**Iron rule:** Every `event_driven`, `state_driven`, or `optional` requirement MUST have at least one `unwanted` sibling that covers the primary failure mode.

---

### 6. `complex`
**Used for:** requirements that combine a pre-condition (state) AND a trigger (event).
**Template:** `While <pre-condition>, when <trigger>, the <system name> shall <system response>.`
**Fields:** `preconditions` = list of active states; `trigger` = the event.
**When to choose:** Only when both a persistent state and a discrete event must both be true for the behaviour to apply. Do not default to `complex` — use the simpler pattern when possible.

---

## Field-filling guidance

| `rendered` field | Build it mechanically from the pattern template. Do not paraphrase. |
|---|---|
| `system_name` | The name of the component or product from the user's own vocabulary (e.g., "the lookup tool", "the notification service"). Never a class name or endpoint path. |
| `system_response` | Observable, testable behaviour from the outside. Starts with a verb. Must NOT name a database, table, framework, algorithm, or file. |
| `trigger` | The specific event or condition that fires the requirement. Required for `event_driven`, `unwanted`, `complex`. |
| `preconditions` | Array of strings. Required for `state_driven`, `optional`, `complex`. |

---

## Pattern selection quick-guide

```
Is there a persistent state AND a discrete event?  → complex
Is there a persistent state only?                  → state_driven
Is there a discrete event only?                    → event_driven
Is it an error / edge / failure condition?         → unwanted
Is it an optional / configurable feature?          → optional
Does it hold at all times unconditionally?         → ubiquitous
```
