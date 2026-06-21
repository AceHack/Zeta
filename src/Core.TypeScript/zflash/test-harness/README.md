# `src/Core.TypeScript/zflash/test-harness/` — 081KSNY2Z0008QG0R0008PN7RQ 5-scenario test harness (PoC scaffold)

PoC scaffold for the zflash "done" acceptance criteria — the 5-scenario QEMU test matrix the operator named in [081KSNY2Z0008QG0R0008PN7RQ](../../../../docs/backlog/P1/081KSNY2Z0008QG0R0008PN7RQ-zflash-done-acceptance-criteria-qemu-test-harness-5-scenario.md).

## Scope

**PoC**: declarative scenario definitions + CLI dispatcher contract +
invariant tests + QEMU disk bootstrap, snapshot/restart command planning,
explicit scenario-3 process-executor wiring, scenario-4 path-fork command
planning, and serial-marker lifecycle stop conditions for QEMU boot phases.

**NOT in PoC** (deferred to follow-up): default-on QEMU snapshot/restart
execution for scenarios 3-5 in PR-time CI (state preservation between
boots is opt-in via env vars); multi-VM orchestration for scenario 5
(cluster-joining); full SSH/trust assertions after `--test` zflash images
boot in QEMU.

Operator clarification, 2026-05-31: this harness proves USB/ISO behavior,
not Kubernetes or ArgoCD health. The USB lane should cover zflash, boot,
retention/no-retention semantics, and one agent start path via retained
auth or local-LLM/no-account mode. Kubernetes and ArgoCD require their own
cluster integration tests outside 081KSNY2Z0008QG0R0008PN7RQ. Touch ID/biometric retention is
represented by preserved auth-state markers here and remains
operator-collaborative physical testing. Zeta is intentionally baked into
the image; external contributor flows are future work. Target architecture
assumptions include both x86_64 and ARM64/aarch64 hardware.

## Scenarios

| #   | Scenario                                  | Status                 | Composes-with                                                                                                    |
| --- | ----------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Initial format (USB-bake from zero)       | composes-with-existing | `tools/ci/qemu-boot-test.ts` + `tools/ci/audit-installer-iso-content.ts`                                         |
| 2   | Initial boot + agent start path           | composes-with-existing | `tools/ci/qemu-full-install-test.ts` (081KSGS9H0008QG0R0011BC7T2 Slice 1); K8s/ArgoCD health is external integration coverage        |
| 3   | Reformat WITH key + selection retention   | scaffolded             | 081KSE6WT0008QG0R003WZAQKV Touch ID + 081KSKBP80008QG0R003AX2A69 USB-bound creds; same cluster/node identity retained (requires QEMU state preservation) |
| 4   | Reformat from scratch (wipe + fresh keys) | scaffolded             | 081KSKBP80008QG0R003AX2A69 USB-bound creds + 081KSNY2Z0008QG0R0011XCT94 PQ git-crypt; new cluster/node identity (requires test-harness path-fork)        |
| 5   | Cluster joining (new node)                | scaffolded             | 081KSGS9H0008QG0R0011BC7T2 cluster-auto-join + 081KSKBP80008QG0R003ETGS01 cred-picker (requires multi-VM QEMU orchestration)                           |

## CLI

```bash
# List the scenario matrix as JSON
bun src/Core.TypeScript/zflash/test-harness/run.ts --list

# Validate scenarios + report dispatcher plan without executing QEMU
bun src/Core.TypeScript/zflash/test-harness/run.ts --dry-run

# Dry-run a specific scenario
bun src/Core.TypeScript/zflash/test-harness/run.ts --dry-run --scenario initial-format

# Run one scenario (composes-with-existing scenarios shell out to tools/ci/ substrate)
bun src/Core.TypeScript/zflash/test-harness/run.ts --scenario initial-format <iso-path>

# Run all 5 in orderIndex order; gate failures skip dependent scenarios
bun src/Core.TypeScript/zflash/test-harness/run.ts --all <iso-path>
```

Exit codes:

- `0` — all requested runnable scenarios passed; `--list`/`--dry-run` succeeded
- `1` — one or more requested scenarios FAILED
- `2` — usage error OR scenario-definition invariant violation

Runtime attempts for scenario 3 now emit the QEMU snapshot/restart command
plan and still fail closed with exit `1` unless the operator explicitly opts
into the real process executor:

```bash
ZFLASH_QEMU_RETENTION_EXECUTE=1 \
  bun src/Core.TypeScript/zflash/test-harness/run.ts --scenario reformat-with-retention <iso-path>
```

When testing a zflash-prepared USB artifact instead of a plain installer
ISO, point the runner at the raw boot image with
`ZFLASH_QEMU_RETENTION_BOOT_IMAGE`:

```bash
ZFLASH_QEMU_RETENTION_BOOT_IMAGE=/path/to/zflash-boot.img \
ZFLASH_QEMU_RETENTION_EXECUTE=1 \
  bun src/Core.TypeScript/zflash/test-harness/run.ts --scenario reformat-with-retention <iso-path>
```

The positional ISO path names the artifact stem only. Scenario-3 writes its
qcow2 disk and serial log under a writable temporary run directory by
default, or under `ZFLASH_QEMU_RETENTION_RUN_DIR` when that override is set.
The boot-image env var supplies the actual USB-shaped boot media so QEMU can
observe the zflash-baked ESP contents.

