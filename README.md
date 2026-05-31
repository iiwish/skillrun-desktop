# SkillRun Desktop

SkillRun Desktop 是 [SkillRun](https://github.com/iiwish/skillrun) 的桌面端消费者控制平面（consumer control plane），采用 **tray-first** 设计，让用户可以通过图形界面管理 Skill Capsule 的导入、挂载、运行和状态查看。

## 与 SkillRun 的关系

- **[SkillRun](https://github.com/iiwish/skillrun)**（`/Users/iiwish/self/skillrun`）是核心 Rust CLI / 运行时，负责 Skill Capsule 的构建、检查、打包、执行和 MCP 暴露。
- **SkillRun Desktop**（本项目）是 SkillRun 的桌面端封装。Desktop 不直接操作 `.skillrun/` 内部文件或解析 Manifest，而是将 `skillrun` CLI 作为唯一的 Core API 来调用（`skillrun <command> --json`），通过解析其 stdout JSON 来驱动 UI。

## 技术栈

- **前端**：React + Vite + TypeScript
- **桌面框架**：Tauri v2（Rust）
- **运行时依赖**：`skillrun` CLI

## 快速开始

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装本地 skillrun CLI

开发时建议使用与本地 Core 仓库对应的 CLI 版本：

```bash
SKILLRUN_CORE_PATH=/Users/iiwish/self/skillrun npm run skillrun:install-local
```

该命令会编译并安装 `skillrun` 二进制文件到 `~/.cargo/bin/`。

### 3. 启动开发模式

```bash
# 同时启动 Vite 前端 dev server 和 Tauri 桌面窗口
npm run tauri dev
```

前端 dev server 默认运行在 `http://localhost:1420`，Tauri 会自动唤起桌面窗口。

如果只想启动前端（不启动 Tauri 桌面壳）：

```bash
npm run dev
```

### 4. 构建生产包

```bash
npm run tauri build
```

## CLI

SkillRun Desktop 依赖的 CLI 就是 **`skillrun`**。常用命令：

```bash
skillrun --version              # 查看版本
skillrun doctor --json          # 检查环境状态
skillrun consumer inventory --json      # 查看已导入的 capsules
skillrun consumer exposure --json       # 查看 MCP 暴露状态
```

Desktop 内部通过子进程调用这些命令并消费 JSON 输出来驱动界面。
