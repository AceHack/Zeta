#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/run-loop-real.ts — the real observe loop, wired end-to-end.
 *
 * Connects the three completed subsystems:
 *   loadWorld()                → real World from backlog + event log + operator channel
 *   observeWithParticipant()  → configurable chooser (oracle/local-llm/cloud-persona/human)
 *   execute(sink)             → real EventSink (folder-direct-to-main)
 *
 * This is ONE TICK. The autonomous-loop cron calls this once per tick; the cron
 * cadence is the heartbeat (not an infinite loop inside this script). Exits 0
 * on success, 1 on execute failure, 2 on loadWorld failure.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/run-loop-real.ts [--by <agentId>] [--event-dir <path>]
 *   bun src/Core.TypeScript/observe/run-loop-real.ts --dry-run
 *   bun src/Core.TypeScript/observe/run-loop-real.ts --participant local-llm
 *   bun src/Core.TypeScript/observe/run-loop-real.ts --participant cloud:amara
 *
 * Flags:
 *   --by <id>             Agent identity (default: "alexa", from ZETA_AGENT_ID env)
 *   --event-dir <p>       Event log folder (default: "docs/observe-events")
 *   --dry-run             Load world + pick action but don't execute (print the pick)
 *   --repo-root <p>       Repo root for backlog reader (default: process.cwd())
 *   --participant <spec>  Chooser: "oracle" | "local-llm" | "local-llm:<model>" | "cloud:<persona>"
 *                         (default: ZETA_PARTICIPANT env or "oracle")
 */

import { loadWorld } from "./load-world";
import { renderAction } from "./observe";
import { execute, type OperatorPort } from "./execute";
import { folderSink } from "./event-sink-folder";
import { resolveForgeHost } from "../forge-host/registry";
import { readPRStateAsync } from "./world-infra";
import "../forge-host/github/index"; // registers the GitHub adapter
import { portExecuteItem } from "./kiro-executor-v2";
import { codegenExecuteItem } from "./codegen-executor";
import { realWorkspacePort, type WorkspacePort } from "./workspace-port";
import type { DoItemOptions } from "./do-item";
import {
  observeWithParticipant,
  oracleParticipant,
  localLlmParticipant,
  cloudPersonaParticipant,
  type Participant,
} from "./participant";
import { PersonaSummoner } from "../peer-call/summon";

interface CliArgs {
  by: string;
  eventDir: string;
  repoRoot: string;
  dryRun: boolean;
  participant: string; // "oracle" | "local-llm" | "local-llm:<model>" | "cloud:<persona>"
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    by: process.env.ZETA_AGENT_ID ?? "alexa",
    eventDir: "docs/observe-events",
    repoRoot: process.cwd(),
    dryRun: false,
    participant: process.env.ZETA_PARTICIPANT ?? "oracle",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--by" && argv[i + 1]) {
      args.by = argv[++i]!;
    } else if (arg === "--event-dir" && argv[i + 1]) {
      args.eventDir = argv[++i]!;
    } else if (arg === "--repo-root" && argv[i + 1]) {
      args.repoRoot = argv[++i]!;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--participant" && argv[i + 1]) {
      args.participant = argv[++i]!;
    }
  }
  return args;
}

/**
 * Resolve a CLI participant spec string to a concrete Participant.
 *
 * Formats:
 *   "oracle"            → oracleParticipant()
 *   "local-llm"        → localLlmParticipant() (default model)
 *   "local-llm:<model>"→ localLlmParticipant({ model })
 *   "cloud:<persona>"  → cloudPersonaParticipant(PersonaSummoner, persona)
 */
