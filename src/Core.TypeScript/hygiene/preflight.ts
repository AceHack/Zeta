#!/usr/bin/env bun
// preflight.ts — run every code-correctness gate dimension LOCALLY before merge,
// and report EVERY failure at once.
//
// WHY THIS EXISTS: the CI gate runs language lints sequentially in one job that
// SHORT-CIRCUITS at the first failing language — so a multi-language change that
// breaks Go, C#, Python and Rust surfaces ONE red per CI cycle, and "fixing" main
// becomes whack-a-mole across many round-trips (see the 2026-06-13 rollout: 7 PRs
// to clear breakage the gate revealed one language at a time). Preflight runs the
// SAME checks but never bails early: it executes all of them, collects every
// failure, and prints a single summary — so one local run finds everything.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/preflight.ts            # everything (incl. build + full test)
//   bun src/Core.TypeScript/hygiene/preflight.ts --quick    # skip the slow dotnet build + test
//   bun src/Core.TypeScript/hygiene/preflight.ts --help
//
// Exit codes:
//   0   every executed check passed (skipped-because-tool-missing does NOT fail)
//   1   one or more checks failed
//
// Mirrors the gate's code-correctness jobs (.github/workflows/gate.yml): the
// per-language lints, tsc, markdownlint, the file-presence lints, and
// build-and-test. The doc/hygiene lints (tick-shard, backlog, archive-header, …)
// are intentionally out of scope here — this is the code preflight; add them if a
// future round shows they recur.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/hygiene/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");

interface Check {
  readonly label: string;
  readonly cmd: readonly [string, ...string[]];
  /** Slow checks (dotnet build/test) are skipped under --quick. */
  readonly slow?: boolean;
}

const CHECKS: readonly Check[] = [
  // Cheap file-presence + markdown first (fast feedback).
  { label: "no-conflict-markers", cmd: ["bun", "src/Core.TypeScript/hygiene/check-no-conflict-markers.ts"] },
  { label: "no-empty-dirs", cmd: ["bun", "src/Core.TypeScript/lint/no-empty-dirs.ts"] },
  {
    label: "identity-registry-sync",
    cmd: [
      "git",
      "diff",
      "--exit-code",
      "src/Core.TypeScript/identity/generated-registry.ts",
      "src/Core/IdentityRegistry.fs",
    ],
  },
  { label: "auto-vivify check", cmd: ["bun", "src/Core.TypeScript/backlog/auto-vivify.ts", "--check"] },
  // Self-scoping: it derives NOTHING unless this change touches a path
  // build-graph.json is derived from (an evidence glob, a project/Cargo/Lake
  // manifest, an oracle-output file, the graph or the deriver). ~0.03s when it
  // does not apply, ~1.5s when it does — cheap enough to keep, which is the only
  // property that matters for a check nobody is forced to run. Added after three
  // PRs failed the CI drift gate on 2026-08-14 for the identical reason.
  { label: "ace build-graph drift", cmd: ["bun", "src/Core.TypeScript/ace/build-graph.ts", "drift-check"] },
  // Same self-scoping shape, same reason, and a measured history behind it. The two check-arity
  // censuses are hand-maintained ratchets whose row must be raised by whatever change adds an
  // assertion. On 2026-08-26 that coupling red-lined `main` in three episodes across the two
  // audits — one of them 5h27m, cured by a one-line registry edit five hours after the commit that
  // caused it — because the job reporting them is `lint-bash-retirement-inventory`, which is NOT in
  // `gate (required)`'s `needs`, so nothing forced anyone to look. These entries are what let a
  // laptop find it first. They derive NOTHING unless the change touches a scanned test file, the
  // census, or the audit itself.
  {
    label: "check-arity census drift",
    cmd: ["bun", "src/Core.TypeScript/hygiene/audit-check-arity.ts", "--drift-check"],
  },
  {
    label: "check-arity census drift (non-equality)",
    cmd: ["bun", "src/Core.TypeScript/hygiene/audit-check-arity-nonequality.ts", "--drift-check"],
  },
  {
    label: "inventory items.json current",
    cmd: ["bun", "src/Core.TypeScript/inventory/generate-items-json.ts", "--check"],
  },
  // The glob is REQUIRED: the config has no `globs` key, so a bare invocation
  // lints zero files (a false pass). Matches the gate: markdownlint-cli2 "**/*.md".
  { label: "markdownlint", cmd: ["npx", "--yes", "markdownlint-cli2", "**/*.md"] },
  // Per-language code lints — the set the gate short-circuits over.
  { label: "lint: TypeScript (tsc)", cmd: ["bun", "src/Core.TypeScript/lint/lint-typescript.ts"] },
  { label: "lint: F#", cmd: ["bun", "src/Core.TypeScript/lint/lint-fsharp.ts"] },
  { label: "lint: C#", cmd: ["bun", "src/Core.TypeScript/lint/lint-csharp.ts"] },
  { label: "lint: Python", cmd: ["bun", "src/Core.TypeScript/lint/lint-python.ts"] },
  { label: "lint: Rust", cmd: ["bun", "src/Core.TypeScript/lint/lint-rust.ts"] },
  // CAVEAT: lint-go.ts runs `go fmt ./...`, which REWRITES files in place rather
  // than verifying (`gofmt -l`). So this check may modify your Go sources (and
  // always passes even on drift). Review `git status` after a run. Tracked as a
  // follow-up: switch lint-go.ts to `gofmt -l` so Go format drift FAILS the gate.
  { label: "lint: Go", cmd: ["bun", "src/Core.TypeScript/lint/lint-go.ts"] },
  // The long poles last (skipped under --quick).
  { label: "dotnet build -c Release", cmd: ["dotnet", "build", "Zeta.sln", "-c", "Release"], slow: true },
  { label: "dotnet test -c Release", cmd: ["dotnet", "test", "Zeta.sln", "-c", "Release"], slow: true },
];

