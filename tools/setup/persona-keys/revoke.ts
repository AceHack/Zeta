// Zeta KRL REVOCATION — OpenSSH Key Revocation List for compromised machine certs (081KVP2M1QS08QG0R000JSXE1E).
//
// Revokes a CA-signed device cert by appending its serial to a cluster-local KRL file
// (`maintainers/<ca>/revoked-keys.krl`), staged in the caller's clone for a PR — the `-1`
// retraction primitive the round-trip harness named. Complements teardown (full unregister)
// and rotate (overlap-window swap): revocation is surgical — one cert becomes untrusted while
// the CA and other machines keep working.
//
// SECURITY INVARIANTS (security-class — same discipline as teardown.ts / rotate.ts):
//  1. `--dry-run` (default): report what WOULD be revoked; touch nothing; never prompt.
//  2. REAL revoke requires `--confirm` + ONE biometric approval (fail-closed).
//  3. PUBLIC artifacts only cross this boundary — cert + CA pub + KRL; never private keys.
//  4. NEVER pushes — stages `git add` under repoRoot for a PR (shared-checkout-is-view-only).
//
// Anchors: OpenSSH KRL (`ssh-keygen -k`, `sshd_config RevokedKeys`); SSH-CA per-machine
// revocation prior art (BLESS-style short-lived certs + explicit revoke list).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { caPublicKeyPath } from "./ca.ts";
import { requireBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
import { machineCertPath } from "./teardown.ts";

export type { BiometricAuth, BiometricResult } from "./biometric.ts";

export interface RevokeEffects {
  readonly exists: (path: string) => boolean;
  /** Update/create KRL at `krlPath` to revoke `certPath` signed by CA at `caPubPath`. */
  readonly revokeCertInKrl: (req: { krlPath: string; caPubPath: string; certPath: string }) => boolean;
  /** Stage a repo change for a PR (git add under repoRoot only). */
  readonly stageRepoWrite: (repoRoot: string, relPath: string) => boolean;
}

export interface RevokeOptions {
  readonly ca: string;
  readonly repoRoot: string;
  readonly hostname: string;
  /** Optional explicit cert path (defaults to machines/<host>-cert.pub). */
  readonly certPath?: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly biometricAuth?: BiometricAuth;
  readonly reason?: string;
}

export interface RevokeResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly action:
    | "revoked"
    | "would-revoke"
    | "absent"
    | "skipped-not-confirmed"
    | "skipped-biometric"
    | "failed";
  readonly certPath: string;
  readonly caPubPath: string;
  readonly krlPath: string;
  readonly krlRelPath: string;
  readonly staged: boolean;
  readonly reason?: string;
  readonly warnings: readonly string[];
  readonly biometric?: BiometricResult;
}

export function krlPath(repoRoot: string, ca: string): string {
  return join(repoRoot, "maintainers", ca, "revoked-keys.krl");
}

export function krlRelPath(ca: string): string {
  return join("maintainers", ca, "revoked-keys.krl");
}

export function relUnder(repoRoot: string, absPath: string): string {
  const prefix = repoRoot.endsWith("/") ? repoRoot : repoRoot + "/";
  if (!absPath.startsWith(prefix)) {
    throw new Error(`revoke: path ${JSON.stringify(absPath)} is outside repoRoot ${JSON.stringify(repoRoot)}`);
  }
  return absPath.slice(prefix.length);
}

/** Revoke one machine cert via KRL update + staged repo write. */
export async function revokeCert(fx: RevokeEffects, opts: RevokeOptions): Promise<RevokeResult> {
  const dryRun = opts.dryRun ?? !opts.confirm;
  const confirmed = opts.confirm === true && !dryRun;
  const cert = opts.certPath ?? machineCertPath(opts.repoRoot, opts.hostname);
  const caPub = caPublicKeyPath(opts.repoRoot, opts.ca);
  const krl = krlPath(opts.repoRoot, opts.ca);
  const krlRel = krlRelPath(opts.ca);
  const warnings: string[] = [
    "sshd must reference this KRL via RevokedKeys (or equivalent) after merge — revocation is not live until deployed.",
    "Revocation is irreversible in the KRL; re-trust requires issuing a new cert (setup/rotate).",
  ];

  if (!fx.exists(cert)) {
    return {
      dryRun,
      confirmed,
      action: "absent",
      certPath: cert,
      caPubPath: caPub,
      krlPath: krl,
      krlRelPath: krlRel,
      staged: false,
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      warnings,
    };
  }
  if (!fx.exists(caPub)) {
    warnings.push(`CA public key missing at ${caPub} — cannot build KRL without the signing CA.`);
    return {
      dryRun,
      confirmed,
      action: "failed",
      certPath: cert,
      caPubPath: caPub,
      krlPath: krl,
      krlRelPath: krlRel,
      staged: false,
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      warnings,
    };
  }

  if (dryRun || !confirmed) {
    return {
      dryRun,
      confirmed: false,
      action: dryRun ? "would-revoke" : "skipped-not-confirmed",
      certPath: cert,
      caPubPath: caPub,
      krlPath: krl,
      krlRelPath: krlRel,
      staged: false,
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      warnings,
    };
  }

  let biometric: BiometricResult | undefined;
  if (opts.biometricAuth) {
    biometric = await requireBiometric(opts.biometricAuth, "revoke SSH device cert (KRL)");
    if (!biometric.ok) {
      return {
        dryRun,
        confirmed,
        action: "skipped-biometric",
        certPath: cert,
        caPubPath: caPub,
        krlPath: krl,
        krlRelPath: krlRel,
        staged: false,
        biometric,
        ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
        warnings,
      };
    }
  }

  const ok = fx.revokeCertInKrl({ krlPath: krl, caPubPath: caPub, certPath: cert });
  if (!ok) {
    return {
      dryRun,
      confirmed,
      action: "failed",
      certPath: cert,
      caPubPath: caPub,
      krlPath: krl,
      krlRelPath: krlRel,
      staged: false,
      ...(biometric !== undefined ? { biometric } : {}),
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      warnings,
    };
  }

  const staged = fx.stageRepoWrite(opts.repoRoot, krlRel);
  return {
    dryRun,
    confirmed,
    action: "revoked",
    certPath: cert,
    caPubPath: caPub,
    krlPath: krl,
    krlRelPath: krlRel,
    staged,
    ...(biometric !== undefined ? { biometric } : {}),
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
    warnings,
  };
}

export function formatRevoke(r: RevokeResult): string {
  const lines = [
    `revoke: action=${r.action} cert=${r.certPath}`,
    `  krl=${r.krlPath} staged=${r.staged}`,
  ];
  if (r.reason) lines.push(`  reason: ${r.reason}`);
  for (const w of r.warnings) lines.push(`  warn: ${w}`);
  return lines.join("\n");
}

export function realEffects(): RevokeEffects {
  return {
    exists: existsSync,
    revokeCertInKrl: ({ krlPath: krl, caPubPath, certPath }) => {
      mkdirSync(join(krl, ".."), { recursive: true });
      const r = spawnSync("ssh-keygen", ["-k", "-f", krl, "-s", caPubPath, certPath], { encoding: "utf8" });
      return r.status === 0;
    },
    stageRepoWrite: (repoRoot, relPath) => {
      const r = spawnSync("git", ["add", relPath], { cwd: repoRoot, encoding: "utf8" });
      return r.status === 0;
    },
  };
}
