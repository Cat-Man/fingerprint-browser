# fingerprint-browser System Design

> Last updated: 2026-03-13

## 1. 设计目标

本系统采用“Manager App + Runtime Adapter + Native Runtime”三层结构，目标是在不锁死底层实现的前提下，先把上层控制面与领域模型做稳定。

设计重点：

- UI 与真实浏览器进程解耦
- 先通过纯 TypeScript 逻辑验证领域模型
- 后续可平滑替换为 Tauri / Rust / Chromium 实现

## 2. 总体架构

```text
┌──────────────────────────────┐
│ Manager App (React / Tauri)  │
│ - Dashboard                  │
│ - Profiles                   │
│ - Settings                   │
└──────────────┬───────────────┘
               │
               │ uses
               ▼
┌──────────────────────────────┐
│ Application Services         │
│ - Profile Storage Adapter    │
│ - Instance Lifecycle Manager │
│ - Runtime Adapter            │
│ - Automation Bridge          │
└──────────────┬───────────────┘
               │
               │ executes / resolves
               ▼
┌──────────────────────────────┐
│ Native Runtime (planned)     │
│ - Chromium launcher          │
│ - Process supervisor         │
│ - CDP / Playwright bridge    │
│ - Runtime logs               │
└──────────────────────────────┘
```

## 3. 当前代码结构映射

### 前端入口
- `src/App.tsx`
- `src/App.css`

### Desktop bridge
- `src/lib/desktop.ts`

### Profile 模块
- `src/features/profiles/storage.ts`
- `src/features/profiles/ProfilesPage.tsx`

### Runtime 模块
- `src/features/runtime/manager.ts`
- `src/features/runtime/index.ts`

### Automation 模块
- `src/features/automation/index.ts`

### Native Desktop Host
- `src-tauri/`

## 4. 核心模块职责

### 4.1 Manager App

负责用户交互、页面编排、配置录入和运行状态可视化。

不负责：
- 直接拼接复杂浏览器启动参数
- 直接管理真实浏览器进程生命周期
- 直接实现检测逻辑细节

### 4.2 Profile Storage Adapter

负责 Profile 数据的读写、默认值填充、兼容旧数据。

当前实现：
- `localStorage` JSON 持久化

后续目标：
- 切换到 Tauri 文件存储或 SQLite

### 4.3 Instance Lifecycle Manager

负责实例的抽象生命周期：

- 启动 / 停止 / 重启
- 调试端口分配
- profile lock
- 运行日志摘要
- UI 展示所需的轻量状态

当前实现：
- `sessionStorage` 模拟运行态

后续目标：
- 替换为真实浏览器守护进程与 process handle

### 4.4 Runtime Adapter

负责把 profile 转换为浏览器可执行配置：

- 统一 `FingerprintConfig`
- Chromium 启动参数生成
- Playwright / CDP 所需连接元数据

该层是 Manager 与 Native Runtime 的关键边界。

### 4.5 Automation Bridge

负责为自动化框架暴露统一连接入口，例如：

- ws endpoint
- remote debugging port
- 未来的 attach / reconnect 信息

## 5. 关键数据流

### 5.1 应用启动
1. React App 启动
2. `loadDesktopOverview()` 检查当前是否运行在 Tauri 环境
3. Dashboard 展示桥接状态

### 5.2 Profile CRUD
1. 用户在 `ProfilesPage` 填写表单
2. Profile 通过 `storage.ts` 归一化
3. 数据写入本地存储
4. 页面重载后重新 hydrate

### 5.3 实例启动（当前）
1. 用户点击 Start
2. `runtime/manager.ts` 分配调试端口
3. 检查是否存在 running 状态实例，防止重复启动
4. 生成 ws endpoint 合同面
5. 将运行态保存到 `sessionStorage`
6. UI 展示状态、端口、日志

### 5.4 实例启动（目标）
1. 用户点击 Start
2. Runtime Adapter 生成 `LaunchPlan`
3. Native Runtime 接收 `LaunchPlan`
4. 启动 Chromium / patched runtime
5. 返回真实 `processId`、`debugPort`、`wsEndpoint`
6. Lifecycle Manager 同步 UI 状态

## 6. 领域模型

### BrowserProfile
- profile 基础身份
- 代理配置
- 指纹配置
- 标签、备注、创建更新时间

### BrowserInstance
- 实例状态
- 调试端口
- wsEndpoint
- 日志
- 错误摘要

### FingerprintConfig（planned）
- userAgent
- language / locale
- timezone
- resolution
- WebRTC policy
- 未来扩展：WebGL / Canvas / Audio / fonts 等

### LaunchPlan（planned）
- adapterId
- fingerprint config
- Chromium args
- 环境变量
- profile data dir / runtime metadata

## 7. 关键设计决策

### 决策 A：先用前端适配层推进
原因：
- 当前本地环境缺少 Rust / cargo 验证条件
- 先把领域接口跑通，更利于后续替换底层实现

### 决策 B：Manager 不直接依赖 Chromium 启动细节
原因：
- 避免 UI 层和浏览器启动参数耦合
- 后续替换底层实现成本更低

### 决策 C：先稳定 contract，再接真实 runtime
原因：
- 可以优先推进测试
- 更适合开源协作和模块拆分

## 8. 当前技术债

截至 2026-03-13，系统仍有以下技术债：

- `README.md` 仍是 Vite 模板，未更新为项目说明
- runtime manager 仍是 session-backed mock，不是原生进程管理
- Playwright endpoint 目前是“合同面”，并非真实连接
- Dashboard 中 running instances 仍未接真实运行态统计
- Runtime Adapter 尚未正式落地到代码主线

## 9. 下一步实现顺序

建议按以下顺序继续：

1. 交付 issue `#5`：Runtime Adapter
2. 将 Lifecycle Manager 与 Runtime Adapter 接通
3. 接入真实 Chromium / native launcher
4. 交付 issue `#6`：检测实验室与回归流程

## 10. 相关文档

- `docs/product/mvp-prd.md`
- `docs/architecture/runtime-contract.md`
- `docs/plans/2026-03-12-instance-lifecycle.md`
- `docs/plans/2026-03-12-runtime-adapter.md`
