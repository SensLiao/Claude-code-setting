#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMindMap } from './tools/create.js';
import { createFromText } from './tools/create-from-text.js';
import { readXmind } from './tools/read.js';
import { analyzeXmind } from './tools/analyze.js';
import { convertToXmind } from './tools/convert.js';
import { translateXmind } from './tools/translate.js';
import { exportXmind } from './tools/export.js';
import { listXmindFiles } from './tools/list.js';

// Recursive topic schema definition for JSON Schema
const topicProperties: Record<string, any> = {
  title: { type: 'string', description: 'Topic title' },
  ref: { type: 'string', description: 'Reference ID for relationships/summaries' },
  note: { type: 'string', description: 'Note text' },
  labels: { type: 'array', items: { type: 'string' }, description: 'Labels below topic' },
  markers: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Markers: priority-1..7, task-start/quarter/half/3quarter/done/pause, flag-red/green/blue, star-red/green/blue, smiley-laugh/smile/cry, arrow-up/down/left/right',
  },
  children: { type: 'array', items: { type: 'object' }, description: 'Child topics (recursive)' },
  style: {
    type: 'object',
    description: 'Style properties: {"svg:fill":"#hex","fo:font-size":"14pt"}',
  },
  boundary: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      style: { type: 'object' },
    },
    description: 'Boundary box around children',
  },
  callouts: { type: 'array', items: { type: 'object' }, description: 'Callout annotations' },
  summaries: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        from: {},
        to: {},
      },
      required: ['title', 'from', 'to'],
    },
    description: 'Summary brackets',
  },
  href: { type: 'string', description: 'Hyperlink URL' },
  folded: { type: 'boolean', description: 'Collapse branch' },
};

const TOOLS = [
  {
    name: 'create_mind_map',
    description:
      'Create a professional XMind mind map with hierarchical topics, relationships, summaries, boundaries, markers, labels, notes, styles, themes, and multiple layouts. Outputs .xmind file.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Central topic / mind map title' },
        structure: {
          type: 'string',
          description:
            'Layout: org.xmind.ui.map.clockwise (brainstorm), org.xmind.ui.logic.right (logic), org.xmind.ui.org-chart.down (org chart), org.xmind.ui.fishbone.rightHeaded (cause-effect), org.xmind.ui.timeline.horizontal (timeline), org.xmind.ui.tree.right (taxonomy)',
        },
        theme: {
          type: 'string',
          description: 'Theme preset: default, professional, colorful, dark',
        },
        topics: {
          type: 'array',
          items: { type: 'object', properties: topicProperties, required: ['title'] },
          description: 'Main branches from the central topic',
        },
        relationships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              from: { type: 'string' },
              to: { type: 'string' },
            },
            required: ['from', 'to'],
          },
          description: 'Cross-topic connections using ref IDs',
        },
        floatingTopics: {
          type: 'array',
          items: { type: 'object', properties: topicProperties, required: ['title'] },
          description: 'Independent floating topics',
        },
        outputPath: { type: 'string', description: 'Output directory (default: ~/Desktop/XMind/)' },
        filename: { type: 'string', description: 'Filename without extension (default: from title)' },
        autoOpen: { type: 'boolean', description: 'Auto-open in XMind (default: true)' },
      },
      required: ['title', 'topics'],
    },
  },
  {
    name: 'create_from_text',
    description:
      'Create an XMind mind map from text input — indented outline or Markdown format. Paste your outline and get a .xmind file.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Text content: indented outline or Markdown' },
        structure: { type: 'string', description: 'Layout structure class' },
        outputPath: { type: 'string', description: 'Output directory' },
        filename: { type: 'string', description: 'Filename without extension' },
      },
      required: ['content'],
    },
  },
  {
    name: 'read_xmind',
    description:
      'Read and display the contents of an XMind file as structured text or JSON with topics, notes, labels, and markers.',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the .xmind file' },
        format: { type: 'string', enum: ['json', 'text'], description: 'Output format (default: json)' },
      },
      required: ['filepath'],
    },
  },
  {
    name: 'analyze_xmind',
    description:
      'Analyze an XMind file and provide statistics: total nodes, max depth, branching factor, balance, complexity rating, and improvement suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the .xmind file' },
      },
      required: ['filepath'],
    },
  },
  {
    name: 'convert_to_xmind',
    description:
      'Convert various file formats to XMind mind maps. Supports: .json, .csv, .yaml, .yml, .md, .markdown',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the source file' },
        title: { type: 'string', description: 'Mind map title' },
        structure: { type: 'string', description: 'Layout structure class' },
        outputPath: { type: 'string', description: 'Output directory' },
        filename: { type: 'string', description: 'Output filename without extension' },
      },
      required: ['filepath'],
    },
  },
  {
    name: 'translate_xmind',
    description:
      'Translate topic titles in an XMind file using a provided translation map. Creates a new translated .xmind copy.',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the .xmind file' },
        translationMap: {
          type: 'object',
          description: 'Translation map: { "original text": "translated text", ... }',
        },
        outputPath: { type: 'string', description: 'Output directory' },
        filename: { type: 'string', description: 'Output filename without extension' },
      },
      required: ['filepath', 'translationMap'],
    },
  },
  {
    name: 'export_xmind',
    description: 'Export an XMind file to Markdown or JSON format for use in other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the .xmind file' },
        format: { type: 'string', enum: ['markdown', 'json'], description: 'Export format' },
        outputPath: { type: 'string', description: 'Output directory' },
      },
      required: ['filepath', 'format'],
    },
  },
  {
    name: 'list_xmind_files',
    description: 'List all .xmind files in a directory with file details (path, size, dates).',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory to scan (default: current dir)' },
        recursive: { type: 'boolean', description: 'Search subdirectories (default: true)' },
      },
    },
  },
];

async function processToolCall(
  name: string,
  args: any
): Promise<string> {
  try {
    switch (name) {
      case 'create_mind_map':
        return await createMindMap(args);
      case 'create_from_text':
        return await createFromText(args);
      case 'read_xmind':
        return await readXmind(args);
      case 'analyze_xmind':
        return await analyzeXmind(args);
      case 'convert_to_xmind':
        return await convertToXmind(args);
      case 'translate_xmind':
        return await translateXmind(args);
      case 'export_xmind':
        return await exportXmind(args);
      case 'list_xmind_files':
        return await listXmindFiles(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, message);
  }
}

async function main() {
  const server = new Server(
    {
      name: 'xmind-ultimate-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const name = request.params.name;
    const args = request.params.arguments || {};
    const result = await processToolCall(name, args);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
