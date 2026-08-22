# Zeta drift dashboard

> **NOT OK — RED 7 · UNKNOWN 4, incl. NEVER observed · coverage 61/65 (SHORTFALL 4) · green 56 · not-yet-due 2 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-22T20:56:31.537Z |
| producers | github-actions |
| roster | 80 known checks — 65 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **61 / 65** — **SHORTFALL 4** |

## RED — 7

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `budget-snapshot-cadence` | 6d | periodic | run 31959534906 concluded 'failure' |
| `tlaps-proof` | 20h | on-change | run 32542476787 concluded 'failure' |
| `manifesto-citation-snapshot-cadence` | 14h | periodic | run 32558211949 concluded 'failure' |
| `context-cost-trend-cadence` | 13h | periodic | run 32559948214 concluded 'failure' |
| `k8s-lane-partition` | 28m | on-change | run 32596643657 concluded 'failure' |
| `agencysignature-enforcement` | 5m | on-change | run 32597886344 concluded 'failure' |
| `gate` | 86s | on-change | run 32597003225 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

## UNKNOWN — 4

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
| `inventory-phase5-proof` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/inventory-phase5-proof.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `substrate-claim-checker` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/substrate-claim-checker.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `zz-rustup-cache-probe` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/zz-rustup-cache-probe.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |

## Not yet due — 2

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

| check | expectation | detail |
| --- | --- | --- |
| `chart-version-refresh` | periodic | declared to run every 7d (schedule: '7 17 \* \* 0') and its definition landed only 25h ago, less than one full period — no verdict is owed yet |
| `drift-dashboard-cadence` | periodic | declared to run every 6h (schedule: '41 \*/6 \* \* \*') and its definition landed only 60m ago, less than one full period — no verdict is owed yet |

## Running (0) / skipped (2)

| check | state | detail |
| --- | --- | --- |
| `mirror-to-fork` | skipped | run 32590487948 was skipped |
| `rerun-cancelled-gate` | skipped | run 32598068456 was skipped |

## Not applicable — 11

Declared to fire only on request, so silence on this ref is **correct**. Listed, not
hidden, and deliberately not called green — a distinction laundered is a distinction lost.

<details><summary>show</summary>

| check | expectation |
| --- | --- |
| `accelerator-local-llm-validate` | push, but not to main |
| `agent-reviewer` | pull_request |
| `arc-swarm-fanout` | workflow_dispatch |
| `docker-ubuntu-install-sh-test` | push, but not to main |
| `image-pull-measurement` | pull_request |
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
| `agent-heartbeat` | 12m | periodic |
| `agent-proposal-gated-commit` | 5d | on-demand |
| `auto-submission` | 11s | unknown |
| `backlog-index-integrity` | 2d | on-change |
| `build-ai-cluster-iso` | 19m | on-change |
| `build-platform-images` | 39h | on-change |
| `bytelock` | 5d | on-change |
| `ci-cache-paths-lint` | 21m | on-change |
| `codeql` | 49s | unknown |
| `copilot-pull-request-reviewer` | 22d | unknown |
| `dependabot-updates` | 6h | unknown |
| `docker-nixos-install-sh-test` | 35m | on-change |
| `docker-ubuntu-jammy-install-sh-test` | 9h | on-change |
| `docker-windows-install-ps1-test` | 14m | on-change |
| `drift-sweep` | 10m | periodic |
| `factory-hygiene-audit-cadence` | 6h | periodic |
| `git-hotspot-cadence` | 6d | periodic |
| `gitbash-install-routing-test` | 9h | on-change |
| `github-settings-drift` | 5d | periodic |
| `heartbeat-liveness` | 4m | periodic |
| `helm-validate` | 5h | periodic |
| `installer-unit-tests` | 36m | on-change |
| `inventory-hardening-check` | 3d | on-change |
| `inventory-heartbeat` | 14h | periodic |
| `k8s-argocd-health-test` | 3h | periodic |
| `keyring-dst1000` | 20h | on-change |
| `lean-proof` | 16m | on-change |
| `lint-autofix-apply` | 76s | on-demand |
| `lockfile-healer` | 13m | periodic |
| `low-memory` | 15h | periodic |
| `macos-install-sh-test` | 9h | on-change |
| `memory-index-drift` | 3h | on-change |
| `memory-index-duplicate-lint` | 3h | on-change |
| `memory-index-integrity` | 3h | on-change |
| `memory-reference-existence-lint` | 3h | on-change |
| `multiboot-qemu-uefi-smoke` | 6d | on-change |
| `mux-swarm-tick` | 50m | periodic |
| `pages-build-deployment` | 15d | unknown |
| `pages-deploy` | 29s | periodic |
| `pr-manifest-integrity` | 2h | periodic |
| `proof-closure-drift` | 2h | periodic |
| `razor-cadence` | 12h | periodic |
| `role-ref-current-state-surfaces-lint` | 2d | on-change |
| `scorecard` | 6d | periodic |
| `skill-description-lint` | 2d | on-change |
| `society-heartbeat` | 15m | periodic |
| `soraya-formal-coverage-cadence` | 11h | periodic |
| `stryker-mutation` | 7d | on-change |
| `tick-metrics` | 4m | periodic |
| `udp-lossy-tests` | 5m | on-change |
| `update-graph` | 21d | unknown |
| `vocab-hygiene` | 12d | on-change |
| `wsl-install-sh-test` | 9h | on-change |
| `zetadb-scheduled-node` | 7m | periodic |
| `zflash-harness-lint` | 6d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
