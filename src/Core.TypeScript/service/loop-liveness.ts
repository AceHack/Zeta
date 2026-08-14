#!/usr/bin/env bun
// service/loop-liveness.ts — externalized liveness check for persona loop cells.
//
// WHY THIS EXISTS
// ---------------
// Four persona cells (otto, alexa, vera, lior) were dead from 2026-06-13 to
// 2026-08-14 — two months — and nothing noticed. The reason is that the only
// liveness surface we had, `IServiceManager.status()`, CANNOT DISTINGUISH a
// healthy interval-scheduled loop from a permanently broken one:
//
//   ServiceState = "installed-running" | "installed-stopped" | "not-installed"
//
// and `adapters/launchd.ts` derives it from `stdout.includes("state = running")`.
// Measured on the live machine 2026-08-14:
//
//   healthy kiro-loop   ->  "state = not running"      -> installed-stopped
//   dead otto (exit 78) ->  "state = spawn scheduled"  -> installed-stopped
//
// Identical verdict for a working cell and a two-month-dead cell. A StartInterval
// loop is *supposed* to be "not running" between ticks, so the one state that
// could have carried the signal is the one that is normal. The check could not
// fail — the vacuity class (`toy-is-free-metered-must-be-earned`).
//
// The discriminating fact was sitting in the same `launchctl print` output the
// adapter already read, and nothing parsed it:
//
//   last exit code = 78: EX_CONFIG
//
// THE DISCIPLINE THIS EXTENDS
// ---------------------------
// `CLAUDE.md` "Heartbeat-via-commit = externalized idle counter": the narrative
// self-counter is unreliable, so liveness must be read off an EXTERNAL artifact
// the work itself had to produce. That rule externalizes an agent's own idleness
// into `git log`. This module is the same rule applied one layer down — to the
// scheduler that is supposed to be waking the agent at all — and it deliberately
// reuses the artifact `loop-tick.ts` already writes rather than inventing a
// parallel signal:
//
//   <stateDir>/heartbeats/<persona>-tick.json  { "updated_at": "...", ... }
//
// A dead loop that still *appears* live is precisely the standing-by failure:
// a check that did not run looking like one that passed.
//
// TWO SIGNALS, DELIBERATELY (neither alone is sufficient)
// -------------------------------------------------------
//   launchd exit code — proves the scheduler tried and the unit refused to
//     start. Cannot tell you the loop is doing useful work.
//   heartbeat freshness — proves a tick actually completed and wrote its
//     artifact. Cannot distinguish "broken" from "deliberately unloaded".
// Requiring both is what makes the verdict honest in each direction.
//
// Usage:
//   bun src/Core.TypeScript/service/loop-liveness.ts                 # check installed cells
//   bun src/Core.TypeScript/service/loop-liveness.ts --json          # machine-readable
//   bun src/Core.TypeScript/service/loop-liveness.ts --persona otto  # one cell
//   bun src/Core.TypeScript/service/loop-liveness.ts --assert-persona otto
//
// Exit codes:
//   0 — every INSTALLED cell is healthy (not-installed cells are not failures)
//   1 — at least one installed cell is failing or stale
//   2 — tooling / input error

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { listPersonas, getPersona } from "./persona-registry";
import { defaultPaths } from "./env-schema";

// ---------------------------------------------------------------------------
// Pure core — classification over already-gathered facts.
// No IO here, so it is directly testable and DST-replayable.
// ---------------------------------------------------------------------------

/** Raw facts about one cell, gathered by the IO shell (or supplied by a test). */
export interface CellFacts {
  readonly persona: string;
  readonly label: string;
  /** false when `launchctl print` could not find the unit at all. */
  readonly unitFound: boolean;
  /** launchd's `last exit code = N`. undefined when absent/unparsed. */
  readonly lastExitCode: number | undefined;
  /** launchd's `state = ...` line, verbatim. */
  readonly launchdState: string | undefined;
  /** ms since the heartbeat artifact's `updated_at`. undefined when no artifact. */
  readonly heartbeatAgeMs: number | undefined;
  /** Age beyond which a heartbeat is stale, in ms. */
  readonly staleAfterMs: number;
}

