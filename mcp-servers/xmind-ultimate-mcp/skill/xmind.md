---
name: xmind
description: Create professional mind maps with XMind via MCP. Guides structure selection, node organization, and best practices based on official XMind User Guide. Trigger on "思维导图", "mind map", "xmind", "导图", "brainstorm map", "fishbone", "org chart mindmap", "timeline map", "gantt chart mindmap".
---

# XMind Mind Mapping — Official Best Practices Guide

> Based on XMind Official User Guide (xmind.com/user-guide) + xmind-help.github.io

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `create_mind_map` | Full-feature .xmind creation (boundaries, callouts, relationships, summaries, floating topics, themes, styles, markers) |
| `create_from_text` | XMindMark/Markdown text → .xmind |
| `read_xmind` | Read .xmind file structure as text |
| `analyze_xmind` | Structure analysis + optimization suggestions |
| `convert_to_xmind` | Word/Excel/CSV/JSON/YAML/Markdown → .xmind |
| `translate_xmind` | Translate node titles via provided translation map |
| `export_xmind` | Export .xmind to Markdown or JSON |
| `list_xmind_files` | List .xmind files in a directory |

---

## 1. Topic Types (Official Guide)

XMind has 5 topic types. Understand their roles before building:

| Type | Role | MCP Usage |
|------|------|-----------|
| **Central Topic** | Core idea at the center. Every map has exactly one. | `title` field in `create_mind_map` |
| **Main Topic** | First-level branches from central topic. Primary themes/categories. | Top-level items in `topics[]` |
| **Subtopic** | Children of main topics. Detailed ideas, data, tasks. | `children[]` inside a topic |
| **Floating Topic** | Independent topics not attached to any branch. Weak/tangential relationships. | `floatingTopics[]` at top level |
| **Summary Topic** | Brackets that summarize a range of sibling topics. Can have own subtopics. | `summaries[]` on parent topic |

**Tips from Official Guide:**
- Floating topics can be placed anywhere on the canvas — use for ideas that don't fit the hierarchy
- Summary topics can have their own subtopics for deeper breakdown
- Central topic + multiple floating topics CANNOT have boundaries added

## 2. Structure Selection (Official Guide)

XMind provides **10 built-in structural styles**. Multiple structures can coexist in a single map.

| Structure | `structure` Value | Best For |
|-----------|------------------|----------|
| Mind Map (Clockwise) | `org.xmind.ui.map.clockwise` | Brainstorming, free thinking, general notes |
| Mind Map (Unbalanced) | `org.xmind.ui.map.unbalanced` | Meeting notes, flexible free-form |
| Logic Chart (Right) | `org.xmind.ui.logic.right` | Decision trees, logic flow, L→R reading |
| Logic Chart (Left) | `org.xmind.ui.logic.left` | Right-to-left flow |
| Org Chart (Down) | `org.xmind.ui.org-chart.down` | Team/org hierarchy, top-down authority |
| Org Chart (Up) | `org.xmind.ui.org-chart.up` | Bottom-up structure |
| Tree Chart (Right) | `org.xmind.ui.tree.right` | Knowledge categories, file-system style |
| Tree Chart (Left) | `org.xmind.ui.tree.left` | Right-to-left tree |
| Fishbone (Right) | `org.xmind.ui.fishbone.rightHeaded` | Root cause analysis (Ishikawa diagram) |
| Timeline (Horizontal) | `org.xmind.ui.timeline.horizontal` | Project phases, chronological events |
| Spreadsheet/Matrix | `org.xmind.ui.spreadsheet` | Feature comparison, grids |

**Scenario → Structure Quick Reference:**

| Scenario | Recommended Structure | Why |
|----------|----------------------|-----|
| Brainstorming | `map.clockwise` | Radial layout encourages expansive thinking |
| Project planning | `timeline.horizontal` | Linear time progression |
| Team hierarchy | `org-chart.down` | Top-down authority structure |
| Root cause analysis | `fishbone.rightHeaded` | Ishikawa diagram for cause-effect |
| Decision tree | `logic.right` | Left-to-right reading flow |
| Knowledge base | `tree.right` | Hierarchical file-system style |
| Feature comparison | `spreadsheet` | Grid/matrix layout |
| Meeting notes | `map.unbalanced` | Flexible free-form |
| SWOT analysis | `map.clockwise` + 4 boundaries | Quadrant visual grouping |
| Study outline | `tree.right` or `logic.right` | Structured hierarchy |

