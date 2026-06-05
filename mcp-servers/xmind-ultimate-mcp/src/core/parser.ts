import {
  generateId,
  type SheetModel,
  type TopicModel,
  type TopicChildren,
  type BoundaryModel,
  type SummaryRef,
  type RelationshipModel,
  type ThemeModel,
} from './types.js';

// ─── Regex Patterns ───

const TOPIC_RE = /^(\s*)[-*]\s+/;
const NUMBER_RE = /\[(\d+)\]/;
const RELATIONSHIP_RE = /\[\^(\d+)\](\(([^)]*)\))?/;
const BOUNDARY_RE = /\[(B\d*)\]/i;
const BOUNDARY_TITLE_RE = /^(\s*)\[(B\d*)\]/i;
const SUMMARY_RE = /\[(S\d*)\]/i;
const SUMMARY_TOPIC_RE = /^(\s*)\[(S\d*)\]/i;
const RANGE_RE = /\((\d+),(\d+)\)/;

// ─── Internal Types ───

interface InternalTopic extends TopicModel {
  boundaries: InternalBoundary[];
  summaries: InternalSummaryRef[];
  children: InternalChildren;
}

interface InternalChildren extends TopicChildren {
  attached: InternalTopic[];
  summary: TopicModel[];
}

interface InternalBoundary extends BoundaryModel {
  name?: string;
}

interface InternalSummaryRef extends SummaryRef {
  name?: string;
}

interface Level {
  parent: InternalTopic;
  indent: number;
}

interface ParseStatus {
  levels: Level[];
  lastTopic: InternalTopic | undefined;
  numberedTopics: Record<string, InternalTopic>;
  relationships: Record<string, { source: InternalTopic; title?: string }>;
}

// ─── Helpers ───

function makeInternalTopic(title: string): InternalTopic {
  return {
    id: generateId(),
    title,
    titleUnedited: true,
    boundaries: [],
    summaries: [],
    children: { attached: [], summary: [] },
  };
}

function addTopicToParent(parent: InternalTopic, title: string): InternalTopic {
  const topic = makeInternalTopic(title);
  parent.children.attached.push(topic);
  return topic;
}

function addSingleBoundary(parent: InternalTopic, topic: InternalTopic, name: string): void {
  const index = parent.children.attached.indexOf(topic);
  const boundary: InternalBoundary = {
    id: generateId(),
    range: `(${index},${index})`,
    name,
    titleUnedited: true,
  };
  parent.boundaries.push(boundary);
}

function addSingleSummary(parent: InternalTopic, topic: InternalTopic, name: string): void {
  const summaryTopic: TopicModel = {
    id: generateId(),
    title: 'Summary',
    titleUnedited: true,
  };
  parent.children.summary.push(summaryTopic);

  const index = parent.children.attached.indexOf(topic);
  const summary: InternalSummaryRef = {
    id: generateId(),
    range: `(${index},${index})`,
    topicId: summaryTopic.id,
    name,
  };
  parent.summaries.push(summary);
}

// ─── Line Processor ───

