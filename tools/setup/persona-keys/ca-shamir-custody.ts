// Zeta CA Shamir custody — split/combine the LOCAL CA private key into k-of-n shares
// (081KVP3GYW108QG0R003V7E6VT custody slice). Cold-backup / disaster recovery only;
// live signing should prefer FROST/threshold-MPC (agent-native-key-custody design).
//
// SECURITY INVARIANTS (security-class — same discipline as rotate.ts / revoke.ts):
//  1. DEFAULT: dry-run — report what WOULD happen; touch nothing; never prompt.
//  2. REAL split/combine requires `--confirm` + ONE biometric approval (fail-closed).
//  3. Share files + reconstructed private keys stay LOCAL under ~/.config/zeta (never git/argv/stdout).
//  4. Share bytes and private key bytes NEVER cross this module's return values for logging.
//
// Pure math lives in shamir.ts; this module owns filesystem doors + metadata only.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { caPrivateKeyPath } from "./ca.ts";
import { requireBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
import { shamirCombine, shamirSplit, type ShamirShare } from "./shamir.ts";

export type { BiometricAuth, BiometricResult } from "./biometric.ts";

export const SHAMIR_SHARE_SCHEMA = "zeta-shamir-share-v1" as const;

export interface ShamirShareFileV1 {
  readonly schema: typeof SHAMIR_SHARE_SCHEMA;
  readonly ca: string;
  readonly label: string;
  readonly threshold: number;
  readonly totalShares: number;
  readonly x: number;
  readonly y: readonly number[];
}

export interface CaShamirCustodyEffects {
  readonly exists: (path: string) => boolean;
  readonly readBytes: (path: string) => Uint8Array;
  readonly writeText: (path: string, content: string, mode?: number) => void;
  readonly mkdirp: (path: string) => void;
  readonly listFiles?: (dir: string) => readonly string[];
}

export interface SplitCaShamirOptions {
  readonly ca: string;
  readonly home?: string;
  /** e.g. "2-of-3" */
  readonly shamir: string;
  /** Which local key to split (defaults to active CA private key). */
  readonly privateKeyPath?: string;
  readonly label?: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly biometricAuth?: BiometricAuth;
}

export interface SplitCaShamirResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly action:
    | "split"
    | "would-split"
    | "no-ca"
    | "skipped-not-confirmed"
    | "skipped-biometric"
    | "failed";
  readonly ca: string;
  readonly label: string;
  readonly threshold: number;
  readonly totalShares: number;
  readonly privateKeyPath: string;
  readonly sharesDir: string;
  readonly sharePaths: readonly string[];
  readonly warnings: readonly string[];
  readonly biometric?: BiometricResult;
}

export interface CombineCaShamirOptions {
  readonly ca: string;
  readonly home?: string;
  readonly threshold: number;
  /** Share indices x to load (e.g. [1, 3]); if omitted, load all share-*.json in sharesDir. */
  readonly shareIndices?: readonly number[];
  readonly sharesDir?: string;
  /** Where to write reconstructed private key (defaults to active CA path). */
  readonly outputPrivateKeyPath?: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly biometricAuth?: BiometricAuth;
}

export interface CombineCaShamirResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly action:
    | "combined"
    | "would-combine"
    | "insufficient-shares"
    | "skipped-not-confirmed"
    | "skipped-biometric"
    | "failed";
  readonly ca: string;
  readonly threshold: number;
  readonly sharesDir: string;
  readonly sharePaths: readonly string[];
  readonly outputPrivateKeyPath: string;
  readonly warnings: readonly string[];
  readonly biometric?: BiometricResult;
}

/** Parse `"2-of-3"` into `{ threshold: 2, shares: 3 }`. */
export function parseShamirSpec(spec: string): { threshold: number; shares: number } {
  const m = spec.trim().match(/^(\d+)-of-(\d+)$/);
  if (!m) {
    throw new Error(`shamir custody: invalid spec ${JSON.stringify(spec)} — want "k-of-n" (e.g. "2-of-3")`);
  }
  const threshold = Number(m[1]);
  const shares = Number(m[2]);
  if (!Number.isInteger(threshold) || !Number.isInteger(shares) || threshold < 1 || shares < threshold) {
    throw new Error("shamir custody: require 1 ≤ k ≤ n");
  }
  return { threshold, shares };
}

/** Local directory for Shamir share JSON files (never committed). */
export function caShamirSharesDir(home: string, ca: string): string {
  return join(home, ".config", "zeta", "ca", "shares", ca);
}

export function shareFilePath(sharesDir: string, x: number): string {
  return join(sharesDir, `share-${String(x).padStart(2, "0")}.json`);
}

