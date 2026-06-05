import mammoth from 'mammoth';
import { TopicInput } from '../core/types.js';

interface ParseResult {
  title: string;
  topics: TopicInput[];
}

export async function parseWord(filePath: string): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  const lines = text.split('\n');

  let title = 'Untitled';
  const rootTopics: TopicInput[] = [];
  const stack: { level: number; topic: TopicInput }[] = [];
  let foundTitle = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (!foundTitle) {
      title = line;
      foundTitle = true;
      continue;
    }

    // Detect indentation level from original line
    const indent = raw.length - raw.trimStart().length;
    const level = Math.floor(indent / 2) + 1;

    const isBullet = /^[-*+\u2022\u25E6\u25AA]\s+/.test(line);
    const text = isBullet ? line.replace(/^[-*+\u2022\u25E6\u25AA]\s+/, '') : line;

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
