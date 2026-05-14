import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { spawn } from "node:child_process";
import { app, dialog, ipcMain, nativeImage } from "electron";
import { PNG } from "pngjs";
import { defaultConfig, type AppConfig } from "../src/types/config";
import type { CharacterConfig, CharacterInfo } from "../src/types/character";
import type { ChatMessage, ChatSession } from "../src/types/chat";
import { resolveCharacterNameFromPath } from "../src/utils/characterNaming";
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

const requiredLayerCharacterFiles = ["body.png", "head.png", "eye-open.png", "eye-close.png"];
const builtinCharacterIds = [
  "shengling-chuxue",
  "fengchuan-xiangzi",
  "huang-video",
  "huang-illustration",
  "luoxiaohei",
  "shan"
];
const abortControllers = new Map<string, AbortController>();
const importedVideoCanvasSize = 512;
const maxImportedImageCanvasSize = 720;
const ffmpegPath = require("ffmpeg-static") as string | null;
const ffprobePath = (require("ffprobe-static") as { path?: string | null }).path ?? null;

interface VideoProbeInfo {
  width: number;
  height: number;
  duration: number | null;
  pixFmt: string | null;
}

interface VideoCropBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface VideoCropSuggestion {
  canvas: {
    width: number;
    height: number;
  };
  video: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

function dataDir() {
  return app.getPath("userData");
}

function configPath() {
  return path.join(dataDir(), "config.json");
}

function charactersDir() {
  return path.join(dataDir(), "characters");
}

function characterIdExists(id: string) {
  if (builtinCharacterIds.includes(id) && fs.existsSync(builtinCharacterDir(id))) return true;
  const safeName = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  return fs.existsSync(path.join(charactersDir(), safeName, "config.json"));
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
  const merged = {
    ...base,
    ...patch,
    model: { ...base.model, ...patch.model },
    animation: { ...base.animation, ...patch.animation },
    window: { ...base.window, ...patch.window },
    chat: { ...base.chat, ...patch.chat }
  };
  return {
    ...merged,
    chat: {
      ...merged.chat,
      maxSessions: normalizeMaxSessions(merged.chat.maxSessions)
    }
  };
}

function normalizeMaxSessions(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultConfig.chat.maxSessions;
  return Math.min(100, Math.max(1, Math.floor(numeric)));
}

function readConfig(): AppConfig {
  ensureDataDirs();
  if (!fs.existsSync(configPath())) {
    writeConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), "utf-8")) as Partial<AppConfig>;
    const merged = mergeConfig(defaultConfig, parsed);
    if (!characterIdExists(merged.activeCharacterId)) {
      return mergeConfig(merged, { activeCharacterId: "shengling-chuxue", petName: "圣聆初雪" });
    }
    return merged;
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

function limitChatSessions(sessions: ChatSession[], maxSessions = readConfig().chat.maxSessions) {
  return sanitizeSessions(sessions).slice(0, normalizeMaxSessions(maxSessions));
}

function readChatSessions(): ChatSession[] {
  ensureDataDirs();
  if (!fs.existsSync(chatSessionsPath())) return [];
  try {
    return limitChatSessions(JSON.parse(fs.readFileSync(chatSessionsPath(), "utf-8")));
  } catch {
    const backup = `${chatSessionsPath()}.broken-${Date.now()}`;
    fs.copyFileSync(chatSessionsPath(), backup);
    return [];
  }
}

