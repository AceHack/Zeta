// Zeta FROST CA custody — threshold CA keygen + device attestation (081KVP3GYW1 slice 2).
// Monorepo tools-over-trunks: lives beside frost.ts / ca-shamir-custody.ts / ca.ts.
//
// Live path: shares stay split; frostThresholdSign never reassembles the signing scalar.
// OpenSSH `ssh-keygen -s` certs remain the single-key path until an OpenSSH cert wire
// encoder lands — this module issues a Zeta-native frost attestation (JSON + Ed25519 sig)
// that binds principals × machine × device pubkey under the group public key.
//
// SECURITY: dry-run default; --confirm + biometric for real ops; share files LOCAL only;
// group public key may be written to maintainers/<ca>/frost-ca.pub (PUBLIC).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { requireBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
import {
  frostKeygen,
  frostThresholdSign,
  frostVerify,
  type FrostKeyShare,
} from "./frost.ts";
import { parseShamirSpec } from "./ca-shamir-custody.ts";
import { certPath } from "./ca.ts";
import {
  buildEd25519UserCertSignable,
  finalizeEd25519UserCert,
  formatSshEd25519CertLine,
  formatSshEd25519PublicKeyLine,
  parseSshEd25519PublicKeyLine,
  parseValidityWindow,
} from "./openssh-cert.ts";

export type { BiometricAuth, BiometricResult } from "./biometric.ts";

export const FROST_SHARE_SCHEMA = "zeta-frost-share-v1" as const;
export const FROST_ATTESTATION_SCHEMA = "zeta-frost-device-attestation-v1" as const;

export interface FrostShareFileV1 {
  readonly schema: typeof FROST_SHARE_SCHEMA;
  readonly ca: string;
  readonly threshold: number;
  readonly totalShares: number;
  readonly groupPublicKeyHex: string;
  readonly x: number;
  readonly secretShare: string;
}

export interface FrostDeviceAttestationV1 {
  readonly schema: typeof FROST_ATTESTATION_SCHEMA;
  readonly ca: string;
  readonly machineId: string;
  readonly principals: readonly string[];
  readonly devicePub: string;
  readonly validity: string;
  readonly issuedAt: string;
  readonly groupPublicKeyHex: string;
  readonly signatureHex: string;
}

export interface FrostCaCustodyEffects {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, content: string, mode?: number) => void;
  readonly mkdirp: (path: string) => void;
  readonly listFiles?: (dir: string) => readonly string[];
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Local dir for frost CA shares (never committed). */
export function frostCaSharesDir(home: string, ca: string): string {
  return join(home, ".config", "zeta", "ca", "frost", ca);
}

export function frostSharePath(sharesDir: string, x: number): string {
  return join(sharesDir, `share-${String(x).padStart(2, "0")}.json`);
}

/** Repo-public group pubkey path (safe to commit). */
export function frostCaPublicKeyPath(repoRoot: string, ca: string): string {
  return join(repoRoot, "maintainers", ca, "frost-ca.pub");
}

/** Attestation artifact path (public — signature over device binding). */
export function frostAttestationPath(repoRoot: string, machineId: string): string {
  return join(repoRoot, "machines", `${machineId}-frost-attestation.json`);
}

export interface EnsureFrostCaOptions {
  readonly ca: string;
  readonly repoRoot: string;
  readonly home?: string;
  /** e.g. "2-of-3" */
  readonly frost: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly biometricAuth?: BiometricAuth;
  readonly commitPub?: boolean;
}

export interface EnsureFrostCaResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly action:
    | "generated"
    | "exists"
    | "would-generate"
    | "skipped-not-confirmed"
    | "skipped-biometric";
  readonly ca: string;
  readonly threshold: number;
  readonly totalShares: number;
  readonly sharesDir: string;
  readonly sharePaths: readonly string[];
  readonly groupPublicKeyPath: string;
  readonly groupPublicKeyHex?: string;
  readonly committedPub: boolean;
  readonly biometric?: BiometricResult;
}

