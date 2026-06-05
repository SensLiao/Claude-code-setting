import * as XLSX from 'xlsx';
import { TopicInput } from '../core/types.js';

interface ParseResult {
  title: string;
  topics: TopicInput[];
}

export async function parseExcel(filePath: string): Promise<ParseResult> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length === 0) {
    return { title: sheetName || 'Untitled', topics: [] };
  }

  // Strategy 1: Column A = numeric level, Column B = title
  const hasNumericLevels = rows.every(
    (row) => row.length >= 2 && (row[0] === undefined || typeof row[0] === 'number')
  );

  if (hasNumericLevels && rows.some((r) => typeof r[0] === 'number')) {
    return parseWithNumericLevels(rows, sheetName);
  }

  // Strategy 2: Column position determines depth
  return parseByColumnPosition(rows, sheetName);
}

function parseWithNumericLevels(rows: any[][], sheetName: string): ParseResult {
  let title = sheetName || 'Untitled';
  const rootTopics: TopicInput[] = [];
  const stack: { level: number; topic: TopicInput }[] = [];

  for (const row of rows) {
    const level = typeof row[0] === 'number' ? row[0] : 0;
    const text = String(row[1] || '').trim();
    if (!text) continue;

    if (level === 0) {
      title = text;
      continue;
    }

    const topic: TopicInput = { title: text };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootTopics.push(topic);
    } else {
      const parent = stack[stack.length - 1].topic;
      if (!parent.children) parent.children = [];
      parent.children.push(topic);
    }

    stack.push({ level, topic });
  }

  return { title, topics: rootTopics };
}

function parseByColumnPosition(rows: any[][], sheetName: string): ParseResult {
  const firstRow = rows[0];
  const title = String(firstRow?.[0] || sheetName || 'Untitled').trim();
  const rootTopics: TopicInput[] = [];
  const stack: { level: number; topic: TopicInput }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Find the first non-empty cell — its column index = depth
    let level = 0;
    let text = '';
    for (let col = 0; col < row.length; col++) {
      if (row[col] !== undefined && row[col] !== null && String(row[col]).trim()) {
        level = col + 1;
        text = String(row[col]).trim();
        break;
      }
    }
    if (!text) continue;

    const topic: TopicInput = { title: text };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootTopics.push(topic);
    } else {
      const parent = stack[stack.length - 1].topic;
      if (!parent.children) parent.children = [];
      parent.children.push(topic);
    }

    stack.push({ level, topic });
  }

  return { title, topics: rootTopics };
}
