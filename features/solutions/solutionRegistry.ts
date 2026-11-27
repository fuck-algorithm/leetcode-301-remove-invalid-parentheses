import type {
  AlgorithmStep,
  CanvasFrame,
  CanvasNode,
  CodeArtifact,
  CanvasLabel,
  InputValidationResult,
  Language,
  SolutionDefinition
} from '../../types';
import { createQueue } from '../animation/structures';

export type SearchSnapshot = {
  operation: AlgorithmStep['operation'];
  title: string;
  narration: string;
  line: string;
  candidate: string;
  sourceCandidate?: string;
  level: number;
  queue: string[];
  visited: string[];
  answers: string[];
  focus: string;
  focusStatus: 'current' | 'compare' | 'visited' | 'error' | 'done';
  scanIndex?: number;
  balance?: number;
  leftRemaining?: number;
  rightRemaining?: number;
  path?: string;
  pathOrigins?: number[];
  candidateOrigins?: number[];
  nextCandidate?: string;
  nextOrigins?: number[];
  arrowText?: string;
};

export type ProblemSolution = SolutionDefinition & {
  solve: (input: string) => string[];
  buildSteps: (input: string) => AlgorithmStep[];
};

function isValidParentheses(value: string): boolean {
  let balance = 0;
  for (const char of value) {
    if (char === '(') balance += 1;
    if (char === ')') balance -= 1;
    if (balance < 0) return false;
  }
  return balance === 0;
}

function inputValidator(raw: string): InputValidationResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'string') return { valid: false, error: '请输入 JSON 字符串，例如 "()())()"' };
    if (parsed.length === 0) return { valid: false, error: '输入长度至少为 1' };
    if (!/^[a-z()]*$/.test(parsed)) return { valid: false, error: '仅允许小写英文字母和括号 ()' };
    if ([...parsed].filter((char) => char === '(' || char === ')').length > 20) {
      return { valid: false, error: '括号数量不能超过 20 个' };
    }
    return { valid: true, parsed };
  } catch {
    return { valid: false, error: '输入必须是合法 JSON 字符串，例如 "()())()"' };
  }
}

function solveBfs(input: string): string[] {
  let level = new Set([input]);
  while (level.size > 0) {
    const valid = [...level].filter(isValidParentheses);
    if (valid.length > 0) return valid.sort();
    const next = new Set<string>();
    for (const candidate of level) {
      for (let i = 0; i < candidate.length; i += 1) {
        if (candidate[i] !== '(' && candidate[i] !== ')') continue;
        if (i > 0 && candidate[i] === candidate[i - 1]) continue;
        next.add(candidate.slice(0, i) + candidate.slice(i + 1));
      }
    }
    level = next;
  }
  return [''];
}

