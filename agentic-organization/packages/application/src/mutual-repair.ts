/**
 * Mutual repair — port of the mutual-repair concept in
 * `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` (Merge1 §09).
 *
 * ≥3 vendor-diverse AI agents can fix each other AND the cluster when it is
 * down. Vendor diversity provides outage resilience AND self-modification safety
 * (a ≥3 floor gives a BFT margin when one vendor update breaks ≥1 agent). When a
 * room detects a peer is unhealthy it can attempt repair via `MutualRepairPort`;
 * the BFT quorum stops a single broken agent from cascading.
 *
 * The port is a seam (MP-2): a real adapter would shell to systemd / kubectl; the
 * mock is in-process + deterministic for DST (MP-1). Outcomes are Result-shaped
 * discriminated unions (MP-7), never thrown.
 */

export type HealthStatus =
  | { readonly healthy: true; readonly lastTickAt: string }
  | { readonly healthy: false; readonly reason: string; readonly lastTickAt?: string };

export type RepairResult =
  | { readonly outcome: "repaired"; readonly action: string }
  | { readonly outcome: "repair_failed"; readonly reason: string }
  | { readonly outcome: "peer_not_found"; readonly peerRoomId: string };

export interface MutualRepairPort {
  /** Check whether a peer room is healthy. */
  checkPeerHealth(peerRoomId: string): Promise<HealthStatus>;
  /** Attempt to repair a peer room (restart its agent, fix its config). */
  repairPeer(peerRoomId: string): Promise<RepairResult>;
  /** Attempt to repair the cluster from outside the failure domain. */
  repairCluster(): Promise<RepairResult>;
}

/** BFT quorum: at least 3 healthy peers needed before attempting mutual repair. */
export const MIN_PEERS_FOR_BFT = 3;

/** Can we attempt mutual repair? Need ≥3 healthy peers (BFT margin). */
export function canAttemptRepair(healthStatuses: readonly HealthStatus[]): boolean {
  return countHealthy(healthStatuses) >= MIN_PEERS_FOR_BFT;
}

/** Number of healthy peers in a set of statuses. */
export function countHealthy(healthStatuses: readonly HealthStatus[]): number {
  return healthStatuses.filter((s) => s.healthy).length;
}

export type MockMutualRepairOptions = {
  /** Peer rooms considered healthy; everything else is reported unhealthy. */
  readonly healthyPeers?: readonly string[];
  /** Peers known to the federation (unknown peers → peer_not_found). */
  readonly knownPeers?: readonly string[];
  /** Whether a repair attempt succeeds. */
  readonly repairSucceeds?: boolean;
  /** Whether a cluster repair attempt succeeds. */
  readonly clusterRepairSucceeds?: boolean;
  /** Fixed timestamp for deterministic health reports. */
  readonly nowIso?: string;
};

/** Deterministic in-process mutual-repair adapter for DST. */
export function createMockMutualRepair(options: MockMutualRepairOptions = {}): MutualRepairPort {
  const healthy = new Set(options.healthyPeers ?? []);
  const known = new Set(options.knownPeers ?? options.healthyPeers ?? []);
  const repairSucceeds = options.repairSucceeds ?? true;
  const clusterRepairSucceeds = options.clusterRepairSucceeds ?? true;
  const nowIso = options.nowIso ?? "2026-01-01T00:00:00.000Z";
  return {
    checkPeerHealth(peerRoomId: string): Promise<HealthStatus> {
      return Promise.resolve(
        healthy.has(peerRoomId)
          ? { healthy: true, lastTickAt: nowIso }
          : { healthy: false, reason: "no recent tick", lastTickAt: nowIso },
      );
    },
    repairPeer(peerRoomId: string): Promise<RepairResult> {
      if (!known.has(peerRoomId)) {
        return Promise.resolve({ outcome: "peer_not_found", peerRoomId });
      }
      return Promise.resolve(
        repairSucceeds
          ? { outcome: "repaired", action: `restarted ${peerRoomId}` }
          : { outcome: "repair_failed", reason: "restart did not bring peer healthy" },
      );
    },
    repairCluster(): Promise<RepairResult> {
      return Promise.resolve(
        clusterRepairSucceeds
          ? { outcome: "repaired", action: "reconciled cluster from outside failure domain" }
          : { outcome: "repair_failed", reason: "cluster unreachable" },
      );
    },
  };
}