function resolveParticipant(spec: string): Participant {
  if (spec === "oracle") return oracleParticipant();
  if (spec === "local-llm") return localLlmParticipant();
  if (spec.startsWith("local-llm:")) {
    const model = spec.slice("local-llm:".length);
    return localLlmParticipant({ model });
  }
  if (spec.startsWith("cloud:")) {
    const persona = spec.slice("cloud:".length);
    return cloudPersonaParticipant(new PersonaSummoner(), persona);
  }
  // Unknown spec — warn and degrade to oracle (safe default)
  console.warn(`[participant] unknown spec "${spec}" — falling back to oracle`);
  return oracleParticipant();
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // 1. Load the real world
  const world = loadWorld({
    eventDir: args.eventDir,
    repoRoot: args.repoRoot,
  });

  // 1b. Resolve ForgeHost and query PR state (async, host-agnostic)
  const forgeResult = resolveForgeHost(args.repoRoot);
  let forgeState: import("./observe").ForgeState | undefined;
  if (forgeResult.ok) {
    const prState = await readPRStateAsync(forgeResult.value);
    if (prState.ok) {
      forgeState = {
        openPrCount: prState.open.length,
        cleanPrCount: prState.clean.length,
        cleanPrNumbers: prState.clean.map((pr) => pr.number),
      };
      console.log(`[forge:${forgeResult.value.forgeName}] ${forgeState.openPrCount} open PRs, ${forgeState.cleanPrCount} clean`);
    } else {
      // PR read FAILED (auth / rate-limit / network). Do NOT fall through to a
      // zero-PR forgeState — that would read as "no PR work" and the loop would
      // go quiet. Leave forgeState undefined (same as forge-not-resolved): the
      // loop proceeds without PR data rather than on FALSE PR data.
      console.error(
        `[forge] PR state read FAILED: ${prState.error instanceof Error ? prState.error.message : String(prState.error)} ` +
          `— continuing WITHOUT PR state (NOT treating as zero PRs)`,
      );
    }
  } else {
    console.log(`[forge] not resolved: ${forgeResult.error.message} (continuing without PR state)`);
  }

  // Enrich world with forge state
  const enrichedWorld = forgeState ? { ...world, forgeState } : world;

  // 2b. Mode override: when ZETA_EXECUTOR=codegen is set and there's backlog work,
  // clear the persisted free mode so the oracle defaults to do_item. This is the
  // "work-hours" signal: arming the codegen executor IS the operator saying
  // "I want work done." The agent can still pick free modes from the menu (NCI
  // preserved) but the deterministic default shifts to work.
  const executorMode = process.env.ZETA_EXECUTOR ?? "port";
  const observeWorld = (executorMode === "codegen" && enrichedWorld.backlog.length > 0 && enrichedWorld.mode !== "work")
    ? (() => { const { mode: _, ...rest } = enrichedWorld; return rest; })()
    : enrichedWorld;

  // 2. Pick the next action (via Participant — configurable chooser)
  const participant = resolveParticipant(args.participant);
  console.log(`[participant] ${participant.kind}:${participant.name}`);
  const action = await observeWithParticipant(observeWorld, participant);

  console.log(`[observe] ${renderAction(action)}`);

  if (args.dryRun) {
    console.log("[dry-run] would execute — exiting without side-effects");
    return 0;
  }

  // 3. Execute the pick (real sink + WorkspacePort-based executor for do_item)
  const sink = folderSink({ eventDir: args.eventDir, by: args.by });

  // Wire the executor for do_item: codegen (Claude CLI) or port (claim-only).
  // ZETA_EXECUTOR=codegen enables autonomous code generation via the Claude CLI.
  // Default is "port" (claim-file-only, the safe fallback).
  const port: WorkspacePort = realWorkspacePort(args.repoRoot);
  const executor: import("./do-item").CommandExecutor = {
    tier: "just-bash",
    run: async (_spec) => {
      if (action.kind !== "do_item") {
        return { ok: true, stdout: "no-op (non-do_item)", exitCode: 0 as const };
      }
      if (executorMode === "codegen") {
        return codegenExecuteItem(action.item, {
          repoRoot: args.repoRoot,
          agentId: args.by,
          dryRun: args.dryRun,
        });
      }
      // merge-pr items always route through codegenExecuteItem (which handles the merge)
      if (action.item.id.startsWith("merge-pr-")) {
        return codegenExecuteItem(action.item, {
          repoRoot: args.repoRoot,
          agentId: args.by,
          dryRun: args.dryRun,
        });
      }
      return portExecuteItem(port, action.item, args.by);
    },
  };

  // Build DoItemOptions for the port executor path.
  // The RunSpec.script is a no-op placeholder — execution goes through the port.
  const doItemOpts: DoItemOptions | undefined = action.kind === "do_item"
    ? { spec: { script: "# port-executor: no bash", cwd: args.repoRoot }, gated: false }
    : undefined;

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

  const result = await execute(enrichedWorld, action, sink, executor, doItemOpts, operatorPort);

  if (!result.ok) {
    console.error(
      `[execute] FAILED: ${result.feedback.kind} — ${result.feedback.kind === "append-failed" ? result.feedback.reason : result.feedback.actionKind}`,
    );
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
