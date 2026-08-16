#!/usr/bin/env bun
// fetch-datfile.ts -- the datfile-as-dependency half of 081KQ8P5D0008QG0R001590WJ3 (tracked as
// 081KSRGFP0008QG0R003ZH6DN3). Reads a pinned datfile manifest (src/Core.TypeScript/roms/manifests/datfiles.json),
// downloads the pinned datfile, verifies its SHA-256 against the pin, and writes
// it to a gitignored cache so src/Core.TypeScript/roms/canonicalize.ts can consume it via
// --datfile. This closes the 081KQ8P5D0008QG0R001590WJ3 "Tooling refreshes on TOSEC datfile updates"
// + "Datfile-as-dependency (pin version + download + verify via SHA256)"
// acceptance criteria that siblings 081KR2E4K0008QG0R001QZDAMQ/081KR2E4K0008QG0R001JC6S3N did not cover.
//
// Usage:
//   bun src/Core.TypeScript/roms/fetch-datfile.ts --list
//   bun src/Core.TypeScript/roms/fetch-datfile.ts --platform atari-2600
//   bun src/Core.TypeScript/roms/fetch-datfile.ts --platform atari-2600 --out roms/.datfiles
//
// Fails CLOSED on any <...> placeholder pin (per dep-pin-search-first-authority):
// an unverified downloadUrl/sha256 is refused, never written. The operator fills
// the verified values on the first network-enabled fetch.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// --- Manifest model ---

export interface DatfilePin {
  readonly platform: string;
  readonly source: string;
  readonly release: string;
  readonly datfileName: string;
  readonly sourceUrl: string;
  readonly downloadUrl: string;
  readonly sha256: string;
  /**
   * Canonical roms/ subdirectory for this platform (e.g. "atari/2600").
   * Stated explicitly in the manifest rather than inferred from the slug:
   * slug→path inference (replacing hyphens) is only correct for two-segment
   * slugs like "atari-2600" and breaks for slugs like
   * "nintendo-entertainment-system".
   */
  readonly romsDir: string;
}

interface RawManifest {
  readonly datfiles?: readonly Partial<DatfilePin>[];
}

const REQUIRED_FIELDS: readonly (keyof DatfilePin)[] = [
  "platform",
  "source",
  "release",
  "datfileName",
  "sourceUrl",
  "downloadUrl",
  "sha256",
  "romsDir",
];

/**
 * Parse the datfiles manifest JSON into a platform-keyed map of pins.
 * Throws on malformed JSON or entries missing required fields. Pure (no IO).
 */
