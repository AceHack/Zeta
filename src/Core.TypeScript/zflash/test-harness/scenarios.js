export const SCENARIOS = [
  {
    id: "initial-format",
    title: "Initial format (USB-bake from zero)",
    orderIndex: 1,
    status: "composes-with-existing",
    acceptanceCriteria: [
      "zflash script runs cleanly to completion",
      "produces bootable USB image with operator-chosen credentials baked in",
      "passes ISO content audit (src/Core.TypeScript/ci/audit-installer-iso-content.ts)",
      "QEMU boots the produced image to a usable state"
    ],
    composesWith: [
      "src/Core.TypeScript/ci/audit-installer-iso-content.ts",
      "src/Core.TypeScript/ci/qemu-boot-test.ts",
      "src/Core.TypeScript/zflash/cli.ts",
      "src/Core.TypeScript/zflash/lib.ts"
    ],
    gates: ["boot-cluster-up"],
    notes: "Existing qemu-boot-test.ts performs the boot-to-usable-state check; existing audit-installer-iso-content.ts performs the content check. This scenario sequences them in one harness invocation."
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
      "Kubernetes and ArgoCD health are covered by separate cluster integration tests, not this USB/ISO harness"
    ],
    composesWith: [
      "src/Core.TypeScript/ci/qemu-full-install-test.ts",
      "081KSGS9H0008QG0R0011BC7T2 (CI cascade-6 cluster-auto-join)",
      "081KRQ1AB0008QG0R002G93CM7 (fleet replication 20 machines)"
    ],
    gates: ["reformat-with-retention", "cluster-joining"],
    notes: "qemu-full-install-test.ts waits for ZETA CLUSTER NODE INSTALL COMPLETE then phase-2 login on the installed disk. USB/ISO scope is zflash + boot + one agent start path; Kubernetes/ArgoCD health belongs in an orthogonal integration lane rather than this harness."
  },
  {
    id: "reformat-with-retention",
    title: "Reformat WITH key + selection retention",
    orderIndex: 3,
    status: "composes-with-existing",
    acceptanceCriteria: [
      "re-bake USB with existing operator-chosen credentials preserved",
      "same cluster/node identity is retained when retention mode is selected",
      "Touch ID pairing per 081KSE6WT0008QG0R003WZAQKV preserved (no re-pair required)",
      "passphrase per 081KSKBP80008QG0R003AX2A69 preserved (no re-enter required)",
      "UUID-bound keys preserved across re-bake",
      "existing cluster recognizes the re-baked USB"
    ],
    composesWith: [
      "src/Core.TypeScript/zflash/test-harness/qemu-state.ts",
      "src/Core.TypeScript/zflash/test-harness/run.ts",
      "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
      "081KSE6WT0008QG0R003WZAQKV (Touch ID + PAM + ISO-auto-discovery)",
      "081KSKBP80008QG0R003AX2A69 (USB-bound credential substrate)",
      "081KSKBP80008QG0R003ETGS01 (cred-picker integration)"
    ],
    gates: ["reformat-from-scratch"],
    notes: "Opt-in QEMU retention runtime (ZFLASH_QEMU_RETENTION_EXECUTE=1) + serial markers for ESP zeta-creds.enc and installed-OS restore (already-present). Touch ID / biometric still physical-gated; software path is QEMU-testable."
  },
  {
    id: "reformat-from-scratch",
    title: "Reformat from scratch (wipe + fresh keys)",
    orderIndex: 4,
    status: "composes-with-existing",
    acceptanceCriteria: [
      "wipe-and-rebake from zero state produces fresh keys + new USB UUID",
      "no-retention reformat produces a new cluster/node identity",
      "operator can choose path: migrate existing cluster's credentials to new USB",
      "operator can choose path: start fresh cluster with new keys",
      "both paths supported + tested"
    ],
    composesWith: [
      "src/Core.TypeScript/zflash/test-harness/path-fork.ts",
      "src/Core.TypeScript/zflash/test-harness/run.ts",
      "081KSE6WT0008QG0R003WZAQKV (Touch ID + PAM)",
      "081KSKBP80008QG0R003AX2A69 (USB-bound credential substrate)",
      "081KSNY2Z0008QG0R0011XCT94 (PQ git-crypt + zflash integration \u2014 future PQ-credential path)"
    ],
    gates: ["cluster-joining"],
    notes: "Opt-in path-fork runtime (ZFLASH_QEMU_PATH_FORK_EXECUTE=1) asserts migrate vs fresh ESP markers. Full multi-boot identity divergence remains a deepen slice; software fork is QEMU-testable without physical USB."
  },
  {
    id: "cluster-joining",
    title: "Cluster joining (new node)",
    orderIndex: 5,
    status: "scaffolded",
    acceptanceCriteria: [
      "new node boots from USB",
      "joins existing running cluster cleanly",
      "gets credentials provisioned per 081KSKBP80008QG0R003ETGS01 cred-picker integration",
      "appears in cluster state within bounded time"
    ],
    composesWith: [
      "081KSGS9H0008QG0R0011BC7T2 (CI cascade-6 cluster-auto-join)",
      "081KSKBP80008QG0R003ETGS01 (cred-picker integration)",
      "081KRQ1AB0008QG0R002G93CM7 (fleet replication 20 machines)",
      "081KSNY2Z0008QG0R003FR5TVG (symbiotic cross-track self-healing)"
    ],
    gates: [],
    notes: "Requires multi-VM QEMU orchestration (one existing cluster VM + one joining VM). Existing harness is single-VM; multi-VM orchestration deferred to follow-up. PoC defines the contract."
  }
];
export function findScenario(id) {
  return SCENARIOS.find((s) => s.id === id);
}
export function determineRunnability(scenario, runnableUpstream) {
  if (scenario.gates.filter((g) => !runnableUpstream.has(g)).length > 0 && scenario.gates.length > 0)
    ;
  switch (scenario.status) {
    case "composes-with-existing": {
      if (scenario.id === "initial-format")
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/ci/qemu-boot-test.ts + src/Core.TypeScript/ci/audit-installer-iso-content.ts"
        };
      if (scenario.id === "boot-cluster-up")
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/ci/qemu-full-install-test.ts"
        };
      if (scenario.id === "reformat-with-retention")
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/zflash/test-harness/run.ts (ZFLASH_QEMU_RETENTION_EXECUTE=1)"
        };
      if (scenario.id === "reformat-from-scratch")
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/zflash/test-harness/run.ts (ZFLASH_QEMU_PATH_FORK_EXECUTE=1)"
        };
      return {
        kind: "can-run-now",
        harnessEntry: "src/Core.TypeScript/ci/qemu-full-install-test.ts"
      };
    }
    case "scaffolded": {
      if (scenario.id === "reformat-with-retention")
        return {
          kind: "blocked-on-state-preservation",
          required: "persisted-kv"
        };
      if (scenario.id === "reformat-from-scratch")
        return { kind: "blocked-on-test-harness-path-fork" };
      if (scenario.id === "cluster-joining")
        return { kind: "blocked-on-multi-vm-orchestration" };
      return {
        kind: "blocked-on-state-preservation",
        required: "persisted-kv"
      };
    }
    case "operator-runtime":
      return { kind: "requires-physical-usb" };
  }
}
export function computeRunnableSet(scenarios = SCENARIOS) {
  const set = new Set;
  for (const s of scenarios)
    if (determineRunnability(s, new Set).kind === "can-run-now")
      set.add(s.id);
  return set;
}
export function validateScenarios(scenarios) {
  if (scenarios.length !== 5)
    throw Error(`expected exactly 5 scenarios per 081KSNY2Z0008QG0R0008PN7RQ matrix; got ${scenarios.length}`);
  const ids = new Set, orders = new Set;
  for (const s of scenarios) {
    if (ids.has(s.id))
      throw Error(`duplicate scenario id: ${s.id}`);
    ids.add(s.id);
    if (s.orderIndex < 1 || s.orderIndex > 5)
      throw Error(`scenario ${s.id} orderIndex out of range: ${s.orderIndex}`);
    if (orders.has(s.orderIndex))
      throw Error(`duplicate orderIndex: ${s.orderIndex}`);
    orders.add(s.orderIndex);
  }
  for (const s of scenarios)
    for (const gate of s.gates)
      if (!ids.has(gate))
        throw Error(`scenario ${s.id} gates unknown scenario: ${gate}`);
}
