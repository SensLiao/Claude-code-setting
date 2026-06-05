import YAML from 'yaml';
import { TopicInput } from '../core/types.js';
import { parseJSONData } from './json.js';

interface ParseResult {
  title: string;
  topics: TopicInput[];
}

export async function parseYAML(filePath: string): Promise<ParseResult> {
  const { readFile } = await import('fs/promises');
  const content = await readFile(filePath, 'utf-8');
  const data = YAML.parse(content);
  return parseJSONData(data);
}