export function parseManifest(json: string): ReadonlyMap<string, DatfilePin> {
  let raw: RawManifest;
  try {
    raw = JSON.parse(json) as RawManifest;
  } catch (e) {
    throw new Error(`manifest is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(raw.datfiles)) {
    throw new Error('manifest missing "datfiles" array');
  }

  const pins = new Map<string, DatfilePin>();
  for (const entry of raw.datfiles) {
    for (const field of REQUIRED_FIELDS) {
      if (typeof entry[field] !== "string" || entry[field] === "") {
        throw new Error(
          `manifest entry missing required string field "${field}": ` +
            JSON.stringify(entry),
        );
      }
    }
    const pin = entry as DatfilePin;
    if (pins.has(pin.platform)) {
      throw new Error(`duplicate platform in manifest: ${pin.platform}`);
    }
    pins.set(pin.platform, pin);
  }
  return pins;
}

/**
 * A pin value is a placeholder if it is wrapped in angle brackets, e.g.
 * "<SHA256-VERIFY-ON-FETCH>". Placeholder values are unverified per
 * dep-pin-search-first-authority and MUST NOT be acted on. Pure.
 */
export function isPlaceholder(value: string): boolean {
  return value.startsWith("<") && value.endsWith(">");
}

/** Compute the lowercase hex SHA-256 of bytes. Pure. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Verify bytes against an expected lowercase-hex SHA-256. Case-insensitive on
 * the expected value. Pure.
 */
export function verifyChecksum(
  bytes: Uint8Array,
  expectedSha256: string,
): boolean {
  return sha256Hex(bytes) === expectedSha256.toLowerCase();
}

/**
 * Reasons a pin cannot be fetched. null => the pin is fetchable.
 * Pure: surfaces the fail-closed decision without performing IO.
 */
export function fetchBlockReason(pin: DatfilePin): string | null {
  if (isPlaceholder(pin.downloadUrl)) {
    return (
      `downloadUrl for "${pin.platform}" is an unverified placeholder ` +
      `(${pin.downloadUrl}). Per dep-pin-search-first-authority, download the ` +
      `datpack from ${pin.sourceUrl}, locate "${pin.datfileName}", and record ` +
      `its direct URL + sha256 in src/Core.TypeScript/roms/manifests/datfiles.json before fetching.`
    );
  }
  if (isPlaceholder(pin.sha256)) {
    return (
      `sha256 for "${pin.platform}" is an unverified placeholder (${pin.sha256}). ` +
      `Record the sha256sum of "${pin.datfileName}" in the manifest before fetching.`
    );
  }
  return null;
}

// --- IO boundary ---

export const DEFAULT_MANIFEST = join(import.meta.dir, "manifests/datfiles.json");
export const DEFAULT_OUT_DIR = "roms/.datfiles";

export function loadManifest(path: string): ReadonlyMap<string, DatfilePin> {
  return parseManifest(readFileSync(path, "utf8"));
}

// --- CLI ---

interface Args {
  readonly manifest: string;
  readonly outDir: string;
  readonly platform: string | null;
  readonly list: boolean;
}

class ArgError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseArgs(argv: readonly string[]): Args {
  let manifest = DEFAULT_MANIFEST;
  let outDir = DEFAULT_OUT_DIR;
  let platform: string | null = null;
  let list = false;

  function readValue(index: number, flag: string): string {
    const value = argv[index + 1];
    if (value === undefined) throw new ArgError(`missing value for ${flag}`, 64);
    return value;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--platform" || arg === "-p") {
      platform = readValue(i, arg);
      i++;
    } else if (arg === "--manifest" || arg === "-m") {
      manifest = readValue(i, arg);
      i++;
    } else if (arg === "--out" || arg === "-o") {
      outDir = readValue(i, arg);
      i++;
    } else if (arg === "--list" || arg === "-l") {
      list = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: fetch-datfile.ts [--platform <slug>] [--manifest <path>] [--out <dir>] [--list]\n\n" +
          "  --platform, -p  Platform slug to fetch (e.g. atari-2600).\n" +
          "  --manifest, -m  Manifest path (default: src/Core.TypeScript/roms/manifests/datfiles.json).\n" +
          "  --out, -o       Output dir for the verified datfile (default: roms/.datfiles).\n" +
          "  --list, -l      List pinned platforms and their verification status.\n",
      );
      throw new ArgError("", 0);
    } else {
      throw new ArgError(`unknown arg: ${arg}`, 64);
    }
  }

  if (!list && platform === null) {
    throw new ArgError("either --platform <slug> or --list is required", 64);
  }
  return { manifest, outDir, platform, list };
}

export async function main(argv: readonly string[]): Promise<number> {
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

  if (!existsSync(args.manifest)) {
    process.stderr.write(`manifest not found: ${args.manifest}\n`);
    return 1;
  }

  let pins: ReadonlyMap<string, DatfilePin>;
  try {
    pins = loadManifest(args.manifest);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 1;
  }

  if (args.list) {
    for (const pin of pins.values()) {
      const status = fetchBlockReason(pin) === null ? "verified" : "PINNED-UNVERIFIED";
      process.stdout.write(
        `${pin.platform}\t${pin.source} ${pin.release}\t${status}\n`,
      );
    }
    return 0;
  }

  const pin = pins.get(args.platform!);
  if (!pin) {
    process.stderr.write(
      `no pin for platform "${args.platform}" in ${args.manifest}\n`,
    );
    return 1;
  }

  const block = fetchBlockReason(pin);
  if (block !== null) {
    process.stderr.write(`refusing to fetch (fail-closed): ${block}\n`);
    return 2;
  }

  process.stderr.write(
    `fetching ${pin.datfileName} (${pin.source} ${pin.release}) from ${pin.downloadUrl}\n`,
  );
  const response = await fetch(pin.downloadUrl);
  if (!response.ok) {
    process.stderr.write(
      `download failed: HTTP ${response.status} ${response.statusText}\n`,
    );
    return 1;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!verifyChecksum(bytes, pin.sha256)) {
    process.stderr.write(
      `checksum MISMATCH for ${pin.datfileName}: ` +
        `expected ${pin.sha256.toLowerCase()}, got ${sha256Hex(bytes)}. ` +
        `Not writing (the pin or the upstream file changed).\n`,
    );
    return 1;
  }

  if (!existsSync(args.outDir)) mkdirSync(args.outDir, { recursive: true });
  const outPath = join(args.outDir, pin.datfileName);
  writeFileSync(outPath, bytes);
  process.stdout.write(outPath + "\n");
  process.stderr.write(
    `verified + wrote ${bytes.length} bytes to ${outPath}\n` +
      `next: bun src/Core.TypeScript/roms/canonicalize.ts --datfile "${outPath}" --dir roms/${pin.romsDir}\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
