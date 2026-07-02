#!/usr/bin/env bun
// setup-realize.ts — Bun realizers for setup mechanism manifests (081KLL7…).
//
// Post-mise realizers require common/mise.sh + PATH shims first. Pre-mise
// realizers (from-deb, from-shim, from-autotools-tarball) run after apt on Linux.
// Shell .sh realizers remain fallback when Bun is unavailable.
//
// Usage:
//   bun src/Core.TypeScript/ace/setup-realize.ts --list
//   bun src/Core.TypeScript/ace/setup-realize.ts --available from-uv-tool
//   bun src/Core.TypeScript/ace/setup-realize.ts from-uv-tool from-bun-global
//   bun src/Core.TypeScript/ace/setup-realize.ts --all
//   bun src/Core.TypeScript/ace/setup-realize.ts --pre-mise
//   bun src/Core.TypeScript/ace/setup-realize.ts --post-mise
//   bun src/Core.TypeScript/ace/setup-realize.ts --dry-run from-uv-tool

import {
  BEST_EFFORT_REALIZER_IDS,
  createContext,
  getSetupRealizer,
  hasSetupRealizer,
  listPostMiseRealizerIds,
  listPreMiseRealizerIds,
  listSetupRealizerIds,
  listSetupRealizerInstallOrder,
} from "./setup-realizers/index.ts";

function usage(): void {
  process.stderr.write(
    "Usage: bun src/Core.TypeScript/ace/setup-realize.ts [--list|--available ID|--all|--pre-mise|--post-mise|--dry-run] [mechanism-id...]\n",
  );
  process.stderr.write(`Known Bun realizers: ${listSetupRealizerIds().join(", ")}\n`);
}

async function runRealizer(id: string, dryRun: boolean): Promise<void> {
  const realizer = getSetupRealizer(id);
  if (!realizer) {
    throw new Error(`unknown Bun realizer ${JSON.stringify(id)}`);
  }
  const ctx = createContext({ dryRun });
  try {
    await realizer(ctx);
  } catch (err) {
    if (BEST_EFFORT_REALIZER_IDS.has(id)) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`⚠ ${id} failed — ${message}; continuing\n`);
      return;
    }
    throw err;
  }
}

async function main(argv: string[]): Promise<number> {
  let dryRun = false;
  let all = false;
  let preMise = false;
  let postMise = false;
  const ids: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--all") all = true;
    else if (arg === "--pre-mise") preMise = true;
    else if (arg === "--post-mise") postMise = true;
    else if (arg === "--list") {
      for (const id of listSetupRealizerInstallOrder()) process.stdout.write(`${id}\n`);
      return 0;
    } else if (arg === "--available") {
      const id = argv[i + 1];
      if (!id) {
        process.stderr.write("error: --available requires a mechanism id\n");
        return 64;
      }
      return hasSetupRealizer(id) ? 0 : 1;
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

  const phaseCount = Number(all) + Number(preMise) + Number(postMise);
  if (phaseCount > 1) {
    process.stderr.write("error: use only one of --all, --pre-mise, --post-mise\n");
    return 64;
  }

  const targets = all
    ? listSetupRealizerInstallOrder()
    : preMise
      ? listPreMiseRealizerIds()
      : postMise
        ? listPostMiseRealizerIds()
        : ids;

  if (targets.length === 0) {
    usage();
    return 64;
  }

  for (const id of targets) {
    await runRealizer(id, dryRun);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
