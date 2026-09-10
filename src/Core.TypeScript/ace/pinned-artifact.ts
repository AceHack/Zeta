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
  /**
   * `sha256:<64 hex>` — ace calls this the contentAddress; here it is the artifact digest.
   *
   * OPTIONAL since 081M24HZCYN087G0R002MT55TV, and only in one direction: a SINGLE-artifact
   * pin may carry the digest here (the ollama shape, unchanged), while a MULTI-PLATFORM pin
   * must not, because one digest cannot describe four different builds. `parsePin` refuses
   * a pin that ends up with no digest for the artifact it selected, so the field being
   * optional never yields an unpinned fetch.
   */
  readonly contentAddress?: string;
  readonly weight: number;
  readonly packageManager: string;
  readonly lastUpdated: string;
}

/**
 * How the verified bytes become an installed thing.
 *
 *  - `archive`        the bytes are a tarball; they are UNPACKED into `installsInto`.
 *  - `run-installer`  the bytes ARE an executable installer (rustup-init) and are EXECUTED
 *                     with `runArgs`. The pin is over the installer's bytes, which is the
 *                     whole difference from `curl … | sh`: there the bytes are whatever the
 *                     origin served at that instant and nothing in the repo can notice a
 *                     change; here a single flipped byte refuses before anything runs.
 *
 * `run-installer` is deliberately NOT more permissive than `archive`. Both fetch, both
 * verify, both refuse identically, and both prove afterwards that the thing now resolvable
 * came out of the bytes we checked. The only difference is which door the bytes go through.
 */
export type PinArtifactKind = "archive" | "run-installer";

/** The locator ace has no field for yet. One entry of the pin file's `artifact`/`artifacts`. */
export interface PinArtifact {
  readonly tag: string;
  /**
   * The artifact's file name. For `run-installer` it is also the name the installer is
   * written under before execution, and that MATTERS: `rustup-init` dispatches on argv[0]
   * and answers `unknown proxy name` when it is called anything else (measured 2026-09-10).
   * So a name is not cosmetic here, and a path separator in it is refused.
   */
  readonly asset: string;
  readonly url: string;
  /** `<os>/<arch>`, e.g. `linux/x86_64`. Compared against the host; no match REFUSES. */
  readonly platform: string;
  readonly sizeBytes: number;
  readonly installsInto: string;
  /** `sha256:<64 hex>` for THESE bytes. Resolved by `parsePin`; never absent by the time it is here. */
  readonly contentAddress: string;
  readonly kind: PinArtifactKind;
  /**
   * argv handed to the installer under `run-installer`. Empty for `archive`, and a non-empty
   * value there is REFUSED rather than ignored — an ignored field is the vacuity shape.
   *
   * ARGV IS NOT PINNED AND IS NOT CLAIMED TO BE. What this mechanism guarantees is the BYTES;
   * the caller may add arguments with `--run-arg`. That is the same trust boundary a package
   * manager has when you type flags at it, and it is a strictly smaller one than the shape it
   * replaces, where the *code* was unpinned too.
   */
  readonly runArgs: readonly string[];
  /**
   * Post-install proof that the binary now resolvable is the one we pinned. `binary` is a
   * PATH name when it has no `/`, and a filesystem path (with a leading `~` meaning the
   * caller's home) when it does — rustup installs into `~/.cargo/bin`, which is not on the
   * PATH of the process that ran the installer.
   */
  readonly verify: { readonly binary: string; readonly versionArgs: readonly string[] };
}

export interface Pin {
  readonly entry: PinEntry;
  /**
   * One artifact per platform. `installPinnedArtifact` selects the row matching the host and
   * REFUSES when none does — it never picks a near-match. A single-platform pin is the
   * one-element case, which is why the ollama pin's `artifact` block still parses unchanged.
   */
  readonly artifacts: readonly PinArtifact[];
}

export type ParsedPin = { ok: true; pin: Pin } | { ok: false; reason: string };

const SHA256_HEX = /^[0-9a-f]{64}$/;

const ARTIFACT_KINDS: ReadonlySet<string> = new Set(["archive", "run-installer"]);

function str(o: Record<string, unknown>, k: string): string | null {
  return typeof o[k] === "string" && (o[k] as string).length > 0 ? (o[k] as string) : null;
}

