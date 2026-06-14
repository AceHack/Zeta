#!/usr/bin/env bun
/**
 * Zeta MCP launcher — resolves repo root from this script's path so MCP works
 * when the Cursor workspace root is the agent home (`~/.zeta/agents/cursor/`)
 * and the clone lives at `Zeta/` (B-0894.3 per-persona layout).
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

function fail(message: string): never {
  console.error(`zeta-mcp: ${message}`);
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const dll = resolve(repoRoot, "src/Core.FSharp.Mcp/bin/Release/net10.0/zeta-mcp.dll");
const fsproj = resolve(repoRoot, "src/Core.FSharp.Mcp/Zeta.Mcp.fsproj");

if (!existsSync(dll)) {
  const build = spawnSync(
    "dotnet",
    ["build", fsproj, "-c", "Release", "-v", "q"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (build.status !== 0) {
    if (build.stderr) console.error(build.stderr);
    fail("dotnet build failed");
  }
}

const child = spawn("dotnet", ["exec", dll], { stdio: "inherit", cwd: repoRoot });
child.on("error", (err) => fail(err.message));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
