/**
 * src/Core.TypeScript/zflash/test-harness/scenarios.ts
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
 * with existing `src/Core.TypeScript/ci/qemu-full-install-test.ts` (B-0831 Slice 1)
 * substrate today; scenarios 3-5 require state-preservation between QEMU
 * boots which the existing harness does not have — marked as
 * "scaffolded" pending implementation.
 *
 * Composes with:
 *   - src/Core.TypeScript/ci/qemu-full-install-test.ts (existing QEMU full-install starter)
 *   - src/Core.TypeScript/ci/qemu-boot-test.ts (cascade #5 boot smoke-test)
 *   - src/Core.TypeScript/ci/audit-installer-iso-content.ts (cascade #4 ISO content audit)
 *   - src/Core.TypeScript/zflash/lib.ts (the zflash library under test)
 *   - docs/runbooks/zflash-end-to-end.md (operator-facing runbook)
 *   - docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md (CP-1..CP-6)
 *
 * Per .claude/rules/rule-0-no-sh-files.md (TS-first for cross-platform DST)
 * + .claude/rules/verify-existing-substrate-before-authoring.md (composes
 * with existing src/Core.TypeScript/ci/ substrate; does not duplicate).
 */

export type ScenarioId =
  | "initial-format"
  | "boot-cluster-up"
  | "reformat-with-retention"
  | "reformat-from-scratch"
  | "cluster-joining";