export interface SignFrostAttestationOptions {
  readonly ca: string;
  readonly repoRoot: string;
  readonly home?: string;
  readonly machineId: string;
  readonly devicePubPath: string;
  readonly users: readonly string[];
  readonly validity?: string;
  /** Share indices to use (defaults to 1..threshold). */
  readonly shareIndices?: readonly number[];
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly biometricAuth?: BiometricAuth;
  readonly issuedAt?: string;
}

export interface SignFrostAttestationResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly action:
    | "signed"
    | "would-sign"
    | "no-frost-ca"
    | "no-device-key"
    | "insufficient-shares"
    | "skipped-not-confirmed"
    | "skipped-biometric"
    | "failed";
  readonly attestationPath: string;
  /** OpenSSH `-cert.pub` path (PROTOCOL.certkeys, frost-signed). */
  readonly certPath: string;
  readonly groupPublicKeyHex?: string;
  readonly attestation?: FrostDeviceAttestationV1;
  /** OpenSSH cert line text when signed. */
  readonly certText?: string;
  readonly biometric?: BiometricResult;
  readonly warnings: readonly string[];
}

function loadShares(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  indices: readonly number[],
): FrostKeyShare[] {
  return indices.map((x) => {
    const p = frostSharePath(sharesDir, x);
    if (!fx.exists(p)) throw new Error(`missing frost share at ${p}`);
    const body = JSON.parse(fx.readText(p)) as FrostShareFileV1;
    if (body.schema !== FROST_SHARE_SCHEMA) {
      throw new Error(`unsupported frost share schema ${JSON.stringify(body.schema)}`);
    }
    return { x: body.x, secretShare: BigInt(body.secretShare) };
  });
}

function loadMeta(fx: FrostCaCustodyEffects, sharesDir: string): FrostShareFileV1 | undefined {
  const list = fx.listFiles ?? ((d) => readdirSync(d));
  if (!fx.exists(sharesDir)) return undefined;
  const first = list(sharesDir)
    .filter((f) => /^share-\d+\.json$/.test(f))
    .sort()[0];
  if (first === undefined) return undefined;
  return JSON.parse(fx.readText(join(sharesDir, first))) as FrostShareFileV1;
}

/** Canonical message bytes for an attestation (signature field excluded). */
export function attestationMessage(body: Omit<FrostDeviceAttestationV1, "signatureHex">): Uint8Array {
  // Stable key order — bit-identical across sign/verify.
  const canonical = {
    schema: body.schema,
    ca: body.ca,
    machineId: body.machineId,
    principals: body.principals,
    devicePub: body.devicePub,
    validity: body.validity,
    issuedAt: body.issuedAt,
    groupPublicKeyHex: body.groupPublicKeyHex,
  };
  return new TextEncoder().encode(JSON.stringify(canonical));
}

