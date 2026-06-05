import { writeXMindFile } from '../core/xmind-io.js';
import { buildSheet } from '../core/xmind-enhance.js';
import type { CreateMindMapInput } from '../core/types.js';
import { expandUser, getDefaultOutputPath } from '../core/utils.js';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

export async function createMindMap(input: CreateMindMapInput): Promise<string> {
  if (!input.title || input.title.trim() === '') {
    throw new Error('Mind map title is required');
  }
  if (!input.topics || input.topics.length === 0) {
    throw new Error('At least one topic is required');
  }

  // Build sheet using the full-featured builder from xmind-enhance
  // This handles ALL features: themes, summaries, boundaries, callouts,
  // floating topics, relationships, markers, styles, folding, etc.
  const sheet = buildSheet(input);

  const outputDir = expandUser(input.outputPath || getDefaultOutputPath());
  const filename =
    input.filename || input.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filepath = join(outputDir, `${filename}.xmind`);

  await writeXMindFile([sheet], filepath);

  if (input.autoOpen !== false) {
    try {
      execSync(`open "${filepath}"`, { stdio: 'ignore' });
    } catch {
      // Silently ignore if XMind not installed
    }
  }

  return JSON.stringify({
    success: true,
    filepath,
    title: input.title,
    topics: input.topics.length,
    relationships: input.relationships?.length ?? 0,
  });
}
