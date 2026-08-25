#!/usr/bin/env bun
// check-github-settings-drift.ts — diff the current GitHub settings of a
// repo against the checked-in expected snapshot. Detects click-ops drift
// for settings that GitHub does not expose as declarative config.
//
// TypeScript+Bun port of check-github-settings-drift.sh, per Rule 0
// (no more .sh files except install-graph; TS IS cross-platform DST).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/check-github-settings-drift.ts [--repo OWNER/NAME] [--expected PATH]
//
// Defaults:
//   --repo        $GH_REPO, else `gh repo view --json nameWithOwner`
//   --expected    src/Core.TypeScript/hygiene/github-settings.expected.json (next to this script)
//   --live-from   PATH to a previously captured snapshot, used INSTEAD of a
//                 live `gh api` read. Offline replay (manifesto §7 DST): the
//                 comparison is a pure function of two files, so every branch
//                 of this tool — including the zero-readable INDETERMINATE
//                 exit — can be exercised and shown failing without minting a
//                 deliberately-underpowered credential to prove it. A branch
//                 that can only be reached by holding a weak token is a
//                 branch nobody ever demonstrates.
//
// Exit codes:
//   0   — no drift, and at least one field was actually compared
//   1   — drift detected (diff printed to stdout)
//   2   — tooling / input error
//   3   — INDETERMINATE: the credential could read NOTHING, so nothing was
//         compared. Distinguished from 0 because a scan that compared zero
//         fields did not pass, it did not run — and the two must never share
//         an exit code. (#14914's lesson, applied to this detector.)
//
// WHAT "NO DRIFT" DOES AND DOES NOT MEAN
//
// Fields the running credential cannot read arrive as
// `{"_skipped":"insufficient-token-scope"}` on the live side. They are
// dropped from BOTH sides before the diff — there is no honest way to
// compare a value you could not read — which means a green result covers
// only the fields that were readable. Under `GITHUB_TOKEN` that excludes
// `default_branch_protection`, `actions_permissions`, `codeql_default_setup`,
// `repo.security_and_analysis` and the whole merge-settings group: they are
// RECORDED IN-TREE AND NOT CHECKED.
//
// So every run now prints that set — count, names, and the endpoint each one
// came from — on STDOUT next to the verdict, not on stderr where an advisory
// job's log buries it. The number is the honest denominator of the check, and
// a check that will not state its own denominator is not reporting a result.
//
// The refused "fix" for all of this, recorded so nobody reaches for it: do
// NOT re-snapshot with the same weak token. That would replace 21 recorded
// values with 21 sentinels, delete them from the comparison, and turn the
// check green — converting "recorded and unchecked" into "absent and
// unchecked" while manufacturing the appearance of success. The expected
// file in this repo is generated with an admin credential ON PURPOSE.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_READ_CREDENTIAL_NOTE,
  endpointForPath,
  isSkippedSentinel,
  ordinal,
  snapshot,
} from "./snapshot-github-settings.ts";

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

export interface Args {
  readonly repo: string;
  readonly expected: string;
  readonly liveFrom: string | null;
}

export type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "error"; readonly message: string };

/**
 * How many values actually survived to be compared.
 *
 * The question this answers is "did the comparison have any subject at all",
 * so zero is the case that must never be reported as success.
 *
 * An EMPTY array counts as one leaf, a non-empty one as the sum of its
 * elements. Empty is a real compared value (`"topics": []` means "no topics",
 * and verifying that is work), so scoring it zero would risk calling a
 * legitimate run INDETERMINATE. Scoring a populated array as one, which this
 * did at first, hides the opposite case: after `bypass_actors` is stripped
 * out of every element the `rulesets` array can be emptied of everything that
 * mattered while still scoring 1.
 */
export function countLeaves(v: unknown): number {
  if (v === null || typeof v !== "object") return 1;
  if (Array.isArray(v)) {
    if (v.length === 0) return 1;
    return v.reduce<number>((n, el) => n + countLeaves(el), 0);
  }
  let n = 0;
  for (const key of Object.keys(v as Record<string, unknown>)) {
    n += countLeaves((v as Record<string, unknown>)[key]);
  }
  return n;
}

export interface ReadabilityPartition {
  /** Paths the LIVE read could not reach — recorded in-tree, not verified. */
  readonly unreadableLive: readonly string[];
  /** Paths the RECORD itself carries as a sentinel — never recorded at all. */
  readonly unreadableExpected: readonly string[];
  /** Leaves remaining on the live side after stripping. 0 ⇒ nothing ran. */
  readonly comparedLeaves: number;
}

