import { readXMindFile } from '../core/xmind-io.js';
import type { SheetModel, TopicModel } from '../core/types.js';

function topicToText(topic: TopicModel, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  let result = `${prefix}- ${topic.title}`;

  if (topic.notes?.plain?.content) {
    result += ` (note: ${topic.notes.plain.content})`;
  }

  if (topic.children?.attached) {
    for (const child of topic.children.attached) {
      result += '\n' + topicToText(child, indent + 1);
    }
  }

  return result;
}

function sheetToText(sheet: SheetModel): string {
  let result = `# ${sheet.title}\n\n`;
  result += topicToText(sheet.rootTopic);

  if (sheet.relationships && sheet.relationships.length > 0) {
    result += '\n\n## Relationships\n';
    for (const rel of sheet.relationships) {
      result += `- ${rel.title || 'connects'}: ${rel.end1Id} → ${rel.end2Id}\n`;
    }
  }

  return result;
}

export async function readXmind(input: {
  filepath: string;
  format?: 'json' | 'text';
}): Promise<string> {
  try {
    const sheets = await readXMindFile(input.filepath);

    if (input.format === 'text') {
      const text = sheets.map(s => sheetToText(s)).join('\n\n---\n\n');
      return text;
    }

    return JSON.stringify(sheets, null, 2);
  } catch (error) {
    throw error;
  }
}