function writeChatSessions(sessions: ChatSession[]) {
  ensureDataDirs();
  const next = limitChatSessions(sessions);
  fs.writeFileSync(chatSessionsPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

function trimStoredChatSessions(maxSessions: number) {
  if (!fs.existsSync(chatSessionsPath())) return;
  const sessions = readChatSessions();
  writeChatSessions(sessions.slice(0, normalizeMaxSessions(maxSessions)));
}

function readCharacterConfig(dir: string): CharacterConfig {
  const configPath = path.join(dir, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("角色目录缺少 config.json");
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as CharacterConfig;
  if (!config.id || !config.name || !config.canvas) {
    throw new Error("角色 config.json 缺少 id、name 或 canvas 字段");
  }

  if (config.renderMode === "video") {
    if (!config.video?.file) {
      throw new Error("视频角色 config.json 缺少 video.file 字段");
    }
    if (!fs.existsSync(path.join(dir, config.video.file))) {
      throw new Error(`角色目录缺少 ${config.video.file}`);
    }
    return config;
  }

  if (config.renderMode === "image") {
    if (!config.image?.file) {
      throw new Error("图片角色 config.json 缺少 image.file 字段");
    }
    if (!fs.existsSync(path.join(dir, config.image.file))) {
      throw new Error(`角色目录缺少 ${config.image.file}`);
    }
    return config;
  }

  if (!config.layers) {
    throw new Error("角色 config.json 缺少 layers 字段");
  }
  for (const file of requiredLayerCharacterFiles) {
    if (!fs.existsSync(path.join(dir, file))) {
      throw new Error(`角色目录缺少 ${file}`);
    }
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

function deleteImportedCharacter(id: string) {
  const selected = listCharacters().find((character) => character.id === id);
  if (!selected) throw new Error(`找不到角色：${id}`);
  if (selected.builtin) throw new Error("内置角色不能删除");

  const root = path.resolve(charactersDir());
  const target = path.resolve(selected.path);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("角色目录不在可删除范围内");
  }

  fs.rmSync(target, { recursive: true, force: true });

  const current = readConfig();
  if (current.activeCharacterId !== id) return current;

  const next = mergeConfig(current, { activeCharacterId: "shengling-chuxue", petName: "圣聆初雪" });
  writeConfig(next);
  sendConfigChanged(next);
  return next;
}

function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniqueImportedCharacterId(baseName: string) {
  const slug = slugFromName(baseName) || "imported-character";
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
}

function runCommand(command: string, args: string[], timeoutMs = 30000) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("多媒体分析超时"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || `命令执行失败，退出码 ${code ?? "unknown"}`));
    });
  });
}

async function runBinary(binaryPath: string | null, fallbackCommand: string, args: string[], timeoutMs = 30000) {
  if (binaryPath) {
    try {
      return await runCommand(binaryPath, args, timeoutMs);
    } catch (error) {
      const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== "EBUSY" && code !== "ENOENT" && code !== "EPERM") {
        throw error;
      }
    }
  }
  return runCommand(fallbackCommand, args, timeoutMs);
}

function hasAlphaPixelFormat(pixFmt: string | null) {
  if (!pixFmt) return false;
  const normalized = pixFmt.toLowerCase();
  return ["yuva", "rgba", "bgra", "argb", "abgr", "gbrap"].some((prefix) => normalized.startsWith(prefix));
}

async function probeVideoInfo(source: string): Promise<VideoProbeInfo> {
  const response = await runBinary(ffprobePath, "ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    source
  ]);

  const parsed = JSON.parse(response.stdout) as {
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      pix_fmt?: string;
      duration?: string;
    }>;
    format?: {
      duration?: string;
    };
  };

  const stream = parsed.streams?.find((item) => item.codec_type === "video");
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  const duration = Number(stream?.duration ?? parsed.format?.duration);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("无法读取 WebM 视频尺寸");
  }

  return {
    width,
    height,
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    pixFmt: stream?.pix_fmt ?? null
  };
}

function sampleTimes(duration: number | null, count = 6) {
  if (!duration) return [0];
  if (count <= 1) return [Math.max(0, duration / 2)];

  const safeStart = Math.max(0, Math.min(duration * 0.08, 0.12));
  const safeEnd = Math.max(safeStart, duration - safeStart);
  const step = (safeEnd - safeStart) / (count - 1);
  return Array.from({ length: count }, (_, index) => safeStart + step * index);
}

function expandBounds(bounds: VideoCropBounds, padding: number, width: number, height: number) {
  return {
    minX: Math.max(0, bounds.minX - padding),
    minY: Math.max(0, bounds.minY - padding),
    maxX: Math.min(width - 1, bounds.maxX + padding),
    maxY: Math.min(height - 1, bounds.maxY + padding)
  };
}

function unionBounds(left: VideoCropBounds | null, right: VideoCropBounds) {
  if (!left) return right;
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY)
  };
}

