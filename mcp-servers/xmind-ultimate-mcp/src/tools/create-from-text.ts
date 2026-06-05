import { writeXMindFile } from '../core/xmind-io.js';
import { generateId } from '../core/types.js';
import type { SheetModel, TopicModel, StructureClass } from '../core/types.js';
import { expandUser, getDefaultOutputPath } from '../core/utils.js';
import { join } from 'node:path';

interface ParsedLine {
  level: number;
  content: string;
  type: 'topic' | 'boundary' | 'summary';
}

function parseXMindMark(content: string): ParsedLine[] {
  const lines = content.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const match = line.match(/^(\s*)(.*)/);
    const level = match ? match[1].length / 4 : 0;
    let content = match ? match[2] : line;

    let type: 'topic' | 'boundary' | 'summary' = 'topic';
    if (content.includes('[B]')) {
      type = 'boundary';
      content = content.replace('[B]', '').trim();
    } else if (content.includes('[S]')) {
      type = 'summary';
      content = content.replace('[S]', '').trim();
    }

    return { level, content, type };
  });
}

export async function createFromText(input: {
  content: string;
  structure?: StructureClass;
  outputPath?: string;
  filename?: string;
}): Promise<string> {
  try {
    const lines = parseXMindMark(input.content);
    if (lines.length === 0) {
      throw new Error('No content provided');
    }

    const rootLine = lines[0];
    const stack: TopicModel[] = [];

    function createTopic(level: number, content: string): TopicModel {
      return {
        id: generateId(),
        class: 'topic',
        title: content,
      };
    }

    const root = createTopic(0, rootLine.content);
    const children: TopicModel[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const topic = createTopic(line.level, line.content);

      if (line.level === 1) {
        children.push(topic);
      } else if (line.level > 1 && children.length > 0) {
        const parent = children[children.length - 1];
        if (!parent.children) parent.children = { attached: [] };
        parent.children.attached!.push(topic);
      }
    }

    root.children = { attached: children };

    const sheet: SheetModel = {
      id: generateId(),
      class: 'sheet',
      title: 'Sheet 1',
      rootTopic: root,
    };

    const outputDir = expandUser(
      input.outputPath || getDefaultOutputPath()
    );
    const filename =
      input.filename || root.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filepath = join(outputDir, `${filename}.xmind`);

    await writeXMindFile([sheet], filepath);

    return JSON.stringify({
      success: true,
      filepath,
      title: root.title,
      topicsCreated: lines.length,
    });
  } catch (error) {
    throw error;
  }
}