function buildBfsSnapshots(input: string): SearchSnapshot[] {
  const snapshots: SearchSnapshot[] = [];
  const queue = [input];
  const visited = new Set([input]);
  const originsByCandidate = new Map([[input, [...input].map((_, index) => index)]]);
  let level = 0;
  snapshots.push({
    operation: 'init', title: '从原串开始',
    narration: `BFS 把完整字符串「${input}」作为第 0 层候选放入队列。接下来每轮只删一个括号，所以先找 0 次删除的解，再找 1 次删除的解。`,
    line: 'init', candidate: input, candidateOrigins: [...input].map((_, index) => index), level, queue: [...queue], visited: [...visited], answers: [], focus: `candidate:${input}`, focusStatus: 'current'
  });

  while (queue.length > 0) {
    const width = queue.length;
    const layerItems = queue.slice(0, width);
    const validAtLevel: string[] = [];
    for (const candidate of layerItems) {
      queue.shift();
      const candidateId = `candidate:${candidate}`;
      snapshots.push({
        operation: 'dequeue', title: '取出队首候选',
        narration: `取出当前候选「${candidate || '空串'}」进行检查。待检查队列仍保留其它候选；先进先出保证删除较少的候选先检查。`,
        line: 'dequeue', candidate, candidateOrigins: originsByCandidate.get(candidate) ?? [...candidate].map((_, index) => index), level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: candidateId, focusStatus: 'current', arrowText: `取出 ${candidate || '空串'}`
      });
      let balance = 0;
      let invalidAt = -1;
      for (let index = 0; index < candidate.length; index += 1) {
        if (candidate[index] === '(') balance += 1;
        if (candidate[index] === ')') balance -= 1;
        if (balance < 0) {
          invalidAt = index;
          break;
        }
        snapshots.push({
          operation: 'read', title: `检查候选「${candidate}」的字符 ${index + 1}/${candidate.length}`,
          narration: candidate[index] === '('
            ? `候选「${candidate}」的下标 ${index} 是左括号；未配对左括号从 ${balance - 1} 增至 ${balance}。`
            : candidate[index] === ')'
              ? `候选「${candidate}」的下标 ${index} 是右括号；它与一个未配对左括号配对，余额从 ${balance + 1} 降至 ${balance}。`
              : `候选「${candidate}」的下标 ${index} 是字母「${candidate[index]}」；字母保留在原位，不改变括号余额。`,
          line: 'validate', candidate, candidateOrigins: originsByCandidate.get(candidate) ?? [...candidate].map((_, originalIndex) => originalIndex), level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: `candidate-char-${index}`, focusStatus: 'compare', scanIndex: index, balance
        });
      }
      const valid = invalidAt < 0 && balance === 0;
      if (invalidAt >= 0) {
        snapshots.push({
          operation: 'visit', title: `候选「${candidate}」在下标 ${invalidAt} 失衡`,
          narration: `下标 ${invalidAt} 的右括号前没有可配对的左括号，余额变成 ${balance}；候选「${candidate}」无效，需要删括号再检查。`,
          line: 'validate', candidate, candidateOrigins: originsByCandidate.get(candidate) ?? [...candidate].map((_, index) => index), level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: `char-${invalidAt}`, focusStatus: 'error', scanIndex: invalidAt, balance
        });
      } else {
        snapshots.push({
          operation: valid ? 'match' : 'visit', title: valid ? '候选有效' : '仍有左括号未配对',
          narration: valid
            ? `扫描「${candidate || '空串'}」后余额始终非负且归零，因此它是本层的有效结果。`
            : `扫描完整个候选「${candidate}」后余额为 ${balance}，还有 ${balance} 个左括号未配对，因此它无效。`,
          line: 'validate', candidate, candidateOrigins: originsByCandidate.get(candidate) ?? [...candidate].map((_, index) => index), level, queue: [...queue], visited: [...visited], answers: [...validAtLevel, ...(valid ? [candidate] : [])], focus: candidateId, focusStatus: valid ? 'done' : 'error', balance
        });
      }
      if (valid) {
        validAtLevel.push(candidate);
        continue;
      }
      for (let i = 0; i < candidate.length; i += 1) {
        const char = candidate[i];
        if (char !== '(' && char !== ')') continue;
        if (i > 0 && char === candidate[i - 1]) continue;
        const next = candidate.slice(0, i) + candidate.slice(i + 1);
        if (visited.has(next)) continue;
        visited.add(next);
        const candidateOrigins = originsByCandidate.get(candidate) ?? [...candidate].map((_, index) => index);
        const nextOrigins = candidateOrigins.filter((_, index) => index !== i);
        originsByCandidate.set(next, nextOrigins);
        queue.push(next);
        snapshots.push({
          operation: 'remove', title: `删除位置 ${i} 的括号`,
          narration: `从「${candidate}」删除下标 ${i} 的「${char}」，得到「${next || '空串'}」。左侧是原候选，右侧是新候选；新候选进入待检查队列。`,
          line: 'generate', candidate: next, sourceCandidate: candidate,
          candidateOrigins, nextCandidate: next, nextOrigins,
          level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: `candidate:${next}`, focusStatus: 'current', scanIndex: i, balance: 0, arrowText: `入队 ${next || '空串'}`
        });
      }
    }
    if (validAtLevel.length > 0) {
      const answers = [...new Set(validAtLevel)].sort();
      snapshots.push({
        operation: 'done', title: '收集最少删除结果',
        narration: `删除 ${level} 个括号这一层找到 ${answers.length} 个有效结果；BFS 首个有解层即为最少删除数，所以全部返回。`,
        line: 'collect', candidate: answers[0] ?? '', level, queue: [], visited: [...visited], answers, focus: `candidate:${answers[0] ?? ''}`, focusStatus: 'done'
      });
      break;
    }
    level += 1;
  }
  return snapshots;
}

