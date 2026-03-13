# Runtime Contract

> Last updated: 2026-03-13

## 1. 文档目标

定义 Manager App、Runtime Adapter 与 Native Runtime 之间的稳定契约，使上层 UI 不依赖具体浏览器实现，同时为后续 Tauri / Rust / Chromium 接入提供明确边界。

## 2. 设计原则

- **稳定 contract，高频替换实现**
- **序列化优先**：接口尽量使用可 JSON 序列化的数据结构
- **纯函数优先**：Runtime Adapter 尽量保持纯逻辑，方便测试
- **状态与执行分离**：Manager 维护业务状态；Native Runtime 负责真实执行

## 3. 边界划分

### Manager App 负责
- 读取和维护 `BrowserProfile`
- 发起“启动 / 停止 / 重启”意图
- 展示运行状态和错误信息
- 持久化 profile 和轻量运行态

### Runtime Adapter 负责
- 将 `BrowserProfile` 转换为 `FingerprintConfig`
- 生成面向具体浏览器引擎的 `LaunchPlan`
- 约束不同 runtime 的输入输出结构

### Native Runtime 负责
- 启动 / 停止真实浏览器进程
- 管理调试端口、数据目录、进程句柄
- 返回真实连接信息与错误

## 4. 核心类型

以下类型为建议 contract，作为 issue `#5` 及后续 native runtime 的统一依据。

```ts
export type WebRtcPolicy = "default" | "proxy-only" | "disabled"

export type FingerprintConfig = {
  userAgent: string
  language: string
  timezone: string
  resolution: {
    width: number
    height: number
  }
  memory: number
  hardwareConcurrency: number
  geolocationPolicy: "prompt" | "allow" | "block"
  webrtcPolicy: WebRtcPolicy
}

export type RuntimeLaunchRequest = {
  profileId: string
  profileName: string
  browserEngine: string
  browserVersion: string
  debugPort: number
  proxy?: {
    server: string
    username?: string
    password?: string
  }
  fingerprint: FingerprintConfig
}

export type RuntimeLaunchPlan = {
  adapterId: string
  browserEngine: string
  launchArgs: string[]
  env: Record<string, string>
  fingerprint: FingerprintConfig
  metadata: {
    wsPathHint?: string
    profileDataDir?: string
  }
}

export type RuntimeProcessHandle = {
  instanceId: string
  profileId: string
  status: "running" | "stopped" | "error"
  processId?: number
  debugPort: number
  wsEndpoint?: string
  startedAt: string
  updatedAt: string
  lastError?: string
}

export interface RuntimeAdapter {
  id: string
  supports(engine: string): boolean
  prepareLaunch(request: RuntimeLaunchRequest): RuntimeLaunchPlan
}
```

## 5. 推荐的调用链

### 启动流程
1. Manager 从 `BrowserProfile` 读取配置
2. Lifecycle Manager 分配 `debugPort`
3. Runtime Adapter 生成 `RuntimeLaunchPlan`
4. Native Runtime 执行 `RuntimeLaunchPlan`
5. Native Runtime 返回 `RuntimeProcessHandle`
6. Manager 更新 UI 状态与可连接信息

### 停止流程
1. Manager 发出 stop 请求
2. Native Runtime 停止真实进程
3. Lifecycle Manager 更新状态、日志和锁

### 重启流程
1. Manager 发出 restart 请求
2. Native Runtime 停止旧进程
3. 复用或重新生成启动计划
4. 返回新的 process handle / ws endpoint

## 6. Chromium 适配器输出约定

Chromium Runtime Adapter 至少需要输出以下参数类别：

- `--remote-debugging-port=<port>`
- `--window-size=<width>,<height>`
- `--lang=<locale>`
- `--user-agent=<ua>`（如有配置）
- `--proxy-server=<scheme://host:port>`（如有代理）

可选参数：

- `--disable-webrtc`
- `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`
- profile data dir
- headless / headed 策略

## 7. Playwright / CDP 合同

当前 contract 的目标不是立刻保证真实可连，而是先稳定字段定义。

Manager 至少需要能展示：

- `debugPort`
- `wsEndpoint`
- `adapterId`
- 关键启动参数摘要

Native Runtime 接入后，需要满足：

- `chromium.connectOverCDP()` 可使用真实 endpoint 或 port
- 如果浏览器尚未准备好，返回明确错误而不是静默失败

## 8. 错误模型

建议使用结构化错误：

```ts
export type RuntimeErrorCode =
  | "PROFILE_ALREADY_RUNNING"
  | "PORT_ALLOCATION_FAILED"
  | "ADAPTER_NOT_SUPPORTED"
  | "RUNTIME_LAUNCH_FAILED"
  | "RUNTIME_STOP_FAILED"
  | "WS_ENDPOINT_UNAVAILABLE"

export type RuntimeError = {
  code: RuntimeErrorCode
  message: string
  detail?: string
  at: string
}
```

要求：

- UI 展示友好消息
- 日志保存原始 detail
- 同一错误码可用于自动化重试和问题分类

## 9. 兼容当前实现的迁移路径

截至 2026-03-13，当前主线中：

- `runtime/manager.ts` 已负责 lifecycle 抽象
- `wsEndpoint` 仍是前端拼接的合同面
- `sessionStorage` 仍是运行态临时存储

迁移建议：

### Phase 1
- 落地纯 TypeScript `RuntimeAdapter`
- 在 UI 中展示 adapter 输出摘要

### Phase 2
- 通过 Tauri command 调用原生 launcher
- 用真实返回值替换当前 session-backed `BrowserInstance`

### Phase 3
- 接入 Playwright 真连接
- 增加运行时错误通道和日志面板

## 10. 验收标准

Runtime contract 被认为成立，至少需要满足：

- `BrowserProfile -> FingerprintConfig` 转换规则明确
- `FingerprintConfig -> RuntimeLaunchPlan` 输出可测试
- Manager 不依赖具体浏览器启动实现
- Native Runtime 可在不改 UI 的前提下接入

## 11. 配套文档

- `docs/product/mvp-prd.md`
- `docs/architecture/system-design.md`
- `docs/plans/2026-03-12-runtime-adapter.md`
