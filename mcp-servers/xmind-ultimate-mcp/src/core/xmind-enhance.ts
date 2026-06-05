import {
  generateId,
  type SheetModel,
  type TopicModel,
  type TopicChildren,
  type BoundaryModel,
  type SummaryRef,
  type RelationshipModel,
  type StyleModel,
  type ThemeModel,
  type ThemeElement,
  type ExtensionModel,
  type CreateMindMapInput,
  type TopicInput,
  type StructureClass,
} from './types.js';

// ─── Marker Resolution ───

const MARKER_ALIASES: Record<string, string> = {
  // Priority
  'priority.p1': 'priority-1', 'priority.p2': 'priority-2', 'priority.p3': 'priority-3',
  'priority.p4': 'priority-4', 'priority.p5': 'priority-5', 'priority.p6': 'priority-6',
  'priority.p7': 'priority-7',
  // Smiley
  'smiley.laugh': 'smiley-laugh', 'smiley.smile': 'smiley-smile', 'smiley.cry': 'smiley-cry',
  'smiley.surprise': 'smiley-surprise', 'smiley.boring': 'smiley-boring',
  'smiley.angry': 'smiley-angry', 'smiley.embarrass': 'smiley-embarrass',
  // Task
  'task.start': 'task-start', 'task.oct': 'task-oct', 'task.quarter': 'task-quarter',
  'task.half': 'task-half', 'task.done': 'task-done', 'task.pause': 'task-pause',
  // Flag
  'flag.red': 'flag-red', 'flag.orange': 'flag-orange', 'flag.green': 'flag-green',
  'flag.blue': 'flag-blue', 'flag.purple': 'flag-purple',
  'flag.dark-blue': 'flag-dark-blue', 'flag.gray': 'flag-gray',
  // Star
  'star.red': 'star-red', 'star.orange': 'star-orange', 'star.green': 'star-green',
  'star.blue': 'star-blue', 'star.purple': 'star-purple',
  'star.dark-blue': 'star-dark-blue', 'star.gray': 'star-gray',
  // People
  'people.red': 'people-red', 'people.orange': 'people-orange', 'people.green': 'people-green',
  'people.blue': 'people-blue', 'people.purple': 'people-purple',
  'people.dark-blue': 'people-dark-blue', 'people.gray': 'people-gray',
  // Arrow
  'arrow.left': 'arrow-left', 'arrow.right': 'arrow-right',
  'arrow.up': 'arrow-up', 'arrow.down': 'arrow-down',
  'arrow.left-right': 'arrow-left-right', 'arrow.up-down': 'arrow-up-down',
  'arrow.refresh': 'arrow-refresh',
  // Month
  'month.jan': 'month-jan', 'month.feb': 'month-feb', 'month.mar': 'month-mar',
  'month.apr': 'month-apr', 'month.may': 'month-may', 'month.jun': 'month-jun',
  'month.jul': 'month-jul', 'month.aug': 'month-aug', 'month.sep': 'month-sep',
  'month.oct': 'month-oct', 'month.nov': 'month-nov', 'month.dec': 'month-dec',
  // Week
  'week.sun': 'week-sun', 'week.mon': 'week-mon', 'week.tue': 'week-tue',
  'week.wed': 'week-wed', 'week.thu': 'week-thu', 'week.fri': 'week-fri', 'week.sat': 'week-sat',
};

/**
 * Resolve a friendly marker name to XMind's internal markerId.
 * Accepts: "priority.p1", "priority-1", "Priority.p1", etc.
 */
export function resolveMarkerId(marker: string): string {
  const lower = marker.toLowerCase().trim();
  // Direct alias match (e.g. "priority.p1" → "priority-1")
  if (MARKER_ALIASES[lower]) return MARKER_ALIASES[lower];
  // Already in correct format (e.g. "priority-1")
  if (lower.includes('-')) return lower;
  // Generic "Category.name" → "category-name"
  return lower.replace(/\./g, '-');
}

// ─── Theme Presets ───

function makeThemeElement(props: Record<string, string>): ThemeElement {
  return { id: generateId(), properties: props };
}