function buildBacktrackingSnapshots(input: string): SearchSnapshot[] {
  const snapshots: SearchSnapshot[] = [];
  const answers: string[] = [];
  const visited = new Set<string>();
  let leftToRemove = 0;
  let rightToRemove = 0;
  for (const char of input) {
    if (char === '(') leftToRemove += 1;
    if (char === ')') {
      if (leftToRemove > 0) leftToRemove -= 1;
      else rightToRemove += 1;
    }
  }
  const minimumRemovals = leftToRemove + rightToRemove;
  const maxTraceSteps = 48;
  const record = (snapshot: SearchSnapshot, state?: { path: string; pathOrigins: number[]; leftRemaining: number; rightRemaining: number }) => {
    if (snapshots.length < maxTraceSteps) {
      snapshots.push(state ? {
        ...snapshot,
        candidate: state.path,
        path: state.path,
        pathOrigins: state.pathOrigins,
        leftRemaining: state.leftRemaining,
        rightRemaining: state.rightRemaining
      } : snapshot);
    }
  };

  record({
    operation: 'init', title: '先算删除预算',
    narration: `扫描输入后发现至少要删 ${leftToRemove} 个多余左括号和 ${rightToRemove} 个多余右括号；DFS 只探索恰好用完这份预算的路径。`,
    line: 'count', candidate: '', level: minimumRemovals, queue: [], visited: [], answers: [], focus: 'input', focusStatus: 'current',
    path: '', leftRemaining: leftToRemove, rightRemaining: rightToRemove
  }, { path: '', pathOrigins: [], leftRemaining: leftToRemove, rightRemaining: rightToRemove });

  const search = (index: number, path: string, pathOrigins: number[], balance: number, leftRemaining: number, rightRemaining: number) => {
    if (index === input.length) {
      if (leftRemaining === 0 && rightRemaining === 0 && balance === 0) {
        if (!visited.has(path)) {
          visited.add(path);
          answers.push(path);
          record({
            operation: 'match', title: '找到一个有效结果',
            narration: `路径「${path || '空串'}」用完删除预算且余额归零，因此收录为答案；继续搜索以找齐其它最优解。`,
            line: 'collect', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `candidate:${path}`, focusStatus: 'done', balance
          }, { path, pathOrigins, leftRemaining, rightRemaining });
        }
      } else {
        record({
          operation: 'visit', title: '到达末尾但条件未满足',
          narration: `路径「${path || '空串'}」结束时还剩 ${leftRemaining + rightRemaining} 次删除预算或余额为 ${balance}，不能作为有效答案。`,
          line: 'validate', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: index > 0 ? `char-${index - 1}` : 'input', focusStatus: 'error', balance
        }, { path, pathOrigins, leftRemaining, rightRemaining });
      }
      return;
    }

    const char = input[index];
    if (char !== '(' && char !== ')') {
      record({
        operation: 'read', title: `保留字母「${char}」`,
        narration: `位置 ${index} 是字母「${char}」而非括号，题目不允许删除它，所以直接接到当前路径后。`,
        line: 'keep', candidate: path + char, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
      }, { path: path + char, pathOrigins: [...pathOrigins, index], leftRemaining, rightRemaining });
      search(index + 1, path + char, [...pathOrigins, index], balance, leftRemaining, rightRemaining);
      return;
    }

    const duplicate = index > 0 && input[index] === input[index - 1];
    if (char === '(' && leftRemaining > 0 && !duplicate) {
      record({
        operation: 'remove', title: `删除位置 ${index} 的左括号`,
        narration: `还需删除 ${leftRemaining} 个左括号；跳过当前位置后预算减一，递归探索这条删除分支。`,
        line: 'search', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
      }, { path, pathOrigins, leftRemaining, rightRemaining });
      search(index + 1, path, pathOrigins, balance, leftRemaining - 1, rightRemaining);
    } else if (char === ')' && rightRemaining > 0 && !duplicate) {
      record({
        operation: 'remove', title: `删除位置 ${index} 的右括号`,
        narration: `此前没有未匹配左括号可与它配对，因此这是多余右括号；删除后右括号预算减一。`,
        line: 'search', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
      }, { path, pathOrigins, leftRemaining, rightRemaining });
      search(index + 1, path, pathOrigins, balance, leftRemaining, rightRemaining - 1);
    }

    if (duplicate) {
      record({
        operation: 'visit', title: '跳过重复删除分支',
        narration: `位置 ${index} 与前一位括号相同；删除任意一个会产生相同子问题，因此只保留第一次删除的分支。`,
        line: 'generate', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'visited', scanIndex: index, balance
      }, { path, pathOrigins, leftRemaining, rightRemaining });
    }

    if (char === '(') {
      record({
        operation: 'recurse', title: `保留位置 ${index} 的左括号`,
        narration: `选择保留「(」会让未匹配余额从 ${balance} 增至 ${balance + 1}；递归继续处理下一个字符。`,
        line: 'keep', candidate: path + char, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance: balance + 1
      }, { path: path + char, pathOrigins: [...pathOrigins, index], leftRemaining, rightRemaining });
      search(index + 1, path + char, [...pathOrigins, index], balance + 1, leftRemaining, rightRemaining);
    } else if (balance > 0) {
      record({
        operation: 'recurse', title: `配对并保留位置 ${index} 的右括号`,
        narration: `当前余额 ${balance} 大于 0，存在左括号可配对；保留「)」后余额减为 ${balance - 1}。`,
        line: 'keep', candidate: path + char, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance: balance - 1
      }, { path: path + char, pathOrigins: [...pathOrigins, index], leftRemaining, rightRemaining });
      search(index + 1, path + char, [...pathOrigins, index], balance - 1, leftRemaining, rightRemaining);
    } else {
      record({
        operation: 'visit', title: '剪枝：右括号没有可配对项',
        narration: `位置 ${index} 的「)」遇到余额 0；保留它会让前缀余额变成 -1，因此这条分支立即剪枝。`,
        line: 'validate', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'error', scanIndex: index, balance
      }, { path, pathOrigins, leftRemaining, rightRemaining });
    }
  };

  search(0, '', [], 0, leftToRemove, rightToRemove);
  const sortedAnswers = answers.sort();
  snapshots.push({
    operation: 'done', title: '返回全部最少删除结果',
    narration: `搜索结束，共找到 ${sortedAnswers.length} 个有效结果；每条答案都恰好删除 ${minimumRemovals} 个括号，并保持前缀余额非负、最终归零。`,
    line: 'collect', candidate: sortedAnswers[0] ?? '', level: minimumRemovals, queue: [], visited: [...visited], answers: sortedAnswers, focus: `candidate:${sortedAnswers[0] ?? ''}`, focusStatus: 'done', balance: 0
  });
  return snapshots;
}

