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
//
// WHY THERE ARE TWO SUPERVISORS IN HERE (2026-08-18)
// --------------------------------------------------
// The classifier below was pure and OS-independent from the first commit; the
// FACT-GATHERER was macOS-only, and the CLI exited 2 on Linux with
// "systemd support: future". That put the one liveness check we have on the
// wrong side of the boundary: the cluster nodes are NixOS/systemd, so the check
// could not run on the machines it exists to diagnose.
//
// The `systemd` half added here is the same shape as the launchd half and makes
// the same refusal. On launchd the vacuous field was `state`, because a
// StartInterval loop is SUPPOSED to be "not running" between ticks. The systemd
// analogue is exact: `adapters/systemd.ts` installs a `Type=oneshot` service
// driven by a `.timer`, so the service's `ActiveState=inactive` between ticks is
// likewise normal — and `SystemdAdapter.status()` keys on `is-active <unit>.timer`,
// which stays `active` while every single invocation fails. Same conflation, one
// layer over. The discriminators are `Result` and `ExecMainStatus`, and BOTH are
// needed: a run killed by `TimeoutStartSec` reports `Result=timeout` with
// `ExecMainStatus=0`, so the exit code alone would call a timed-out loop healthy.
//   2 — tooling / input error

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { listPersonas, getPersona } from "./persona-registry";
import { defaultPaths } from "./env-schema";
import { createLaunchctlControl, parsePrintOutput } from "./service-control-port";

// ---------------------------------------------------------------------------
// Pure core — classification over already-gathered facts.
// No IO here, so it is directly testable and DST-replayable.
// ---------------------------------------------------------------------------

/**
 * Which OS supervisor produced the facts. Names the SOURCE of the observation,
 * never a verdict about it — the classification stays one total function over
 * both, which is the whole reason the check is portable at all.
 */
export type Supervisor = "launchd" | "systemd";