function encodeShareFile(meta: Omit<ShamirShareFileV1, "schema">): string {
  const body: ShamirShareFileV1 = { schema: SHAMIR_SHARE_SCHEMA, ...meta };
  return JSON.stringify(body, null, 2) + "\n";
}

export function decodeShareFile(text: string): ShamirShareFileV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("shamir custody: share file is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("shamir custody: share file is not an object");
  }
  const o = parsed as Record<string, unknown>;
  if (o.schema !== SHAMIR_SHARE_SCHEMA) {
    throw new Error(`shamir custody: unsupported share schema ${JSON.stringify(o.schema)}`);
  }
  if (
    typeof o.ca !== "string" ||
    typeof o.label !== "string" ||
    typeof o.threshold !== "number" ||
    typeof o.totalShares !== "number" ||
    typeof o.x !== "number" ||
    !Array.isArray(o.y) ||
    !o.y.every((v) => typeof v === "number")
  ) {
    throw new Error("shamir custody: share file missing required fields");
  }
  return {
    schema: SHAMIR_SHARE_SCHEMA,
    ca: o.ca,
    label: o.label,
    threshold: o.threshold,
    totalShares: o.totalShares,
    x: o.x,
    y: o.y,
  };
}

function shareToMath(s: ShamirShareFileV1): ShamirShare {
  return { x: s.x, y: s.y };
}

function listShareFiles(fx: CaShamirCustodyEffects, sharesDir: string): string[] {
  const list = fx.listFiles ?? ((d) => readdirSync(d));
  if (!fx.exists(sharesDir)) return [];
  return list(sharesDir)
    .filter((f) => /^share-\d+\.json$/.test(f))
    .sort()
    .map((f) => join(sharesDir, f));
}

/** Split the local CA private key into n Shamir shares (k required to reconstruct). */
export async function splitCaToShares(
  fx: CaShamirCustodyEffects,
  opts: SplitCaShamirOptions,
): Promise<SplitCaShamirResult> {
  const dryRun = opts.dryRun ?? !opts.confirm;
  const confirmed = opts.confirm === true && !dryRun;
  const home = opts.home ?? homedir();
  const { threshold, shares: totalShares } = parseShamirSpec(opts.shamir);
  const privateKeyPath = opts.privateKeyPath ?? caPrivateKeyPath(home);
  const label = opts.label ?? "active";
  const sharesDir = caShamirSharesDir(home, opts.ca);
  const sharePaths = Array.from({ length: totalShares }, (_, i) => shareFilePath(sharesDir, i + 1));
  const warnings: string[] = [
    "ANY k shares reconstruct the full CA private key — protect each share like the key itself.",
    "Shares are LOCAL cold-backup only; distribute copies to distinct custodians out-of-band.",
    "Live signing without reassembly: use frost.ts (threshold Schnorr oracle) — not Shamir reassembly.",
  ];

  const base: SplitCaShamirResult = {
    dryRun,
    confirmed,
    action: dryRun ? "would-split" : "split",
    ca: opts.ca,
    label,
    threshold,
    totalShares,
    privateKeyPath,
    sharesDir,
    sharePaths,
    warnings,
  };

  if (!fx.exists(privateKeyPath)) {
    return { ...base, action: "no-ca" };
  }

  if (!confirmed) {
    return { ...base, action: "skipped-not-confirmed" };
  }

  const biometric = await requireBiometric(
    opts.biometricAuth,
    `Approve: split CA private key (${opts.shamir}) for ${opts.ca} → ${totalShares} share files`,
  );
  if (!biometric.ok) {
    return { ...base, dryRun: false, action: "skipped-biometric", biometric };
  }

  const secret = fx.readBytes(privateKeyPath);
  const mathShares = shamirSplit(secret, { threshold, shares: totalShares });
  fx.mkdirp(sharesDir);
  for (let i = 0; i < mathShares.length; i++) {
    const s = mathShares[i]!;
    const content = encodeShareFile({
      ca: opts.ca,
      label,
      threshold,
      totalShares,
      x: s.x,
      y: s.y,
    });
    fx.writeText(sharePaths[i]!, content, 0o600);
  }
  return { ...base, dryRun: false, action: "split", biometric };
}