function candidateSummary(value: string): string {
  return value.length > 9 ? `${value.slice(0, 8)}…` : value || 'ε';
}

function rowNodes(options: {
  id: string;
  value: string;
  y: number;
  origins?: number[];
  focusedIndex?: number;
  visitedOrigins?: number[];
  status?: CanvasNode['status'];
  label: string;
  showLabels?: boolean;
  badgeAtIndex?: (index: number) => string | undefined;
  detailAtFocus?: (index: number) => string;
}): CanvasNode[] {
  const chars = [...options.value];
  if (chars.length === 0) return [{
    id: `${options.id}-empty`, label: 'ε', x: 600, y: options.y, radius: 20,
    badge: '空串', sublabel: '字符串为空', status: options.status ?? 'visited'
  }];
  const compact = chars.length > 14;
  const pitch = compact ? 42 : 68;
  const radius = compact ? 20 : 26;
  const startX = (1200 - Math.max(chars.length - 1, 0) * pitch) / 2;
  return chars.map((char, index) => ({
    id: `${options.id}-${index}`,
    label: char,
    x: startX + index * pitch,
    y: options.y,
    radius,
    badge: options.badgeAtIndex?.(index) ?? String(options.origins?.[index] ?? index),
    sublabel: !options.showLabels ? '' : index === options.focusedIndex
      ? options.detailAtFocus?.(index) ?? options.label
      : options.visitedOrigins?.includes(options.origins?.[index] ?? index) ? '已扫描' : options.label,
    status: index === options.focusedIndex ? options.status ?? 'current' : options.visitedOrigins?.includes(options.origins?.[index] ?? index) ? 'visited' : 'idle'
  }));
}

