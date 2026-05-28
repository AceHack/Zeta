/**
 * tools/zflash/test-harness/scenarios.ts
 *
 * B-0891 — zflash "done" acceptance criteria + QEMU test harness
 *
 * Declarative definitions for the 5-scenario test matrix the operator
 * named as the acceptance criteria for zflash "done":
 *
 *   1. Initial format (USB-bake from zero)
 *   2. Initial boot + cluster comes up
 *   3. Reformat WITH key + selection retention
 *   4. Reformat from scratch (wipe + fresh keys)
 *   5. Cluster joining (new node)
 *
 * PoC scope: declarative scenario definitions + dispatcher contract +
 * status field for partial implementation. Scenarios 1 + 2 can compose
 * with existing `tools/ci/qemu-full-install-test.ts` (B-0831 Slice 1)
 * substrate today; scenarios 3-5 require state-preservation between QEMU
 * boots which the existing harness does not have — marked as
 * "scaffolded" pending implementation.
 *
 * Composes with:
 *   - tools/ci/qemu-full-install-test.ts (existing QEMU full-install starter)
 *   - tools/ci/qemu-boot-test.ts (cascade #5 boot smoke-test)
 *   - tools/ci/audit-installer-iso-content.ts (cascade #4 ISO content audit)
 *   - full-ai-cluster/tools/zflash-lib.ts (the zflash library under test)
 *   - docs/runbooks/zflash-end-to-end.md (operator-facing runbook)
 *   - docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md (CP-1..CP-6)
 *
 * Per .claude/rules/rule-0-no-sh-files.md (TS-first for cross-platform DST)
 * + .claude/rules/verify-existing-substrate-before-authoring.md (composes
 * with existing tools/ci/ substrate; does not duplicate).
 */

export type ScenarioId =
  | "initial-format"
  | "boot-cluster-up"
  | "reformat-with-retention"
  | "reformat-from-scratch"
  | "cluster-joining";

export type ImplStatus =
  | "composes-with-existing" // can run today via existing qemu-full-install-test.ts substrate
  | "scaffolded"             // declarative definition only; QEMU integration pending
  | "operator-runtime";       // requires physical USB OR operator-collaborative testing

export interface Scenario {
  readonly id: ScenarioId;
  readonly title: string;
  readonly orderIndex: number;
  readonly status: ImplStatus;
  readonly acceptanceCriteria: ReadonlyArray<string>;
  readonly composesWith: ReadonlyArray<string>;
  readonly gates: ReadonlyArray<ScenarioId>;
  readonly notes: string;
}

