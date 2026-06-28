# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Minimalism — write only what the task needs (vendored: ponytail)

Smallest solution that actually works. Lazy about the *solution*, never about *understanding the problem*:
read the code the change touches and trace the real flow first, then climb. The smallest change in the wrong
place is not minimal — it is a second bug.

Before writing code, stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need → skip it, say so in one line. (YAGNI)
2. **Already in this codebase?** A helper / util / type / pattern that already lives here → reuse it, don't rewrite.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** Use it (DB constraint over app code, CSS over JS, `<input type="date">` over a picker lib).
5. **Already-installed dependency solves it?** Use it. Never add a new dependency for what a few lines do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

- **Bug fix = root cause, not symptom.** Grep every caller of the function you touch and fix the shared function once — a smaller diff than one guard per caller, and patching only the path the ticket names leaves a sibling caller broken.
- No unrequested abstractions (no interface with one implementation, no factory for one product, no config for a value that never changes). Deletion over addition. Boring over clever. Fewest files. Shortest working diff — once you understand the problem.
- Mark a deliberate shortcut with a comment naming its ceiling + upgrade path: `// minimal: global lock, per-account locks if throughput matters`.

**Never minimize away (the safety floor):** input validation at trust boundaries, error handling that prevents data loss, security controls, accessibility basics, or anything the user explicitly asked for. Minimalism shrinks the *code*, never the *floor* (see §Input Validation / §Error Handling above + [security.md](security.md)).

> Requirements-side counterpart: the **Requirements Minimalism Ladder (RML)** in the i2r orchestrator — same discipline applied to WHAT (requirements) instead of code. Both vendored from ponytail (MIT); we run the discipline, we do **not** install the plugin (vendor-not-install).

## Code Quality Checklist

Before marking work complete:
- [ ] Minimal — no speculative code, no unneeded dependency or abstraction (climbed the ladder); safety floor intact
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
