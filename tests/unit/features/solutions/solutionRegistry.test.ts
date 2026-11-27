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

  it('explains each scanned character with its live balance and points to one character', () => {
    const validationSteps = sol.buildSteps('()())()').filter((step) => step.binding.anchorIds.includes('validate'));
    const firstScan = validationSteps.find((step) => step.title.includes('扫描位置 0'));
    const secondScan = validationSteps.find((step) => step.title.includes('扫描位置 1'));
    expect(firstScan?.narration).toContain('余额代表');
    expect(firstScan?.frame.nodes.filter((node) => node.status === 'compare')).toHaveLength(1);
    expect(firstScan?.frame.nodes.find((node) => node.id === 'char-0')?.sublabel).toBe('余额 1');
    expect(secondScan?.frame.nodes.find((node) => node.id === 'char-1')?.sublabel).toBe('余额 0');
  });

  it('explains each scanned character with its live balance and points to one character', () => {
    const validationSteps = sol.buildSteps('()())()').filter((step) => step.binding.anchorIds.includes('validate'));
    const firstScan = validationSteps.find((step) => step.title.includes('扫描位置 0'));
    const secondScan = validationSteps.find((step) => step.title.includes('扫描位置 1'));
    expect(firstScan?.narration).toContain('余额代表');
    expect(firstScan?.frame.nodes.filter((node) => node.status === 'compare')).toHaveLength(1);
    expect(firstScan?.frame.nodes.find((node) => node.id === 'char-0')?.sublabel).toBe('余额 1');
    expect(secondScan?.frame.nodes.find((node) => node.id === 'char-1')?.sublabel).toBe('余额 0');
  });

  it('keeps the active candidate visible while scanning and marks the removed bracket', () => {
    const steps = sol.buildSteps('()())()');
    const scan = steps.find((step) => step.operation === 'read');
    const removal = steps.find((step) => step.operation === 'remove');

    expect(scan?.frame.nodes.find((node) => node.id.startsWith('candidate:'))?.status).toBe('current');
    expect(scan?.frame.nodes.filter((node) => node.status === 'current')).toHaveLength(1);
    expect(removal?.frame.nodes.find((node) => node.id === `char-${removal.frame.nodes.find((node) => node.sublabel === '将删除')?.badge}`)?.status).toBe('compare');
    expect(removal?.frame.nodes.find((node) => node.id === `candidate:${removal.binding.variables.candidate}`)?.status).toBe('current');
  });

  it('returns every minimum-removal answer for sample and edge cases', () => {
    expect(sol.solve('()())()')).toEqual(['(())()', '()()()']);
    expect(sol.solve('(a)())()')).toEqual(['(a())()', '(a)()()']);
    expect(sol.solve(')(')).toEqual(['']);
    expect(sol.solve('abc')).toEqual(['abc']);
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
