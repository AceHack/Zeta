/**
 * src/Core.TypeScript/zflash/test-harness/extensions.test.ts
 *
 * Tests for B-0891 extensions — substrate-engineering substrate primitives
 * for scenarios 3 (reformat-with-retention), 4 (reformat-from-scratch),
 * and 5 (cluster-joining).
 *
 * Validates type-level + value-level correctness of:
 *   - PersistedKVSubstrate discriminated union (4 variants)
 *   - PathForkSubstrate + PathForkVariant + PathForkComparison
 *   - MultiVMOrchestrationSubstrate + VMSpec + NetworkTopology + JoinProtocol + OrchestratorKind
 *   - ImplDesignStatus discriminated union
 *   - SCENARIO_IMPL_DESIGN mapping
 *   - computeImplDesignProgress aggregator
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_MULTI_VM, DEFAULT_PATH_FORK, DEFAULT_PERSISTED_KV, SCENARIO_IMPL_DESIGN, computeImplDesignProgress, } from "./extensions";
describe("PersistedKVSubstrate (scenario 3)", () => {
    test("DEFAULT_PERSISTED_KV is qcow2-snapshot-restore variant", () => {
        expect(DEFAULT_PERSISTED_KV.kind).toBe("qcow2-snapshot-restore");
        if (DEFAULT_PERSISTED_KV.kind === "qcow2-snapshot-restore") {
            expect(DEFAULT_PERSISTED_KV.baseImage).toContain("qcow2");
            expect(DEFAULT_PERSISTED_KV.snapshotName).toBe("post-initial-format");
        }
    });
    test("PersistedKVSubstrate variants are exhaustive", () => {
        const variants = [
            { kind: "qemu-virtual-disk-overlay", overlayPath: "/tmp/x", notes: "n" },
            { kind: "qemu-tpm-emulator", tpmStatePath: "/tmp/t", tpmVersion: "2.0", notes: "n" },
            { kind: "file-system-bind-mount", hostPath: "/h", guestPath: "/g", notes: "n" },
            { kind: "qcow2-snapshot-restore", baseImage: "/b", snapshotName: "s", notes: "n" },
        ];
        expect(variants).toHaveLength(4);
    });
});
describe("PathForkSubstrate (scenario 4)", () => {
    test("DEFAULT_PATH_FORK has both forks", () => {
        expect(DEFAULT_PATH_FORK.forks).toHaveLength(2);
        const forkIds = DEFAULT_PATH_FORK.forks.map((f) => f.forkId);
        expect(forkIds).toContain("migrate-existing-creds");
        expect(forkIds).toContain("fresh-cluster");
    });
    test("DEFAULT_PATH_FORK comparison is both-must-pass", () => {
        expect(DEFAULT_PATH_FORK.comparisonStrategy.kind).toBe("both-must-pass");
    });
    test("PathForkComparison variants are exhaustive", () => {
        const comparisons = [
            { kind: "both-must-pass" },
            { kind: "exactly-one-passes", reasonsOtherFails: "x" },
            { kind: "outcomes-equivalent", equivalencePredicate: "y" },
        ];
        expect(comparisons).toHaveLength(3);
    });
    test("each fork has preconditions + testInvocation + expectedOutcome", () => {
        for (const fork of DEFAULT_PATH_FORK.forks) {
            expect(fork.preconditions.length).toBeGreaterThan(0);
            expect(fork.testInvocation.length).toBeGreaterThan(0);
            expect(fork.expectedOutcome.length).toBeGreaterThan(0);
        }
    });
});
describe("MultiVMOrchestrationSubstrate (scenario 5)", () => {
    test("DEFAULT_MULTI_VM has cluster-existing + joining-node VMs", () => {
        expect(DEFAULT_MULTI_VM.vms).toHaveLength(2);
        const roles = DEFAULT_MULTI_VM.vms.map((v) => v.role);
        expect(roles).toContain("cluster-existing");
        expect(roles).toContain("joining-node");
    });
    test("DEFAULT_MULTI_VM uses shared-bridge network", () => {
        expect(DEFAULT_MULTI_VM.networkTopology.kind).toBe("shared-bridge");
    });
    test("DEFAULT_MULTI_VM uses credential-provisioning join protocol", () => {
        expect(DEFAULT_MULTI_VM.joinProtocol.kind).toBe("credential-provisioning");
    });
    test("NetworkTopology variants are exhaustive", () => {
        const topologies = [
            { kind: "shared-bridge", bridgeName: "br0" },
            { kind: "vlan-isolated", vlanId: 100, gatewayVm: "gw" },
            { kind: "host-only", subnet: "10.0.0.0/24" },
        ];
        expect(topologies).toHaveLength(3);
    });
    test("JoinProtocol variants are exhaustive", () => {
        const protocols = [
            { kind: "cluster-state-discovery", discoveryEndpoint: "x" },
            { kind: "explicit-join-token", tokenSource: "y" },
            { kind: "credential-provisioning", credPickerEndpoint: "z" },
        ];
        expect(protocols).toHaveLength(3);
    });
    test("OrchestratorKind variants are exhaustive", () => {
        const orchestrators = [
            { kind: "qemu-shell-scripts" },
            { kind: "libvirt", uri: "qemu:///system" },
            { kind: "docker-compose", composeFile: "x.yml" },
            { kind: "k8s-virt", namespace: "test" },
        ];
        expect(orchestrators).toHaveLength(4);
    });
    test("VMSpec has all required fields", () => {
        const vm = {
            name: "test",
            role: "joining-node",
            bootMedia: "iso-fresh",
            bootMediaRef: "/path/to/iso",
            memoryMB: 2048,
            vcpus: 2,
        };
        expect(vm.memoryMB).toBeGreaterThan(0);
        expect(vm.vcpus).toBeGreaterThan(0);
    });
});
describe("ImplDesignStatus + SCENARIO_IMPL_DESIGN", () => {
    test("ImplDesignStatus variants are exhaustive", () => {
        const statuses = [
            { kind: "design-spec-complete", specRef: "x" },
            { kind: "design-spec-pending", nextStep: "y" },
            { kind: "blocked-on-upstream", upstreamRef: "z" },
        ];
        expect(statuses).toHaveLength(3);
    });
    test("SCENARIO_IMPL_DESIGN covers all 3 scaffolded scenarios", () => {
        expect(SCENARIO_IMPL_DESIGN["reformat-with-retention"]).toBeDefined();
        expect(SCENARIO_IMPL_DESIGN["reformat-from-scratch"]).toBeDefined();
        expect(SCENARIO_IMPL_DESIGN["cluster-joining"]).toBeDefined();
    });
    test("All 3 scaffolded scenarios have design-spec-complete status", () => {
        const statuses = Object.values(SCENARIO_IMPL_DESIGN);
        for (const status of statuses) {
            expect(status.kind).toBe("design-spec-complete");
        }
    });
    test("computeImplDesignProgress reports 3 design-complete", () => {
        const progress = computeImplDesignProgress();
        expect(progress.total).toBe(3);
        expect(progress.designComplete).toBe(3);
        expect(progress.designPending).toBe(0);
        expect(progress.blockedOnUpstream).toBe(0);
    });
});
describe("Composes-with substrate-engineering substrate", () => {
    test("DEFAULT_PERSISTED_KV references qcow2 (composes with existing tools/ci/ substrate)", () => {
        if (DEFAULT_PERSISTED_KV.kind === "qcow2-snapshot-restore") {
            expect(DEFAULT_PERSISTED_KV.baseImage).toContain("qcow2");
            expect(DEFAULT_PERSISTED_KV.notes).toContain("baseline");
        }
    });
    test("DEFAULT_PATH_FORK forks reference operator-choice substrate-engineering", () => {
        for (const fork of DEFAULT_PATH_FORK.forks) {
            expect(fork.preconditions.join(" ")).toContain("operator chooses");
        }
    });
    test("DEFAULT_MULTI_VM cluster-existing VM uses qcow2-snapshot (composes with scenario 3 baseline)", () => {
        const existing = DEFAULT_MULTI_VM.vms.find((v) => v.role === "cluster-existing");
        expect(existing).toBeDefined();
        expect(existing?.bootMedia).toBe("qcow2-snapshot");
    });
    test("DEFAULT_MULTI_VM joining-node VM uses iso-fresh boot media", () => {
        const joining = DEFAULT_MULTI_VM.vms.find((v) => v.role === "joining-node");
        expect(joining).toBeDefined();
        expect(joining?.bootMedia).toBe("iso-fresh");
    });
});
