const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const viteUrl = "http://127.0.0.1:5173/";

function waitForVite(timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(viteUrl, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      request.on("error", retry);
      request.setTimeout(1500, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Vite dev server did not respond at ${viteUrl}`));
        return;
      }
      setTimeout(check, 400);
    };

    check();
  });
}

async function main() {
  console.log(`[dev:electron] waiting for ${viteUrl}`);
  await waitForVite();

  console.log("[dev:electron] compiling Electron main process");
  const tsc = spawnSync("npx", ["tsc", "-p", "electron/tsconfig.json"], {
    cwd: root,
    shell: true,
    stdio: "inherit"
  });

  if (tsc.status !== 0) {
    process.exit(tsc.status ?? 1);
  }

  console.log("[dev:electron] starting Electron");
  const electronBin = require("electron");
  const child = spawn(electronBin, ["."], {
    cwd: root,
    shell: false,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development"
    }
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[dev:electron] ${error.message}`);
  process.exit(1);
});
