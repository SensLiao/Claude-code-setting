import { homedir } from 'node:os';

export function expandUser(path: string): string {
  if (path.startsWith('~')) {
    return homedir() + path.slice(1);
  }
  return path;
}

export function getDefaultOutputPath(): string {
  return '~/Desktop/XMind';
}
