/**
 * src/Core.TypeScript/zflash/test-harness/scenarios.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ — zflash "done" acceptance criteria + QEMU test harness
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
 * status field for partial implementation. Scenarios 1–4 are
 * `composes-with-existing` (1→boot audit, 2→qemu-full-install-test,
 * 3→retention runtime, 4→path-fork runtime). Scenario 5 remains
 * scaffolded pending multi-VM orchestration.
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
      "081KSGS9H0008QG0R0011BC7T2 (CI cascade-6 cluster-auto-join)",
      "081KRQ1AB0008QG0R002G93CM7 (fleet replication 20 machines)",
    ],
    gates: ["reformat-with-retention", "cluster-joining"],
    notes:
      "qemu-full-install-test.ts waits for ZETA CLUSTER NODE INSTALL COMPLETE then phase-2 login on the installed disk. USB/ISO scope is zflash + boot + one agent start path; Kubernetes/ArgoCD health belongs in an orthogonal integration lane rather than this harness.",
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
      "existing cluster recognizes the re-baked USB",
    ],
    composesWith: [
      "src/Core.TypeScript/zflash/test-harness/qemu-state.ts",
      "src/Core.TypeScript/zflash/test-harness/run.ts",
      "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
      "081KSE6WT0008QG0R003WZAQKV (Touch ID + PAM + ISO-auto-discovery)",
      "081KSKBP80008QG0R003AX2A69 (USB-bound credential substrate)",
      "081KSKBP80008QG0R003ETGS01 (cred-picker integration)",
    ],
    gates: ["reformat-from-scratch"],
    notes:
      "Opt-in QEMU retention runtime (ZFLASH_QEMU_RETENTION_EXECUTE=1) + serial markers for ESP zeta-creds.enc and installed-OS restore (already-present). Touch ID / biometric still physical-gated; software path is QEMU-testable.",
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
      "both paths supported + tested",
    ],
    composesWith: [
      "src/Core.TypeScript/zflash/test-harness/path-fork.ts",
      "src/Core.TypeScript/zflash/test-harness/run.ts",
      "081KSE6WT0008QG0R003WZAQKV (Touch ID + PAM)",
      "081KSKBP80008QG0R003AX2A69 (USB-bound credential substrate)",
      "081KSNY2Z0008QG0R0011XCT94 (PQ git-crypt + zflash integration — future PQ-credential path)",
    ],
    gates: ["cluster-joining"],
    notes:
      "Opt-in path-fork runtime (ZFLASH_QEMU_PATH_FORK_EXECUTE=1) asserts migrate vs fresh ESP markers. Full multi-boot identity divergence remains a deepen slice; software fork is QEMU-testable without physical USB.",
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
      "appears in cluster state within bounded time",
    ],
    composesWith: [
      "081KSGS9H0008QG0R0011BC7T2 (CI cascade-6 cluster-auto-join)",
      "081KSKBP80008QG0R003ETGS01 (cred-picker integration)",
      "081KRQ1AB0008QG0R002G93CM7 (fleet replication 20 machines)",
      "081KSNY2Z0008QG0R003FR5TVG (symbiotic cross-track self-healing)",
    ],
    gates: [],
    notes:
      "FIRST blocker CLEARED 2026-08-13: a join now exists to observe. k3s's join is the join (Aaron, closing PR #10493's open question), so full-ai-cluster/nixos/modules/k3s-join-observer.nix witnesses k3s's own agent-to-server join and emits B0891_CLUSTER_JOIN_SERIAL_MARKERS to serial; nixos/tests/k3s-agent-join.nix proves it two-node against the shipped modules. Checked mechanically by join-implementation-probe.ts. STILL BLOCKED on four named items (see JoinBlocker): joining-node-role-provisioning — a carrier now exists (zflash writes /zeta-firstboot.conf + /zeta-join-token; zeta-first-boot.sh prefers the ESP copy; injected-join-server.nix overrides serverAddr for agents) but NOTHING HAS BOOTED FROM IT, so the chain is unit-tested and unexercised; joining-node-address-assignment — the shared socket segment has no DHCP and no DNS (re-checked 2026-08-17: no dnsmasq/dhcpd/kea anywhere in full-ai-cluster), and nss-mdns answers for .local names only, so k3s-agent.nix's bare `control-plane` default could not resolve there. A carrier now exists (cluster-address.ts derives a static address from the role as a pure function; zeta-install.sh stages it; injected-cluster-address.nix applies it plus the control-plane /etc/hosts entry k3s-server.nix calls 'the robust path'), and the .local join URL was CORRECTED to the bare label — k3s-server.nix ships only --tls-san=control-plane, so the mDNS form would have failed certificate verification even if it had resolved. Same standing as role-provisioning: unit-tested, NOT BOOTED; shared-l2-segment — the netdev args and the socket-segment plan now exist (distinct MACs, listen/connect), but no frame has ever crossed the segment because nothing runs the VMs concurrently; concurrent-vm-lifecycle — executeMultiVMRuntimePlan boots serially and kills each VM on marker match. Dispatching before all three clear would report a failure that has nothing to do with joining.",
  },
];

/**
 * Lookup helper — find scenario by id.
 */