/** Generate frost CA shares locally; optionally write group pubkey to the repo. */
export async function ensureFrostCa(
  fx: FrostCaCustodyEffects,
  opts: EnsureFrostCaOptions,
): Promise<EnsureFrostCaResult> {
  const dryRun = opts.dryRun ?? !opts.confirm;
  const confirmed = opts.confirm === true && !dryRun;
  const home = opts.home ?? homedir();
  const { threshold, shares: totalShares } = parseShamirSpec(opts.frost);
  const sharesDir = frostCaSharesDir(home, opts.ca);
  const sharePaths = Array.from({ length: totalShares }, (_, i) => frostSharePath(sharesDir, i + 1));
  const groupPublicKeyPath = frostCaPublicKeyPath(opts.repoRoot, opts.ca);
  const existing = loadMeta(fx, sharesDir);

  const base: EnsureFrostCaResult = {
    dryRun,
    confirmed,
    action: existing ? "exists" : dryRun ? "would-generate" : "generated",
    ca: opts.ca,
    threshold,
    totalShares,
    sharesDir,
    sharePaths,
    groupPublicKeyPath,
    committedPub: false,
  };

  if (existing) {
    return {
      ...base,
      action: "exists",
      groupPublicKeyHex: existing.groupPublicKeyHex,
      committedPub: opts.commitPub === true && fx.exists(groupPublicKeyPath),
    };
  }

  if (!confirmed) {
    return { ...base, action: "skipped-not-confirmed" };
  }

  const biometric = await requireBiometric(
    opts.biometricAuth,
    `Approve: generate frost CA (${opts.frost}) for ${opts.ca}`,
  );
  if (!biometric.ok) {
    return { ...base, dryRun: false, action: "skipped-biometric", biometric };
  }

  const kg = frostKeygen(threshold, totalShares);
  const groupPublicKeyHex = bytesToHex(kg.groupPublicKey);
  fx.mkdirp(sharesDir);
  for (const s of kg.shares) {
    const body: FrostShareFileV1 = {
      schema: FROST_SHARE_SCHEMA,
      ca: opts.ca,
      threshold,
      totalShares,
      groupPublicKeyHex,
      x: s.x,
      secretShare: s.secretShare.toString(10),
    };
    fx.writeText(frostSharePath(sharesDir, s.x), JSON.stringify(body, null, 2) + "\n", 0o600);
  }

  let committedPub = false;
  if (opts.commitPub === true) {
    fx.mkdirp(dirname(groupPublicKeyPath));
    // PUBLIC OpenSSH line for TrustedUserCAKeys + hex comment for frost tooling.
    const sshLine = formatSshEd25519PublicKeyLine(
      kg.groupPublicKey,
      `zeta-frost-ca ${opts.ca} ${String(threshold)}-of-${String(totalShares)}`,
    );
    fx.writeText(
      groupPublicKeyPath,
      `# zeta-frost-ca-v1 ca=${opts.ca} threshold=${String(threshold)}-of-${String(totalShares)} hex=${groupPublicKeyHex}\n${sshLine}`,
      0o644,
    );
    committedPub = true;
  }

  return {
    ...base,
    dryRun: false,
    action: "generated",
    groupPublicKeyHex,
    committedPub,
    biometric,
  };
}