function processLine(line: string, status: ParseStatus): void {
  // Summary topic line: [S] or [S1] at line start → set summary topic title
  if (SUMMARY_TOPIC_RE.test(line)) {
    const match = line.match(SUMMARY_TOPIC_RE)!;
    const indent = match[1].replace(/\t/g, '    ').length;
    const name = match[2];
    line = line.replace(SUMMARY_TOPIC_RE, '').trim();

    const currentLevel = status.levels.find(l => l.indent === indent);
    if (!currentLevel) return;

    const summaryRef = currentLevel.parent.summaries.find(s => s.name === name);
    if (!summaryRef) return;

    const summaryTopic = currentLevel.parent.children.summary.find(
      t => t.id === summaryRef.topicId
    );
    if (!summaryTopic) return;

    summaryTopic.title = line;

    // Process [1] number refs on summary topic
    while (NUMBER_RE.test(line)) {
      const num = line.match(NUMBER_RE)![1];
      line = line.replace(NUMBER_RE, '');
      summaryTopic.title = line;
      status.numberedTopics[num] = summaryTopic as InternalTopic;
    }

    // Process [^1] relationship refs on summary topic
    while (RELATIONSHIP_RE.test(line)) {
      const relMatch = line.match(RELATIONSHIP_RE)!;
      const target = relMatch[1];
      const title = relMatch[3];
      line = line.replace(RELATIONSHIP_RE, '');
      summaryTopic.title = line;
      status.relationships[target] = { source: summaryTopic as InternalTopic, title };
    }

    status.lastTopic = summaryTopic as InternalTopic;
    return;
  }

  // Boundary title line: [B] or [B1] at line start → set boundary title
  if (BOUNDARY_TITLE_RE.test(line)) {
    const match = line.match(BOUNDARY_TITLE_RE)!;
    const indent = match[1].replace(/\t/g, '    ').length;
    const name = match[2];
    const title = line.replace(BOUNDARY_TITLE_RE, '').trim();

    const currentLevel = status.levels.find(l => l.indent === indent);
    if (!currentLevel) return;

    const boundary = currentLevel.parent.boundaries.find(b => b.name === name);
    if (boundary) boundary.title = title;
    return;
  }

  // Regular topic line: - or * prefix
  if (TOPIC_RE.test(line)) {
    const indent = line.match(TOPIC_RE)![1].replace(/\t/g, '    ').length;
    line = line.replace(TOPIC_RE, '');

    let parentObject: InternalTopic;
    const currentLevelIndex = status.levels.findIndex(l => l.indent === indent);

    if (currentLevelIndex >= 0) {
      parentObject = status.levels[currentLevelIndex].parent;
      status.levels = status.levels.slice(0, currentLevelIndex + 1);
    } else {
      const lastLevel = status.levels[status.levels.length - 1];
      if (lastLevel.indent > indent) {
        throw new Error('Indentation error.');
      }
      parentObject = status.lastTopic!;
      status.levels.push({ parent: parentObject, indent });
    }

    const topicObject = addTopicToParent(parentObject, line);
    status.lastTopic = topicObject;

    // Process [1] number refs
    while (NUMBER_RE.test(line)) {
      const num = line.match(NUMBER_RE)![1];
      line = line.replace(NUMBER_RE, '');
      topicObject.title = line;
      status.numberedTopics[num] = topicObject;
    }

    // Process [^1] relationship refs
    while (RELATIONSHIP_RE.test(line)) {
      const relMatch = line.match(RELATIONSHIP_RE)!;
      const target = relMatch[1];
      const title = relMatch[3];
      line = line.replace(RELATIONSHIP_RE, '');
      topicObject.title = line;
      status.relationships[target] = { source: topicObject, title };
    }

    // Process [B] boundary markers
    while (BOUNDARY_RE.test(line)) {
      const name = line.match(BOUNDARY_RE)![1];
      line = line.replace(BOUNDARY_RE, '');
      topicObject.title = line;

      const extended = parentObject.boundaries
        .filter(b => b.name === name)
        .some(b => {
          const index = parentObject.children.attached.indexOf(topicObject);
          const rangeMatch = b.range!.match(RANGE_RE);
          if (!rangeMatch) return false;
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          if (index === end + 1) {
            b.range = `(${start},${index})`;
            return true;
          }
          return false;
        });

      if (!extended) {
        addSingleBoundary(parentObject, topicObject, name);
      }
    }

    // Process [S] summary markers
    while (SUMMARY_RE.test(line)) {
      const name = line.match(SUMMARY_RE)![1];
      line = line.replace(SUMMARY_RE, '');
      topicObject.title = line;

      const extended = parentObject.summaries
        .filter(s => s.name === name)
        .some(s => {
          const index = parentObject.children.attached.indexOf(topicObject);
          const rangeMatch = s.range!.match(RANGE_RE);
          if (!rangeMatch) return false;
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          if (index === end + 1) {
            s.range = `(${start},${index})`;
            return true;
          }
          return false;
        });

      if (!extended) {
        addSingleSummary(parentObject, topicObject, name);
      }
    }

    // Clean up trailing whitespace from title
    topicObject.title = topicObject.title.trim();
  }
}

// ─── Clean Internal Fields ───

