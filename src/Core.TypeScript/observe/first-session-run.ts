#!/usr/bin/env bun
/**
 * first-session-run.ts — post-login first-setup conductor.
 *
 * Invoked from NixOS profile.d on first interactive zeta login (slice 3).
 * Presents a numbered menu; optional --llm uses the local Ollama chooser.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/first-session-run.ts
 *   bun src/Core.TypeScript/observe/first-session-run.ts --demo --script setup-gh,complete
 *   bun src/Core.TypeScript/observe/first-session-run.ts --dry-run
 *
 * Serial markers (QEMU phase-3): zeta-first-session: begin|complete|gh-auth-*
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { ollamaBackend, type ModelBackend } from "../accelerator/local-llm";
import {
  buildFirstSessionMenu,
  defaultNodeSession,
  FIRST_SESSION_ADVANCING_TICKS,
  firstSessionLabel,
  firstSessionOracle,
  firstSessionWithLlm,
  GH_SKIP_CONTINUE_LATER,
  simulateFirstSession,
  type FirstSessionAction,
  type NodeSessionState,
} from "./first-session";
import { clampTicks, type TickBudget } from "./tick-budget";
import {
  appendFirstSessionEvent,
  journalPathFor,
  reconcileSessionRecord,
  replayFirstSession,
} from "./first-session-journal";
import { resolveIdentityAuthMode } from "../ci/identity-auth-provider";
import {
  SERIAL_PREFIX,
  defaultShellRunner,
  executeSetupCredential,
  probeAllCredentials,
  type ShellRunner,
} from "./first-session-executor";

export const DEFAULT_MARKER_PATH = `${process.env.HOME ?? "/home/zeta"}/.config/zeta/first-session-complete`;

/** Mirror serial markers to ttyS0 when ZETA_FIRST_SESSION_TEE_CONSOLE=1 (QEMU phase-3). */
export function logSerial(line: string): void {
  console.log(line);
  if (process.env.ZETA_FIRST_SESSION_TEE_CONSOLE === "1") {
    try {
      appendFileSync("/dev/ttyS0", `${line}\n`);
    } catch {
      // headless / no serial — stdout-only is fine
    }
  }
}

/**
 * Retries the operator gets at each credential-setup step before the conductor
 * gives up. This one is a CHOICE, not a measurement, and is recorded as such:
 * three attempts is enough to survive a mistyped device code or a cancelled
 * browser flow, and few enough that a genuinely broken vendor (gh missing from
 * PATH, network down) stops the loop instead of holding a fresh node hostage.
 */
export const SETUP_RETRIES_PER_CREDENTIAL = 3;

/** The four credential-setup steps on the longest path: gh, claude, codex, gemini. */
export const SETUP_STEPS_ON_LONGEST_PATH = 4;

/**
 * Budget for the interactive/demo conductor.
 *
 * = measured advancing diameter (6) + retry allowance (3 × 4 = 12) = 18.
 *
 * The conductor needs the retry term and the pure loop does not, which is why
 * these two budgets stay DIFFERENT rather than being unified: `applyAction`
 * returns the session UNCHANGED when `executeSetupCredential` reports `failed`
 * ("pick another option"), so this loop — unlike the pure one — can spend a tick
 * without advancing. That is the whole reason for the gap, and it is now written
 * down instead of being the difference between an unexplained 24 and an
 * unexplained 12.
 */
export const FIRST_SESSION_RUN_TICK_BUDGET: TickBudget = {
  name: "first-session-conductor",
  maxTicks:
    FIRST_SESSION_ADVANCING_TICKS + SETUP_RETRIES_PER_CREDENTIAL * SETUP_STEPS_ON_LONGEST_PATH,
  chosenBy: "Otto (shadow), 2026-08-17 — measured floor, chosen retry allowance",
  rationale:
    "6 measured advancing ticks (the state machine's longest simple path) plus " +
    "3 retries at each of the 4 credential-setup steps, because a failed setup " +
    "leaves the session unchanged and burns a tick. Was a bare 24 with no " +
    "comment; 24 was survivable but nobody had chosen it on the record.",
};

export interface RunOptions {
  readonly markerPath: string;
  readonly dryRun: boolean;
  readonly demo: boolean;
  readonly demoScript: readonly string[];
  readonly useLlm: boolean;
  readonly home: string;
  readonly runner: ShellRunner;
  readonly backend: ModelBackend;
  /** Injected, never chosen inline — see FIRST_SESSION_RUN_TICK_BUDGET. */
  readonly tickBudget: TickBudget;
}