export const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    id: "initial-format",
    title: "Initial format (USB-bake from zero)",
    orderIndex: 1,
    status: "composes-with-existing",
    acceptanceCriteria: [
      "zflash script runs cleanly to completion",
      "produces bootable USB image with operator-chosen credentials baked in",
      "passes ISO content audit (tools/ci/audit-installer-iso-content.ts)",
      "QEMU boots the produced image to a usable state",
    ],
    composesWith: [
      "tools/ci/audit-installer-iso-content.ts",
      "tools/ci/qemu-boot-test.ts",
      "full-ai-cluster/tools/zflash.ts",
      "full-ai-cluster/tools/zflash-lib.ts",
    ],
    gates: ["boot-cluster-up"],
    notes:
      "Existing qemu-boot-test.ts performs the boot-to-usable-state check; existing audit-installer-iso-content.ts performs the content check. This scenario sequences them in one harness invocation.",
  },
  {
    id: "boot-cluster-up",
    title: "Initial boot + cluster comes up",
    orderIndex: 2,
    status: "composes-with-existing",
    acceptanceCriteria: [
      "USB boots in QEMU",
      "cluster nodes (mini-PC fleet per B-0590) come up successfully",
      "reach steady-state with all expected services running",
      "observability backend reports healthy",
    ],
    composesWith: [
      "tools/ci/qemu-full-install-test.ts",
      "B-0831 (CI cascade-6 cluster-auto-join)",
      "B-0590 (fleet replication 20 machines)",
    ],
    gates: ["reformat-with-retention", "cluster-joining"],
    notes:
      "qemu-full-install-test.ts already watches for [iter-5.1] marker proving nixos-install reached post-install phase. This scenario extends with cluster-auto-join verification per B-0831 Slice 2 (deferred to follow-up; PoC scaffolds the dispatcher contract).",
  },
  {
    id: "reformat-with-retention",
    title: "Reformat WITH key + selection retention",
    orderIndex: 3,
    status: "scaffolded",
    acceptanceCriteria: [
      "re-bake USB with existing operator-chosen credentials preserved",
      "Touch ID pairing per B-0737 preserved (no re-pair required)",
      "passphrase per B-0852 preserved (no re-enter required)",
      "UUID-bound keys preserved across re-bake",
      "existing cluster recognizes the re-baked USB",
    ],
    composesWith: [
      "B-0737 (Touch ID + PAM + ISO-auto-discovery)",
      "B-0852 (USB-bound credential substrate)",
      "B-0852.3 (cred-picker integration)",
    ],
    gates: ["reformat-from-scratch"],
    notes:
      "Requires state-preservation between QEMU boots (TPM-equivalent or persisted KV store on virtual disk). Existing qemu-full-install-test.ts does NOT have this; QEMU snapshot/restart logic deferred to follow-up. PoC defines the contract; implementation work pending.",
  },
  {
    id: "reformat-from-scratch",
    title: "Reformat from scratch (wipe + fresh keys)",
    orderIndex: 4,
    status: "scaffolded",
    acceptanceCriteria: [
      "wipe-and-rebake from zero state produces fresh keys + new USB UUID",
      "operator can choose path: migrate existing cluster's credentials to new USB",
      "operator can choose path: start fresh cluster with new keys",
      "both paths supported + tested",
    ],
    composesWith: [
      "B-0737 (Touch ID + PAM)",
      "B-0852 (USB-bound credential substrate)",
      "B-0884 (PQ git-crypt + zflash integration — future PQ-credential path)",
    ],
    gates: ["cluster-joining"],
    notes:
      "Dual-path test: same starting state, two operator choices. Requires test-harness path-fork support. PoC defines the contract.",
  },
  {
    id: "cluster-joining",
    title: "Cluster joining (new node)",
    orderIndex: 5,
    status: "scaffolded",
    acceptanceCriteria: [
      "new node boots from USB",
      "joins existing running cluster cleanly",
      "gets credentials provisioned per B-0852.3 cred-picker integration",
      "appears in cluster state within bounded time",
    ],
    composesWith: [
      "B-0831 (CI cascade-6 cluster-auto-join)",
      "B-0852.3 (cred-picker integration)",
      "B-0590 (fleet replication 20 machines)",
      "B-0889 (symbiotic cross-track self-healing)",
    ],
    gates: [],
    notes:
      "Requires multi-VM QEMU orchestration (one existing cluster VM + one joining VM). Existing harness is single-VM; multi-VM orchestration deferred to follow-up. PoC defines the contract.",
  },
];

/**
 * Lookup helper — find scenario by id.
 */
export function findScenario(id: ScenarioId): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/**
 * Validate scenario definitions at harness-init time. Invariants:
 *  - exactly 5 scenarios (per operator-named matrix)
 *  - ids are unique
 *  - orderIndex values are 1..5 unique
 *  - gates only reference defined ids
 *
 * Thrown invariants would indicate the matrix is broken — fail fast.
 */
export function validateScenarios(scenarios: ReadonlyArray<Scenario>): void {
  if (scenarios.length !== 5) {
    throw new Error(
      `expected exactly 5 scenarios per B-0891 matrix; got ${scenarios.length}`,
    );
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const s of scenarios) {
    if (ids.has(s.id)) {
      throw new Error(`duplicate scenario id: ${s.id}`);
    }
    ids.add(s.id);
    if (s.orderIndex < 1 || s.orderIndex > 5) {
      throw new Error(`scenario ${s.id} orderIndex out of range: ${s.orderIndex}`);
    }
    if (orders.has(s.orderIndex)) {
      throw new Error(`duplicate orderIndex: ${s.orderIndex}`);
    }
    orders.add(s.orderIndex);
  }
  for (const s of scenarios) {
    for (const gate of s.gates) {
      if (!ids.has(gate)) {
        throw new Error(`scenario ${s.id} gates unknown scenario: ${gate}`);
      }
    }
  }
}
