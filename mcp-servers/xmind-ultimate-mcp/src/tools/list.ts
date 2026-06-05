import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

interface XMindFileInfo {
  path: string;
  size: number;
  created: string;
  modified: string;
}

async function listFilesRecursive(
  dir: string,
  recursive: boolean = true
): Promise<XMindFileInfo[]> {
  const results: XMindFileInfo[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isFile() && entry.name.endsWith('.xmind')) {
        const stats = await stat(fullPath);
        results.push({
          path: fullPath,
          size: stats.size,
          created: new Date(stats.birthtime).toISOString(),
          modified: new Date(stats.mtime).toISOString(),
        });
      } else if (entry.isDirectory() && recursive) {
        const subResults = await listFilesRecursive(fullPath, recursive);
        results.push(...subResults);
      }
    }
  } catch (error) {
    // Directory doesn't exist or permission denied
  }

  return results;
}

export async function listXmindFiles(input: {
  directory?: string;
  recursive?: boolean;
}): Promise<string> {
  try {
    const dir = input.directory || '.';
    const recursive = input.recursive !== false;

    const files = await listFilesRecursive(dir, recursive);
    const sorted = files.sort(
      (a, b) =>
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );

    return JSON.stringify({
      directory: dir,
      recursive,
      totalFiles: sorted.length,
      files: sorted,
    });
  } catch (error) {
    throw error;
  }
}
