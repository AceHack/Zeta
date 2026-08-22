#!/usr/bin/env bun
// push-with-retry.ts — `git push` retry wrapper for transient 5xx.
//
// TypeScript+Bun port of push-with-retry.sh, slice 13 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// Why this exists:
//   The factory observed recurring transient GitHub 500s during
//   autonomous-loop tick-close commits (multiple occurrences
//   2026-04-23). Manual retry burns tick budget; this wrapper makes
//   the retry uniform.
//
// DST classification: ACCEPTED_BOUNDARY (external network I/O +
// retry-on-failure) per the boundary registry at
// `docs/research/dst-accepted-boundaries.md` §3 and Otto-168.
//
// Usage:
//   bun tools/git/push-with-retry.ts [git push args...]
//   bun tools/git/push-with-retry.ts
//   bun tools/git/push-with-retry.ts --set-upstream origin my-branch
//
// Exit codes:
//   0   push succeeded (possibly after retries)
//   1   all retries exhausted on transient 5xx
//   2   environment validation failed (non-integer env value)
//   N   non-transient error — propagates `git push`'s own exit code
//
// Environment:
//   GIT_PUSH_MAX_ATTEMPTS  override retry count (default 3; positive int)
//   GIT_PUSH_BACKOFF_S     override initial backoff seconds (default 2;
//                          doubles each retry; non-negative int)
//
// Behavioural note vs bash original:
//   The bash version uses `tee` to BOTH capture stderr AND stream it
//   live. This port uses spawnSync which captures-then-replays stderr
//   after each attempt completes. For typical git-push runtimes
//   (seconds) the UX difference is invisible; for long pushes the
//   stderr appears in batches per attempt rather than streaming.

import { spawnSync } from "node:child_process";

const POSITIVE_INT_RE = /^\d+$/;

const TRANSIENT_5XX_RE =
  /(500|502|503|504|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)/;

interface Validated {
  readonly maxAttempts: number;
  readonly initialBackoff: number;
}

function validateEnv(): Validated | { readonly error: string } {
  const maxAttemptsRaw = process.env.GIT_PUSH_MAX_ATTEMPTS ?? "3";
  const backoffRaw = process.env.GIT_PUSH_BACKOFF_S ?? "2";

  if (!POSITIVE_INT_RE.test(maxAttemptsRaw)) {
    return {
      error: `push-with-retry: GIT_PUSH_MAX_ATTEMPTS must be a positive integer; got '${maxAttemptsRaw}'`,
    };
  }
  const maxAttempts = Number.parseInt(maxAttemptsRaw, 10);
  if (maxAttempts < 1) {
    return {
      error: `push-with-retry: GIT_PUSH_MAX_ATTEMPTS must be a positive integer; got '${maxAttemptsRaw}'`,
    };
  }

  if (!POSITIVE_INT_RE.test(backoffRaw)) {
    return {
      error: `push-with-retry: GIT_PUSH_BACKOFF_S must be a non-negative integer; got '${backoffRaw}'`,
    };
  }
  const initialBackoff = Number.parseInt(backoffRaw, 10);

  return { maxAttempts, initialBackoff };
}

function sleepSeconds(seconds: number): void {
  // Synchronous sleep via Atomics.wait on a SharedArrayBuffer. The
  // shebang pins this to Bun, which supports main-thread Atomics.wait
  // (Node's main thread throws TypeError; off-thread workers in either
  // runtime work too). We need synchronous because the entry guard
  // `process.exit(main(...))` depends on `main` returning synchronously.
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, seconds * 1000);
}

interface SpawnError {
  readonly code?: string;
}

function classifySpawnFailure(
  status: number | null,
  signal: string | null,
  error: SpawnError | undefined,
): { readonly status: number; readonly note: string } {
  if (status !== null) return { status, note: "" };
  // status === null implies either a signal termination or a spawn
  // failure (ENOENT / EACCES / EAGAIN). Match bash exit-code conventions
  // where practical: 127 for command-not-found, 1 otherwise.
  if (error?.code === "ENOENT") {
    return { status: 127, note: "git not found on PATH (ENOENT)" };
  }
  if (error?.code !== undefined) {
    return { status: 1, note: `spawn failed (${error.code})` };
  }
  if (signal !== null) {
    return { status: 1, note: `git terminated by signal ${signal}` };
  }
  return { status: 1, note: "git terminated without exit code" };
}

function runOnce(args: readonly string[]): {
  status: number;
  stderr: string;
} {
  // `git` invocation: no shell interpolation (args passed as
  // separate array elements); user-provided args go directly to git
  // push, not the shell. Same security posture as the bash original
  // which runs `git push "$@"` in an unquoted-glob-safe way.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["push", ...args], {
    stdio: ["inherit", "inherit", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // Defensive: @types/node typings claim `stderr: string` (when
  // encoding is set), but the runtime can return `null` when the
  // child cannot start (ENOENT/EACCES). Guard with `?? ""` so the
  // downstream regex match against the empty string is safe.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const stderr = result.stderr ?? "";
  // Replay captured stderr to the user (bash original streams via
  // tee; we batch).
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }
  const classified = classifySpawnFailure(
    result.status,
    result.signal,
    result.error as SpawnError | undefined,
  );
  if (classified.note.length > 0) {
    process.stderr.write(`push-with-retry: ${classified.note}\n`);
  }
  return { status: classified.status, stderr };
}

export function main(args: readonly string[]): number {
  const validated = validateEnv();
  if ("error" in validated) {
    process.stderr.write(`${validated.error}\n`);
    return 2;
  }

  let backoff = validated.initialBackoff;
  for (let attempt = 1; attempt <= validated.maxAttempts; attempt++) {
    const { status, stderr } = runOnce(args);
    if (status === 0) return 0;

    if (TRANSIENT_5XX_RE.test(stderr)) {
      if (attempt < validated.maxAttempts) {
        process.stderr.write(
          `push-with-retry: transient 5xx on attempt ${String(attempt)}/${String(validated.maxAttempts)}; retrying in ${String(backoff)}s...\n`,
        );
        if (backoff > 0) sleepSeconds(backoff);
        backoff *= 2;
        continue;
      }
      process.stderr.write(
        `push-with-retry: failed after ${String(validated.maxAttempts)} attempts on transient 5xx\n`,
      );
      return 1;
    }

    // Non-transient error — propagate git push's own exit code.
    return status;
  }

  // Unreachable (the loop always returns), but TS needs an exit.
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
