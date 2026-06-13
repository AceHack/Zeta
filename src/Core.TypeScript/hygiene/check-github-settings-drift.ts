#!/usr/bin/env bun
// check-github-settings-drift.ts — diff the current GitHub settings of a
// repo against the checked-in expected snapshot. Detects click-ops drift
// for settings that GitHub does not expose as declarative config.
//
// TypeScript+Bun port of check-github-settings-drift.sh, per Rule 0
// (no more .sh files except install-graph; TS IS cross-platform DST).
//
// Usage:
//   bun tools/hygiene/check-github-settings-drift.ts [--repo OWNER/NAME] [--expected PATH]
//
// Defaults:
//   --repo        $GH_REPO, else `gh repo view --json nameWithOwner`
//   --expected    tools/hygiene/github-settings.expected.json (next to this script)
//
// Exit codes:
//   0   — no drift
//   1   — drift detected (diff printed to stdout)
//   2   — tooling / input error

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { snapshot } from "./snapshot-github-settings.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function runCmd(cmd: readonly string[]): Promise<SpawnResult> {
  const proc = Bun.spawn({
    cmd: [...cmd],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

interface Args {
  readonly repo: string;
  readonly expected: string;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "error"; readonly message: string };

export async function parseArgs(argv: readonly string[]): Promise<ParseResult> {
  let repo = "";
  let expected = resolve(SCRIPT_DIR, "github-settings.expected.json");
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--repo") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: "error: --repo requires OWNER/NAME argument" };
      }
      repo = value;
      i += 2;
    } else if (arg === "--expected") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: "error: --expected requires PATH argument" };
      }
      expected = value;
      i += 2;
    } else {
      return { kind: "error", message: `error: unknown arg: ${String(arg)}` };
    }
  }

  if (repo.length === 0) {
    repo = process.env.GH_REPO ?? "";
  }

  if (repo.length === 0) {
    const r = await runCmd(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    if (r.exitCode === 0 && r.stdout.trim().length > 0) {
      repo = r.stdout.trim();
    }
  }

  if (repo.length === 0) {
    return { kind: "error", message: "error: cannot determine repo; pass --repo OWNER/NAME or set GH_REPO" };
  }

  return { kind: "args", args: { repo, expected } };
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = await parseArgs(argv);
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  const { repo, expected } = parsed.args;

  // Verify expected snapshot exists
  let expectedContent: string;
  try {
    expectedContent = readFileSync(expected, "utf8");
  } catch {
    process.stderr.write(`error: expected snapshot not found: ${expected}\n`);
    return 2;
  }

  // Generate live snapshot
  let liveContent: string;
  try {
    liveContent = await snapshot(repo);
  } catch (err: unknown) {
    process.stderr.write(`error: snapshot failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }

  // Strip scope-limited fields: when the live snapshot emits {_skipped: "insufficient-token-scope"}
  // for a field (e.g. actions/permissions requires admin token, not available in CI), drop that
  // field from both sides so a missing-scope field doesn't register as false drift.
  // Stripping is recursive so nested fields (e.g. counts.webhooks) are also handled.
  let liveObj: Record<string, unknown>;
  let expectedObj: Record<string, unknown>;
  try {
    liveObj = JSON.parse(liveContent) as Record<string, unknown>;
    expectedObj = JSON.parse(expectedContent) as Record<string, unknown>;
  } catch {
    process.stderr.write("error: failed to parse JSON snapshots\n");
    return 2;
  }

  function isSkipped(v: unknown): boolean {
    return (
      v !== null &&
      typeof v === "object" &&
      "_skipped" in (v as Record<string, unknown>) &&
      (v as Record<string, unknown>)._skipped === "insufficient-token-scope"
    );
  }

  function stripSkippedSentinels(
    live: Record<string, unknown>,
    exp: Record<string, unknown>,
    pathPrefix: string,
    report: string[],
  ): void {
    for (const key of Object.keys(live)) {
      const val = live[key];
      if (isSkipped(val)) {
        report.push(pathPrefix.length > 0 ? `${pathPrefix}.${key}` : key);
        delete live[key];
        delete exp[key];
      } else if (
        val !== null &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        exp[key] !== null &&
        typeof exp[key] === "object" &&
        !Array.isArray(exp[key])
      ) {
        stripSkippedSentinels(
          val as Record<string, unknown>,
          exp[key] as Record<string, unknown>,
          pathPrefix.length > 0 ? `${pathPrefix}.${key}` : key,
          report,
        );
      }
    }
  }

  const skippedPaths: string[] = [];
  stripSkippedSentinels(liveObj, expectedObj, "", skippedPaths);

  if (skippedPaths.length > 0) {
    process.stderr.write(
      `github-settings-drift: skipping ${skippedPaths.length} field(s) not readable with current token: ${skippedPaths.join(", ")}\n`,
    );
    liveContent = JSON.stringify(liveObj, null, 2);
    expectedContent = JSON.stringify(expectedObj, null, 2);
  }

  if (!liveContent.endsWith("\n")) liveContent += "\n";
  if (!expectedContent.endsWith("\n")) expectedContent += "\n";

  // Write both to temp files for diff (content may have been stripped above)
  const ts = Date.now();
  const tmpLive = resolve(SCRIPT_DIR, `.github-settings-live-${ts}.json`);
  const tmpExp = resolve(SCRIPT_DIR, `.github-settings-expected-${ts}.json`);
  try {
    writeFileSync(tmpLive, liveContent, "utf8");
    writeFileSync(tmpExp, expectedContent, "utf8");

    // Run diff — exit 0 = identical, 1 = differences, 2 = error
    // Use --label so output shows real paths, not temp paths.
    const diffResult = await runCmd(["diff", "-u", "--label", expected, "--label", "(live from gh api)", tmpExp, tmpLive]);

    if (diffResult.exitCode === 0) {
      process.stderr.write(`github-settings-drift: no drift (repo=${repo})\n`);
      return 0;
    } else if (diffResult.exitCode >= 2) {
      process.stderr.write(`error: diff command failed (exit ${diffResult.exitCode}): ${diffResult.stderr.trim()}\n`);
      return 2;
    } else {
      // exit code 1 = differences found (drift detected)
      process.stdout.write(diffResult.stdout);
      process.stderr.write("\n");
      process.stderr.write(`github-settings-drift: DRIFT DETECTED (repo=${repo})\n`);
      process.stderr.write(`  expected: ${expected}\n`);
      process.stderr.write("  current : (live from gh api)\n");
      process.stderr.write("\n");
      process.stderr.write("Resolve options:\n");
      process.stderr.write("  1. Intentional change -> update expected snapshot:\n");
      process.stderr.write(`     bun tools/hygiene/snapshot-github-settings.ts --repo ${repo} > ${expected}\n`);
      process.stderr.write("     Then commit the diff with a message explaining the policy change.\n");
      process.stderr.write("  2. Unintentional change -> revert the setting in GitHub UI/API\n");
      process.stderr.write("     and re-run this script to confirm.\n");
      return 1;
    }
  } finally {
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tmpLive);
    } catch {
      // Best-effort cleanup
    }
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tmpExp);
    } catch {
      // Best-effort cleanup
    }
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    },
  );
}
