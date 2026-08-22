#!/usr/bin/env bun
// split-by-license.ts -- split ROM files into a tracked safe directory and an
// untracked unsafe directory based on an allowlist manifest. Part of 081KR2E4K0008QG0R001JC6S3N.
//
// Usage:
//   bun src/Core.TypeScript/roms/split-by-license.ts --rom-dir <dir> --safe-dir <dir> --unsafe-dir <dir> --allowlist <path>
//   bun src/Core.TypeScript/roms/split-by-license.ts --rom-dir <dir> --safe-dir <dir> --unsafe-dir <dir> --allowlist <path> --apply
//
// Output (default dry-run): JSON array of { file, classification, moved }.
// --apply: actually moves files. Default is report-only because the failure
// mode (silently moving the wrong file across the legal safe/unsafe boundary)
// has the "legal blast radius" framing of 081KQ8P5D0008QG0R001590WJ3 -- so moves are opt-in,
// mirroring the sibling src/Core.TypeScript/roms/canonicalize.ts --apply discipline.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { extname, join } from "node:path";

// ROM file extensions this tool will classify. Non-ROM entries (the tracked
// README.md / .gitignore sentinels per roms/.gitignore, subdirectories, dot
// files) are skipped so the sentinels that keep the directory tracked are
// never moved into the unsafe directory.
const ROM_EXTENSIONS = new Set([
  ".bin",
  ".a26",
  ".rom",
  ".int",
  ".vec",
  ".gg",
  ".sms",
  ".gen",
  ".smc",
  ".sfc",
  ".nes",
  ".gb",
  ".gbc",
  ".gba",
  ".n64",
  ".z64",
  ".v64",
  ".pce",
  ".ngp",
  ".ngc",
  ".ws",
  ".wsc",
  ".sg",
  ".32x",
  ".col",
]);

// Reject any name that could escape the destination directory when used as a
// path component. Mirrors isSafeCanonicalName in src/Core.TypeScript/roms/canonicalize.ts.
export function isSafeFilename(name: string): boolean {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("\0") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

// Parse an allowlist manifest: one bare filename per line, blank lines and
// `#` comment lines ignored. Comments carry the per-ROM license citation
// required by 081KQ8P5D0008QG0R001590WJ3 acceptance criteria; the parser drops them so they do
// not affect matching.
export function parseAllowlist(content: string): ReadonlySet<string> {
  const names = new Set<string>();
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    names.add(line);
  }
  return names;
}

type Classification = "safe" | "unsafe" | "skipped-unsafe-name";

interface SplitEntry {
  readonly file: string;
  readonly classification: Classification;
  readonly moved: boolean;
}

interface SplitResult {
  readonly entries: readonly SplitEntry[];
  readonly movedToSafe: number;
  readonly movedToUnsafe: number;
  readonly skipped: number;
}

// Classify every ROM-extension file in romDir against the allowlist. When
// apply is true, move each file into safeDir / unsafeDir. Returns a structured
// report; never calls process.exit (callers decide exit codes), so the
// function stays unit-testable like the sibling matchAndReport.
export function splitRoms(
  romDir: string,
  safeDir: string,
  unsafeDir: string,
  allowed: ReadonlySet<string>,
  apply: boolean,
): SplitResult {
  if (apply) {
    if (!existsSync(safeDir)) mkdirSync(safeDir, { recursive: true });
    if (!existsSync(unsafeDir)) mkdirSync(unsafeDir, { recursive: true });
  }

  const entries: SplitEntry[] = [];
  let movedToSafe = 0;
  let movedToUnsafe = 0;
  let skipped = 0;

  for (const dirent of readdirSync(romDir, { withFileTypes: true })) {
    if (!dirent.isFile()) continue;
    const file = dirent.name;
    if (!ROM_EXTENSIONS.has(extname(file).toLowerCase())) continue;

    if (!isSafeFilename(file)) {
      process.stderr.write(`skip: unsafe filename, cannot place safely: ${file}\n`);
      skipped++;
      entries.push({ file, classification: "skipped-unsafe-name", moved: false });
      continue;
    }

    const isSafe = allowed.has(file);
    const destDir = isSafe ? safeDir : unsafeDir;
    let moved = false;

    if (apply) {
      try {
        renameSync(join(romDir, file), join(destDir, file));
        moved = true;
        if (isSafe) movedToSafe++;
        else movedToUnsafe++;
      } catch (error) {
        process.stderr.write(`failed to move ${file}: ${String(error)}\n`);
      }
    }

    entries.push({ file, classification: isSafe ? "safe" : "unsafe", moved });
  }

  return { entries, movedToSafe, movedToUnsafe, skipped };
}

