// profile.test.ts — smoke tests for tools/profile.ts CLI dispatcher.
//
// B-0156 AC #2: each TS sibling of a ported .sh has at least one
// `bun test` covering its primary entry path. profile.ts is the
// last of the three Phase 3/4 ports lacking explicit test coverage
// (amara.ts + ani.ts are covered by tools/peer-call/smoke.test.ts).
//
// Scope: VALIDATES CLI DISPATCH ONLY, NOT DOTNET TOOL INVOCATION.
//
// profile.ts is a thin dispatcher over dotnet-counters / dotnet-trace
// / dotnet-gcdump / BenchmarkDotNet / reportgenerator. Those tools
// are not guaranteed installed in CI, so the live subcommands cannot
// be tested without mocks. This suite exercises the dispatch surface
// instead:
//
//   1. The file exists at the canonical path.
//   2. Empty / -h / --help arguments print usage and exit 0.
//   3. Unknown commands print usage and exit 64 (EX_USAGE).
//   4. Subcommands that require a pid exit 64 when pid is missing.
//   5. The help text references every documented subcommand (catches
//      doc-drift where a case-branch is added without updating the
//      default help block).

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROFILE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "profile.ts");

function run(args: readonly string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("bun", [PROFILE_PATH, ...args], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const DOCUMENTED_SUBCOMMANDS = [
  "install",
  "counters",
  "trace",
  "gcdump",
  "bench",
  "coverage",
] as const;

describe("tools/profile.ts (B-0156 AC #2)", () => {
  test("exists at the canonical path", () => {
    expect(existsSync(PROFILE_PATH)).toBe(true);
  });

  test("no-args prints help and exits 0", () => {
    const result = run([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DBSP profiling helper");
  });

  test("-h prints help and exits 0", () => {
    const result = run(["-h"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DBSP profiling helper");
  });

  test("--help prints help and exits 0", () => {
    const result = run(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DBSP profiling helper");
  });

  test("unknown command exits 64 (EX_USAGE)", () => {
    const result = run(["definitely-not-a-real-subcommand"]);
    expect(result.status).toBe(64);
  });

  test("counters without pid exits 64", () => {
    const result = run(["counters"]);
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("usage:");
  });

  test("trace without pid exits 64", () => {
    const result = run(["trace"]);
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("usage:");
  });

  test("gcdump without pid exits 64", () => {
    const result = run(["gcdump"]);
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("usage:");
  });

  test("help text references every documented subcommand", () => {
    const result = run([]);
    expect(result.status).toBe(0);
    for (const sub of DOCUMENTED_SUBCOMMANDS) {
      expect(result.stdout).toContain(sub);
    }
  });
});
