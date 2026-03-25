# Runtime Contract

> Last updated: 2026-03-25

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
- 为 Detection Lab 自动采集提供可 attach 的 `wsEndpoint`

## 4. 核心类型

以下类型为当前 contract 基线，作为 issue `#5` 及后续 native runtime / automation 接入的统一依据。

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
    browserVersion?: string
    proxy?: {
      server: string
      username?: string
      password?: string
    }
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
  health: {
    status: "unknown" | "healthy" | "degraded" | "stopped"
    checkedAt: string
    message: string
  }
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

当前 contract 已经同时承担“字段稳定”和“真实原生运行时对接”两件事。

Manager 至少需要能展示：

- `debugPort`
- `processId`
- `wsEndpoint`
- `adapterId`
- 关键启动参数摘要

当前 Tauri / Rust runtime 需要满足：

- `chromium.connectOverCDP()` 可使用真实 endpoint 或 port
- 如果浏览器尚未准备好，返回明确错误而不是静默失败
- 可通过仓库中的 `npm run runtime:smoke -- <ws-endpoint>` 做基础连通性验证

Detection Lab 自动采集当前新增的 contract：

```ts
export type DetectionProbeRequest = {
  profileId: string
  targetId: "creepjs" | "browserleaks"
  targetUrl: string
  wsEndpoint: string
}

export type DetectionProbeArtifact = {
  id: string
  url: string
  text: string
}

export type DetectionProbeResult = {
  observed: {
    userAgent: string
    language: string
    timezone: string
    webrtc: string
    canvas: string
    webgl: string
    audio: string
    clientRects: string
  }
  artifacts: DetectionProbeArtifact[]
  capturedAt: string
  targetUrl: string
}
```

其中：

- `observed` 继续承担字段级回填
- `artifacts` 承担站点级摘要解析所需的目标页面文本工件
- BrowserLeaks 允许由多个子页面（如 `/javascript`、`/webrtc`、`/canvas`、`/webgl`、`/rects`）共同组成一次摘要输入

Runtime 健康刷新当前新增的 contract：

```ts
export type RefreshRuntimeHealthRequest = {
  profileId: string
}
```

要求：

- Native Runtime 需要检查托管进程是否仍存活
- Native Runtime 需要检查当前 `debugPort` 对应的 CDP endpoint 是否可达
- 返回值继续复用 `RuntimeProcessHandle`，并更新 `health`、`lastError`、`updatedAt` 与 `logs`

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

截至 2026-03-25，当前主线中：

- `runtime/manager.ts` 已负责 lifecycle 抽象
- Tauri 模式会通过 `runtimeDesktop` 桥接返回真实 `processId` 与 `wsEndpoint`
- Detection Lab 已可通过 `automationDesktop` 桥接向运行中的实例发起 probe
- Profiles 页面已可通过 `refresh_runtime_health` 主动刷新运行时健康状态，并查看最近日志
- 浏览器预览模式仍保留 `sessionStorage` 运行态回退

迁移建议：

### Phase 1
- 落地纯 TypeScript `RuntimeAdapter`
- 在 UI 中展示 adapter 输出摘要

### Phase 2
- 通过 Tauri command 调用原生 launcher
- 用真实返回值替换当前 session-backed `BrowserInstance`

### Phase 3
- 深化站点级检测解析与自动结论
- 增加自动健康探测、恢复策略和连续日志流

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
