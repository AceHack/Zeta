/**
 * src/Core.TypeScript/zflash/test-harness/extensions.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ — substrate-engineering substrate primitives that extend the
 * scaffolded scenarios (3, 4, 5) from "blocked-on-X" status to
 * "impl-design-spec'd" with concrete typed primitives.
 *
 * Composes with the typestate-DU substrate cluster shipped today:
 *   - asymmetric-authorship rule (PR #5516): each substrate-entity
 *     AUTHORS its consent-channel via TFeedback variants
 *   - monad-propagation-pattern rule (PR #5511): cross-language Result<T,
 *     TFeedback> shape
 *   - IMPLICIT-NOT-EXPLICIT rule (PR #5811): every substrate-class gets
 *     explicit DU variant
 *   - particle-as-locus rule (PR #5846): every substrate carries
 *     (wavefunction-substrate, particle-locus) pair; primitives here
 *     define the wavefunction-substrate; runtime values are particle-loci
 *   - parallelizability-test rule (PR #5845): each primitive defined
 *     INDEPENDENTLY for visualizable + parallelizable navigation
 *
 * Substrate-engineering scope: this file SPECS the impl-design primitives.
 * Runtime QEMU integration (actually persisting state across boots,
 * forking test paths, orchestrating multi-VM) remains pending — but the
 * substrate-engineering substrate-shape is now substantively-defined +
 * composable + testable at type-level.
 */

// =============================================================================
// SCENARIO 3 — reformat-with-retention: state-preservation primitive substrate
// =============================================================================

/**
 * PersistedKVSubstrate — discriminated union of state-preservation
 * mechanisms suitable for QEMU test-harness use. Each variant represents
 * a distinct substrate-engineering substrate for preserving credentials +
 * keys + auth state across QEMU boot cycles.
 *
 * Per IMPLICIT-NOT-EXPLICIT rule: each variant is explicit; the
 * substrate-engineering choice between variants is operator-explicit at
 * test-configuration time (not implicit defaulting).
 */
export type PersistedKVSubstrate =
  | {
      readonly kind: "qemu-virtual-disk-overlay";
      readonly overlayPath: string;
      readonly notes: string;
    }
  | {
      readonly kind: "qemu-tpm-emulator";
      readonly tpmStatePath: string;
      readonly tpmVersion: "1.2" | "2.0";
      readonly notes: string;
    }
  | {
      readonly kind: "file-system-bind-mount";
      readonly hostPath: string;
      readonly guestPath: string;
      readonly notes: string;
    }
  | {
      readonly kind: "qcow2-snapshot-restore";
      readonly baseImage: string;
      readonly snapshotName: string;
      readonly notes: string;
    };

/**
 * Default PersistedKVSubstrate for scenario 3 — qcow2 snapshot-restore
 * is the substrate-engineering canonical choice because:
 *   - works with QEMU out-of-box (no swtpm or 9p setup required)
 *   - byte-exact state preservation
 *   - composes with existing tools/ci/qemu-full-install-test.ts
 *     substrate-engineering substrate (qcow2 already used per ISO testing)
 */
export const DEFAULT_PERSISTED_KV: PersistedKVSubstrate = {
  kind: "qcow2-snapshot-restore",
  baseImage: "/tmp/zflash-test-baseline.qcow2",
  snapshotName: "post-initial-format",
  notes:
    "Baseline image created after scenario 1 (initial-format); reformat-with-retention scenarios snapshot-restore from this baseline + run reformat scenarios; restore-to-baseline between runs ensures clean state.",
};

// =============================================================================
// SCENARIO 4 — reformat-from-scratch: path-fork substrate
// =============================================================================

/**
 * PathForkSubstrate — discriminated union of path-fork mechanisms for
 * scenarios that test SAME-starting-state-DIFFERENT-operator-choice.
 *
 * Per asymmetric-authorship rule: operator AUTHORS the path-choice
 * substrate at test-configuration time; test-harness ACKNOWLEDGES by
 * running both paths from same starting state + comparing outcomes.
 */
export type PathForkSubstrate = {
  readonly startingStateRef: string; // qcow2 snapshot OR ISO path
  readonly forks: ReadonlyArray<PathForkVariant>;
  readonly comparisonStrategy: PathForkComparison;
};

