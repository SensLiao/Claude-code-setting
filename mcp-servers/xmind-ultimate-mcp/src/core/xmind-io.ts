import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import JSZip from 'jszip';
import type { SheetModel } from './types.js';

export async function readXMindFile(path: string): Promise<SheetModel[]> {
  const buffer = await readFile(path);
  const zip = await JSZip.loadAsync(buffer);

  const contentFile = zip.file('content.json');
  if (!contentFile) {
    throw new Error(`Invalid .xmind file: missing content.json in ${path}`);
  }

  const raw = await contentFile.async('string');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid content.json: expected array of sheets');
  }

  return parsed as SheetModel[];
}

export async function writeXMindFile(sheets: SheetModel[], path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const zip = new (JSZip as any)();

  zip.file('content.json', JSON.stringify(sheets));

  zip.file('metadata.json', JSON.stringify({
    creator: {
      name: 'xmind-ultimate-mcp',
      version: '1.0.0',
    },
  }));

  zip.file('manifest.json', JSON.stringify({
    'file-entries': {
      'content.json': {},
      'metadata.json': {},
    },
  }));

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  await writeFile(path, buffer);
}

export async function parseXMindZip(path: string): Promise<{
  sheets: SheetModel[];
  resources: Map<string, Buffer>;
}> {
  const buffer = await readFile(path);
  const zip = await JSZip.loadAsync(buffer);

  const contentFile = zip.file('content.json');
  if (!contentFile) {
    throw new Error(`Invalid .xmind file: missing content.json in ${path}`);
  }
  const raw = await contentFile.async('string');
  const sheets = JSON.parse(raw) as SheetModel[];

  const resources = new Map<string, Buffer>();
  const resourcePrefixes = ['resources/', 'attachments/'];

  for (const [relativePath, file] of Object.entries(zip.files)) {
    if ((file as any).dir) continue;
    if (resourcePrefixes.some(p => relativePath.startsWith(p))) {
      const data = await (file as any).async('nodebuffer');
      resources.set(relativePath, data);
    }
  }

  return { sheets, resources };
}
