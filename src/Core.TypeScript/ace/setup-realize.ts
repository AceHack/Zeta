#!/usr/bin/env bun
// setup-realize.ts — Bun realizers for setup mechanism manifests (081KLL7… slice 1).
//
// Post-mise only: callers must run common/mise.sh first. Shell realizers in
// tools/setup/mechanisms/*.sh remain authoritative until linux.sh cutover.
//
// Usage:
//   bun src/Core.TypeScript/ace/setup-realize.ts --list
//   bun src/Core.TypeScript/ace/setup-realize.ts from-uv-tool from-bun-global
//   bun src/Core.TypeScript/ace/setup-realize.ts --all
//   bun src/Core.TypeScript/ace/setup-realize.ts --dry-run from-uv-tool

import {
  createContext,
  getSetupRealizer,
  listSetupRealizerIds,
} from "./setup-realizers/index.ts";

function usage(): void {
  process.stderr.write(`Usage: bun src/Core.TypeScript/ace/setup-realize.ts [--list|--all|--dry-run] [mechanism-id...]\n`);
  process.stderr.write(`Known Bun realizers: ${listSetupRealizerIds().join(", ")}\n`);
}

async function main(argv: string[]): Promise<number> {
  let dryRun = false;
  let all = false;
  const ids: string[] = [];

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--all") all = true;
    else if (arg === "--list") {
      for (const id of listSetupRealizerIds()) process.stdout.write(`${id}\n`);
      return 0;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      return 0;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      usage();
      return 64;
    } else {
      ids.push(arg);
    }
  }

  const targets = all ? [...listSetupRealizerIds()] : ids;
  if (targets.length === 0) {
    usage();
    return 64;
  }

  const ctx = createContext({ dryRun });
  for (const id of targets) {
    const realizer = getSetupRealizer(id);
    if (!realizer) {
      process.stderr.write(`error: unknown Bun realizer ${JSON.stringify(id)}\n`);
      return 64;
    }
    await realizer(ctx);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