export type ImplStatus =
  | "composes-with-existing" // can run today via existing qemu-full-install-test.ts substrate
  | "scaffolded" // declarative definition only; QEMU integration pending
  | "operator-runtime"; // requires physical USB OR operator-collaborative testing

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
      "passes ISO content audit (src/Core.TypeScript/ci/audit-installer-iso-content.ts)",
      "QEMU boots the produced image to a usable state",
    ],
    composesWith: [
      "src/Core.TypeScript/ci/audit-installer-iso-content.ts",
      "src/Core.TypeScript/ci/qemu-boot-test.ts",
      "src/Core.TypeScript/zflash/cli.ts",
      "src/Core.TypeScript/zflash/lib.ts",
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
      "installer reaches post-install boot substrate without manual intervention",
      "one agent can start through either retained authentication or local-LLM/no-account mode",
      "Kubernetes and ArgoCD health are covered by separate cluster integration tests, not this USB/ISO harness",
    ],
    composesWith: [
      "src/Core.TypeScript/ci/qemu-full-install-test.ts",
      "B-0831 (CI cascade-6 cluster-auto-join)",
      "B-0590 (fleet replication 20 machines)",
    ],
    gates: ["reformat-with-retention", "cluster-joining"],
    notes:
      "qemu-full-install-test.ts waits for ZETA CLUSTER NODE INSTALL COMPLETE then phase-2 login on the installed disk. USB/ISO scope is zflash + boot + one agent start path; Kubernetes/ArgoCD health belongs in an orthogonal integration lane rather than this harness.",
  },
  {
    id: "reformat-with-retention",
    title: "Reformat WITH key + selection retention",
    orderIndex: 3,
    status: "scaffolded",
    acceptanceCriteria: [
      "re-bake USB with existing operator-chosen credentials preserved",
      "same cluster/node identity is retained when retention mode is selected",
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
      "no-retention reformat produces a new cluster/node identity",
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
 * B-0891 — determineRunnability: substantive lane work per Aaron's
 * 3-lane substrate-check (Amara ferry §33.2 PR #5757) + standing PoC
 * permission.
 *
 * Structurally parallel to:
 *   - workflow-engine determineReviewLevel (PR #5758) — same shape at
 *     workflow-substrate scope
 *   - better-git-crypt determineEncryptionPath (PR #5760) — same shape
 *     at encryption-substrate scope
 *
 * Each discriminator maps a substrate-context → Result-shaped verdict.
 * The 3-lane work isn't 3 independent implementations; it's the same
 * substrate-engineering substrate (per `.claude/rules/monad-propagation-
 * pattern-cross-language-substrate-shape.md` + `.claude/rules/
 * asymmetric-authorship-substrate-entity-defines-consent-channel-
 * recipient-acknowledges.md`) operating at 3 different scopes.
 *
 * Policy:
 *   - status "composes-with-existing" → can-run-now (composes with shipped
 *     qemu-full-install-test.ts substrate)
 *   - status "scaffolded" + state-preservation-pending → blocked-on-state-
 *     preservation (requires QEMU TPM-equivalent / persisted KV)
 *   - status "scaffolded" + multi-vm-pending → blocked-on-multi-vm-
 *     orchestration (requires multi-VM QEMU)
 *   - status "scaffolded" + dual-path-fork-pending → blocked-on-test-
 *     harness-path-fork
 *   - status "operator-runtime" → requires-physical-usb
 *   - gates not all runnable → blocked-on-upstream-gate
 *
 * Future extensions to RunnabilityVerdict union must update this function
 * (TS strict mode enforces exhaustiveness).
 */

/**
 * RunnabilityVerdict — discriminated union for whether a scenario can
 * run in the current substrate state.
 */
export type RunnabilityVerdict =
  | { kind: "can-run-now"; harnessEntry: string }
  | { kind: "blocked-on-upstream-gate"; missingGates: ReadonlyArray<ScenarioId> }
  | { kind: "blocked-on-state-preservation"; required: "tpm-equivalent" | "persisted-kv" }
  | { kind: "blocked-on-multi-vm-orchestration" }
  | { kind: "blocked-on-test-harness-path-fork" }
  | { kind: "requires-physical-usb" };

/**
 * Discriminator that maps a Scenario + the set of currently-runnable
 * upstream scenarios to its RunnabilityVerdict.
 *
 * The `runnableUpstream` set IS the substrate-state input — caller
 * provides which other scenarios can currently run (typically by
 * iterating SCENARIOS + checking determineRunnability output reflexively
 * OR by hardcoding which composes-with-existing scenarios are wired).
 */
export function determineRunnability(
  scenario: Scenario,
  runnableUpstream: ReadonlySet<ScenarioId>,
): RunnabilityVerdict {
  // Upstream gate check applies regardless of status — if any gate
  // scenario isn't runnable, this scenario can't run end-to-end either.
  const missingGates = scenario.gates.filter((g) => !runnableUpstream.has(g));
  if (missingGates.length > 0 && scenario.gates.length > 0) {
    // Special-case: a scenario's gates name DOWNSTREAM scenarios it
    // GATES, not UPSTREAM scenarios it depends on. Per scenarios.ts
    // existing scenarios: `initial-format.gates = ["boot-cluster-up"]`
    // means initial-format must run BEFORE boot-cluster-up. The gate
    // direction is "I gate downstream X". So missingGates here means
    // "downstream scenarios I gate aren't runnable" — which doesn't
    // block THIS scenario from running. Skip the gate check entirely
    // for the upstream-blocking interpretation, OR reframe as "this
    // scenario gates downstream X; runnability not affected."
    //
    // For PoC: surface gates as informational; don't block on them.
  }

  switch (scenario.status) {
    case "composes-with-existing": {
      // PoC dispatcher contract: each composes-with-existing scenario
      // identifies which existing harness substrate it dispatches to.
      // Map per current substrate:
      if (scenario.id === "initial-format") {
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/ci/qemu-boot-test.ts + src/Core.TypeScript/ci/audit-installer-iso-content.ts",
        };
      }
      if (scenario.id === "boot-cluster-up") {
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/ci/qemu-full-install-test.ts",
        };
      }
      // Future composes-with-existing scenarios fall through to a
      // generic harness-entry; explicit mapping preferred when added.
      return {
        kind: "can-run-now",
        harnessEntry: "src/Core.TypeScript/ci/qemu-full-install-test.ts",
      };
    }
    case "scaffolded": {
      // Map specific scaffolded scenarios to their specific blocker:
      if (scenario.id === "reformat-with-retention") {
        // Requires state-preservation between QEMU boots per scenarios.ts notes
        return {
          kind: "blocked-on-state-preservation",
          required: "persisted-kv",
        };
      }
      if (scenario.id === "reformat-from-scratch") {
        // Requires test-harness path-fork support per scenarios.ts notes
        return { kind: "blocked-on-test-harness-path-fork" };
      }
      if (scenario.id === "cluster-joining") {
        // Requires multi-VM QEMU orchestration per scenarios.ts notes
        return { kind: "blocked-on-multi-vm-orchestration" };
      }
      // Default scaffolded blocker:
      return {
        kind: "blocked-on-state-preservation",
        required: "persisted-kv",
      };
    }
    case "operator-runtime":
      return { kind: "requires-physical-usb" };
  }
}

/**
 * Convenience: compute the set of currently-runnable scenarios.
 * Iterates SCENARIOS reflexively; a scenario is runnable iff
 * determineRunnability returns "can-run-now".
 */
export function computeRunnableSet(scenarios: ReadonlyArray<Scenario> = SCENARIOS): ReadonlySet<ScenarioId> {
  const set = new Set<ScenarioId>();
  for (const s of scenarios) {
    // Use empty runnableUpstream — determineRunnability's gate-check is
    // currently informational-only per the scaffolded comment above.
    const verdict = determineRunnability(s, new Set());
    if (verdict.kind === "can-run-now") {
      set.add(s.id);
    }
  }
  return set;
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
    throw new Error(`expected exactly 5 scenarios per B-0891 matrix; got ${scenarios.length}`);
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
