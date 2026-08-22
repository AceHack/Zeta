import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * TRANSPORT-CLASS vs PERMANENT (2026-08-17).
 *
 * Measured defect: on 2026-08-17 GitHub rate-limited
 * `https://github.com/eprover/eprover/archive/refs/tags/E-3.2.0.tar.gz` and
 * three unrelated PRs (#11470, #11472, #11475) went red on `lint (tick-shard
 * relative-paths)` with `curl fetch failed (22)`. The job log shows curl DID
 * retry — thirteen `curl: (22) The requested URL returned error: 429` lines,
 * 13s apart, until `--retry-max-time 300` expired. So retry was never the
 * missing piece: a rate-limit window outlasts any sane in-process budget, and
 * the durable fix is to stop fetching at all (see the `actions/cache` entry for
 * `~/.cache/zeta/from-autotools-tarball/*.tgz` in `.github/workflows/gate.yml`).
 *
 * What WAS wrong here is that every failure looked alike:
 *
 *   - `--retry-all-errors` retried a permanent 404 twelve times, spending two
 *     minutes to learn something the first response already said.
 *   - the thrown message carried curl's exit code (22 = "HTTP >= 400 under
 *     `-f`") and not the STATUS, so a throttle and a dead URL are
 *     indistinguishable in CI output — the operator cannot tell "wait" from
 *     "the pin is wrong".
 *
 * So the policy is now explicit and classified: curl keeps its own retry for
 * the transient HTTP set (408/429/5xx), `--retry-all-errors` is gone so a
 * permanent status fails on the first response, and the connection-level class
 * curl does NOT retry by default (DNS, refused, reset, timeout) is retried by
 * the bounded outer loop below. Nothing is swallowed: an exhausted retry budget
 * still throws, because an install that silently did not install would make a
 * lint pass without running.
 */
const TRANSPORT_CLASS_STATUS: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * curl exit codes that describe the CONNECTION rather than the resource.
 * 6 DNS · 7 connect · 16 HTTP/2 · 18 partial file · 28 timeout · 35 TLS connect
 * · 52 empty reply · 55 send · 56 recv. Retrying these can succeed unchanged.
 */
const TRANSPORT_CLASS_EXIT: ReadonlySet<number> = new Set([6, 7, 16, 18, 28, 35, 52, 55, 56]);

export interface CurlOutcome {
  /** curl's process exit code. 0 means the transfer completed. */
  readonly exitCode: number;
  /** Last response status, or 0 when no HTTP response was received at all. */
  readonly httpStatus: number;
}

export interface FetchDisposition {
  readonly retryable: boolean;
  /** Human-readable cause, surfaced verbatim in the thrown error. */
  readonly reason: string;
}

/**
 * Pure decision: may this outcome be retried unchanged?
 *
 * A throttle or a broken hop is retryable; a 404 is the host answering
 * correctly and no amount of waiting changes the answer. Total by construction
 * so an unrecognised outcome is reported as permanent — the safe direction,
 * since a wrongly-permanent failure is loud and a wrongly-retryable one wastes
 * the whole CI budget before saying anything.
 */
export function classifyCurlFailure(outcome: CurlOutcome): FetchDisposition {
  if (outcome.exitCode === 0) return { retryable: false, reason: "transfer completed" };
  if (outcome.httpStatus > 0) {
    if (TRANSPORT_CLASS_STATUS.has(outcome.httpStatus)) {
      return { retryable: true, reason: `HTTP ${String(outcome.httpStatus)} (host throttled or briefly unavailable)` };
    }
    return { retryable: false, reason: `HTTP ${String(outcome.httpStatus)} (permanent — the URL or pin is wrong)` };
  }
  if (TRANSPORT_CLASS_EXIT.has(outcome.exitCode)) {
    return { retryable: true, reason: `curl exit ${String(outcome.exitCode)} (connection-level failure)` };
  }
  return { retryable: false, reason: `curl exit ${String(outcome.exitCode)} (not a transport-class failure)` };
}

