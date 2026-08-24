// Zeta biometric-gated GitHub PUBLIC-key publish — the OUTWARD-WRITE slice of the
// unified key-onboarding flow (workitem 081KVM1TK3Z08QG0R0002959G6 §"publish to GitHub").
// Aaron (2026-06-21): *"we need to code this [publish to GitHub] and make sure it uses
// mac fingerprint / windows hello auth … clean and smooth and automatic."*
//
// This slice UPLOADS a caller-supplied PUBLIC key (the USER's identity / keyring SSH key —
// a person's GitHub AUTH key) to the operator's GitHub account via `gh ssh-key add` — but
// ONLY after a biometric confirmation succeeds (fail-closed).
//
// PURE-KEY MODEL (Aaron 2026-06-21): a MACHINE key is a host identity, NOT a user's GitHub
// auth key, so it does NOT belong on `github:<user>`. This publisher therefore requires an
// EXPLICIT `keyPath` (the USER's pubkey) — there is no machine-key default. The machine
// key's tie to a user is a CA cert (ca.ts), never a GitHub upload. The onboard orchestrator
// consequently OMITS a machine-key GitHub publish (see onboard.ts).
//
// SECURITY INVARIANTS (security-sensitive slice — honesty over green):
//  1. BIOMETRIC GATE FIRST + FAIL-CLOSED — before ANY GitHub write, biometricAuth()
//     MUST return ok:true. If it returns false / throws / the platform is unsupported,
//     the publish ABORTS and `gh` is NEVER invoked. There is no `gh` write path that
//     bypasses the gate. (macOS = Touch ID via pam_tid/sudo, reusing the zflash /
//     biometric-sudo-handler pattern; Windows Hello = seam-wired, see realEffects.)
//  2. PUBLIC KEY ONLY — we read, upload, and print ONLY the `.pub` artifact. No seed,
//     no private key, no CA. The payload is asserted to NOT match /PRIVATE KEY/ before
//     it crosses the GitHub door — a defense-in-depth refusal, not just a convention.
//  3. NONINTERFERENCE (manifesto §13) — the biometric prompt, the filesystem read of
//     the pubkey, and the `gh` invocation enter ONLY through the injected
//     `PublishEffects` doors. Tests inject fakes (no real prompt, no real network/gh
//     write); `--dry-run` performs NEITHER a prompt NOR a write. The REAL doors live
//     only in `realEffects()`.
//
// Anchors (Beacon): Touch ID PAM (`pam_tid.so`) biometric sudo — Apple PAM / the
// repo's biometric-sudo ADR (2026-05-29) + zflash's Touch-ID-gated dd. Windows Hello
// programmatic consent — `Windows.Security.Credentials.UI.UserConsentVerifier`
// (Microsoft WinRT). GitHub public-key upload — `gh ssh-key add` (GitHub CLI manual);
// SSH ed25519 — Bernstein et al. (2011). Physical-presence consent as a write floor —
// FIDO/WebAuthn user-verification framing.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, hostname as osHostname } from "node:os";
import { join } from "node:path";
import { sanitizeHostname } from "./machine.ts";
// The biometric gate is the SHARED primitive in biometric.ts (lifted out of this module so
// ca.ts / machine.ts / publish.ts all share ONE gate, not three copies of the Touch-ID
// logic). publish.ts re-exports the types + detector for back-compat with its existing
// importers (CLI + tests); the implementation now lives in biometric.ts.
import {
  detectBiometricPlatform as detectBiometricPlatformShared,
  realBiometric,
  type BiometricPlatform,
  type BiometricResult,
} from "./biometric.ts";

import {
  ceremonyPromptLine,
  realBriefEffects,
  renderCeremonyBrief,
  requestedBy,
  type CeremonyBrief,
  type CeremonyBriefEffects,
} from "./ceremony-brief.ts";

export type { BiometricPlatform, BiometricResult } from "./biometric.ts";

/** Re-exported for back-compat with publish.ts's existing importers (CLI + tests). The
 *  implementation lives in the shared biometric.ts. */
export function detectBiometricPlatform(plat?: string): BiometricPlatform {
  return plat === undefined ? detectBiometricPlatformShared() : detectBiometricPlatformShared(plat);
}

