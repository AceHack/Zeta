# Zeta drift dashboard

> **NOT OK — RED 9 · FLAPPING 8 · UNKNOWN 4, incl. NEVER observed · coverage 61/65 (SHORTFALL 4) · green 46 · not-yet-due 2 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-22T22:04:06.568Z |
| producers | github-actions |
| roster | 80 known checks — 65 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **61 / 65** — **SHORTFALL 4** |

## RED — 9

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `vocab-hygiene` | 12d | on-change | MOSTLY FAILING: 12 of the last 20 CONCLUDED runs failed. The newest run passed, and it is the outlier — a majority-failing lane is broken, not flaky. |
| `budget-snapshot-cadence` | 6d | periodic | run 31959534906 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-22T18:14:12Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `agent-proposal-gated-commit` | 5d | on-demand | MOSTLY FAILING: 2 of the last 3 CONCLUDED runs failed. The newest run passed, and it is the outlier — a majority-failing lane is broken, not flaky. |
| `tlaps-proof` | 21h | on-change | run 32542476787 concluded 'failure' |
| `manifesto-citation-snapshot-cadence` | 15h | periodic | run 32558211949 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-22T18:14:11Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `context-cost-trend-cadence` | 14h | periodic | run 32559948214 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-22T18:12:10Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `pr-manifest-integrity` | 4h | periodic | MOSTLY FAILING: 15 of the last 20 CONCLUDED runs failed. The newest run passed, and it is the outlier — a majority-failing lane is broken, not flaky. |
| `k8s-lane-partition` | 58m | on-change | MOSTLY FAILING: 5 of the last 9 CONCLUDED runs failed. The newest run passed, and it is the outlier — a majority-failing lane is broken, not flaky. |
| `gate` | 3m | on-change | MOSTLY FAILING: 7 of the last 11 CONCLUDED runs failed. The newest run passed, and it is the outlier — a majority-failing lane is broken, not flaky. |

## FLAPPING — 8

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `github-settings-drift` | periodic | FLAPPING: 6 of the last 16 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `backlog-index-integrity` | on-change | FLAPPING: 8 of the last 19 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `k8s-argocd-health-test` | periodic | FLAPPING: 2 of the last 18 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. · **awaiting scheduled confirmation** — a later push run concluded 'green' at 2026-08-22T21:23:45Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `memory-index-drift` | on-change | FLAPPING: 6 of the last 19 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `docker-windows-install-ps1-test` | on-change | FLAPPING: 2 of the last 18 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `installer-unit-tests` | on-change | FLAPPING: 2 of the last 20 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `agencysignature-enforcement` | on-change | FLAPPING: 2 of the last 20 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `build-ai-cluster-iso` | on-change | FLAPPING: 3 of the last 16 CONCLUDED runs failed, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

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
| `chart-version-refresh` | periodic | declared to run every 7d (schedule: '7 17 \* \* 0') and its definition landed only 26h ago, less than one full period — no verdict is owed yet |
| `drift-dashboard-cadence` | periodic | declared to run every 6h (schedule: '41 \*/6 \* \* \*') and its definition landed only 2h ago, less than one full period — no verdict is owed yet |

## Running (0) / skipped (2)

| check | state | detail |
| --- | --- | --- |
| `mirror-to-fork` | skipped | run 32590487948 was skipped · **awaiting scheduled confirmation** — a later delete run concluded 'skipped' at 2026-08-22T21:50:03Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `rerun-cancelled-gate` | skipped | run 32601274123 was skipped |

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

## Green — 46

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 85d | on-demand |
| `agent-heartbeat` | 8m | periodic |
| `auto-submission` | 8m | unknown |
| `build-platform-images` | 40h | on-change |
| `bytelock` | 5d | on-change |
| `ci-cache-paths-lint` | 28m | on-change |
| `codeql` | 5m | unknown |
| `copilot-pull-request-reviewer` | 22d | unknown |
| `dependabot-updates` | 7h | unknown |
| `docker-nixos-install-sh-test` | 2h | on-change |
| `docker-ubuntu-jammy-install-sh-test` | 10h | on-change |
| `drift-sweep` | 19m | periodic |
| `factory-hygiene-audit-cadence` | 7h | periodic |
| `git-hotspot-cadence` | 6d | periodic |
| `gitbash-install-routing-test` | 10h | on-change |
| `heartbeat-liveness` | 12m | periodic |
| `helm-validate` | 6h | periodic |
| `inventory-hardening-check` | 4d | on-change |
| `inventory-heartbeat` | 16h | periodic |
| `keyring-dst1000` | 21h | on-change |
| `lean-proof` | 83m | on-change |
| `lint-autofix-apply` | 10m | on-demand |
| `lockfile-healer` | 7m | periodic |
| `low-memory` | 16h | periodic |
| `macos-install-sh-test` | 10h | on-change |
| `memory-index-duplicate-lint` | 4h | on-change |
| `memory-index-integrity` | 4h | on-change |
| `memory-reference-existence-lint` | 4h | on-change |
| `multiboot-qemu-uefi-smoke` | 6d | on-change |
| `mux-swarm-tick` | 58m | periodic |
| `pages-build-deployment` | 16d | unknown |
| `pages-deploy` | 10m | periodic |
| `proof-closure-drift` | 3h | periodic |
| `razor-cadence` | 13h | periodic |
| `role-ref-current-state-surfaces-lint` | 2d | on-change |
| `scorecard` | 6d | periodic |
| `skill-description-lint` | 2d | on-change |
| `society-heartbeat` | 24m | periodic |
| `soraya-formal-coverage-cadence` | 12h | periodic |
| `stryker-mutation` | 7d | on-change |
| `tick-metrics` | 12m | periodic |
| `udp-lossy-tests` | 14m | on-change |
| `update-graph` | 21d | unknown |
| `wsl-install-sh-test` | 10h | on-change |
| `zetadb-scheduled-node` | 15m | periodic |
| `zflash-harness-lint` | 6d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
