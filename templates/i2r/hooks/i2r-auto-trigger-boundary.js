// i2r-auto-trigger-boundary.js — UserPromptSubmit (advisory, never blocks).
// Requirements-shaped prompt -> nudge toward I2R. Implementation-shaped -> nudge away
// (I2R is WHAT/WHY only; HOW/tasks/code are GSD downstream).
const { readStdin, projectRoot, isI2RProject } = require('./_i2r-common.js');

const input = readStdin();
const root = projectRoot();
if (!isI2RProject(root)) process.exit(0);
const p = (input.prompt || '').toLowerCase();

const reqWords = ['requirement', 'prd', 'scope', 'acceptance criteria', 'user story', 'non-functional',
  '需求', '想法', '功能点', '验收', '范围', '产品定义'];
const implWords = ['implement', 'write the code', 'build the', 'debug', 'fix the bug', 'refactor',
  'deploy', 'database schema', 'api endpoint', '写代码', '实现', '部署', '架构实现', '修复'];

const isReq = reqWords.some(w => p.includes(w));
const isImpl = implWords.some(w => p.includes(w));

if (isImpl && !isReq) {
  process.stdout.write('[I2R hint] This reads as implementation/HOW — that is GSD/downstream. I2R only produces WHAT/WHY/constraints; it never writes code, architecture, tasks, or UI.');
} else if (isReq && !isImpl) {
  process.stdout.write('[I2R hint] This reads as requirements work — consider idea-to-requirements-orchestrator: it turns the idea into a reviewed, GSD-ready PRD (WHAT/WHY only) before any build.');
}
process.exit(0);