/** The doors for ambient influence — the ONLY channel for biometric + filesystem + the
 *  GitHub write (noninterference §13). Tests/dry-run inject fakes; the CLI injects real. */
export interface PublishEffects extends CeremonyBriefEffects {
  /** Require a biometric physical-presence confirmation. MUST be called and MUST return
   *  ok:true before any GitHub write. Reused machinery: Touch ID (pam_tid) on macOS;
   *  Windows Hello on Windows. NEVER prompts in tests/dry-run (a fake is injected). */
  readonly biometricAuth: (prompt: string) => Promise<BiometricResult>;
  /** True iff a path exists (presence-only; never reads secret bytes). */
  readonly exists: (path: string) => boolean;
  /** Read a PUBLIC text artifact (the `<host>.pub`). Never used on a private path. */
  readonly readText: (path: string) => string;
  /** Upload a PUBLIC key to GitHub (`gh ssh-key add`). The ONLY GitHub-write door.
   *  Receives the PUBLIC key TEXT (already public-asserted) + a title + the key type. */
  readonly ghAddKey: (args: {
    readonly publicKey: string;
    readonly title: string;
    readonly keyType: "authentication" | "signing";
  }) => Promise<void>;
}

/** Options for a publish run. `keyPath` is REQUIRED — the explicit PUBLIC key to upload
 *  (the USER's pubkey). PURE-KEY MODEL: there is no machine-key default, because a machine
 *  key is not a user's GitHub auth key. */
export interface PublishOptions {
  readonly user: string;
  readonly repoRoot: string;
  /** REQUIRED: the explicit PUBLIC key path to upload (the USER's identity SSH key). */
  readonly keyPath: string;
  /** Hostname override (else the injected hostname). Sanitized for the key title. */
  readonly hostname?: string;
  /** Add as an authentication key (default) and/or a signing key. */
  readonly keyType?: "authentication" | "signing";
  /** When true: NOTHING is prompted and NOTHING is written — reports intent only. */
  readonly dryRun?: boolean;
}

/** What a publish run did (or WOULD do, on dry-run). No private material ever appears. */
export interface PublishResult {
  readonly dryRun: boolean;
  readonly user: string;
  readonly hostname: string;
  readonly keyPath: string;
  readonly keyType: "authentication" | "signing";
  readonly title: string;
  /** "would-publish" (dry-run) | "published" | "aborted-no-key" | "aborted-biometric"
   *  | "aborted-private-material". Only "published" implies `gh` was invoked. */
  readonly action: "would-publish" | "published" | "aborted-no-key" | "aborted-biometric" | "aborted-private-material";
  /** The biometric outcome (absent on dry-run — dry-run NEVER prompts). */
  readonly biometric?: BiometricResult;
  /** A stable public-derived fingerprint, for the readout. Never the key bytes. */
  readonly fingerprint?: string;
  /** Present when the run aborted — the operator-facing reason. */
  readonly error?: string;
  /** The EXACT one-line prompt the operator was (or on a dry-run, would be) shown. Present
   *  whenever the brief was computed. Recorded so a dry-run readout and an audit trail can
   *  quote the real sentence rather than re-typing an imitation of it. */
  readonly wouldPrompt?: string;
}

/** Marker substrings that mean "this is private material" — refuse to upload if present.
 *  Covers OpenSSH + PEM/PKCS#8 private-key headers across formats. */
const PRIVATE_KEY_MARKERS: readonly string[] = [
  "PRIVATE KEY",
  "BEGIN OPENSSH PRIVATE KEY",
  "BEGIN RSA PRIVATE KEY",
  "BEGIN EC PRIVATE KEY",
  "BEGIN DSA PRIVATE KEY",
  "BEGIN PGP PRIVATE KEY",
];

/** True iff the text contains ANY private-key marker (case-insensitive defense-in-depth).
 *  A PUBLIC key line (`ssh-ed25519 AAAA… comment`) never matches. */
export function looksPrivate(text: string): boolean {
  const up = text.toUpperCase();
  return PRIVATE_KEY_MARKERS.some((m) => up.includes(m));
}

/** The GitHub key title for the USER's machine-independent key: "<user> (zeta)" — NO @host
 *  (Aaron 2026-06-21 "drop the @host"): the user key has no host coupling, and this avoids even
 *  the textual user@host N×M shape. GitHub dedupes by key ⇒ one title per user key. */
