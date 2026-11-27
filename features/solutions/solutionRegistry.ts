import type {
  AlgorithmStep,
  CanvasFrame,
  CanvasNode,
  CodeArtifact,
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
  let level = 0;
  snapshots.push({
    operation: 'init', title: '从原串开始',
    narration: `把原字符串「${input}」放入 BFS 队列；从删除 0 个括号的层开始，按删除数递增搜索。`,
    line: 'init', candidate: input, level, queue: [...queue], visited: [...visited], answers: [], focus: `candidate:${input}`, focusStatus: 'current'
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
        narration: `从队首取出「${candidate || '空串'}」检查；FIFO 保证先处理删除数更少的候选。`,
        line: 'dequeue', candidate, level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: candidateId, focusStatus: 'current', arrowText: `dequeue ${candidate || '空串'}`
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
          operation: 'read', title: `扫描位置 ${index} · 余额 ${balance}`,
          narration: candidate[index] === '('
            ? `读到「(」后未匹配左括号数变为 ${balance}；余额代表后续还需要多少个右括号配对。`
            : candidate[index] === ')'
              ? `读到「)」后余额降为 ${balance}；只要前缀余额不为负，右括号就有左括号可配对。`
              : `读到字母「${candidate[index]}」；字母不改变括号余额，也永远不会被删除。`,
          line: 'validate', candidate, level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
        });
      }
      const valid = invalidAt < 0 && balance === 0;
      if (invalidAt >= 0) {
        snapshots.push({
          operation: 'visit', title: `前缀失衡 · 位置 ${invalidAt}`,
          narration: `位置 ${invalidAt} 的右括号使余额变成 ${balance}，前面没有可配对的左括号；这个候选必须删除多余右括号。`,
          line: 'validate', candidate, level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: `char-${invalidAt}`, focusStatus: 'error', scanIndex: invalidAt, balance
        });
      } else {
        snapshots.push({
          operation: valid ? 'match' : 'visit', title: valid ? '候选有效' : '仍有左括号未配对',
          narration: valid
            ? `扫描「${candidate || '空串'}」后余额始终非负且归零，因此它是本层的有效结果。`
            : `扫描完整个「${candidate}」后余额仍为 ${balance}，表示还有 ${balance} 个左括号未配对，因此候选无效。`,
          line: 'validate', candidate, level, queue: [...queue], visited: [...visited], answers: [...validAtLevel, ...(valid ? [candidate] : [])], focus: candidateId, focusStatus: valid ? 'done' : 'error', balance
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
        queue.push(next);
        snapshots.push({
          operation: 'remove', title: `删除位置 ${i} 的括号`,
          narration: `移除「${candidate}」中位置 ${i} 的「${char}」得到「${next || '空串'}」；字母保留，重复候选只入队一次。`,
          line: 'generate', candidate: next, level, queue: [...queue], visited: [...visited], answers: [...validAtLevel], focus: `candidate:${next}`, focusStatus: 'current', scanIndex: i, arrowText: `enqueue ${next || '空串'}`
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
  const record = (snapshot: SearchSnapshot, state?: { path: string; leftRemaining: number; rightRemaining: number }) => {
    if (snapshots.length < maxTraceSteps) {
      snapshots.push(state ? {
        ...snapshot,
        candidate: state.path,
        path: state.path,
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
  }, { path: '', leftRemaining: leftToRemove, rightRemaining: rightToRemove });

  const search = (index: number, path: string, balance: number, leftRemaining: number, rightRemaining: number) => {
    if (index === input.length) {
      if (leftRemaining === 0 && rightRemaining === 0 && balance === 0) {
        if (!visited.has(path)) {
          visited.add(path);
          answers.push(path);
          record({
            operation: 'match', title: '找到一个有效结果',
            narration: `路径「${path || '空串'}」用完删除预算且余额归零，因此收录为答案；继续搜索以找齐其它最优解。`,
            line: 'collect', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `candidate:${path}`, focusStatus: 'done', balance
          }, { path, leftRemaining, rightRemaining });
        }
      } else {
        record({
          operation: 'visit', title: '到达末尾但条件未满足',
          narration: `路径「${path || '空串'}」结束时还剩 ${leftRemaining + rightRemaining} 次删除预算或余额为 ${balance}，不能作为有效答案。`,
          line: 'validate', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: index > 0 ? `char-${index - 1}` : 'input', focusStatus: 'error', balance
        }, { path, leftRemaining, rightRemaining });
      }
      return;
    }

    const char = input[index];
    if (char !== '(' && char !== ')') {
      record({
        operation: 'read', title: `保留字母「${char}」`,
        narration: `位置 ${index} 是字母「${char}」而非括号，题目不允许删除它，所以直接接到当前路径后。`,
        line: 'search', candidate: path + char, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
      }, { path: path + char, leftRemaining, rightRemaining });
      search(index + 1, path + char, balance, leftRemaining, rightRemaining);
      return;
    }

    const duplicate = index > 0 && input[index] === input[index - 1];
    if (char === '(' && leftRemaining > 0 && !duplicate) {
      record({
        operation: 'remove', title: `删除位置 ${index} 的左括号`,
        narration: `还需删除 ${leftRemaining} 个左括号；跳过当前位置后预算减一，递归探索这条删除分支。`,
        line: 'search', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
      }, { path, leftRemaining, rightRemaining });
      search(index + 1, path, balance, leftRemaining - 1, rightRemaining);
    } else if (char === ')' && rightRemaining > 0 && !duplicate) {
      record({
        operation: 'remove', title: `删除位置 ${index} 的右括号`,
        narration: `此前没有未匹配左括号可与它配对，因此这是多余右括号；删除后右括号预算减一。`,
        line: 'search', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance
      }, { path, leftRemaining, rightRemaining });
      search(index + 1, path, balance, leftRemaining, rightRemaining - 1);
    }

    if (duplicate) {
      record({
        operation: 'visit', title: '跳过重复删除分支',
        narration: `位置 ${index} 与前一位括号相同；删除任意一个会产生相同子问题，因此只保留第一次删除的分支。`,
        line: 'generate', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'visited', scanIndex: index, balance
      }, { path, leftRemaining, rightRemaining });
    }

    if (char === '(') {
      record({
        operation: 'recurse', title: `保留位置 ${index} 的左括号`,
        narration: `选择保留「(」会让未匹配余额从 ${balance} 增至 ${balance + 1}；递归继续处理下一个字符。`,
        line: 'search', candidate: path + char, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance: balance + 1
      }, { path, leftRemaining, rightRemaining });
      search(index + 1, path + char, balance + 1, leftRemaining, rightRemaining);
    } else if (balance > 0) {
      record({
        operation: 'recurse', title: `配对并保留位置 ${index} 的右括号`,
        narration: `当前余额 ${balance} 大于 0，存在左括号可配对；保留「)」后余额减为 ${balance - 1}。`,
        line: 'search', candidate: path + char, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'compare', scanIndex: index, balance: balance - 1
      }, { path, leftRemaining, rightRemaining });
      search(index + 1, path + char, balance - 1, leftRemaining, rightRemaining);
    } else {
      record({
        operation: 'visit', title: '剪枝：右括号没有可配对项',
        narration: `位置 ${index} 的「)」遇到余额 0；保留它会让前缀余额变成 -1，因此这条分支立即剪枝。`,
        line: 'validate', candidate: path, level: minimumRemovals, queue: [], visited: [...visited], answers: [...answers], focus: `char-${index}`, focusStatus: 'error', scanIndex: index, balance
      }, { path, leftRemaining, rightRemaining });
    }
  };

  search(0, '', 0, leftToRemove, rightToRemove);
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

function frameFor(snapshot: SearchSnapshot, input: string, algorithm: 'bfs' | 'backtracking'): CanvasFrame {
  const chars: CanvasNode[] = [...input].map((char, index) => ({
    id: `char-${index}`, label: char, x: 112 + index * 48, y: 205, radius: 19,
    badge: String(index),
    sublabel: index === snapshot.scanIndex
      ? snapshot.operation === 'remove' ? '将删除' : `余额 ${snapshot.balance ?? 0}`
      : algorithm === 'backtracking' && index < (snapshot.scanIndex ?? -1) ? '已决策' : char === '(' || char === ')' ? '括号' : '保留字母',
    status: snapshot.focus === `char-${index}`
      ? snapshot.focusStatus
      : snapshot.operation === 'remove' && snapshot.scanIndex === index ? 'compare'
        : algorithm === 'backtracking' && index < (snapshot.scanIndex ?? -1) ? 'visited' : 'idle'
  }));
  const visibleCandidates = algorithm === 'bfs' ? snapshot.queue.slice(0, 8) : [];
  const queueLayout = createQueue({
    id: 'bfs-queue', x: 142, y: 382, capacity: 8, width: 624, height: 112, slotWidth: 76,
    title: algorithm === 'bfs' ? `BFS 候选队列 · 删除 ${snapshot.level} 层` : 'DFS 当前路径',
    items: visibleCandidates.map((value) => ({
      id: `candidate:${value}`, label: candidateSummary(value),
      status: 'idle', sublabel: `删除 ${snapshot.level} 个`
    }))
  });
  const queueNodes = queueLayout.nodes.map((node, index) => ({
    ...node, badge: index === 0 ? '首' : String(index),
    status: node.status
  } as CanvasNode));
  const answerNodes = snapshot.answers.slice(0, 3).map((answer, index) => ({
    id: `answer-${index}-${encodeURIComponent(answer)}`, label: candidateSummary(answer),
    x: 950, y: 265 + index * 76, radius: 28, badge: `解${index + 1}`,
    sublabel: `有效 · 删 ${snapshot.level}`, status: 'done' as const
  }));
  const currentValue = algorithm === 'backtracking' ? snapshot.path ?? snapshot.candidate : snapshot.candidate;
  const currentCandidate: CanvasNode = {
    id: `candidate:${currentValue}`, label: candidateSummary(currentValue),
    x: 866, y: 506, radius: 36, badge: algorithm === 'backtracking' ? '路径' : '当前',
    sublabel: algorithm === 'backtracking'
      ? `删 L${snapshot.leftRemaining ?? 0}/R${snapshot.rightRemaining ?? 0}`
      : `删除层 ${snapshot.level}`,
    status: snapshot.focus === `candidate:${currentValue}`
      ? snapshot.focusStatus
      : snapshot.operation === 'read' || algorithm === 'backtracking' ? 'current' : 'visited'
  };
  if (snapshot.operation === 'dequeue') {
    const queueFocus = queueNodes.find((node) => node.id === snapshot.focus);
    if (queueFocus) queueFocus.status = 'current';
  }
  const candidateIsQueued = queueNodes.some((node) => node.id === currentCandidate.id);
  const nodes = [
    ...chars,
    ...queueNodes,
    ...answerNodes,
    ...(candidateIsQueued || algorithm === 'backtracking' ? [] : [currentCandidate])
  ];
  const focus = nodes.find((node) => node.id === snapshot.focus);
  const arrows = snapshot.arrowText ? [{
    id: `flow-${snapshot.operation}-${snapshot.candidate}-${snapshot.queue.length}`,
    from: { x: 785, y: 438 }, to: { x: currentCandidate.x - 42, y: currentCandidate.y - 4 },
    text: snapshot.arrowText, kind: 'transfer' as const, curve: -18, labelOffset: { x: 0, y: -12 }
  }] : [];
  if (focus && snapshot.operation !== 'done' && focus.status === 'idle') {
    focus.status = 'current';
  }
  if (algorithm === 'backtracking') {
    const pathText = snapshot.path || 'ε（空路径）';
    nodes.push({
      id: 'dfs-path', label: candidateSummary(snapshot.path ?? ''), x: 866, y: 506,
      radius: 36, badge: 'DFS', sublabel: `当前前缀：${pathText}`,
      status: 'current'
    });
  }
  return {
    nodes,
    edges: [],
    arrows,
    containers: queueLayout.containers,
    labels: focus ? [{
      id: 'focus-label', targetId: focus.id,
      text: snapshot.operation === 'done' || snapshot.operation === 'match' ? '有效答案' : algorithm === 'backtracking' ? 'DFS 当前决策' : '本步焦点',
      detail: snapshot.operation === 'done' ? '本层全部有效结果' : algorithm === 'backtracking' ? `余额 ${snapshot.balance ?? 0} · 删除预算 L${snapshot.leftRemaining ?? 0}/R${snapshot.rightRemaining ?? 0}` : '按 FIFO 顺序处理',
      position: 'top', variant: 'callout', tone: 'accent'
    }] : [],
    notes: [algorithm === 'bfs' ? '先检查整层，再生成下一层' : '删除预算与余额共同剪枝', `已发现 ${snapshot.visited.length} 个不同候选`],
    metrics: algorithm === 'bfs' ? [
      { label: '删除层', value: snapshot.level },
      { label: '待检查', value: snapshot.queue.length },
      { label: '有效结果', value: snapshot.answers.length }
    ] : [
      { label: '最少删除', value: snapshot.level },
      { label: '未匹配左括号', value: snapshot.balance ?? 0 },
      { label: '剩余预算', value: (snapshot.leftRemaining ?? 0) + (snapshot.rightRemaining ?? 0) }
    ]
  };
}

const languageTemplates: Record<Language, { code: string; anchors: Record<string, number[]> }> = {
  java: { code: `class Solution {\n  public List<String> removeInvalidParentheses(String s) {\n    // anchor:init\n    Queue<String> queue = new ArrayDeque<>();\n    Set<String> visited = new HashSet<>();\n    // anchor:dequeue\n    while (!queue.isEmpty()) {\n      int size = queue.size();\n      // anchor:validate\n      for (int i = 0; i < size; i++) {\n        String cur = queue.poll();\n        if (isValid(cur)) answers.add(cur);\n        // anchor:generate\n        for (int j = 0; j < cur.length(); j++) {\n          if (isParen(cur.charAt(j))) enqueueIfNew(cur, j);\n        }\n      }\n      // anchor:collect\n      if (!answers.isEmpty()) return answers;\n    }\n    return answers;\n  }\n}`, anchors: { init: [3, 4], count: [3, 4], dequeue: [6, 7], validate: [9, 10], generate: [12, 13], collect: [16], search: [12, 13] } },
  python: { code: `class Solution:\n    def removeInvalidParentheses(self, s):\n        # anchor:init\n        queue, visited = deque([s]), {s}\n        answers = []\n        # anchor:dequeue\n        while queue:\n            for _ in range(len(queue)):\n                cur = queue.popleft()\n                # anchor:validate\n                if is_valid(cur): answers.append(cur)\n                # anchor:generate\n                for i, ch in enumerate(cur):\n                    if ch in '()': enqueue_if_new(cur, i)\n            # anchor:collect\n            if answers: return answers\n        return answers`, anchors: { init: [2, 3, 4], count: [2, 3], dequeue: [5, 6], validate: [8, 9], generate: [10, 11], collect: [13], search: [10, 11] } },
  go: { code: `func removeInvalidParentheses(s string) []string {\n    // anchor:init\n    queue, visited := []string{s}, map[string]bool{s:true}\n    answers := []string{}\n    // anchor:dequeue\n    for len(queue) > 0 {\n        size := len(queue)\n        // anchor:validate\n        for i := 0; i < size; i++ {\n            cur := popFront(&queue)\n            if isValid(cur) { answers = append(answers, cur) }\n            // anchor:generate\n            for j := range cur { enqueueIfNew(cur, j) }\n        }\n        // anchor:collect\n        if len(answers) > 0 { return answers }\n    }\n    return answers\n}`, anchors: { init: [1, 2, 3], count: [1, 2], dequeue: [5, 6], validate: [8, 9, 10], generate: [11, 12], collect: [14], search: [11, 12] } },
  javascript: { code: `function removeInvalidParentheses(s) {\n  // anchor:init\n  let queue = [s], visited = new Set([s]);\n  const answers = [];\n  // anchor:dequeue\n  while (queue.length) {\n    const size = queue.length;\n    // anchor:validate\n    for (let n = 0; n < size; n++) {\n      const cur = queue.shift();\n      if (isValid(cur)) answers.push(cur);\n      // anchor:generate\n      for (let i = 0; i < cur.length; i++) enqueueIfNew(cur, i);\n    }\n    // anchor:collect\n    if (answers.length) return answers;\n  }\n  return answers;\n}`, anchors: { init: [2, 3, 4], count: [2, 3], dequeue: [5, 6], validate: [8, 9, 10], generate: [11, 12], collect: [14], search: [11, 12] } }
};

function codeArtifacts(): Record<Language, CodeArtifact> {
  return Object.fromEntries(Object.entries(languageTemplates).map(([language, value]) => [language, {
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
          deletionLevel: snapshot.level,
          frontier: snapshot.queue.length,
          answers: snapshot.answers.length
        } : {
          path: snapshot.path ?? '',
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
    codes: codeArtifacts(),
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