export const THEMES: Record<string, ThemeModel> = {
  default: {
    id: generateId(),
    centralTopic: makeThemeElement({
      'svg:fill': '#000229',
      'line-color': '#000229',
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.curve',
      'line-width': '3pt',
      'fo:font-family': 'NeverMind',
      'fo:font-size': '30pt',
      'fo:font-weight': '500',
      'fo:text-align': 'center',
    }),
    mainTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.roundedElbow',
      'line-width': '2pt',
      'fo:font-family': 'NeverMind',
      'fo:font-size': '18pt',
      'fo:font-weight': '500',
    }),
    subTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.roundedElbow',
      'line-width': '2pt',
      'fo:font-family': 'NeverMind',
      'fo:font-size': '14pt',
    }),
    boundary: makeThemeElement({
      'svg:fill': '#000229',
      'line-color': '#000229',
      'shape-class': 'org.xmind.boundaryShape.roundedRect',
      'line-width': '2',
      'line-pattern': 'dash',
    }),
    relationship: makeThemeElement({
      'line-color': '#000229',
      'shape-class': 'org.xmind.relationshipShape.curved',
      'line-width': '2',
      'line-pattern': 'dash',
      'arrow-end-class': 'org.xmind.arrowShape.triangle',
    }),
    map: makeThemeElement({
      'svg:fill': '#ffffff',
      'multi-line-colors': '#F9423A #F6A04D #F3D321 #00BC7B #486AFF #4D49BE',
      'color-list': '#000229 #1F2766 #52CC83 #4D86DB #99142F #245570',
    }),
    colorThemeId: 'Rainbow-#000229-MULTI_LINE_COLORS',
    skeletonThemeId: 'db4a5df4db39a8cd1310ea55ea',
  },
  professional: {
    id: generateId(),
    centralTopic: makeThemeElement({
      'svg:fill': '#1a1a2e',
      'line-color': '#16213e',
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.curve',
      'line-width': '3pt',
      'fo:font-size': '28pt',
      'fo:font-weight': '600',
    }),
    mainTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.roundedElbow',
      'line-width': '2pt',
      'fo:font-size': '16pt',
    }),
    subTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-width': '1pt',
      'fo:font-size': '13pt',
    }),
    map: makeThemeElement({
      'svg:fill': '#f8f9fa',
      'color-list': '#1a1a2e #16213e #0f3460 #533483 #e94560 #4a47a3',
    }),
  },
  colorful: {
    id: generateId(),
    centralTopic: makeThemeElement({
      'svg:fill': '#FF6B6B',
      'line-color': '#FF6B6B',
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.curve',
      'line-width': '3pt',
      'fo:font-size': '30pt',
      'fo:font-weight': '700',
    }),
    mainTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.roundedElbow',
      'line-width': '2pt',
      'fo:font-size': '18pt',
    }),
    subTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-width': '2pt',
      'fo:font-size': '14pt',
    }),
    map: makeThemeElement({
      'svg:fill': '#ffffff',
      'multi-line-colors': '#FF6B6B #FFA06B #FFD93D #6BCB77 #4D96FF #9B59B6',
      'color-list': '#FF6B6B #FFA06B #FFD93D #6BCB77 #4D96FF #9B59B6',
    }),
    colorThemeId: 'Rainbow-#FF6B6B-MULTI_LINE_COLORS',
  },
  dark: {
    id: generateId(),
    centralTopic: makeThemeElement({
      'svg:fill': '#bb86fc',
      'line-color': '#bb86fc',
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.curve',
      'line-width': '3pt',
      'fo:font-size': '30pt',
      'fo:font-weight': '500',
    }),
    mainTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-class': 'org.xmind.branchConnection.roundedElbow',
      'line-width': '2pt',
      'fo:font-size': '18pt',
    }),
    subTopic: makeThemeElement({
      'shape-class': 'org.xmind.topicShape.roundedRect',
      'line-width': '2pt',
      'fo:font-size': '14pt',
    }),
    map: makeThemeElement({
      'svg:fill': '#121212',
      'color-list': '#bb86fc #03dac6 #cf6679 #ffb74d #81c784 #64b5f6',
    }),
  },
};

// ─── Topic Builder ───

/**
 * Build a TopicModel from TopicInput, tracking refs in refMap.
 */
