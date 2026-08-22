#!/usr/bin/env bun
/**
 * migrate-pr-manifest-to-shards.ts — one-time (but RE-RUNNABLE) migration of the single
 * `docs/github/prs/manifest.jsonl` file into the per-PR shard store.
 *
 * 081KZYMY46P087G0R003S64V2B. Re-runnable because every step is an upsert on `pr_number`:
 * running it twice writes the same bytes to the same paths, so it can be interrupted, resumed,
 * or repeated with no duplicate and no loss.
 *
 * NOTHING IS DROPPED. A line that cannot be parsed or validated goes to
 * `docs/github/prs/unparseable.jsonl` WITH its reason and its original line number, and is
 * counted in the summary. Losing an unreadable record during a cleanup is exactly the
 * quiet-failure this repo refuses; the sidecar is where a human finds them.
 *
 * VERIFICATION IS PART OF THE RUN. After writing shards, the tool derives the manifest back
 * out of them and compares it, line by line, against the input — reporting whether the round
 * trip is byte-identical modulo the ordering rule (`pr_number` ascending, integer compare;
 * see the ordering note in `pr-manifest-shards.ts`). `--verify-only` runs just that half.
 *
 *   bun src/Core.TypeScript/forge-host/github/migrate-pr-manifest-to-shards.ts [--root DIR]
 *       [--dry-run] [--verify-only] [--write-manifest]
 *
 *   --dry-run         report what would be written; touch nothing
 *   --verify-only     skip writing shards; only run the round-trip comparison
 *   --write-manifest  ALSO rewrite manifest.jsonl from the shards (normalises the ordering)
 *
 * Exit codes: 0 ok · 1 round-trip mismatch · 2 shard-store integrity failure · 3 usage.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  MANIFEST_RELATIVE,
  SHARD_ROOT_RELATIVE,
  UNPARSEABLE_RELATIVE,
  deriveManifest,
  loadAllShards,
  parseManifest,
  serializeManifestEntry,
  serializeUnparseable,
  writeShard,
} from "./pr-manifest-shards.ts";

export interface MigrateOptions {
  readonly root: string;
  readonly dryRun: boolean;
  readonly verifyOnly: boolean;
  readonly writeManifest: boolean;
}

export interface MigrateOutcome {
  readonly code: number;
  readonly lines: readonly string[];
}

export function runMigration(opts: MigrateOptions): MigrateOutcome {
  const out: string[] = [];
  const manifestPath = join(opts.root, MANIFEST_RELATIVE);
  const shardRoot = join(opts.root, SHARD_ROOT_RELATIVE);
  const sidecarPath = join(opts.root, UNPARSEABLE_RELATIVE);

  if (!existsSync(manifestPath)) {
    out.push(`::error::no manifest at ${manifestPath}`);
    return { code: 3, lines: out };
  }

  const blob = readFileSync(manifestPath, "utf8");
  const parsed = parseManifest(blob);
  out.push(`input:        ${MANIFEST_RELATIVE}`);
  out.push(`  parseable:  ${String(parsed.entries.length)}`);
  out.push(`  unparseable:${String(parsed.unparseable.length)}`);
  for (const u of parsed.unparseable) {
    out.push(`    line ${String(u.lineNumber)}: ${u.reason}`);
  }

  // Duplicate keys in the INPUT are a real finding — the shard store cannot represent two
  // entries for one PR, so the collision must be reported rather than silently resolved.
  const seen = new Map<number, number>();
  const dupes: number[] = [];
  for (const e of parsed.entries) {
    const n = seen.get(e.pr_number);
    if (n !== undefined) dupes.push(e.pr_number);
    seen.set(e.pr_number, (n ?? 0) + 1);
  }
  if (dupes.length > 0) out.push(`  duplicate pr_number in input: ${dupes.join(", ")}`);

  if (!opts.verifyOnly && !opts.dryRun) {
    if (parsed.unparseable.length > 0) {
      mkdirSync(dirname(sidecarPath), { recursive: true });
      writeFileSync(sidecarPath, serializeUnparseable(parsed.unparseable), "utf8");
      out.push(`quarantined ${String(parsed.unparseable.length)} line(s) -> ${UNPARSEABLE_RELATIVE}`);
    }
    let added = 0;
    let replaced = 0;
    let noop = 0;
    for (const e of parsed.entries) {
      const r = writeShard(e, shardRoot);
      if (r.classification === "added") added++;
      else if (r.classification === "replaced") replaced++;
      else noop++;
    }
    out.push(`shards:       added=${String(added)} replaced=${String(replaced)} noop=${String(noop)}`);
  } else if (opts.dryRun) {
    out.push(`dry-run: would write ${String(parsed.entries.length)} shards under ${SHARD_ROOT_RELATIVE}`);
    return { code: 0, lines: out };
  }

  // ── Round trip: shards -> derived manifest, compared to the input entries ──
  const loaded = loadAllShards(shardRoot);
  if (loaded.rejected.length > 0 || loaded.misfiled.length > 0 || loaded.duplicates.length > 0) {
    for (const r of loaded.rejected) out.push(`::error::unreadable shard ${r.path}: ${r.reason}`);
    for (const m of loaded.misfiled) out.push(`::error::misfiled shard ${m.path}: ${m.reason}`);
    for (const d of loaded.duplicates) out.push(`::error::duplicate pr_number across shards: ${String(d)}`);
    return { code: 2, lines: out };
  }

  const expected = [...parsed.entries].sort((a, b) => a.pr_number - b.pr_number).map(serializeManifestEntry);
  const derived = deriveManifest(loaded.entries);
  const derivedLines = derived.length === 0 ? [] : derived.slice(0, -1).split("\n");

  let mismatch = -1;
  for (let i = 0; i < Math.max(expected.length, derivedLines.length); i++) {
    if (expected[i] !== derivedLines[i]) {
      mismatch = i;
      break;
    }
  }
  out.push(`round trip:   input=${String(expected.length)} derived=${String(derivedLines.length)}`);
  if (mismatch >= 0) {
    out.push(`::error::round-trip mismatch at sorted index ${String(mismatch)}`);
    out.push(`  input:   ${(expected[mismatch] ?? "(missing)").slice(0, 200)}`);
    out.push(`  derived: ${(derivedLines[mismatch] ?? "(missing)").slice(0, 200)}`);
    return { code: 1, lines: out };
  }
  out.push(`round trip:   BYTE-IDENTICAL modulo ordering (pr_number ascending, integer compare) ✓`);

  if (opts.writeManifest && !opts.verifyOnly) {
    const current = readFileSync(manifestPath, "utf8");
    if (current === derived) out.push(`${MANIFEST_RELATIVE} already in derived form.`);
    else {
      writeFileSync(manifestPath, derived, "utf8");
      out.push(`${MANIFEST_RELATIVE} rewritten in derived order.`);
    }
  }
  return { code: 0, lines: out };
}

export function main(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(
      [
        "migrate-pr-manifest-to-shards — manifest.jsonl -> docs/github/prs/shards/",
        "",
        "  --root DIR        repo root (default: cwd)",
        "  --dry-run         report only; write nothing",
        "  --verify-only     only run the shards -> manifest round-trip check",
        "  --write-manifest  also rewrite manifest.jsonl in derived order",
      ].join("\n") + "\n",
    );
    return 0;
  }
  const rootIdx = argv.indexOf("--root");
  const rootArg = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
  if (rootIdx >= 0 && (rootArg === undefined || rootArg.startsWith("--"))) {
    process.stderr.write("--root requires a value\n");
    return 3;
  }
  const outcome = runMigration({
    root: resolve(rootArg ?? process.cwd()),
    dryRun: argv.includes("--dry-run"),
    verifyOnly: argv.includes("--verify-only"),
    writeManifest: argv.includes("--write-manifest"),
  });
  for (const l of outcome.lines) {
    if (l.startsWith("::error::")) process.stderr.write(l + "\n");
    else process.stdout.write(l + "\n");
  }
  return outcome.code;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
