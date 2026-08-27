# Zeta drift dashboard

> **NOT OK — RED 16 · FLAPPING 2 · UNKNOWN 7, incl. NEVER observed · coverage 75/82 (SHORTFALL 7) · green 61 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-27T16:27:05.239Z |
| producers | github-actions |
| roster | 97 known checks — 82 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **75 / 82** — **SHORTFALL 7** |

## RED — 16

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `chart-version-refresh` | 4d | periodic | run 32654132313 concluded 'failure' |
| `ruleset-apply` | 2d | on-change | run 32857443217 concluded 'failure' |
| `drift-dashboard-cadence` | 7h | periodic | run 33060534356 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `manifesto-citation-snapshot-cadence` | 7h | periodic | run 33060396438 concluded 'failure' |
| `tick-metrics` | 6h | periodic | STALE: newest verdict (green) is 6h old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T14:59:51Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `agent-heartbeat` | 6h | periodic | STALE: newest verdict (green) is 6h old, declared to run every 15m (schedule: `*/15 * * * *`) |
| `search-index-cadence` | 6h | periodic | run 33063740803 concluded 'failure' |
| `rerun-toolchain-install-stall` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 15m (schedule: `*/15 * * * *`) |
| `society-heartbeat` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 30m (schedule: `*/30 * * * *`) |
| `heartbeat-liveness` | 2h | periodic | run 33082190195 concluded 'failure' |
| `pages-deploy` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T16:24:29Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `lockfile-healer` | 89m | periodic | STALE: newest verdict (green) is 89m old, declared to run every 17m (schedule: `*/17 * * * *`) |
| `pr-gate-presence` | 84m | periodic | MOSTLY FAILING over 7d (17 of 20 concluded runs failed, 2026-08-26T08:36:04Z .. 2026-08-27T15:03:27Z, 1 consecutive pass(es) since the last failure). The newest run passed and is the outlier — a majority-failing lane is broken, not flaky. |
| `build-ai-cluster-iso` | 47m | on-change | MOSTLY FAILING over 7d (9 of 17 concluded runs failed, 2026-08-26T22:58:13Z .. 2026-08-27T15:40:25Z, 3 consecutive pass(es) since the last failure). The newest run passed and is the outlier — a majority-failing lane is broken, not flaky. |
| `pr-manifest-integrity` | 21m | periodic | run 33091388084 concluded 'failure' |
| `gate` | 9m | on-change | run 33090868892 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

## FLAPPING — 2

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `tlaps-proof` | on-change | FLAPPING over 7d (2 of 7 concluded runs failed, 2026-08-22T01:22:36Z .. 2026-08-26T08:34:27Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `proof-closure-drift` | periodic | FLAPPING over 7d (8 of 19 concluded runs failed, 2026-08-22T18:35:54Z .. 2026-08-27T09:32:35Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |

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
| `docker-windows-install-ps1-test` | 9h | not-observed-this-pass | periodic | run 33045356361 was CANCELLED — its jobs never executed, so it established no verdict |

## Not yet due — 0

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

_none_

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

## Green — 61

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 89d | on-demand |
| `agencysignature-enforcement` | 4m | on-change |
| `agent-proposal-gated-commit` | 10d | on-demand |
| `agentic-organization-tests` | 32h | on-change |
| `arc-lane` | 20h | on-change |
| `archive-strand-alarm` | 66m | periodic |
| `artifact-freshness` | 32m | periodic |
| `auto-submission` | 3m | unknown |
| `backlog-index-integrity` | 11h | on-change |
| `budget-snapshot-cadence` | 4d | periodic |
| `build-platform-images` | 31h | on-change |
| `bytelock` | 2d | on-change |
| `ci-cache-paths-lint` | 10h | on-change |
| `ci-runtime-image` | 14h | on-change |
| `codeql` | 6m | unknown |
| `context-cost-trend-cadence` | 6h | periodic |
| `copilot-pull-request-reviewer` | 27d | unknown |
| `dependabot-updates` | 2d | unknown |
| `docker-nixos-install-sh-test` | 11h | periodic |
| `docker-ubuntu-install-sh-test` | 11h | periodic |
| `docker-ubuntu-jammy-install-sh-test` | 11h | periodic |
| `drift-sweep` | 60m | periodic |
| `factory-hygiene-audit-cadence` | 25h | periodic |
| `git-hotspot-cadence` | 4d | periodic |
| `gitbash-install-routing-test` | 9h | periodic |
| `github-settings-drift` | 3d | periodic |
| `helm-validate` | 24h | periodic |
| `installer-repair-mode-existing-install` | 17h | on-change |
| `installer-unit-tests` | 12h | on-change |
| `interp-lane` | 31h | on-change |
| `inventory-hardening-check` | 5d | on-change |
| `inventory-heartbeat` | 7h | periodic |
| `k8s-argocd-health-test` | 22h | periodic |
| `k8s-lane-partition` | 16h | on-change |
| `keyring-dst1000` | 14h | on-change |
| `lean-proof` | 32h | on-change |
| `lint-autofix-apply` | 2m | on-demand |
| `low-memory` | 7h | periodic |
| `macos-install-sh-test` | 10h | periodic |
| `memory-index-drift` | 16h | on-change |
| `memory-index-duplicate-lint` | 16h | on-change |
| `memory-index-integrity` | 16h | on-change |
| `memory-reference-existence-lint` | 16h | on-change |
| `mirror-to-fork` | 5h | periodic |
| `multiboot-qemu-uefi-smoke` | 29h | on-change |
| `mux-swarm-tick` | 2h | periodic |
| `pages-build-deployment` | 20d | unknown |
| `pr-categorization-cadence` | 7m | periodic |
| `razor-cadence` | 4h | periodic |
| `rerun-cancelled-gate` | 6s | on-demand |
| `role-ref-current-state-surfaces-lint` | 12h | on-change |
| `scorecard` | 3d | periodic |
| `skill-description-lint` | 2d | on-change |
| `soraya-formal-coverage-cadence` | 3h | periodic |
| `stryker-mutation` | 32h | on-change |
| `udp-lossy-tests` | 88s | on-change |
| `update-graph` | 32h | unknown |
| `vocab-hygiene` | 17d | on-change |
| `wsl-install-sh-test` | 9h | periodic |
| `zetadb-scheduled-node` | 66m | periodic |
| `zflash-harness-lint` | 4d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
