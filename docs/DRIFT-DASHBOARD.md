# Zeta drift dashboard

> **NOT OK — RED 17 · FLAPPING 5 · UNKNOWN 7, incl. NEVER observed · coverage 75/82 (SHORTFALL 7) · green 56 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-27T09:53:05.431Z |
| producers | github-actions |
| roster | 97 known checks — 82 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **75 / 82** — **SHORTFALL 7** |

## RED — 17

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `chart-version-refresh` | 4d | periodic | run 32654132313 concluded 'failure' |
| `ruleset-apply` | 44h | on-change | run 32857443217 concluded 'failure' |
| `mirror-to-fork` | 27h | periodic | run 32937913382 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-26T08:47:51Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `manifesto-citation-snapshot-cadence` | 27h | periodic | run 32940492136 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `drift-dashboard-cadence` | 8h | periodic | run 33032413847 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'red' at 2026-08-27T05:05:09Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `search-index-cadence` | 7h | periodic | run 33034997092 concluded 'failure' |
| `mux-swarm-tick` | 4h | periodic | STALE: newest verdict (green) is 4h old, declared to run every 60m (schedule: `0 * * * *`) |
| `pr-gate-presence` | 3h | periodic | run 33046391051 concluded 'failure' |
| `tick-metrics` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T07:29:24Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `heartbeat-liveness` | 3h | periodic | run 33048667443 concluded 'failure' |
| `pages-deploy` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T09:47:44Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `agent-heartbeat` | 3h | periodic | run 33048649621 concluded 'failure' |
| `build-ai-cluster-iso` | 3h | on-change | MOSTLY FAILING over 7d (10 of 17 concluded runs failed, 2026-08-26T15:05:14Z .. 2026-08-27T07:15:45Z, 1 consecutive pass(es) since the last failure). The newest run passed and is the outlier — a majority-failing lane is broken, not flaky. |
| `lockfile-healer` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 17m (schedule: `*/17 * * * *`) |
| `drift-sweep` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: `7,37 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T09:47:38Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `archive-strand-alarm` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: `13,43 * * * *`) |
| `zetadb-scheduled-node` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: `13,43 * * * *`) |

## FLAPPING — 5

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `context-cost-trend-cadence` | periodic | FLAPPING over 7d (2 of 6 concluded runs failed, 2026-08-21T07:37:04Z .. 2026-08-26T07:37:49Z, 4 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `tlaps-proof` | on-change | FLAPPING over 7d (3 of 8 concluded runs failed, 2026-08-20T12:09:11Z .. 2026-08-26T08:34:27Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `gate` | on-change | FLAPPING over 7d (9 of 19 concluded runs failed, 2026-08-27T05:36:59Z .. 2026-08-27T08:21:04Z, 3 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `proof-closure-drift` | periodic | FLAPPING over 7d (8 of 20 concluded runs failed, 2026-08-22T12:36:37Z .. 2026-08-27T09:32:35Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `pr-manifest-integrity` | periodic | FLAPPING over 7d (9 of 20 concluded runs failed, 2026-08-22T12:34:39Z .. 2026-08-27T09:32:51Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |

## UNKNOWN — 7

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
| `root-flake-check` | **NEVER observed** | never-observed | on-change | declared to run on changes to this ref (push to main) and has never produced a verdict |
| `spanserializer-windows-repro` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/spanserializer-windows-repro.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `substrate-claim-checker` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/substrate-claim-checker.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `zz-rustup-cache-probe` | **NEVER observed** | registered-but-absent | unknown | REGISTERED with the producer but its definition is ABSENT from the repository (workflow file '.github/workflows/zz-rustup-cache-probe.yml' is registered ACTIVE on the forge host but is ABSENT from the repository) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike |
| `docker-windows-install-ps1-test` | 3h | not-observed-this-pass | periodic | run 33045356361 was CANCELLED — its jobs never executed, so it established no verdict |

## Not yet due — 0

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

_none_

## Running (0) / skipped (1)

| check | state | detail |
| --- | --- | --- |
| `rerun-cancelled-gate` | skipped | run 33060195515 was skipped |

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

## Green — 56

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 89d | on-demand |
| `agencysignature-enforcement` | 6m | on-change |
| `agent-proposal-gated-commit` | 10d | on-demand |
| `agentic-organization-tests` | 25h | on-change |
| `arc-lane` | 13h | on-change |
| `artifact-freshness` | 4h | periodic |
| `auto-submission` | 6m | unknown |
| `backlog-index-integrity` | 5h | on-change |
| `budget-snapshot-cadence` | 4d | periodic |
| `build-platform-images` | 25h | on-change |
| `bytelock` | 43h | on-change |
| `ci-cache-paths-lint` | 3h | on-change |
| `ci-runtime-image` | 7h | on-change |
| `codeql` | 2m | unknown |
| `copilot-pull-request-reviewer` | 26d | unknown |
| `dependabot-updates` | 43h | unknown |
| `docker-nixos-install-sh-test` | 4h | periodic |
| `docker-ubuntu-install-sh-test` | 5h | periodic |
| `docker-ubuntu-jammy-install-sh-test` | 5h | periodic |
| `factory-hygiene-audit-cadence` | 19h | periodic |
| `git-hotspot-cadence` | 4d | periodic |
| `gitbash-install-routing-test` | 2h | periodic |
| `github-settings-drift` | 3d | periodic |
| `helm-validate` | 18h | periodic |
| `installer-repair-mode-existing-install` | 10h | on-change |
| `installer-unit-tests` | 5h | on-change |
| `interp-lane` | 24h | on-change |
| `inventory-hardening-check` | 4d | on-change |
| `inventory-heartbeat` | 28m | periodic |
| `k8s-argocd-health-test` | 16h | periodic |
| `k8s-lane-partition` | 9h | on-change |
| `keyring-dst1000` | 7h | on-change |
| `lean-proof` | 25h | on-change |
| `lint-autofix-apply` | 7m | on-demand |
| `low-memory` | 29m | periodic |
| `macos-install-sh-test` | 3h | periodic |
| `memory-index-drift` | 9h | on-change |
| `memory-index-duplicate-lint` | 9h | on-change |
| `memory-index-integrity` | 9h | on-change |
| `memory-reference-existence-lint` | 9h | on-change |
| `multiboot-qemu-uefi-smoke` | 23h | on-change |
| `pages-build-deployment` | 20d | unknown |
| `pr-categorization-cadence` | 8m | periodic |
| `razor-cadence` | 24h | periodic |
| `rerun-toolchain-install-stall` | 13m | periodic |
| `role-ref-current-state-surfaces-lint` | 5h | on-change |
| `scorecard` | 3d | periodic |
| `skill-description-lint` | 2d | on-change |
| `society-heartbeat` | 10m | periodic |
| `soraya-formal-coverage-cadence` | 24h | periodic |
| `stryker-mutation` | 25h | on-change |
| `udp-lossy-tests` | 7m | on-change |
| `update-graph` | 26h | unknown |
| `vocab-hygiene` | 16d | on-change |
| `wsl-install-sh-test` | 2h | periodic |
| `zflash-harness-lint` | 4d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
