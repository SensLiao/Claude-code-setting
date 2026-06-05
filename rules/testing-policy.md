---
paths:
  - "**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}"
  - "tests/**/*"
  - "__tests__/**/*"
  - "test/**/*"
  - "e2e/**/*"
  - "playwright/**/*"
  - "playwright.config.*"
  - "vitest.config.*"
  - "jest.config.*"
  - "cypress.config.*"
  - "**/setupTests.*"
---

> Path-scoped rule. Loads only when Claude reads/edits test files or test config.
> Extends [common/testing.md](../common/testing.md).

# Testing Policy

## Required minimum by risk level

| Change risk | Minimum test layer required |
| ----------- | --------------------------- |
| pure logic change | unit |
| component state change | component |
| API / data / auth change | integration **or** contract (MSW handler) |
| critical user journey | E2E |
| visual / theme / layout change | + visual regression target |
| deployment / preview change | + smoke |
| backend / API / auth change | + route to `appsec-security-orchestrator` |
| dependency upgrade | + regression for affected paths |

## Test quality rules

- **Never use `waitForTimeout` / `sleep`** — wait on observable state
  (`waitForSelector`, `toBeVisible`, etc.)
- **Locator priority**: ARIA role (`getByRole`) > accessible name >
  `data-testid` > CSS path (last resort)
- **Mock only at network/IO boundaries**: MSW for HTTP, `vi.useFakeTimers`
  for time, controlled seed for randomness; do **NOT** mock internal modules
- **Never claim "tests pass"** without actual command stdout pasted in
  remediation / verification reports
- **Never update visual regression baselines** without explicit user
  authorization
- **Never `skip` / `xfail` / `it.only` / `describe.only`** sneaks into committed
  code without an issue link + removal date

## Coverage targets

| Code category | Line coverage minimum |
| ------------- | --------------------- |
| Business logic / utilities | 80% |
| Pure UI components | 60% (visual regression supplements) |
| Security-sensitive paths | 100% |
| Server actions / API routes | 80% |
| Database query layer | 70% |

## Layer-specific anti-patterns

### Unit (Vitest)
- ❌ Test internal implementation details (private functions)
- ❌ Over-mock collaborators within the same module
- ✅ Test public contract, edge cases, boundary conditions

### Component (Vitest + Testing Library)
- ❌ Test by inspecting component internal state
- ❌ Test by snapshotting entire DOM
- ✅ Test by user-visible behavior + ARIA

### Integration / Contract (MSW)
- ❌ Mock the system under test
- ❌ Skip 4xx / 5xx / timeout scenarios
- ✅ Cover happy path + 400 / 401 / 403 / 404 / 500 / timeout / malformed

### E2E (Playwright)
- ❌ `page.waitForTimeout(...)` to "let things settle"
- ❌ Brittle CSS selectors like `div:nth-child(2) > span`
- ❌ Test against a mock backend instead of dev server
- ✅ Stable locators, deterministic waits, trace/video on failure

### Visual Regression
- ❌ Generate baseline locally (Mac) for CI (Linux) — different rendering
- ❌ Auto-update baselines on diff
- ✅ Generate baseline inside CI Docker image
- ✅ Mask dynamic content (timestamps, generated IDs)

### Accessibility
- ❌ Skip axe checks on "internal pages"
- ❌ Suppress critical axe rules
- ✅ Fail build on CRITICAL axe violations

## CI lane targets

| Lane | Runs | Target duration |
| ---- | ---- | --------------- |
| PR fast | static + unit + component + integration | <3 min |
| Merge full | + E2E (sharded) + a11y | <10 min |
| Release gate | + visual regression + Lighthouse + smoke | <20 min |

Playwright: use `--shard=N/M` matrix + `merge-reports`; install Chromium only;
generate baseline in CI Docker; collect trace/video/screenshot on failure.

## Forbidden in committed code

- `console.log` in production paths (use proper logger)
- Hardcoded test data that contains real PII / real credentials
- Commented-out tests without a TODO + removal date
- `try { /* test */ } catch { /* swallow */ }` — let assertions fail
- `expect(true).toBe(true)` placeholder tests

## When in doubt

Route to `enterprise-qa-testing` orchestrator. Do not invent ad-hoc test
strategy for non-trivial changes.
