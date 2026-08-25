#!/usr/bin/env bun
/**
 * src/Core.TypeScript/agent-heartbeats/local-tick.ts — the SECOND tick source: a bare local
 * service (launchd / systemd / any scheduler) producing heartbeats on compute that is not
 * GitHub's.
 *
 * WHY A SECOND SOURCE AT ALL. `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` row 4
 * marks "Tick sources - GitHub Actions" as the dogfooded reference implementation while rows 5-7
 * (browser/PWA, bare services, k8s pods) are partial or not started. The fleet's liveness - which
 * CLAUDE.md names as the externalized idle counter - therefore runs on exactly one substrate.
 * A second implementation is the only thing that proves the first did not leak provider
 * assumptions into the port.
 *
 * WHY A LANE OF ITS OWN, AND NOT A SECOND WRITER ON `heartbeat/<agent>`.
 *
 * This is a property of the lane protocol, not a preference. Every tick does
 * `git checkout -B heartbeat/<agent> origin/main` and then `git push --force-with-lease`. The
 * lease is what makes that safe: it refuses if another writer moved the ref since this tick
 * observed it. Two sources ticking ONE lane therefore do not merge - they alternately refuse each
 * other, and each refusal is a lost tick. THE LANE IS SINGLE-WRITER BY CONSTRUCTION. A second
 * source gets a second lane; the flush already fans in over many lanes, so nothing downstream
 * needs to change.
 *
 * WHAT THIS DECOUPLES, STATED WITHOUT INFLATION. Compute only. The lane is still pushed to a git
 * remote and that remote is still github.com. This removes GitHub Actions from the critical path
 * of producing a tick; it does not remove GitHub. Transport decoupling is the Reticulum row of
 * the same ledger and is not claimed here.
 *
 * CREDENTIAL: none is embedded, and none may be. The push uses whatever credential the invoking
 * user's git already has - on the maintainer's machine that is the existing ssh key
 * (`gh auth status` reports `Git operations protocol: ssh`). A scheduled service inherits the
 * user's keychain; it does not carry a secret of its own. That is also why this file has no
 * token parameter: adding one would create the exact artifact the brief forbids.
 *
 * RELATIONSHIP TO THE BROWSER/PWA TICK SOURCE (row 5). They are not competing routes. This repo's
 * own browser delivery port, `browser-node/browser-delegated-device-proposal-gh-cli.ts`, shells
 * out to the local `gh` CLI precisely so that no token has to live in the browser - its own
 * refusal text says "retry without moving the token into the browser". So the PWA's DELIVERY leg
 * is a local credentialed process. This adapter is that leg, generalised.
 */

import { hostname } from "node:os";
import { spawnSync } from "node:child_process";
import { runTick, defaultTickCommand, type TickSourceConfig, type CommandRunner } from "./tick-source";

/** The `Task:` ZetaId for this work. Minted, never hand-typed (commit-msg hook + AH006 audit). */
export const LOCAL_TICK_TASK_ID = "081M0WYCQHF087G0R000ZVPA7T";

/** Real process execution. Kept trivial so `runTick` stays the only place with logic. */
export const realRunner: CommandRunner = (command, args, options) => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync(command, [...args], {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...(options.env === undefined ? {} : { env: { ...process.env, ...options.env } }),
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? r.error?.message ?? "" };
};

export interface LocalTickArgs {
  readonly agent: string;
  readonly repoRoot: string;
  readonly model: string;
  readonly runtime: string;
  readonly remote: string;
  readonly dryRun: boolean;
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: LocalTickArgs }
  | { readonly ok: false; readonly error: string };

/**
 * Default runtime label: `launchd/<host>` etc. is decided by the CALLER, because only the caller
 * knows what scheduled it. The fallback names the host so that two laptops running the same
 * adapter are still distinguishable in the ledger - two sources that both claimed
 * `local` would be indistinguishable, which silently undoes the reason for having two.
 */
export function defaultRuntimeLabel(host: string = hostname()): string {
  return `local-service/${host}`;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let agent: string | undefined;
  let repoRoot = process.cwd();
  let model = "qwen2.5:0.5b";
  let runtime: string | undefined;
  let remote = "origin";
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case "--agent":
        if (next === undefined) return { ok: false, error: "--agent requires a value" };
        agent = next;
        i += 1;
        break;
      case "--repo-root":
        if (next === undefined) return { ok: false, error: "--repo-root requires a value" };
        repoRoot = next;
        i += 1;
        break;
      case "--model":
        if (next === undefined) return { ok: false, error: "--model requires a value" };
        model = next;
        i += 1;
        break;
      case "--runtime":
        if (next === undefined) return { ok: false, error: "--runtime requires a value" };
        runtime = next;
        i += 1;
        break;
      case "--remote":
        if (next === undefined) return { ok: false, error: "--remote requires a value" };
        remote = next;
        i += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        return { ok: false, error: `unknown flag: ${String(flag)}` };
    }
  }

  if (agent === undefined) return { ok: false, error: "--agent is required" };
  return { ok: true, value: { agent, repoRoot, model, runtime: runtime ?? defaultRuntimeLabel(), remote, dryRun } };
}

/** Build the full port config from parsed CLI args. */
export function toConfig(args: LocalTickArgs): TickSourceConfig {
  const eventDir = "docs/observe-events";
  return {
    agent: args.agent,
    repoRoot: args.repoRoot,
    runtime: args.runtime,
    model: args.model,
    task: LOCAL_TICK_TASK_ID,
    // `shared` is the honest value: the push rides the invoking user's existing git credential,
    // which is the maintainer's. Claiming `dedicated-agent` would assert an isolation this
    // adapter does not have, and an AgencySignature that overstates its credential is worse
    // than one that admits a shared one.
    credentialIdentity: "AceHack",
    credentialMode: "shared",
    remote: args.remote,
    tickCommand: defaultTickCommand(args.agent, args.model, eventDir),
    eventDir,
    dryRun: args.dryRun,
  };
}

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`local-tick: ${parsed.error}`);
    console.error(
      "usage: local-tick.ts --agent <lane> [--repo-root <p>] [--model <m>] [--runtime <label>] [--remote <name>] [--dry-run]",
    );
    process.exit(2);
  }

  const config = toConfig(parsed.value);
  const result = runTick(config, realRunner, new Date());
  if (!result.ok) {
    console.error(`local-tick: ${result.error}`);
    process.exit(1);
  }

  const o = result.value;
  console.log(
    `[local-tick] lane=${o.lane} runtime=${config.runtime} carried=${o.carriedUnflushedState} committed=${o.committed} pushed=${o.pushed}`,
  );
  if (o.commitSubject !== undefined) console.log(`[local-tick] ${o.commitSubject}`);
  // A tick that committed nothing is a NO-OP, not a failure: the tick body legitimately finds no
  // work to observe. Exiting non-zero here would make a healthy quiet period look like an outage,
  // which is the same misreading the liveness watchdog already makes about failed-but-productive
  // runs.
  process.exit(0);
}
