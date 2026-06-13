#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const allocatorPath = join(scriptDir, "lane-allocator.ts");
const args = process.argv.slice(2);

if (args.length < 1) {
  process.stdout.write(`Usage: doc-lane.ts <allocate|release|path> [args]\n`);
  process.exit(64);
}

const cmd = args[0] ?? "";
const rest = args.slice(1);
let allocatorArgs: string[];

switch (cmd) {
  case "allocate":
    allocatorArgs = ["allocate", "doc", ...rest];
    break;
  case "release":
    allocatorArgs = ["release", "doc"];
    break;
  case "path":
    allocatorArgs = ["path", "doc"];
    break;
  default:
    process.stderr.write(`error: unknown command: ${cmd}\n`);
    process.stderr.write("       valid commands: allocate | release | path\n");
    process.exit(64);
}

// eslint-disable-next-line sonarjs/no-os-command-from-path -- lane wrappers intentionally delegate to the active Bun runtime.
const result = spawnSync("bun", [allocatorPath, ...allocatorArgs], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
