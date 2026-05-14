const { execFileSync } = require("node:child_process");

function runPowerShell(command) {
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    stdio: "inherit",
    windowsHide: true
  });
}

runPowerShell(`
  $ErrorActionPreference = 'SilentlyContinue';
  try {
    Get-Process electron | Stop-Process -Force;
  } catch {}

  try {
    $owners = Get-NetTCPConnection -LocalPort 5173 -State Listen |
      Select-Object -ExpandProperty OwningProcess -Unique;
    foreach ($owner in $owners) {
      if ($owner -and $owner -ne $PID) {
        Stop-Process -Id $owner -Force;
      }
    }
  } catch {}

  exit 0;
`);

console.log("Cleaned Electron processes and Vite port 5173.");
