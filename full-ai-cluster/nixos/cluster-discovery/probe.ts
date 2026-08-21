/**
 * full-ai-cluster/nixos/cluster-discovery/probe.ts
 *
 * THE ADAPTER. Drives `avahi-browse` for the dwell and turns what came back
 * into the value `decide.ts` consumes.
 *
 * Every effect is INJECTED -- the process runner, the sleeper and the clock
 * are parameters, never imports of ambient globals. That is what makes the
 * orchestration testable without a network and replayable from a fixed
 * schedule (noninterference: entropy enters through declared channels only).
 *
 * WHY DISCRETE PASSES INSTEAD OF ONE LONG BROWSE
 * ---------------------------------------------
 * A single `avahi-browse` held open for 30 s does issue RFC 6762 retransmits,
 * but nothing it prints lets a caller count them -- so a `queryBursts` field
 * derived from one long run would be a number we asserted rather than
 * measured, and `decide.ts` uses that number to decide whether a silence is
 * admissible. An assertion that cannot fail is not a check.
 *
 * So the probe runs SEVERAL terminating passes, at offsets shaped like RFC
 * 6762 section 5.2 exponential backoff (0, 1, 3, 7, 15 s), and counts the
 * passes that actually executed. Each pass re-queries the group, results are
 * unioned across passes (set union -- idempotent, so a duplicate answer in
 * pass 4 changes nothing), and the count is a measurement.
 *
 * WHAT COUNTS AS A FAILURE, LOUDLY
 * --------------------------------
 * A missing `avahi-browse`, a daemon that is not running, and a pass that
 * exits non-zero are all `probe-failed` -- NEVER `silence`. This is the
 * difference between "there is no cluster here" and "I could not look", and
 * conflating them is how every node on a broken network founds its own
 * cluster.
 */

import { parseBrowseOutput } from "./avahi-browse-parse";
import { ZETA_CLUSTER_SERVICE_TYPE, type MalformedAdvertisement, type ZetaClusterAdvertisement } from "./advertisement";
import { DEFAULT_DWELL_MS, MIN_QUERY_BURSTS, type DiscoveryProbeOutcome, type ProbeFailureReason } from "./decide";

/** Result of running the browser once. */
export interface BrowsePassResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Injected process runner. Returns null when the binary is not present. */
export type BrowseRunner = (args: readonly string[]) => Promise<BrowsePassResult | null>;

/** Injected sleep and clock, so a test drives the schedule without waiting. */
export type Sleeper = (ms: number) => Promise<void>;
export type Clock = () => number;

/** Injected carrier check: is there a link with an address to query on? */
export type CarrierCheck = () => Promise<boolean>;

/**
 * Pass offsets, in ms from the start of the dwell.
 *
 * Shaped like the RFC 6762 section 5.2 backoff (each interval at least twice
 * the previous, starting at one second). Five entries, which is the count
 * `decide.ts` requires a silence to stand on.
 */
export const PASS_OFFSETS_MS: readonly number[] = [0, 1_000, 3_000, 7_000, 15_000];

/** Per-pass browser timeout. Generous next to the 20-120 ms RFC 6762 answer delay. */
export const PASS_TIMEOUT_MS = 2_000;

export interface ProbeOptions {
  readonly runBrowse: BrowseRunner;
  readonly sleep: Sleeper;
  readonly now: Clock;
  readonly hasCarrier?: CarrierCheck;
  readonly dwellMs?: number;
  readonly passOffsetsMs?: readonly number[];
}

function failure(reason: ProbeFailureReason, detail: string, elapsedMs: number): DiscoveryProbeOutcome {
  return { kind: "probe-failed", reason, detail, elapsedMs };
}

/** Arguments for one browse pass: parsable, resolving, terminating, no name lookups. */
export function browseArgs(): readonly string[] {
  return ["--parsable", "--resolve", "--terminate", "--no-db-lookup", ZETA_CLUSTER_SERVICE_TYPE];
}

/**
 * Run the dwell and report what was observed.
 *
 * Never throws for an operational failure: a missing browser, a dead daemon
 * or a non-zero exit all come back as `probe-failed` with a reason, because a
 * thrown exception at a call site that catches broadly is how a failure turns
 * back into a silence.
 */
export async function probeForClusters(options: ProbeOptions): Promise<DiscoveryProbeOutcome> {
  const dwellMs = options.dwellMs ?? DEFAULT_DWELL_MS;
  const offsets = options.passOffsetsMs ?? PASS_OFFSETS_MS;
  const startedAt = options.now();
  const elapsed = (): number => options.now() - startedAt;

  if (options.hasCarrier !== undefined) {
    const carrier = await options.hasCarrier();
    if (!carrier) {
      return failure(
        "no-carrier",
        "no interface reported a usable link and address before the dwell started",
        elapsed(),
      );
    }
  }

  const advertisements = new Map<string, ZetaClusterAdvertisement>();
  const malformed: MalformedAdvertisement[] = [];
  let queryBursts = 0;

  for (const offset of offsets) {
    const wait = offset - elapsed();
    if (wait >= 1) {
      await options.sleep(wait);
    }
    const pass = await options.runBrowse(browseArgs());
    if (pass === null) {
      return failure("browser-missing", "avahi-browse is not present on this system", elapsed());
    }
    if (pass.exitCode !== 0) {
      const daemonDown = pass.stderr.includes("Failed to create client object");
      const reason: ProbeFailureReason = daemonDown ? "responder-unavailable" : "browser-error";
      return failure(
        reason,
        `avahi-browse exited ${String(pass.exitCode)}: ${pass.stderr.trim().slice(0, 200)}`,
        elapsed(),
      );
    }
    queryBursts += 1;
    const parsed = parseBrowseOutput(pass.stdout);
    for (const advertisement of parsed.advertisements) {
      const key = [advertisement.clusterId, advertisement.nodeName, advertisement.hostname, advertisement.address].join(
        "|",
      );
      advertisements.set(key, advertisement);
    }
    for (const bad of parsed.malformed) {
      malformed.push(bad);
    }
  }

  const remaining = dwellMs - elapsed();
  if (remaining >= 1) {
    await options.sleep(remaining);
  }
  const elapsedMs = elapsed();
  const found = [...advertisements.values()];

  if (found.length !== 0) {
    return { kind: "responded", advertisements: found, malformed, elapsedMs, dwellMs, queryBursts };
  }
  if (malformed.length !== 0) {
    return { kind: "responded", advertisements: found, malformed, elapsedMs, dwellMs, queryBursts };
  }
  return { kind: "silence", elapsedMs, dwellMs, queryBursts };
}

/** The count a caller must reach for a silence to be admissible. Re-exported for the CLI banner. */
export const REQUIRED_QUERY_BURSTS = MIN_QUERY_BURSTS;