function estimateBackgroundColor(png: PNG) {
  const { data, width, height } = png;
  const sampleSize = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  let total = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  const sampleCorner = (startX: number, startY: number) => {
    for (let y = startY; y < startY + sampleSize; y += 2) {
      for (let x = startX; x < startX + sampleSize; x += 2) {
        const index = (width * y + x) * 4;
        red += data[index] ?? 0;
        green += data[index + 1] ?? 0;
        blue += data[index + 2] ?? 0;
        total += 1;
      }
    }
  };

  sampleCorner(0, 0);
  sampleCorner(Math.max(0, width - sampleSize), 0);
  sampleCorner(0, Math.max(0, height - sampleSize));
  sampleCorner(Math.max(0, width - sampleSize), Math.max(0, height - sampleSize));

  if (total <= 0) {
    return { red: 0, green: 0, blue: 0 };
  }

  return {
    red: Math.round(red / total),
    green: Math.round(green / total),
    blue: Math.round(blue / total)
  };
}

function measureVisibleBounds(png: PNG, useAlphaMask: boolean) {
  const { data, width, height } = png;
  const background = estimateBackgroundColor(png);
  const brightness = (background.red + background.green + background.blue) / 3;
  const colorThreshold = brightness < 32 ? 24 : brightness < 128 ? 36 : 48;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) * 4;
      if (useAlphaMask) {
        const alpha = data[index + 3];
        if (alpha <= 8) continue;
      } else {
        const distance =
          Math.abs((data[index] ?? 0) - background.red) +
          Math.abs((data[index + 1] ?? 0) - background.green) +
          Math.abs((data[index + 2] ?? 0) - background.blue);
        if (distance <= colorThreshold) continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

async function extractVideoFrame(source: string, timeSeconds: number, outputFile: string) {
  const timestamp = Math.max(0, timeSeconds).toFixed(3);
  await runBinary(ffmpegPath, "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    timestamp,
    "-i",
    source,
    "-frames:v",
    "1",
    "-an",
    "-sn",
    "-dn",
    outputFile
  ]);
}

