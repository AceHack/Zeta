# Zeta drift dashboard

> **NOT OK — RED 13 · FLAPPING 4 · UNKNOWN 6, incl. NEVER observed · coverage 74/80 (SHORTFALL 6) · green 59 · not-yet-due 1 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-27T05:04:46.455Z |
| producers | github-actions |
| roster | 95 known checks — 80 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **74 / 80** — **SHORTFALL 6** |

## RED — 13

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `chart-version-refresh` | 3d | periodic | run 32654132313 concluded 'failure' |
| `ruleset-apply` | 39h | on-change | run 32857443217 concluded 'failure' |
| `mirror-to-fork` | 23h | periodic | run 32937913382 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-26T08:47:51Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `manifesto-citation-snapshot-cadence` | 22h | periodic | run 32940492136 concluded 'failure' |
| `proof-closure-drift` | 3h | periodic | run 33032035933 concluded 'failure' · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T02:42:27Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `drift-dashboard-cadence` | 3h | periodic | run 33032413847 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'red' at 2026-08-27T03:30:46Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `search-index-cadence` | 2h | periodic | run 33034997092 concluded 'failure' |
| `rerun-toolchain-install-stall` | 59m | periodic | STALE: newest verdict (green) is 59m old, declared to run every 15m (schedule: `*/15 * * * *`) |
| `pr-gate-presence` | 58m | periodic | run 33038374306 concluded 'failure' |
| `tick-metrics` | 48m | periodic | STALE: newest verdict (green) is 48m old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T04:51:01Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `agent-heartbeat` | 27m | periodic | run 33039783444 concluded 'failure' |
| `build-ai-cluster-iso` | 10m | on-change | run 33039102948 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `gate` | 4m | on-change | run 33040374519 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

## FLAPPING — 4

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `context-cost-trend-cadence` | periodic | FLAPPING over 7d (3 of 7 concluded runs failed, 2026-08-20T07:36:50Z .. 2026-08-26T07:37:49Z, 4 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `tlaps-proof` | on-change | FLAPPING over 7d (3 of 8 concluded runs failed, 2026-08-20T12:09:11Z .. 2026-08-26T08:34:27Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `pr-manifest-integrity` | periodic | FLAPPING over 7d (10 of 20 concluded runs failed, 2026-08-22T06:34:47Z .. 2026-08-27T02:04:23Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `heartbeat-liveness` | periodic | FLAPPING over 7d (6 of 17 concluded runs failed, 2026-08-26T14:04:53Z .. 2026-08-27T04:34:46Z, 1 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |

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

## Not yet due — 1

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

| check | expectation | detail |
| --- | --- | --- |
| `artifact-freshness` | periodic | declares schedule: `7 */2 * * *`, has only ever run from another trigger, and its definition landed only 87m ago, less than one full period — no scheduled run is owed yet |

## Running (1) / skipped (1)

| check | state | detail |
| --- | --- | --- |
| `docker-ubuntu-install-sh-test` | running | **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `rerun-cancelled-gate` | skipped | run 33041221070 was skipped |

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
| `agencysignature-enforcement` | 5s | on-change |
| `agent-proposal-gated-commit` | 10d | on-demand |
| `agentic-organization-tests` | 20h | on-change |
| `arc-lane` | 8h | on-change |
| `archive-strand-alarm` | 5m | periodic |
| `auto-submission` | 8s | unknown |
| `backlog-index-integrity` | 33h | on-change |
| `budget-snapshot-cadence` | 4d | periodic |
| `build-platform-images` | 20h | on-change |
| `bytelock` | 38h | on-change |
| `ci-cache-paths-lint` | 18m | on-change |
| `ci-runtime-image` | 2h | on-change |
| `codeql` | 16s | unknown |
| `copilot-pull-request-reviewer` | 26d | unknown |
| `dependabot-updates` | 38h | unknown |
| `docker-nixos-install-sh-test` | 14m | periodic |
| `docker-ubuntu-jammy-install-sh-test` | 2h | periodic |
| `docker-windows-install-ps1-test` | 2h | periodic |
| `drift-sweep` | 6m | periodic |
| `factory-hygiene-audit-cadence` | 14h | periodic |
| `git-hotspot-cadence` | 4d | periodic |
| `gitbash-install-routing-test` | 2h | periodic |
| `github-settings-drift` | 3d | periodic |
| `helm-validate` | 13h | periodic |
| `installer-repair-mode-existing-install` | 6h | on-change |
| `installer-unit-tests` | 17m | on-change |
| `interp-lane` | 19h | on-change |
| `inventory-hardening-check` | 4d | on-change |
| `inventory-heartbeat` | 23h | periodic |
| `k8s-argocd-health-test` | 11h | periodic |
| `k8s-lane-partition` | 5h | on-change |
| `keyring-dst1000` | 2h | on-change |
| `lean-proof` | 20h | on-change |
| `lint-autofix-apply` | 21s | on-demand |
| `lockfile-healer` | 8m | periodic |
| `low-memory` | 23h | periodic |
| `macos-install-sh-test` | 2h | periodic |
| `memory-index-drift` | 5h | on-change |
| `memory-index-duplicate-lint` | 5h | on-change |
| `memory-index-integrity` | 5h | on-change |
| `memory-reference-existence-lint` | 5h | on-change |
| `multiboot-qemu-uefi-smoke` | 18h | on-change |
| `mux-swarm-tick` | 82m | periodic |
| `pages-build-deployment` | 20d | unknown |
| `pages-deploy` | 29m | periodic |
| `razor-cadence` | 20h | periodic |
| `role-ref-current-state-surfaces-lint` | 25m | on-change |
| `scorecard` | 3d | periodic |
| `skill-description-lint` | 2d | on-change |
| `society-heartbeat` | 70m | periodic |
| `soraya-formal-coverage-cadence` | 19h | periodic |
| `stryker-mutation` | 21h | on-change |
| `udp-lossy-tests` | 11s | on-change |
| `update-graph` | 21h | unknown |
| `vocab-hygiene` | 16d | on-change |
| `wsl-install-sh-test` | 2h | periodic |
| `zetadb-scheduled-node` | 5m | periodic |
| `zflash-harness-lint` | 4d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
