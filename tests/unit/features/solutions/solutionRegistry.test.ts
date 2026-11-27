import { describe, it, expect } from 'vitest';
import { createSolutionRegistry } from '../../../../features/solutions/solutionRegistry';

describe('createSolutionRegistry', () => {
  const registry = createSolutionRegistry();
  const sol = registry[0];

  it('registers BFS and backtracking solutions', () => {
    expect(registry.map((item) => item.id)).toEqual(['bfs', 'backtracking']);
    expect(registry[0].buildSteps('(a)())()').length).toBeGreaterThan(5);
    expect(registry[1].buildSteps(')(').at(-1)?.frame.nodes.some((node) => node.status === 'done')).toBe(true);
    expect(registry[0].steps.length).toBeGreaterThan(5);
    expect(registry[1].steps.length).toBeGreaterThan(5);
  });

  it('uses complete step snapshots with stable references and focus limits', () => {
    for (const solution of registry) {
      expect(new Set(solution.steps.map((step) => step.id)).size).toBe(solution.steps.length);
      for (const step of solution.steps) {
        expect(step.operation).toBeTruthy();
        expect(step.narration).toBeTruthy();
        expect(step.binding.anchorIds.length).toBeGreaterThan(0);
        expect(step.frame.nodes.length).toBeGreaterThan(0);
        expect(new Set(step.frame.nodes.map((node) => node.id)).size).toBe(step.frame.nodes.length);
        expect(step.frame.nodes.filter((node) => node.status === 'current').length, `${solution.id} step ${step.id}: ${step.title}`).toBeLessThanOrEqual(1);
        expect(step.frame.nodes.filter((node) => node.status === 'compare').length).toBeLessThanOrEqual(2);
        const ids = new Set(step.frame.nodes.map((node) => node.id));
        for (const edge of step.frame.edges) {
          expect(ids.has(edge.from)).toBe(true);
          expect(ids.has(edge.to)).toBe(true);
        }
        for (const label of step.frame.labels) expect(ids.has(label.targetId)).toBe(true);
        for (const container of step.frame.containers ?? []) {
          expect(container.items.every((id) => ids.has(id))).toBe(true);
        }
        for (const arrow of step.frame.arrows) {
          expect(arrow.text || arrow.kind === 'pointer').toBeTruthy();
        }
      }
    }
  });

  it('accepts legal problem inputs and rejects malformed inputs', () => {
    expect(sol.validateInput('"()())()"')).toMatchObject({ valid: true, parsed: '()())()' });
    expect(sol.validateInput('"(a)())()"').valid).toBe(true);
    expect(sol.validateInput('" )( "').valid).toBe(false);
    expect(sol.validateInput('"(').valid).toBe(false);
    expect(sol.validateInput('"X"').valid).toBe(false);
    expect(sol.validateInput('"((((((((((((((((((((("').valid).toBe(false);
    expect(sol.validateInput('not-json').valid).toBe(false);
  });

  it('generates random legal inputs', () => {
    for (const solution of registry) {
      for (let i = 0; i < 10; i += 1) {
        expect(solution.validateInput(solution.generateRandom()).valid).toBe(true);
      }
    }
  });

  it('shows the original input separately from the active BFS candidate', () => {
    const validationSteps = sol.buildSteps('()())()').filter((step) => step.binding.anchorIds.includes('validate'));
    const firstScan = validationSteps.find((step) => step.title.includes('字符 1/'));
    const secondScan = validationSteps.find((step) => step.title.includes('字符 2/'));
    expect(firstScan?.narration).toContain('未配对左括号');
    expect(firstScan?.frame.nodes.filter((node) => node.status === 'compare')).toHaveLength(2);
    expect(firstScan?.frame.nodes.find((node) => node.id === 'active-char-0')?.sublabel).toBe('余额 1');
    expect(firstScan?.frame.nodes.find((node) => node.id === 'input-char-0')?.label).toBe('(');
    expect(secondScan?.frame.nodes.find((node) => node.id === 'active-char-1')?.sublabel).toBe('余额 0');
  });

  it('keeps source indices aligned after deleting a character in a later BFS layer', () => {
    const steps = sol.buildSteps('()())()');
    const laterDeletion = steps.find((step) => step.operation === 'remove' && step.binding.variables.sourceCandidate !== '"()())()"');
    const removedIndex = laterDeletion?.binding.variables.removedIndex as number;
    const activeNode = laterDeletion?.frame.nodes.find((node) => node.id === `active-char-${removedIndex}`);
    const originalIndex = Number(activeNode?.badge?.replace('原', ''));
    expect(laterDeletion?.binding.variables.sourceCandidate).not.toBe('"()())()"');
    expect(activeNode?.status).toBe('compare');
    expect(activeNode?.badge).toBe(`原${originalIndex}`);
    expect(laterDeletion?.frame.nodes.find((node) => node.id === `input-char-${originalIndex}`)?.status).toBe('error');
  });

  it('shows source and result candidates as separate rows for a BFS deletion', () => {
    const removal = sol.buildSteps('()())()').find((step) => step.operation === 'remove');
    const removedIndex = removal?.binding.variables.removedIndex as number;
    expect(removal?.frame.nodes.find((node) => node.id === `active-char-${removedIndex}`)?.status).toBe('compare');
    expect(removal?.frame.nodes.find((node) => node.id === `active-char-${removedIndex}`)?.label).toBe('(');
    expect(removal?.frame.nodes.find((node) => node.id === 'result-char-3')?.label).toBe(')');
    expect(removal?.frame.nodes.find((node) => node.id === 'result-char-0')?.label).toBe(')');
    expect(removal?.frame.nodes.find((node) => node.id === 'result-char-1')?.label).toBe('(');
    expect(removal?.frame.containers?.[0].items).toContain(`candidate:${removal?.binding.variables.candidate}`);
    expect(removal?.narration).toContain('左侧是原候选，右侧是新候选');
  });

  it('shows explicit backtracking branches, pruning, balance, and remaining removal budget', () => {
    const backtracking = registry[1];
    const steps = backtracking.buildSteps('(a)())()');
    const operations = steps.map((step) => step.operation);

    expect(steps.length).toBeGreaterThan(12);
    expect(operations).toContain('remove');
    expect(operations).toContain('recurse');
    expect(operations).toContain('visit');
    expect(operations).toContain('match');
    expect(steps.some((step) => /剪枝/.test(step.title))).toBe(true);
    expect(steps.some((step) => step.narration.includes('余额'))).toBe(true);
    expect(steps.some((step) => step.binding.variables.leftRemaining !== undefined && step.binding.variables.rightRemaining !== undefined)).toBe(true);
    expect(backtracking.solve('(a)())()')).toEqual(['(a())()', '(a)()()']);
  });

  it('shows the DFS input and selected path as separate rows', () => {
    const step = registry[1].buildSteps('(a)())()').find((item) => item.operation === 'recurse' && item.title.includes('保留位置 0'));
    expect(step?.frame.containers).toEqual([]);
    expect(step?.frame.nodes.some((node) => node.id === 'input-char-0' && node.label === '(' && node.status === 'compare')).toBe(true);
    expect(step?.frame.nodes.some((node) => node.id === 'path-char-0' && node.label === '(')).toBe(true);
    expect(step?.frame.nodes.some((node) => node.id === 'input-char-1' && node.label === 'a')).toBe(true);
    expect(step?.binding.variables.path).toBe('(');
    expect(step?.binding.variables.balance).toBe(1);
    expect(step?.binding.variables.leftRemaining).toBe(0);
    expect(step?.binding.variables.rightRemaining).toBe(1);
  });

  it('records explicit DFS decisions for a minimal unmatched parenthesis', () => {
    const steps = registry[1].buildSteps(')(');
    expect(steps.some((step) => step.title.includes('删除位置 0 的右括号'))).toBe(true);
    expect(steps.some((step) => step.title.includes('删除位置 1 的左括号'))).toBe(true);
    expect(steps.at(-1)?.frame.metrics?.some((metric) => metric.label === '最少删除' && metric.value === 2)).toBe(true);
  });

  it('returns every minimum-removal answer for sample and edge cases', () => {
    expect(sol.solve('()())()')).toEqual(['(())()', '()()()']);
    expect(sol.solve('(a)())()')).toEqual(['(a())()', '(a)()()']);
    expect(sol.solve(')(')).toEqual(['']);
    expect(sol.solve('abc')).toEqual(['abc']);
  });

  it('maps each solution to its own algorithm code and line anchors', () => {
    const bfsJava = registry[0].codes.java.code;
    const dfsJava = registry[1].codes.java.code;
    expect(bfsJava).toContain('Queue<String>');
    expect(dfsJava).toContain('void dfs');
    expect(dfsJava).toContain('回溯撤销选择');
    expect(registry[1].codes.python.code).toContain('def dfs');
  });

  it('provides four language artifacts with valid anchor mappings', () => {
    for (const solution of registry) {
      for (const language of ['java', 'python', 'go', 'javascript'] as const) {
        const artifact = solution.codes[language];
        expect(artifact.code.length).toBeGreaterThan(0);
        for (const step of solution.steps) {
          for (const anchor of step.binding.anchorIds) {
            expect(anchor in artifact.anchorLineMap).toBe(true);
          }
        }
      }
    }
  });
});