export function publishTitle(user: string): string {
  return `${user} (zeta)`;
}

/** A stable, public-derived fingerprint token of the public-key line (for the readout,
 *  not for trust). Derived from PUBLIC bytes only; never the key. Computed without
 *  importing crypto into the pure core, so it stays DST-deterministic + dependency-free. */
export function publicKeyFingerprint(pubLine: string): string {
  let h = 0n;
  const MOD = (1n << 64n) - 59n; // a large 64-bit-ish prime modulus for a stable digest
  for (let i = 0; i < pubLine.length; i++) {
    h = (h * 1000003n + BigInt(pubLine.charCodeAt(i))) % MOD;
  }
  return `key-${h.toString(16).padStart(16, "0")}`;
}

/** Resolve the pubkey path. PURE-KEY MODEL: `keyPath` is REQUIRED (the USER's pubkey) —
 *  there is no machine-key default (a machine key is not a user's GitHub auth key). */
export function resolveKeyPath(opts: PublishOptions): string {
  return opts.keyPath;
}

/**
 * Publish THIS machine's PUBLIC key to GitHub — biometric-gated + fail-closed.
 *
 * Order of operations (the security contract):
 *   1. Resolve + READ the public key. If absent → abort ("aborted-no-key"); no prompt.
 *   2. Assert it is NOT private material. If it looks private → abort
 *      ("aborted-private-material"); `gh` is NEVER invoked.
 *   3. On dry-run: report "would-publish" — NO biometric prompt, NO `gh` write.
 *   4. BIOMETRIC GATE: call biometricAuth(). If ok !== true → abort
 *      ("aborted-biometric"); `ghAddKey` is NEVER called.
 *   5. Only on biometric success: `ghAddKey({ publicKey, title, keyType })`.
 *
 * PURE over the injected effects — deterministic + testable, never a real prompt/network.
 */
export async function publishKey(fx: PublishEffects, opts: PublishOptions): Promise<PublishResult> {
  const hostname = sanitizeHostname(opts.hostname ?? "this-host");
  const keyType = opts.keyType ?? "authentication";
  const keyPath = resolveKeyPath(opts);
  const title = publishTitle(opts.user);
  const dryRun = opts.dryRun === true;

  const base = { dryRun, user: opts.user, hostname, keyPath, keyType, title } as const;

  // 1. The public key must exist.
  if (!fx.exists(keyPath)) {
    return {
      ...base,
      action: "aborted-no-key",
      error: `no public key at ${keyPath} — run the \`machine\` slice (with --publish) first`,
    };
  }
  const publicKey = fx.readText(keyPath).trim();

  // 2. PUBLIC-ONLY invariant — refuse to upload anything that smells private.
  if (looksPrivate(publicKey)) {
    return {
      ...base,
      action: "aborted-private-material",
      error: `${keyPath} contains PRIVATE-key material — refusing to upload (public-only)`,
    };
  }
  const fingerprint = publicKeyFingerprint(publicKey);

  // THE BRIEF is built HERE — above the dry-run return — so that `--dry-run` reports the
  // EXACT sentence a real run would show, rather than a hand-written imitation of it. The
  // old dry-run readout re-typed the prompt as a literal, which is a second source of truth
  // for what is being authorised: it could (and would) drift from the real one silently.
  //
  // It names the FINGERPRINT, which was already computed one line above and was NOT in the
  // old prompt. That omission is the whole defect: the old text was `Publish ${title} to
  // GitHub`, and `title` is an operator-supplied label, not the key. Publishing key A and
  // publishing key B under the same title produced BYTE-IDENTICAL prompts — so the one fact
  // distinguishing "my key" from "some other key" was in hand, in scope, and withheld from
  // the person being asked to approve it.
  //
  // Same object, not a second derivation: `fingerprint` and `keyType` are the values handed
  // to `fx.ghAddKey` at step 5.
  const brief: CeremonyBrief = {
    operation: "publish-own-public-key-to-github",
    summary: "Add a PUBLIC key to a GitHub account",
    subjects: [
      { label: "fingerprint", value: fingerprint },
      { label: "key type", value: keyType },
      { label: "GitHub account", value: opts.user },
      { label: "title", value: title },
      { label: "read from", value: keyPath },
    ],
    ifDeclined:
      "nothing is sent to GitHub and the account is unchanged; this command exits reporting " +
      "'aborted-biometric'. The key file on disk is untouched either way.",
    ...requestedBy(fx.requester),
  };
  const wouldPrompt = ceremonyPromptLine(brief);

  // 3. Dry-run: report intent. NO biometric prompt, NO GitHub write.
  if (dryRun) {
    return { ...base, action: "would-publish", fingerprint, wouldPrompt };
  }

  // 4. BIOMETRIC GATE — fail-closed. No `gh` path past this point without ok:true.
  fx.notify?.(renderCeremonyBrief(brief));
  const biometric = await fx.biometricAuth(wouldPrompt);
  if (!biometric.ok) {
    return {
      ...base,
      action: "aborted-biometric",
      biometric,
      fingerprint,
      wouldPrompt,
      error: `biometric confirmation ${biometric.reason ? `failed: ${biometric.reason}` : "was not granted"} — publish aborted (fail-closed)`,
    };
  }

  // 5. Gate passed → upload the PUBLIC key. The ONLY GitHub-write door.
  await fx.ghAddKey({ publicKey, title, keyType });
  return { ...base, action: "published", biometric, fingerprint, wouldPrompt };
}