/**
 * Drop every field either side could not read, and report what was dropped.
 *
 * MUTATES both arguments — the caller re-serialises them for the diff.
 *
 * Both directions matter and they mean different things:
 *   - unreadable on the LIVE side  ⇒ the record holds a value this run could
 *     not verify. The record is fine; the credential is short.
 *   - unreadable on the EXPECTED side ⇒ the record itself never captured the
 *     field. A stronger credential now cannot help, because there is nothing
 *     to compare against. That is the worse of the two and it was previously
 *     invisible: the old strip walked `Object.keys(live)` only, so a sentinel
 *     sitting in the committed file was silently diffed against a real value
 *     and reported as ordinary drift.
 */
export function partitionByReadability(
  live: Record<string, unknown>,
  exp: Record<string, unknown>,
): ReadabilityPartition {
  const unreadableLive: string[] = [];
  const unreadableExpected: string[] = [];

  function walk(l: Record<string, unknown>, e: Record<string, unknown>, prefix: string): void {
    for (const key of [...new Set([...Object.keys(l), ...Object.keys(e)])].sort(ordinal)) {
      const path = prefix.length > 0 ? `${prefix}.${key}` : key;
      const lv = l[key];
      const ev = e[key];
      const lSkip = isSkippedSentinel(lv);
      const eSkip = isSkippedSentinel(ev);
      if (lSkip || eSkip) {
        if (lSkip) unreadableLive.push(path);
        if (eSkip) unreadableExpected.push(path);
        delete l[key];
        delete e[key];
        continue;
      }
      if (Array.isArray(lv) && Array.isArray(ev) && lv.length === ev.length) {
        // Element-wise, and ONLY at equal length. The snapshot sorts
        // `rulesets` by id, so equal lengths align; unequal lengths mean a
        // ruleset was added or removed, which is real drift and must reach
        // the diff intact rather than being partly stripped by a
        // mis-aligned walk.
        //
        // This descent is load-bearing rather than tidy: `bypass_actors` is
        // the one field a non-admin credential silently cannot read, and it
        // lives inside an array element. Without this, that sentinel would
        // be diffed literally and reported as "the admin bypass was removed"
        // — a false finding whose cheapest fix is to record `[]` and erase
        // the real one.
        for (let i = 0; i < lv.length; i += 1) {
          const le = lv[i];
          const ee = ev[i];
          if (le !== null && typeof le === "object" && !Array.isArray(le) && ee !== null && typeof ee === "object" && !Array.isArray(ee)) {
            walk(le as Record<string, unknown>, ee as Record<string, unknown>, `${path}[${i}]`);
          }
        }
      } else if (
        lv !== null &&
        typeof lv === "object" &&
        !Array.isArray(lv) &&
        ev !== null &&
        typeof ev === "object" &&
        !Array.isArray(ev)
      ) {
        walk(lv as Record<string, unknown>, ev as Record<string, unknown>, path);
      }
    }
  }

  walk(live, exp, "");
  return { unreadableLive, unreadableExpected, comparedLeaves: countLeaves(live) };
}

/**
 * The human-readable "what this run did not check" block.
 *
 * Returned as lines rather than printed so it is testable without capturing
 * stdout — the same reason `partitionByReadability` is pure.
 */
export function formatReadabilityReport(part: ReadabilityPartition, repo: string): string[] {
  const lines: string[] = [];
  if (part.unreadableLive.length > 0) {
    lines.push(
      `github-settings-drift: RECORDED BUT NOT CHECKED — ${part.unreadableLive.length} field(s) this credential could not read:`,
    );
    for (const path of part.unreadableLive) {
      lines.push(`    ${path}  <-  ${endpointForPath(path, repo)}`);
    }
  }
  if (part.unreadableExpected.length > 0) {
    lines.push(
      `github-settings-drift: NOT RECORDED AT ALL — ${part.unreadableExpected.length} field(s) the committed snapshot never captured:`,
    );
    for (const path of part.unreadableExpected) lines.push(`    ${path}`);
    lines.push("    A stronger credential cannot verify these: there is no recorded value to compare against.");
    lines.push("    Re-snapshot with an admin credential to give them one.");
  }
  if (lines.length > 0) lines.push(ADMIN_READ_CREDENTIAL_NOTE);
  lines.push(
    `github-settings-drift: compared ${part.comparedLeaves} readable leaf value(s); ` +
      `${part.unreadableLive.length} recorded-but-unverified, ${part.unreadableExpected.length} unrecorded.`,
  );
  return lines;
}

