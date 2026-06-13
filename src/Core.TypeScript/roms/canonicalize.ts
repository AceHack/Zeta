#!/usr/bin/env bun
// canonicalize.ts -- hash ROM files and match against a TOSEC / No-Intro
// datfile (Logiqx XML format). Smallest safe slice of B-0272.
//
// Usage:
//   bun tools/roms/canonicalize.ts --datfile <path.dat> --dir <rom-dir>
//   bun tools/roms/canonicalize.ts --datfile <path.dat> --dir <rom-dir> --apply
//
// Output (default dry-run): JSON array of
// { file, sha1, matched, canonicalName, renamed }.
// --apply: renames matched files to their canonical names.

import { createHash } from "node:crypto";
import {
  closeSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  existsSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";

// --- Datfile parsing (Logiqx XML) ---

interface DatEntry {
  readonly name: string;
  readonly size: number;
  readonly sha1: string;
  readonly md5: string;
  readonly crc: string;
}

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

function decodeXmlAttributeValue(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g,
    (_match, entity: string) => {
      switch (entity) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default:
          if (entity.startsWith("#x")) {
            return String.fromCodePoint(parseInt(entity.slice(2), 16));
          }
          if (entity.startsWith("#")) {
            return String.fromCodePoint(parseInt(entity.slice(1), 10));
          }
          return `&${entity};`;
      }
    },
  );
}

function isSafeCanonicalName(name: string): boolean {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("\0") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

export function parseDatfile(xml: string): ReadonlyMap<string, DatEntry> {
  const lookup = new Map<string, DatEntry>();
  const romTagRe = /<rom\s+([^>]*?)\/?\s*>/g;
  const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = romTagRe.exec(xml)) !== null) {
    const attrStr = tagMatch[1] ?? "";
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(attrStr)) !== null) {
      const key = attrMatch[1];
      const val = attrMatch[2] ?? attrMatch[3];
      if (key !== undefined && val !== undefined) {
        attrs[key] = decodeXmlAttributeValue(val);
      }
    }
    attrRe.lastIndex = 0;

    const sha1 = attrs["sha1"]?.toLowerCase();
    const name = attrs["name"];
    if (sha1 && name) {
      lookup.set(sha1, {
        name,
        size: parseInt(attrs["size"] ?? "0", 10),
        sha1,
        md5: (attrs["md5"] ?? "").toLowerCase(),
        crc: (attrs["crc"] ?? "").toLowerCase(),
      });
    }
  }
  return lookup;
}

// --- File hashing ---

export function hashFileSha1(path: string): string {
  const hash = createHash("sha1");
  const fd = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

// --- Directory scanning ---

export function scanRomFiles(dir: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (ROM_EXTENSIONS.has(ext)) {
      files.push(join(dir, entry.name));
    }
  }
  return files.sort();
}

// --- Match + rename ---

interface MatchResult {
  readonly file: string;
  readonly sha1: string;
  readonly matched: boolean;
  readonly canonicalName: string | null;
  readonly renamed: boolean;
}

export function matchAndReport(
  datLookup: ReadonlyMap<string, DatEntry>,
  romFiles: readonly string[],
  apply: boolean,
): readonly MatchResult[] {
  const results: MatchResult[] = [];
  const usedNames = new Set<string>();

  for (const filePath of romFiles) {
    const sha1 = hashFileSha1(filePath);
    const entry = datLookup.get(sha1);
    const currentName = basename(filePath);

    if (!entry) {
      results.push({
        file: filePath,
        sha1,
        matched: false,
        canonicalName: null,
        renamed: false,
      });
      continue;
    }

    const canonicalName = entry.name;
    const alreadyCorrect = currentName === canonicalName;
    let renamed = false;

    if (apply && !alreadyCorrect) {
      const dir = dirname(filePath);
      if (!isSafeCanonicalName(canonicalName)) {
        process.stderr.write(
          `skip: unsafe canonical name from datfile: ${canonicalName}\n`,
        );
        usedNames.add(canonicalName);
        results.push({
          file: filePath,
          sha1,
          matched: true,
          canonicalName,
          renamed: false,
        });
        continue;
      }
      const target = join(dir, canonicalName);
      if (existsSync(target) || usedNames.has(canonicalName)) {
        process.stderr.write(
          `skip: target already exists: ${target}\n`,
        );
      } else {
        renameSync(filePath, target);
        renamed = true;
      }
    }

    usedNames.add(canonicalName);
    results.push({
      file: filePath,
      sha1,
      matched: true,
      canonicalName,
      renamed,
    });
  }

  return results;
}

// --- CLI ---

interface Args {
  readonly datfile: string;
  readonly dir: string;
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
  let datfile: string | undefined;
  let dir: string | undefined;
  let apply = false;

  function readOptionValue(index: number, flag: string): string {
    const value = argv[index + 1];
    if (value === undefined) {
      throw new ArgError(`missing value for ${flag}`, 64);
    }
    return value;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--datfile" || arg === "-d") {
      datfile = readOptionValue(i, arg);
      i++;
    } else if (arg === "--dir") {
      dir = readOptionValue(i, arg);
      i++;
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: canonicalize.ts --datfile <path.dat> --dir <rom-dir> [--apply]\n\n" +
          "  --datfile, -d  Path to a TOSEC / No-Intro datfile (Logiqx XML).\n" +
          "  --dir          Directory containing ROM files to match.\n" +
          "  --apply        Actually rename files (default: dry-run report).\n",
      );
      throw new ArgError("", 0);
    } else {
      throw new ArgError(`unknown arg: ${arg}`, 64);
    }
  }

  if (!datfile) {
    throw new ArgError("--datfile is required", 64);
  }
  if (!dir) {
    throw new ArgError("--dir is required", 64);
  }
  return { datfile, dir, apply };
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

  if (!existsSync(args.datfile)) {
    process.stderr.write(`datfile not found: ${args.datfile}\n`);
    return 1;
  }
  if (!existsSync(args.dir)) {
    process.stderr.write(`directory not found: ${args.dir}\n`);
    return 1;
  }

  const datXml = readFileSync(args.datfile, "utf8");
  const lookup = parseDatfile(datXml);
  process.stderr.write(`datfile: ${lookup.size} entries loaded\n`);

  const romFiles = scanRomFiles(args.dir);
  process.stderr.write(`directory: ${romFiles.length} ROM files found\n`);

  if (romFiles.length === 0) {
    process.stdout.write("[]\n");
    return 0;
  }

  const results = matchAndReport(lookup, romFiles, args.apply);

  const matched = results.filter((r) => r.matched);
  const unmatched = results.filter((r) => !r.matched);
  const renamed = results.filter((r) => r.renamed);

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");

  process.stderr.write(
    `\nsummary: ${matched.length} matched, ` +
      `${unmatched.length} unmatched, ` +
      `${renamed.length} renamed\n`,
  );

  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