export type PathForkVariant = {
  readonly forkName: string;
  readonly forkId: "migrate-existing-creds" | "fresh-cluster";
  readonly preconditions: ReadonlyArray<string>;
  readonly testInvocation: string;
  readonly expectedOutcome: string;
};

export type PathForkComparison =
  | { kind: "both-must-pass" } // both forks pass independently
  | { kind: "exactly-one-passes"; reasonsOtherFails: string } // only one valid given starting state
  | { kind: "outcomes-equivalent"; equivalencePredicate: string }; // both reach same end-state via different path

/**
 * Default PathForkSubstrate for scenario 4.
 */
export const DEFAULT_PATH_FORK: PathForkSubstrate = {
  startingStateRef: "/tmp/zflash-test-baseline.qcow2", // baseline from scenario 1
  forks: [
    {
      forkName: "migrate-existing-credentials-to-new-USB",
      forkId: "migrate-existing-creds",
      preconditions: [
        "existing cluster running with credentials (scenario 2 success)",
        "operator chooses migrate path at zflash invocation",
      ],
      testInvocation: "zflash --reformat --migrate-credentials --existing-cluster <baseline-snapshot>",
      expectedOutcome:
        "new USB UUID + existing credential set; existing cluster recognizes new USB; cluster state preserved",
    },
    {
      forkName: "start-fresh-cluster-with-new-keys",
      forkId: "fresh-cluster",
      preconditions: [
        "operator chooses fresh path at zflash invocation",
        "no migration of existing cluster credentials",
      ],
      testInvocation: "zflash --reformat --fresh-cluster",
      expectedOutcome: "new USB UUID + new credentials + new cluster identity; old cluster orphaned (operator-aware)",
    },
  ],
  comparisonStrategy: { kind: "both-must-pass" },
};

// =============================================================================
// SCENARIO 5 — cluster-joining: multi-VM orchestration substrate
// =============================================================================

/**
 * MultiVMOrchestrationSubstrate — discriminated union of multi-VM
 * coordination substrate for scenarios that test cluster joining.
 *
 * Per particle-as-locus rule: each VM is a particle-locus in the
 * cluster-substrate wavefunction; the orchestration substrate defines
 * how multiple loci coordinate (network topology + join-protocol).
 */
export type MultiVMOrchestrationSubstrate = {
  readonly vms: ReadonlyArray<VMSpec>;
  readonly networkTopology: NetworkTopology;
  readonly joinProtocol: JoinProtocol;
  readonly orchestrator: OrchestratorKind;
};

export type VMSpec = {
  readonly name: string;
  readonly role: "cluster-existing" | "joining-node";
  readonly bootMedia: "qcow2-snapshot" | "iso-fresh";
  readonly bootMediaRef: string;
  readonly memoryMB: number;
  readonly vcpus: number;
};

export type NetworkTopology =
  | { kind: "shared-bridge"; bridgeName: string }
  | { kind: "shared-socket-segment"; host: string; port: number }
  | { kind: "vlan-isolated"; vlanId: number; gatewayVm: string }
  | { kind: "host-only"; subnet: string };

export type JoinProtocol =
  | { kind: "cluster-state-discovery"; discoveryEndpoint: string }
  | { kind: "explicit-join-token"; tokenSource: string }
  | { kind: "credential-provisioning"; credPickerEndpoint: string };

export type OrchestratorKind =
  | { kind: "qemu-shell-scripts" } // PoC: bash spawning qemu-system-x86_64 processes
  | { kind: "libvirt"; uri: string } // libvirt for cleaner lifecycle management
  | { kind: "docker-compose"; composeFile: string } // dockerized QEMU for CI portability
  | { kind: "k8s-virt"; namespace: string }; // KubeVirt for cluster-scale parallel testing

/**
 * Default MultiVMOrchestrationSubstrate for scenario 5.
 */
