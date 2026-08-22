/**
 * forge-host/github/gh-cli.ts — shared gh CLI invocation helpers.
 *
 * Centralizes the spawnSync pattern so every adapter method uses
 * consistent buffer sizes, timeouts, and error classification.
 */

import { spawnSync } from "node:child_process";
import type { Result, ForgeError } from "../types";
import { ok, err, forgeError } from "../result";
import { classifyGhError } from "./classify-error";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB
const DEFAULT_TIMEOUT = 30_000; // 30s

export interface GhResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
}

/**
 * Run `gh` with args. Returns Result with stdout on success, ForgeError on failure.
 * Args are passed as array — never shell-interpolated (injection-safe).
 */
export function runGh(args: readonly string[], timeout = DEFAULT_TIMEOUT): Result<string, ForgeError> {
  const result = spawnSync("gh", [...args], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    timeout,
  });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      return err(forgeError("internal", "gh CLI not found on PATH"));
    }
    return err(forgeError("network", `gh spawn error: ${result.error.message}`));
  }

  const stderr = result.stderr ?? "";
  const stdout = result.stdout ?? "";

  if (result.status !== 0) {
    return err(classifyGhError(result.status, stderr || stdout));
  }

  return ok(stdout);
}

/**
 * Run `gh` and parse the JSON output. Returns Result<T, ForgeError>.
 */
export function runGhJson<T>(args: readonly string[], timeout = DEFAULT_TIMEOUT): Result<T, ForgeError> {
  const result = runGh(args, timeout);
  if (!result.ok) return result;

  try {
    return ok(JSON.parse(result.value) as T);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(forgeError("parse-failure", `JSON parse error: ${msg}. First 200 bytes: ${result.value.slice(0, 200)}`));
  }
}

/**
 * Run `gh api graphql` with variables. Handles the -F/-f flag construction.
 */
export function runGhGraphQL<T>(
  query: string,
  variables: Record<string, string | number>,
  timeout = DEFAULT_TIMEOUT,
): Result<T, ForgeError> {
  const args: string[] = ["api", "graphql"];
  for (const [key, val] of Object.entries(variables)) {
    if (typeof val === "number") {
      args.push("-F", `${key}=${String(val)}`);
    } else {
      args.push("-F", `${key}=${val}`);
    }
  }
  args.push("-f", `query=${query}`);

  const result = runGh(args, timeout);
  if (!result.ok) return result;

  try {
    const parsed = JSON.parse(result.value) as { data?: T; errors?: unknown[] };
    if (parsed.errors && parsed.errors.length > 0) {
      return err(forgeError("internal", `GraphQL errors: ${JSON.stringify(parsed.errors)}`));
    }
    if (parsed.data === undefined) {
      return err(forgeError("parse-failure", "GraphQL response missing 'data' field"));
    }
    return ok(parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(forgeError("parse-failure", `GraphQL JSON parse error: ${msg}`));
  }
}

/**
 * How many `gh` subprocesses this process has launched, and how long they took.
 *
 * Permanent instrumentation, not debug scaffolding. This tool's whole thesis is that
 * an unmeasured thing gets guessed at, and the first performance report it received
 * guessed "network-bound, far more requests per check than one" — where the measured
 * answer was **1.09 gh calls per check** (near-optimal) and **73 serialised `git`
 * spawns** nobody had counted. The counter is here so the next person reads a number
 * instead of inferring one from a CPU percentage.
 */
export const ghCallStats = { calls: 0, totalMs: 0, spawns: 0, fetches: 0 };

/**
 * Async `gh` invocation — the truthful-signature counterpart to `runGh`.
 *
 * `runGh` is `spawnSync`: it blocks, so N calls cost N round-trips serially and a
 * degree-of-parallelism knob over it would be a lie. `.claude/rules/async-all-the-way-truthful-signatures.md`
 * wants the knob to be real and to degrade to DoP=1, which requires a genuinely async
 * process launch that a ferry can await while the request is in flight.
 *
 * Same argv handling as `runGh` (array, never shell-interpolated) and the same error
 * classification, so the two agree on what a failure is.
 */
export async function runGhAsync(
  args: readonly string[],
  timeout = DEFAULT_TIMEOUT,
): Promise<Result<string, ForgeError>> {
  const startedAt = Bun.nanoseconds();
  ghCallStats.calls += 1;

  // Spawn-free fast path for the plain `gh api <path>` shape. See the transport note
  // at the bottom of this file: on an AV-scanned host, process creation — not the
  // network — was 79 of 142 seconds.
  if (isPlainApiGet(args)) {
    const viaFetch = await fetchGhApi(args[1] as string, timeout);
    if (viaFetch !== null) {
      ghCallStats.fetches += 1;
      ghCallStats.totalMs += (Bun.nanoseconds() - startedAt) / 1e6;
      return viaFetch;
    }
  }

  ghCallStats.spawns += 1;
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeout);
  try {
    const [stdout, stderr, status] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (status !== 0) return err(classifyGhError(status, stderr || stdout));
    return ok(stdout);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOENT")) return err(forgeError("internal", "gh CLI not found on PATH"));
    return err(forgeError("network", `gh spawn error: ${msg}`));
  } finally {
    clearTimeout(timer);
    ghCallStats.totalMs += (Bun.nanoseconds() - startedAt) / 1e6;
  }
}

