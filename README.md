# Desktop Pet

极简 Electron + React + TypeScript 桌宠应用。桌面窗口透明、无边框、始终置顶，点击桌宠可打开 OpenAI 兼容聊天面板，并提供图形化设置页。

## 功能

- 透明置顶桌宠窗口，支持拖拽移动。
- 角色渲染：支持 PNG 分层角色、单张 PNG 静态角色，也支持 WebM 自带动画角色。
- 轻量动画：眨眼、轻微摇头、上下浮动，并支持内置角色的随机待机动作。
- 聊天面板：用户消息、AI 回复、流式输出、清空聊天、错误提示。
- OpenAI Chat Completions 兼容接口：`POST {apiBaseUrl}/chat/completions`。
- 设置页：API Base URL、API Key、Model、Temperature、Max Tokens、Stream、System Prompt、最多保留对话、PNG / WebM 角色导入、动画和窗口配置。
- 配置保存到 Electron 用户数据目录，不写死 API Key。
- 支持 Windows 打包。

## 安装与运行

```powershell
npm install
npm install mermaid react-markdown remark-gfm
npm run dev
```

如果你是从旧环境迁移，或者本地依赖不完整，也可以先单独补装这三个包，再启动应用。

应用会启动桌宠窗口。托盘菜单可打开设置、聊天、重置位置或退出。

开发模式默认使用透明桌宠窗口。如需临时显示带边框的调试窗口：

```powershell
$env:PET_DEBUG_WINDOW="1"
npm run dev
```

## 模型配置

打开设置页后填写：

- API Base URL，例如 `https://api.openai.com/v1`
- API Key
- Model，例如 `gpt-4o-mini`
- Temperature
- Max Tokens
- Stream
- System Prompt

点击“测试连接”会发送一个最小 Chat Completions 请求验证配置。

## 自定义角色

PNG 分层角色目录格式：

```text
character-name/
  config.json
  body.png
  head.png
  eye-open.png
  eye-close.png
```

`config.json` 示例可参考：

```text
src/assets/characters/shengling-chuxue/config.json
```

单张 PNG 静态角色可以直接导入 `.png` 文件，不需要准备动画帧。应用会复制图片、读取尺寸并自动生成角色目录和 `config.json`，桌宠窗口可通过右下角拖拽缩放。

WebM 动画角色可以直接导入单个 `.webm` 文件，应用会自动生成角色目录和 `config.json`。

也可以手动准备 WebM 动画角色目录：

```text
character-name/
  config.json
  idle.webm
```

在设置页点击“导入 PNG 图片”可直接选择 `.png` 生成静态角色；点击“导入 WebM 文件”可直接选择 `.webm` 生成新角色。导入成功后可在角色下拉框切换。

## 默认角色资源

默认内置角色位于：

```text
src/assets/characters/
```

当前仓库内置了 1 套 WebM 动画角色资源：

- `shengling-chuxue`：默认名 `圣聆初雪`

替换 WebM 动画角色时更新 `video.file` 指向的视频文件。PNG 分层角色可通过直接编辑角色目录使用，并按 `config.json` 调整图层位置、尺寸和 `idleActions` 帧数。

## 打包

```powershell
npm run build
npm run dist:win
```

Windows 安装包会输出到 `release/`。

如果你需要一个可直接双击运行、方便发给别人的便携版单文件：

```powershell
npm run build
npm run dist:portable
```

便携版会在 `release/` 下输出一个 Windows `exe` 文件，适合直接分发，不需要额外安装步骤。

## 安全约束

- Electron 不开启 `nodeIntegration`。
- 渲染进程只能通过 `preload.ts` 暴露的 `window.desktopPet` 与主进程通信。
- API Key 只保存在用户数据目录的配置文件中，不写死在源码里。
- 不包含 Live2D、语音或摄像头功能。
