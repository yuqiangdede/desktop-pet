# Desktop Pet

极简 Electron + React + TypeScript 桌宠应用。桌面窗口透明、无边框、始终置顶，点击桌宠可打开 OpenAI 兼容聊天面板，并提供图形化设置页。

## 功能

- 透明置顶桌宠窗口，支持拖拽移动。
- PNG 分层角色渲染：`body.png`、`head.png`、`eye-open.png`、`eye-close.png`。
- 轻量动画：眨眼、轻微摇头、上下浮动，并支持内置角色的随机待机动作。
- 聊天面板：用户消息、AI 回复、流式输出、清空聊天、错误提示。
- OpenAI Chat Completions 兼容接口：`POST {apiBaseUrl}/chat/completions`。
- 设置页：API Base URL、API Key、Model、Temperature、Max Tokens、Stream、System Prompt、角色导入、动画和窗口配置。
- 配置保存到 Electron 用户数据目录，不写死 API Key。
- 支持 Windows 打包。

## 安装与运行

```powershell
npm install
npm run dev
```

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

角色目录格式：

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
src/assets/characters/default-girl/config.json
```

在设置页点击“导入角色目录”，选择上述目录即可。导入成功后可在角色下拉框切换。

## 默认角色资源

默认内置角色位于：

```text
src/assets/characters/
```

当前仓库内置了 4 套可运行的透明 PNG 角色资源：

- `default-girl`：默认名 `lala`
- `default-boy`：默认名 `kaka`
- `ragdoll-cat`：默认名 `tutu`
- `golden-dog`：默认名 `gaga`

每个角色目录包含基础分层资源和约 20 个待机动作帧。后续替换角色立绘时，按同名文件替换：

- `body.png`
- `head.png`
- `eye-open.png`
- `eye-close.png`

替换时保持透明背景 PNG，并按 `config.json` 调整图层位置、尺寸和 `idleActions` 帧数。

## 打包

```powershell
npm run build
npm run dist:win
```

Windows 安装包会输出到 `release/`。

## 安全约束

- Electron 不开启 `nodeIntegration`。
- 渲染进程只能通过 `preload.ts` 暴露的 `window.desktopPet` 与主进程通信。
- API Key 只保存在用户数据目录的配置文件中，不写死在源码里。
- 不包含 Live2D、语音、视频或摄像头功能。