/** Threshold-sign a device attestation (principals × machine × device pubkey). */
export async function signFrostDeviceAttestation(
  fx: FrostCaCustodyEffects,
  opts: SignFrostAttestationOptions,
): Promise<SignFrostAttestationResult> {
  const dryRun = opts.dryRun ?? !opts.confirm;
  const confirmed = opts.confirm === true && !dryRun;
  const home = opts.home ?? homedir();
  const sharesDir = frostCaSharesDir(home, opts.ca);
  const attestationPath = frostAttestationPath(opts.repoRoot, opts.machineId);
  const openSshCertPath = certPath(opts.devicePubPath);
  const warnings: string[] = [
    "OpenSSH -cert.pub is frost-signed (no CA private key file). Put frost-ca.pub in TrustedUserCAKeys.",
  ];

  const meta = loadMeta(fx, sharesDir);
  const base: SignFrostAttestationResult = {
    dryRun,
    confirmed,
    action: dryRun ? "would-sign" : "signed",
    attestationPath,
    certPath: openSshCertPath,
    warnings,
  };

  if (meta === undefined) {
    return { ...base, action: "no-frost-ca" };
  }
  if (!fx.exists(opts.devicePubPath)) {
    return { ...base, action: "no-device-key" };
  }

  const indices =
    opts.shareIndices ??
    Array.from({ length: meta.threshold }, (_, i) => i + 1);
  if (indices.length < meta.threshold) {
    return { ...base, action: "insufficient-shares" };
  }

  if (!confirmed) {
    return {
      ...base,
      action: "skipped-not-confirmed",
      groupPublicKeyHex: meta.groupPublicKeyHex,
    };
  }

  const biometric = await requireBiometric(
    opts.biometricAuth,
    `Approve: frost-sign OpenSSH cert for machine ${opts.machineId} (principals=${opts.users.join(",")})`,
  );
  if (!biometric.ok) {
    return { ...base, dryRun: false, action: "skipped-biometric", biometric };
  }

  let shares: FrostKeyShare[];
  try {
    shares = loadShares(fx, sharesDir, indices.slice(0, meta.threshold));
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : String(e));
    return { ...base, dryRun: false, action: "failed", warnings };
  }

  const devicePubLine = fx.readText(opts.devicePubPath).trim();
  let devicePublicKey: Uint8Array;
  try {
    devicePublicKey = parseSshEd25519PublicKeyLine(devicePubLine);
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : String(e));
    return { ...base, dryRun: false, action: "failed", warnings };
  }

  const issuedAt = opts.issuedAt ?? new Date().toISOString();
  const validity = opts.validity ?? "+52w";
  const groupPublicKey = hexToBytes(meta.groupPublicKeyHex);
  const window = parseValidityWindow(validity);

  // OpenSSH PROTOCOL.certkeys — signable prefix, frost partials, finalize.
  const { signable } = buildEd25519UserCertSignable({
    devicePublicKey,
    caPublicKey: groupPublicKey,
    keyId: opts.machineId,
    principals: opts.users,
    validAfter: window.validAfter,
    validBefore: window.validBefore,
  });
  const certSig = frostThresholdSign(groupPublicKey, shares, signable, undefined, meta.threshold);
  if (!frostVerify(groupPublicKey, signable, certSig)) {
    warnings.push("frost OpenSSH cert signature failed self-verify");
    return { ...base, dryRun: false, action: "failed", warnings };
  }
  const certBlob = finalizeEd25519UserCert(signable, certSig);
  const certText = formatSshEd25519CertLine(certBlob, opts.machineId);
  fx.mkdirp(dirname(openSshCertPath));
  fx.writeText(openSshCertPath, certText, 0o644);

  // Zeta-native attestation (audit / non-sshd consumers) — same principals binding.
  const unsigned: Omit<FrostDeviceAttestationV1, "signatureHex"> = {
    schema: FROST_ATTESTATION_SCHEMA,
    ca: opts.ca,
    machineId: opts.machineId,
    principals: opts.users,
    devicePub: devicePubLine,
    validity,
    issuedAt,
    groupPublicKeyHex: meta.groupPublicKeyHex,
  };
  const attMsg = attestationMessage(unsigned);
  const attSig = frostThresholdSign(groupPublicKey, shares, attMsg, undefined, meta.threshold);
  const attestation: FrostDeviceAttestationV1 = {
    ...unsigned,
    signatureHex: bytesToHex(attSig),
  };
  fx.mkdirp(dirname(attestationPath));
  fx.writeText(attestationPath, JSON.stringify(attestation, null, 2) + "\n", 0o644);

  return {
    ...base,
    dryRun: false,
    action: "signed",
    groupPublicKeyHex: meta.groupPublicKeyHex,
    attestation,
    certText,
    biometric,
    warnings,
  };
}

export function formatEnsureFrostCa(res: EnsureFrostCaResult): string {
  const lines = [
    `action=${res.action} ca=${res.ca} frost=${res.threshold}-of-${res.totalShares}`,
    `sharesDir=${res.sharesDir}`,
    `groupPublicKeyPath=${res.groupPublicKeyPath}`,
  ];
  if (res.groupPublicKeyHex !== undefined) {
    lines.push(`groupPublicKeyHex=${res.groupPublicKeyHex}`);
  }
  if (res.committedPub) lines.push("wrote frost-ca.pub (PUBLIC — you commit it)");
  if (res.biometric !== undefined) {
    lines.push(`biometric=${res.biometric.ok ? "ok" : "declined"}`);
  }
  return lines.join("\n");
}

export function formatSignFrostAttestation(res: SignFrostAttestationResult): string {
  const lines = [
    `action=${res.action}`,
    `certPath=${res.certPath}`,
    `attestationPath=${res.attestationPath}`,
  ];
  if (res.groupPublicKeyHex !== undefined) {
    lines.push(`groupPublicKeyHex=${res.groupPublicKeyHex}`);
  }
  for (const w of res.warnings) lines.push(`warning: ${w}`);
  if (res.biometric !== undefined) {
    lines.push(`biometric=${res.biometric.ok ? "ok" : "declined"}`);
  }
  return lines.join("\n");
}

export function realEffects(): FrostCaCustodyEffects {
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c, mode = 0o600) => {
      mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
      writeFileSync(p, c, { mode, encoding: "utf8" });
    },
    mkdirp: (p) => mkdirSync(p, { recursive: true, mode: 0o700 }),
    listFiles: (d) => readdirSync(d),
  };
}
