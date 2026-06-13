#!/usr/bin/env bun
/**
 * tools/observe/run-loop-real.ts — the real observe loop, wired end-to-end.
 *
 * Connects the three completed subsystems:
 *   loadWorld()    → real World from backlog + event log + operator channel
 *   observe()     → pure deterministic action pick (the oracle)
 *   execute(sink) → real EventSink (folder-direct-to-main)
 *
 * This is ONE TICK. The autonomous-loop cron calls this once per tick; the cron
 * cadence is the heartbeat (not an infinite loop inside this script). Exits 0
 * on success, 1 on execute failure, 2 on loadWorld failure.
 *
 * Usage:
 *   bun tools/observe/run-loop-real.ts [--by <agentId>] [--event-dir <path>]
 *   bun tools/observe/run-loop-real.ts --dry-run
 *
 * Flags:
 *   --by <id>         Agent identity (default: "alexa", from ZETA_AGENT_ID env)
 *   --event-dir <p>   Event log folder (default: "docs/observe-events")
 *   --dry-run         Load world + pick action but don't execute (print the pick)
 *   --repo-root <p>   Repo root for backlog reader (default: process.cwd())
 */

import { loadWorld } from "./load-world";
import { observe, renderAction } from "./observe";
import { execute, type OperatorPort } from "./execute";
import { folderSink } from "./event-sink-folder";

interface CliArgs {
  by: string;
  eventDir: string;
  repoRoot: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    by: process.env.ZETA_AGENT_ID ?? "alexa",
    eventDir: "docs/observe-events",
    repoRoot: process.cwd(),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--by" && argv[i + 1]) { args.by = argv[++i]!; }
    else if (arg === "--event-dir" && argv[i + 1]) { args.eventDir = argv[++i]!; }
    else if (arg === "--repo-root" && argv[i + 1]) { args.repoRoot = argv[++i]!; }
    else if (arg === "--dry-run") { args.dryRun = true; }
  }
  return args;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // 1. Load the real world
  const world = loadWorld({
    eventDir: args.eventDir,
    repoRoot: args.repoRoot,
  });

  // 2. Pick the next action (pure oracle)
  const action = observe(world);

  console.log(`[observe] ${renderAction(action)}`);

  if (args.dryRun) {
    console.log("[dry-run] would execute — exiting without side-effects");
    return 0;
  }

  // 3. Execute the pick (real sink + no executor/operatorPort for now —
  //    do_item and operator actions will return not-yet-executable until
  //    those adapters are wired in a follow-up)
  const sink = folderSink({ eventDir: args.eventDir, by: args.by });

  // Placeholder OperatorPort — just logs; real implementation writes to transcript
  const operatorPort: OperatorPort = {
    preserveFerry: async (content) => {
      console.log(`[preserve_ferry] ${content.slice(0, 80)}${content.length > 80 ? "..." : ""}`);
      return { ok: true, path: "ferry/preserved.md" };
    },
    emitResponse: async (text) => {
      console.log(`[respond] ${text}`);
      return { ok: true };
    },
  };

  const result = await execute(world, action, sink, undefined, undefined, operatorPort);

  if (!result.ok) {
    console.error(`[execute] FAILED: ${result.feedback.kind} — ${result.feedback.kind === "append-failed" ? result.feedback.reason : result.feedback.actionKind}`);
    return 1;
  }

  console.log(`[execute] OK — eventId=${result.eventId}, mode=${result.world.mode ?? "unset"}`);
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[fatal] ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    },
  );
}

export { main, parseArgs };
