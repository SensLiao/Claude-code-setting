import { randomUUID } from 'node:crypto';

// ─── XMind content.json Models ───

export interface SheetModel {
  id: string;
  class: 'sheet';
  title: string;
  rootTopic: TopicModel;
  relationships?: RelationshipModel[];
  theme?: ThemeModel;
  extensions?: ExtensionModel[];
  topicPositioning?: string;
}

export interface TopicModel {
  id: string;
  class?: 'topic';
  title: string;
  titleUnedited?: boolean;
  structureClass?: StructureClass;
  children?: TopicChildren;
  notes?: NotesModel;
  labels?: string[];
  markers?: MarkerRef[];
  image?: ImageModel;
  style?: StyleModel;
  boundaries?: BoundaryModel[];
  summaries?: SummaryRef[];
  href?: string;
  branch?: string;
  extensions?: ExtensionModel[];
}

export interface TopicChildren {
  attached?: TopicModel[];
  detached?: DetachedTopic[];
  summary?: TopicModel[];
  callout?: TopicModel[];
}

export interface DetachedTopic extends TopicModel {
  position?: { x: number; y: number };
}

export interface NotesModel {
  plain?: { content: string };
  html?: { content: string };
}

export interface MarkerRef {
  markerId: string;
}

export interface ImageModel {
  src: string;
  width?: number;
  height?: number;
}

export interface StyleModel {
  id?: string;
  properties?: Record<string, string>;
}

export interface BoundaryModel {
  id: string;
  class?: 'boundary';
  title?: string;
  range?: string;
  style?: StyleModel;
  titleUnedited?: boolean;
}

export interface SummaryRef {
  id: string;
  class?: 'summary';
  range?: string;
  topicId: string;
}

export interface RelationshipModel {
  id: string;
  class?: 'relationship';
  title?: string;
  end1Id: string;
  end2Id: string;
  titleUnedited?: boolean;
  controlPoints?: Record<string, { x: number; y: number }>;
  style?: StyleModel;
}

export interface ThemeModel {
  id?: string;
  map?: ThemeElement;
  centralTopic?: ThemeElement;
  mainTopic?: ThemeElement;
  subTopic?: ThemeElement;
  summaryTopic?: ThemeElement;
  calloutTopic?: ThemeElement;
  floatingTopic?: ThemeElement;
  boundary?: ThemeElement;
  summary?: ThemeElement;
  relationship?: ThemeElement;
  importantTopic?: ThemeElement;
  minorTopic?: ThemeElement;
  expiredTopic?: ThemeElement;
  global?: ThemeElement;
  skeletonThemeId?: string;
  colorThemeId?: string;
}

export interface ThemeElement {
  id?: string;
  properties?: Record<string, string>;
}

export interface ExtensionModel {
  provider: string;
  content: Record<string, any> | any[];
}

export type StructureClass =
  | 'org.xmind.ui.map.clockwise'
  | 'org.xmind.ui.map.anticlockwise'
  | 'org.xmind.ui.map.unbalanced'
  | 'org.xmind.ui.logic.right'
  | 'org.xmind.ui.logic.left'
  | 'org.xmind.ui.org-chart.down'
  | 'org.xmind.ui.org-chart.up'
  | 'org.xmind.ui.tree.right'
  | 'org.xmind.ui.tree.left'
  | 'org.xmind.ui.fishbone.leftHeaded'
  | 'org.xmind.ui.fishbone.rightHeaded'
  | 'org.xmind.ui.timeline.horizontal'
  | 'org.xmind.ui.timeline.vertical'
  | 'org.xmind.ui.spreadsheet'
  | 'org.xmind.ui.map'
  | (string & {});

// ─── MCP Tool Input Types ───

export interface TopicInput {
  title: string;
  ref?: string;
  note?: string;
  labels?: string[];
  markers?: string[];
  children?: TopicInput[];
  style?: Record<string, string>;
  boundary?: { title?: string; style?: Record<string, string> };
  callouts?: TopicInput[];
  summaries?: SummaryInput[];
  href?: string;
  folded?: boolean;
}

export interface SummaryInput {
  title: string;
  from: string | number;
  to: string | number;
}

export interface RelationshipInput {
  title?: string;
  from: string;
  to: string;
}

export interface CreateMindMapInput {
  title: string;
  structure?: StructureClass;
  theme?: string;
  topics: TopicInput[];
  relationships?: RelationshipInput[];
  floatingTopics?: TopicInput[];
  outputPath?: string;
  filename?: string;
  autoOpen?: boolean;
}

// ─── Utilities ───

export function generateId(): string {
  return randomUUID().replace(/-/g, '');
}