**Official Tip:** Skeleton vs Structure:
- **Skeleton** (54 built-in): Affects ENTIRE map — layout + all topic styles (shapes, lines, fonts). Use to quickly unify overall style.
- **Structure** (10 built-in): Affects SPECIFIC parts — can apply different structures to different branches in the same map.

## 3. Boundary (Official Guide)

Boundaries are **defined frames around subject matter** used to underscore and spotlight content.

**Rules:**
- Select one or more topics → add boundary (toolbar or `⇧+⌘+B`)
- Topics from SAME branch → grouped under SAME boundary
- Topics from DIFFERENT branches → each gets own boundary
- Central topic and multiple floating topics CANNOT have a boundary
- XMind offers **9 boundary shapes** to choose from
- Boundaries can have descriptive text (title)
- Boundaries can be nested within each other

**MCP Usage:**
```json
{
  "title": "Phase 1 Tasks",
  "children": [...],
  "boundary": {
    "title": "Sprint 1",
    "style": { "svg:fill": "#e3f2fd" }
  }
}
```

**When to Use:**
- Group related topics that need visual separation
- Highlight important clusters (e.g., "Critical Path", "MVP Features")
- Create visual quadrants (e.g., SWOT, Eisenhower Matrix)

## 4. Relationship (Official Guide)

Relationships are **customized connecting lines between any two topics** showing special correlations.

**Rules:**
- Can connect: topic↔topic, topic↔boundary, boundary↔boundary
- Any topic/boundary can have **multiple relationships**
- Has "endpoints" (connection position) and "control points" (line shape)
- Can add text description to define the relationship
- Customizable: line shape, style, color, arrows, text font/size/color

**MCP Usage:**
```json
{
  "relationships": [
    { "title": "depends on", "from": "design-ref", "to": "api-ref" },
    { "title": "blocks", "from": "auth-ref", "to": "deploy-ref" }
  ]
}
```
Topics must have `ref` field set to be referenced.

**When to Use:**
- Cross-branch dependencies ("API blocks Frontend")
- Cause-effect connections not captured by hierarchy
- Annotate relationships between concepts in different categories

## 5. Summary (Official Guide)

Summaries **condense multiple topics with a bracket and summary text**.

**Rules:**
- Select one or multiple topics → add summary
- Topics on SAME branch → grouped into SAME summary
- Topics on DIFFERENT branches → each gets own summary
- Central topics and multiple floating topics CANNOT have summaries
- Summary topics can have their own **subtopics** (Tab key to add)
- Adjustable range — expand/contract which topics are covered

**MCP Usage:**
```json
{
  "title": "Features",
  "children": [
    { "title": "Auth", "ref": "auth" },
    { "title": "API", "ref": "api" },
    { "title": "DB", "ref": "db" }
  ],
  "summaries": [
    { "title": "Backend Stack", "from": "auth", "to": "db" }
  ]
}
```

**When to Use:**
- Conclude key takeaways from a group of siblings
- Provide high-level summary of a section
- Add meta-commentary on a range of topics

## 6. Callout (Official Guide)

Callouts are **supplementary text annotations** attached to topics. More than just shapes — they serve as extensions of a topic, providing additional context.

**MCP Usage:**
```json
{
  "title": "Deploy to Production",
  "callouts": [
    { "title": "Deadline: March 15" },
    { "title": "Requires approval from CTO" }
  ]
}
```

**When to Use:**
- Important warnings or deadlines
- Annotations that should stand out visually
- Context that doesn't belong in the main hierarchy

## 7. Label (Official Guide)

Labels are **small text tags for categorization and annotation**.

**Rules:**
- Multiple labels per topic (comma-separated)
- Auto-sort alphabetically (optional)
- Cannot batch-edit labels across multiple topics
- Excellent for filtering — use Topic Filtering to filter by labels

**MCP Usage:**
```json
{ "title": "Setup CI/CD", "labels": ["DevOps", "Sprint 2", "P1"] }
```

**When to Use:**
- Categorize topics (owner, sprint, priority, status)
- Enable filtering by categories
- Quick metadata tags

## 8. Markers (Official Guide)

