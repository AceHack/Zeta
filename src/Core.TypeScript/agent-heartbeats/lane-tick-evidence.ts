#!/usr/bin/env bun
/**
 * src/Core.TypeScript/agent-heartbeats/lane-tick-evidence.ts — tick evidence read from the LANES,
 * attributed to the substrate that produced it.
 *
 * THE DEFECT THIS ANSWERS, MEASURED LIVE ON 2026-08-25T17:11Z.
 *
 * `heartbeat-liveness.ts` answers "how old is the newest SUCCESSFUL GitHub Actions run of
 * agent-heartbeat.yml?". That is a question about the PROVIDER'S JOB STATUS, not about whether a
 * heartbeat happened, and the two come apart in both directions:
 *
 *   FALSE ALARM (observed, not hypothesised). At 17:11Z the watchdog exited 1 with
 *   "NO SUCCESSFUL agent-heartbeat IN 102 MINUTES - last success 2026-08-25T15:29:08Z". At that
 *   same moment `heartbeat/alexa` carried commit "heartbeat(alexa): accumulated tick
 *   2026-08-25T16:49:05Z", 22 minutes old. A tick HAD landed. The run that produced it went red
 *   at a later step, so its `conclusion` was not `success`, so the watchdog could not see the
 *   tick it had actually produced.
 *
 *   FALSE GREEN. In agent-heartbeat.yml the tick body ends in `|| echo "[heartbeat] tick failed
 *   (non-fatal)"`, and the commit step prints "no new events to commit" and succeeds when there
 *   is nothing staged. A run can therefore conclude `success` having committed nothing and pushed
 *   nothing. The watchdog reads that as proof of life. A check that passes when the thing it
 *   checks did not happen is the vacuity class.
 *
 * And the consequence that matters for decoupling: a tick produced by ANY non-Actions substrate
 * contributes zero rows to the Actions runs list, so it is invisible to the watchdog no matter
 * how correct it is. The liveness check is the single hardest coupling to GitHub in the fleet -
 * harder than the workflow itself, because the workflow is replaceable and the check silently
 * defines what "alive" is allowed to mean.
 *
 * WHAT THIS MODULE READS, AND WHY THAT IS SOUND.
 *
 * A tick commit is identifiable by its subject prefix `heartbeat(`, and its producing substrate
 * by its AgencySignature `Agent-Runtime:` trailer - which every tick commit already carries and
 * which this repo already audits. Both were verified against the live lanes before being relied
 * on here:
 *
 *   - `git log --since="24 hours ago" --format=%s origin/main | grep -c '^heartbeat('` -> 0.
 *     Main never carries a `heartbeat(` subject, because the flush SQUASHES the lane into one
 *     `merge(agent-heartbeats): ...` commit. So the prefix cleanly separates real ticks from the
 *     hundreds of main commits the lane inherits when it is reset over main each tick.
 *   - A real tick commit's trailer block reads `Agent-Runtime:
 *     github-actions/.github/workflows/agent-heartbeat.yml`. A launchd cell writes
 *     `launchd/<label>`. The attribution therefore needs no guessing and no new convention.
 *
 * ABSENCE IS NOT EVIDENCE OF DEATH - THE ONE INVARIANT THIS FILE MUST NOT BREAK.
 *
 * The lane holds only UNFLUSHED ticks: `prepare-heartbeat-branch.ts` resets it over main every
 * tick, so a flush that just landed legitimately leaves the lane with ZERO `heartbeat(` commits.
 * Reading "no tick commits on the lane" as "no ticks are happening" would manufacture an outage
 * out of a healthy flush - the same "absent read as EMPTY" failure the repo fixed in #15381.
 *
 * So lane evidence is ADDITIVE ONLY. It can prove a substrate is alive; it can never prove one is
 * dead. `assessFleetLiveness` consumes it under exactly that rule.
 */

import { spawnSync } from "node:child_process";

/** One observed tick, and the substrate that produced it. */
export interface TickObservation {
  /** The `Agent-Runtime:` trailer value, or a caller-supplied source name. */
  readonly source: string;
  /** ISO-8601 commit time of the tick. */
  readonly at: string;
  /** Lane the tick landed on, when it came from a lane. */
  readonly lane?: string;
}

/** Injected git, so the parser is testable without a repository. */
export interface GitReader {
  (args: readonly string[]): { readonly status: number; readonly stdout: string; readonly stderr: string };
}