/** Async `runGhJson`. */
export async function runGhJsonAsync<T>(
  args: readonly string[],
  timeout = DEFAULT_TIMEOUT,
): Promise<Result<T, ForgeError>> {
  const result = await runGhAsync(args, timeout);
  if (!result.ok) return result;
  try {
    return ok(JSON.parse(result.value) as T);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(forgeError("parse-failure", `JSON parse error: ${msg}. First 200 bytes: ${result.value.slice(0, 200)}`));
  }
}

// ─── Spawn-free transport ───────────────────────────────────────────────────
//
// WHY THIS EXISTS, measured rather than assumed.
//
// The drift dashboard's pass makes ~87 `gh api` calls. On a clean host each costs
// ~445ms of which ~404ms is network, so the subprocess is ~10% and nobody would
// bother. On the host where this tool is actually used — macOS with Microsoft
// Defender on-access scanning — **every process creation pays an authorisation**, and
// the same pass took 142.5s wall against 63.2s of cumulative API time at DoP=16. 9%
// CPU, and the missing 79s is not network: it is 88 process creations.
//
// That host is not an outlier to design around later. It is the one the first user of
// this tool has, and a guard slower than the unsafe path selects for the unsafe path.
//
// So: resolve the token ONCE (one spawn, or zero when `GH_TOKEN`/`GITHUB_TOKEN` is
// already set, as in CI) and issue the requests with `fetch`. 88 spawns become at most
// 2. Same credential, same endpoint, same auth semantics — `gh auth token` is exactly
// what `gh api` would have used.
//
// Falls back to the subprocess path whenever a token cannot be resolved, so nothing
// that works today stops working; the fast path is an optimisation, never a new
// requirement.

const GITHUB_API = "https://api.github.com";

let tokenResolved = false;
let cachedToken: string | null = null;

/**
 * The token `gh api` would use: env first (CI supplies it), then ONE `gh auth token`.
 *
 * `env` IS A SEAM, AND IT EXISTS FOR A REAL REASON, not for tidiness. Before it, the
 * only way to exercise this function was to ASSIGN into `process.env` and restore it
 * in a `finally`. That is a genuine hazard rather than a lint technicality: `process.env`
 * is inherited by every child this process spawns, including the `Bun.spawnSync(["gh",
 * "auth", "token"])` twelve lines below and any other test in the same run that shells
 * out to `gh` — so a test setting `GH_TOKEN = "t1"` hands a fake credential to real
 * subprocesses for as long as the assignment stands, and a crash between the assignment
 * and the `finally` leaves it standing for the rest of the run.
 *
 * Reading the ambient environment is fine and is what CI relies on; WRITING a credential
 * into it is what `hygiene/lint-no-ambient-credential-hoist.ts` refuses. Passing the
 * environment in lets a caller test the resolution order without ever writing one.
 */
export function resolveGitHubToken(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  if (tokenResolved) return cachedToken;
  tokenResolved = true;
  const fromEnv = env["GH_TOKEN"] ?? env["GITHUB_TOKEN"];
  if (fromEnv !== undefined && fromEnv !== "") {
    cachedToken = fromEnv;
    return cachedToken;
  }
  try {
    const proc = Bun.spawnSync(["gh", "auth", "token"], { stdout: "pipe", stderr: "pipe" });
    const out = new TextDecoder().decode(proc.stdout).trim();
    cachedToken = proc.exitCode === 0 && out !== "" ? out : null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

/** Reset the memoised token. Tests only — the resolution is process-lifetime otherwise. */
export function resetGitHubTokenForTest(): void {
  tokenResolved = false;
  cachedToken = null;
}

/**
 * Is this argv exactly the read-only `gh api <path>` shape the fetch path handles?
 *
 * Deliberately narrow. Anything with flags, a method, or a body falls through to the
 * subprocess — a transport swap that quietly changed the semantics of some other call
 * would be a far worse bug than the latency it saved.
 */
export function isPlainApiGet(args: readonly string[]): boolean {
  return args.length === 2 && args[0] === "api" && typeof args[1] === "string" && !args[1].startsWith("-");
}

/** `gh api <path>` over `fetch`. `null` ⇒ caller should use the subprocess path. */
async function fetchGhApi(path: string, timeout: number): Promise<Result<string, ForgeError> | null> {
  const token = resolveGitHubToken();
  if (token === null) return null;
  const url = path.startsWith("http") ? path : `${GITHUB_API}/${path.replace(/^\/+/, "")}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "zeta-drift-dashboard",
      },
      signal: AbortSignal.timeout(timeout),
    });
    const body = await res.text();
    if (!res.ok) return err(classifyGhError(res.status, body));
    return ok(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(forgeError("network", `fetch ${url}: ${msg}`));
  }
}
