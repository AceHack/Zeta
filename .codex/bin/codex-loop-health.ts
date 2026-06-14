#!/usr/bin/env bun
/**
 * SHIM — health check is now `service-manager-cli.ts status --persona codex`.
 *
 * This file exists for backward compatibility.
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

const repoRoot = join(dirname(new URL(import.meta.url).pathname), "../..");
const cli = join(repoRoot, "src/Core.TypeScript/service/service-manager-cli.ts");

const result = spawnSync("bun", [cli, "status", "--persona", "codex"], {
  cwd: repoRoot,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