function frameFor(snapshot: SearchSnapshot, input: string, algorithm: 'bfs' | 'backtracking'): CanvasFrame {
  const source = snapshot.sourceCandidate ?? snapshot.candidate;
  const sourceOrigins = snapshot.candidateOrigins ?? [...source].map((_, index) => index);
  const isRemoval = algorithm === 'bfs' && snapshot.operation === 'remove';
  const originFocusIndex = snapshot.scanIndex === undefined ? undefined : sourceOrigins[snapshot.scanIndex];
  const inputVisitedOrigins = algorithm === 'backtracking' ? snapshot.pathOrigins : sourceOrigins.slice(0, Math.max(originFocusIndex ?? 0, 0));
  const nodes: CanvasNode[] = [{
    id: 'input-row-label', label: '原输入', x: 600, y: 52, radius: 0,
    badge: '', sublabel: '', status: 'idle'
  }, ...rowNodes({
    id: 'input-char', value: input, y: 125,
    focusedIndex: originFocusIndex,
    visitedOrigins: inputVisitedOrigins,
    status: isRemoval ? 'error' : algorithm === 'backtracking' || snapshot.scanIndex !== undefined ? 'compare' : 'visited',
    label: '原输入',
    badgeAtIndex: (index) => `原${index}`,
    showLabels: false
  })];
  const activeStatus = snapshot.focusStatus === 'error' ? 'error' : isRemoval ? 'compare' : snapshot.focusStatus;
  const focusedCandidateIndex = snapshot.focus.startsWith('candidate-char-')
    ? Number(snapshot.focus.slice('candidate-char-'.length))
    : snapshot.scanIndex !== undefined ? snapshot.scanIndex
      : algorithm === 'bfs' && (snapshot.operation === 'init' || snapshot.operation === 'dequeue') ? 0 : undefined;

  nodes.push({
    id: 'active-row-label', label: isRemoval ? '将要删除的原候选' : algorithm === 'bfs' ? '当前检查候选' : '正在处理的字符',
    x: 600, y: 226, radius: 0, badge: '', sublabel: '', status: 'idle'
  }, ...rowNodes({
    id: 'active-char', value: source, y: 292, origins: sourceOrigins,
    focusedIndex: focusedCandidateIndex,
    visitedOrigins: algorithm === 'backtracking' ? snapshot.pathOrigins : undefined,
    status: activeStatus,
    label: isRemoval ? '待删除原候选' : algorithm === 'bfs' ? '当前候选' : '当前输入 · 逐位决策',
    badgeAtIndex: (index) => snapshot.candidateOrigins ? `原${snapshot.candidateOrigins[index]}` : undefined,
    showLabels: isRemoval || algorithm === 'backtracking' || snapshot.scanIndex !== undefined,
    detailAtFocus: () => isRemoval ? '将删除' : `余额 ${snapshot.balance ?? 0}`
  }));

  if (isRemoval) {
    nodes.push({
      id: 'result-row-label', label: '删除后的新候选', x: 600, y: 374, radius: 0,
      badge: '', sublabel: '', status: 'idle'
    }, ...rowNodes({
      id: 'result-char', value: snapshot.nextCandidate ?? snapshot.candidate,
      y: 442, origins: snapshot.nextOrigins, focusedIndex: snapshot.scanIndex,
      status: 'done', detailAtFocus: () => '保留下来',
      label: '删除后候选'
    }));
  }

  if (algorithm === 'backtracking') {
    const origins = snapshot.pathOrigins ?? [];
    const path = snapshot.path ?? '';
    nodes.push({
      id: 'path-row-label', label: '当前构造出的有效前缀', x: 600, y: 382, radius: 0,
      badge: '', sublabel: '', status: 'idle'
    }, ...rowNodes({
      id: 'path-char', value: path || 'ε', y: 426, origins: path ? origins : undefined,
      label: path ? '已保留' : '还没有字符'
    }));
  }

  const visibleCandidates = algorithm === 'bfs' ? snapshot.queue.slice(0, 8) : [];
  const queueLayout = createQueue({
    id: 'bfs-queue', x: 142, y: isRemoval ? 560 : 475, capacity: 8,
    width: 624, height: 104, slotWidth: 76,
    title: `待检查候选 · 删除 ${snapshot.level} 层`,
    items: visibleCandidates.map((value) => ({
      id: `candidate:${value}`, label: candidateSummary(value),
      status: 'idle', sublabel: `删除 ${snapshot.level} 个`
    }))
  });
  const queueNodes = queueLayout.nodes.map((node, index) => ({
    ...node, badge: index === 0 ? '首' : String(index), status: node.status
  } as CanvasNode));
  const answerNodes = snapshot.answers.slice(0, 3).map((answer, index) => ({
    id: `answer-${index}-${encodeURIComponent(answer)}`, label: candidateSummary(answer),
    x: 945, y: 600 + index * 64, radius: 26, badge: `解${index + 1}`,
    sublabel: `有效 · 删 ${snapshot.level}`, status: 'done' as const
  }));
  nodes.push(...queueNodes, ...answerNodes);
  if (algorithm === 'bfs') nodes.push({
    id: 'queue-row-label', label: '待检查候选（先进先出）', x: 450, y: isRemoval ? 535 : 450,
    radius: 0, badge: '', sublabel: '', status: 'idle'
  });

  const labels: CanvasLabel[] = [];

  return {
    nodes,
    edges: [],
    arrows: [],
    containers: algorithm === 'bfs' ? queueLayout.containers : [],
    labels,
    notes: algorithm === 'bfs'
      ? isRemoval
        ? [`删去原输入下标 ${sourceOrigins[snapshot.scanIndex ?? 0] ?? snapshot.scanIndex ?? 0}`, '下方候选保留剩余字符的原输入下标']
        : ['上排是原输入，下排是当前候选；角标表示原输入下标', `已发现 ${snapshot.visited.length} 个不同候选`]
      : [`正在处理原输入下标 ${(snapshot.scanIndex ?? 0) + 1} / ${input.length}`, '下方路径显示已保留的原输入字符'],
    metrics: algorithm === 'bfs' ? [
      { label: '删除层', value: snapshot.level },
      { label: '待检查', value: snapshot.queue.length },
      { label: '有效结果', value: snapshot.answers.length }
    ] : [
      { label: '最少删除', value: snapshot.level },
      { label: '未配对左括号', value: snapshot.balance ?? 0 },
      { label: '剩余删除预算', value: (snapshot.leftRemaining ?? 0) + (snapshot.rightRemaining ?? 0) }
    ]
  };
}

