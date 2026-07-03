// Zeta CLUSTER-TRUST-ROOT rotate — one command spanning cluster + machine scopes
// (deferred gap on 081KVP2M1QS08QG0R000JSXE1E). Thin orchestrator over rotate.ts:
// rotates the cluster CA on the overlap-window lifecycle WHILE preserving peer CAs
// in TrustedUserCAKeys, and optionally rotates machine-key + device-cert in the
// same one-fingerprint session.
//
// WHY a separate entry (not only `rotate --ports ca-key`):
//   1. Cluster scope is the trust ROOT (setup-cluster / teardown-cluster pair) —
//      operators need a named cluster-level rotate, not a port flag.
//   2. Peer preservation is load-bearing for federation; this surface asserts it.
//   3. Default ports = ca-key + machine-key + device-cert (full span); override
//      with --ports when only the trust root should move.
//
// SECURITY: same discipline as rotate.ts / setup-cluster.ts — dry-run default,
// --confirm + one biometric, PUBLIC artifacts only staged, never push.
import {
  parseTrustSetPeers,
  trustedUserCaKeysPath,
} from "./setup-cluster.ts";
import {
  ROTATE_PORTS,
  formatRotate,
  rotate,
  type RotateEffects,
  type RotateOptions,
  type RotatePort,
  type RotateResult,
} from "./rotate.ts";
import type { BiometricAuth } from "./biometric.ts";

export type { BiometricAuth } from "./biometric.ts";

/** Default ports for cluster-trust-root rotate: trust root + machine scopes. */
export const CLUSTER_ROTATE_PORTS: readonly RotatePort[] = ROTATE_PORTS;

export interface RotateClusterOptions {
  readonly ca: string;
  readonly user: string;
  readonly repoRoot: string;
  readonly home: string;
  readonly hostname: string;
  /** Defaults to all ports (ca-key + machine-key + device-cert). */
  readonly ports?: readonly RotatePort[];
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly biometricAuth?: BiometricAuth;
  readonly certValidity?: string;
}

export interface RotateClusterResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly ca: string;
  /** Peer CAs present in the trust set BEFORE rotate (preserved across CA rotation). */
  readonly peersBefore: readonly string[];
  /** Peer CAs present in the trust set AFTER rotate (must equal peersBefore on success). */
  readonly peersAfter: readonly string[];
  /** True iff every pre-rotate peer name is still present post-rotate. */
  readonly peersPreserved: boolean;
  readonly trustSetPath: string;
  readonly rotate: RotateResult;
}

/**
 * Rotate the cluster trust root (and optionally machine ports) in one fingerprint.
 * Peer CAs in TrustedUserCAKeys are preserved across CA-key rotation (rotate.ts).
 */
export async function rotateCluster(
  fx: RotateEffects,
  opts: RotateClusterOptions,
): Promise<RotateClusterResult> {
  const ports = opts.ports ?? CLUSTER_ROTATE_PORTS;
  const trustPath = trustedUserCaKeysPath(opts.repoRoot, opts.ca);
  const peersBefore = fx.exists(trustPath)
    ? parseTrustSetPeers(fx.readText(trustPath)).map((p) => p.name)
    : [];

  const rotateOpts: RotateOptions = {
    user: opts.user,
    ca: opts.ca,
    repoRoot: opts.repoRoot,
    home: opts.home,
    hostname: opts.hostname,
    ports,
    ...(opts.dryRun !== undefined ? { dryRun: opts.dryRun } : {}),
    ...(opts.confirm !== undefined ? { confirm: opts.confirm } : {}),
    ...(opts.biometricAuth !== undefined ? { biometricAuth: opts.biometricAuth } : {}),
    ...(opts.certValidity !== undefined ? { certValidity: opts.certValidity } : {}),
  };

  const rot = await rotate(fx, rotateOpts);

  const peersAfter =
    fx.exists(trustPath) && !rot.dryRun && rot.confirmed
      ? parseTrustSetPeers(fx.readText(trustPath)).map((p) => p.name)
      : peersBefore;
  const peersPreserved = peersBefore.every((n) => peersAfter.includes(n));

  return {
    dryRun: rot.dryRun,
    confirmed: rot.confirmed,
    ca: opts.ca,
    peersBefore,
    peersAfter,
    peersPreserved,
    trustSetPath: trustPath,
    rotate: rot,
  };
}

export function formatRotateCluster(res: RotateClusterResult): string {
  const lines: string[] = [
    res.dryRun
      ? `Zeta rotate-cluster — DRY RUN (cluster trust root; nothing touched)`
      : `Zeta rotate-cluster — ca=${res.ca}`,
    `trustSet=${res.trustSetPath}`,
    `peersBefore=${res.peersBefore.length === 0 ? "(none)" : res.peersBefore.join(",")}`,
    `peersAfter=${res.peersAfter.length === 0 ? "(none)" : res.peersAfter.join(",")}`,
    `peersPreserved=${res.peersPreserved ? "yes" : "NO — peer CA(s) dropped (bug)"}`,
    "",
    formatRotate(res.rotate),
  ];
  return lines.join("\n");
}
