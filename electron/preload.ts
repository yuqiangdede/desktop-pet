import { contextBridge, ipcRenderer } from "electron";
import type { DesktopPetApi } from "../src/types/desktopPetApi";
import type { ChatDelta, ChatDone, ChatError } from "../src/types/chat";

function subscribe<T>(channel: string, callback: (event: T) => void) {
  const handler = (_: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
}

const api: DesktopPetApi = {
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    save: (config) => ipcRenderer.invoke("config:save", config),
    reset: () => ipcRenderer.invoke("config:reset"),
    onChanged: (callback) => subscribe("config:changed", callback)
  },
  chat: {
    send: (messages) => ipcRenderer.invoke("chat:send", messages),
    stop: (requestId) => ipcRenderer.invoke("chat:stop", requestId),
    listSessions: () => ipcRenderer.invoke("chat:listSessions"),
    saveSessions: (sessions) => ipcRenderer.invoke("chat:saveSessions", sessions),
    testConnection: (config) => ipcRenderer.invoke("chat:testConnection", config),
    onDelta: (callback) => subscribe<ChatDelta>("chat:delta", callback),
    onDone: (callback) => subscribe<ChatDone>("chat:done", callback),
    onError: (callback) => subscribe<ChatError>("chat:error", callback)
  },
  character: {
    list: () => ipcRenderer.invoke("character:list"),
    pickVideoFile: () => ipcRenderer.invoke("character:pickVideoFile"),
    pickImageFile: () => ipcRenderer.invoke("character:pickImageFile"),
    importVideoFile: (sourcePath, displayName) => ipcRenderer.invoke("character:importVideoFile", sourcePath, displayName),
    importImageFile: (sourcePath, displayName) => ipcRenderer.invoke("character:importImageFile", sourcePath, displayName),
    setActive: (id) => ipcRenderer.invoke("character:setActive", id),
    delete: (id) => ipcRenderer.invoke("character:delete", id),
    restoreDefault: () => ipcRenderer.invoke("character:restoreDefault")
  },
  window: {
    toggleChat: () => ipcRenderer.invoke("window:toggleChat"),
    openSettings: () => ipcRenderer.invoke("window:openSettings"),
    dragMove: (delta) => ipcRenderer.invoke("window:dragMove", delta),
    resizePet: (delta) => ipcRenderer.invoke("window:resizePet", delta),
    resetPetPosition: () => ipcRenderer.invoke("window:resetPetPosition")
  }
};

contextBridge.exposeInMainWorld("desktopPet", api);