Markers are **image icons representing special meanings**, widely used in project management.

| Category | IDs | Use |
|----------|-----|-----|
| Priority | `priority-1` to `priority-7` | Importance ranking (P1=highest) |
| Task | `task-start`, `task-quarter`, `task-half`, `task-3quarter`, `task-done`, `task-pause` | Progress tracking |
| Flag | `flag-red/orange/green/blue/purple/dark-blue/gray` | Color-coded status |
| Star | `star-red/orange/green/blue/purple/dark-blue/gray` | Ratings/favorites |
| Smiley | `smiley-laugh/smile/cry/surprise/angry/boring/embarrass` | Sentiment |
| Arrow | `arrow-up/down/left/right/left-right/up-down/refresh` | Direction/flow |
| Month | `month-jan` to `month-dec` | Calendar months |
| Week | `week-sun` to `week-sat` | Days of week |
| People | `people-red/orange/green/blue/purple/dark-blue/gray` | Team members |

**Friendly aliases supported:** `priority.p1`, `task.done`, `flag.red`, etc.

**When to Use:**
- Priority markers on all actionable items
- Task progress markers for project tracking
- Flag colors for status (red=blocked, green=done, blue=in-progress)

## 9. Task (Official Guide)

Tasks turn ideas into **actionable steps** with structured tracking.

**Task Properties:**
- Progress (0-100%)
- Priority (P1-P5)
- Duration
- Start & Due Dates
- Dependencies (between tasks)
- Assignee

**Integration:** Tasks sync with **Gantt Chart** view — drag time bars to adjust duration, dependent tasks update automatically.

## 10. Notes (Official Guide)

Notes are **rich text annotations** attached to topics for detailed information.

**Capabilities:**
- Rich text: font, size, style, alignment, color
- Background color
- Local image insertion
- Hyperlink insertion (auto-detected URLs)
- Markdown support (2024+ format)

**MCP Usage:**
```json
{ "title": "Architecture", "note": "Use microservices with event-driven communication.\nSee RFC-042 for details." }
```

**When to Use:**
- Detailed descriptions that don't fit in topic title
- References, URLs, explanations
- Meeting notes attached to agenda items

## 11. Sheet (Official Guide)

A single .xmind file can contain **multiple sheets** for different mind maps.

**Best Practices:**
- When a single map gets too crowded → split into multiple sheets
- Use "New Sheet From Topic" to break complex branches into their own sheets
- Sheets can be copied, renamed, duplicated, reordered

## 12. Branch & Colored Branches (Official Guide)

Branches extend from the central idea with configurable visual styles.

**Colored Branch:** Encode branches with colors to accelerate brain cognition. Rainbow color palettes available — different colors for each branch enhance aesthetic appeal and allow grading of topics.

**Branch Free Layout:** Topics can be manually positioned with free-form dragging.

## 13. Styling (Official Guide)

**Styleable Elements:** Topic, Relationship, Boundary, Summary, Callout

**Topic Styles:**
- **Shape**: 31 different shapes available
- **Fill**: Background color
- **Border**: Style and width
- **Text**: Font, size, color (rich text — can style specific text within topic)
- **Branch**: Line appearance, color, thickness, end style
- **Numbering**: Auto-numbering style

**Relationship Styles:** Line shape, color, thickness, arrow style, text properties

**Boundary Styles:** 9 shapes, fill color, border lines, text properties

**Summary Styles:** Line style, thickness, color, topic shape, branch style

**Callout Styles:** Shape, fill color, border, text properties

**Map Style Properties:**
- **Auto Balance Map**: Adjusts unbalanced content heights
- **Compact Map**: Minimizes space usage
- **Justify Topic Alignment**: Ensures consistent length for same-level topics

**Style Properties Reference:**
```
svg:fill          — Background color (#ff6b6b)
fo:font-family    — Font (Inter, Nunito, NeverMind)
fo:font-size      — Size (16pt)
fo:font-weight    — Weight (bold, 500, 600)
fo:color          — Text color
border-line-color — Border color
shape-class       — Topic shape (org.xmind.topicShape.roundedRect)
line-class        — Branch connection style
line-width        — Branch line width
line-color        — Branch line color
```

## 14. Fold/Unfold (Official Guide)

