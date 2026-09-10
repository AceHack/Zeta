#!/usr/bin/env bun
// refresh-rustup-pin.ts — rewrite tools/setup/rustup-pin.json for a chosen rustup version.
//
//   bun src/Core.TypeScript/ace/refresh-rustup-pin.ts                 # whatever release-stable.toml names
//   bun src/Core.TypeScript/ace/refresh-rustup-pin.ts --version 1.29.1
//   bun src/Core.TypeScript/ace/refresh-rustup-pin.ts --check         # write nothing; refuse on drift
//
// WHY IT EXISTS. The cheapest way to make a red tree green is to paste a new digest into the
// pin by hand. That one-line diff reads as housekeeping and is actually "I trust bytes nobody
// measured" — the same failure `from-url-rolling-receipts` was built to make visible. This
// tool is the sanctioned path, and `--check` is the falsifier that catches a hand-edit whose
// digest does not match what upstream actually serves.
//
// THE HONEST LIMIT ON PROVENANCE, and it is weaker than refresh-ollama-pin.ts's.
// That refresher cross-checks TWO independent sources (upstream's sha256sum.txt and GitHub's
// API-computed asset digest) and refuses when they disagree. rustup has one distribution
// channel: static.rust-lang.org serves both `rustup-init` and its `.sha256` sidecar, from the
// same origin. Agreeing with the sidecar therefore detects a CORRUPTED TRANSFER and would not
// detect a COMPROMISED ORIGIN, and rust-lang/rustup's GitHub releases carry no rustup-init
// assets to cross-check against (measured 2026-09-10: the API has no release for tag 1.29.1).
// So this records what it did rather than claiming independence it does not have — see
// `sidecarIsNotAnIndependentSource` below, which exists to keep that admission in the code.
//
// WHAT THIS DOES NOT DO: prove the pin works. That is a real runner's job —
// .github/workflows/verify-rustup-pin.yml, which runs on any PR touching the pin.
//
// `_doc`, `_platformCoverage` and `_notPinnedHere` in the pin file are preserved verbatim;
// only `entry.version`, `entry.lastUpdated` and the `artifacts` rows are rewritten.

import { createHash } from "node:crypto";

const STABLE_TOML = "https://static.rust-lang.org/rustup/release-stable.toml";
const ARCHIVE = "https://static.rust-lang.org/rustup/archive";
const PIN_PATH = "tools/setup/rustup-pin.json";

/**
 * The platforms the pin declares, and the rustup target triple each maps to. Host strings are
 * exactly `pinned-artifact.ts`'s `hostPlatform()` spelling (`process.platform`/`process.arch`
 * with x64 normalised), because a pin whose platform string never equals the host's is a row
 * that can only ever produce `platform-mismatch`.
 */
export const RUSTUP_PLATFORMS: readonly { readonly platform: string; readonly triple: string }[] = [
  { platform: "linux/x86_64", triple: "x86_64-unknown-linux-gnu" },
  { platform: "linux/arm64", triple: "aarch64-unknown-linux-gnu" },
  { platform: "darwin/x86_64", triple: "x86_64-apple-darwin" },
  { platform: "darwin/arm64", triple: "aarch64-apple-darwin" },
];

/**
 * Stated in code, not only in prose, so that a future author reaching for "add a second source"
 * finds the reason this one has none. Returning `true` is not a defect being tolerated; it is a
 * property of rustup's distribution that the pin's `_doc` records honestly.
 */
export function sidecarIsNotAnIndependentSource(): boolean {
  return true;
}

/** `1.29.1` and nothing looser. A version string is going straight into a URL path. */
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export interface Args {
  readonly version: string | null;
  readonly check: boolean;
  readonly help: boolean;
  readonly error?: string;
}

export function parseArgs(argv: readonly string[]): Args {
  let version: string | null = null;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") return { version: null, check: false, help: true };
    if (a === "--check") {
      check = true;
      continue;
    }
    if (a === "--version") {
      const v = argv[++i];
      if (v === undefined) return { version: null, check: false, help: false, error: "--version needs a value" };
      if (!VERSION_RE.test(v))
        return { version: null, check: false, help: false, error: `--version must be MAJOR.MINOR.PATCH, got ${v}` };
      version = v;
      continue;
    }
    return { version: null, check: false, help: false, error: `unknown arg: ${String(a)}` };
  }
  return { version, check, help: false };
}

/** `version = '1.29.1'` out of release-stable.toml. A parse failure is a refusal, not a guess. */
export function parseStableVersion(toml: string): string | null {
  const m = /^\s*version\s*=\s*['"]([^'"]+)['"]/m.exec(toml);
  const value = m?.[1];
  if (value === undefined || !VERSION_RE.test(value)) return null;
  return value;
}

/** `<64 hex> *./rustup-init` — the shape rust-lang's `.sha256` sidecars take. */
export function parseSidecarDigest(text: string): string | null {
  const first = text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(first) ? first : null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${String(res.status)}`);
  return await res.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${String(res.status)}`);
  return new Uint8Array(await res.arrayBuffer());
}

interface Measured {
  readonly platform: string;
  readonly triple: string;
  readonly url: string;
  readonly sizeBytes: number;
  readonly digest: string;
}