/** Raw facts about one cell, gathered by the IO shell (or supplied by a test). */
export interface CellFacts {
  readonly persona: string;
  readonly label: string;
  /** Which supervisor was probed. */
  readonly supervisor: Supervisor;
  /** false when the supervisor could not find the unit at all. */
  readonly unitFound: boolean;
  /**
   * The last run's exit status: launchd `last exit code = N`,
   * systemd `ExecMainStatus=N`. undefined when absent/unparsed.
   */
  readonly lastExitCode: number | undefined;
  /**
   * The supervisor's own verdict that the last run did not succeed, INDEPENDENT
   * of the exit code. systemd fills it from `Result=` (`timeout`, `signal`,
   * `core-dump`, … all pair with `ExecMainStatus=0`); launchd has no separate
   * field and leaves it undefined. Carried separately rather than folded into
   * `lastExitCode` because a zero exit code from a killed process is a real
   * observation, and collapsing it would rebuild the vacuity this module exists
   * to refuse.
   */
  readonly lastRunFailed: boolean | undefined;
  /** The supervisor's state line, verbatim (launchd `state = …`, systemd `ActiveState=…`). */
  readonly supervisorState: string | undefined;
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
    return { ...base, verdict: "not-installed", reason: `no ${facts.supervisor} unit for this label` };
  }

  // THE discriminator the old ServiceState threw away.
  if (facts.lastExitCode !== undefined && facts.lastExitCode !== 0) {
    return {
      ...base,
      verdict: "failing",
      reason: `${facts.supervisor} last exit code = ${facts.lastExitCode}${explainExitCode(facts.supervisor, facts.lastExitCode)}`,
    };
  }

  // The second discriminator, and it is not redundant: a run the supervisor
  // killed reports success-shaped exit status. Checked AFTER the exit code so
  // the more specific number is reported when both are available.
  if (facts.lastRunFailed === true) {
    return {
      ...base,
      verdict: "failing",
      reason: `${facts.supervisor} reports the last run did not succeed (${facts.supervisorState ?? "no state reported"})`,
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

/**
 * Gloss the exit codes that each supervisor uses for "I could not start your
 * program at all" — the failure that hid the two-month outage. They are the
 * same defect reported by two different numbers.
 */
function explainExitCode(supervisor: Supervisor, code: number): string {
  if (supervisor === "launchd" && code === 78) return " (EX_CONFIG — bad program path or plist)";
  if (supervisor === "systemd" && code === 203) return " (EXIT_EXEC — systemd could not execute the program)";
  return "";
}

/** A run fails when any INSTALLED cell is not healthy. */
export function isFailure(reports: readonly CellReport[]): boolean {
  return reports.some((r) => r.verdict === "failing" || r.verdict === "stale");
}

// ---------------------------------------------------------------------------
// IO shell
// ---------------------------------------------------------------------------

/** Parse the fields we care about out of `launchctl print` output.
 *
 *  DELEGATES to the port's parser so there is exactly ONE launchctl-print parser in the
 *  tree. Kept as a named export because its tests carry the real captured fixtures. */
export function parseLaunchctlPrint(stdout: string): {
  lastExitCode: number | undefined;
  launchdState: string | undefined;
} {
  const parsed = parsePrintOutput(stdout);
  return { lastExitCode: parsed.lastExitCode, launchdState: parsed.launchdState };
}

/**
 * Parse the fields we care about out of `systemctl --user show <unit>` output.
 *
 * `show` emits `Key=Value` one per line and — unlike `status` — is stable,
 * non-localised, and does not paginate, so it is the honest machine surface.
 * A unit systemd has never heard of still exits 0 and reports
 * `LoadState=not-found`, which is why `unitFound` is read from the field rather
 * than from the exit status.
 */
export function parseSystemctlShow(stdout: string): {
  unitFound: boolean;
  lastExitCode: number | undefined;
  lastRunFailed: boolean | undefined;
  activeState: string | undefined;
} {
  const fields = new Map<string, string>();
  for (const line of stdout.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    fields.set(line.slice(0, eq), line.slice(eq + 1).trim());
  }

  const loadState = fields.get("LoadState");
  const result = fields.get("Result");
  const execMainStatus = fields.get("ExecMainStatus");
  const activeState = fields.get("ActiveState");

  const parsedStatus = execMainStatus === undefined ? Number.NaN : Number(execMainStatus);

  return {
    // Absent LoadState means we did not get a usable answer at all; treat that
    // as not-found rather than inventing a healthy reading (fail-closed).
    unitFound: loadState !== undefined && loadState !== "not-found",
    lastExitCode: Number.isNaN(parsedStatus) ? undefined : parsedStatus,
    // `Result` is systemd's own verdict. Undefined when the field is absent so
    // the classifier can tell "succeeded" from "was never reported".
    lastRunFailed: result === undefined ? undefined : result !== "success",
    activeState,
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

/**
 * The systemd unit `adapters/systemd.ts` installs for a persona.
 *
 * Only ONE name is probed here, unlike the launchd side's two-scheme drift: the
 * systemd adapter is the sole thing that has ever written these units, so a
 * second candidate would be a guess rather than an observed naming scheme.
 */
export function systemdUnitName(persona: string): string {
  return `zeta-loop-${persona}.service`;
}

/** How stale a heartbeat may be before the cell is not doing its job. */
function staleAfterMsFor(persona: string): number {
  // Three missed ticks is the stale threshold: one missed tick can be a slow
  // agent gate, three in a row is the scheduler not running the loop.
  return (getPersona(persona)?.scheduleInterval ?? 60) * 3 * 1000;
}

/** Gather facts for one persona from a live systemd (user-session) machine. */
export function gatherSystemd(persona: string, now: number): CellFacts {
  const label = systemdUnitName(persona);
  const paths = defaultPaths(persona);

  const shown = spawnSync(
    "systemctl",
    ["--user", "show", label, "--property=LoadState,ActiveState,Result,ExecMainStatus"],
    { encoding: "utf8" },
  );

  const parsed =
    shown.status === 0
      ? parseSystemctlShow(shown.stdout ?? "")
      : { unitFound: false, lastExitCode: undefined, lastRunFailed: undefined, activeState: undefined };

  return {
    persona,
    label,
    supervisor: "systemd",
    unitFound: parsed.unitFound,
    lastExitCode: parsed.lastExitCode,
    lastRunFailed: parsed.lastRunFailed,
    supervisorState: parsed.activeState,
    heartbeatAgeMs: heartbeatAgeMs(paths.stateDir, persona, now),
    staleAfterMs: staleAfterMsFor(persona),
  };
}

/** Gather facts for one persona from the live machine, whichever supervisor it runs. */
export function gather(persona: string, now: number): CellFacts {
  return process.platform === "darwin" ? gatherLaunchd(persona, now) : gatherSystemd(persona, now);
}

/** Gather facts for one persona from a live launchd machine. */
export function gatherLaunchd(persona: string, now: number): CellFacts {
  const paths = defaultPaths(persona);
  // FAIL-CLOSED: no admitted launchctl means "I could not look", reported as unitFound
  // false rather than as a confident absence produced by a forgeable PATH lookup.
  const resolved = createLaunchctlControl();
  const ctl = resolved.ok ? resolved.port : null;

  // Probe every candidate label; the first launchd actually knows about wins.
  let label = candidateLabels(persona)[0]!;
  let unitFound = false;
  let lastExitCode: number | undefined;
  let launchdState: string | undefined;

  for (const candidate of candidateLabels(persona)) {
    const d = ctl === null ? { found: false as const } : ctl.describe(`gui/${uid()}`, candidate);
    if (d.found === true) {
      label = candidate;
      unitFound = true;
      lastExitCode = d.lastExitCode;
      launchdState = d.launchdState;
      break;
    }
  }

  return {
    persona,
    label,
    supervisor: "launchd",
    unitFound,
    lastExitCode,
    // launchd has no field separate from the exit code; saying so explicitly
    // keeps "not reported" distinct from "reported success".
    lastRunFailed: undefined,
    supervisorState: launchdState,
    heartbeatAgeMs: heartbeatAgeMs(paths.stateDir, persona, now),
    staleAfterMs: staleAfterMsFor(persona),
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

  // Deliberately NOT gated on platform any more. The check refusing to run on
  // Linux meant the cluster nodes — the machines with the most ways to break —
  // were the ones it could not see. `gather` dispatches on the supervisor.
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
