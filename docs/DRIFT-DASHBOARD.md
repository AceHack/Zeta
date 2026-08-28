# Zeta drift dashboard

> **NOT OK — RED 17 · FLAPPING 3 · UNKNOWN 7, incl. NEVER observed · coverage 75/82 (SHORTFALL 7) · green 58 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-28T03:31:25.399Z |
| producers | github-actions |
| roster | 97 known checks — 82 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **75 / 82** — **SHORTFALL 7** |

## RED — 17

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `chart-version-refresh` | 4d | periodic | run 32654132313 concluded 'failure' |
| `ruleset-apply` | 3d | on-change | run 32857443217 concluded 'failure' |
| `manifesto-citation-snapshot-cadence` | 18h | periodic | run 33060396438 concluded 'failure' |
| `drift-dashboard-cadence` | 6h | periodic | run 33120670518 concluded 'failure' · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |
| `search-index-cadence` | 5h | periodic | run 33123207650 concluded 'failure' |
| `tick-metrics` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-28T02:40:20Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `society-heartbeat` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 30m (schedule: `*/30 * * * *`) |
| `heartbeat-liveness` | 3h | periodic | run 33131260806 concluded 'failure' |
| `pages-deploy` | 3h | periodic | STALE: newest verdict (green) is 3h old, declared to run every 15m (schedule: `*/15 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-28T02:54:47Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `lockfile-healer` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 17m (schedule: `*/17 * * * *`) |
| `drift-sweep` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: `7,37 * * * *`) · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-28T02:54:45Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `archive-strand-alarm` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: `13,43 * * * *`) |
| `zetadb-scheduled-node` | 2h | periodic | STALE: newest verdict (green) is 2h old, declared to run every 30m (schedule: `13,43 * * * *`) |
| `pr-gate-presence` | 88m | periodic | run 33134746445 concluded 'failure' |
| `rerun-toolchain-install-stall` | 70m | periodic | STALE: newest verdict (green) is 70m old, declared to run every 15m (schedule: `*/15 * * * *`) |
| `agent-heartbeat` | 64m | periodic | STALE: newest verdict (green) is 64m old, declared to run every 15m (schedule: `7,22,37,52 * * * *`) |
| `gate` | 22m | on-change | run 33137257569 concluded 'failure' |

## FLAPPING — 3

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `tlaps-proof` | on-change | FLAPPING over 7d (2 of 7 concluded runs failed, 2026-08-22T01:22:36Z .. 2026-08-26T08:34:27Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `proof-closure-drift` | periodic | FLAPPING over 7d (8 of 19 concluded runs failed, 2026-08-23T06:37:02Z .. 2026-08-28T03:27:09Z, 3 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `pr-manifest-integrity` | periodic | FLAPPING over 7d (9 of 20 concluded runs failed, 2026-08-23T06:36:33Z .. 2026-08-28T03:27:38Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |

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
| `docker-windows-install-ps1-test` | 20h | not-observed-this-pass | periodic | run 33045356361 was CANCELLED — its jobs never executed, so it established no verdict · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-27T23:56:35Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |

## Not yet due — 0

Declared, correct, and **not yet owed a verdict** — its definition has not existed for a
full period. Its own state on purpose: calling it green claims a verdict nobody gave, and
calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.

_none_

## Running (0) / skipped (1)

| check | state | detail |
| --- | --- | --- |
| `rerun-cancelled-gate` | skipped | run 33138046154 was skipped |

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

## Green — 58

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 90d | on-demand |
| `agencysignature-enforcement` | 38m | on-change |
| `agent-proposal-gated-commit` | 11d | on-demand |
| `agentic-organization-tests` | 43h | on-change |
| `arc-lane` | 31h | on-change |
| `artifact-freshness` | 10m | periodic |
| `auto-submission` | 37m | unknown |
| `backlog-index-integrity` | 22h | on-change |
| `budget-snapshot-cadence` | 4d | periodic |
| `build-ai-cluster-iso` | 2h | on-change |
| `build-platform-images` | 42h | on-change |
| `bytelock` | 3d | on-change |
| `ci-cache-paths-lint` | 4h | on-change |
| `ci-runtime-image` | 7h | on-change |
| `codeql` | 33m | unknown |
| `context-cost-trend-cadence` | 17h | periodic |
| `copilot-pull-request-reviewer` | 27d | unknown |
| `dependabot-updates` | 3d | unknown |
| `docker-nixos-install-sh-test` | 22h | periodic |
| `docker-ubuntu-install-sh-test` | 22h | periodic |
| `docker-ubuntu-jammy-install-sh-test` | 22h | periodic |
| `factory-hygiene-audit-cadence` | 9h | periodic |
| `git-hotspot-cadence` | 4d | periodic |
| `gitbash-install-routing-test` | 20h | periodic |
| `github-settings-drift` | 4d | periodic |
| `helm-validate` | 8h | periodic |
| `installer-repair-mode-existing-install` | 6h | on-change |
| `installer-unit-tests` | 4h | on-change |
| `interp-lane` | 42h | on-change |
| `inventory-hardening-check` | 5d | on-change |
| `inventory-heartbeat` | 18h | periodic |
| `k8s-argocd-health-test` | 7h | periodic |
| `k8s-lane-partition` | 27h | on-change |
| `keyring-dst1000` | 25h | on-change |
| `lean-proof` | 43h | on-change |
| `lint-autofix-apply` | 63m | on-demand |
| `low-memory` | 18h | periodic |
| `macos-install-sh-test` | 21h | periodic |
| `memory-index-drift` | 4h | on-change |
| `memory-index-duplicate-lint` | 7h | on-change |
| `memory-index-integrity` | 4h | on-change |
| `memory-reference-existence-lint` | 4h | on-change |
| `mirror-to-fork` | 16h | periodic |
| `multiboot-qemu-uefi-smoke` | 40h | on-change |
| `mux-swarm-tick` | 2h | periodic |
| `pages-build-deployment` | 21d | unknown |
| `pr-categorization-cadence` | 58s | periodic |
| `razor-cadence` | 15h | periodic |
| `role-ref-current-state-surfaces-lint` | 5h | on-change |
| `scorecard` | 4d | periodic |
| `skill-description-lint` | 3d | on-change |
| `soraya-formal-coverage-cadence` | 14h | periodic |
| `stryker-mutation` | 4h | on-change |
| `udp-lossy-tests` | 38m | on-change |
| `update-graph` | 43h | unknown |
| `vocab-hygiene` | 17d | on-change |
| `wsl-install-sh-test` | 20h | periodic |
| `zflash-harness-lint` | 5d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