/**
 * Backoff for the outer loop, in milliseconds. Pure, so the schedule is a fact
 * a test can pin rather than a wall-clock behaviour it has to observe.
 * Attempt 1 already spent curl's own retry budget (~300s by default), so these
 * are deliberately short: the cache, not the wait, is what fixes a rate limit.
 */
export function backoffDelayMs(attempt: number): number {
  const bounded = Math.max(1, Math.floor(attempt));
  return Math.min(30_000, 5_000 * 2 ** (bounded - 1));
}

/** Arguments passed to curl for a file-output fetch. Extracted so it is testable. */
export function curlFetchArgs(outputPath: string, url: string, env: Record<string, string | undefined>): string[] {
  return [
    "-fsSL",
    "--retry",
    env.ZETA_CURL_RETRY_COUNT ?? "12",
    "--retry-delay",
    env.ZETA_CURL_RETRY_DELAY_SECONDS ?? "10",
    "--retry-max-time",
    env.ZETA_CURL_RETRY_MAX_TIME_SECONDS ?? "300",
    "-w",
    "%{http_code}",
    "-o",
    outputPath,
    url,
  ];
}

export type CurlRunner = (args: readonly string[]) => Promise<CurlOutcome>;

async function spawnCurl(args: readonly string[]): Promise<CurlOutcome> {
  const proc = Bun.spawn(["curl", ...args], { stdout: "pipe", stderr: "inherit" });
  const written = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  const httpStatus = Number.parseInt(written.trim(), 10);
  return { exitCode, httpStatus: Number.isFinite(httpStatus) ? httpStatus : 0 };
}

export interface CurlFetchOptions {
  readonly run?: CurlRunner;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** Total attempts including the first. Each attempt carries curl's own retry budget. */
  readonly attempts?: number;
  readonly env?: Record<string, string | undefined>;
  readonly log?: (message: string) => void;
}

/**
 * Fetch a URL to a file, retrying only the transport class.
 *
 * Diverges deliberately from `tools/setup/common/curl-fetch.sh curl_fetch`,
 * which still passes `--retry-all-errors`; see the header note above for why
 * that flag is the wrong policy. The shell helper is not on the eprover path.
 */
export async function curlFetchToFile(
  outputPath: string,
  url: string,
  options: CurlFetchOptions = {},
): Promise<void> {
  const run = options.run ?? spawnCurl;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => process.stderr.write(`${message}\n`));
  const attempts = Math.max(1, options.attempts ?? 3);

  const args = curlFetchArgs(outputPath, url, env);
  let disposition: FetchDisposition = { retryable: false, reason: "no attempt made" };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const outcome = await run(args);
    if (outcome.exitCode === 0) return;
    disposition = classifyCurlFailure(outcome);
    if (!disposition.retryable || attempt === attempts) {
      throw new Error(`curl fetch failed — ${disposition.reason}: ${url}`);
    }
    const delay = backoffDelayMs(attempt);
    log(`curl fetch attempt ${String(attempt)}/${String(attempts)} failed (${disposition.reason}); retrying in ${String(delay)}ms: ${url}`);
    await sleep(delay);
  }

  throw new Error(`curl fetch failed — ${disposition.reason}: ${url}`);
}

export function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * Non-throwing digest check, for artefacts that MAY legitimately be stale or
 * corrupt (a restored CI cache) and should be discarded rather than fatal.
 * `verifySha256File` stays the throwing form for freshly-fetched bytes, where a
 * mismatch means upstream disagrees with the pin.
 */
export function sha256FileMatches(filePath: string, expectedHex: string): boolean {
  return sha256File(filePath) === expectedHex.toLowerCase();
}

export function verifySha256File(filePath: string, expectedHex: string): void {
  const actual = sha256File(filePath);
  if (actual !== expectedHex.toLowerCase()) {
    throw new Error(`sha256 mismatch for ${filePath}: expected ${expectedHex}, got ${actual}`);
  }
}

export function resolveRepoRelativeDest(repoRoot: string, destRel: string): string {
  if (destRel.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE;
    if (!home) throw new Error("HOME unset; cannot resolve ~ path");
    return `${home}/${destRel.slice(2)}`;
  }
  if (destRel.startsWith("/")) return destRel;
  return `${repoRoot}/${destRel}`;
}
