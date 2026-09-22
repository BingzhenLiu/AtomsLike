---
last_updated: 2026-09-22T08:05:34Z
---

# Architecture Design

## System Overview
AtomForge 是「一句话生成可交互网页应用」的 AI 工作台。用户在左侧对话区输入需求，前端依次编排 Planner（方案拆解）、Designer（视觉与技术方案）、Engineer（生成单文件 HTML/CSS/JS）、Reviewer（质量审查）四个阶段；右侧结果台面提供沙箱预览、代码查看与版本历史。所有推理均通过 Atoms AIHub 完成。

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Build | Vite 5 + TypeScript 5 |
| UI | React 18 + shadcn/ui + Tailwind CSS 3 |
| State | React useReducer + 自定义 Hook + localStorage 持久化 |
| AI | Atoms Web SDK `client.ai.gentxt`（AIHub，非流式） |
| Preview | sandbox iframe + CSP 注入 + 生成 HTML 校验 |

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| 工作区状态 | 工作区/方案/版本/修订状态机、审批、构建、失败重试 | `src/lib/projects/reducer.ts`、`src/lib/projects/types.ts` |
| 状态选择器 | 当前版本、Agent 阶段、忙碌态、进度推导 | `src/lib/projects/selectors.ts` |
| 持久化 | localStorage 恢复、版本迁移、脏数据容错 | `src/lib/projects/local-storage.ts` |
| 工作流编排 | Planner→Designer→Engineer→Reviewer、Demo 回退、JSON 修复重试 | `src/lib/ai/workflow.ts` |
| AIHub 运行时 | `client.ai.gentxt` 调用、超时控制、鉴权与错误归一化 | `src/lib/ai/runtime.ts`、`src/lib/ai/models.ts`、`src/lib/ai/errors.ts` |
| 提示词与解析 | 各阶段系统/用户提示词、结构化 JSON 提取与字段映射 | `src/lib/ai/prompt.ts`、`src/lib/ai/parse.ts` |
| Demo 生成器 | 记账、番茄钟、习惯打卡三套离线配方 | `src/lib/ai/demo-generator.ts` |
| 预览安全 | 生成 HTML 结构校验、CSP 加固 | `src/lib/preview/validate-html.ts`、`src/lib/preview/harden-html.ts` |
| 工作台 UI | 对话区、Agent 时间线、方案卡片、结果面板、版本历史、外壳 | `src/components/workspace/*` |
| 入口 | 工作台页面、路由与全局 Provider | `src/pages/Index.tsx`、`src/App.tsx` |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI 调用位置 | 前端直接调用 `client.ai.gentxt` | SDK 已内置鉴权与 AI Wallet 计费，无需自建代理层；减少一跳延迟与重复实现 |
| 后端使用 | 不新增业务表与路由 | 当前产品无共享数据、多人协作或服务端持久化需求，个人工作区持久化由浏览器承担 |
| 输出格式 | 单文件 HTML（内联 CSS/JS） | 便于沙箱预览、版本快照与回滚，无需构建步骤 |
| 预览隔离 | sandbox iframe + CSP 注入 | 阻断外部脚本、网络请求与父页面导航，保证生成代码不可越权 |
| AI 不可用策略 | Demo Mode 离线配方兜底 | 未登录、余额不足或模型异常时仍可完整演示端到端流程 |

## File Tree Plan
```
app/frontend/src/
├── App.tsx                     # 路由、认证回调、全局 Provider
├── pages/Index.tsx             # 工作台入口
├── components/workspace/       # 工作台 UI 组件
├── hooks/use-workspace.ts      # 工作区编排 Hook
└── lib/
    ├── ai/                     # stages / models / prompt / parse / runtime / workflow / demo
    ├── projects/               # types / reducer / selectors / local-storage
    └── preview/                # validate-html / harden-html
```

## Implementation Guide
1. 状态层：所有工作区变更统一经由 reducer action，禁止在组件内直接改写状态。
2. AI 层：阶段调用一律走 `workflow.ts`，新增阶段需同步 `stages.ts` 与 `prompt.ts`。
3. 结果层：任何进入预览的 HTML 必须先通过 `validate-html` 与 `harden-html`。
4. UI 层：组件仅消费 Hook 暴露的状态与回调，保持展示与逻辑分离。
5. 验证：改动后执行 `pnpm run lint && pnpm run build`。

