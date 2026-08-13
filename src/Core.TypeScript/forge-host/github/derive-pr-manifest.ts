#!/usr/bin/env bun
/**
 * derive-pr-manifest.ts — regenerate `docs/github/prs/manifest.jsonl` from the shard store.
 *
 * The second half of 081KZYMY46P087G0R003S64V2B: the shards are the ledger, the manifest is a
 * DERIVED index. Same `derive` + drift-gate shape as `src/Core.TypeScript/ace/build-graph.ts`
 * (#10395) — regenerating must reproduce the checked-in content, so the generator IS the
 * error-correcting code (`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`).
 *
 *   check (default)   exit 1 on drift, printing the first differing line. Read-only.
 *   --write           rewrite the manifest from the shards. Only writes on a content change.
 *
 * WHERE THE DRIFT GATE BELONGS — and where it does NOT.
 * A blocking PR-level gate here would be wrong: an archive PR that adds one shard makes the
 * checked-in manifest one line stale BY DESIGN, and failing that PR would recreate exactly the
 * serialization this work removes. So this is a REPAIR command for a cadence (a tick runs
 * `--write` and commits when it drifts), and a check for a human/agent verifying the store.
 * The property that keeps it honest is that repair is always mechanical: the derived file
 * carries no information the shards do not, so "regenerate" is always the correct resolution —
 * a manifest merge conflict is never hand-merged again.
 *
 * INTEGRITY IS LOUD. Unreadable, misfiled, or duplicate-keyed shards fail the run (exit 2)
 * instead of quietly producing a short manifest. A cleanup that drops a record is the
 * quiet-failure shape this repo refuses.
 *
 * Exit codes: 0 ok · 1 drift (check mode) · 2 shard-store integrity failure · 3 usage.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

import { MANIFEST_RELATIVE, SHARD_ROOT_RELATIVE, deriveManifest, loadAllShards } from "./pr-manifest-shards.ts";

export interface DeriveOptions {
  readonly root: string;
  readonly write: boolean;
}

export interface DeriveOutcome {
  readonly code: number;
  readonly lines: readonly string[];
}

/** First index at which two blobs' lines differ, or -1. */
export function firstDifferingLine(a: string, b: string): number {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) if (la[i] !== lb[i]) return i;
  return -1;
}

export function runDerive(opts: DeriveOptions): DeriveOutcome {
  const out: string[] = [];
  const shardRoot = join(opts.root, SHARD_ROOT_RELATIVE);
  const manifestPath = join(opts.root, MANIFEST_RELATIVE);

  const loaded = loadAllShards(shardRoot);
  if (loaded.rejected.length > 0 || loaded.misfiled.length > 0 || loaded.duplicates.length > 0) {
    for (const r of loaded.rejected) out.push(`::error::unreadable shard ${r.path}: ${r.reason}`);
    for (const m of loaded.misfiled) out.push(`::error::misfiled shard ${m.path}: ${m.reason}`);
    for (const d of loaded.duplicates) out.push(`::error::duplicate pr_number across shards: ${String(d)}`);
    return { code: 2, lines: out };
  }

  const next = deriveManifest(loaded.entries);
  const current = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
  const inSync = current === next;

  if (opts.write) {
    if (inSync) out.push(`${MANIFEST_RELATIVE} already current (${String(loaded.entries.length)} entries).`);
    else {
      writeFileSync(manifestPath, next, "utf8");
      out.push(`${MANIFEST_RELATIVE} rewritten from ${String(loaded.entries.length)} shards.`);
    }
    return { code: 0, lines: out };
  }

  if (inSync) {
    out.push(
      `${MANIFEST_RELATIVE} is in sync with ${SHARD_ROOT_RELATIVE} (${String(loaded.entries.length)} entries). ✓`,
    );
    return { code: 0, lines: out };
  }
  const i = firstDifferingLine(current, next);
  out.push(`::error::${MANIFEST_RELATIVE} has drifted from ${SHARD_ROOT_RELATIVE}.`);
  out.push(`  first difference at line ${String(i + 1)}`);
  out.push(`  checked-in: ${(current.split("\n")[i] ?? "(missing)").slice(0, 160)}`);
  out.push(`  derived:    ${(next.split("\n")[i] ?? "(missing)").slice(0, 160)}`);
  out.push(`  repair: bun src/Core.TypeScript/forge-host/github/derive-pr-manifest.ts --write`);
  return { code: 1, lines: out };
}

function usage(): string {
  return [
    "derive-pr-manifest — regenerate docs/github/prs/manifest.jsonl from docs/github/prs/shards/",
    "",
    "  (no flags)   check mode: exit 1 on drift, 2 on shard-store integrity failure",
    "  --write      rewrite the manifest from the shards",
    "  --root DIR   repo root (default: cwd)",
  ].join("\n");
}

export function main(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  const rootIdx = argv.indexOf("--root");
  const rootArg = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
  if (rootIdx >= 0 && (rootArg === undefined || rootArg.startsWith("--"))) {
    process.stderr.write("--root requires a value\n");
    return 3;
  }
  const outcome = runDerive({ root: resolve(rootArg ?? process.cwd()), write: argv.includes("--write") });
  for (const l of outcome.lines) {
    if (l.startsWith("::error::")) process.stderr.write(l + "\n");
    else process.stdout.write(l + "\n");
  }
  return outcome.code;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