/** `sha256:<64 hex>` or a reason. Short, non-hex and wrong-algorithm digests all refuse. */
function checkedContentAddress(
  value: string,
  where: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (!value.startsWith("sha256:")) return { ok: false, reason: `${where} is not sha256: ${value}` };
  // A short or non-hex digest would "verify" nothing while looking like a check.
  if (!SHA256_HEX.test(value.slice("sha256:".length)))
    return { ok: false, reason: `${where} is not 64 hex chars: ${value}` };
  return { ok: true, value };
}

type ParsedArtifact = { ok: true; artifact: PinArtifact } | { ok: false; reason: string };

/**
 * One artifact row. `inheritedContentAddress` is `entry.contentAddress` and is offered ONLY
 * to a single-artifact pin: sharing one digest across platforms would describe none of them.
 */
function parseArtifact(raw: unknown, inheritedContentAddress: string | null, index: number): ParsedArtifact {
  const at = `pin.artifact[${String(index)}]`;
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: `${at} is not an object` };
  const artifact = raw as Record<string, unknown>;

  const tag = str(artifact, "tag");
  const asset = str(artifact, "asset");
  const url = str(artifact, "url");
  const platform = str(artifact, "platform");
  const installsInto = str(artifact, "installsInto");
  if (tag === null) return { ok: false, reason: `${at}.tag missing` };
  if (asset === null) return { ok: false, reason: `${at}.asset missing` };
  if (url === null) return { ok: false, reason: `${at}.url missing` };
  if (platform === null) return { ok: false, reason: `${at}.platform missing` };
  if (installsInto === null) return { ok: false, reason: `${at}.installsInto missing` };
  if (!url.startsWith("https://")) return { ok: false, reason: `${at}.url is not https: ${url}` };

  const declaredDigest = str(artifact, "contentAddress") ?? inheritedContentAddress;
  if (declaredDigest === null)
    return {
      ok: false,
      reason:
        `${at} has no contentAddress and none can be inherited. A multi-platform pin must ` +
        `carry one digest per artifact; a shared digest could match at most one platform.`,
    };
  const digest = checkedContentAddress(declaredDigest, `${at}.contentAddress`);
  if (!digest.ok) return { ok: false, reason: digest.reason };

  const kindRaw = artifact["kind"];
  const kind = kindRaw === undefined ? "archive" : kindRaw;
  if (typeof kind !== "string" || !ARTIFACT_KINDS.has(kind))
    return { ok: false, reason: `${at}.kind must be "archive" or "run-installer"` };

  const runArgsRaw = artifact["runArgs"];
  let runArgs: readonly string[] = [];
  if (runArgsRaw !== undefined) {
    if (!Array.isArray(runArgsRaw) || !runArgsRaw.every((a) => typeof a === "string"))
      return { ok: false, reason: `${at}.runArgs must be a string array` };
    runArgs = runArgsRaw as readonly string[];
  }
  // Refused rather than ignored: a field that silently does nothing is indistinguishable from
  // a field that works, which is how a pin comes to promise behaviour it never had.
  if (kind === "archive" && runArgs.length > 0)
    return { ok: false, reason: `${at}.runArgs is set but kind is "archive"; an archive is never executed` };
  // argv[0] decides what rustup-init believes it is, so the asset name must be a bare filename.
  if (kind === "run-installer" && (asset.includes("/") || asset.includes("\\")))
    return { ok: false, reason: `${at}.asset must be a bare file name for a run-installer (got ${asset})` };

  const verify = artifact["verify"] as Record<string, unknown> | undefined;
  if (typeof verify !== "object" || verify === null) return { ok: false, reason: `${at}.verify missing` };
  const binary = str(verify, "binary");
  if (binary === null) return { ok: false, reason: `${at}.verify.binary missing` };
  const versionArgs = verify["versionArgs"];
  if (!Array.isArray(versionArgs) || !versionArgs.every((a) => typeof a === "string"))
    return { ok: false, reason: `${at}.verify.versionArgs must be a string array` };

  return {
    ok: true,
    artifact: {
      tag,
      asset,
      url,
      platform,
      sizeBytes: typeof artifact["sizeBytes"] === "number" ? (artifact["sizeBytes"] as number) : 0,
      installsInto,
      contentAddress: digest.value,
      kind: kind as PinArtifactKind,
      runArgs,
      verify: { binary, versionArgs: versionArgs as readonly string[] },
    },
  };
}