Manage visibility of subtopics for complex maps:
- **Fold All**: `⇧+⌘+/` — Collapse all sub-branches
- **Fold by Level**: Right-click → Fold to Level 1/2/3
- Use `folded: true` in MCP to create pre-collapsed branches

**When to Use:** Pre-fold detail branches so viewers see high-level overview first.

## 15. Zone (Official Guide — Advanced)

Zones are **independent areas** for grouping and managing content separately.
- Create from floating topics or empty canvas
- Can edit, rearrange, export, print independently
- Central topic subtopics CANNOT be organized into zones
- Shortcut: `⌘+⌥+Z`

## 16. Topic Filtering (Official Guide)

Filter mind map topics by markers, labels, task info:
- Quickly find specific items in large maps
- Use with markers and labels for powerful filtering

## Theme Guide

| Use Case | Theme | Description |
|----------|-------|-------------|
| Business/formal | `professional` | Dark navy tones, clean lines |
| Study notes | `colorful` | Vibrant rainbow palette |
| Presentation/dark mode | `dark` | Purple accent on dark background |
| General purpose | `default` | Classic XMind style with rainbow branches |

---

## Visual Design Principles (CRITICAL — Read Before Creating)

> Based on XMind Official Blog "How to Create a Beautiful Mind Map" + The Non-Designer's Design Book + cognitive science research

### The 4 Fundamental Design Principles (from XMind Official Blog)

**1. Proximity — Group related items together**
Organize related elements visually close. Use boundaries, summaries, parent nodes, or consistent styling to group similar ideas. Apply the **MECE principle** (Mutually Exclusive, Collectively Exhaustive) to verify your grouping is clean — no overlaps, no gaps.

**2. Alignment — Every element aligns to a benchmark**
Complex information should align visually. Use consistent structure within each branch level. Don't mix structures randomly — if a branch uses logic.right, keep its siblings consistent. XMind's built-in structures handle this automatically.

**3. Contrast — Differentiate primary from secondary**
Create visual hierarchy through contrasts in: colors, shapes, sizes, fonts, line thickness, and brightness. Main topics should be visually dominant; subtopics visually subordinate. This makes the map "richer in meanings" without adding elements.

**4. Repetition — Consistent patterns across the entire map**
Repeated design elements achieve unity and strengthen understanding. Plan your visual patterns top-to-bottom BEFORE creating. Once settled, keep consistent across the entire sheet. **Maps break when you merge several maps into one** — the inconsistency in patterns destroys readability.

### Color Design

**Palette Limit: 4-5 colors max**
- Assign ONE specific color per main branch — stick to it through all sub-levels
- Color psychology: warm colors (red/orange) = urgency/priority; cool colors (blue/green) = calm/stable
- **Light themes** (`default`, `colorful`) for most use cases — better readability
- **Dark themes** only for presentations on dark backgrounds
- Boundary fills: very light/transparent — must NOT obscure text inside
- XMind's smart themes auto-adjust text/background contrast — leverage this

### Typography Hierarchy

- **Central topic**: Largest, boldest (default 28-30pt)
- **Main topics**: Medium bold (16-18pt)
- **Subtopics**: Regular weight (13-14pt)
- **Notes/labels**: Smallest, lighter color
- Use **short punchy keywords** — NOT full sentences
- **Parallel structure** across same level: all verbs ("Plan", "Execute", "Review") OR all nouns

### White Space & Balance

- **Ample white space** around each idea — prevents visual overwhelm
- Each element must remain **distinct and easy to follow**
- Strategic spacing reduces mental fatigue and enhances comprehension
- Use **Compact Map** sparingly — tight layout trades readability for space
- **Auto Balance Map** helps distribute content evenly on both sides

### Data Layering (Progressive Disclosure)

Hide rich details, show clean surface:
- **Notes** (hidden by default) for descriptions, URLs, references
- **Folding** for detail branches (level 3+) — show overview first
- **Labels** for filterable metadata (visible but small)
- **Markers** for at-a-glance status (icon = instant recognition)
- For maps with 20+ topics: fold all beyond level 2 by default

### Less Is More — Feature Restraint

**Do NOT use every feature in one map.** Choose **2-3 enrichment types** max based on purpose:

