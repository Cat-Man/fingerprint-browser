# fingerprint-browser MVP PRD

> Last updated: 2026-03-13

## 1. 产品目标

`fingerprint-browser` 的目标是构建一个可本地运行的开源指纹浏览器 MVP，让用户能够：

- 创建和管理多个隔离的浏览器 profile
- 为每个 profile 配置独立代理与基础指纹参数
- 启动、停止、重启浏览器实例并查看运行状态
- 向 Playwright 暴露可连接的运行时入口
- 对关键指纹检测站点执行最小可用的回归验证

本阶段优先交付“可开发、可验证、可演进”的基础能力，而不是一次性完成完整商用级浏览器内核改造。

## 2. 目标用户

MVP 面向以下用户：

1. **自动化开发者**：需要为 Playwright / 自动化脚本提供稳定的浏览器实例入口
2. **多账号运营用户**：需要按 profile 隔离代理、分组、标签与运行状态
3. **开源协作者**：需要清晰的模块边界，以便后续替换底层 runtime、存储和检测能力

## 3. 产品原则

- **Manager / Runtime 分层**：管理界面与浏览器执行层解耦
- **契约先行**：先定义 profile、runtime、automation 之间的稳定接口
- **可测试优先**：前期先用纯前端适配层保证测试可跑，再逐步替换成 Tauri / Rust / Chromium 实现
- **渐进增强**：先做稳定的控制面，再接入真实浏览器进程与检测实验室

## 4. MVP 范围

### 4.1 In Scope

#### A. Manager App
- Dashboard / Profiles / Settings 基础页面
- Tauri 桌面壳与前端桥接占位

#### B. Profile 管理
- 创建 / 编辑 / 删除 / 复制 profile
- 分组与标签
- 独立代理配置（HTTP / SOCKS5）
- 基础指纹字段存储

#### C. 实例生命周期
- 启动 / 停止 / 重启实例
- 调试端口分配
- 运行状态展示
- profile lock，防止重复启动
- 输出 Playwright 连接信息合同面

#### D. Runtime Adapter
- 将 profile 转换为统一 `FingerprintConfig`
- 生成 Chromium 启动参数计划
- 保证 Manager 层不依赖具体浏览器启动实现

#### E. 检测实验室
- 明确 CreepJS / BrowserLeaks 最小回归流程
- 记录关键检测维度与人工回归步骤

### 4.2 Out of Scope（当前不做）

- 完整自研 Chromium patch
- 完整 anti-detect 深度伪装能力
- 云端 profile 同步
- 多人协作权限系统
- 商业化授权、计费、远程控制平台

## 5. 功能需求

### FR-1 Profile 管理
- 用户可以创建多个 profile
- 每个 profile 独立保存代理与基础指纹参数
- profile 数据在应用重启后可恢复

### FR-2 实例生命周期
- 用户可一键启动 / 停止 / 重启 profile 对应实例
- UI 需要展示当前运行状态
- 同一 profile 不允许被重复启动
- 系统需要分配并展示调试端口

### FR-3 Playwright 桥接
- 系统需要为实例生成 Playwright 可消费的连接信息
- 前期允许先暴露“连接合同面”，后期再接真实浏览器连接

### FR-4 Runtime Adapter
- 系统需要从 profile 推导稳定的指纹配置对象
- 系统需要生成浏览器启动参数计划
- 后续替换底层 runtime 时，UI 和 Manager 不应被迫重写

### FR-5 检测验证
- 至少定义 2 个检测站点
- 明确手工回归步骤
- 能记录关键检测维度，支持后续自动化

## 6. 非功能需求

- **本地优先**：MVP 在本地单机可运行
- **可测试**：核心逻辑需能在 Vitest 中验证
- **可替换**：存储层、runtime 层、automation 层都需要保留适配接口
- **可观察**：实例生命周期至少提供状态、端口、日志摘要

## 7. 当前阶段状态（截至 2026-03-13）

### 已有能力
- Tauri + React 基础壳体已建立
- Dashboard / Profiles / Settings 基础页面已存在
- Profile CRUD、分组、标签、独立代理、本地存储已完成第一版
- 实例生命周期第一阶段切片已合入 `main`
  - 支持启动 / 停止 / 重启
  - 支持调试端口分配
  - 支持 profile lock
  - UI 可展示运行状态、端口、wsEndpoint 合同面

### 未完成能力
- 真实 Chromium / Tauri runtime 接入
- Runtime Adapter 正式落地
- Playwright 真连接
- 检测实验室与回归脚本

## 8. 里程碑

### M1：工程骨架
- 对应 issue `#2`
- 目标：桌面壳、基础导航、桥接占位

### M2：Profile 管理
- 对应 issue `#3`
- 目标：可创建、编辑、复制、删除并持久化 profile

### M3：实例生命周期
- 对应 issue `#4`
- 目标：实例启停、状态展示、调试端口和 Playwright 入口合同面

### M4：Runtime Adapter
- 对应 issue `#5`
- 目标：定义稳定的指纹配置与启动参数生成逻辑

### M5：检测实验室
- 对应 issue `#6`
- 目标：形成最小闭环的检测与回归能力

## 9. MVP 完成标准

MVP 被视为完成，至少需要满足：

- 能创建多个隔离 profile
- 每个 profile 可独立配置代理和基础指纹参数
- 能启动实例并看到运行状态
- 能生成并展示 Playwright 可消费的连接信息
- 能根据 profile 生成稳定的 runtime 启动计划
- 至少对 2 个检测站点形成可重复执行的验证流程

## 10. 后续文档

本 PRD 与下列文档配套使用：

- `docs/architecture/system-design.md`
- `docs/architecture/runtime-contract.md`
- `docs/plans/2026-03-12-runtime-adapter.md`
