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
