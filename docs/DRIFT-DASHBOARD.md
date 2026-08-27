# Zeta drift dashboard

> **NOT OK — RED 15 · FLAPPING 4 · UNKNOWN 7, incl. NEVER observed · coverage 75/82 (SHORTFALL 7) · green 59 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-27T22:00:53.238Z |
| producers | github-actions |
| roster | 97 known checks — 82 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **75 / 82** — **SHORTFALL 7** |

## RED — 15

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `chart-version-refresh` | 4d | periodic | run 32654132313 concluded 'failure' |
| `ruleset-apply` | 2d | on-change | run 32857443217 concluded 'failure' |
| `manifesto-citation-snapshot-cadence` | 12h | periodic | run 33060396438 concluded 'failure' |
| `drift-dashboard-cadence` | 6h | periodic | run 33093225449 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `search-index-cadence` | 5h | periodic | run 33096328619 concluded 'failure' |
| `mux-swarm-tick` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 60m (schedule: `0 * * * *`) |
| `lockfile-healer` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 17m (schedule: `*/17 * * * *`) |
| `pr-gate-presence` | 3h | periodic | MOSTLY FAILING over 7d (16 of 20 concluded runs failed, 2026-08-26T09:35:41Z .. 2026-08-27T19:01:58Z, 2 consecutive pass(es) since the last failure). The newest run passed and is the outlier — a majority-failing lane is broken, not flaky. |
| `drift-sweep` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 30m (schedule: `7,37 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T21:59:59Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `archive-strand-alarm` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 30m (schedule: `13,43 * * * *`) |
| `zetadb-scheduled-node` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 30m (schedule: `13,43 * * * *`) |
| `agent-heartbeat` | 2h | periodic | run 33112683636 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'red' at 2026-08-27T20:35:51Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `rerun-toolchain-install-stall` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 15m (schedule: `*/15 * * * *`) |
| `tick-metrics` | 45m | periodic | STALE: newest verdict (green) is 45m old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T21:47:51Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `pr-categorization-cadence` | 10m | periodic | run 33119944580 concluded 'failure' |

## FLAPPING — 4

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `tlaps-proof` | on-change | FLAPPING over 7d (2 of 7 concluded runs failed, 2026-08-22T01:22:36Z .. 2026-08-26T08:34:27Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `pr-manifest-integrity` | periodic | FLAPPING over 7d (9 of 20 concluded runs failed, 2026-08-23T00:38:08Z .. 2026-08-27T21:38:13Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `proof-closure-drift` | periodic | FLAPPING over 7d (8 of 19 concluded runs failed, 2026-08-23T00:38:56Z .. 2026-08-27T21:41:17Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `heartbeat-liveness` | periodic | FLAPPING over 7d (9 of 18 concluded runs failed, 2026-08-26T15:39:25Z .. 2026-08-27T21:48:47Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |

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
| `docker-windows-install-ps1-test` | 15h | not-observed-this-pass | periodic | run 33045356361 was CANCELLED — its jobs never executed, so it established no verdict · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T20:59:34Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |

## Not yet due — 0

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

_none_

## Running (0) / skipped (1)

| check | state | detail |
| --- | --- | --- |
| `rerun-cancelled-gate` | skipped | run 33120635582 was skipped |

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
| `accelerator-move-next` | 90d | on-demand |
| `agencysignature-enforcement` | 2m | on-change |
| `agent-proposal-gated-commit` | 10d | on-demand |
| `agentic-organization-tests` | 37h | on-change |
| `arc-lane` | 25h | on-change |
| `artifact-freshness` | 2h | periodic |
| `auto-submission` | 4m | unknown |
| `backlog-index-integrity` | 17h | on-change |
| `budget-snapshot-cadence` | 4d | periodic |
| `build-ai-cluster-iso` | 53m | on-change |
| `build-platform-images` | 37h | on-change |
| `bytelock` | 2d | on-change |
| `ci-cache-paths-lint` | 28m | on-change |
| `ci-runtime-image` | 78m | on-change |
| `codeql` | 2m | unknown |
| `context-cost-trend-cadence` | 11h | periodic |
| `copilot-pull-request-reviewer` | 27d | unknown |
| `dependabot-updates` | 2d | unknown |
| `docker-nixos-install-sh-test` | 16h | periodic |
| `docker-ubuntu-install-sh-test` | 17h | periodic |
| `docker-ubuntu-jammy-install-sh-test` | 17h | periodic |
| `factory-hygiene-audit-cadence` | 4h | periodic |
| `gate` | 2m | on-change |
| `git-hotspot-cadence` | 4d | periodic |
| `gitbash-install-routing-test` | 15h | periodic |
| `github-settings-drift` | 3d | periodic |
| `helm-validate` | 3h | periodic |
| `installer-repair-mode-existing-install` | 4m | on-change |
| `installer-unit-tests` | 3m | on-change |
| `interp-lane` | 36h | on-change |
| `inventory-hardening-check` | 5d | on-change |
| `inventory-heartbeat` | 13h | periodic |
| `k8s-argocd-health-test` | 76m | periodic |
| `k8s-lane-partition` | 22h | on-change |
| `keyring-dst1000` | 19h | on-change |
| `lean-proof` | 37h | on-change |
| `lint-autofix-apply` | 4m | on-demand |
| `low-memory` | 13h | periodic |
| `macos-install-sh-test` | 15h | periodic |
| `memory-index-drift` | 64m | on-change |
| `memory-index-duplicate-lint` | 64m | on-change |
| `memory-index-integrity` | 65m | on-change |
| `memory-reference-existence-lint` | 64m | on-change |
| `mirror-to-fork` | 10h | periodic |
| `multiboot-qemu-uefi-smoke` | 35h | on-change |
| `pages-build-deployment` | 21d | unknown |
| `pages-deploy` | 10m | periodic |
| `razor-cadence` | 9h | periodic |
| `role-ref-current-state-surfaces-lint` | 14m | on-change |
| `scorecard` | 4d | periodic |
| `skill-description-lint` | 3d | on-change |
| `society-heartbeat` | 43m | periodic |
| `soraya-formal-coverage-cadence` | 9h | periodic |
| `stryker-mutation` | 38h | on-change |
| `udp-lossy-tests` | 2m | on-change |
| `update-graph` | 38h | unknown |
| `vocab-hygiene` | 17d | on-change |
| `wsl-install-sh-test` | 15h | periodic |
| `zflash-harness-lint` | 4d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