// --- CLI ---

interface Args {
  readonly romDir: string;
  readonly safeDir: string;
  readonly unsafeDir: string;
  readonly allowlist: string;
  readonly apply: boolean;
}

class ArgError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseArgs(argv: readonly string[]): Args {
  let romDir: string | undefined;
  let safeDir: string | undefined;
  let unsafeDir: string | undefined;
  let allowlist: string | undefined;
  let apply = false;

  function readOptionValue(index: number, flag: string): string {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new ArgError(`missing value for ${flag}`, 64);
    }
    return value;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--rom-dir") {
      romDir = readOptionValue(i, arg);
      i++;
    } else if (arg === "--safe-dir") {
      safeDir = readOptionValue(i, arg);
      i++;
    } else if (arg === "--unsafe-dir") {
      unsafeDir = readOptionValue(i, arg);
      i++;
    } else if (arg === "--allowlist") {
      allowlist = readOptionValue(i, arg);
      i++;
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: split-by-license.ts --rom-dir <dir> --safe-dir <dir> --unsafe-dir <dir> --allowlist <path> [--apply]\n\n" +
          "  --rom-dir     Directory containing ROM files to classify.\n" +
          "  --safe-dir    Destination for allowlisted (safe) ROMs.\n" +
          "  --unsafe-dir  Destination for non-allowlisted ROMs.\n" +
          "  --allowlist   Manifest of safe ROM filenames (one per line, # comments).\n" +
          "  --apply       Actually move files (default: dry-run report).\n",
      );
      throw new ArgError("", 0);
    } else {
      throw new ArgError(`unknown arg: ${arg}`, 64);
    }
  }

  if (!romDir) throw new ArgError("--rom-dir is required", 64);
  if (!safeDir) throw new ArgError("--safe-dir is required", 64);
  if (!unsafeDir) throw new ArgError("--unsafe-dir is required", 64);
  if (!allowlist) throw new ArgError("--allowlist is required", 64);

  return { romDir, safeDir, unsafeDir, allowlist, apply };
}

export function main(argv: readonly string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (e instanceof ArgError) {
      if (e.message) process.stderr.write(`${e.message}\n`);
      return e.exitCode;
    }
    throw e;
  }

  if (!existsSync(args.romDir)) {
    process.stderr.write(`rom directory not found: ${args.romDir}\n`);
    return 1;
  }
  if (!existsSync(args.allowlist)) {
    process.stderr.write(`allowlist not found: ${args.allowlist}\n`);
    return 1;
  }

  const allowed = parseAllowlist(readFileSync(args.allowlist, "utf8"));
  process.stderr.write(`allowlist: ${allowed.size} safe ROM names loaded\n`);

  const result = splitRoms(args.romDir, args.safeDir, args.unsafeDir, allowed, args.apply);

  process.stdout.write(JSON.stringify(result.entries, null, 2) + "\n");

  if (args.apply) {
    process.stderr.write(
      `\nsummary: moved ${result.movedToSafe} to safe, ` +
        `${result.movedToUnsafe} to unsafe, ${result.skipped} skipped\n`,
    );
  } else {
    const safe = result.entries.filter((e) => e.classification === "safe").length;
    const unsafe = result.entries.filter((e) => e.classification === "unsafe").length;
    process.stderr.write(
      `\ndry-run: ${safe} would move to safe, ${unsafe} would move to unsafe, ` +
        `${result.skipped} skipped (rerun with --apply to move)\n`,
    );
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
