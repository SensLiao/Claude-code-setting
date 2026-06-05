import { readXMindFile, writeXMindFile } from '../core/xmind-io.js';
import type { TopicModel } from '../core/types.js';
import { expandUser, getDefaultOutputPath } from '../core/utils.js';
import { join } from 'node:path';

function translateTopic(
  topic: TopicModel,
  map: Record<string, string>
): TopicModel {
  const translated = { ...topic };
  if (map[topic.title]) {
    translated.title = map[topic.title];
  }

  if (translated.children?.attached) {
    translated.children.attached = translated.children.attached.map(child =>
      translateTopic(child, map)
    );
  }

  if (translated.children?.detached) {
    translated.children.detached = translated.children.detached.map(child =>
      translateTopic(child, map)
    );
  }

  return translated;
}

export async function translateXmind(input: {
  filepath: string;
  translationMap: Record<string, string>;
  outputPath?: string;
  filename?: string;
}): Promise<string> {
  try {
    const sheets = await readXMindFile(input.filepath);

    const translated = sheets.map(sheet => ({
      ...sheet,
      rootTopic: translateTopic(sheet.rootTopic, input.translationMap),
    }));

    const outputDir = expandUser(
      input.outputPath || getDefaultOutputPath()
    );
    const filename =
      input.filename ||
      `translated-${Date.now()}`;
    const filepath = join(outputDir, `${filename}.xmind`);

    await writeXMindFile(translated, filepath);

    const changedCount = Object.keys(input.translationMap).length;

    return JSON.stringify({
      success: true,
      filepath,
      translationsApplied: changedCount,
    });
  } catch (error) {
    throw error;
  }
}
