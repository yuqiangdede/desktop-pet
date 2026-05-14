import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app, dialog, ipcMain } from "electron";
import { defaultConfig, type AppConfig } from "../src/types/config";
import type { CharacterConfig, CharacterInfo } from "../src/types/character";
import type { ChatMessage, ChatSession } from "../src/types/chat";
import {
  createSettingsWindow,
  applyPetWindowConfig,
  dragPetBy,
  resizePetBy,
  resetPetPosition,
  sendConfigChanged,
  sendToChat,
  toggleChatWindow
} from "./windowManager";

const requiredCharacterFiles = ["config.json", "body.png", "head.png", "eye-open.png", "eye-close.png"];
const builtinCharacterIds = ["default-girl", "default-boy", "ragdoll-cat", "golden-dog"];
const abortControllers = new Map<string, AbortController>();

function dataDir() {
  return app.getPath("userData");
}

function configPath() {
  return path.join(dataDir(), "config.json");
}

function charactersDir() {
  return path.join(dataDir(), "characters");
}

function chatSessionsPath() {
  return path.join(dataDir(), "chat-sessions.json");
}

function builtinCharacterDir(id: string) {
  if (process.env.NODE_ENV === "development") {
    return path.join(app.getAppPath(), "src", "assets", "characters", id);
  }
  return path.join(app.getAppPath(), "dist", "characters", id);
}

function ensureDataDirs() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.mkdirSync(charactersDir(), { recursive: true });
}

function mergeConfig(base: AppConfig, patch: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...patch,
    model: { ...base.model, ...patch.model },
    animation: { ...base.animation, ...patch.animation },
    window: { ...base.window, ...patch.window }
  };
}

function readConfig(): AppConfig {
  ensureDataDirs();
  if (!fs.existsSync(configPath())) {
    writeConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), "utf-8")) as Partial<AppConfig>;
    return mergeConfig(defaultConfig, parsed);
  } catch {
    const backup = `${configPath()}.broken-${Date.now()}`;
    fs.copyFileSync(configPath(), backup);
    writeConfig(defaultConfig);
    return defaultConfig;
  }
}

export function getStoredConfig() {
  return readConfig();
}

function writeConfig(config: AppConfig) {
  ensureDataDirs();
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
}

function sanitizeSessions(value: unknown): ChatSession[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ChatSession => {
      const candidate = item as Partial<ChatSession>;
      return Boolean(candidate.id && candidate.title && Array.isArray(candidate.messages));
    })
    .map((session) => ({
      id: session.id,
      title: session.title,
      messages: session.messages,
      createdAt: Number(session.createdAt) || Date.now(),
      updatedAt: Number(session.updatedAt) || Number(session.createdAt) || Date.now()
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function readChatSessions(): ChatSession[] {
  ensureDataDirs();
  if (!fs.existsSync(chatSessionsPath())) return [];
  try {
    return sanitizeSessions(JSON.parse(fs.readFileSync(chatSessionsPath(), "utf-8")));
  } catch {
    const backup = `${chatSessionsPath()}.broken-${Date.now()}`;
    fs.copyFileSync(chatSessionsPath(), backup);
    return [];
  }
}

function writeChatSessions(sessions: ChatSession[]) {
  ensureDataDirs();
  const next = sanitizeSessions(sessions);
  fs.writeFileSync(chatSessionsPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

function readCharacterConfig(dir: string): CharacterConfig {
  for (const file of requiredCharacterFiles) {
    if (!fs.existsSync(path.join(dir, file))) {
      throw new Error(`角色目录缺少 ${file}`);
    }
  }

  const config = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf-8")) as CharacterConfig;
  if (!config.id || !config.name || !config.canvas || !config.layers) {
    throw new Error("角色 config.json 缺少 id、name、canvas 或 layers 字段");
  }
  return config;
}

function characterInfoFromDir(dir: string, builtin: boolean): CharacterInfo {
  const config = readCharacterConfig(dir);
  const encodedBase = Buffer.from(path.resolve(dir), "utf-8").toString("base64url");
  return {
    id: config.id,
    name: config.name,
    path: dir,
    assetBaseUrl: `pet-asset://asset/${encodedBase}`,
    config,
    builtin
  };
}

function listCharacters(): CharacterInfo[] {
  ensureDataDirs();
  const result: CharacterInfo[] = [];
  for (const id of builtinCharacterIds) {
    const builtin = builtinCharacterDir(id);
    if (fs.existsSync(builtin)) {
      result.push(characterInfoFromDir(builtin, true));
    }
  }

  for (const name of fs.readdirSync(charactersDir(), { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    try {
      result.push(characterInfoFromDir(path.join(charactersDir(), name.name), false));
    } catch {
      // Ignore broken imported characters and keep the settings page usable.
    }
  }
  return result;
}

function copyDirectory(source: string, target: string) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function normalizeBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.replace(/\/+$/, "");
}

function contextMessages(messages: ChatMessage[], contextRounds: number) {
  const rounds = Math.max(0, Math.floor(contextRounds));
  let seenUserMessages = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== "user") continue;
    seenUserMessages += 1;
    if (seenUserMessages > rounds + 1) {
      return messages.slice(index + 1);
    }
  }

  return messages;
}

function openAiPayload(config: AppConfig, messages: ChatMessage[], stream: boolean) {
  const scopedMessages = contextMessages(messages, config.model.contextRounds);
  const apiMessages = [
    ...(config.model.systemPrompt.trim()
      ? [{ role: "system", content: config.model.systemPrompt.trim() }]
      : []),
    ...scopedMessages.map((message) => ({ role: message.role, content: message.content }))
  ];

  return {
    model: config.model.model,
    messages: apiMessages,
    temperature: config.model.temperature,
    max_tokens: config.model.max_tokens,
    stream
  };
}

function parseOpenAiError(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message || `请求失败，HTTP ${status}`;
  } catch {
    return body || `请求失败，HTTP ${status}`;
  }
}

async function requestChat(messages: ChatMessage[], requestId: string) {
  const config = readConfig();
  if (!config.model.apiKey.trim()) {
    throw new Error("请先在设置中填写 API Key");
  }
  if (!config.model.apiBaseUrl.trim()) {
    throw new Error("请先在设置中填写 API Base URL");
  }

  const controller = new AbortController();
  abortControllers.set(requestId, controller);
  const response = await fetch(`${normalizeBaseUrl(config.model.apiBaseUrl)}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.model.apiKey}`
    },
    body: JSON.stringify(openAiPayload(config, messages, config.model.stream))
  });

  if (!response.ok) {
    throw new Error(parseOpenAiError(await response.text(), response.status));
  }

  if (!config.model.stream) {
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    sendToChat("chat:done", { requestId, content });
    return;
  }

  if (!response.body) {
    throw new Error("服务端未返回可读取的流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") {
        sendToChat("chat:done", { requestId, content: full });
        return;
      }

      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          sendToChat("chat:delta", { requestId, delta });
        }
      } catch {
        throw new Error("流式响应解析失败，请确认接口兼容 OpenAI Chat Completions");
      }
    }
  }

  sendToChat("chat:done", { requestId, content: full });
}

