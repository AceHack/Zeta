# Zeta drift dashboard

> **NOT OK — RED 7 · UNKNOWN 5, incl. NEVER observed · coverage 61/66 (SHORTFALL 5) · green 56 · not-yet-due 1 · on-demand 14**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-22T19:42:11.719Z |
| producers | github-actions |
| roster | 80 known checks — 66 expected to report on this ref, 14 on-demand, 0 retired |
| coverage | **61 / 66** — **SHORTFALL 5** |

## RED — 7

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `budget-snapshot-cadence` | 6d | periodic | run 31959534906 concluded 'failure' |
| `tlaps-proof` | 18h | on-change | run 32542476787 concluded 'failure' |
| `manifesto-citation-snapshot-cadence` | 13h | periodic | run 32558211949 concluded 'failure' |
| `context-cost-trend-cadence` | 12h | periodic | run 32559948214 concluded 'failure' |
| `k8s-lane-partition` | 67m | on-change | run 32591039648 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `build-ai-cluster-iso` | 34m | on-change | run 32591565609 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `gate` | -21s | on-change | run 32593750621 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

## UNKNOWN — 5

**Longest silence first.** Silence that persists is the strongest signal and the easiest
to habituate to, so it is aged rather than listed. `never-observed` sorts above every
finite silence, because that is what infinite silence is.

The `why unknown` column is load-bearing — five reasons, and they are NOT interchangeable:
`never-observed` (no data has ever existed) · `not-observed-this-pass` (data may exist; this
pass could not see it — today's bug wears this one's clothes) · `registered-but-absent` (the
producer declares the check and its definition is missing from the repository) ·
`expectation-unknown` (cannot tell whether it should run at all) · `source-error` (we failed
to ask, which is not the same as a correct silence).

| check | silent for | why unknown | expectation | detail |
| --- | --- | --- | --- | --- |
| `copilot` | **NEVER observed** | expectation-unknown | unknown | cannot tell whether this check should run on this ref (host-managed check 'dynamic/copilot-swe-agent/copilot' — never declared in this repository, so its trigger cannot be read from the tree), and it has never produced a verdict |
| `image-pull-measurement` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/image-pull-measurement.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `inventory-phase5-proof` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/inventory-phase5-proof.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `substrate-claim-checker` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/substrate-claim-checker.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `zz-rustup-cache-probe` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/zz-rustup-cache-probe.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |

## Not yet due — 1

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

| check | expectation | detail |
| --- | --- | --- |
| `chart-version-refresh` | periodic | declared to run every 7d (schedule: '7 17 \* \* 0') and its definition landed only 23h ago, less than one full period — no verdict is owed yet |

## Running (0) / skipped (2)

| check | state | detail |
| --- | --- | --- |
| `mirror-to-fork` | skipped | run 32590487948 was skipped |
| `rerun-cancelled-gate` | skipped | run 32594514679 was skipped |

## Not applicable — 10

Declared to fire only on request, so silence on this ref is **correct**. Listed, not
hidden, and deliberately not called green — a distinction laundered is a distinction lost.

<details><summary>show</summary>

| check | expectation |
| --- | --- |
| `accelerator-local-llm-validate` | push, but not to main |
| `agent-reviewer` | pull_request |
| `arc-swarm-fanout` | workflow_dispatch |
| `docker-ubuntu-install-sh-test` | push, but not to main |
| `lint-autofix` | pull_request |
| `passkey-proposal-gated-commit` | issues |
| `pr-archive-on-merge` | pull_request |
| `resume-diff` | pull_request |
| `scaffold-stage1-create-repos` | workflow_dispatch |
| `verify-ollama-pin` | pull_request |

</details>

## Green — 56

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 85d | on-demand |
| `agencysignature-enforcement` | 3m | on-change |
| `agent-heartbeat` | -24s | periodic |
| `agent-proposal-gated-commit` | 5d | on-demand |
| `auto-submission` | -8s | unknown |
| `backlog-index-integrity` | 2d | on-change |
| `build-platform-images` | 37h | on-change |
| `bytelock` | 5d | on-change |
| `ci-cache-paths-lint` | 13m | on-change |
| `codeql` | -14s | unknown |
| `copilot-pull-request-reviewer` | 22d | unknown |
| `dependabot-updates` | 4h | unknown |
| `docker-nixos-install-sh-test` | 8h | on-change |
| `docker-ubuntu-jammy-install-sh-test` | 8h | on-change |
| `docker-windows-install-ps1-test` | 7h | on-change |
| `drift-sweep` | 27m | periodic |
| `factory-hygiene-audit-cadence` | 5h | periodic |
| `git-hotspot-cadence` | 6d | periodic |
| `gitbash-install-routing-test` | 8h | on-change |
| `github-settings-drift` | 5d | periodic |
| `heartbeat-liveness` | 3m | periodic |
| `helm-validate` | 4h | periodic |
| `installer-unit-tests` | 2m | on-change |
| `inventory-hardening-check` | 3d | on-change |
| `inventory-heartbeat` | 13h | periodic |
| `k8s-argocd-health-test` | 2h | periodic |
| `keyring-dst1000` | 18h | on-change |
| `lean-proof` | 5d | on-change |
| `lint-autofix-apply` | 9s | on-demand |
| `lockfile-healer` | 33s | periodic |
| `low-memory` | 13h | periodic |
| `macos-install-sh-test` | 8h | on-change |
| `memory-index-drift` | 2h | on-change |
| `memory-index-duplicate-lint` | 2h | on-change |
| `memory-index-integrity` | 2h | on-change |
| `memory-reference-existence-lint` | 2h | on-change |
| `multiboot-qemu-uefi-smoke` | 6d | on-change |
| `mux-swarm-tick` | 34m | periodic |
| `pages-build-deployment` | 15d | unknown |
| `pages-deploy` | 88s | periodic |
| `pr-manifest-integrity` | 68m | periodic |
| `proof-closure-drift` | 66m | periodic |
| `razor-cadence` | 10h | periodic |
| `role-ref-current-state-surfaces-lint` | 2d | on-change |
| `scorecard` | 5d | periodic |
| `skill-description-lint` | 2d | on-change |
| `society-heartbeat` | 2m | periodic |
| `soraya-formal-coverage-cadence` | 10h | periodic |
| `stryker-mutation` | 7d | on-change |
| `tick-metrics` | 4m | periodic |
| `udp-lossy-tests` | 4m | on-change |
| `update-graph` | 21d | unknown |
| `vocab-hygiene` | 12d | on-change |
| `wsl-install-sh-test` | 8h | on-change |
| `zetadb-scheduled-node` | 22m | periodic |
| `zflash-harness-lint` | 6d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
