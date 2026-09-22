# AtomForge · Atoms

一句话生成可交互网页应用、对话式修改、版本保存与恢复的 AI 生成工作台。本仓库是 AtomForge 迁移到 **Atoms 平台** 后的实现，模型推理统一走 **Atoms AIHub**。

- 源码仓库：https://github.com/BingzhenLiu/AtomsLike
- 在线体验：https://0kwcig.pub.atoms.world

## 它解决什么问题

把「描述需求 → Agent 生成 → 网页预览 → 对话修改 → 版本保存与恢复」这条链路做完整：你写一句话，它给出方案，你批准后生成一个真实可交互的单文件网页应用；不满意就继续用自然语言修改，每次修改都会留下可回滚的版本。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 方案闸门 | 首次生成前先出方案（目标 / 功能 / 非目标 / 假设 / 待确认项），批准后才进入构建 |
| 四阶段生成 | Planner → Designer → Engineer → Reviewer，每阶段状态在时间线上实时可见 |
| 真实可交互产物 | 生成结果为完整单文件 HTML（内联 CSS/JS），不是截图或静态骨架 |
| 对话式修改 | 基于当前版本继续提出修改要求，直接产出新版本 |
| 版本保存与回滚 | 每个版本单独留存，可随时切回任意历史版本 |
| 刷新恢复 | 工作区状态持久化到浏览器 localStorage，刷新后继续 |
| 失败保留 | 生成失败时保留上一个可用版本，并可直接重试（修订失败重试的是修订，不是首次生成） |
| Demo Mode | 未登录或模型不可用时，用内置配方完整演示端到端流程 |

## 技术栈

| 层 | 选型 |
| --- | --- |
| 构建 | Vite 5 + TypeScript 5 |
| UI | React 18 + shadcn/ui + Tailwind CSS 3 |
| 状态 | `useReducer` 状态机 + 自定义 Hook + localStorage 持久化 |
| AI | Atoms Web SDK `client.ai.gentxt`（Atoms AIHub，非流式） |
| 预览安全 | sandbox iframe + CSP 注入 + 生成 HTML 结构校验 |

## 架构

生成被拆成两段，中间隔一道人工闸门：

```
用户输入需求
   │
   ├─ Planner ──────────► 方案卡片（目标/功能/非目标/假设/待确认）
   │                          │
   │                    用户批准 / 要求重新规划
   │                          ▼
   └─ Designer → Engineer → Reviewer → 预览 + 代码 + 版本
```

- 状态层：所有工作区变更统一经由 reducer action，组件不直接改写状态。
- AI 层：阶段调用统一走 `workflow.ts`，AIHub 调用统一走 `runtime.ts`。
- 结果层：任何进入预览的 HTML 必须先通过 `validate-html` 与 `harden-html`。
- UI 层：组件只消费 Hook 暴露的状态与回调，展示与逻辑分离。

### 目录结构

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
app/backend/                    # Atoms Cloud 后端（AIHub 代理与平台能力）
```

## 预览安全

生成的页面运行在受限 `sandbox` iframe 中，只开放脚本、表单和模态框能力，不开放同源权限：

- 注入严格 CSP：`default-src 'none'`、`connect-src 'none'`、禁 `object` / `frame` / `form-action`。
- 生成结果中禁止外部脚本、外部样式表、`fetch` / `XHR` / `WebSocket`、模块导入、嵌套 `iframe`、`object` / `embed`、`meta refresh` 自动跳转。
- 进入预览前校验文档完整性与大小上限，并检查标签闭合。

## Demo Mode

未登录 Atoms 账号，或模型暂时不可用时，工作台切换到 Demo Mode：使用内置配方（个人记账、番茄钟、习惯打卡）走同一套阶段时间线与结果面板，不调用模型也能完整演示「输入 → 方案 → 构建 → 预览 → 修改 → 版本」。

## 本地运行

```bash
cd app/frontend

pnpm install
pnpm run dev        # 本地开发
pnpm run build      # 生产构建
```

### 质量命令

```bash
pnpm run lint        # ESLint
pnpm run typecheck   # TypeScript 严格检查
pnpm run test        # 单元测试（状态机 / 解析层 / 预览安全）
pnpm run build       # 生产构建
```

## 已知限制

- 产物是单文件 HTML；不支持多文件工程、`npm` 在线安装或 Monaco 编辑器。
- 工作区数据保存在浏览器本地，不含账号体系、云数据库与多人协作。
- 预览运行在受限沙箱内，生成页面无法访问网络、外部资源或父页面。

## 验证结果

- `pnpm run lint`、`pnpm run typecheck`、`pnpm run test`、`pnpm run build` 全部通过。
- 测试规模：5 个测试文件 / 39 项测试，覆盖：
  - 工作区状态机：方案审批、构建、修订重试、版本切换与重置；
  - 解析层：结构化输出提取、字段归一化与损坏输出容错；
  - 预览安全：文档结构校验、危险能力拦截、大小上限与 CSP 加固；
  - 工作流：方案前置闸门、完整四阶段链路、JSON 修复重试、鉴权与供应商错误归一化；
  - 工作台交互：批准后推进时间线、重新规划、二次修改产出 v2、失败重试恢复、Demo 模式端到端。
- 生产构建产物为 `app/frontend/dist`，可直接作为静态站点部署，无服务端依赖。

## 仓库范围

仓库仅包含产品源码与文档。内部交接资料、用户上传素材与本地环境文件不会进入版本库。
