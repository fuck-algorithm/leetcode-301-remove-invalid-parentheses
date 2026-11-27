# 验收报告

## 基本信息

- 题目：LeetCode 301. 删除无效的括号
- 仓库：https://github.com/fuck-algorithm/leetcode-301-remove-invalid-parentheses
- 提交：未提交（本地产物）
- 日期：2026-11-27

## 阶段判定（M0-M4）

- 当前阶段：M4 工程与模板验收通过；算法与动画实现已完成
- 进入下一阶段条件是否满足：是
- 说明：本地质量门禁全绿；仍需针对 AC-023 多种输入随机跳步、3x 和 reduced-motion 完成专门录屏证据后再作完整验收。

## 最终判定模型（B1-B7）

| Gate | 说明 | 结果（PASS/FAIL） | 证据 |
| --- | --- | --- | --- |
| B1 | 一票否决项为 0 | PASS | QA guard、构建及 15 项 E2E 通过；动画采用稳定 keyed join 与固定状态色 |
| B2 | lint/type-check/build/test:coverage/test:e2e 全通过 | PASS | `npm run qa:full` exit 0；覆盖率 lines 79.94%、functions 96.96%、branches 89.39% |
| B3 | Playwright 必过集合（15 条）100% 通过 | PASS | E2E 15/15 |
| B4 | AC-001~AC-023 全部通过 | FAIL | AC-023 的跨帧稳定性、3x/reduced-motion 人工证据尚未完整留存 |
| B5 | P0/P1 缺陷为 0 | PASS | 未发现 P0/P1 |
| B6 | Rubric 综合分 >= 80 | FAIL | AC-023 专项人工体验证据未完成，保守不评分通过 |
| B7 | 证据完整（命令/截图/闭环记录） | FAIL | 尚无 1x 录屏、相邻帧截图及 reduced-motion 截图归档 |

## AC 逐条验收结果（必须逐项填写）

| AC-ID | 结果 | 证据 | 备注 |
| --- | --- | --- | --- |
| AC-001 | PASS | E2E-001 | 1920×1080 与 1366×768 单屏空间门槛通过 |
| AC-002 | PASS | E2E-002 | 题目、Hot100、GitHub 外链新标签 |
| AC-003 | PASS | E2E-003 | 非法输入不更新，合法样例更新 |
| AC-004 | PASS | E2E-004 | 样例及随机数据可用 |
| AC-005 | PASS | E2E-005 | 四语言切换与记忆 |
| AC-006 | PASS | E2E-006 | 代码高亮、变量旁注随步骤变化 |
| AC-007 | PASS | E2E-007 | 快捷键可用 |
| AC-008 | PASS | E2E-008 | 进度条拖拽生效 |
| AC-009 | PASS | E2E-009 | 画布缩放与平移 |
| AC-010 | PASS | E2E-010 | 思路弹窗 |
| AC-011 | PASS | E2E-011 | 两种解法独立步骤并重置 |
| AC-012 | PASS | E2E-012 | 社群二维码浮层比例正确 |
| AC-013 | PASS | E2E-013 | 速度偏好持久化 |
| AC-014 | PASS | E2E-014 | GitHub 星标回退与展示 |
| AC-015 | PASS | E2E-015 | 不含紫色主题 |
| AC-016 | PASS | qa:guard | 工程结构、Pages Action 与模板门禁通过 |
| AC-017 | PASS | lint/type-check/build | 全通过 |
| AC-018 | PASS | docs/ | 七份必需文档齐全 |
| AC-019 | PASS | README.md | 三项精简内容 |
| AC-020 | PASS | unit tests | 新增 feature 配套单测 |
| AC-021 | PASS | test:coverage | 覆盖率门槛满足 |
| AC-022 | PASS | validateInput 单测 | 正负向与随机输入检查 |
| AC-023 | FAIL | ANIMATION_SPEC.md、分镜测试 | 语义帧完整；仍需补充稳定性、reduced-motion 和播放节奏证据 |

## 验收轮次记录（Round N）

| Round | 失败项 | 缺陷等级 | 根因 | 修复动作 | 复测结果 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 测试暴露焦点重复、进度条尾部阈值与 E2E 焦点契约问题 | P2 | 队列候选/当前候选重复表示，测试假定总步数固定附近 | 稳定候选 ID 去重；保留焦点单一；尾部按比例断言 | 单测、15 项 E2E 全通过 | 部分通过，AC-023 专项手工证据未闭环 |

## 质量评分（Rubric）

| 项目 | 分数（0-5） | 备注 |
| --- | --- | --- |
| 首屏信息架构 | 5 | 页面单屏且画布优先 |
| 分镜清晰度 | 4 | BFS 与回溯分别展示关键语义快照 |
| 动效与运动语法 | 4 | 使用模板 D3 keyed join、motion token |
| 代码同步准确性 | 4 | 四语言 anchor 映射 |
| 画布信息密度 | 4 | 字符、队列、答案、指标均展示 |
| 交互可控性 | 5 | 15 项 E2E 全绿 |
| 多解法可比性 | 4 | BFS、回溯独立视图与代码 |
| 稳定性 | 4 | 输入边界、候选去重与覆盖测试通过 |
| 工程发布质量 | 4 | 构建及 Pages workflow 正常 |
| 文档完整性 | 4 | 规格和验收文档齐全 |

- Rubric 估算分：86/100；由于 AC-023 证据尚不完整，不将此估算用作 B6 通过证明。

## 命令结果

```text
npm run qa:guard       PASS
npm run lint           PASS
npm run type-check     PASS
npm run build          PASS
npm run test:coverage  PASS (lines 79.94%, functions 96.96%, branches 89.39%)
npm run test:e2e       PASS (15/15)
```

## 缺陷记录

| ID | 等级 | 描述 | 状态 |
| --- | --- | --- | --- |
| AC23-EVIDENCE | P2 | 尚未归档 1x 录屏、3x 播放检查、随机跳步与 reduced-motion 截图 | 待补验收证据 |

## 豁免项（如有）

- 无

## 最终结论

- `PASS`：B1-B7 全部通过
- `FAIL`：任一 Gate 失败

本次结论：`FAIL`（仅因 AC-023 专项验收证据尚未完整留存；不得宣称完成）
