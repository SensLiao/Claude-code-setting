import { writeXMindFile } from '../core/xmind-io.js';
import { generateId } from '../core/types.js';
import type { SheetModel, TopicModel, StructureClass } from '../core/types.js';
import { expandUser, getDefaultOutputPath } from '../core/utils.js';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

function createTopic(title: string): TopicModel {
  return {
    id: generateId(),
    class: 'topic',
    title,
  };
}

async function convertJson(data: any): Promise<TopicModel> {
  if (typeof data === 'string') {
    return createTopic(data);
  }
  if (Array.isArray(data)) {
    const topic = createTopic('Array');
    topic.children = {
      attached: await Promise.all(data.map(item => convertJson(item))),
    };
    return topic;
  }
  if (typeof data === 'object' && data !== null) {
    const topic = createTopic(Object.keys(data)[0] || 'Object');
    const children = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        const child = await convertJson(value);
        child.title = `${key}: ${child.title}`;
        return child;
      })
    );
    topic.children = { attached: children };
    return topic;
  }
  return createTopic(String(data));
}

export async function convertToXmind(input: {
  filepath: string;
  title?: string;
  structure?: StructureClass;
  outputPath?: string;
  filename?: string;
}): Promise<string> {
  try {
    const ext = input.filepath.split('.').pop()?.toLowerCase();
    const buffer = await readFile(input.filepath);
    const content = buffer.toString('utf-8');

    let rootTopic: TopicModel;
    const title = input.title || `Converted from ${input.filepath}`;

    switch (ext) {
      case 'json': {
        const data = JSON.parse(content);
        const converted = await convertJson(data);
        rootTopic = {
          id: generateId(),
          class: 'topic',
          title,
          children: { attached: [converted] },
        };
        break;
      }

      case 'csv': {
        const lines = content
          .split('\n')
          .filter(l => l.trim())
          .slice(0, 50);
        const children = lines.map(line =>
          createTopic(line.substring(0, 100))
        );
        rootTopic = {
          id: generateId(),
          class: 'topic',
          title,
          children: { attached: children },
        };
        break;
      }

      case 'yaml':
      case 'yml': {
        const lines = content.split('\n').filter(l => l.trim());
        const children = lines.map(line =>
          createTopic(line.replace(/^[-\s]+/, ''))
        );
        rootTopic = {
          id: generateId(),
          class: 'topic',
          title,
          children: { attached: children },
        };
        break;
      }

      case 'md':
      case 'markdown': {
        const lines = content.split('\n').filter(l => l.trim());
        const children = lines.map(line =>
          createTopic(line.replace(/^#+\s+/, '').substring(0, 100))
        );
        rootTopic = {
          id: generateId(),
          class: 'topic',
          title,
          children: { attached: children },
        };
        break;
      }

      default:
        throw new Error(
          `Unsupported file format: ${ext}. Supported: json, csv, yaml, md`
        );
    }

    const sheet: SheetModel = {
      id: generateId(),
      class: 'sheet',
      title: 'Sheet 1',
      rootTopic,
    };

    const outputDir = expandUser(
      input.outputPath || getDefaultOutputPath()
    );
    const filename =
      input.filename || title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filepath = join(outputDir, `${filename}.xmind`);

    await writeXMindFile([sheet], filepath);

    return JSON.stringify({
      success: true,
      filepath,
      title,
      format: ext,
    });
  } catch (error) {
    throw error;
  }
}