/**
 * Parse an untrusted pin document. Every field this module depends on is checked here, so a
 * malformed pin is a REFUSAL with a reason rather than an undefined flowing into a fetch.
 *
 * Accepts either `artifact` (one platform — the ollama shape) or `artifacts` (a list, one per
 * platform — the rustup shape), never both: a document carrying both would have two answers
 * to "which bytes", and picking one silently is how a pin comes to describe something nobody
 * reviewed.
 */
export function parsePin(raw: unknown): ParsedPin {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "pin is not an object" };
  const doc = raw as Record<string, unknown>;
  const entry = doc["entry"] as Record<string, unknown> | undefined;
  if (typeof entry !== "object" || entry === null) return { ok: false, reason: "pin.entry missing" };

  const single = doc["artifact"];
  const many = doc["artifacts"];
  if (single !== undefined && many !== undefined)
    return { ok: false, reason: "pin declares BOTH artifact and artifacts; declare exactly one" };
  if (single === undefined && many === undefined) return { ok: false, reason: "pin.artifact missing" };
  if (many !== undefined && !Array.isArray(many)) return { ok: false, reason: "pin.artifacts must be an array" };
  const rawArtifacts: readonly unknown[] = many === undefined ? [single] : (many as readonly unknown[]);
  if (rawArtifacts.length === 0) return { ok: false, reason: "pin.artifacts is empty" };

  const name = str(entry, "name");
  const version = str(entry, "version");
  if (name === null) return { ok: false, reason: "pin.entry.name missing" };
  if (version === null) return { ok: false, reason: "pin.entry.version missing" };

  let entryContentAddress: string | undefined;
  const entryDigestRaw = str(entry, "contentAddress");
  if (entryDigestRaw !== null) {
    const checked = checkedContentAddress(entryDigestRaw, "pin.entry.contentAddress");
    if (!checked.ok) return { ok: false, reason: checked.reason };
    entryContentAddress = checked.value;
  }

  // Inheritance is offered to the one-artifact case only. With two or more artifacts a single
  // entry-level digest could be right for at most one of them, so it is withheld and each row
  // must say what its own bytes are.
  const inherited = rawArtifacts.length === 1 ? (entryContentAddress ?? null) : null;

  const artifacts: PinArtifact[] = [];
  const seenPlatforms = new Set<string>();
  for (let i = 0; i < rawArtifacts.length; i++) {
    const parsed = parseArtifact(rawArtifacts[i], inherited, i);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    if (seenPlatforms.has(parsed.artifact.platform))
      return { ok: false, reason: `pin declares platform ${parsed.artifact.platform} twice` };
    seenPlatforms.add(parsed.artifact.platform);
    artifacts.push(parsed.artifact);
  }

  return {
    ok: true,
    pin: {
      entry: {
        name,
        version,
        ...(entryContentAddress === undefined ? {} : { contentAddress: entryContentAddress }),
        weight: typeof entry["weight"] === "number" ? (entry["weight"] as number) : 0,
        packageManager: str(entry, "packageManager") ?? "ace",
        lastUpdated: str(entry, "lastUpdated") ?? "",
      },
      artifacts,
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
  /** Mark a downloaded `run-installer` executable. Separate from `writeTemp` so an archive never becomes one. */
  readonly makeExecutable: (path: string) => Promise<{ ok: boolean; message: string }>;
  /**
   * Resolve a binary SPEC to an executable path, or null.
   *
   * A spec with no `/` is a PATH scan. A spec containing one is a filesystem path, where a
   * leading `~` means the caller's home — `rustup` lands in `~/.cargo/bin`, which the process
   * that ran the installer does not have on its PATH, so a PATH-only contract would report
   * `not-on-path` for a perfectly good install.
   */
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
  | "installer-failed"
  | "not-on-path"
  | "version-mismatch";

export type InstallOutcome =
  | { ok: true; name: string; version: string; installedInto: string }
  | { ok: false; reason: InstallFailure; message: string };

/**
 * Select → fetch → VERIFY → install (unpack, or execute) → prove. Returns an outcome; it never
 * throws for an expected failure and NEVER falls back to an unverified path. A recovery path
 * that cannot fail is not a check, which is the defect class this replaced.
 *
 * The verify step sits BEFORE the install step on both branches, and that ordering is the
 * property, not an implementation detail: `curl … | sh` executes the bytes as its first act,
 * so no check it could perform afterwards would be a check at all.
 *
 * `extraRunArgs` are appended to a `run-installer`'s argv by the caller (`--run-arg`). They are
 * refused outright against an `archive`, which cannot run anything.
 *
 * The CALLER decides whether a failure is fatal. On the heartbeat lane it is not: the step is
 * continue-on-error, so a broken pin degrades that tick to model-less rather than stopping the
 * society (tick-must-never-stop).
 */
export async function installPinnedArtifact(
  rawPin: unknown,
  fx: InstallEffects,
  extraRunArgs: readonly string[] = [],
): Promise<InstallOutcome> {
  const parsed = parsePin(rawPin);
  if (!parsed.ok) return { ok: false, reason: "bad-pin", message: parsed.reason };
  const { entry, artifacts } = parsed.pin;

  const host = fx.hostPlatform();
  const artifact = artifacts.find((candidate) => candidate.platform === host);
  if (artifact === undefined) {
    // LOUD refusal, never "install whatever fits this machine". A pin that quietly does not
    // apply to the host it ran on is a check that cannot fail wearing a success story.
    const declared = artifacts.map((a) => a.platform).join(", ");
    return {
      ok: false,
      reason: "platform-mismatch",
      message: `pin targets ${declared}; this host is ${host}. Add a pin for it rather than falling back.`,
    };
  }

  if (artifact.kind === "archive" && extraRunArgs.length > 0) {
    // The caller asked for behaviour this artifact has no way to perform. Silently dropping
    // the arguments would run an install that is not the one anybody asked for.
    return {
      ok: false,
      reason: "bad-pin",
      message: `--run-arg was given but ${artifact.asset} is an archive, which is never executed`,
    };
  }

  fx.log(`[pin] ${entry.name} ${entry.version} — ${artifact.asset} (${artifact.platform}, ${artifact.kind})`);
  fx.log(`[pin] expected ${artifact.contentAddress}`);
  fx.log(`[pin] fetching ${artifact.url}`);

  let bytes: Uint8Array;
  try {
    bytes = await fx.fetchBytes(artifact.url);
  } catch (e) {
    return {
      ok: false,
      reason: "download-failed",
      message: `${artifact.url}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!digestMatches(artifact.contentAddress, bytes)) {
    return {
      ok: false,
      reason: "digest-mismatch",
      message:
        `SHA-256 MISMATCH for ${artifact.asset}: expected ${artifact.contentAddress}, ` +
        `got sha256:${sha256Hex(bytes)} (${bytes.length} bytes). The bytes under the tag changed, ` +
        `or they were altered in transit. NOTHING was installed.`,
    };
  }
  fx.log(`[pin] sha256 OK (${bytes.length} bytes)`);

  // ONLY AFTER THE DIGEST AGREES do the bytes reach a door that can change the machine. That
  // ordering is the entire difference from `curl … | sh`, where the first thing that happens
  // to the downloaded bytes is that they run.
  const localPath = await fx.writeTemp(artifact.asset, bytes);

  if (artifact.kind === "run-installer") {
    const marked = await fx.makeExecutable(localPath);
    if (!marked.ok) return { ok: false, reason: "installer-failed", message: marked.message };
    const argv = [...artifact.runArgs, ...extraRunArgs];
    fx.log(`[pin] running ${artifact.asset} ${argv.join(" ")}`);
    const ran = await fx.run(localPath, argv);
    if (!ran.ok) {
      return {
        ok: false,
        reason: "installer-failed",
        message: `${artifact.asset} exited non-zero: ${ran.output.replace(/\s+/g, " ").trim()}`,
      };
    }
  } else {
    const extracted = await fx.extract(localPath, artifact.installsInto);
    if (!extracted.ok) return { ok: false, reason: "extract-failed", message: extracted.message };
  }

  const found = await fx.which(artifact.verify.binary);
  if (found === null) {
    return {
      ok: false,
      reason: "not-on-path",
      message: `installed, but '${artifact.verify.binary}' did not resolve (expected under ${artifact.installsInto})`,
    };
  }

  // Without this the digest check proves only that correct bytes were downloaded — not that
  // the thing now resolvable came out of them. An older build already installed would shadow
  // ours and the step would still report success.
  const probe = await fx.run(found, artifact.verify.versionArgs);
  const flat = probe.output.replace(/\s+/g, " ").trim();
  if (!flat.includes(entry.version)) {
    return {
      ok: false,
      reason: "version-mismatch",
      message: `${found} reports '${flat}' but the pin is ${entry.version} — something is shadowing ${artifact.installsInto}`,
    };
  }

  fx.log(`[pin] installed: ${flat}`);
  return { ok: true, name: entry.name, version: entry.version, installedInto: artifact.installsInto };
}
