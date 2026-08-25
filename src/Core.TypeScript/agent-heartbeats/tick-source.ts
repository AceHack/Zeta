#!/usr/bin/env bun
/**
 * src/Core.TypeScript/agent-heartbeats/tick-source.ts — the PORT a heartbeat tick source implements.
 *
 * WHY THIS FILE EXISTS: THE PORT WAS NEVER WRITTEN DOWN.
 *
 * `.github/workflows/agent-heartbeat.yml` performs a heartbeat tick as four inlined YAML steps
 * ("Accumulate unflushed heartbeat state over current main", "Run observe tick", "Commit
 * accumulated heartbeat tick", "Push heartbeat branch"). That is an implementation, not an
 * interface — the sequence exists only as GitHub Actions YAML, so there was nothing a second
 * substrate could implement. The repo has the same defect one level up in
 * `agentic-organization/packages/domain/src/work-provider.ts`: a `WorkProviderKind` DU over
 * five providers with total dispatch and ZERO adapters. A declared seam with one implementation
 * is a hub wearing an interface.
 *
 * This module extracts the sequence as a provider-neutral function so a tick can be produced by
 * compute that is not GitHub's. It is deliberately NOT a rewrite of the workflow: the live lane
 * keeps its inlined steps, because moving a running society's liveness path is a separate risk
 * from adding a second one. What this file changes is that the sequence is now stated once, in
 * a language a bare service / container / pod can execute.
 *
 * WHAT IS PROVIDER-NEUTRAL HERE, STATED HONESTLY:
 *
 *   COMPUTE  — neutral. Nothing below calls a GitHub API or reads a GitHub Actions variable.
 *   TRANSPORT — NOT neutral. Step 4 pushes to a git remote, and today that remote is github.com.
 *              This module decouples WHO RUNS THE TICK from GitHub, not WHERE THE LANE LIVES.
 *              Transport decoupling is the Reticulum row of the dogfooding ledger and is out of
 *              scope; claiming it here would be the kind of overreach the ledger already warns
 *              about. `remote` is a parameter so the substitution is a config change, not a code
 *              change, the day a second remote exists.
 *
 * THE TICK BODY IS SHARED, NOT REIMPLEMENTED. `tickCommand` defaults to the exact
 * `run-loop-real.ts` invocation the Actions lane uses. A second tick source that ran a DIFFERENT
 * body would prove nothing about the first: it would be a second thing, not a second
 * implementation of the same thing.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prepareHeartbeatBranch, type PrepareHeartbeatResult } from "./prepare-heartbeat-branch";
import { packGeneric } from "../zeta-id/zeta-id";

/** Result of one attempt at anything that can fail with a legible reason. */
export type TickResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/** A single command execution, injected so every branch below is reachable from a test. */
export interface CommandRunner {
  (
    command: string,
    args: readonly string[],
    options: { readonly cwd: string; readonly env?: Record<string, string> },
  ): {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
  };
}

/**
 * Everything a tick source must supply. Every field that the Actions lane hardcodes is a
 * parameter here — that is the whole point of extracting the port.
 */
export interface TickSourceConfig {
  /** Lane / agent name. Becomes `heartbeat/<agent>`; validated by the preparer. */
  readonly agent: string;
  /** Working clone. MUST be a clone this source owns; never a shared checkout (GOVERNANCE §35). */
  readonly repoRoot: string;
  /**
   * Value of the AgencySignature `Agent-Runtime:` trailer.
   *
   * This is the SOURCE ATTRIBUTION KEY and it is load-bearing, not decoration. It is what lets a
   * liveness check say WHICH substrate produced a tick — see `lane-tick-evidence.ts`. The Actions
   * lane writes `github-actions/.github/workflows/agent-heartbeat.yml`; a launchd cell writes
   * `launchd/<label>`. Two sources that both claimed the same runtime would be indistinguishable
   * in the ledger, which would silently un-do the reason for having two.
   */
  readonly runtime: string;
  /** Model the tick body reasons with. Recorded as `Agent-Model:`. */
  readonly model: string;
  /** Minted ZetaId for the `Task:` trailer. A hand-typed id fails the commit-msg hook and AH006. */
  readonly task: string;
  /** Identity the push credential belongs to, recorded as `Credential-Identity:`. */
  readonly credentialIdentity: string;
  /** `Credential-Mode:` — one of shared | dedicated-agent | operator-delegated | human-only | unknown. */
  readonly credentialMode: string;
  /** Git remote to push the lane to. Parameterised so transport is config, not code. */
  readonly remote: string;
  /** The tick body. Defaults to the same command the Actions lane runs. */
  readonly tickCommand: readonly string[];
  /** Path whose changes constitute "a tick happened". */
  readonly eventDir: string;
  /** When true, do everything except move the remote ref. */
  readonly dryRun: boolean;
}

