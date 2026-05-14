import fs from "node:fs/promises";
import path from "node:path";
import { app, protocol } from "electron";
import { createPetWindow, createTray, ensurePetWindow } from "./windowManager";
import { getStoredConfig, registerIpc } from "./ipc";

app.setName("Desktop Pet");
protocol.registerSchemesAsPrivileged([{ scheme: "pet-asset", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  createPetWindow();
});

app.whenReady().then(() => {
  protocol.handle("pet-asset", async (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const encodedBase = parts.shift();
      if (!encodedBase) return new Response("Missing asset base", { status: 400 });

      const baseDir = Buffer.from(encodedBase, "base64url").toString("utf-8");
      const relativePath = parts.map(decodeURIComponent).join(path.sep);
      const resolvedBase = path.resolve(baseDir);
      const resolvedFile = path.resolve(resolvedBase, relativePath);
      if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
        return new Response("Forbidden", { status: 403 });
      }

      const data = await fs.readFile(resolvedFile);
      const ext = path.extname(resolvedFile).toLowerCase();
      const contentType = ext === ".json" ? "application/json" : ext === ".png" ? "image/png" : "application/octet-stream";
      return new Response(data, { headers: { "content-type": contentType } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  registerIpc();
  ensurePetWindow(getStoredConfig());
  createTray();
});

app.on("activate", () => {
  createPetWindow();
});

app.on("window-all-closed", () => {
  // Keep the app alive in the tray until the user selects Exit.
});