| Map Purpose | Primary Features | Avoid |
|-------------|-----------------|-------|
| Brainstorming | Boundaries, floating topics | Markers, relationships, labels |
| Project tracking | Markers (task progress), labels (owner) | Callouts, floating topics |
| Knowledge base | Boundaries, notes, summaries | Markers, relationships |
| Decision tree | Relationships (max 3), callouts (1) | Boundaries, labels, markers |
| Presentation | Boundaries, folding, theme | Labels, notes, floating topics |

### Specific Limits

| Element | Max Per Map | Why |
|---------|------------|-----|
| Markers per topic | 1-2 | More = icon soup, unreadable |
| Relationships | 3 | 4+ = spaghetti crossing lines |
| Callouts | 1-2 | If everything is "important", nothing is |
| Floating topics | 1-2 | Overlap with main content easily |
| Labels per topic | 1-2 | Keep metadata minimal |
| Boundaries | 2-3 | Every branch bounded = no contrast |

### Anti-Patterns to Avoid

- **Double-encoding**: `markers: ['priority-1']` + `labels: ['P1']` = same info twice
- **Boundary + Relationship overlap**: Dashed lines crossing dashed boundaries = unreadable. Use boundaries for self-contained groups; skip them on interconnected branches
- **Floating topics in center**: Place in empty corners ONLY, away from main branches
- **Inconsistent styling after merge**: When combining maps, unify visual patterns first
- **3+ markers per topic**: Pick the ONE most meaningful marker
- **Sentences as topic titles**: Use 1-5 word keywords; put details in notes

### Quick Decision Matrix

> "Should I use this feature?" Ask: **Does this ADD clarity or ADD noise?**

| Feature | Adds Clarity When... | Adds Noise When... |
|---------|---------------------|-------------------|
| Boundary | 3-7 topics naturally group | Every branch gets one |
| Relationship | 1-3 critical cross-links | 4+ lines crossing |
| Summary | Key takeaway from siblings | Restating obvious grouping |
| Callout | One critical warning | Multiple per branch |
| Marker | Consistent status tracking | 3+ per topic |
| Label | Filterable metadata | Decorative text |
| Floating topic | Truly independent idea | Could be a regular subtopic |
| Folding | 20+ topics, detail branches | Simple 10-topic map |
| Custom style | 1-2 emphasis topics | Every topic different style |

---

## Node Organization Best Practices

### The 7±2 Rule
- Central topic: **5-9 main branches** (optimal cognitive load)
- Each branch: **3-5 sub-topics** max
- Total depth: **3-4 levels** max (avoid deep nesting)
- If branch exceeds 7 children → group with **boundaries** or split into **sheets**

### Naming Conventions
- Central topic: Noun phrase, max 5 words
- Main branches: Category labels (1-2 words)
- Sub-topics: Specific, actionable items
- Consistent grammar within same level (all verbs OR all nouns)

### Visual Hierarchy Checklist
- **Markers** → status/priority (priority, task progress, flags)
- **Labels** → metadata (dates, owners, categories, sprints)
- **Notes** → details (descriptions, references, URLs)
- **Boundaries** → group related branches visually
- **Relationships** → cross-branch connections/dependencies
- **Summaries** → bracket key takeaways from sibling groups
- **Callouts** → highlight important annotations/warnings
- **Floating Topics** → independent ideas outside main hierarchy
- **Folding** → collapse detail levels for overview

---

## XMindMark Syntax (for `create_from_text`)

```
Central Topic
- Branch 1
    - Sub 1a [1]
    - Sub 1b
- Branch 2
    - Sub 2a [^1](relates to)
    - Sub 2b [B]
    - Sub 2c [B]
[B] Grouped Items
```

- 4 spaces per indent level
- `[N]` = reference number, `[^N](title)` = relationship to [N]
- `[B]` = boundary, `[S]` = summary

---

## Workflow

1. **Understand** what user wants to map — identify purpose and audience
2. **Select structure** from scenario table above
3. **Organize topics** following 7±2 rule, max 4 levels
4. **Add visual elements**: markers (priority/status), labels (metadata), boundaries (grouping)
5. **Add connections**: relationships (cross-branch), summaries (key takeaways)
6. **Annotate**: callouts (warnings/deadlines), notes (details)
7. **Choose theme** matching use case
8. **Pre-fold** detail branches if map is complex
9. Call `create_mind_map` with full structure
10. File auto-opens in XMind Pro at `~/Desktop/XMind/`