export type Verdict = "healthy" | "failing" | "stale" | "not-installed";

export interface CellReport {
  readonly persona: string;
  readonly label: string;
  readonly verdict: Verdict;
  readonly reason: string;
}

/**
 * Classify one cell. The ordering is deliberate: a nonzero launchd exit code is
 * reported ahead of heartbeat staleness because it is the PROXIMATE cause — a
 * unit that cannot spawn will also have a stale heartbeat, and naming the stale
 * heartbeat first would bury the actual defect.
 */
export function classify(facts: CellFacts): CellReport {
  const base = { persona: facts.persona, label: facts.label };

  if (!facts.unitFound) {
    return { ...base, verdict: "not-installed", reason: "no launchd unit for this label" };
  }

  // THE discriminator the old ServiceState threw away.
  if (facts.lastExitCode !== undefined && facts.lastExitCode !== 0) {
    return {
      ...base,
      verdict: "failing",
      reason: `launchd last exit code = ${facts.lastExitCode}${facts.lastExitCode === 78 ? " (EX_CONFIG — bad program path or plist)" : ""}`,
    };
  }

  if (facts.heartbeatAgeMs === undefined) {
    return { ...base, verdict: "stale", reason: "unit is installed but has never written a heartbeat artifact" };
  }

  if (facts.heartbeatAgeMs > facts.staleAfterMs) {
    return {
      ...base,
      verdict: "stale",
      reason: `heartbeat is ${Math.round(facts.heartbeatAgeMs / 1000)}s old (stale after ${Math.round(facts.staleAfterMs / 1000)}s)`,
    };
  }

  return {
    ...base,
    verdict: "healthy",
    reason: `exit 0, heartbeat ${Math.round(facts.heartbeatAgeMs / 1000)}s old`,
  };
}

/** A run fails when any INSTALLED cell is not healthy. */
export function isFailure(reports: readonly CellReport[]): boolean {
  return reports.some((r) => r.verdict === "failing" || r.verdict === "stale");
}

// ---------------------------------------------------------------------------
// IO shell
// ---------------------------------------------------------------------------

/** Parse the fields we care about out of `launchctl print` output. */
export function parseLaunchctlPrint(stdout: string): {
  lastExitCode: number | undefined;
  launchdState: string | undefined;
} {
  const exitMatch = /last exit code = (\d+)/.exec(stdout);
  const stateMatch = /^\s*state = (.+)$/m.exec(stdout);
  return {
    lastExitCode: exitMatch ? Number(exitMatch[1]) : undefined,
    launchdState: stateMatch ? stateMatch[1]!.trim() : undefined,
  };
}

function uid(): string {
  return String(process.getuid?.() ?? 0);
}

/** Read `updated_at` from the heartbeat artifact loop-tick.ts writes. */
export function heartbeatAgeMs(stateDir: string, persona: string, now: number): number | undefined {
  const hbFile = join(stateDir, "heartbeats", `${persona}-tick.json`);
  if (!existsSync(hbFile)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(hbFile, "utf8")) as { updated_at?: string };
    if (!parsed.updated_at) return undefined;
    const ts = Date.parse(parsed.updated_at);
    if (Number.isNaN(ts)) return undefined;
    return now - ts;
  } catch {
    return undefined;
  }
}