/** Reconstruct the CA private key from k Shamir share files. */
export async function combineSharesToCa(
  fx: CaShamirCustodyEffects,
  opts: CombineCaShamirOptions,
): Promise<CombineCaShamirResult> {
  const dryRun = opts.dryRun ?? !opts.confirm;
  const confirmed = opts.confirm === true && !dryRun;
  const home = opts.home ?? homedir();
  const sharesDir = opts.sharesDir ?? caShamirSharesDir(home, opts.ca);
  const outputPrivateKeyPath = opts.outputPrivateKeyPath ?? caPrivateKeyPath(home);
  const warnings: string[] = [
    "Reconstructed CA private key is written locally only — never commit or print it.",
    "After recovery, re-run cert signing / rotate overlap checks before relying on the CA.",
  ];

  let sharePaths: string[];
  if (opts.shareIndices !== undefined && opts.shareIndices.length > 0) {
    sharePaths = opts.shareIndices.map((x) => shareFilePath(sharesDir, x));
  } else {
    sharePaths = listShareFiles(fx, sharesDir);
  }

  const base: CombineCaShamirResult = {
    dryRun,
    confirmed,
    action: dryRun ? "would-combine" : "combined",
    ca: opts.ca,
    threshold: opts.threshold,
    sharesDir,
    sharePaths,
    outputPrivateKeyPath,
    warnings,
  };

  if (sharePaths.length < opts.threshold) {
    return { ...base, action: "insufficient-shares" };
  }

  if (!confirmed) {
    return { ...base, action: "skipped-not-confirmed" };
  }

  const biometric = await requireBiometric(
    opts.biometricAuth,
    `Approve: reconstruct CA private key for ${opts.ca} from ${opts.threshold} shares`,
  );
  if (!biometric.ok) {
    return { ...base, dryRun: false, action: "skipped-biometric", biometric };
  }

  let decoded: ShamirShareFileV1[];
  try {
    decoded = sharePaths.slice(0, opts.threshold).map((p) => {
      if (!fx.exists(p)) throw new Error(`missing share at ${p}`);
      const text = new TextDecoder().decode(fx.readBytes(p));
      return decodeShareFile(text);
    });
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : String(e));
    return { ...base, dryRun: false, action: "failed", warnings };
  }

  const meta0 = decoded[0]!;
  for (const s of decoded) {
    if (s.ca !== meta0.ca || s.threshold !== meta0.threshold || s.y.length !== meta0.y.length) {
      warnings.push("share metadata mismatch — all shares must be from the same split");
      return { ...base, dryRun: false, action: "failed", warnings };
    }
  }
  if (meta0.threshold !== opts.threshold) {
    warnings.push(`expected threshold ${opts.threshold}, share files say ${meta0.threshold}`);
    return { ...base, dryRun: false, action: "failed", warnings };
  }

  const secret = shamirCombine(decoded.map(shareToMath), opts.threshold);
  fx.mkdirp(dirname(outputPrivateKeyPath));
  const outText = new TextDecoder().decode(secret);
  fx.writeText(outputPrivateKeyPath, outText, 0o600);
  return { ...base, dryRun: false, action: "combined", biometric };
}

export function formatSplitCaShamir(res: SplitCaShamirResult): string {
  const lines = [
    `action=${res.action} ca=${res.ca} label=${res.label} shamir=${res.threshold}-of-${res.totalShares}`,
    `privateKey=${res.privateKeyPath}`,
    `sharesDir=${res.sharesDir}`,
  ];
  if (res.sharePaths.length > 0) {
    lines.push("shareFiles:");
    for (const p of res.sharePaths) lines.push(`  ${p}`);
  }
  for (const w of res.warnings) lines.push(`warning: ${w}`);
  if (res.biometric !== undefined) lines.push(`biometric=${res.biometric.ok ? "ok" : "declined"}`);
  return lines.join("\n");
}

export function formatCombineCaShamir(res: CombineCaShamirResult): string {
  const lines = [
    `action=${res.action} ca=${res.ca} threshold=${res.threshold}`,
    `sharesDir=${res.sharesDir}`,
    `outputPrivateKey=${res.outputPrivateKeyPath}`,
  ];
  if (res.sharePaths.length > 0) {
    lines.push("shareFiles:");
    for (const p of res.sharePaths.slice(0, res.threshold)) lines.push(`  ${p}`);
  }
  for (const w of res.warnings) lines.push(`warning: ${w}`);
  if (res.biometric !== undefined) lines.push(`biometric=${res.biometric.ok ? "ok" : "declined"}`);
  return lines.join("\n");
}

/** Real host effects — reads/writes LOCAL secrets only under the operator's home. */
export function realEffects(): CaShamirCustodyEffects {
  return {
    exists: (p) => existsSync(p),
    readBytes: (p) => new Uint8Array(readFileSync(p)),
    writeText: (p, c, mode = 0o600) => {
      mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
      writeFileSync(p, c, { mode, encoding: "utf8" });
    },
    mkdirp: (p) => mkdirSync(p, { recursive: true, mode: 0o700 }),
    listFiles: (d) => readdirSync(d),
  };
}
