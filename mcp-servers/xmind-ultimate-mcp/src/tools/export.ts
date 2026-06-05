import { readXMindFile } from '../core/xmind-io.js';
import type { TopicModel } from '../core/types.js';
import { writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { mkdir } from 'node:fs/promises';

function topicToMarkdown(topic: TopicModel, level: number = 1): string {
  const prefix = '#'.repeat(Math.min(level, 6));
  let result = `${prefix} ${topic.title}\n\n`;

  if (topic.notes?.plain?.content) {
    result += `${topic.notes.plain.content}\n\n`;
  }

  if (topic.children?.attached) {
    for (const child of topic.children.attached) {
      result += topicToMarkdown(child, level + 1);
    }
  }

  return result;
}

export async function exportXmind(input: {
  filepath: string;
  format: 'markdown' | 'json';
  outputPath?: string;
}): Promise<string> {
  try {
    const sheets = await readXMindFile(input.filepath);
    const baseName = basename(input.filepath, '.xmind');
    const outputDir = input.outputPath || dirname(input.filepath);

    await mkdir(outputDir, { recursive: true });

    let exportedFilepath = '';

    if (input.format === 'markdown') {
      const markdown = sheets
        .map((sheet, idx) => {
          let content = `# Sheet ${idx + 1}: ${sheet.title}\n\n`;
          content += topicToMarkdown(sheet.rootTopic);
          return content;
        })
        .join('\n---\n\n');

      exportedFilepath = join(outputDir, `${baseName}.md`);
      await writeFile(exportedFilepath, markdown, 'utf-8');
    } else {
      const json = JSON.stringify(sheets, null, 2);
      exportedFilepath = join(outputDir, `${baseName}.json`);
      await writeFile(exportedFilepath, json, 'utf-8');
    }

    return JSON.stringify({
      success: true,
      filepath: exportedFilepath,
      format: input.format,
      sheets: sheets.length,
    });
  } catch (error) {
    throw error;
  }
}
