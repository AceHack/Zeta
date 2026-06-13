#!/usr/bin/env bun
// check-tick-history-shard-schema.ts — validate loop tick shard file
// paths, names, and first-row timestamps.
//
// TypeScript+Bun port of check-tick-history-shard-schema.sh for the
// Rule 0 bash-to-TS migration.
//
// Usage:
//   bun tools/hygiene/check-tick-history-shard-schema.ts
//   bun tools/hygiene/check-tick-history-shard-schema.ts --files <paths...>
//
// Exit codes:
//   0   all checked shards match the schema
//   1   one or more shard violations found
//   2   tick shard directory missing

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function repoRoot(): string {
  if (process.env["REPO_ROOT"]) return process.env["REPO_ROOT"];
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

const ROOT = resolve(repoRoot());
const SHARD_DIR = join(ROOT, "docs/hygiene-history/ticks");

const BARE_RE = /^(\d{4})Z(-[0-9a-f]+)?$/;
const HASH_RE = /^(\d{4})(\d{2})Z-[0-9a-f]+$/;
const COL1_RE = /^\|\s(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)\s\|\s/;
const SHARD_PREFIX = "docs/hygiene-history/ticks/";

export interface ScanResult {
  path: string;
  ok: boolean;
  violation?: string;
}

function normalizeToPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

function repoRelative(p: string): string {
  return normalizeToPosix(relative(ROOT, p));
}

export function scanOne(shardPath: string): ScanResult {
  const pathRel = repoRelative(resolve(ROOT, shardPath));
  const base = basename(shardPath, ".md");

  const parts = pathRel.replace(SHARD_PREFIX, "").split("/");
  const yyyy = parts[0] ?? "";
  const mm = parts[1] ?? "";
  const dd = parts[2] ?? "";

  let hh: string;
  let mmOfHour: string;
  const bareMatch = BARE_RE.exec(base);
  const hashMatch = HASH_RE.exec(base);
  if (bareMatch) {
    const hhmm = bareMatch[1] ?? "";
    hh = hhmm.slice(0, 2);
    mmOfHour = hhmm.slice(2, 4);
  } else if (hashMatch) {
    const hhmm = hashMatch[1] ?? "";
    hh = hhmm.slice(0, 2);
    mmOfHour = hhmm.slice(2, 4);
  } else {
    return {
      path: pathRel,
      ok: false,
      violation:
        "filename does not match HHMMZ.md, HHMMZ-<hex>.md, or HHMMSSZ-<hex>.md",
    };
  }

  const content = readFileSync(shardPath, "utf8");
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) {
    return { path: pathRel, ok: false, violation: "file is empty" };
  }

  const pipeCount = (firstLine.match(/\|/g) ?? []).length;
  if (pipeCount < 7) {
    return {
      path: pathRel,
      ok: false,
      violation: `first row has ${pipeCount} pipes; schema requires 6 columns (7+)`,
    };
  }

  const col1Match = COL1_RE.exec(firstLine);
  if (!col1Match) {
    return {
      path: pathRel,
      ok: false,
      violation: "col1 must be exactly '| YYYY-MM-DDTHH:MM(:SS)?Z | ...'",
    };
  }

  const ts = col1Match[1] ?? "";
  const tsYyyy = ts.slice(0, 4);
  const tsMm = ts.slice(5, 7);
  const tsDd = ts.slice(8, 10);
  const tsHh = ts.slice(11, 13);
  const tsMin = ts.slice(14, 16);

  if (tsYyyy !== yyyy || tsMm !== mm || tsDd !== dd) {
    return {
      path: pathRel,
      ok: false,
      violation: `col1 timestamp ${ts} does not match path date ${yyyy}-${mm}-${dd}`,
    };
  }

  if (tsHh !== hh || tsMin !== mmOfHour) {
    return {
      path: pathRel,
      ok: false,
      violation: `col1 time ${tsHh}:${tsMin} does not match filename ${hh}:${mmOfHour}`,
    };
  }

  return { path: pathRel, ok: true };
}

function findShards(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string): void {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (entry.endsWith(".md") && entry !== "README.md")
          results.push(full);
      } catch {
        /* skip unreadable */
      }
    }
  }
  walk(dir);
  return results;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export function main(argv: string[]): number {
  let shards: string[];

  if (argv[0] === "--files") {
    shards = argv
      .slice(1)
      .map((p) => resolve(ROOT, p))
      .filter((p) => repoRelative(p).startsWith(SHARD_PREFIX))
      .filter((p) => repoRelative(p).endsWith(".md"))
      .filter((p) => basename(p) !== "README.md")
      .filter(isFile);
  } else {
    if (!isDir(SHARD_DIR)) {
      process.stderr.write(`error: ${SHARD_DIR} does not exist\n`);
      return 2;
    }
    shards = findShards(SHARD_DIR);
  }

  let violations = 0;
  for (const s of shards) {
    const result = scanOne(s);
    if (!result.ok) {
      process.stderr.write(`VIOLATION: ${result.path} — ${result.violation}\n`);
      violations++;
    }
  }

  process.stderr.write(
    `checked ${shards.length} shard files; ${violations} violations\n`,
  );
  return violations > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