/** What one tick did, in enough detail that a caller can tell a no-op from a landed tick. */
export interface TickOutcome {
  readonly lane: string;
  readonly carriedUnflushedState: boolean;
  /** False when the tick body produced no new events — a legitimate no-op, NOT a failure. */
  readonly committed: boolean;
  /** False in dry-run, or when there was nothing to push. */
  readonly pushed: boolean;
  readonly commitSubject?: string;
}

/** The `run-loop-real.ts` invocation the Actions lane uses, kept in one place. */
export function defaultTickCommand(agent: string, model: string, eventDir: string): readonly string[] {
  return [
    "src/Core.TypeScript/observe/run-loop-real.ts",
    "--by",
    agent,
    "--event-dir",
    eventDir,
    "--participant",
    `local-llm:${model}`,
  ];
}

/**
 * The ten AgencySignature keys, contiguous, in canonical order.
 *
 * Written as one block with no blank line inside it because `findAllSignatureBlocks` keeps whole
 * PARAGRAPHS carrying all ten keys — a blank line in the middle splits it into two partial blocks
 * and the audit stops recognising it.
 *
 * `Action-Mode: autonomous-fail-open` is the honest value for a scheduled tick: a failed tick is
 * survivable because the lane carries its unflushed state forward, so this source must not claim
 * to fail closed.
 */
export function buildCommitMessage(config: TickSourceConfig, timestamp: string): string {
  return [
    `heartbeat(${config.agent}): accumulated tick ${timestamp}`,
    "",
    `Carries any prior unflushed lane delta over current main, then adds this tick.`,
    `Produced by ${config.runtime} on non-GitHub-Actions compute. Model: ${config.model}.`,
    "",
    "Agency-Signature-Version: 1",
    `Agent: ${config.agent}`,
    `Agent-Runtime: ${config.runtime}`,
    `Agent-Model: ${config.model}`,
    `Credential-Identity: ${config.credentialIdentity}`,
    `Credential-Mode: ${config.credentialMode}`,
    "Human-Review: not-implied-by-credential",
    "Human-Review-Evidence: none",
    "Action-Mode: autonomous-fail-open",
    `Task: ${config.task}`,
    // `<name>[bot]@users.noreply.github.com` is the ONLY safe noreply form for a generated
    // identity. `audit-coauthor-identity-collides` caught this line emitting `noreply@zeta.dev`,
    // an invented domain: a fabricated address attributes work to a mailbox nobody owns, and the
    // plain `<name>@users.noreply.github.com` form is worse still because it resolves DIRECTLY to
    // whoever holds that username on github.com today. A username cannot contain `[`, so the bot
    // form can never collide with a real account.
    `Co-authored-by: ${config.agent}[bot] <${config.agent}[bot]@users.noreply.github.com>`,
  ].join("\n");
}

/** ZetaId category 3 = Heartbeat, per registry/categories.yaml. */
const ZETA_CATEGORY_HEARTBEAT = 3;

/** Format a ZetaId bigint as 32-char zero-padded hex, matching the event-folder convention. */
export function zetaIdHex(id: bigint): string {
  return id.toString(16).padStart(32, "0");
}