/**
 * Fetch the artifact AND its sidecar, and refuse unless they agree.
 *
 * Hashing only what we downloaded would be a check that cannot fail — it certifies whatever
 * we happened to be served, which is the thing in question. The sidecar is a second STATEMENT
 * even though it is not a second ORIGIN, so a byte mangled in transit is caught here; that is
 * the whole of what this comparison is claimed to buy.
 */
async function measure(version: string, platform: string, triple: string): Promise<Measured> {
  const url = `${ARCHIVE}/${version}/${triple}/rustup-init`;
  const [bytes, sidecarText] = await Promise.all([fetchBytes(url), fetchText(`${url}.sha256`)]);
  const computed = createHash("sha256").update(bytes).digest("hex");
  const sidecar = parseSidecarDigest(sidecarText);
  if (sidecar === null) throw new Error(`${url}.sha256 is not a sha256 line; refusing to pin blind`);
  if (sidecar !== computed)
    throw new Error(
      `DIGEST DISAGREEMENT for ${triple}:\n  sidecar  : ${sidecar}\n  fetched  : ${computed}\n` +
        "The bytes served do not match the digest published beside them. Do NOT pin. Investigate.",
    );
  return { platform, triple, url, sizeBytes: bytes.length, digest: computed };
}

function artifactRow(m: Measured, version: string): Record<string, unknown> {
  return {
    tag: version,
    asset: "rustup-init",
    url: m.url,
    platform: m.platform,
    sizeBytes: m.sizeBytes,
    contentAddress: `sha256:${m.digest}`,
    kind: "run-installer",
    runArgs: ["-y", "--no-modify-path"],
    installsInto: "~/.cargo",
    verify: { binary: "~/.cargo/bin/rustup", versionArgs: ["--version"] },
  };
}

function usage(): string {
  return [
    "usage: refresh-rustup-pin.ts [--version MAJOR.MINOR.PATCH] [--check]",
    "",
    "  --version  the rustup release to pin (default: whatever release-stable.toml names)",
    "  --check    measure and compare against the committed pin; write nothing, exit 1 on drift",
  ].join("\n");
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if (args.error !== undefined) {
    process.stderr.write(`error: ${args.error}\n\n${usage()}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  let pin: Record<string, unknown>;
  try {
    pin = (await Bun.file(PIN_PATH).json()) as Record<string, unknown>;
  } catch (e) {
    process.stderr.write(`error: cannot read ${PIN_PATH}: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }

  const entry = pin["entry"] as Record<string, unknown>;
  let version = args.version;
  if (version === null) {
    // `--check` must judge the pin AS COMMITTED. Resolving "stable" here would silently turn a
    // check of this pin into a check of a different, newer one, and report drift that is really
    // an upstream release nobody asked to adopt.
    if (args.check) {
      version = typeof entry["version"] === "string" ? (entry["version"] as string) : "";
      if (!VERSION_RE.test(version)) {
        process.stderr.write(`error: committed pin has no usable entry.version (${version})\n`);
        return 2;
      }
    } else {
      try {
        const parsed = parseStableVersion(await fetchText(STABLE_TOML));
        if (parsed === null) throw new Error("release-stable.toml has no parsable version");
        version = parsed;
      } catch (e) {
        process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
        return 2;
      }
    }
  }

  process.stdout.write(
    `[rustup-pin] measuring rustup ${version} across ${String(RUSTUP_PLATFORMS.length)} platforms\n`,
  );
  const measured: Measured[] = [];
  for (const { platform, triple } of RUSTUP_PLATFORMS) {
    try {
      const m = await measure(version, platform, triple);
      process.stdout.write(`  ${platform.padEnd(14)} ${m.digest} (${String(m.sizeBytes)} bytes)\n`);
      measured.push(m);
    } catch (e) {
      process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
      return 1;
    }
  }

  const artifacts = measured.map((m) => artifactRow(m, version));

  if (args.check) {
    const committed = JSON.stringify(pin["artifacts"]);
    const fresh = JSON.stringify(artifacts);
    const versionMatches = entry["version"] === version;
    if (committed === fresh && versionMatches) {
      process.stdout.write(`OK: ${PIN_PATH} matches what static.rust-lang.org serves for ${version}\n`);
      return 0;
    }
    process.stderr.write(
      `DRIFT: ${PIN_PATH} does not match the measured artifacts for ${version}.\n` +
        "Run without --check to rewrite it, and do not hand-edit a digest.\n",
    );
    return 1;
  }

  pin["entry"] = { ...entry, version, lastUpdated: new Date().toISOString().replace(/\.\d+Z$/, "Z") };
  pin["artifacts"] = artifacts;
  await Bun.write(PIN_PATH, `${JSON.stringify(pin, null, 2)}\n`);
  process.stdout.write(`wrote ${PIN_PATH} for rustup ${version}\n`);
  process.stdout.write("Open a PR: verify-rustup-pin.yml proves it on a real runner before merge.\n");
  return 0;
}

// Guarded with `if`, never `||`: a module-level short-circuit would call process.exit on
// IMPORT, which is how a runner elsewhere in this repo silently reported "0 tests, exit 0".
if (import.meta.main) {
  process.exit(await main());
}
