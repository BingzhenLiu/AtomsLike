# AtomForge Frontend

AtomForge 工作台前端：一句话生成可交互网页应用、对话式修改、版本保存与恢复。技术栈为 Vite 5 + React 18 + TypeScript 5 + shadcn/ui + Tailwind CSS 3，模型推理通过 Atoms Web SDK 调用 Atoms AIHub。

## 目录结构

- `index.html` — HTML 入口（`data-mgx-overview` 标记的标题 / 描述 / logo 由平台维护，请勿改动）
- `src/main.tsx` — 运行时配置加载与 React 挂载
- `src/App.tsx` — 路由、认证回调与全局 Provider
- `src/pages/Index.tsx` — 工作台入口（`/`）
- `src/components/workspace/` — 工作台 UI 组件（对话区、Agent 时间线、方案卡片、结果面板、版本历史、外壳）
- `src/hooks/use-workspace.ts` — 工作区编排 Hook（生成、修订、失败恢复与重试）
- `src/lib/ai/` — 阶段定义、模型映射、提示词、结构化解析、AIHub 运行时与工作流编排
- `src/lib/projects/` — 工作区类型、reducer 状态机、选择器与 localStorage 持久化
- `src/lib/preview/` — 生成 HTML 校验与 CSP 加固
- `DESIGN.md` — 深色工作台的视觉与交互规范
- `vitest.config.ts` — 测试环境与路径别名配置

`@/` 别名指向 `src/`。

## 命令

```bash
pnpm install

pnpm run dev        # 本地开发
pnpm run lint       # ESLint
pnpm run typecheck  # TypeScript 严格检查（tsconfig.app.json）
pnpm run test       # 单元与交互测试（Vitest + Testing Library）
pnpm run build      # 生产构建
```

## 约定

- 工作区状态只能通过 reducer action 变更，组件不直接改写状态。
- 阶段调用统一走 `lib/ai/workflow.ts`，AIHub 调用统一走 `lib/ai/runtime.ts`；新增阶段需同步 `stages.ts` 与 `prompt.ts`。
- 任何进入预览的 HTML 必须先通过 `validate-html` 与 `harden-html`。
- 组件只消费 Hook 暴露的状态与回调，保持展示与逻辑分离。