export function buildTopic(
  input: TopicInput,
  refMap: Map<string, string>,
): TopicModel {
  const id = generateId();
  if (input.ref) refMap.set(input.ref, id);

  const topic: TopicModel = { id, title: input.title };

  // Notes
  if (input.note) {
    topic.notes = { plain: { content: input.note } };
  }

  // Labels
  if (input.labels?.length) {
    topic.labels = input.labels;
  }

  // Markers
  if (input.markers?.length) {
    topic.markers = input.markers.map(m => ({ markerId: resolveMarkerId(m) }));
  }

  // Style
  if (input.style && Object.keys(input.style).length > 0) {
    topic.style = { id: generateId(), properties: input.style };
  }

  // Hyperlink
  if (input.href) {
    topic.href = input.href;
  }

  // Folding
  if (input.folded) {
    topic.branch = 'folded';
  }

  // Build children
  const children: TopicChildren = {};
  let hasChildren = false;

  // Attached children (recursive)
  if (input.children?.length) {
    children.attached = input.children.map(c => buildTopic(c, refMap));
    hasChildren = true;
  }

  // Callouts
  if (input.callouts?.length) {
    children.callout = input.callouts.map(c => buildTopic(c, refMap));
    hasChildren = true;
  }

  if (hasChildren) {
    topic.children = children;
  }

  // Boundaries — applied over attached children by index
  if (input.boundary && children.attached?.length) {
    const startIdx = 0;
    const endIdx = children.attached.length - 1;
    topic.boundaries = [{
      id: generateId(),
      title: input.boundary.title,
      range: `(${startIdx},${endIdx})`,
      style: input.boundary.style
        ? { id: generateId(), properties: input.boundary.style }
        : undefined,
    }];
  }

  // Summaries — resolved from ref names/indices over attached children
  if (input.summaries?.length && children.attached?.length) {
    topic.summaries = [];
    topic.children!.summary = [];

    for (const sumInput of input.summaries) {
      const fromIdx = resolveChildIndex(sumInput.from, input.children ?? []);
      const toIdx = resolveChildIndex(sumInput.to, input.children ?? []);

      const summaryTopic: TopicModel = {
        id: generateId(),
        title: sumInput.title,
      };
      topic.children!.summary!.push(summaryTopic);

      topic.summaries.push({
        id: generateId(),
        range: `(${fromIdx},${toIdx})`,
        topicId: summaryTopic.id,
      });
    }
  }

  return topic;
}

function resolveChildIndex(
  ref: string | number,
  children: TopicInput[],
): number {
  if (typeof ref === 'number') return ref;
  const idx = children.findIndex(c => c.ref === ref || c.title === ref);
  return idx >= 0 ? idx : 0;
}

// ─── Sheet Builder ───

/**
 * Build a complete SheetModel from CreateMindMapInput.
 */
export function buildSheet(input: CreateMindMapInput): SheetModel {
  const refMap = new Map<string, string>();
  const sheetId = generateId();

  // Build root topic with children
  const rootChildren = input.topics.map(t => buildTopic(t, refMap));

  const rootTopic: TopicModel = {
    id: generateId(),
    class: 'topic',
    title: input.title,
    children: { attached: rootChildren },
  };

  // Structure class
  if (input.structure) {
    rootTopic.structureClass = input.structure;
  } else {
    rootTopic.structureClass = 'org.xmind.ui.map.clockwise';
  }

  const sheet: SheetModel = {
    id: sheetId,
    class: 'sheet',
    title: input.title,
    rootTopic,
    topicPositioning: 'fixed',
    relationships: [],
  };

  // Floating topics → children.detached
  if (input.floatingTopics?.length) {
    rootTopic.children!.detached = input.floatingTopics.map((ft, i) => {
      const topic = buildTopic(ft, refMap);
      return {
        ...topic,
        position: { x: 200 + i * 150, y: -200 - i * 50 },
      };
    });
  }

  // Relationships — resolve ref names to topic IDs
  if (input.relationships?.length) {
    sheet.relationships = input.relationships
      .map(rel => {
        const end1Id = refMap.get(rel.from);
        const end2Id = refMap.get(rel.to);
        if (!end1Id || !end2Id) return null;

        const r: RelationshipModel = {
          id: generateId(),
          end1Id,
          end2Id,
          titleUnedited: !rel.title,
        };
        if (rel.title) r.title = rel.title;
        return r;
      })
      .filter((r): r is RelationshipModel => r !== null);
  }

  // Theme
  const themeName = input.theme?.toLowerCase() ?? 'default';
  const theme = THEMES[themeName] ?? THEMES['default'];
  sheet.theme = theme;

  // Structure extension
  sheet.extensions = [{
    provider: 'org.xmind.ui.skeleton.structure.style',
    content: {
      centralTopic: input.structure ?? 'org.xmind.ui.map.clockwise',
      mainTopic: 'org.xmind.ui.logic.right',
    },
  }];

  return sheet;
}