export const realGitReader =
  (cwd: string): GitReader =>
  (args) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("git", [...args], { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? r.error?.message ?? "" };
  };

/**
 * Separators. ASCII 0x1e / 0x1f are the Unicode RECORD and UNIT separators: they cannot occur in
 * a commit subject or an ISO timestamp, so a subject containing a newline, a pipe, or a tab
 * cannot forge a record boundary. A newline-delimited format would be forgeable by any commit
 * body, which is attacker-controlled text.
 */
const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";

/** Source recorded when a tick commit carries no `Agent-Runtime:` trailer at all. */
export const UNATTRIBUTED_SOURCE = "unattributed";

/**
 * Parse `git log` output into tick observations.
 *
 * Exported separately from the git call so the forcing cases - a tick with no trailer, a
 * malformed date, a subject that merely CONTAINS `heartbeat(` rather than starting with it - are
 * reachable without staging a repository.
 */
export function parseTickLog(raw: string, lane?: string): readonly TickObservation[] {
  const out: TickObservation[] = [];
  for (const record of raw.split(RECORD_SEP)) {
    const trimmed = record.trim();
    if (trimmed === "") continue;
    const [subject, isoDate, ...bodyParts] = trimmed.split(FIELD_SEP);
    if (subject === undefined || isoDate === undefined) continue;

    // ANCHORED. `startsWith`, never `includes`: a commit titled "fix(heartbeat): ..." or one whose
    // BODY quotes a tick subject is not itself a tick, and counting it would let unrelated work
    // masquerade as proof of life.
    if (!subject.startsWith("heartbeat(")) continue;

    const at = new Date(isoDate);
    // Unparseable time drops the record rather than defaulting to now. A bad timestamp read as
    // the current time makes a dead substrate look fresh - reporting health nobody measured.
    if (Number.isNaN(at.getTime())) continue;

    const body = bodyParts.join(FIELD_SEP);
    const runtime = readTrailer(body, "Agent-Runtime");
    out.push({
      source: runtime ?? UNATTRIBUTED_SOURCE,
      at: at.toISOString(),
      ...(lane === undefined ? {} : { lane }),
    });
  }
  return out;
}

/** Read one AgencySignature trailer value from a commit body. */
export function readTrailer(body: string, key: string): string | undefined {
  const prefix = `${key.toLowerCase()}:`;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith(prefix)) continue;
    const value = trimmed.slice(key.length + 1).trim();
    if (value !== "") return value;
  }
  return undefined;
}

/**
 * Collect tick observations from one lane ref.
 *
 * A ref that does not exist yields an EMPTY list and NO error. A lane that has never been created
 * is a substrate that has not started, which is not the same as one that has stopped - and per
 * the additive-only rule above, neither can make the fleet verdict worse.
 */
export function collectLaneTicks(git: GitReader, ref: string, sinceIso: string): readonly TickObservation[] {
  const verify = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (verify.status !== 0) return [];

  const log = git(["log", `--since=${sinceIso}`, `--format=%s${FIELD_SEP}%cI${FIELD_SEP}%b${RECORD_SEP}`, ref]);
  if (log.status !== 0) return [];
  return parseTickLog(log.stdout, ref);
}

/** Collect across several lanes, flattened. */
export function collectAllLaneTicks(
  git: GitReader,
  refs: readonly string[],
  sinceIso: string,
): readonly TickObservation[] {
  return refs.flatMap((ref) => collectLaneTicks(git, ref, sinceIso));
}

/** The three agent lanes the society ticks today. */
export const DEFAULT_LANE_REFS: readonly string[] = [
  "refs/remotes/origin/heartbeat/alexa",
  "refs/remotes/origin/heartbeat/otto",
  "refs/remotes/origin/heartbeat/soraya",
];

if (import.meta.main) {
  const args = process.argv.slice(2);
  const hours = Number(process.env["ZETA_TICK_EVIDENCE_HOURS"] ?? "24");
  const sinceIso = new Date(Date.now() - hours * 3_600_000).toISOString();
  const refs = args.length > 0 ? args : DEFAULT_LANE_REFS;
  const observations = collectAllLaneTicks(realGitReader(process.cwd()), refs, sinceIso);
  console.log(JSON.stringify(observations, null, 2));
}