const languageTemplates: Record<Language, { code: string; anchors: Record<string, number[]> }> = {
  java: { code: `class Solution {\n  public List<String> removeInvalidParentheses(String s) {\n    // anchor:init\n    Queue<String> queue = new ArrayDeque<>();\n    Set<String> visited = new HashSet<>();\n    // anchor:dequeue\n    while (!queue.isEmpty()) {\n      int size = queue.size();\n      // anchor:validate\n      for (int i = 0; i < size; i++) {\n        String cur = queue.poll();\n        if (isValid(cur)) answers.add(cur);\n        // anchor:generate\n        for (int j = 0; j < cur.length(); j++) {\n          if (isParen(cur.charAt(j))) enqueueIfNew(cur, j);\n        }\n      }\n      // anchor:collect\n      if (!answers.isEmpty()) return answers;\n    }\n    return answers;\n  }\n}`, anchors: { init: [3, 4], count: [3, 4], dequeue: [6, 7], validate: [9, 10], generate: [12, 13], collect: [16], search: [12, 13] } },
  python: { code: `class Solution:\n    def removeInvalidParentheses(self, s):\n        # anchor:init\n        queue, visited = deque([s]), {s}\n        answers = []\n        # anchor:dequeue\n        while queue:\n            for _ in range(len(queue)):\n                cur = queue.popleft()\n                # anchor:validate\n                if is_valid(cur): answers.append(cur)\n                # anchor:generate\n                for i, ch in enumerate(cur):\n                    if ch in '()': enqueue_if_new(cur, i)\n            # anchor:collect\n            if answers: return answers\n        return answers`, anchors: { init: [2, 3, 4], count: [2, 3], dequeue: [5, 6], validate: [8, 9], generate: [10, 11], collect: [13], search: [10, 11] } },
  go: { code: `func removeInvalidParentheses(s string) []string {\n    // anchor:init\n    queue, visited := []string{s}, map[string]bool{s:true}\n    answers := []string{}\n    // anchor:dequeue\n    for len(queue) > 0 {\n        size := len(queue)\n        // anchor:validate\n        for i := 0; i < size; i++ {\n            cur := popFront(&queue)\n            if isValid(cur) { answers = append(answers, cur) }\n            // anchor:generate\n            for j := range cur { enqueueIfNew(cur, j) }\n        }\n        // anchor:collect\n        if len(answers) > 0 { return answers }\n    }\n    return answers\n}`, anchors: { init: [1, 2, 3], count: [1, 2], dequeue: [5, 6], validate: [8, 9, 10], generate: [11, 12], collect: [14], search: [11, 12] } },
  javascript: { code: `function removeInvalidParentheses(s) {\n  // anchor:init\n  let queue = [s], visited = new Set([s]);\n  const answers = [];\n  // anchor:dequeue\n  while (queue.length) {\n    const size = queue.length;\n    // anchor:validate\n    for (let n = 0; n < size; n++) {\n      const cur = queue.shift();\n      if (isValid(cur)) answers.push(cur);\n      // anchor:generate\n      for (let i = 0; i < cur.length; i++) enqueueIfNew(cur, i);\n    }\n    // anchor:collect\n    if (answers.length) return answers;\n  }\n  return answers;\n}`, anchors: { init: [2, 3, 4], count: [2, 3], dequeue: [5, 6], validate: [8, 9, 10], generate: [11, 12], collect: [14], search: [11, 12] } }
};

