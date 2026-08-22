// pinned-artifact.ts — fetch-and-verify an EXTERNAL BINARY artifact against a pinned digest.
//
// WHAT THIS REPLACES. CI lanes installed Ollama with
//     curl -fsSL https://ollama.com/install.sh | sh
// on a 15-minute cron, in a job holding contents:write — a remote script handed straight to a
// shell, executing with the runner's token in the environment, with nothing in the repo able
// to tell us it had changed. §13 noninterference: influence through an undeclared, unmetered
// channel. This module is the metered channel: ONE named artifact, ONE digest, and a refusal
// if they disagree.
//
// WHY IT LIVES UNDER ace/ AND NOT IN A SHELL SCRIPT.
//   * A content-addressed install IS a hash-pinned install. `PinEntry` below is deliberately
//     ace's `PackageEntry` (ace-cli.ts) plus the artifact locator ace has no field for yet, so
//     this is the shape ace's `verify` would call once its download path exists — reusable,
//     rather than trapped in YAML. ace cannot do it today: ace-cli.ts `install()` is a pure
//     Z-set delta over a hardcoded stub registry, and ace.ts's real fetch path reads `.text()`
//     (JSON manifests), so it has no binary-artifact path at all.
//   * The repo is retiring bash, and the retained-shell allowlist exists for scripts that run
//     BEFORE bun is available. This one does not: the heartbeat runs `bun install` before it.
//     Registering new shell here would have been the locally-easy, strategically-wrong move.
//   * A shell one-liner in a workflow cannot be unit-tested. This can, and is — including the
//     refusal, which is the only half that matters (see pinned-artifact.test.ts).
//
// EFFECTS ARE INJECTED (discipline #7, noninterference). The network, the clock-free process
// spawner, the filesystem and the host identity all arrive through `InstallEffects`. That is
// what lets the tests drive the real decision logic with fakes and prove a wrong digest is
// rejected, rather than asserting on a mock that was never wired to anything.

import { createHash } from "node:crypto";

/** ace `PackageEntry`, verbatim in shape. The pin file's `entry` block. */
export interface PinEntry {
  readonly name: string;
  readonly version: string;
  /** `sha256:<64 hex>` — ace calls this the contentAddress; here it is the artifact digest. */
  readonly contentAddress: string;
  readonly weight: number;
  readonly packageManager: string;
  readonly lastUpdated: string;
}

/** The locator ace has no field for yet. The pin file's `artifact` block. */
export interface PinArtifact {
  readonly tag: string;
  readonly asset: string;
  readonly url: string;
  /** `<os>/<arch>`, e.g. `linux/x86_64`. Compared against the host; a mismatch REFUSES. */
  readonly platform: string;
  readonly sizeBytes: number;
  readonly installsInto: string;
  /** Post-install proof that the binary now on PATH is the one we pinned. */
  readonly verify: { readonly binary: string; readonly versionArgs: readonly string[] };
}

export interface Pin {
  readonly entry: PinEntry;
  readonly artifact: PinArtifact;
}

export type ParsedPin = { ok: true; pin: Pin } | { ok: false; reason: string };

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Parse an untrusted pin document. Every field this module depends on is checked here, so a
 * malformed pin is a REFUSAL with a reason rather than an undefined flowing into a fetch.
 */
