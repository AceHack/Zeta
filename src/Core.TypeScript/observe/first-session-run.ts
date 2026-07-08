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
  firstSessionLabel,
  firstSessionOracle,
  firstSessionWithLlm,
  GH_SKIP_CONTINUE_LATER,
  simulateFirstSession,
  type FirstSessionAction,
  type NodeSessionState,
} from "./first-session";
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

export interface RunOptions {
  readonly markerPath: string;
  readonly dryRun: boolean;
  readonly demo: boolean;
  readonly demoScript: readonly string[];
  readonly useLlm: boolean;
  readonly home: string;
  readonly runner: ShellRunner;
  readonly backend: ModelBackend;
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

async function applyAction(
  session: NodeSessionState,
  action: FirstSessionAction,
  opts: RunOptions,
): Promise<NodeSessionState> {
  if (action.kind === "setup_credential") {
    if (opts.dryRun) {
      logSerial(`${SERIAL_PREFIX} dry-run setup ${action.vendor}`);
      return simulateFirstSession(session, action);
    }
    const result = executeSetupCredential(action.vendor, opts.runner, opts.home);
    console.log(`${SERIAL_PREFIX} setup-${action.vendor} outcome=${result.outcome}`);
    if (result.outcome === "ready") {
      return simulateFirstSession(session, action);
    }
    console.log(`  (${result.message} — pick another option)`);
    return session;
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
  return next;
}

/** Main loop — exported for tests. */
export async function runFirstSession(opts: RunOptions): Promise<NodeSessionState> {
  if (existsSync(opts.markerPath) && !opts.demo && !opts.dryRun) {
    logSerial(`${SERIAL_PREFIX} already-complete marker=${opts.markerPath}`);
    return { ...defaultNodeSession(), complete: true };
  }

  logSerial(`${SERIAL_PREFIX} begin`);
  let session = sessionFromProbe(opts.runner, opts.home);
  const demoQueue = opts.demo ? [...opts.demoScript] : [];

  const maxTicks = 24;
  for (let tick = 0; tick < maxTicks; tick++) {
    if (session.complete) break;

    const action = await pickAction(session, opts, demoQueue);
    if (!action) break;

    logSerial(`${SERIAL_PREFIX} choice kind=${action.kind}${"vendor" in action ? ` vendor=${action.vendor}` : ""}`);
    session = await applyAction(session, action, opts);

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