export function findScenario(id: ScenarioId): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/**
 * 081KSNY2Z0008QG0R0008PN7RQ — determineRunnability: substantive lane work per Aaron's
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
 * The blockers still standing between `cluster-joining` and an honest
 * dispatch, measured 2026-08-13. Named individually because "multi-VM
 * orchestration" as a single phrase hid an entire provisioning gap once
 * already, which is what PR #10493 was about.
 *
 * - `joining-node-role-provisioning` — the MECHANISM half has cleared, the
 *   PROOF half has not. Until 2026-08-17 there was no carrier at all: zflash
 *   could write four ESP files and none of them named a role, so the decision
 *   was made at ISO-BUILD time by `/etc/zeta-firstboot.conf` (`HOST=control-plane`)
 *   and a zflash-prepared image installed a second control plane. There is now
 *   a carrier — `firstboot-role.ts` composes `/zeta-firstboot.conf`,
 *   `planFileBackedZflashImage` writes it plus an optional `/zeta-join-token`,
 *   `zeta-first-boot.sh` sources the ESP copy in preference to the ISO's,
 *   `zeta-install.sh` installs the token at the path `k3s-agent.nix` reads,
 *   and `injected-join-server.nix` overrides `serverAddr` for agents.
 *   NONE OF THAT HAS BEEN BOOTED. Every step is unit-tested as a pure
 *   function and zero steps are observed on a running guest, so the blocker
 *   stays listed: a provisioning chain that has never provisioned anything is
 *   a claim, not a capability — the same standard `shared-l2-segment` is held
 *   to below. What would clear it is a guest that boots from a joiner-flashed
 *   image and logs `role=joiner` on serial.
 * - `joining-node-address-assignment` — the MECHANISM half has cleared 2026-08-17,
 *   the PROOF half has not, exactly as `joining-node-role-provisioning` above.
 *   The gap as filed: the shared segment is a bare QEMU socket — no DHCP server,
 *   no DNS, no router (re-checked on `main`: every `useDHCP`/NetworkManager
 *   setting in the tree is CLIENT side and there is no dnsmasq/dhcpd/kea
 *   anywhere) — so two guests reach RFC-3927 link-local at best and the only
 *   name service is Avahi/nss-mdns, which answers for `.local` ONLY.
 *   There is now a carrier: `cluster-address.ts` derives a static address from
 *   the ROLE (founder `10.88.0.1`, joiner `10.88.0.2+`) as a pure function,
 *   `firstboot-role.ts` emits it into `/zeta-firstboot.conf`, `zeta-install.sh`
 *   re-validates and stages three scalars under `/etc/zeta/`, and
 *   `injected-cluster-address.nix` applies them plus the
 *   `control-plane -> <ip>` `/etc/hosts` entry that `k3s-server.nix` calls
 *   "the robust path".
 *   THE ORIGINAL ENTRY WAS WRONG ON ONE POINT, and the correction is the
 *   reason mDNS is not the fix: it said the `.local` form was the answer.
 *   `k3s-server.nix` ships exactly one name SAN, `--tls-san=control-plane`, and
 *   `nixos/tests/k3s-agent-join.nix` records that removing it makes the join
 *   fail on certificate verification. So `control-plane.local` would have
 *   failed the handshake even if mDNS had resolved it. The same k3s-server.nix
 *   comment also records that mDNS was already TRIED on this stack and
 *   "never resolved". `SCENARIO5_JOIN_SERVER_URL` is now the bare label.
 *   NONE OF THE APPLICATION HAS BEEN BOOTED. The derivation is unit-tested with
 *   no network and no QEMU; the `injected-cluster-address.nix` no-op path is
 *   evaluated (it yields `{}`); the POPULATED path, the NetworkManager keyfile
 *   pickup, MAC-based NIC matching, and reachability of 6443 across the segment
 *   are all UNVERIFIED. The existing node must still be flashed
 *   `--host control-plane` (without it `zeta-install.sh` generates a random
 *   `node-<6hex>`). What would clear this blocker is a joiner observed
 *   reaching the founder's API server on the segment.
 * - `shared-l2-segment` — the ARGUMENT half has cleared:
 *   `buildQemuSystemBootArgs` now accepts injected netdev specs and
 *   `planMultiVMRuntime` puts the two VMs on one rootless QEMU socket segment
 *   (`listen` on the existing node, `connect` on the joining node) with
 *   distinct MACs. What has NOT cleared is the PROOF half: no frame has ever
 *   crossed that segment, because nothing has run the two VMs at once. It
 *   stays listed until a real join is observed over it — a planned topology
 *   that has never carried traffic is a claim, not a capability.
 * - `concurrent-vm-lifecycle` — `executeMultiVMRuntimePlan` boots the VMs
 *   serially and `runManagedCommandUntilSerialMarkers` SIGTERMs each VM on
 *   marker match, so the existing node is dead before the joining node boots.
 */