export function parsePin(raw: unknown): ParsedPin {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "pin is not an object" };
  const doc = raw as Record<string, unknown>;
  const entry = doc["entry"] as Record<string, unknown> | undefined;
  const artifact = doc["artifact"] as Record<string, unknown> | undefined;
  if (typeof entry !== "object" || entry === null) return { ok: false, reason: "pin.entry missing" };
  if (typeof artifact !== "object" || artifact === null) return { ok: false, reason: "pin.artifact missing" };

  const str = (o: Record<string, unknown>, k: string): string | null =>
    typeof o[k] === "string" && (o[k] as string).length > 0 ? (o[k] as string) : null;

  const name = str(entry, "name");
  const version = str(entry, "version");
  const contentAddress = str(entry, "contentAddress");
  if (name === null) return { ok: false, reason: "pin.entry.name missing" };
  if (version === null) return { ok: false, reason: "pin.entry.version missing" };
  if (contentAddress === null) return { ok: false, reason: "pin.entry.contentAddress missing" };
  if (!contentAddress.startsWith("sha256:"))
    return { ok: false, reason: `pin.entry.contentAddress is not sha256: ${contentAddress}` };
  // A short or non-hex digest would "verify" nothing while looking like a check.
  if (!SHA256_HEX.test(contentAddress.slice("sha256:".length)))
    return { ok: false, reason: `pin.entry.contentAddress is not 64 hex chars: ${contentAddress}` };

  const tag = str(artifact, "tag");
  const asset = str(artifact, "asset");
  const url = str(artifact, "url");
  const platform = str(artifact, "platform");
  const installsInto = str(artifact, "installsInto");
  if (tag === null) return { ok: false, reason: "pin.artifact.tag missing" };
  if (asset === null) return { ok: false, reason: "pin.artifact.asset missing" };
  if (url === null) return { ok: false, reason: "pin.artifact.url missing" };
  if (platform === null) return { ok: false, reason: "pin.artifact.platform missing" };
  if (installsInto === null) return { ok: false, reason: "pin.artifact.installsInto missing" };
  if (!url.startsWith("https://")) return { ok: false, reason: `pin.artifact.url is not https: ${url}` };

  const verify = artifact["verify"] as Record<string, unknown> | undefined;
  if (typeof verify !== "object" || verify === null) return { ok: false, reason: "pin.artifact.verify missing" };
  const binary = str(verify, "binary");
  if (binary === null) return { ok: false, reason: "pin.artifact.verify.binary missing" };
  const versionArgs = verify["versionArgs"];
  if (!Array.isArray(versionArgs) || !versionArgs.every((a) => typeof a === "string"))
    return { ok: false, reason: "pin.artifact.verify.versionArgs must be a string array" };

  return {
    ok: true,
    pin: {
      entry: {
        name,
        version,
        contentAddress,
        weight: typeof entry["weight"] === "number" ? (entry["weight"] as number) : 0,
        packageManager: str(entry, "packageManager") ?? "ace",
        lastUpdated: str(entry, "lastUpdated") ?? "",
      },
      artifact: {
        tag,
        asset,
        url,
        platform,
        sizeBytes: typeof artifact["sizeBytes"] === "number" ? (artifact["sizeBytes"] as number) : 0,
        installsInto,
        verify: { binary, versionArgs: versionArgs as readonly string[] },
      },
    },
  };
}

/** SHA-256 of the bytes, lowercase hex. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The comparison the whole change exists for. Kept separate and total so a test can prove it
 * REJECTS — a verifier only ever exercised on matching input cannot distinguish "the check
 * passed" from "the check is not wired up".
 */
export function digestMatches(contentAddress: string, bytes: Uint8Array): boolean {
  return contentAddress === `sha256:${sha256Hex(bytes)}`;
}

/** Injected doors. Nothing in this module reaches the network, the FS or a process directly. */
export interface InstallEffects {
  /** `<os>/<arch>` of the machine we are on, compared against `artifact.platform`. */
  readonly hostPlatform: () => string;
  readonly fetchBytes: (url: string) => Promise<Uint8Array>;
  /** Persist the archive so the extractor can read it; returns the path. */
  readonly writeTemp: (fileName: string, bytes: Uint8Array) => Promise<string>;
  /** Unpack `archivePath` into `destDir`. Implementations may need elevation. */
  readonly extract: (archivePath: string, destDir: string) => Promise<{ ok: boolean; message: string }>;
  /** Absolute path of `binary` on PATH, or null. */
  readonly which: (binary: string) => Promise<string | null>;
  /** Run `binary` with `args`; combined stdout+stderr. */
  readonly run: (binary: string, args: readonly string[]) => Promise<{ ok: boolean; output: string }>;
  readonly log: (line: string) => void;
}

