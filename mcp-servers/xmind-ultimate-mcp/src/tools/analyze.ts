import { readXMindFile } from '../core/xmind-io.js';
import type { TopicModel } from '../core/types.js';

interface AnalysisMetrics {
  totalTopics: number;
  depth: number;
  avgBranchingFactor: number;
  maxBranchingFactor: number;
  imbalance: number;
  recommendations: string[];
}

function analyzeTree(topic: TopicModel): {
  count: number;
  depth: number;
  children: number;
  maxChildChildren: number;
} {
  let count = 1;
  let depth = 1;
  let maxChildChildren = 0;

  if (topic.children?.attached && topic.children.attached.length > 0) {
    const childResults = topic.children.attached.map(child =>
      analyzeTree(child)
    );

    count += childResults.reduce((sum, r) => sum + r.count, 0);
    depth = 1 + Math.max(...childResults.map(r => r.depth));
    maxChildChildren = Math.max(...childResults.map(r => r.children));
  }

  const childCount = topic.children?.attached?.length || 0;
  maxChildChildren = Math.max(maxChildChildren, childCount);

  return { count, depth, children: childCount, maxChildChildren };
}

export async function analyzeXmind(input: {
  filepath: string;
}): Promise<string> {
  try {
    const sheets = await readXMindFile(input.filepath);
    const metrics: AnalysisMetrics = {
      totalTopics: 0,
      depth: 0,
      avgBranchingFactor: 0,
      maxBranchingFactor: 0,
      imbalance: 0,
      recommendations: [],
    };

    for (const sheet of sheets) {
      const analysis = analyzeTree(sheet.rootTopic);
      metrics.totalTopics += analysis.count;
      metrics.depth = Math.max(metrics.depth, analysis.depth);
      metrics.maxBranchingFactor = Math.max(
        metrics.maxBranchingFactor,
        analysis.maxChildChildren
      );
    }

    metrics.avgBranchingFactor =
      metrics.maxBranchingFactor > 0
        ? Math.round((metrics.totalTopics / sheets.length) * 10) / 10
        : 0;

    // Recommendations
    if (metrics.depth > 4) {
      metrics.recommendations.push(
        'Map depth exceeds 4 levels - consider breaking into sub-maps'
      );
    }
    if (metrics.maxBranchingFactor > 9) {
      metrics.recommendations.push(
        'Some branches exceed 9 children - consider grouping with boundaries'
      );
    }
    if (metrics.totalTopics < 5) {
      metrics.recommendations.push('Map is quite small - consider adding more detail');
    }

    return JSON.stringify(metrics, null, 2);
  } catch (error) {
    throw error;
  }
}
