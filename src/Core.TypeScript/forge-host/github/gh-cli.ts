/**
 * forge-host/github/gh-cli.ts — shared gh CLI invocation helpers.
 *
 * Centralizes the spawnSync pattern so every adapter method uses
 * consistent buffer sizes, timeouts, and error classification.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Result, ForgeError } from "../types";
import { ok, err, forgeError } from "../result";
import { classifyGhError } from "./classify-error";
import { defaultStoreDir } from "../../model-backend/login-runner.ts";
import { asGithubAccessToken, parseStoredAccessToken } from "../../model-backend/resolve-stored-token.ts";

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
// Token order (081M100RB9Z087G0R000GWY1MM): OUR store first
// (`~/.config/zeta/auth/github.json`), then `GH_TOKEN`/`GITHUB_TOKEN`. `gh auth token`
// is no longer a resolver — that spawn was the thing that made "no gh on PATH" a
// factory outage. Import a vendor session with `harny import github` if they already
// ran `gh auth login`.

const GITHUB_API = "https://api.github.com";

/**
 * Token for GitHub REST: OUR store first, then env. Never `gh auth token`.
 *
 * Pure in (env, readStore). No process-lifetime memo — that was ambient state a
 * later test (or a later env snapshot) could not replay. GitHubAdapter caches
 * per instance, which is actor state, not a hidden global.
 *
 * `env` and `readStore` are seams so tests never assign into `process.env` (refused
 * by `hygiene/lint-no-ambient-credential-hoist.ts`) and never hit the real
 * `~/.config/zeta/auth/github.json`. Empty `GH_TOKEN` is absent — it falls through
 * to `GITHUB_TOKEN` rather than claiming a token that is not there.
 */
export function resolveGitHubToken(
  env: Readonly<Record<string, string | undefined>> = process.env,
  readStore: () => string | null = readGithubStoreToken,
): string | null {
  const fromStore = readStore();
  if (fromStore !== null && fromStore.length > 0) return fromStore;
  for (const key of ["GH_TOKEN", "GITHUB_TOKEN"] as const) {
    const raw = env[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

/** Sync read of `~/.config/zeta/auth/github.json`. Absent / garbage is null. */
export function readGithubStoreToken(): string | null {
  try {
    const raw = readFileSync(`${defaultStoreDir(homedir())}/github.json`, "utf8");
    return parseStoredAccessToken(raw);
  } catch {
    return null;
  }
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

export type GithubFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type GithubRestDoors = {
  readonly token?: string | null;
  readonly fetch?: GithubFetch;
  readonly timeoutMs?: number;
  /// `null` = no timer (DST tests). omitted = production AbortSignal.timeout.
  readonly signal?: AbortSignal | null;
};

/// Relative GitHub REST path → `https://api.github.com/...`. Absolute URLs,
/// `..`, and backslashes are refused so a token cannot ride to another host
/// (the CWE-200 shape CodeQL flagged: file-sourced credential + attacker URL).
export function githubRestUrl(path: string): string | null {
  if (path.includes("://") || path.includes("\\") || path.includes("..")) return null;
  const rel = path.replace(/^\/+/, "");
  if (rel.length === 0 || rel.length > 2048) return null;
  if (!/^[A-Za-z0-9._~/?#@[\]!$&'()*+,;=%-]+$/.test(rel)) return null;
  const url = new URL(rel, `${GITHUB_API}/`);
  if (url.origin !== GITHUB_API) return null;
  return url.toString();
}

/**
 * GitHub REST over `fetch` + our token. No `gh`. Missing token is auth-failure,
 * not a spawn. Inject `token` / `fetch` in tests so CI's `GITHUB_TOKEN` cannot
 * leak a real socket into the hermetic tier.
 */
export async function githubRestRequest(
  method: string,
  path: string,
  body?: unknown,
  doors: GithubRestDoors = {},
): Promise<Result<string, ForgeError>> {
  const rawToken = doors.token !== undefined ? doors.token : resolveGitHubToken();
  const token = rawToken === null ? null : asGithubAccessToken(rawToken);
  if (token === null || token.length === 0) {
    return err(
      forgeError(
        "auth-failure",
        "no GitHub token in ~/.config/zeta/auth/github.json or GH_TOKEN/GITHUB_TOKEN — run `harny login github` (gh CLI is not a fallback)",
      ),
    );
  }
  const url = githubRestUrl(path);
  if (url === null) {
    return err(forgeError("internal", "refusing a GitHub REST path that is not under https://api.github.com"));
  }
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  headers.set("User-Agent", "zeta-forge-host");
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }
  if (doors.signal === null) {
    /* DST tests: no AbortSignal.timeout */
  } else if (doors.signal !== undefined) {
    init.signal = doors.signal;
  } else {
    init.signal = AbortSignal.timeout(doors.timeoutMs ?? DEFAULT_TIMEOUT);
  }
  const fetchImpl = doors.fetch ?? fetch;
  try {
    const res = await fetchImpl(url, init);
    const text = await res.text();
    if (!res.ok) return err(classifyGhError(res.status, text));
    return ok(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(forgeError("network", `fetch ${url}: ${msg}`));
  }
}

/** `gh api <path>` over `fetch`. `null` ⇒ caller should use the subprocess path. */
async function fetchGhApi(path: string, timeout: number): Promise<Result<string, ForgeError> | null> {
  const token = resolveGitHubToken();
  if (token === null) return null;
  const result = await githubRestRequest("GET", path, undefined, { token, timeoutMs: timeout });
  return result;
}