/** Clean, "smooth" readout (the operator-facing line). Public-only, safe to print. */
export function formatResult(res: PublishResult): string {
  const fp = res.fingerprint ?? "(unknown)";
  switch (res.action) {
    case "would-publish":
      return [
        `[dry-run] would publish ${fp} to github:${res.user} (${res.keyType})`,
        `[dry-run] would prompt biometric: "${res.wouldPrompt ?? "(prompt not computed)"}"`,
        "[dry-run] NO biometric prompt performed, NO GitHub write performed.",
      ].join("\n");
    case "published":
      return `🔐 biometric → ✅ → published ${fp} to github:${res.user} (${res.keyType}, "${res.title}")`;
    case "aborted-biometric":
      return `🔐 biometric → ❌ → ${res.error ?? "aborted"} (GitHub NOT written)`;
    case "aborted-no-key":
      return `aborted: ${res.error ?? "no key"} (no biometric prompt, no GitHub write)`;
    case "aborted-private-material":
      return `aborted: ${res.error ?? "private material"} (PUBLIC-only invariant; GitHub NOT written)`;
  }
}

// ── REAL effects (CLI-only): the doors that touch the OS / GitHub ───────────────────

/** The REAL effects (used by the CLI): the SHARED biometric gate (biometric.ts) + a
 *  filesystem read of the PUBLIC key + the real `gh ssh-key add` write. NO secrets,
 *  public-only. The biometric door is `realBiometric()` — the one gate every op shares. */
export function realEffects(): PublishEffects {
  return {
    ...realBriefEffects(),
    biometricAuth: realBiometric(),
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    ghAddKey: async ({ publicKey, title, keyType }) => {
      // Defense-in-depth: NEVER let private material reach the GitHub door, even if a
      // caller bypassed the core. (The core already asserts this; this is belt + braces.)
      if (looksPrivate(publicKey)) {
        throw new Error("refusing to upload PRIVATE-key material to GitHub (public-only invariant)");
      }
      // Pass the PUBLIC key on stdin (no key file path, no secret on argv). `gh ssh-key
      // add -` reads the key from stdin.
      const r = spawnSync("gh", ["ssh-key", "add", "-", "--title", title, "--type", keyType], {
        input: publicKey.endsWith("\n") ? publicKey : publicKey + "\n",
        encoding: "utf8",
        stdio: ["pipe", "inherit", "inherit"],
      });
      if (r.status !== 0) {
        throw new Error(`gh ssh-key add failed (status ${r.status ?? "signal"})`);
      }
    },
  };
}

/** The host's hostname (the conventional per-machine pub path component). */
export function hostHostname(): string {
  return osHostname();
}

/** The conventional local home (for path resolution parity with machine.ts). */
export function defaultHome(): string {
  return homedir();
}

/** Join helper re-exported so the CLI can build paths without re-importing node:path. */
export function joinPath(...parts: readonly string[]): string {
  return join(...parts);
}