export type JoinBlocker =
  | "joining-node-role-provisioning"
  | "joining-node-address-assignment"
  | "shared-l2-segment"
  | "concurrent-vm-lifecycle";

/**
 * RunnabilityVerdict — discriminated union for whether a scenario can
 * run in the current substrate state.
 */
export type RunnabilityVerdict =
  | { kind: "can-run-now"; harnessEntry: string }
  | { kind: "blocked-on-upstream-gate"; missingGates: ReadonlyArray<ScenarioId> }
  | { kind: "blocked-on-state-preservation"; required: "tpm-equivalent" | "persisted-kv" }
  // Blocker for cluster-joining. The FIRST blocker — nothing in the guest
  // tree emitted B0891_CLUSTER_JOIN_SERIAL_MARKERS, so there was no join for
  // any harness to observe — HAS CLEARED: k3s-join-observer.nix now witnesses
  // k3s's own agent-to-server join and writes those exact strings to serial
  // (Aaron 2026-08-13: "k3s's join is the join, don't invent our own"), and
  // nixos/tests/k3s-agent-join.nix proves it two-node.
  //
  // What remains is carried explicitly rather than in prose, so that dropping
  // one is a type change and not a quiet edit.
  | { kind: "blocked-on-multi-vm-orchestration"; remainingBlockers: ReadonlyArray<JoinBlocker> }
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
          harnessEntry:
            "src/Core.TypeScript/ci/qemu-boot-test.ts + src/Core.TypeScript/ci/audit-installer-iso-content.ts",
        };
      }
      if (scenario.id === "boot-cluster-up") {
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/ci/qemu-full-install-test.ts",
        };
      }
      if (scenario.id === "reformat-with-retention") {
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/zflash/test-harness/run.ts (ZFLASH_QEMU_RETENTION_EXECUTE=1)",
        };
      }
      if (scenario.id === "reformat-from-scratch") {
        return {
          kind: "can-run-now",
          harnessEntry: "src/Core.TypeScript/zflash/test-harness/run.ts (ZFLASH_QEMU_PATH_FORK_EXECUTE=1)",
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
        // The first blocker (no join to observe) has cleared — the guest now
        // emits the markers. The scenario still does NOT dispatch, because a
        // joining VM that installs as a control-plane on a network it cannot
        // reach would fail for three reasons that have nothing to do with the
        // join. Each remaining blocker is named, so clearing one is a visible
        // type-level edit rather than a quiet prose change.
        return {
          kind: "blocked-on-multi-vm-orchestration",
          remainingBlockers: [
            "joining-node-role-provisioning",
            "joining-node-address-assignment",
            "shared-l2-segment",
            "concurrent-vm-lifecycle",
          ],
        };
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
    throw new Error(`expected exactly 5 scenarios per 081KSNY2Z0008QG0R0008PN7RQ matrix; got ${scenarios.length}`);
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
