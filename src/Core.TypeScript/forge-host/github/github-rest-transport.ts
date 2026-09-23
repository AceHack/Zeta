/**
 * forge-host/github/github-rest-transport.ts — the one GitHub transport the homemade CLIs share.
 *
 * WHY THIS EXISTS. `gh-cli.ts#githubRestRequest` is the spawn-free REST path, but it needs OUR
 * token (`~/.config/zeta/auth/github.json` or `GH_TOKEN`/`GITHUB_TOKEN`). On a host where the only
 * credential is `gh`'s own keyring login it answers `auth-failure` and stops, and `runGhAsync`'s
 * fallback covers only the bare `gh api <path>` GET. A CLI that must also PUT and POST therefore
 * had no route at all on such a host, which is how agents ended up improvising `gh api` loops in
 * scratch shell scripts.
 *
 * So: token present -> `fetch` (no process creation at all); token absent or refused by the
 * charset filter -> `gh api` as an ARGUMENT VECTOR through `io/safe-io.ts#spawnArgv`. Both
 * routes reach the same REST endpoints, and `graphql` is POSTed as a path like any other, so
 * there is exactly one transport and it never shells out.
 *
 * Budget note (`.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`):
 * this module does not choose the budget — the caller's PATH does. `repos/...` spends the REST
 * budget; `graphql` spends the contested one, and callers should POST it only for operations
 * with no REST form.
 */

import { spawnArgv } from "../../io/safe-io.ts";
import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import { classifyGhError } from "./classify-error";
import { classifyTokenRejection, githubRestRequest, resolveGitHubToken } from "./gh-cli";
import type { GithubRest } from "./github-pr-rest.ts";

/** A flat request body `gh api` can express with `-f` / `-F` fields. */
type FlatValue = string | number | boolean;

function isFlatRecord(v: unknown): v is Record<string, FlatValue> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === "string" || typeof x === "number" || typeof x === "boolean");
}

function pushField(args: string[], key: string, value: FlatValue): void {
  // `-f` is a RAW string field: gh does no `@file` or type magic on it, so an attacker-shaped
  // value cannot turn into a file read. `-F` is used only for numbers and booleans, whose
  // serialisation cannot begin with `@`.
  if (typeof value === "string") args.push("-f", `${key}=${value}`);
  else args.push("-F", `${key}=${String(value)}`);
}

/**
 * The `gh api` argument vector for one request. Pure, so the translation is testable without
 * spawning anything.
 *
 * `graphql` bodies are `{ query, variables }`; `gh api graphql` takes the query as a field and
 * each variable as a sibling field. Any other body must be flat. A nested body is REFUSED rather
 * than approximated — silently dropping a field would send a different request than the caller
 * wrote.
 */
export function ghApiArgv(method: string, path: string, body?: unknown): Result<readonly string[], ForgeError> {
  if (path.startsWith("-") || path.includes("://")) {
    return err(forgeError("internal", `refusing gh api path ${JSON.stringify(path)}`));
  }
  const args: string[] = ["api"];
  if (method !== "GET" && !(path === "graphql" && method === "POST")) args.push("-X", method);
  args.push(path);
  // A job log is raw terminal output. `gh` refuses to print escape sequences unless told to,
  // and that refusal read as "log unreadable" on every job measured. The bytes go into a JSON
  // string (escaped by JSON.stringify), never to a terminal, so allowing them is safe here.
  if (/\/actions\/jobs\/\d+\/logs$/u.test(path)) args.push("--allow-escape-sequences");
  if (body === undefined) return ok(args);
  if (path === "graphql") {
    const b = body as { query?: unknown; variables?: unknown };
    if (typeof b.query !== "string") return err(forgeError("internal", "graphql body needs a string `query`"));
    args.push("-f", `query=${b.query}`);
    if (b.variables !== undefined) {
      if (!isFlatRecord(b.variables)) return err(forgeError("internal", "graphql variables must be flat for gh api"));
      for (const [k, v] of Object.entries(b.variables)) pushField(args, k, v);
    }
    return ok(args);
  }
  if (!isFlatRecord(body)) return err(forgeError("internal", "request body must be flat for gh api"));
  for (const [k, v] of Object.entries(body)) pushField(args, k, v);
  return ok(args);
}