export const DEFAULT_MULTI_VM: MultiVMOrchestrationSubstrate = {
  vms: [
    {
      name: "cluster-existing",
      role: "cluster-existing",
      bootMedia: "qcow2-snapshot",
      bootMediaRef: "/tmp/zflash-test-baseline.qcow2",
      memoryMB: 2048,
      vcpus: 2,
    },
    {
      name: "joining-node",
      role: "joining-node",
      bootMedia: "iso-fresh",
      bootMediaRef: "<iso-path-from-cli>",
      memoryMB: 2048,
      vcpus: 2,
    },
  ],
  // Was `{ kind: "shared-bridge", bridgeName: "zflash-test-br0" }` -- a
  // topology no emitted argument implemented and no hosted runner could
  // deliver, because creating a bridge needs root on the host. A QEMU-to-QEMU
  // socket segment carries the same L2 frames with no root, no tap device and
  // no host configuration, so this is the topology the harness can actually
  // build. The port is the rendezvous both VMs name; see buildQemuNetworkDeviceArgs.
  networkTopology: { kind: "shared-socket-segment", host: "127.0.0.1", port: 21084 },
  // k3s's join is the join (Aaron 2026-08-13, closing the open question on
  // PR #10493: "k3s's join is the join, don't invent our own").
  //
  // This was `credential-provisioning` pointing at an
  // http://cluster-existing:8080/cred-pick endpoint — a Zeta-owned join
  // protocol that does not exist and, per that decision, is not going to be
  // built. Leaving it would keep the design substrate describing a handshake
  // nobody is implementing, which is how a spec starts lying about the system
  // it claims to describe. `explicit-join-token` was already in the
  // JoinProtocol union and is literally what happens: the founding server's
  // `--cluster-init` generates the token at this path and a worker copies it
  // to /var/lib/rancher/k3s/agent/token. See nixos/modules/k3s-server.nix for
  // the generation and nixos/tests/k3s-agent-join.nix, which performs exactly
  // this hand-off between two real nodes.
  joinProtocol: {
    kind: "explicit-join-token",
    tokenSource: "/var/lib/rancher/k3s/server/node-token",
  },
  orchestrator: { kind: "qemu-shell-scripts" },
};

// =============================================================================
// IMPLEMENTATION-DESIGN STATUS — moves scenarios 3/4/5 forward
// =============================================================================

/**
 * ImplDesignStatus — discriminated union tracking impl-design completeness
 * per scenario. Distinct from runtime ImplStatus (composes-with-existing /
 * scaffolded / operator-runtime) in scenarios.ts.
 *
 * Per IMPLICIT-NOT-EXPLICIT rule: design-completeness is EXPLICIT;
 * scaffolded scenarios get a sharper status reflecting impl-design work.
 */
export type ImplDesignStatus =
  | { kind: "design-spec-complete"; specRef: string } // primitives defined; QEMU integration spec'd
  | { kind: "design-spec-pending"; nextStep: string } // primitives need defining
  | { kind: "blocked-on-upstream"; upstreamRef: string }; // depends on something not yet ready

/**
 * Per-scenario impl-design status mapping. Updated when impl-design work
 * progresses; scenarios.ts ImplStatus reflects RUNTIME state (can-run-now
 * vs scaffolded); this reflects DESIGN-SPEC state (design-spec-complete
 * vs design-spec-pending).
 */
export const SCENARIO_IMPL_DESIGN: Record<
  "reformat-with-retention" | "reformat-from-scratch" | "cluster-joining",
  ImplDesignStatus
> = {
  "reformat-with-retention": {
    kind: "design-spec-complete",
    specRef: "extensions.ts PersistedKVSubstrate + DEFAULT_PERSISTED_KV (qcow2 snapshot-restore)",
  },
  "reformat-from-scratch": {
    kind: "design-spec-complete",
    specRef: "extensions.ts PathForkSubstrate + DEFAULT_PATH_FORK (migrate-creds + fresh-cluster forks)",
  },
  "cluster-joining": {
    kind: "design-spec-complete",
    specRef: "extensions.ts MultiVMOrchestrationSubstrate + DEFAULT_MULTI_VM (shared-bridge + explicit-join-token)",
  },
};

/**
 * computeImplDesignProgress — returns how many scaffolded scenarios have
 * design-spec-complete status. Operationally useful for tracking
 * substrate-engineering progress.
 */
export function computeImplDesignProgress(): {
  readonly total: number;
  readonly designComplete: number;
  readonly designPending: number;
  readonly blockedOnUpstream: number;
} {
  const statuses = Object.values(SCENARIO_IMPL_DESIGN);
  return {
    total: statuses.length,
    designComplete: statuses.filter((s) => s.kind === "design-spec-complete").length,
    designPending: statuses.filter((s) => s.kind === "design-spec-pending").length,
    blockedOnUpstream: statuses.filter((s) => s.kind === "blocked-on-upstream").length,
  };
}