async function analyzeWebmCrop(source: string): Promise<VideoCropSuggestion | null> {
  const probe = await probeVideoInfo(source);
  const useAlphaMask = hasAlphaPixelFormat(probe.pixFmt);

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "desktop-pet-webm-"));
  try {
    const boundsList: VideoCropBounds[] = [];
    const times = sampleTimes(probe.duration, 7);

    for (let index = 0; index < times.length; index += 1) {
      const outputFile = path.join(workDir, `frame-${String(index).padStart(2, "0")}.png`);
      try {
        await extractVideoFrame(source, times[index], outputFile);
      } catch {
        continue;
      }
      if (!fs.existsSync(outputFile)) continue;

      try {
        const png = PNG.sync.read(fs.readFileSync(outputFile));
        const bounds = measureVisibleBounds(png, useAlphaMask);
        if (bounds) boundsList.push(bounds);
      } catch {
        continue;
      }
    }

    const merged = boundsList.reduce<VideoCropBounds | null>(unionBounds, null);
    if (!merged) return null;

    const padding = Math.max(2, Math.round(Math.min(probe.width, probe.height) * 0.01));
    const expanded = expandBounds(merged, padding, probe.width, probe.height);
    const canvasWidth = Math.max(1, expanded.maxX - expanded.minX + 1);
    const canvasHeight = Math.max(1, expanded.maxY - expanded.minY + 1);

    return {
      canvas: {
        width: canvasWidth,
        height: canvasHeight
      },
      video: {
        x: -expanded.minX,
        y: -expanded.minY,
        width: probe.width,
        height: probe.height
      }
    };
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

async function writeVideoCharacter(source: string, displayName?: string) {
  const ext = path.extname(source).toLowerCase();
  if (ext !== ".webm") {
    throw new Error("仅支持导入 .webm 视频角色文件");
  }

  const name = resolveCharacterNameFromPath(source, displayName);
  const id = uniqueImportedCharacterId(name);
  const target = path.join(charactersDir(), id);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(source, path.join(target, "idle.webm"));

  const crop = await analyzeWebmCrop(source).catch(() => null);

  const config: CharacterConfig = crop
    ? {
      id,
        name,
        version: `import-${Date.now()}`,
        renderMode: "video",
        canvas: crop.canvas,
        video: {
          file: "idle.webm",
          ...crop.video
        },
        animation: {
          blink: false,
          headShake: false,
          float: false
        }
      }
    : {
      id,
        name,
        version: `import-${Date.now()}`,
        renderMode: "video",
        canvas: {
          width: importedVideoCanvasSize,
          height: importedVideoCanvasSize
        },
        video: {
          file: "idle.webm",
          x: 0,
          y: 0,
          width: importedVideoCanvasSize,
          height: importedVideoCanvasSize
        },
        animation: {
          blink: false,
          headShake: false,
          float: false
        }
      };

  fs.writeFileSync(path.join(target, "config.json"), JSON.stringify(config, null, 2), "utf-8");
  return characterInfoFromDir(target, false);
}

function writeImageCharacter(source: string, displayName?: string) {
  const ext = path.extname(source).toLowerCase();
  if (ext !== ".png") {
    throw new Error("仅支持导入 .png 图片角色文件");
  }

  const image = nativeImage.createFromPath(source);
  const size = image.getSize();
  if (image.isEmpty() || size.width <= 0 || size.height <= 0) {
    throw new Error("无法读取 PNG 图片尺寸，请确认文件未损坏");
  }

  const name = resolveCharacterNameFromPath(source, displayName);
  const id = uniqueImportedCharacterId(name);
  const target = path.join(charactersDir(), id);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(source, path.join(target, "image.png"));

  const maxSide = Math.max(size.width, size.height);
  const normalizedScale = maxSide > maxImportedImageCanvasSize ? maxImportedImageCanvasSize / maxSide : 1;
  const canvasWidth = Math.max(1, Math.round(size.width * normalizedScale));
  const canvasHeight = Math.max(1, Math.round(size.height * normalizedScale));

  const config: CharacterConfig = {
    id,
    name,
    version: `import-${Date.now()}`,
    renderMode: "image",
    canvas: {
      width: canvasWidth,
      height: canvasHeight
    },
    image: {
      file: "image.png",
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight
    },
    animation: {
      blink: false,
      headShake: false,
      float: false
    }
  };

  fs.writeFileSync(path.join(target, "config.json"), JSON.stringify(config, null, 2), "utf-8");
  return characterInfoFromDir(target, false);
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

  const payload = {
    model: config.model.model,
    messages: apiMessages,
    temperature: config.model.temperature,
    stream
  };
  if (config.model.max_tokens > 0) {
    return { ...payload, max_tokens: config.model.max_tokens };
  }
  return payload;
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
    trimStoredChatSessions(next.chat.maxSessions);
    applyPetWindowConfig(next.window);
    sendConfigChanged(next);
    return next;
  });
  ipcMain.handle("config:reset", () => {
    writeConfig(defaultConfig);
    trimStoredChatSessions(defaultConfig.chat.maxSessions);
    applyPetWindowConfig(defaultConfig.window);
    sendConfigChanged(defaultConfig);
    return defaultConfig;
  });

  ipcMain.handle("window:toggleChat", () => toggleChatWindow());
  ipcMain.handle("window:openSettings", () => {
    createSettingsWindow();
  });
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
  ipcMain.handle("character:pickVideoFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择 WebM 角色文件",
      properties: ["openFile"],
      filters: [{ name: "WebM 视频", extensions: ["webm"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("character:pickImageFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择 PNG 角色图片",
      properties: ["openFile"],
      filters: [{ name: "PNG 图片", extensions: ["png"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("character:setActive", (_, id: string) => {
    const selected = listCharacters().find((character) => character.id === id);
    if (!selected) throw new Error(`找不到角色：${id}`);
    const next = mergeConfig(readConfig(), { activeCharacterId: id, petName: selected.config.name });
    writeConfig(next);
    sendConfigChanged(next);
    return next;
  });
  ipcMain.handle("character:restoreDefault", () => {
    const next = mergeConfig(readConfig(), { activeCharacterId: "shengling-chuxue", petName: "圣聆初雪" });
    writeConfig(next);
    sendConfigChanged(next);
    return next;
  });
  ipcMain.handle("character:delete", (_, id: string) => deleteImportedCharacter(id));
  ipcMain.handle("character:importVideoFile", async (_, sourcePath: string, displayName?: string) => {
    if (!sourcePath) throw new Error("请选择 WebM 角色文件");
    return writeVideoCharacter(sourcePath, displayName);
  });
  ipcMain.handle("character:importImageFile", async (_, sourcePath: string, displayName?: string) => {
    if (!sourcePath) throw new Error("请选择 PNG 角色图片");
    return writeImageCharacter(sourcePath, displayName);
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
