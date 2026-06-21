---
type: prd
source: idea-to-requirements-orchestrator
handoff_status: READY
---
# <Product or feature name>

## Goals
- <What the product does + why; one sentence capturing user/business value>
- <Measurable success metric, if stated in intake>

## Non-Goals / Out of Scope
- <Explicit exclusion — what this product does NOT do>
- (deferred) <Item deferred for a later phase>

## Requirements
### <CATEGORY_SLUG>
<CAT>-01: <EARS prose — event-driven / ubiquitous / state-driven / optional / unwanted. WHAT not HOW.>
<CAT>-02: <EARS prose>

## Acceptance Criteria
- AC-<CAT>-01-01: Passes when <observable outcome, minimal context, WHAT only>.
- AC-<CAT>-02-01: Passes when <observable outcome>.

## Constraints
- NFR-<ISOCAT>-01 [<iso25010_category>]: <One-sentence NFR statement; include threshold if brief>.
- <Plain language constraint not covered by an NFR>

## Locked Decisions
- <One-sentence statement of a locked decision — sourced from client sign-off or 00-raw/>

## Open Questions
- (none)

## How to feed GSD
- /gsd:ingest-docs            (full bootstrap; classified as PRD)
- /gsd:plan-phase --prd PRD.md (lightweight single-doc)