function cleanTopic(topic: InternalTopic): TopicModel {
  const cleaned: TopicModel = {
    id: topic.id,
    title: topic.title,
  };

  if (topic.titleUnedited) cleaned.titleUnedited = true;
  if (topic.structureClass) cleaned.structureClass = topic.structureClass;
  if (topic.notes) cleaned.notes = topic.notes;
  if (topic.labels?.length) cleaned.labels = topic.labels;
  if (topic.markers?.length) cleaned.markers = topic.markers;
  if (topic.image) cleaned.image = topic.image;
  if (topic.style) cleaned.style = topic.style;
  if (topic.href) cleaned.href = topic.href;
  if (topic.branch) cleaned.branch = topic.branch;

  // Children
  const hasAttached = topic.children.attached.length > 0;
  const hasSummary = topic.children.summary.length > 0;
  if (hasAttached || hasSummary) {
    cleaned.children = {};
    if (hasAttached) {
      cleaned.children.attached = topic.children.attached.map(cleanTopic);
    }
    if (hasSummary) {
      cleaned.children.summary = topic.children.summary;
    }
  }

  // Boundaries — strip internal 'name' field
  if (topic.boundaries.length > 0) {
    cleaned.boundaries = topic.boundaries.map(b => {
      const { name, ...rest } = b as InternalBoundary & { name?: string };
      return rest;
    });
  }

  // Summaries — strip internal 'name' field
  if (topic.summaries.length > 0) {
    cleaned.summaries = topic.summaries.map(s => {
      const { name, ...rest } = s as InternalSummaryRef & { name?: string };
      return rest;
    });
  }

  return cleaned;
}

// ─── Default Theme (same as reference) ───

function getDefaultTheme(): ThemeModel {
  return {
    id: 'f8c8e44f-4a4d-43a7-8381-11a152eaf8a3',
    centralTopic: {
      id: 'c5069014-b642-4cf5-bb50-1d29bd0df2a1',
      properties: {
        'svg:fill': '#000229',
        'line-color': '#000229',
        'shape-class': 'org.xmind.topicShape.roundedRect',
        'line-class': 'org.xmind.branchConnection.curve',
        'line-width': '3pt',
        'line-pattern': 'solid',
        'fill-pattern': 'solid',
        'border-line-width': '0pt',
        'arrow-end-class': 'org.xmind.arrowShape.none',
        'alignment-by-level': 'inactived',
        'fo:font-family': 'NeverMind',
        'fo:font-style': 'normal',
        'fo:font-weight': '500',
        'fo:font-size': '30pt',
        'fo:text-transform': 'manual',
        'fo:text-decoration': 'none',
        'fo:text-align': 'center',
      },
    },
    mainTopic: {
      id: '70cef26a-bf8a-4a75-a3ba-c39b54a6401d',
      properties: {
        'shape-class': 'org.xmind.topicShape.roundedRect',
        'line-class': 'org.xmind.branchConnection.roundedElbow',
        'line-width': '2pt',
        'fill-pattern': 'solid',
        'border-line-width': '0pt',
        'fo:font-family': 'NeverMind',
        'fo:font-style': 'normal',
        'fo:font-weight': '500',
        'fo:font-size': '18pt',
        'fo:text-transform': 'manual',
        'fo:text-decoration': 'none',
        'fo:text-align': 'left',
      },
    },
    subTopic: {
      id: 'd5c7d9c0-e954-4c99-9e01-91cccd629c22',
      properties: {
        'shape-class': 'org.xmind.topicShape.roundedRect',
        'line-class': 'org.xmind.branchConnection.roundedElbow',
        'line-width': '2pt',
        'fill-pattern': 'solid',
        'border-line-width': '0pt',
        'fo:font-family': 'NeverMind',
        'fo:font-style': 'normal',
        'fo:font-weight': '400',
        'fo:font-size': '14pt',
        'fo:text-transform': 'manual',
        'fo:text-decoration': 'none',
        'fo:text-align': 'left',
      },
    },
    boundary: {
      id: 'beaff7ce-691f-481d-847c-c5f43d125660',
      properties: {
        'svg:fill': '#000229',
        'line-color': '#000229',
        'shape-class': 'org.xmind.boundaryShape.roundedRect',
        'shape-corner': '20pt',
        'line-width': '2',
        'line-pattern': 'dash',
        'fill-pattern': 'solid',
        'fo:font-family': "'NeverMind','Microsoft YaHei','PingFang SC','Microsoft JhengHei','sans-serif',sans-serif",
        'fo:font-style': 'normal',
        'fo:font-weight': '400',
        'fo:font-size': '14pt',
        'fo:text-transform': 'manual',
        'fo:text-decoration': 'none',
        'fo:text-align': 'center',
      },
    },
    relationship: {
      id: '81c8d0be-6082-4a1c-b88c-23b1445e0647',
      properties: {
        'line-color': '#000229',
        'shape-class': 'org.xmind.relationshipShape.curved',
        'line-width': '2',
        'line-pattern': 'dash',
        'arrow-begin-class': 'org.xmind.arrowShape.none',
        'arrow-end-class': 'org.xmind.arrowShape.triangle',
        'fo:font-family': "'NeverMind','Microsoft YaHei','PingFang SC','Microsoft JhengHei','sans-serif',sans-serif",
        'fo:font-style': 'normal',
        'fo:font-weight': '400',
        'fo:font-size': '13pt',
        'fo:text-transform': 'manual',
        'fo:text-decoration': 'none',
        'fo:text-align': 'center',
      },
    },
    map: {
      id: 'ea5bbe08-7b7a-4b13-a4ee-49b20dcc4de2',
      properties: {
        'svg:fill': '#ffffff',
        'multi-line-colors': '#F9423A #F6A04D #F3D321 #00BC7B #486AFF #4D49BE',
        'color-list': '#000229 #1F2766 #52CC83 #4D86DB #99142F #245570',
        'line-tapered': 'none',
      },
    },
    colorThemeId: 'Rainbow-#000229-MULTI_LINE_COLORS',
    skeletonThemeId: 'db4a5df4db39a8cd1310ea55ea',
  };
}

