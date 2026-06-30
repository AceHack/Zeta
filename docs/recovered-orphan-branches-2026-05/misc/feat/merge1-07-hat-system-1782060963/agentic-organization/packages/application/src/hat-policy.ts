/**
 * HatPolicy — cluster-wide throttle defaults (singleton).
 *
 * Faithful port of
 * `full-ai-cluster/k8s/applications/hat-system/crds/hatpolicy.yaml` (Merge1 §07).
 * Per-Hat overrides live in `HatDefinition` (warmupSeconds / cooldownSeconds /
 * quorumSize / conflictsWithHatIds / maxConcurrentAssignments).
 */
export interface HatPolicy {
  readonly throttles: {
    readonly cooldownSeconds: number; // default 300
    readonly stickyAttributionSeconds: number; // default 600
    readonly warmupSeconds: number; // default 180
    readonly maxBindingsPerWearer: number; // default 3
    readonly maxNewHatsPerDay: number; // default 5
    readonly quorumDefaultSize: number; // default 3
  };
  readonly swapRetentionDays: number; // default 365
  readonly tickEmit: {
    readonly natsSubject: string; // default "zeta.society.hats.ticks"
    readonly enableLokiStructuredLogs: boolean; // default true
    readonly enableEvents: boolean; // default true
  };
}

export const DEFAULT_HAT_POLICY: HatPolicy = {
  throttles: {
    cooldownSeconds: 300,
    stickyAttributionSeconds: 600,
    warmupSeconds: 180,
    maxBindingsPerWearer: 3,
    maxNewHatsPerDay: 5,
    quorumDefaultSize: 3,
  },
  swapRetentionDays: 365,
  tickEmit: {
    natsSubject: "zeta.society.hats.ticks",
    enableLokiStructuredLogs: true,
    enableEvents: true,
  },
};