export type InstallFailure =
  | "bad-pin"
  | "platform-mismatch"
  | "download-failed"
  | "digest-mismatch"
  | "extract-failed"
  | "not-on-path"
  | "version-mismatch";

export type InstallOutcome =
  | { ok: true; name: string; version: string; installedInto: string }
  | { ok: false; reason: InstallFailure; message: string };

/**
 * Fetch → verify → extract → prove. Returns an outcome; it never throws for an expected
 * failure and NEVER falls back to an unverified path. A recovery path that cannot fail is not
 * a check, which is the defect class this replaced.
 *
 * The CALLER decides whether a failure is fatal. On the heartbeat lane it is not: the step is
 * continue-on-error, so a broken pin degrades that tick to model-less rather than stopping the
 * society (tick-must-never-stop).
 */
export async function installPinnedArtifact(rawPin: unknown, fx: InstallEffects): Promise<InstallOutcome> {
  const parsed = parsePin(rawPin);
  if (!parsed.ok) return { ok: false, reason: "bad-pin", message: parsed.reason };
  const { entry, artifact } = parsed.pin;

  const host = fx.hostPlatform();
  if (host !== artifact.platform) {
    // LOUD refusal, never "install whatever fits this machine". A pin that quietly does not
    // apply to the host it ran on is a check that cannot fail wearing a success story.
    return {
      ok: false,
      reason: "platform-mismatch",
      message: `pin targets ${artifact.platform}; this host is ${host}. Add a pin for it rather than falling back.`,
    };
  }

  fx.log(`[pin] ${entry.name} ${entry.version} — ${artifact.asset}`);
  fx.log(`[pin] expected ${entry.contentAddress}`);
  fx.log(`[pin] fetching ${artifact.url}`);

  let bytes: Uint8Array;
  try {
    bytes = await fx.fetchBytes(artifact.url);
  } catch (e) {
    return { ok: false, reason: "download-failed", message: `${artifact.url}: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!digestMatches(entry.contentAddress, bytes)) {
    return {
      ok: false,
      reason: "digest-mismatch",
      message:
        `SHA-256 MISMATCH for ${artifact.asset}: expected ${entry.contentAddress}, ` +
        `got sha256:${sha256Hex(bytes)} (${bytes.length} bytes). The bytes under the tag changed, ` +
        `or they were altered in transit. NOTHING was installed.`,
    };
  }
  fx.log(`[pin] sha256 OK (${bytes.length} bytes)`);

  const archivePath = await fx.writeTemp(artifact.asset, bytes);
  const extracted = await fx.extract(archivePath, artifact.installsInto);
  if (!extracted.ok) return { ok: false, reason: "extract-failed", message: extracted.message };

  const found = await fx.which(artifact.verify.binary);
  if (found === null) {
    return {
      ok: false,
      reason: "not-on-path",
      message: `extracted, but '${artifact.verify.binary}' is not on PATH (expected under ${artifact.installsInto})`,
    };
  }

  // Without this the digest check proves only that a correct archive was downloaded — not that
  // the thing now on PATH came out of it. An older build already installed would shadow ours
  // and the step would still report success.
  const probe = await fx.run(artifact.verify.binary, artifact.verify.versionArgs);
  const flat = probe.output.replace(/\s+/g, " ").trim();
  if (!flat.includes(entry.version)) {
    return {
      ok: false,
      reason: "version-mismatch",
      message: `PATH ${artifact.verify.binary} reports '${flat}' but the pin is ${entry.version} — something is shadowing ${artifact.installsInto}`,
    };
  }

  fx.log(`[pin] installed: ${flat}`);
  return { ok: true, name: entry.name, version: entry.version, installedInto: artifact.installsInto };
}