export function parseArgs(argv: string[]): RunOptions {
  let markerPath = process.env.ZETA_FIRST_SESSION_MARKER ?? DEFAULT_MARKER_PATH;
  let dryRun = false;
  let demo = false;
  let demoScript: string[] = [];
  let useLlm = false;
  let home = process.env.HOME ?? "/home/zeta";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--marker-path" && argv[i + 1]) {
      markerPath = argv[++i]!;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--demo") {
      demo = true;
    } else if (arg === "--script" && argv[i + 1]) {
      demoScript = argv[++i]!.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--llm") {
      useLlm = true;
    } else if (arg === "--home" && argv[i + 1]) {
      home = argv[++i]!;
    }
  }

  return {
    markerPath,
    dryRun,
    demo,
    demoScript,
    useLlm,
    home,
    runner: defaultShellRunner(),
    backend: ollamaBackend({ timeoutMs: 30_000 }),
    tickBudget: FIRST_SESSION_RUN_TICK_BUDGET,
  };
}

export function sessionFromProbe(
  runner: ShellRunner,
  home: string,
  complete = false,
): NodeSessionState {
  const probed = probeAllCredentials(runner, home);
  return {
    credentials: probed,
    complete,
    cloudHelpersOffered: false,
  };
}

export function actionFromDemoToken(token: string, session: NodeSessionState): FirstSessionAction | null {
  const menu = buildFirstSessionMenu(session);
  const normalized = token.trim().toLowerCase();

  if (/^\d+$/.test(normalized)) {
    const idx = Number(normalized);
    return menu[idx] ?? null;
  }

  const aliases: Record<string, FirstSessionAction["kind"] | string> = {
    "setup-gh": "setup_credential:gh",
    "skip-gh": "skip_credential:gh",
    "skip-optional": "skip_optional_credentials",
    "offer-cloud": "offer_cloud_helpers",
    "local-only": "use_local_llm_only",
    complete: "complete_first_session",
  };
  const alias = aliases[normalized];
  if (!alias) return null;
  if (alias.includes(":")) {
    const [kind, vendor] = alias.split(":");
    return menu.find(
      (a) =>
        a.kind === kind &&
        ("vendor" in a ? a.vendor === vendor : true),
    ) ?? null;
  }
  return menu.find((a) => a.kind === alias) ?? null;
}

export function writeMarker(markerPath: string): void {
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, `${new Date().toISOString()}\n`, { mode: 0o644 });
}

function printMenu(session: NodeSessionState): void {
  const menu = buildFirstSessionMenu(session);
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║  Zeta first login — a few simple choices                 ║");
  console.log("  ║  GitHub joins the cluster (first target). Local is OK.   ║");
  console.log("  ║  Cloud helpers stay hidden until you ask.                ║");
  console.log("  ╚══════════════════════════════════════════════════════════╝");
  console.log("");
  for (let i = 0; i < menu.length; i++) {
    console.log(`  [${i}] ${firstSessionLabel(menu[i]!)}`);
  }
  console.log("");
}

async function pickAction(
  session: NodeSessionState,
  opts: RunOptions,
  demoQueue: string[],
): Promise<FirstSessionAction | null> {
  if (opts.demo) {
    const token = demoQueue.shift();
    if (!token) return null;
    return actionFromDemoToken(token, session);
  }

  if (opts.useLlm) {
    return firstSessionWithLlm(session, opts.backend);
  }

  printMenu(session);
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("  Press Enter for recommended, or pick a number: ");
    const menu = buildFirstSessionMenu(session);
    if (answer.trim() === "") {
      return firstSessionOracle(session);
    }
    const idx = Number(answer.trim());
    if (!Number.isInteger(idx) || idx < 0 || idx >= menu.length) {
      logSerial(`${SERIAL_PREFIX} invalid-choice`);
      return firstSessionOracle(session);
    }
    return menu[idx]!;
  } finally {
    rl.close();
  }
}

/**
 * The outcome of one tick.
 *
 * `applied` is the action that ACTUALLY took effect, which is not always the one
 * the person chose — a `setup_credential` the provider downgrades to `skipped`
 * takes effect as a `skip_credential`, and a failed setup takes effect as
 * nothing at all (`applied: null`). The journal records this field, never the
 * chosen action, so the log cannot claim an effect that did not happen.
 */
interface AppliedAction {
  readonly session: NodeSessionState;
  readonly applied: FirstSessionAction | null;
}

