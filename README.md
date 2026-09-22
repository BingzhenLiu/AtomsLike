# AtomsLike

一个可运行的 Atoms Demo：用智能体驱动生成应用代码，并将生成结果实时渲染为可视化网页。

## 核心主张

别人做「一次生成」，这个项目做 **生成 → 增量修改 → 版本快照 → 回溯 / diff** 的完整闭环。

## 状态

开发中：核心闭环（生成 → 修改 → 版本快照 → 回溯）已实现并测试，待完成部署与真实模型验收。当前进度、实现思路与取舍、后续优先级见 [`docs/说明文档.md`](docs/说明文档.md)。

## 快速开始

要求 Node.js 20.9 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。未配置模型时应用会明确进入 **Demo Mode**，内置示例可以完整演示生成、交互、修改与版本回溯。

- 模型变量（仅服务端读取，禁止 `NEXT_PUBLIC_` 前缀）：`AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`
- 验证：`npm run lint && npm run typecheck && npm run test && npm run build`
- 容器：`docker compose up --build`（podman 用 `podman build --format docker -t atomforge .`）

更多细节见 [`docs/说明文档.md`](docs/说明文档.md)。
