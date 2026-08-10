#!/usr/bin/env bun
// audit-lockfile-sync.ts — LD001: package.json and bun.lock disagree.
//
// Why this class earned a detector
// --------------------------------
// It turned main red TWICE on 2026-08-10, in both directions:
//   c101a6ac9  ADDED @google/genai + epub-gen-memory, no lockfile update
//   47095a706  REMOVED @google/genai, no lockfile update
// Every consumer runs `bun install --frozen-lockfile`, which fails closed on any
// divergence, so a dependency edit without its regenerated lockfile breaks the
// build for everyone until someone notices. Both times, someone noticing was the
// recovery mechanism. This replaces that with a measurement.
//
// The detection is AUTHORITATIVE, not heuristic: it runs the very command the
// consumers run (`--frozen-lockfile --dry-run`), so it cannot disagree with them
// about what counts as desync. A text-diff of dependency names would be cheaper and
// would drift from bun's actual resolution rules; this cannot.
//
// Output is the drift-ledger finding format consumed by `.github/workflows/
// drift-sweep.yml` -> `drift-ledger.ts sweep`:
//     <tracked-path>:<line> <CLASS>/<subclass> <message>
// The path must be git-tracked to survive the sweep's `--tracked` guard.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-lockfile-sync.ts             # ledger findings on stdout
//   bun src/Core.TypeScript/hygiene/audit-lockfile-sync.ts --human     # readable report
//
// Exit codes:
//   0   in sync
//   1   desync detected (a finding was emitted)
//   2   could not determine (bun missing, install errored for another reason)

import { resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export const DRIFT_CLASS = "LD001";
export const FINDING_PATH = "package.json";

export type SyncVerdict =
  | { kind: "in-sync" }
  | { kind: "desync"; detail: string }
  | { kind: "indeterminate"; detail: string };

/**
 * Classify bun's own output. `--frozen-lockfile` fails closed with a specific
 * message on desync; any OTHER non-zero exit (network, corrupt cache, missing
 * binary) is INDETERMINATE, never desync. Reporting a network blip as dependency
 * drift would pollute the ledger and, worse, invite a healer to "fix" a lockfile
 * that was never wrong.
 */
export function classify(exitCode: number, output: string): SyncVerdict {
  if (exitCode === 0) return { kind: "in-sync" };
  const desync = /lockfile had changes, but lockfile is frozen/i.test(output);
  if (desync) {
    return {
      kind: "desync",
      detail: "package.json dependencies changed without a regenerated bun.lock",
    };
  }
  const firstError =
    output
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /^error:/i.test(l)) ?? `bun exited ${exitCode}`;
  return { kind: "indeterminate", detail: firstError };
}

export async function checkSync(): Promise<SyncVerdict> {
  let proc;
  try {
    proc = Bun.spawn(["bun", "install", "--frozen-lockfile", "--dry-run"], {
      cwd: repoRoot(),
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    return { kind: "indeterminate", detail: `could not run bun: ${(err as Error).message}` };
  }
  const [out, errText] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return classify(await proc.exited, `${out}\n${errText}`);
}

export function renderFinding(v: SyncVerdict): string {
  if (v.kind !== "desync") return "";
  return (
    `${FINDING_PATH}:1 ${DRIFT_CLASS}/lockfile-desync ` +
    `${v.detail} — run \`bun install\` and commit bun.lock in the same commit ` +
    `(every consumer runs --frozen-lockfile, so this fails the build for everyone)`
  );
}

export async function main(argv: string[]): Promise<number> {
  const v = await checkSync();
  const human = argv.includes("--human");

  if (v.kind === "in-sync") {
    if (human) process.stdout.write("lockfile-sync: OK — package.json and bun.lock agree.\n");
    return 0;
  }
  if (v.kind === "indeterminate") {
    // Deliberately NOT a finding. See classify().
    process.stderr.write(`lockfile-sync: INDETERMINATE — ${v.detail}\n`);
    return 2;
  }
  process.stdout.write(
    human
      ? `lockfile-sync: DESYNC — ${v.detail}\n\n  Heal: bun install && git add bun.lock\n`
      : renderFinding(v) + "\n",
  );
  return 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