async function applyAction(
  session: NodeSessionState,
  action: FirstSessionAction,
  opts: RunOptions,
): Promise<AppliedAction> {
  if (action.kind === "setup_credential") {
    const authMode = resolveIdentityAuthMode();
    // dry-run skips live CLIs only. mock/skip still run so QEMU can prove the
    // CI auth fork without baking secrets (ADR 2026-07-08).
    if (opts.dryRun && authMode === "live") {
      logSerial(`${SERIAL_PREFIX} dry-run setup ${action.vendor}`);
      return { session: simulateFirstSession(session, action), applied: action };
    }
    const result = executeSetupCredential(action.vendor, opts.runner, opts.home, {
      authMode,
      log: logSerial,
    });
    logSerial(`${SERIAL_PREFIX} setup-${action.vendor} outcome=${result.outcome}`);
    if (result.outcome === "ready") {
      return { session: simulateFirstSession(session, action), applied: action };
    }
    if (result.outcome === "skipped") {
      // CI explicit skip — mark vendor skipped so the menu can advance (same
      // as skip_credential), without claiming ready / self-register.
      const downgraded: FirstSessionAction = {
        kind: "skip_credential",
        vendor: action.vendor,
        reason: result.message,
      };
      return { session: simulateFirstSession(session, downgraded), applied: downgraded };
    }
    console.log(`  (${result.message} — pick another option)`);
    // Nothing happened: no state change, so nothing to journal. This is the
    // non-advancing tick FIRST_SESSION_RUN_TICK_BUDGET's retry term pays for.
    return { session, applied: null };
  }

  if (opts.dryRun) {
    logSerial(`${SERIAL_PREFIX} dry-run ${action.kind}`);
  }

  const next = simulateFirstSession(session, action);
  if (action.kind === "skip_credential" && action.vendor === "gh") {
    console.log("");
    console.log("  Skipped GitHub for now.");
    console.log(`  Continue later: ${GH_SKIP_CONTINUE_LATER}.`);
    console.log("  Tip: on this machine run the first-login helper again, or SSH in and set up GitHub there.");
    console.log("");
  }
  return { session: next, applied: action };
}

/**
 * The already-finished branch: report the session a completed first login left
 * behind, without prompting.
 *
 * It used to return `defaultNodeSession()` — an all-missing credential set
 * asserted on a machine nobody had looked at. Now it probes for what is
 * observable and replays the journal for what was chosen.
 */
function sessionFromCompletedRun(opts: RunOptions, journalPath: string): NodeSessionState {
  const replayed = replayFirstSession(journalPath);
  if (replayed) {
    // Probe for what is observable now, replay for what was chosen then.
    // See reconcileSessionRecord for why neither source alone is enough.
    const probed = sessionFromProbe(opts.runner, opts.home);
    return { ...reconcileSessionRecord(probed, replayed), complete: true };
  }
  // No journal beside the marker. Two real causes: a node whose first login
  // predates this file, and CI, which fabricates the marker with `echo`
  // (.github/workflows/agent-heartbeat.yml). Both are legitimate, and neither
  // gives us a record — so this returns the same all-missing default it always
  // has. It is a KNOWN FABRICATION, kept only for the no-record case and
  // labelled out loud rather than presented as an observation.
  logSerial(`${SERIAL_PREFIX} already-complete no-journal (credentials unknown, reported missing)`);
  return { ...defaultNodeSession(), complete: true };
}

/**
 * Journal the APPLIED action, after its effect landed.
 *
 * Two guards, both load-bearing: `applied === null` means nothing happened (a
 * refused credential setup), and journalling it would durably record a step the
 * machine never took. `dryRun` means no durable effects, and the journal is a
 * durable effect.
 *
 * A failed append is DEGRADED, not fatal — finishing first login on a fresh
 * machine outranks keeping the record of it — but it is never silent.
 */
function recordApplied(
  journalPath: string,
  applied: FirstSessionAction | null,
  dryRun: boolean,
): void {
  if (!applied || dryRun) return;
  const appended = appendFirstSessionEvent(journalPath, applied);
  if (!appended.ok) {
    logSerial(`${SERIAL_PREFIX} journal-failed reason=${appended.reason}`);
  }
}

/** Main loop — exported for tests. */
export async function runFirstSession(opts: RunOptions): Promise<NodeSessionState> {
  const journalPath = journalPathFor(opts.markerPath);

  if (existsSync(opts.markerPath) && !opts.demo && !opts.dryRun) {
    logSerial(`${SERIAL_PREFIX} already-complete marker=${opts.markerPath}`);
    return sessionFromCompletedRun(opts, journalPath);
  }

  logSerial(`${SERIAL_PREFIX} begin`);
  let session = sessionFromProbe(opts.runner, opts.home);
  const demoQueue = opts.demo ? [...opts.demoScript] : [];

  const maxTicks = clampTicks(opts.tickBudget);
  for (let tick = 0; tick < maxTicks; tick++) {
    if (session.complete) break;

    const action = await pickAction(session, opts, demoQueue);
    if (!action) break;

    logSerial(`${SERIAL_PREFIX} choice kind=${action.kind}${"vendor" in action ? ` vendor=${action.vendor}` : ""}`);
    const outcome = await applyAction(session, action, opts);
    session = outcome.session;

    recordApplied(journalPath, outcome.applied, opts.dryRun);

    if (session.complete) {
      if (!opts.dryRun) {
        writeMarker(opts.markerPath);
      }
      logSerial(`${SERIAL_PREFIX} complete canSelfRegister=${session.credentials.gh === "ready"}`);
      break;
    }
  }

  return session;
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  const final = await runFirstSession(opts);
  return final.complete ? 0 : 1;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`${SERIAL_PREFIX} fatal ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    },
  );
}
