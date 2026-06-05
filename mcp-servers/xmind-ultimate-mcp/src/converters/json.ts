import { TopicInput } from '../core/types.js';

interface ParseResult {
  title: string;
  topics: TopicInput[];
}

export async function parseJSON(filePath: string): Promise<ParseResult> {
  const { readFile } = await import('fs/promises');
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  return parseJSONData(data);
}

export function parseJSONData(data: unknown): ParseResult {
  if (Array.isArray(data)) {
    const topics = data.map((item) => walkValue(item));
    return { title: 'Imported JSON', topics };
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);

    // If object has a "title" key, use it as root title
    if (obj.title && typeof obj.title === 'string') {
      const title = obj.title;
      const topics: TopicInput[] = [];
      for (const key of keys) {
        if (key === 'title') continue;
        topics.push(walkEntry(key, obj[key]));
      }
      return { title, topics };
    }

    // Otherwise, first key is title
    const title = keys[0] || 'Untitled';
    if (keys.length === 1) {
      const inner = obj[title];
      if (typeof inner === 'object' && inner !== null) {
        return { title, topics: walkObject(inner as Record<string, unknown>) };
      }
      return { title, topics: [] };
    }

    const topics = keys.map((key) => walkEntry(key, obj[key]));
    return { title: 'Imported JSON', topics };
  }

  return { title: String(data), topics: [] };
}

function walkEntry(key: string, value: unknown): TopicInput {
  if (value === null || value === undefined) {
    return { title: key };
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return {
        title: key,
        children: value.map((item) => walkValue(item)),
      };
    }
    return {
      title: key,
      children: walkObject(value as Record<string, unknown>),
    };
  }

  // Primitive value — show as note or label
  return {
    title: key,
    labels: [String(value)],
  };
}

function walkObject(obj: Record<string, unknown>): TopicInput[] {
  return Object.entries(obj).map(([key, value]) => walkEntry(key, value));
}

function walkValue(value: unknown): TopicInput {
  if (value === null || value === undefined) {
    return { title: 'null' };
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return {
        title: `[${value.length} items]`,
        children: value.map((item) => walkValue(item)),
      };
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    // Use 'name' or 'title' field as the topic title if available
    const nameKey = keys.find((k) => k === 'name' || k === 'title');
    const topicTitle = nameKey ? String(obj[nameKey]) : keys[0] || 'Object';
    return {
      title: topicTitle,
      children: Object.entries(obj)
        .filter(([k]) => k !== nameKey)
        .map(([k, v]) => walkEntry(k, v)),
    };
  }

  return { title: String(value) };
}
