import { parse } from 'csv-parse/sync';
import { TopicInput } from '../core/types.js';

interface ParseResult {
  title: string;
  topics: TopicInput[];
}

export async function parseCSV(filePath: string): Promise<ParseResult> {
  const { readFile } = await import('fs/promises');
  const content = await readFile(filePath, 'utf-8');

  const records: string[][] = parse(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    return { title: 'Untitled', topics: [] };
  }

  // Strategy: first non-empty cell per row determines depth by column index
  const firstRow = records[0];
  const title = (firstRow[0] || 'Untitled').trim();
  const rootTopics: TopicInput[] = [];
  const stack: { level: number; topic: TopicInput }[] = [];

  // Check if column A has numeric levels
  const hasNumericLevels = records.slice(1).every((row) => {
    const val = row[0]?.trim();
    return !val || /^\d+$/.test(val);
  });

  if (hasNumericLevels && records.length > 1 && records[1][0]?.trim()) {
    // Column A = level number, Column B = title
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const level = parseInt(row[0]?.trim() || '1', 10);
      const text = (row[1] || '').trim();
      if (!text) continue;

      const topic: TopicInput = { title: text };

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        rootTopics.push(topic);
      } else {
        const parent = stack[stack.length - 1].topic;
        if (!parent.children) parent.children = [];
        parent.children.push(topic);
      }

      stack.push({ level, topic });
    }

    return { title, topics: rootTopics };
  }

  // Strategy 2: column position = depth
  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    let level = 0;
    let text = '';
    for (let col = 0; col < row.length; col++) {
      if (row[col]?.trim()) {
        level = col + 1;
        text = row[col].trim();
        break;
      }
    }
    if (!text) continue;

    const topic: TopicInput = { title: text };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootTopics.push(topic);
    } else {
      const parent = stack[stack.length - 1].topic;
      if (!parent.children) parent.children = [];
      parent.children.push(topic);
    }

    stack.push({ level, topic });
  }

  return { title, topics: rootTopics };
}
