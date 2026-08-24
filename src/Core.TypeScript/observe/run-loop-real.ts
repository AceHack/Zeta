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
import { firstBrokenLink } from "./phase-erasure";
import { createRealtimeClient } from "./realtime-client";
import type { RealtimeEvent } from "./realtime-server";
import { resolveForgeHost } from "../forge-host/registry";
import { readPRStateAsync } from "./world-infra";
import "../forge-host/github/index"; // registers the GitHub adapter
import { portExecuteItem } from "./kiro-executor-v2";
import { codegenExecuteItem } from "./codegen-executor";
import { realWorkspacePort, type WorkspacePort } from "./workspace-port";
import type { DoItemOptions } from "./do-item";
import {
  oracleParticipant,
  localLlmParticipant,
  cloudPersonaParticipant,
  type Participant,
} from "./participant";
import { buildMenu, actionLabel } from "./observe";
import { recordReasoning, formatReasoning, type TickReasoning } from "./tick-reasoning";
import { PersonaSummoner } from "../peer-call/summon";
import { createPhaseClock, stampPhase, type PhaseClock } from "./phase-clock";
import { createRSAccumulator } from "./rs-phase-accumulator";

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

  // Capture the reasoning alongside the action — makes the small LLM's intelligence visible.
  const menu = buildMenu(observeWorld);
  let chooseResult: { index: number; raw: string; fallback: boolean };
  try {
    chooseResult = await participant.choose(observeWorld, menu);
  } catch {
    chooseResult = { index: 0, raw: "choose-threw", fallback: true };
  }
  const action = menu[chooseResult.index] ?? menu[0]!;

  // Record + log the reasoning (non-fatal)
  const reasoning: TickReasoning = {
    agent: args.by,
    model: participant.name,
    // `observeWorld` is a union: the codegen branch above DELIBERATELY strips `mode`,
    // so one arm has no such property and a direct read does not typecheck. The `in`
    // guard is not a workaround for the type -- it reports what the participant
    // ACTUALLY SAW. When the field was stripped, the participant saw no mode, and
    // "unset" is the true record of the tick rather than a value recovered from a
    // world the chooser was never shown.
    context: `backlog=${observeWorld.backlog.length}, mode=${
      "mode" in observeWorld ? (observeWorld.mode ?? "unset") : "unset"
    }`,
    options: menu.map(actionLabel),
    chosenIndex: chooseResult.index,
    chosen: actionLabel(action),
    raw: chooseResult.raw,
    fallback: chooseResult.fallback,
    at: new Date().toISOString(),
  };
  recordReasoning(args.repoRoot, reasoning);
  console.log(formatReasoning(reasoning));

  console.log(`[observe] ${renderAction(action)}`);

  if (args.dryRun) {
    console.log("[dry-run] would execute — exiting without side-effects");
    return 0;
  }

  // 3. Execute the pick (real sink + WorkspacePort-based executor for do_item)
  // ZETA_SINK_MODE=local: skip git commit/push in the sink (the workflow script
  // handles commit+push separately — needed for heartbeat branch mode where the
  // sink can't push to main directly).
  const sinkMode = process.env.ZETA_SINK_MODE ?? "git";
  const localCommit = sinkMode === "local"
    ? (_filePath: string, _envelope: import("./event-sink-folder").EventEnvelope): import("./event-sink-folder").CommitOutcome => ({ ok: true })
    : undefined;

  // The phase clock: time as a 4th traveler. Created BEFORE the sink so append IS tick.
  // Each agent carries its own phase clock — no wall-clock needed for multi-planet.
  // PERSISTENCE: resume from the highest phase this agent has ever produced.
  // Missed ticks between sessions are erasures — the ECC (Reed-Solomon) covers the gap.
  // You don't need every intermediate tick, just the latest anchor to continue.
  const resumePoint = (() => {
    try {
      const { readdirSync, readFileSync } = require("node:fs") as typeof import("node:fs");
      const { join } = require("node:path") as typeof import("node:path");
      const files = readdirSync(args.eventDir).filter((f: string) => f.endsWith(".json")).sort();
      // Read the last ~20 events (most recent) to find our highest phase
      const recent = files.slice(-20);
      // Collect OUR OWN stamps so the resume point can be verified as a chain, not
      // merely trusted because it was on disk. Before 2026-08-10 this path took
      // `raw.phase.derived` straight off the filesystem and seeded the clock with it,
      // with no verification anywhere in production (Kira, P1).
      const own: { phase: number; seed: number }[] = [];
      for (const f of recent) {
        try {
          const raw = JSON.parse(readFileSync(join(args.eventDir, f), "utf-8"));
          if (raw.by !== args.by) continue;
          const phase = raw.phase?.phase;
          const seed = raw.phase?.derived;
          if (Number.isSafeInteger(phase) && Number.isSafeInteger(seed)) own.push({ phase, seed });
        } catch { /* skip malformed */ }
      }
      if (own.length === 0) return undefined;
      own.sort((a, b) => a.phase - b.phase);

      // Verify the chain we are about to trust. `verifyFromAnchor` is anchor-relative,
      // so it works on RESUMED state — which genesis-derivation could not, and which is
      // why the old verifier had no production callers.
      const stamps = own.map((s) => ({
        ...s,
        lastAdvanceReason: "init" as const,
        wallClockAt: "",
      }));
      const broken = firstBrokenLink(stamps);
      if (broken >= 0) {
        // REPORT, do not refuse. A broken self-chain means local corruption or tampering
        // — something this process cannot repair, and refusing to start would brick the
        // agent over it. Policy for a broken chain belongs to the operator; this makes
        // the condition visible instead of silently absorbing it.
        console.warn(
          `[phase] CHAIN BROKEN at index ${broken} (phase ${stamps[broken]!.phase}): ` +
            `stamp does not continue its predecessor. Resuming anyway; this is a drift signal.`,
        );
      } else if (stamps.length > 1) {
        console.log(`[phase] chain verified across ${stamps.length} own stamps`);
      }
      const last = own[own.length - 1]!;
      return { phase: last.phase, seed: last.seed };
    } catch { return undefined; }
  })();
  const phaseClock: PhaseClock = createPhaseClock(undefined, resumePoint);
  if (resumePoint) {
    console.log(`[phase] resumed from phase ${resumePoint.phase} (seed: ${resumePoint.seed})`);
  }

  // MULTI-PLANET CONVERGENCE: observe peer phases to jump to the causal frontier.
  // If peers are ahead of us, one observe() call catches us up — no replay needed.
  // This is the HLC merge: max(ours, theirs) + 1 on next tick.
  (() => {
    try {
      const { readdirSync, readFileSync } = require("node:fs") as typeof import("node:fs");
      const { join } = require("node:path") as typeof import("node:path");
      const files = readdirSync(args.eventDir).filter((f: string) => f.endsWith(".json")).sort();
      const recent = files.slice(-50); // scan more events for peer phases
      let peerMaxPhase = -1;
      for (const f of recent) {
        try {
          const raw = JSON.parse(readFileSync(join(args.eventDir, f), "utf-8"));
          if (raw.by !== args.by && raw.phase?.phase > peerMaxPhase) {
            peerMaxPhase = raw.phase.phase;
          }
        } catch { /* skip */ }
      }
      if (peerMaxPhase > phaseClock.state.phase) {
        phaseClock.observe(peerMaxPhase);
        console.log(`[phase] observed peer at phase ${peerMaxPhase} → advanced to ${phaseClock.state.phase}`);
      }
    } catch { /* no events to observe — fine */ }
  })();

  const sink = folderSink({ eventDir: args.eventDir, by: args.by, phaseClock, ...(localCommit ? { commit: localCommit } : {}) });

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

  // 4. The unity: append IS tick IS measurement IS Landauer cost.
  // The phase advanced during append. The entropy was paid during append.
  // The clock ticked because the event landed. These are not three things — they're one.
  const phase = stampPhase(phaseClock);
  console.log(`[phase] tick ${phase.phase} (derived: ${phase.derived}) — append IS tick IS measurement`);

  // 4b. RS ECC accumulator: every 12 ticks, emit a recoverable block.
  // The accumulator bridges per-tick stamps to per-block RS codewords.
  // On emission, the block is logged (and could be written to data/rs-blocks.json
  // or pushed over the realtime channel for peer verification).
  //
  // PERSISTENCE FIX (2026-08-20): the old .rs-buffer-{agent}.json approach failed because
  // the heartbeat workflow resets the branch from main every tick (git checkout -B), which
  // destroys any file not on main. The buffer was on the branch → wiped every tick → blocks
  // always started at phase 1 → `phases 1–1` in the output.
  //
  // New approach: reconstruct the buffer from data/rs-blocks.jsonl (which IS on main) +
  // the event log. Read the last emitted block's seq and endPhase, then collect own stamps
  // from the event log that are AFTER that phase. This is idempotent and branch-reset-safe.
  const rsResumeBuffer = (() => {
    try {
      const { readFileSync, readdirSync } = require("node:fs") as typeof import("node:fs");
      const { join } = require("node:path") as typeof import("node:path");

      // 1. Find the last block this agent emitted (from data/rs-blocks.jsonl on main)
      const blocksPath = join(args.repoRoot, "data", "rs-blocks.jsonl");
      let lastSeq = -1;
      let lastEndPhase = -1;
      try {
        const lines = readFileSync(blocksPath, "utf-8").trim().split("\n");
        for (const line of lines) {
          if (!line) continue;
          try {
            const block = JSON.parse(line);
            if (block.agent === args.by && Number.isSafeInteger(block.seq) && block.seq > lastSeq) {
              lastSeq = block.seq;
              lastEndPhase = block.endPhase ?? -1;
            }
          } catch { /* skip */ }
        }
      } catch { /* no blocks file yet */ }

      if (lastSeq < 0) {
        // No blocks emitted yet — start fresh
        return undefined;
      }

      // 2. Collect own stamps from the event log that are AFTER the last block's endPhase
      const files = readdirSync(args.eventDir).filter((f: string) => f.endsWith(".json")).sort();
      const recentFiles = files.slice(-50); // scan recent events
      const buffer: { phase: number; derived: number }[] = [];
      for (const f of recentFiles) {
        try {
          const raw = JSON.parse(readFileSync(join(args.eventDir, f), "utf-8"));
          if (raw.by !== args.by) continue;
          const p = raw.phase?.phase;
          const d = raw.phase?.derived;
          if (Number.isSafeInteger(p) && Number.isSafeInteger(d) && p > lastEndPhase) {
            buffer.push({ phase: p, derived: d });
          }
        } catch { /* skip */ }
      }
      buffer.sort((a, b) => a.phase - b.phase);

      // Cap at 11 (buffer emits at 12)
      const trimmed = buffer.slice(0, 11);
      if (trimmed.length > 0) {
        console.log(`[rs-ecc] reconstructed buffer: ${trimmed.length} stamps after block #${lastSeq} (endPhase=${lastEndPhase})`);
      }
      return { resumeBuffer: trimmed, startSeq: lastSeq + 1 };
    } catch { return undefined; }
  })();
  const rsAccumulator = createRSAccumulator(rsResumeBuffer);
  const rsResult = rsAccumulator.push(phase);
  if (rsResult.emitted) {
    console.log(
      `[rs-ecc] block #${rsResult.block.blockSeq} emitted: phases ${rsResult.block.startPhase}–${rsResult.block.endPhase}, ` +
        `${rsResult.block.coded.length} coded symbols (4 erasures recoverable)`,
    );
    // Persist the emitted block to data/rs-blocks.jsonl (append-only ledger).
    // Peers can read this file to recover missed phases via Lagrange interpolation.
    // The file lives under data/ (served by Pages) so it's publicly readable.
    try {
      const blocksPath = require("node:path").join(args.repoRoot, "data", "rs-blocks.jsonl");
      const blockRecord = JSON.stringify({
        agent: args.by,
        seq: rsResult.block.blockSeq,
        startPhase: rsResult.block.startPhase,
        endPhase: rsResult.block.endPhase,
        coded: rsResult.block.coded,
        emittedAt: new Date().toISOString(),
      });
      require("node:fs").appendFileSync(blocksPath, blockRecord + "\n");
      console.log(`[rs-ecc] appended to data/rs-blocks.jsonl`);
    } catch { /* non-fatal — block still logged, just not persisted */ }
  } else {
    console.log(`[rs-ecc] buffered ${rsResult.buffered}/12 toward next block`);
  }
  // Buffer state is now reconstructed from rs-blocks.jsonl + event log each tick.
  // No sidecar file needed — branch resets can't destroy what lives on main.

  if (!result.ok) {
    console.error(
      `[execute] FAILED: ${result.feedback.kind} — ${result.feedback.kind === "append-failed" ? result.feedback.reason : result.feedback.actionKind}`,
    );
    return 1;
  }

  console.log(`[execute] OK — eventId=${result.eventId}, mode=${result.world.mode ?? "unset"}`);

  // 5. Push the event over WebSocket if ZETA_REALTIME_URL is set.
  //    Makes heartbeats visible in real-time on the settlement page instead of
  //    waiting for the 15-minute flush. Fire-and-forget: a push failure does NOT
  //    fail the tick (the event is already durably appended to the folder sink).
  //    Declared, metered channel (§13): opt-in via env var, never ambient.
  const realtimeUrl = process.env.ZETA_REALTIME_URL;
  if (realtimeUrl) {
    const realtimeEvent: RealtimeEvent = {
      id: result.eventId,
      at: new Date().toISOString(),
      by: args.by,
      action: { kind: action.kind },
      phase: phase.phase,
      entropy: { state: phase.derived, heat: 0 },
    };
    const rtClient = createRealtimeClient({
      url: realtimeUrl,
      timeoutMs: 3000,
      autoReconnect: false,
    });
    try {
      const pushResult = await rtClient.push(realtimeEvent);
      if (pushResult.ok) {
        console.log(`[realtime] pushed eventId=${pushResult.eventId} to ${realtimeUrl}`);
      } else {
        console.warn(`[realtime] push failed (non-fatal): ${pushResult.reason}`);
      }
    } catch (err) {
      console.warn(`[realtime] push error (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      rtClient.close();
    }
  }

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