const backtrackingLanguageTemplates: Record<Language, { code: string; anchors: Record<string, number[]> }> = {
  java: {
    code: `void dfs(String s, int i, StringBuilder path, int balance, int left, int right) {
  // anchor:search
  if (i == s.length()) {
    // anchor:collect
    if (left == 0 && right == 0 && balance == 0) answers.add(path.toString());
    return;
  }
  char ch = s.charAt(i);
  // anchor:remove
  if (ch == '(' && left > 0) dfs(s, i + 1, path, balance, left - 1, right);
  // anchor:keep
  if (ch != ')' || balance > 0) {
    path.append(ch);
    dfs(s, i + 1, path, balance + (ch == '(' ? 1 : -1), left, right);
    path.deleteCharAt(path.length() - 1); // 回溯撤销选择
  }
}`,
    anchors: { count: [1], search: [2, 3, 4, 8], remove: [9, 10], keep: [11, 12, 13, 14, 15, 16], collect: [4], validate: [2, 3, 4], generate: [9, 10] }
  },
  python: {
    code: `def dfs(i, path, balance, left, right):
    # anchor:search
    if i == len(s):
        # anchor:collect
        if left == right == balance == 0: answers.add(path)
        return
    ch = s[i]
    # anchor:remove
    if ch == '(' and left: dfs(i + 1, path, balance, left - 1, right)
    if ch == ')' and right:
        dfs(i + 1, path, balance, left, right - 1)
    # anchor:keep
    if ch != ')' or balance:
        dfs(i + 1, path + ch, balance + (1 if ch == '(' else -1), left, right)
# 回溯：每次递归返回即撤销本次选择`,
    anchors: { search: [1, 2, 3, 6], remove: [7, 8, 9], keep: [10, 11], collect: [4], count: [1], validate: [2, 3, 4], generate: [7, 8, 9] }
  },
  go: {
    code: `func dfs(i, balance, left, right int, path string) {
    // anchor:search
    if i == len(s) {
        // anchor:collect
        if left == 0 && right == 0 && balance == 0 { answers[path] = true }
        return
    }
    ch := s[i]
    // anchor:remove
    if ch == '(' && left > 0 { dfs(i+1, balance, left-1, right, path) }
    if ch == ')' && right > 0 { dfs(i+1, balance, left, right-1, path) }
    // anchor:keep
    if ch != ')' || balance > 0 {
        next := balance
        if ch == '(' { next++ } else { next-- }
        dfs(i+1, next, left, right, path+string(ch))
    }
}`,
    anchors: { search: [1, 2, 3, 6], remove: [7, 8, 9], keep: [10, 11, 12, 13, 14, 15], collect: [4], count: [1], validate: [2, 3, 4], generate: [7, 8, 9] }
  },
  javascript: {
    code: `function dfs(i, path, balance, left, right) {
  // anchor:search
  if (i === s.length) {
    // anchor:collect
    if (left === 0 && right === 0 && balance === 0) answers.add(path);
    return;
  }
  const ch = s[i];
  // anchor:remove
  if (ch === '(' && left > 0) dfs(i + 1, path, balance, left - 1, right);
  if (ch === ')' && right > 0) dfs(i + 1, path, balance, left, right - 1);
  // anchor:keep
  if (ch !== ')' || balance > 0) {
    dfs(i + 1, path + ch, balance + (ch === '(' ? 1 : -1), left, right);
  }
}`,
    anchors: { search: [1, 2, 3, 6], remove: [7, 8, 9, 10], keep: [11, 12, 13], collect: [4], count: [1], validate: [2, 3, 4], generate: [7, 8, 9, 10] }
  }
};

