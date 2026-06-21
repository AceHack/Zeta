// Zeta per-MACHINE device key + two-part (user × machine) presence check — the
// SAFE, read-mostly slice of the unified key-onboarding flow (workitem
// 081KVM1TK3Z08QG0R0002959G6 §"Two-part presence check"). PURE oracle + a single
// gated side-effect (generate ONE per-host ed25519 device key via ssh-keygen).
//
// SECURITY INVARIANTS (matched to the persona-keys README §"Security invariants"):
//  1. NO seed / NO CA key / NO persona key is generated here — ONLY a per-host
//     ed25519 device keypair (NOT seed-derived: each machine has its own key).
//  2. The private key NEVER touches argv / stdout / git. ssh-keygen writes it to a
//     local file under umask 077; only the PUBLIC key (`<path>.pub`) is read back
//     for publishing. We never print or return private bytes.
//  3. Public artifacts only are published — the device PUBLIC key goes to
//     `maintainers/<user>/machines/<hostname>.pub`. This module SUPPORTS writing it;
//     it does NOT commit. Upload-to-GitHub / SSH-CA signing / cluster trust are
//     LATER slices (explicitly out of scope here).
//
// Noninterference (manifesto §13): the host environment (hostname, filesystem,
// ssh-keygen runner) enters ONLY through the injected `MachineEffects` — so the
// presence check + dry-run are deterministic and testable against a temp dir,
// never the real ~/.ssh or real maintainer paths.
//
// Anchors (Beacon): ed25519 device keys — Bernstein et al. (Ed25519, 2011);
// OpenSSH `ssh-keygen(1)`. Two-axis identity (user × machine) — the workitem's
// per-PERSONA vs per-MACHINE model. Type-separated keys — persona-keys README.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname as osHostname } from "node:os";
import { join } from "node:path";
// SHARED biometric-approval gate — the agent EXECUTES the device-key generation; the
// operator's Touch ID / Windows Hello is the AUTHORIZATION (Aaron 2026-06-21). Key generation
// creates private material, so it is gated FAIL-CLOSED behind a biometric confirm.
import { requireBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
export type { BiometricAuth, BiometricResult } from "./biometric.ts";

/** The host-environment doors — the ONLY channel for ambient influence (noninterference). */
export interface MachineEffects {
  /** This dev machine's hostname (the per-machine identity component). */
  readonly hostname: () => string;
  /** True iff a path exists (used for presence checks — never reads contents of secrets). */
  readonly exists: (path: string) => boolean;
  /** Read a PUBLIC text artifact (pubkey / public keyring). Never used on private paths. */
  readonly readText: (path: string) => string;
  /** Write a PUBLIC text artifact (the published `<hostname>.pub`). */
  readonly writeText: (path: string, content: string) => void;
  /** Create a directory (recursive). */
  readonly mkdirp: (path: string) => void;
  /** Generate an ed25519 keypair at `keyPath` (private) + `keyPath.pub` (public).
   *  Returns the PUBLIC key text only — the private bytes never cross this boundary. */
  readonly genEd25519: (keyPath: string, comment: string) => string;
}

/** Where this dev machine's PRIVATE device key lives locally (never published, never committed). */
export function deviceKeyPath(home: string = homedir()): string {
  return join(home, ".config", "zeta", "machine", "id_ed25519");
}

/** Where this machine's PUBLIC device key is published under the operator's maintainer dir. */
export function publishPubPath(repoRoot: string, user: string, hostname: string): string {
  return join(repoRoot, "maintainers", user, "machines", `${sanitizeHostname(hostname)}.pub`);
}

/** The operator's persona keyring public registry (the "user key present?" probe). */
export function userKeyringPublicPath(repoRoot: string, user: string): string {
  return join(repoRoot, "maintainers", user, "keyring-public.json");
}

/** Hostnames become filenames — keep them filesystem-safe + ordinal-stable (culture-invariant). */
export function sanitizeHostname(hostname: string): string {
  const cleaned = hostname.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "unknown-host";
}

/** Result of the two-part presence check (workitem §"Two-part presence check"). */
export interface PresenceStatus {
  readonly user: string;
  readonly hostname: string;
  /** Is this operator's persona keyring registered (user identity present)? */
  readonly userKeyPresent: boolean;
  /** Is THIS dev machine's device private key present locally? */
  readonly machineKeyPresentLocal: boolean;
  /** Is THIS dev machine's device PUBLIC key published under maintainers/<user>/machines/? */
  readonly machineKeyPublished: boolean;
  readonly userKeyringPath: string;
  readonly devicePrivatePath: string;
  readonly devicePublicPath: string;
}

/** READ-ONLY two-part check: user keyring present? this machine's device key present?
 *  Pure over the injected effects — inspects existence only, never reads secret bytes. */
export function checkPresence(
  fx: MachineEffects,
  opts: { readonly user: string; readonly repoRoot: string; readonly home?: string },
): PresenceStatus {
  const hostname = sanitizeHostname(fx.hostname());
  const userKeyringPath = userKeyringPublicPath(opts.repoRoot, opts.user);
  const devicePrivatePath = opts.home === undefined ? deviceKeyPath() : deviceKeyPath(opts.home);
  const devicePublicPath = publishPubPath(opts.repoRoot, opts.user, hostname);
  return {
    user: opts.user,
    hostname,
    userKeyPresent: fx.exists(userKeyringPath),
    machineKeyPresentLocal: fx.exists(devicePrivatePath),
    machineKeyPublished: fx.exists(devicePublicPath),
    userKeyringPath,
    devicePrivatePath,
    devicePublicPath,
  };
}

/** Human-readable readout: "user=<persona> present=<y/n>, machine=<hostname> key present=<y/n>". */
export function formatStatus(s: PresenceStatus): string {
  const yn = (b: boolean) => (b ? "y" : "n");
  return [
    `user=${s.user} present=${yn(s.userKeyPresent)}`,
    `machine=${s.hostname} key present=${yn(s.machineKeyPresentLocal)}`,
    `machine key published=${yn(s.machineKeyPublished)}`,
  ].join(", ");
}

/** What a `machine` run did (or, with dryRun, WOULD do). No private material ever appears here. */
export interface MachineResult {
  readonly dryRun: boolean;
  readonly hostname: string;
  readonly devicePrivatePath: string;
  readonly devicePublicPath: string;
  /** "generated" | "exists" (idempotent: an existing key is a no-op) | "would-generate" (dry-run)
   *  | "aborted-biometric" (operator did NOT approve → fail-closed, NO key generated). */
  readonly action: "generated" | "exists" | "would-generate" | "aborted-biometric";
  /** The PUBLIC key text, when present/generated (safe to print/publish). Undefined on pure dry-run. */
  readonly publicKey?: string;
  /** True iff we wrote the public key to the publish path (never true on dry-run). */
  readonly published: boolean;
  /** The biometric approval outcome (present only when the gate was invoked — i.e. a real
   *  keygen was attempted; absent on dry-run + the idempotent `exists` no-op; no secret). */
  readonly biometric?: BiometricResult;
}

/**
 * Generate (or, idempotently, recognise) THIS machine's per-host ed25519 device key —
 * AGENT-RUN, OPERATOR-APPROVED. The agent EXECUTES the keygen; a biometric confirm (Touch ID /
 * Windows Hello) is the operator's AUTHORIZATION. Generates ONLY a device keypair — no seed,
 * no CA, no persona key. The private key is written locally by ssh-keygen under umask 077 (the
 * runner's job); ONLY the public key is read back and (optionally) written to the publish path.
 *
 * BIOMETRIC GATE + FAIL-CLOSED: when a real keygen is about to happen (the device key does NOT
 * already exist and it is not a dry-run), `biometricAuth()` MUST return ok:true first. On
 * ok:false the run aborts ("aborted-biometric") and `genEd25519` is NEVER invoked — NO key is
 * created and NO public artifact is written. The idempotent `exists` no-op (no private material
 * created) and `--dry-run` (creates nothing) do NOT prompt.
 *
 * @param biometricAuth the SHARED approval gate (biometric.ts). Required for the real-keygen path.
 * @param publish  when true, copy the PUBLIC key into maintainers/<user>/machines/.
 *                 (This PR does NOT commit; the caller/operator decides whether to commit.)
 * @param dryRun   when true, NOTHING is generated, written, or prompted — "would-generate".
 */
export async function ensureMachineKey(
  fx: MachineEffects,
  opts: {
    readonly user: string;
    readonly repoRoot: string;
    readonly home?: string;
    readonly publish?: boolean;
    readonly dryRun?: boolean;
    /** SHARED biometric approval door — required for the real keygen path (fail-closed). */
    readonly biometricAuth?: BiometricAuth;
  },
): Promise<MachineResult> {
  const hostname = sanitizeHostname(fx.hostname());
  const devicePrivatePath = opts.home === undefined ? deviceKeyPath() : deviceKeyPath(opts.home);
  const devicePublicPath = publishPubPath(opts.repoRoot, opts.user, hostname);
  const dryRun = opts.dryRun === true;
  const wantPublish = opts.publish === true;
  const alreadyExists = fx.exists(devicePrivatePath);

  if (dryRun) {
    return {
      dryRun: true,
      hostname,
      devicePrivatePath,
      devicePublicPath,
      action: alreadyExists ? "exists" : "would-generate",
      published: false,
    };
  }

  let publicKey: string;
  let action: MachineResult["action"];
  let biometric: BiometricResult | undefined;
  if (alreadyExists) {
    // Idempotent: an existing device key is a no-op (no private material created → no gate).
    // Read back its PUBLIC half only.
    publicKey = fx.readText(devicePrivatePath + ".pub").trim();
    action = "exists";
  } else {
    // BIOMETRIC GATE — fail-closed. A real keygen creates private material; require approval.
    biometric = await requireBiometric(
      opts.biometricAuth,
      `Approve: generate device key for ${hostname}`,
    );
    if (!biometric.ok) {
      return {
        dryRun: false,
        hostname,
        devicePrivatePath,
        devicePublicPath,
        action: "aborted-biometric",
        published: false,
        biometric,
      };
    }
    publicKey = fx.genEd25519(devicePrivatePath, `${opts.user}@${hostname} (zeta-device)`).trim();
    action = "generated";
  }

  const bio = biometric !== undefined ? { biometric } : {};
  if (wantPublish) {
    fx.mkdirp(dirOf(devicePublicPath));
    fx.writeText(devicePublicPath, publicKey.endsWith("\n") ? publicKey : publicKey + "\n");
    return { dryRun: false, hostname, devicePrivatePath, devicePublicPath, action, publicKey, published: true, ...bio };
  }

  return { dryRun: false, hostname, devicePrivatePath, devicePublicPath, action, publicKey, published: false, ...bio };
}

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : ".";
}

/** The REAL host effects (used by the CLI). ssh-keygen generates in-process; the
 *  private key file is created under umask 077 by ssh-keygen — never read by us. */
export function realEffects(): MachineEffects {
  return {
    hostname: () => osHostname(),
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c) => writeFileSync(p, c, { mode: 0o644 }),
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    genEd25519: (keyPath, comment) => {
      mkdirSync(dirOf(keyPath), { recursive: true, mode: 0o700 });
      const prevUmask = process.umask(0o077); // private key must not be group/other readable
      try {
        // ssh-keygen generates the key itself — no secret on argv. -N "" = no passphrase
        // (standard for an unattended device key); the private file stays local (umask 077).
        const r = spawnSync(
          "ssh-keygen",
          ["-t", "ed25519", "-f", keyPath, "-N", "", "-C", comment],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        );
        if (r.status !== 0) {
          throw new Error(`ssh-keygen failed (status ${r.status ?? "signal"}): ${r.stderr ?? ""}`);
        }
      } finally {
        process.umask(prevUmask);
      }
      // Read back ONLY the public half.
      return readFileSync(keyPath + ".pub", "utf8");
    },
  };
}
