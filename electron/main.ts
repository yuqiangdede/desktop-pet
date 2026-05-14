import fs from "node:fs/promises";
import path from "node:path";
import { app, protocol } from "electron";
import { createPetWindow, createTray, ensurePetWindow } from "./windowManager";
import { getStoredConfig, registerIpc } from "./ipc";
import { resolveAssetRoot } from "./assetRegistry";

app.setName("Desktop Pet");
protocol.registerSchemesAsPrivileged([
  { scheme: "pet-asset", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

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

      const assetKey = decodeURIComponent(encodedBase);
      const baseDir = resolveAssetRoot(assetKey);
      if (!baseDir) return new Response("Missing asset root", { status: 404 });
      const relativePath = parts.map(decodeURIComponent).join(path.sep);
      const resolvedBase = path.resolve(baseDir);
      const resolvedFile = path.resolve(resolvedBase, relativePath);
      if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
        return new Response("Forbidden", { status: 403 });
      }

      const ext = path.extname(resolvedFile).toLowerCase();
      const contentType =
        ext === ".json"
          ? "application/json"
          : ext === ".png"
            ? "image/png"
            : ext === ".webm"
              ? "video/webm"
              : "application/octet-stream";
      const range = request.headers.get("range");
      if (range) {
        const stat = await fs.stat(resolvedFile);
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match) {
          const start = match[1] ? Number(match[1]) : 0;
          const end = match[2] ? Number(match[2]) : stat.size - 1;
          if (Number.isInteger(start) && Number.isInteger(end) && start <= end && end < stat.size) {
            const data = await fs.readFile(resolvedFile);
            return new Response(data.subarray(start, end + 1), {
              status: 206,
              headers: {
                "content-type": contentType,
                "accept-ranges": "bytes",
                "content-length": String(end - start + 1),
                "content-range": `bytes ${start}-${end}/${stat.size}`
              }
            });
          }
        }
      }

      const data = await fs.readFile(resolvedFile);
      return new Response(data, {
        headers: {
          "content-type": contentType,
          "accept-ranges": "bytes",
          "content-length": String(data.byteLength)
        }
      });
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