type Status = "pass" | "fail" | "skip";

interface Result {
  readonly label: string;
  readonly status: Status;
  /** Captured combined output, kept only for failures (shown in the summary). */
  readonly output: string;
  readonly note?: string;
}

function runCheck(check: Check): Result {
  process.stdout.write(`▶ ${check.label} … `);
  const [bin, ...args] = check.cmd;
  const r = spawnSync(bin, args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  // Tool genuinely absent (e.g. golangci-lint / dotnet not installed locally) →
  // SKIP, not FAIL: the dimension was not verified, but that is not breakage.
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") {
    console.log("SKIP (tool not found)");
    return { label: check.label, status: "skip", output: "", note: `${bin} not on PATH` };
  }
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  // A lint script that aborts because its own toolchain is missing → SKIP.
  if (r.status !== 0 && /not found|Executable not found|command not found/i.test(output)) {
    console.log("SKIP (toolchain missing)");
    return { label: check.label, status: "skip", output, note: "underlying tool unavailable" };
  }
  if (r.status === 0) {
    console.log("PASS");
    return { label: check.label, status: "pass", output };
  }
  console.log("FAIL");
  return { label: check.label, status: "fail", output };
}

function main(): number {
  const args = new Set(Bun.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(
      "preflight — run every code-correctness gate dimension locally, report all failures.\n" +
        "  --quick   skip the slow dotnet build + test\n" +
        "  --help    this message",
    );
    return 0;
  }
  const quick = args.has("--quick") || args.has("--no-tests");

  console.log(`Preflight (${quick ? "quick: lints + tsc" : "full: lints + tsc + build + test"})\n`);

  // Run codegen to verify generated files are correct locally
  const codegenResult = spawnSync("bun", ["tools/codegen/generate-identity-registry.ts"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (codegenResult.status !== 0) {
    console.error("FAIL: Identity registry codegen failed!");
    console.error(codegenResult.stdout + codegenResult.stderr);
    return 1;
  }

  const results: Result[] = [];
  for (const check of CHECKS) {
    if (quick && check.slow) continue;
    results.push(runCheck(check));
  }

  const failed = results.filter((r) => r.status === "fail");
  const skipped = results.filter((r) => r.status === "skip");

  // Dump every failure's output together, so one run shows the whole picture.
  if (failed.length > 0) {
    console.log(`\n${"═".repeat(60)}\nFAILURES (${failed.length})\n${"═".repeat(60)}`);
    for (const f of failed) {
      console.log(`\n──── ${f.label} ────`);
      console.log(f.output.trimEnd() || "(no output captured)");
    }
  }

  console.log(`\n${"─".repeat(60)}\nSummary`);
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : r.status === "skip" ? "•" : "✗";
    console.log(`  ${mark} ${r.label}${r.note ? ` — ${r.note}` : ""}`);
  }
  if (skipped.length > 0) {
    console.log(`\n${skipped.length} check(s) SKIPPED (tool unavailable locally) — they will still run in CI.`);
  }
  if (failed.length > 0) {
    console.log(`\n✗ preflight: ${failed.length} check(s) failed.`);
    return 1;
  }
  console.log(`\n✓ preflight: all ${results.length - skipped.length} executed check(s) passed.`);
  return 0;
}

process.exit(main());
