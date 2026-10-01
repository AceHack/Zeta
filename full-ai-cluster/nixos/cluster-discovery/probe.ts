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

/**
 * Arguments for one browse pass: parsable, resolving, terminating.
 *
 * NO `--no-db-lookup`. That flag was here until 2026-09-27 and made every pass
 * exit 1 (`avahi-browse: unrecognized option '--no-db-lookup'`, run
 * 35985197702), so discovery had never once run on a shipped image. Verified
 * against source, not assumed: avahi 0.8 `avahi-utils/avahi-browse.c` compiles
 * `-k/--no-db-lookup` (and `-b/--dump-db`) only under
 * `#if defined(HAVE_GDBM) || defined(HAVE_DBM)`, and nixpkgs builds avahi with
 * `--disable-gdbm` (pkgs/by-name/av/avahi/package.nix at the flake-locked rev
 * c25784012c99). Dropping it changes no output: with no service-type database
 * there is no lookup to suppress, and where one exists `_zeta-k3s._tcp` is not
 * in it, so the type column is the raw type either way.
 *
 * Every flag here must be in `AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS`; the
 * test that enforces it is the falsifier the old flag never had.
 */
export function browseArgs(): readonly string[] {
  return ["--parsable", "--resolve", "--terminate", ZETA_CLUSTER_SERVICE_TYPE];
}

/**
 * The long options avahi 0.8's `avahi-browse` accepts on EVERY build -- the
 * `long_options[]` table in avahi-utils/avahi-browse.c minus the two entries
 * behind the gdbm/dbm guard (`no-db-lookup`, `dump-db`). A flag outside this
 * set may be rejected by the binary the probe actually receives.
 */
export const AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS: ReadonlySet<string> = new Set([
  "help",
  "version",
  "browse-domains",
  "domain",
  "all",
  "verbose",
  "terminate",
  "cache",
  "ignore-local",
  "resolve",
  "no-fail",
  "parsable",
]);

/** How many times the dwell may be topped up after an early timer wake; see `probeForClusters`. */
const MAX_DWELL_TOP_UPS = 8;

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

  // THE DWELL HAS TO BE HONOURED AS MEASURED, NOT AS REQUESTED. A timer can
  // resolve early against the wall clock: `setTimeout(30000)` followed by
  // `Date.now() - startedAt` reads 29999 on some boots (timer quantisation, and
  // `Date.now` is not the clock the timer counts on). `decideClusterBoot` then
  // rightly refuses -- "probe returned after 29999 ms of a 30000 ms dwell" is an
  // inadmissible silence -- and the installer HALTS for a keypress that nobody
  // is there to give. MEASURED run 36832486494: the WP11 install heard nothing in
  // exactly 30000 ms and bootstrapped, scenario 4's baseline install heard
  // nothing in 29999 ms and sat at that prompt for the full 1,800,000 ms. The
  // admissibility check is correct and stays strict; it is this loop's job to
  // hand it a dwell that really elapsed. Bounded, so a sleeper that never
  // advances the clock falls through to the refusal instead of spinning.
  for (let attempt = 0; attempt < MAX_DWELL_TOP_UPS && elapsed() < dwellMs; attempt += 1) {
    await options.sleep(Math.max(1, dwellMs - elapsed()));
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
