const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src", "assets", "characters");
const targetDir = path.join(root, "dist", "characters");

if (!fs.existsSync(sourceDir)) {
  throw new Error(`找不到角色资源目录：${sourceDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Copied characters from ${sourceDir} to ${targetDir}`);