/**
 * Every launchd label a cell for this persona could plausibly be installed under.
 *
 * There are two naming schemes in the wild and they do not agree:
 *   persona-registry.ts     ->  com.lucent.zeta.<persona>-loop   (e.g. kiro-loop)
 *   host-loop-bootstrap.sh  ->  com.lucent.zeta.<persona>        (e.g. otto)
 *
 * Probing only the registry label is FAIL-OPEN, and this was caught the honest
 * way: the first cut of this module probed the registry label only, was run
 * against the live machine on 2026-08-14, reported all four dead cells as
 * `not-installed`, and exited 0. A liveness check that misses the very outage it
 * was written for is worse than no check, because it manufactures confidence.
 *
 * The bootstrap is being converged onto the registry label by the same change
 * that adds this module; probing both is what keeps the check honest across that
 * migration and on machines provisioned before it.
 */
export function candidateLabels(persona: string): readonly string[] {
  const config = getPersona(persona);
  const registryLabel = config?.label ?? `com.lucent.zeta.${persona}-loop`;
  const bootstrapLabel = `com.lucent.zeta.${persona}`;
  return registryLabel === bootstrapLabel ? [registryLabel] : [registryLabel, bootstrapLabel];
}

/** Gather facts for one persona from the live machine. */
export function gather(persona: string, now: number): CellFacts {
  const config = getPersona(persona);
  const paths = defaultPaths(persona);

  // Probe every candidate label; the first launchd actually knows about wins.
  let label = candidateLabels(persona)[0]!;
  let unitFound = false;
  let lastExitCode: number | undefined;
  let launchdState: string | undefined;

  for (const candidate of candidateLabels(persona)) {
    const printed = spawnSync("launchctl", ["print", `gui/${uid()}/${candidate}`], { encoding: "utf8" });
    if (printed.status === 0) {
      label = candidate;
      unitFound = true;
      ({ lastExitCode, launchdState } = parseLaunchctlPrint(printed.stdout ?? ""));
      break;
    }
  }

  // Three missed ticks is the stale threshold: one missed tick can be a slow
  // agent gate, three in a row is the scheduler not running the loop.
  const staleAfterMs = (config?.scheduleInterval ?? 60) * 3 * 1000;

  return {
    persona,
    label,
    unitFound,
    lastExitCode,
    launchdState,
    heartbeatAgeMs: heartbeatAgeMs(paths.stateDir, persona, now),
    staleAfterMs,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const argv = process.argv.slice(2);

  // --assert-persona <name>: used by tools/setup/host-loop-bootstrap.sh as a
  // preflight so the provisioner refuses to generate a unit for a persona the
  // loop runner would reject at startup.
  const assertIdx = argv.indexOf("--assert-persona");
  if (assertIdx !== -1) {
    const name = argv[assertIdx + 1];
    if (!name) {
      console.error("--assert-persona requires a persona name");
      process.exit(2);
    }
    if (!getPersona(name)) {
      console.error(`unknown persona: ${name}`);
      console.error(
        `registered: ${listPersonas()
          .map((p) => p.name)
          .join(", ")}`,
      );
      process.exit(1);
    }
    process.exit(0);
  }

  const personaIdx = argv.indexOf("--persona");
  const only = personaIdx !== -1 ? argv[personaIdx + 1] : undefined;
  const asJson = argv.includes("--json");

  if (process.platform !== "darwin") {
    console.error("loop-liveness: launchd probing is macOS-only (systemd support: future)");
    process.exit(2);
  }

  const now = Date.now();
  const targets = only ? [only] : listPersonas().map((p) => p.name);
  const reports = targets.map((p) => classify(gather(p, now)));

  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const r of reports) {
      const mark = r.verdict === "healthy" ? "OK  " : r.verdict === "not-installed" ? "--  " : "DEAD";
      console.log(`${mark} ${r.persona.padEnd(8)} ${r.verdict.padEnd(14)} ${r.reason}`);
    }
  }

  const failed = reports.filter((r) => r.verdict === "failing" || r.verdict === "stale");
  if (failed.length > 0) {
    console.error(
      `\nloop-liveness: ${failed.length} installed cell(s) not healthy: ${failed.map((r) => r.persona).join(", ")}`,
    );
    process.exit(1);
  }
  process.exit(0);
}