export async function parseArgs(argv: readonly string[]): Promise<ParseResult> {
  let repo = "";
  let expected = resolve(SCRIPT_DIR, "github-settings.expected.json");
  let liveFrom: string | null = null;
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
    } else if (arg === "--live-from") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: "error: --live-from requires PATH argument" };
      }
      liveFrom = value;
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

  if (repo.length === 0 && liveFrom === null) {
    return { kind: "error", message: "error: cannot determine repo; pass --repo OWNER/NAME or set GH_REPO" };
  }

  return { kind: "args", args: { repo: repo.length > 0 ? repo : "(replay)", expected, liveFrom } };
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = await parseArgs(argv);
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  const { repo, expected, liveFrom } = parsed.args;

  // Verify expected snapshot exists
  let expectedContent: string;
  try {
    expectedContent = readFileSync(expected, "utf8");
  } catch {
    process.stderr.write(`error: expected snapshot not found: ${expected}\n`);
    return 2;
  }

  // Generate live snapshot — or replay a captured one.
  let liveContent: string;
  if (liveFrom !== null) {
    try {
      liveContent = readFileSync(liveFrom, "utf8");
    } catch {
      process.stderr.write(`error: --live-from snapshot not found: ${liveFrom}\n`);
      return 2;
    }
    process.stdout.write(`github-settings-drift: REPLAY — live side read from ${liveFrom}, not from gh api\n`);
  } else {
    try {
      liveContent = await snapshot(repo);
    } catch (err: unknown) {
      process.stderr.write(`error: snapshot failed: ${err instanceof Error ? err.message : String(err)}\n`);
      return 2;
    }
  }

  // Drop every field either side could not read, and SAY SO. The dropping is
  // unavoidable — you cannot diff a value you were never shown — but the
  // silence was not: this report used to go to stderr in an advisory job,
  // which is a place results go to be unread.
  let liveObj: Record<string, unknown>;
  let expectedObj: Record<string, unknown>;
  try {
    liveObj = JSON.parse(liveContent) as Record<string, unknown>;
    expectedObj = JSON.parse(expectedContent) as Record<string, unknown>;
  } catch {
    process.stderr.write("error: failed to parse JSON snapshots\n");
    return 2;
  }

  const part = partitionByReadability(liveObj, expectedObj);
  const reportLines = formatReadabilityReport(part, repo);
  for (const line of reportLines) process.stdout.write(`${line}\n`);
  if (part.unreadableLive.length > 0 || part.unreadableExpected.length > 0) {
    // A GitHub annotation as well as the log line: an advisory job's log is
    // read by whoever went looking, an annotation is read by whoever did not.
    process.stdout.write(
      `::warning title=github-settings-drift coverage::${part.unreadableLive.length} recorded field(s) were NOT verified ` +
        `and ${part.unreadableExpected.length} are not recorded at all; ${part.comparedLeaves} leaf value(s) were compared. ` +
        "See the job log for the field list and the credential that would read them.\n",
    );
  }

  // A scan that compared nothing did not pass. Refuse to spend exit 0 on it.
  if (part.comparedLeaves === 0) {
    process.stdout.write(
      "::error title=github-settings-drift INDETERMINATE::this credential could read NO settings at all, " +
        "so ZERO fields were compared. This check DID NOT RUN; it did not pass.\n",
    );
    process.stderr.write(
      `github-settings-drift: INDETERMINATE (repo=${repo}) — 0 fields readable, 0 compared. Exit 3.\n`,
    );
    return 3;
  }

  liveContent = JSON.stringify(liveObj, null, 2);
  expectedContent = JSON.stringify(expectedObj, null, 2);

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
      // Deliberately not the word "clean": this covers the readable fields
      // only, and the count above is the scope of the claim.
      process.stdout.write(
        `github-settings-drift: no drift across the ${part.comparedLeaves} compared leaf value(s) (repo=${repo})\n`,
      );
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
      process.stderr.write(`     bun src/Core.TypeScript/hygiene/snapshot-github-settings.ts --repo ${repo} > ${expected}\n`);
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