The opt-in path runs the planned `qemu-img`/`qemu-system-x86_64` sequence:
create the qcow2 disk, boot the ISO once to establish the baseline disk,
stop that boot when the serial log reaches `ZETA CLUSTER NODE INSTALL COMPLETE`
success marker, snapshot the baseline, restore it, restart from the ISO with
the same disk, stop that restart only when retention markers appear, then
pass only when the final serial assertion includes the required retention
markers. If either lifecycle phase reaches the plain installer prompt before
its required success markers, the run fails fast instead of waiting for the
full QEMU timeout.

Runtime attempts for scenario 4 now emit a two-branch path-fork plan and
still fail closed with exit `1` unless the operator explicitly opts into
the real process executor:

```bash
ZFLASH_QEMU_PATH_FORK_EXECUTE=1 \
ZFLASH_QEMU_PATH_FORK_BOOTSTRAP=1 \
ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE=/path/to/zflash-boot.img \
  bun src/Core.TypeScript/zflash/test-harness/run.ts --scenario reformat-from-scratch <iso-path>
```

`ZFLASH_QEMU_PATH_FORK_BOOTSTRAP=1` creates the baseline qcow2 disk +
`post-initial-format` snapshot before exercising both forks. The boot-image
env var supplies the zflash-prepared USB artifact for the migrate fork.

By default the migrate-existing-creds fork records a missing runtime
requirement because it needs a zflash-prepared boot image containing
`/zeta-creds.enc`. Provide that raw USB-shaped artifact with
`ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE`:

```bash
ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE=/path/to/zflash-boot.img \
  bun src/Core.TypeScript/zflash/test-harness/run.ts --scenario reformat-from-scratch <iso-path>
```

Scenario 4 restores the same baseline snapshot before each fork. The
migrate fork expects the installer serial markers for finding a pre-baked
`zeta-creds.enc` and skipping account re-entry; the fresh fork expects the
no-prebaked-credential marker and treats retained-credential markers as
failures. The positional ISO path names the artifact stem only. Scenario-4
writes its planned qcow2 disk and serial logs under a writable temporary run
directory by default, or under `ZFLASH_QEMU_PATH_FORK_RUN_DIR` when that
override is set. Runtime attempts for scenario 5 remain scaffolded/fail-
closed.
`--dry-run` remains the planning surface for inspecting pending scenarios
without claiming a false green.

## Tests

```bash
bun test src/Core.TypeScript/zflash/test-harness/
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

- [`tools/ci/qemu-full-install-test.ts`](../../../../tools/ci/qemu-full-install-test.ts) — 081KSGS9H0008QG0R0011BC7T2 Slice 1 starter; existing QEMU full-install harness
- [`tools/ci/qemu-boot-test.ts`](../../../../tools/ci/qemu-boot-test.ts) — cascade #5 boot smoke-test
- [`qemu-state.ts`](qemu-state.ts) — scenario 3 qcow2 disk bootstrap + snapshot/restart command planner
- [`path-fork.ts`](path-fork.ts) — scenario 4 migrate-vs-fresh path-fork command planner
- [`tools/ci/audit-installer-iso-content.ts`](../../../../tools/ci/audit-installer-iso-content.ts) — cascade #4 ISO content audit
- [`src/Core.TypeScript/zflash/cli.ts`](../cli.ts) — the zflash CLI under test
- [`src/Core.TypeScript/zflash/lib.ts`](../lib.ts) — library substrate
- [`docs/runbooks/zflash-end-to-end.md`](../../../../docs/runbooks/zflash-end-to-end.md) — operator-facing runbook
- [`docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md`](../../../../docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md) — CP-1..CP-6 critical-path sequence
- [081KSNY2Z0008QG0R0008PN7RQ](../../../../docs/backlog/P1/081KSNY2Z0008QG0R0008PN7RQ-zflash-done-acceptance-criteria-qemu-test-harness-5-scenario.md) — backlog row this PoC implements
- [081KSNY2Z0008QG0R002QA720J](../../../../docs/backlog/P1/081KSNY2Z0008QG0R002QA720J-three-lanes-concurrent-operating-discipline-encryption-plus-.md) — zflash lane this advances

## CI acceptance matrix (081KSNY2Z0008QG0R0008PN7RQ)

| Scenario          | Where it runs                              | Notes                                                                                                                 |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1 initial-format  | every `build-ai-cluster-iso` PR            | `audit-installer-iso-content` + `zflash-file-backed --test` + `qemu-boot-test --usb-image`                            |
| 2 boot-cluster-up | push / `workflow_dispatch` on ISO workflow | delegates to `qemu-full-install-test.ts`                                                                              |
| 3 retention       | `workflow_dispatch` on ISO workflow        | `ZFLASH_QEMU_RETENTION_EXECUTE=1`; auto-bakes boot image when ISO exists                                              |
| 4 path-fork       | `workflow_dispatch` on ISO workflow        | `ZFLASH_QEMU_PATH_FORK_EXECUTE=1` + bootstrap; fork boots stop on 081KSNY2Z0008QG0R0008PN7RQ markers only (one full install in bootstrap) |
| 5 cluster-join    | skipped in harness                         | multi-VM orchestration pending                                                                                        |

Dry-run + unit invariants: `.github/workflows/zflash-qemu-test.yml` on every harness-touching PR.

Prepare a retention boot image locally:

```bash
bun src/Core.TypeScript/zflash/test-harness/prepare-boot-image.ts \
  --iso /path/to/installer.iso \
  --output /tmp/zflash-retention.img \
  --with-credential-blob
```

## Operator-collaborative testing

Per 081KSNY2Z0008QG0R0008PN7RQ framing, USB-side validation (after QEMU green) is operator-collaborative: physical USB confirms QEMU-validated behavior survives real hardware; operator demos at work need physical USB; KVM substrate enables remote USB-boot tests.

The harness ships QEMU-side iteration; operator handles physical-USB validation in parallel.