export function registerIpc() {
  ipcMain.handle("config:get", () => readConfig());
  ipcMain.handle("config:save", (_, patch: Partial<AppConfig>) => {
    const next = mergeConfig(readConfig(), patch);
    writeConfig(next);
    applyPetWindowConfig(next.window);
    sendConfigChanged(next);
    return next;
  });
  ipcMain.handle("config:reset", () => {
    writeConfig(defaultConfig);
    applyPetWindowConfig(defaultConfig.window);
    sendConfigChanged(defaultConfig);
    return defaultConfig;
  });

  ipcMain.handle("window:toggleChat", () => toggleChatWindow());
  ipcMain.handle("window:openSettings", () => createSettingsWindow());
  ipcMain.handle("window:dragMove", (_, delta: { x: number; y: number }) => dragPetBy(delta));
  ipcMain.handle("window:resizePet", (_, delta: { x: number; y: number }) => {
    const size = resizePetBy(delta);
    if (!size) return null;
    const current = readConfig();
    const next = mergeConfig(current, {
      window: {
        ...current.window,
        petWidth: size.width,
        petHeight: size.height
      }
    });
    writeConfig(next);
    return next;
  });
  ipcMain.handle("window:resetPetPosition", () => resetPetPosition());

  ipcMain.handle("character:list", () => listCharacters());
  ipcMain.handle("character:setActive", (_, id: string) => {
    const selected = listCharacters().find((character) => character.id === id);
    if (!selected) throw new Error(`找不到角色：${id}`);
    const next = mergeConfig(readConfig(), { activeCharacterId: id, petName: selected.config.name });
    writeConfig(next);
    sendConfigChanged(next);
    return next;
  });
  ipcMain.handle("character:restoreDefault", () => {
    const next = mergeConfig(readConfig(), { activeCharacterId: "default-girl", petName: "lala" });
    writeConfig(next);
    sendConfigChanged(next);
    return next;
  });
  ipcMain.handle("character:importDirectory", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择角色目录",
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const source = result.filePaths[0];
    const config = readCharacterConfig(source);
    const safeName = config.id.replace(/[^a-zA-Z0-9_-]/g, "-");
    const target = path.join(charactersDir(), safeName);
    copyDirectory(source, target);
    return characterInfoFromDir(target, false);
  });

  ipcMain.handle("chat:send", async (_, messages: ChatMessage[]) => {
    const requestId = crypto.randomUUID();
    requestChat(messages, requestId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "聊天请求失败";
      sendToChat("chat:error", { requestId, message });
    }).finally(() => {
      abortControllers.delete(requestId);
    });
    return { requestId };
  });

  ipcMain.handle("chat:stop", (_, requestId: string) => {
    abortControllers.get(requestId)?.abort();
    abortControllers.delete(requestId);
  });

  ipcMain.handle("chat:listSessions", () => readChatSessions());
  ipcMain.handle("chat:saveSessions", (_, sessions: ChatSession[]) => writeChatSessions(sessions));

  ipcMain.handle("chat:testConnection", async (_, patch?: Partial<AppConfig>) => {
    try {
      const config = mergeConfig(readConfig(), patch ?? {});
      if (!config.model.apiKey.trim()) throw new Error("请先在设置中填写 API Key");
      if (!config.model.apiBaseUrl.trim()) throw new Error("请先在设置中填写 API Base URL");
      const response = await fetch(`${normalizeBaseUrl(config.model.apiBaseUrl)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.model.apiKey}`
        },
        body: JSON.stringify({
          ...openAiPayload(config, [{ id: "test", role: "user", content: "ping", createdAt: Date.now() }], false),
          max_tokens: 1,
          stream: false
        })
      });
      if (!response.ok) {
        throw new Error(parseOpenAiError(await response.text(), response.status));
      }
      return { ok: true, message: `连接成功：${config.model.model}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "测试连接失败" };
    }
  });
}
