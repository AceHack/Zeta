/**
 * src/Core.TypeScript/zflash/test-harness/extensions.ts
 *
 * B-0891 — substrate-engineering substrate primitives that extend the
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
/**
 * Default PersistedKVSubstrate for scenario 3 — qcow2 snapshot-restore
 * is the substrate-engineering canonical choice because:
 *   - works with QEMU out-of-box (no swtpm or 9p setup required)
 *   - byte-exact state preservation
 *   - composes with existing tools/ci/qemu-full-install-test.ts
 *     substrate-engineering substrate (qcow2 already used per ISO testing)
 */
export const DEFAULT_PERSISTED_KV = {
    kind: "qcow2-snapshot-restore",
    baseImage: "/tmp/zflash-test-baseline.qcow2",
    snapshotName: "post-initial-format",
    notes: "Baseline image created after scenario 1 (initial-format); reformat-with-retention scenarios snapshot-restore from this baseline + run reformat scenarios; restore-to-baseline between runs ensures clean state.",
};
/**
 * Default PathForkSubstrate for scenario 4.
 */
export const DEFAULT_PATH_FORK = {
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
            expectedOutcome: "new USB UUID + existing credential set; existing cluster recognizes new USB; cluster state preserved",
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
/**
 * Default MultiVMOrchestrationSubstrate for scenario 5.
 */
export const DEFAULT_MULTI_VM = {
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
    networkTopology: { kind: "shared-bridge", bridgeName: "zflash-test-br0" },
    joinProtocol: {
        kind: "credential-provisioning",
        credPickerEndpoint: "http://cluster-existing:8080/cred-pick",
    },
    orchestrator: { kind: "qemu-shell-scripts" },
};
/**
 * Per-scenario impl-design status mapping. Updated when impl-design work
 * progresses; scenarios.ts ImplStatus reflects RUNTIME state (can-run-now
 * vs scaffolded); this reflects DESIGN-SPEC state (design-spec-complete
 * vs design-spec-pending).
 */
export const SCENARIO_IMPL_DESIGN = {
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
        specRef: "extensions.ts MultiVMOrchestrationSubstrate + DEFAULT_MULTI_VM (shared-bridge + credential-provisioning)",
    },
};
/**
 * computeImplDesignProgress — returns how many scaffolded scenarios have
 * design-spec-complete status. Operationally useful for tracking
 * substrate-engineering progress.
 */
export function computeImplDesignProgress() {
    const statuses = Object.values(SCENARIO_IMPL_DESIGN);
    return {
        total: statuses.length,
        designComplete: statuses.filter((s) => s.kind === "design-spec-complete").length,
        designPending: statuses.filter((s) => s.kind === "design-spec-pending").length,
        blockedOnUpstream: statuses.filter((s) => s.kind === "blocked-on-upstream").length,
    };
}