/**
 * The tick's OWN event - written unconditionally, whatever the tick body did.
 *
 * WHY THIS IS NOT OPTIONAL, and why the Actions lane's not having it is the false-green defect.
 *
 * The tick body picks an action from a menu and executes it. Plenty of picks produce no event:
 * measured on this adapter's first live run, the body chose `navigate_cartography` and exited 1
 * with "not-yet-executable", leaving nothing staged. In agent-heartbeat.yml that path ends at
 * "no new events to commit", the step succeeds, the job concludes `success`, and the liveness
 * watchdog reads that green run as proof of life - for a tick that produced nothing.
 *
 * So LIVENESS MUST NOT DEPEND ON THE ACTION MENU. Whether this substrate is alive is a fact about
 * the substrate, not about whether today's pick happened to be executable. This event records the
 * tick itself: that it ran, on what, choosing what, with what outcome. It is the honest minimum,
 * and it is what makes a heartbeat a heartbeat rather than a side effect of successful work.
 *
 * `bodyStatus` is recorded rather than hidden. A tick that ran and whose body failed is a
 * DIFFERENT fact from a tick that ran cleanly, and collapsing the two would rebuild the vacuity
 * this function exists to remove.
 */
export function emitTickEvent(config: TickSourceConfig, now: Date, bodyStatus: number): string {
  const dir = join(config.repoRoot, config.eventDir);
  mkdirSync(dir, { recursive: true });

  // Payload is time-ordered so filenames sort chronologically, with a random low word so two
  // sources ticking in the same millisecond cannot collide on a filename.
  const payload = (BigInt(now.getTime()) << 40n) | BigInt(Math.floor(Math.random() * 2 ** 40));
  const id = packGeneric(1, ZETA_CATEGORY_HEARTBEAT, payload);
  const name = `${zetaIdHex(id)}.json`;

  const event = {
    id: `heartbeat-${config.agent}-${now.toISOString()}`,
    at: now.toISOString(),
    // `by` is the AGENT, matching every other observe-event, because the cadence measurement in
    // agent-heartbeat.yml filters on exactly this field. A tick source that named itself here
    // would be invisible to the measurement it exists to feed.
    by: config.agent,
    kind: "heartbeat",
    // The substrate that produced it - the same value as the `Agent-Runtime:` trailer, so lane
    // evidence and event evidence attribute a tick identically.
    source: config.runtime,
    model: config.model,
    bodyStatus,
    lane: `heartbeat/${config.agent}`,
  };

  // `wx` — create-exclusive. Two things at once:
  //
  // CORRECTNESS: two ticks must never silently overwrite one event file. A collision is a fact
  // worth failing on, not one worth losing.
  //
  // SECURITY: CodeQL flagged the previous unflagged write as `js/insecure-temporary-file` (high).
  // A plain write follows an existing symlink, so anything that can predict the path can redirect
  // the write. `wx` refuses to open an existing entry at all, which is the standard remediation
  // and costs nothing here because a fresh ZetaId is supposed to be fresh.
  writeFileSync(join(dir, name), `${JSON.stringify(event, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return name;
}

/**
 * Run one heartbeat tick, provider-neutrally.
 *
 * The four steps mirror the Actions lane exactly, including the order, because the order is the
 * part that was learned the hard way: the committer identity must be set before the FIRST git
 * operation that needs it, not before the commit that happens to come last. The 2026-08-16 outage
 * (all three lanes dead for an hour on `fatal: empty ident name`) was caused by getting exactly
 * that ordering wrong, and a second implementation that quietly reintroduced it would be a second
 * outage rather than a second source.
 */
export type LanePreparer = (agent: string, cwd: string) => PrepareHeartbeatResult;

export function runTick(
  config: TickSourceConfig,
  run: CommandRunner,
  now: Date,
  // INJECTED, with the real preparer as the default.
  //
  // This was a hard import until a test caught it: `runTick` could not be exercised at all
  // without a real repository, a real `git fetch` to the network, and a real `checkout -B` that
  // would have moved the caller's branch. A seam that only has one implementation and cannot be
  // substituted is the exact defect this whole file exists to remove -- it was worth fixing here
  // rather than excusing, since the argument of the module is that unsubstitutable seams are how
  // a provider assumption hides.
  prepareLane: LanePreparer = prepareHeartbeatBranch,
): TickResult<TickOutcome> {
  const { repoRoot, agent } = config;
  const git = (...args: readonly string[]): ReturnType<CommandRunner> => run("git", args, { cwd: repoRoot });

  // STEP 0 — identity, before anything that touches git. See the doc comment above.
  const nameCfg = git("config", "user.name", `${agent}[bot]`);
  if (nameCfg.status !== 0) return { ok: false, error: `set committer name failed: ${nameCfg.stderr.trim()}` };
  const mailCfg = git("config", "user.email", `${agent}[bot]@users.noreply.github.com`);
  if (mailCfg.status !== 0) return { ok: false, error: `set committer email failed: ${mailCfg.stderr.trim()}` };

  // STEP 1 — rebuild the lane over current main, squash-carrying unflushed state.
  // Reused, not reimplemented: a second copy of this logic would drift from the first, and the
  // per-path merge semantics it encodes were derived from measured partial-flush conflicts.
  const prepared = prepareLane(agent, repoRoot);
  if (!prepared.ok) return { ok: false, error: `prepare lane failed: ${prepared.error}` };

  // STEP 2 — the tick body. Non-fatal by design, matching the Actions lane: a tick body that
  // fails still leaves a lane that must be pushed, and swallowing the push would strand state.
  const body = run("bun", config.tickCommand, { cwd: repoRoot });
  if (body.status !== 0) {
    // Loud, not fatal — and it must be said out loud, because a silent body failure is the
    // condition under which a green run produces no tick at all.
    console.error(`[tick] body exited ${body.status} (non-fatal): ${body.stderr.trim().slice(0, 400)}`);
  }

  // STEP 2b — record the tick itself, whatever the body decided. See `emitTickEvent`.
  //
  // Wrapped because `emitTickEvent` writes with `wx` and therefore THROWS on collision or on an
  // unwritable directory. `runTick` returns a Result, and a function that returns a Result and
  // also throws is lying about its own signature -- the caller writes no try/catch because the
  // type says it does not need one. Surfacing it as a typed error keeps the contract honest.
  try {
    emitTickEvent(config, now, body.status);
  } catch (error) {
    return { ok: false, error: `record tick event failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  // STEP 3 — commit. "Nothing to commit" is a NO-OP, never an error: the tick body legitimately
  // produces no event when there is no work to observe.
  const add = git("add", "--", config.eventDir);
  if (add.status !== 0) return { ok: false, error: `stage events failed: ${add.stderr.trim()}` };

  const staged = git("diff", "--cached", "--quiet", "--exit-code");
  if (staged.status !== 0 && staged.status !== 1) {
    return { ok: false, error: `inspect staged events failed: ${staged.stderr.trim()}` };
  }
  const hasChanges = staged.status === 1;

  let commitSubject: string | undefined;
  if (hasChanges) {
    const timestamp = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const message = buildCommitMessage(config, timestamp);
    // `--no-verify`: same as the Actions lane. Lane commits are not PR commits; the gate runs on
    // the flush PR, which is where the review actually happens.
    const commit = git("commit", "--no-verify", "-m", message);
    if (commit.status !== 0) return { ok: false, error: `commit tick failed: ${commit.stderr.trim()}` };
    commitSubject = `heartbeat(${agent}): accumulated tick ${timestamp}`;
  }

  // STEP 4 — push. `--force-with-lease` is required (the lane is rebuilt each tick, so the new
  // tip is not a descendant of its predecessor) and safe (the preparer three-way merged the
  // remote lane first; the lease refuses if another writer moved the ref since).
  if (config.dryRun) {
    return {
      ok: true,
      value: {
        lane: prepared.value.head,
        carriedUnflushedState: prepared.value.carried,
        committed: hasChanges,
        pushed: false,
        ...(commitSubject === undefined ? {} : { commitSubject }),
      },
    };
  }

  const push = git("push", "--force-with-lease", config.remote, prepared.value.head);
  if (push.status !== 0) return { ok: false, error: `push lane failed: ${push.stderr.trim()}` };

  return {
    ok: true,
    value: {
      lane: prepared.value.head,
      carriedUnflushedState: prepared.value.carried,
      committed: hasChanges,
      pushed: true,
      ...(commitSubject === undefined ? {} : { commitSubject }),
    },
  };
}
