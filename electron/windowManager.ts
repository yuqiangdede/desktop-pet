import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { BrowserWindow, Menu, Tray, app, nativeImage, screen } from "electron";
import { defaultConfig, type AppConfig, type WindowConfig } from "../src/types/config";

export type WindowName = "pet" | "chat" | "settings";

let petWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === "development";

function logDev(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  const logPath = isDev ? path.join(app.getAppPath(), "desktop-pet-dev.log") : path.join(app.getPath("userData"), "desktop-pet.log");
  fs.appendFileSync(logPath, line, "utf-8");
}

function preloadPath() {
  return path.join(__dirname, "preload.js");
}

function rendererUrl(name: WindowName) {
  if (isDev) {
    return `http://127.0.0.1:5173/?window=${name}`;
  }
  const url = pathToFileURL(path.join(__dirname, "..", "..", "dist", "index.html"));
  url.searchParams.set("window", name);
  return url.toString();
}

function commonWebPreferences() {
  return {
    preload: preloadPath(),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false
  };
}

function appIconPath() {
  if (isDev) {
    return path.join(app.getAppPath(), "src", "assets", "app-icon.png");
  }
  return path.join(app.getAppPath(), "dist", "app-icon.png");
}

export function createPetWindow() {
  if (petWindow) {
    petWindow.show();
    petWindow.focus();
    logDev(`show existing pet window ${JSON.stringify(petWindow.getBounds())}`);
    return petWindow;
  }

  const display = screen.getPrimaryDisplay().workArea;
  const devVisibleMode = isDev && process.env.PET_DEBUG_WINDOW === "1";
  const width = defaultConfig.window.petWidth;
  const height = defaultConfig.window.petHeight;
  petWindow = new BrowserWindow({
    width,
    height,
    x: devVisibleMode ? display.x + Math.round((display.width - width) / 2) : display.x + display.width - 340,
    y: devVisibleMode ? display.y + Math.round((display.height - height) / 2) : display.y + display.height - 440,
    frame: devVisibleMode,
    transparent: !devVisibleMode,
    resizable: false,
    hasShadow: devVisibleMode,
    alwaysOnTop: true,
    skipTaskbar: !devVisibleMode,
    icon: appIconPath(),
    show: false,
    backgroundColor: devVisibleMode ? "#fff7ef" : "#00000000",
    webPreferences: commonWebPreferences()
  });

  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.once("ready-to-show", () => {
    petWindow?.show();
    petWindow?.focus();
    logDev(`pet ready-to-show ${JSON.stringify(petWindow?.getBounds())}`);
  });
  petWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription, validatedURL) => {
    logDev(`pet did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  petWindow.webContents.on("render-process-gone", (_, details) => {
    logDev(`pet render-process-gone ${JSON.stringify(details)}`);
  });
  petWindow.loadURL(rendererUrl("pet")).catch((error: Error) => {
    logDev(`pet loadURL failed ${error.message}`);
  });
  logDev(`created pet window ${JSON.stringify(petWindow.getBounds())}, devVisibleMode=${devVisibleMode}`);
  if (isDev && process.env.OPEN_DEVTOOLS === "1") {
    petWindow.webContents.openDevTools({ mode: "detach" });
  }
  petWindow.on("closed", () => {
    petWindow = null;
  });
  return petWindow;
}

export function ensurePetWindow(config?: AppConfig) {
  const win = createPetWindow();
  if (config) {
    applyPetWindowConfig(config.window);
  }
  return win;
}

export function createChatWindow() {
  if (chatWindow) {
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
  }

  const petBounds = petWindow?.getBounds();
  const workArea = petBounds
    ? screen.getDisplayMatching(petBounds).workArea
    : screen.getPrimaryDisplay().workArea;
  const chatWidth = 780;
  const chatHeight = 560;
  const preferredLeft = petBounds ? petBounds.x - chatWidth - 12 : workArea.x + 40;
  const preferredRight = petBounds ? petBounds.x + petBounds.width + 12 : workArea.x + 40;
  const x = petBounds
    ? preferredLeft >= workArea.x
      ? preferredLeft
      : Math.min(preferredRight, workArea.x + workArea.width - chatWidth)
    : workArea.x + 40;
  const y = petBounds
    ? Math.min(Math.max(workArea.y + 20, petBounds.y - 40), workArea.y + workArea.height - chatHeight)
    : workArea.y + 40;

  chatWindow = new BrowserWindow({
    width: chatWidth,
    height: chatHeight,
    x,
    y,
    frame: false,
    transparent: false,
    resizable: true,
    minWidth: 340,
    minHeight: 460,
    skipTaskbar: true,
    icon: appIconPath(),
    backgroundColor: "#f6f1ec",
    webPreferences: commonWebPreferences()
  });

  chatWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription, validatedURL) => {
    logDev(`chat did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  chatWindow.webContents.on("render-process-gone", (_, details) => {
    logDev(`chat render-process-gone ${JSON.stringify(details)}`);
  });
  chatWindow.webContents.on("context-menu", (_, params) => {
    Menu.buildFromTemplate([
      {
        label: "复制",
        role: "copy",
        enabled: params.selectionText.trim().length > 0
      }
    ]).popup({ window: chatWindow ?? undefined });
  });
  chatWindow.loadURL(rendererUrl("chat")).catch((error: Error) => {
    logDev(`chat loadURL failed ${error.message}`);
  });
  chatWindow.once("ready-to-show", () => {
    chatWindow?.show();
    chatWindow?.focus();
  });
  chatWindow.on("closed", () => {
    chatWindow = null;
  });
  return chatWindow;
}

export function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 920,
    height: 820,
    minWidth: 760,
    minHeight: 720,
    title: "Desktop Pet 设置",
    icon: appIconPath(),
    show: false,
    backgroundColor: "#fbfaf8",
    webPreferences: commonWebPreferences()
  });

  settingsWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription, validatedURL) => {
    logDev(`settings did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  settingsWindow.webContents.on("render-process-gone", (_, details) => {
    logDev(`settings render-process-gone ${JSON.stringify(details)}`);
  });
  settingsWindow.loadURL(rendererUrl("settings")).catch((error: Error) => {
    logDev(`settings loadURL failed ${error.message}`);
  });
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  return settingsWindow;
}

export function getWindow(name: WindowName) {
  if (name === "pet") return petWindow;
  if (name === "chat") return chatWindow;
  return settingsWindow;
}

export function toggleChatWindow() {
  if (chatWindow?.isVisible()) {
    chatWindow.hide();
    return;
  }
  createChatWindow();
}

export function dragPetBy(delta: { x: number; y: number }) {
  if (!petWindow) return;
  const bounds = petWindow.getBounds();
  petWindow.setBounds({
    ...bounds,
    x: bounds.x + Math.round(delta.x),
    y: bounds.y + Math.round(delta.y)
  });
}

export function resizePetBy(delta: { x: number; y: number }) {
  if (!petWindow) return null;
  const bounds = petWindow.getBounds();
  const nextWidth = Math.max(180, Math.min(640, bounds.width + Math.round(delta.x)));
  const nextHeight = Math.max(240, Math.min(900, bounds.height + Math.round(delta.y)));
  petWindow.setBounds({
    ...bounds,
    width: nextWidth,
    height: nextHeight
  });
  return { width: nextWidth, height: nextHeight };
}

export function resetPetPosition() {
  if (!petWindow) return;
  const display = screen.getPrimaryDisplay().workArea;
  petWindow.setPosition(display.x + display.width - 340, display.y + display.height - 440);
  petWindow.show();
  petWindow.focus();
}

export function applyPetWindowConfig(config: WindowConfig) {
  if (!petWindow) return;
  const bounds = petWindow.getBounds();
  petWindow.setBounds({ ...bounds, width: config.petWidth, height: config.petHeight });
  petWindow.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
  petWindow.setOpacity(config.opacity);
}

export function sendToChat(channel: string, payload: unknown) {
  chatWindow?.webContents.send(channel, payload);
}

export function sendConfigChanged(config: AppConfig) {
  petWindow?.webContents.send("config:changed", config);
  chatWindow?.webContents.send("config:changed", config);
  settingsWindow?.webContents.send("config:changed", config);
}

export function createTray() {
  if (tray) return tray;
  const icon = nativeImage.createFromPath(appIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Desktop Pet");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示/隐藏桌宠", click: () => (petWindow?.isVisible() ? petWindow.hide() : createPetWindow()) },
      { label: "打开聊天", click: () => toggleChatWindow() },
      { label: "设置", click: () => createSettingsWindow() },
      { label: "重置位置", click: () => resetPetPosition() },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
  return tray;
}

export function closeAllWindows() {
  petWindow?.close();
  chatWindow?.close();
  settingsWindow?.close();
}