/** One request over `gh api`, spawned as an argv (never a shell). */
export function ghApiRequest(method: string, path: string, body?: unknown, timeoutMs = 60_000): Result<string, ForgeError> {
  const argv = ghApiArgv(method, path, body);
  if (!argv.ok) return argv;
  const spawned = spawnArgv("gh", argv.value, { timeoutMs });
  if (!spawned.ok) {
    const kind = spawned.error.kind === "timeout" ? "network" : "internal";
    return err(forgeError(kind, `gh api ${path}: ${spawned.error.message}`));
  }
  const out = spawned.value;
  if (out.status !== 0) return err(classifyGhError(out.status, out.stderr || out.stdout));
  return ok(out.stdout);
}

/**
 * Is this failure the forge asking us to slow down?
 *
 * `classifyGhError` maps a numeric 403 to `permission-denied` unconditionally, but GitHub
 * answers a SECONDARY (burst) rate limit with 403 too — and a secondary limit never shows in
 * the `rate_limit` counters. So the message is read as well. Reading a real permission refusal
 * as a rate limit would only cost a slower retry; reading a rate limit as a permission refusal
 * would stop the caller, so the text match errs toward "slow down".
 */
export function isRateLimited(e: ForgeError): boolean {
  if (e.kind === "rate-limited") return true;
  return /rate limit|secondary rate|abuse detection|retry-after|too many requests/iu.test(e.message);
}

export type ErrorClass = "rate-limited" | "transient" | "fatal";

/** Longest single back-off wait, whatever the failure streak. */
export const MAX_BACKOFF_MS = 15 * 60_000;

/**
 * Should a caller retry this error, and how hard?
 *
 * Only a rate limit and a transport failure are worth waiting out. Everything else - auth,
 * not-found, permission, an unparseable answer - does not change by asking again, so a caller
 * reports `unknown` at once rather than burning budget re-asking a question with a fixed answer.
 */
export function classifyProbeError(e: ForgeError): ErrorClass {
  if (isRateLimited(e)) return "rate-limited";
  if (e.kind === "network") return "transient";
  return "fatal";
}

/**
 * The delay before the next attempt. `consecutiveFailures` counts the failure just seen.
 * A rate limit doubles from the first failure; a transport error waits one interval first.
 */
export function nextDelayMs(intervalMs: number, consecutiveFailures: number, cls: ErrorClass | null): number {
  if (consecutiveFailures <= 0 || cls === null) return intervalMs;
  const exponent = cls === "rate-limited" ? consecutiveFailures : consecutiveFailures - 1;
  return Math.min(intervalMs * 2 ** exponent, MAX_BACKOFF_MS);
}

/**
 * One request, retried with back-off on rate limit / transport failure only, at most `attempts`
 * times. A fatal error returns at once. The sleep is injected (DST).
 */
export async function requestWithBackoff(
  rest: GithubRest,
  method: string,
  path: string,
  opts: { readonly intervalMs: number; readonly attempts: number; readonly sleep: (ms: number) => Promise<void> },
  body?: unknown,
): Promise<Result<string, ForgeError>> {
  let last: Result<string, ForgeError> = err(forgeError("internal", "no attempt made"));
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    last = await rest.request(method, path, body);
    if (last.ok) return last;
    const cls = classifyProbeError(last.error);
    if (cls === "fatal" || attempt === opts.attempts) return last;
    await opts.sleep(nextDelayMs(opts.intervalMs, attempt, cls));
  }
  return last;
}

/** Token first (spawn-free `fetch`), else `gh api` via `spawnArgv`. The memo is per instance. */
export function defaultGithubRest(): GithubRest {
  let token: string | null | undefined;
  return {
    request: (method, path, body) => {
      if (token === undefined) token = resolveGitHubToken();
      if (classifyTokenRejection(token) === null) {
        return githubRestRequest(method, path, body, { token, timeoutMs: 60_000 });
      }
      return Promise.resolve(ghApiRequest(method, path, body));
    },
  };
}

/** `owner/name`, validated so it cannot smuggle a path segment. */
export function parseNwo(raw: string): string | null {
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(raw) && !raw.includes("..") ? raw : null;
}