function codeArtifacts(algorithm: 'bfs' | 'backtracking'): Record<Language, CodeArtifact> {
  const templates = algorithm === 'bfs' ? languageTemplates : backtrackingLanguageTemplates;
  return Object.fromEntries(Object.entries(templates).map(([language, value]) => [language, {
    language, code: value.code, anchorLineMap: value.anchors
  }])) as Record<Language, CodeArtifact>;
}

function definition(algorithm: 'bfs' | 'backtracking'): ProblemSolution {
  const isBfs = algorithm === 'bfs';
  const samples = [
    { id: 's1', label: '样例 1', value: '"()())()"' },
    { id: 's2', label: '样例 2', value: '"(a)())()"' },
    { id: 's3', label: '样例 3', value: '")( "'.replace(/ /g, '') }
  ];
  const stepsFor = (input: string): AlgorithmStep[] => {
    const snapshots = isBfs ? buildBfsSnapshots(input) : buildBacktrackingSnapshots(input);
    return snapshots.map((snapshot, id) => ({
      id, title: snapshot.title, description: snapshot.narration, narration: snapshot.narration,
      operation: snapshot.operation,
      binding: {
        anchorIds: [snapshot.line],
        variables: isBfs ? {
          candidate: snapshot.candidate || '""',
          sourceCandidate: snapshot.sourceCandidate ?? '',
          deletionLevel: snapshot.level,
          removedIndex: snapshot.scanIndex ?? -1,
          frontier: snapshot.queue.length,
          answers: snapshot.answers.length
        } : {
          path: snapshot.path ?? '',
          removedIndex: snapshot.scanIndex ?? -1,
          leftRemaining: snapshot.leftRemaining ?? 0,
          rightRemaining: snapshot.rightRemaining ?? 0,
          balance: snapshot.balance ?? 0,
          answers: snapshot.answers.length
        }
      },
      frame: frameFor(snapshot, input, algorithm)
    }));
  };
  const fallback = '()())()';
  return {
    id: algorithm,
    name: isBfs ? 'BFS 最少删除' : '回溯 + 删除预算',
    thought: isBfs
      ? '按删除括号的数量逐层搜索：每一层只检查相同删除数的字符串。某层一旦出现有效括号串，就收集该层全部答案并停止；因此保证删除数量最少。使用 visited 去重，生成时只删除括号，字母始终保留。时间复杂度最坏 O(n·2^n)，空间复杂度 O(2^n)。'
      : '先统计必须删除的多余左、右括号，再用 DFS 决定每个括号保留或删除。只在删除预算耗尽、前缀余额从未为负且最终归零时收集答案，并跳过连续重复括号以去重。最坏时间 O(2^n)，空间 O(n)（不计输出）。',
    samples,
    codes: codeArtifacts(algorithm),
    steps: stepsFor(fallback),
    validateInput: inputValidator,
    generateRandom: () => JSON.stringify(Array.from({ length: 7 }, () => {
      const choices = ['(', ')', 'a', 'b'];
      return choices[Math.floor(Math.random() * choices.length)];
    }).join('')),
    solve: solveBfs,
    buildSteps: stepsFor
  };
}

export function createSolutionRegistry(): ProblemSolution[] {
  return [definition('bfs'), definition('backtracking')];
}
