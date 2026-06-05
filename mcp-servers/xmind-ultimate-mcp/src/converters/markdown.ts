import { TopicInput } from '../core/types.js';

interface ParseResult {
  title: string;
  topics: TopicInput[];
}

export async function parseMarkdown(filePath: string): Promise<ParseResult> {
  const { readFile } = await import('fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return parseMarkdownContent(content);
}

export function parseMarkdownContent(content: string): ParseResult {
  const lines = content.split('\n');
  let title = 'Untitled';
  const rootTopics: TopicInput[] = [];
  const stack: { level: number; topic: TopicInput }[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();

      if (level === 1 && rootTopics.length === 0 && stack.length === 0) {
        title = text;
        continue;
      }

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
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const text = bulletMatch[2].trim();
      const topic: TopicInput = { title: text };

      // Bullets are children of the last heading or deeper bullets
      const bulletLevel = 100 + Math.floor(indent / 2);

      while (stack.length > 0 && stack[stack.length - 1].level >= bulletLevel) {
        stack.pop();
      }

      if (stack.length === 0) {
        rootTopics.push(topic);
      } else {
        const parent = stack[stack.length - 1].topic;
        if (!parent.children) parent.children = [];
        parent.children.push(topic);
      }

      stack.push({ level: bulletLevel, topic });
      continue;
    }

    // Plain text line — treat as a topic under current context
    if (line.trim()) {
      const topic: TopicInput = { title: line.trim() };
      if (stack.length === 0) {
        rootTopics.push(topic);
      } else {
        const parent = stack[stack.length - 1].topic;
        if (!parent.children) parent.children = [];
        parent.children.push(topic);
      }
    }
  }

  return { title, topics: rootTopics };
}
