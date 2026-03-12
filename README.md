# fingerprint-browser

一个面向本地多账号隔离、代理管理和自动化接入的开源指纹浏览器项目。

## 项目目标

构建一个可本地运行的开源指纹浏览器 MVP，优先覆盖：

- 多 profile 隔离
- 每个 profile 独立代理
- 基础指纹配置与一致性控制
- 浏览器实例启动/停止与状态管理
- Playwright 连接能力
- 基础检测回归

## 技术方向

项目建议采用两层结构：

1. Manager App：负责 profile、代理、分组、导入导出、日志、更新
2. Browser Runtime：负责浏览器启动、指纹参数注入、自动化兼容

当前优先选择 Chromium 路线。

- 产品层参考：`zhom/donutbrowser`
- Chromium 指纹能力参考：`adryfish/fingerprint-chromium`
- stealth 思路参考：`daijro/camoufox`

## MVP 路线图

- #1 `MVP 规划：开源指纹浏览器 v0.1`
- #2 `初始化项目骨架：Tauri + React + Rust`
- #3 `Profile 与代理管理：本地存储、分组、独立代理`
- #4 `实例生命周期管理：启动守护进程、端口分配与 Playwright 桥接`
- #5 `Browser Runtime Adapter：指纹配置模型与浏览器启动参数`
- #6 `检测实验室：CreepJS / BrowserLeaks 回归检查`

## 首版范围

首版只解决最核心问题：

- 创建多个隔离 profile
- 为 profile 配置独立代理
- 生成并应用基础指纹参数
- 启动浏览器实例并查看状态
- 暴露 Playwright 可连接入口
- 对检测站点做最小回归验证

## 非首版范围

以下能力暂不纳入 MVP：

- 云同步
- 团队协作
- VPN / WireGuard 集成
- 插件市场
- 多端实时同步

## 参考项目

- https://github.com/daijro/camoufox
- https://github.com/adryfish/fingerprint-chromium
- https://github.com/zhom/donutbrowser
- https://github.com/Virtual-Browser/VirtualBrowser
