# `tools/zflash/test-harness/` — B-0891 5-scenario test harness (PoC scaffold)

PoC scaffold for the zflash "done" acceptance criteria — the 5-scenario QEMU test matrix the operator named in [B-0891](../../../docs/backlog/P1/B-0891-zflash-done-acceptance-criteria-qemu-test-harness-5-scenarios-initial-format-cluster-up-reformat-with-retention-reformat-from-scratch-cluster-joining-aaron-2026-05-28.md).

## Scope

**PoC**: declarative scenario definitions + CLI dispatcher contract + invariant tests.

**NOT in PoC** (deferred to follow-up): QEMU snapshot/restart logic for scenarios 3-5 (state preservation between boots); multi-VM orchestration for scenario 5 (cluster-joining); GitHub Actions workflow integration.

## Scenarios

| # | Scenario | Status | Composes-with |
|---|---|---|---|
| 1 | Initial format (USB-bake from zero) | composes-with-existing | `tools/ci/qemu-boot-test.ts` + `tools/ci/audit-installer-iso-content.ts` |
| 2 | Initial boot + cluster comes up | composes-with-existing | `tools/ci/qemu-full-install-test.ts` (B-0831 Slice 1) |
| 3 | Reformat WITH key + selection retention | scaffolded | B-0737 Touch ID + B-0852 USB-bound creds (requires QEMU state preservation) |
| 4 | Reformat from scratch (wipe + fresh keys) | scaffolded | B-0852 USB-bound creds + B-0884 PQ git-crypt (requires test-harness path-fork) |
| 5 | Cluster joining (new node) | scaffolded | B-0831 cluster-auto-join + B-0852.3 cred-picker (requires multi-VM QEMU orchestration) |

## CLI

```bash
# List the scenario matrix as JSON
bun tools/zflash/test-harness/run.ts --list

# Validate scenarios + report dispatcher plan without executing QEMU
bun tools/zflash/test-harness/run.ts --dry-run

# Dry-run a specific scenario
bun tools/zflash/test-harness/run.ts --dry-run --scenario initial-format

# Run one scenario (composes-with-existing scenarios shell out to tools/ci/ substrate)
bun tools/zflash/test-harness/run.ts --scenario initial-format <iso-path>

# Run all 5 in orderIndex order; gate failures skip dependent scenarios
bun tools/zflash/test-harness/run.ts --all <iso-path>
```

Exit codes:

- `0` — all requested scenarios passed (or all skipped/scaffolded)
- `1` — one or more requested scenarios FAILED
- `2` — usage error OR scenario-definition invariant violation

## Tests

```bash
bun test tools/zflash/test-harness/
```

Invariants checked: 5-scenario count, unique ids, orderIndex 1..5 unique, gate references valid, composes-with-existing scenarios cite `tools/ci/` paths, non-empty acceptance criteria.

## Extending the harness

To add or modify a scenario, edit `scenarios.ts` only — `run.ts` dispatches based on the declarative definitions; tests verify invariants. The scaffolded → composes-with-existing transition happens when the implementation substrate lands (QEMU snapshot/restart for scenarios 3-5; multi-VM orchestration for scenario 5).

When a scenario transitions to composes-with-existing:

1. Update `scenarios.ts` status field
2. Update `composesWith` array to reference the new harness path
3. Update `runComposingScenario` in `run.ts` to dispatch to the new harness if not already covered
4. Add a unit test for the new dispatch path

## Composes-with substrate

- [`tools/ci/qemu-full-install-test.ts`](../../ci/qemu-full-install-test.ts) — B-0831 Slice 1 starter; existing QEMU full-install harness
- [`tools/ci/qemu-boot-test.ts`](../../ci/qemu-boot-test.ts) — cascade #5 boot smoke-test
- [`tools/ci/audit-installer-iso-content.ts`](../../ci/audit-installer-iso-content.ts) — cascade #4 ISO content audit
- [`full-ai-cluster/tools/zflash.ts`](../../../full-ai-cluster/tools/zflash.ts) — the zflash CLI under test
- [`full-ai-cluster/tools/zflash-lib.ts`](../../../full-ai-cluster/tools/zflash-lib.ts) — library substrate
- [`docs/runbooks/zflash-end-to-end.md`](../../../docs/runbooks/zflash-end-to-end.md) — operator-facing runbook
- [`docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md`](../../../docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md) — CP-1..CP-6 critical-path sequence
- [B-0891](../../../docs/backlog/P1/B-0891-zflash-done-acceptance-criteria-qemu-test-harness-5-scenarios-initial-format-cluster-up-reformat-with-retention-reformat-from-scratch-cluster-joining-aaron-2026-05-28.md) — backlog row this PoC implements
- [B-0892](../../../docs/backlog/P1/B-0892-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md) — zflash lane this advances

## Operator-collaborative testing

Per B-0891 framing, USB-side validation (after QEMU green) is operator-collaborative: physical USB confirms QEMU-validated behavior survives real hardware; operator demos at work need physical USB; KVM substrate enables remote USB-boot tests.

The harness ships QEMU-side iteration; operator handles physical-USB validation in parallel.