// ─── Main Parser ───

/**
 * Parse XMindMark text format into a SheetModel.
 *
 * Format:
 * - Line 1 = central topic
 * - `- ` or `* ` prefixed lines = topics (4-space indent = hierarchy depth)
 * - `[1]` = numbered reference for relationships
 * - `[^1](title)` = relationship to numbered topic
 * - `[B]`/`[B1]` = boundary markers
 * - `[S]`/`[S1]` = summary markers
 */
export function parseXMindMark(text: string): SheetModel {
  const lines = text.trim().split('\n');

  // First line = central topic
  const centralTitle = (lines.shift() ?? 'Central Topic').trim();

  const rootTopic = makeInternalTopic(centralTitle);
  rootTopic.structureClass = 'org.xmind.ui.logic.right';

  const status: ParseStatus = {
    levels: [{ parent: rootTopic, indent: 0 }],
    lastTopic: undefined,
    numberedTopics: {},
    relationships: {},
  };

  // Process remaining lines (skip empty)
  for (const line of lines) {
    if (line.trim() === '') continue;
    processLine(line, status);
  }

  // Build relationships
  const relationships: RelationshipModel[] = [];
  for (const [number, { source, title }] of Object.entries(status.relationships)) {
    const target = status.numberedTopics[number];
    if (!target) {
      throw new Error(`No topic [${number}] for creating a relationship.`);
    }
    const rel: RelationshipModel = {
      id: generateId(),
      end1Id: source.id,
      end2Id: target.id,
      titleUnedited: !title,
    };
    if (title) rel.title = title;
    relationships.push(rel);
  }

  // Clean the tree (strip internal fields)
  const cleanedRoot = cleanTopic(rootTopic);

  // Apply theme + extensions
  const theme = getDefaultTheme();

  const sheet: SheetModel = {
    id: generateId(),
    class: 'sheet',
    title: centralTitle,
    rootTopic: cleanedRoot,
    topicPositioning: 'fixed',
    relationships: relationships.length > 0 ? relationships : [],
    theme,
    extensions: [{
      provider: 'org.xmind.ui.skeleton.structure.style',
      content: {
        centralTopic: 'org.xmind.ui.map.clockwise',
        mainTopic: 'org.xmind.ui.logic.right',
      },
    }],
  };

  return sheet;
}
