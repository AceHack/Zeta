# Zeta drift dashboard

> **NOT OK — RED 15 · FLAPPING 3 · UNKNOWN 6, incl. NEVER observed · coverage 74/80 (SHORTFALL 6) · green 59 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-27T03:30:23.281Z |
| producers | github-actions |
| roster | 95 known checks — 80 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **74 / 80** — **SHORTFALL 6** |

## RED — 15

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `docker-ubuntu-install-sh-test` | **NEVER observed** | periodic | declared to run every 24h and has NEVER produced a verdict on this ref (schedule: '`', '11 3 * * *' — period not fully derivable, using the derivable minimum for staleness) |
| `chart-version-refresh` | 3d | periodic | run 32654132313 concluded 'failure' |
| `ruleset-apply` | 37h | on-change | run 32857443217 concluded 'failure' |
| `mirror-to-fork` | 21h | periodic | run 32937913382 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-26T08:47:51Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `manifesto-citation-snapshot-cadence` | 21h | periodic | run 32940492136 concluded 'failure' |
| `society-heartbeat` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: '\*/30 \* \* \* \*') |
| `pr-gate-presence` | 88m | periodic | run 33032023310 concluded 'failure' |
| `proof-closure-drift` | 87m | periodic | run 33032035933 concluded 'failure' · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T02:42:27Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `drift-dashboard-cadence` | 80m | periodic | run 33032413847 concluded 'failure' |
| `rerun-toolchain-install-stall` | 75m | periodic | STALE: newest verdict (green) is 75m old, declared to run every 15m (schedule: '\*/15 \* \* \* \*') |
| `tick-metrics` | 73m | periodic | STALE: newest verdict (green) is 73m old, declared to run every 15m (schedule: '\*/15 \* \* \* \*') · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T03:01:55Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `heartbeat-liveness` | 45m | periodic | run 33034206627 concluded 'failure' |
| `agent-heartbeat` | 42m | periodic | MOSTLY FAILING over 7d (16 of 17 concluded runs failed, 2026-08-26T11:59:39Z .. 2026-08-27T02:48:33Z, 1 consecutive pass(es) since the last failure). The newest run passed and is the outlier — a majority-failing lane is broken, not flaky. |
| `search-index-cadence` | 28m | periodic | run 33034997092 concluded 'failure' |
| `build-ai-cluster-iso` | 4m | on-change | run 33033814682 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

## FLAPPING — 3

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `context-cost-trend-cadence` | periodic | FLAPPING over 7d (3 of 7 concluded runs failed, 2026-08-20T07:36:50Z .. 2026-08-26T07:37:49Z, 4 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `tlaps-proof` | on-change | FLAPPING over 7d (3 of 8 concluded runs failed, 2026-08-20T12:09:11Z .. 2026-08-26T08:34:27Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `pr-manifest-integrity` | periodic | FLAPPING over 7d (10 of 20 concluded runs failed, 2026-08-22T06:34:47Z .. 2026-08-27T02:04:23Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |

## UNKNOWN — 6

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
| `root-flake-check` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/root-flake-check.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `spanserializer-windows-repro` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/spanserializer-windows-repro.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `substrate-claim-checker` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/substrate-claim-checker.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `zz-rustup-cache-probe` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/zz-rustup-cache-probe.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |

## Not yet due — 0

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

_none_

## Running (0) / skipped (1)

| check | state | detail |
| --- | --- | --- |
| `rerun-cancelled-gate` | skipped | run 33036563142 was skipped |

## Not applicable — 11

Declared to fire only on request, so silence on this ref is **correct**. Listed, not
hidden, and deliberately not called green — a distinction laundered is a distinction lost.

<details><summary>show</summary>

| check | expectation |
| --- | --- |
| `accelerator-local-llm-validate` | push, but not to main |
| `agent-reviewer` | pull_request |
| `agentic-organization-integration` | workflow_dispatch |
| `arc-swarm-fanout` | workflow_dispatch |
| `image-pull-measurement` | pull_request |
| `lint-autofix` | pull_request |
| `passkey-proposal-gated-commit` | issues |
| `pr-archive-on-merge` | pull_request |
| `resume-diff` | pull_request |
| `scaffold-stage1-create-repos` | workflow_dispatch |
| `verify-ollama-pin` | pull_request |

</details>

## Green — 59

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 89d | on-demand |
| `agencysignature-enforcement` | 2m | on-change |
| `agent-proposal-gated-commit` | 10d | on-demand |
| `agentic-organization-tests` | 19h | on-change |
| `arc-lane` | 7h | on-change |
| `archive-strand-alarm` | 41m | periodic |
| `auto-submission` | 50s | unknown |
| `backlog-index-integrity` | 31h | on-change |
| `budget-snapshot-cadence` | 3d | periodic |
| `build-platform-images` | 18h | on-change |
| `bytelock` | 37h | on-change |
| `ci-cache-paths-lint` | 8m | on-change |
| `ci-runtime-image` | 42m | on-change |
| `codeql` | -2s | unknown |
| `copilot-pull-request-reviewer` | 26d | unknown |
| `dependabot-updates` | 37h | unknown |
| `docker-nixos-install-sh-test` | 48m | periodic |
| `docker-ubuntu-jammy-install-sh-test` | 43m | periodic |
| `docker-windows-install-ps1-test` | 26m | periodic |
| `drift-sweep` | 45m | periodic |
| `factory-hygiene-audit-cadence` | 13h | periodic |
| `gate` | 3s | on-change |
| `git-hotspot-cadence` | 3d | periodic |
| `gitbash-install-routing-test` | 53m | periodic |
| `github-settings-drift` | 3d | periodic |
| `helm-validate` | 11h | periodic |
| `installer-repair-mode-existing-install` | 4h | on-change |
| `installer-unit-tests` | 51m | on-change |
| `interp-lane` | 18h | on-change |
| `inventory-hardening-check` | 4d | on-change |
| `inventory-heartbeat` | 21h | periodic |
| `k8s-argocd-health-test` | 9h | periodic |
| `k8s-lane-partition` | 3h | on-change |
| `keyring-dst1000` | 51m | on-change |
| `lean-proof` | 19h | on-change |
| `lint-autofix-apply` | 3m | on-demand |
| `lockfile-healer` | 33m | periodic |
| `low-memory` | 21h | periodic |
| `macos-install-sh-test` | 48m | periodic |
| `memory-index-drift` | 3h | on-change |
| `memory-index-duplicate-lint` | 3h | on-change |
| `memory-index-integrity` | 3h | on-change |
| `memory-reference-existence-lint` | 3h | on-change |
| `multiboot-qemu-uefi-smoke` | 16h | on-change |
| `mux-swarm-tick` | 2h | periodic |
| `pages-build-deployment` | 20d | unknown |
| `pages-deploy` | 44m | periodic |
| `razor-cadence` | 18h | periodic |
| `role-ref-current-state-surfaces-lint` | 49m | on-change |
| `scorecard` | 3d | periodic |
| `skill-description-lint` | 47h | on-change |
| `soraya-formal-coverage-cadence` | 18h | periodic |
| `stryker-mutation` | 19h | on-change |
| `udp-lossy-tests` | 2m | on-change |
| `update-graph` | 19h | unknown |
| `vocab-hygiene` | 16d | on-change |
| `wsl-install-sh-test` | 44m | periodic |
| `zetadb-scheduled-node` | 41m | periodic |
| `zflash-harness-lint` | 4d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
