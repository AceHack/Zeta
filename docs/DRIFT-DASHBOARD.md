# Zeta drift dashboard

> **NOT OK — RED 7 · FLAPPING 6 · UNKNOWN 4, incl. NEVER observed · coverage 61/65 (SHORTFALL 4) · green 50 · not-yet-due 2 · on-demand 15**

A check that was never observed must never render identically to a check that passed.
`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved
check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.

| | |
|---|---|
| ref | `main` |
| pass at | 2026-08-22T22:45:17.747Z |
| producers | github-actions |
| roster | 80 known checks — 65 expected to report on this ref, 15 on-demand, 0 retired |
| coverage | **61 / 65** — **SHORTFALL 4** |

## RED — 7

Oldest first: a check red since the 16th outranks one red five minutes ago.

| check | red for | expectation | detail |
| --- | --- | --- | --- |
| `budget-snapshot-cadence` | 6d | periodic | run 31959534906 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-22T18:14:12Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `tlaps-proof` | 21h | on-change | run 32542476787 concluded 'failure' |
| `manifesto-citation-snapshot-cadence` | 16h | periodic | run 32558211949 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-22T18:14:11Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `context-cost-trend-cadence` | 15h | periodic | run 32559948214 concluded 'failure' · **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green' at 2026-08-22T18:12:10Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `pr-manifest-integrity` | 4h | periodic | MOSTLY FAILING over 7d (15 of 20 concluded runs failed, 2026-08-18T00:36:18Z .. 2026-08-22T18:33:49Z, 1 consecutive pass(es) since the last failure). The newest run passed and is the outlier — a majority-failing lane is broken, not flaky. |
| `gate` | 9m | on-change | run 32602031050 concluded 'failure' |
| `agent-heartbeat` | 3m | periodic | run 32603064749 concluded 'failure' |

## FLAPPING — 6

Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own
state because neither neighbour is honest: green would launder a 90% claim as a 100%
one, and red would make an oscillating lane permanently red until the alarm is muted.
A lane whose next verdict is a coin flip has no colour, so it gets its own.

| check | expectation | detail |
| --- | --- | --- |
| `backlog-index-integrity` | on-change | FLAPPING over 7d (2 of 8 concluded runs failed, 2026-08-16T14:01:34Z .. 2026-08-20T16:50:56Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `memory-index-drift` | on-change | FLAPPING over 7d (3 of 10 concluded runs failed, 2026-08-16T20:01:07Z .. 2026-08-22T18:07:03Z, 3 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `installer-unit-tests` | on-change | FLAPPING over 7d (2 of 20 concluded runs failed, 2026-08-17T03:32:50Z .. 2026-08-22T21:37:51Z, 4 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `agencysignature-enforcement` | on-change | FLAPPING over 7d (2 of 20 concluded runs failed, 2026-08-22T19:49:12Z .. 2026-08-22T22:18:18Z, 4 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `k8s-lane-partition` | on-change | FLAPPING over 7d (5 of 10 concluded runs failed, 2026-08-22T17:06:37Z .. 2026-08-22T22:18:24Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. |
| `build-ai-cluster-iso` | on-change | FLAPPING over 7d (3 of 17 concluded runs failed, 2026-08-21T17:22:15Z .. 2026-08-22T22:29:21Z, 2 consecutive pass(es) since the last failure), and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it. · **recheck in flight — this is the last CONCLUDED verdict, not a current one** |

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
| `drift-dashboard-cadence` | periodic | declared to run every 6h (schedule: '41 \*/6 \* \* \*') and its definition landed only 3h ago, less than one full period — no verdict is owed yet |

## Running (0) / skipped (2)

| check | state | detail |
| --- | --- | --- |
| `mirror-to-fork` | skipped | run 32590487948 was skipped · **awaiting scheduled confirmation** — a later delete run concluded 'skipped' at 2026-08-22T22:17:43Z, NEWER than the verdict above. The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. This row clears when the next scheduled run passes. |
| `rerun-cancelled-gate` | skipped | run 32602895045 was skipped |

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

## Green — 50

<details><summary>show</summary>

| check | verdict age | expectation |
| --- | --- | --- |
| `accelerator-move-next` | 85d | on-demand |
| `agent-proposal-gated-commit` | 5d | on-demand |
| `auto-submission` | 27m | unknown |
| `build-platform-images` | 40h | on-change |
| `bytelock` | 5d | on-change |
| `ci-cache-paths-lint` | 33m | on-change |
| `codeql` | 24m | unknown |
| `copilot-pull-request-reviewer` | 22d | unknown |
| `dependabot-updates` | 7h | unknown |
| `docker-nixos-install-sh-test` | 2h | on-change |
| `docker-ubuntu-jammy-install-sh-test` | 11h | on-change |
| `docker-windows-install-ps1-test` | 2h | on-change |
| `drift-sweep` | 30m | periodic |
| `factory-hygiene-audit-cadence` | 8h | periodic |
| `git-hotspot-cadence` | 6d | periodic |
| `gitbash-install-routing-test` | 11h | on-change |
| `github-settings-drift` | 5d | periodic |
| `heartbeat-liveness` | 6m | periodic |
| `helm-validate` | 7h | periodic |
| `inventory-hardening-check` | 4d | on-change |
| `inventory-heartbeat` | 16h | periodic |
| `k8s-argocd-health-test` | 5h | periodic |
| `keyring-dst1000` | 22h | on-change |
| `lean-proof` | 2h | on-change |
| `lint-autofix-apply` | 2m | on-demand |
| `lockfile-healer` | 3m | periodic |
| `low-memory` | 16h | periodic |
| `macos-install-sh-test` | 11h | on-change |
| `memory-index-duplicate-lint` | 5h | on-change |
| `memory-index-integrity` | 5h | on-change |
| `memory-reference-existence-lint` | 5h | on-change |
| `multiboot-qemu-uefi-smoke` | 6d | on-change |
| `mux-swarm-tick` | 39m | periodic |
| `pages-build-deployment` | 16d | unknown |
| `pages-deploy` | 3m | periodic |
| `proof-closure-drift` | 4h | periodic |
| `razor-cadence` | 13h | periodic |
| `role-ref-current-state-surfaces-lint` | 2d | on-change |
| `scorecard` | 6d | periodic |
| `skill-description-lint` | 2d | on-change |
| `society-heartbeat` | 4m | periodic |
| `soraya-formal-coverage-cadence` | 13h | periodic |
| `stryker-mutation` | 7d | on-change |
| `tick-metrics` | 6m | periodic |
| `udp-lossy-tests` | 27m | on-change |
| `update-graph` | 21d | unknown |
| `vocab-hygiene` | 12d | on-change |
| `wsl-install-sh-test` | 11h | on-change |
| `zetadb-scheduled-node` | 25m | periodic |
| `zflash-harness-lint` | 6d | periodic |

</details>

---

Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at
`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are
both events you can see in a `git diff`. A vanished check keeps its slot and keeps being
counted; retirement is written by hand, with a reason, and by nothing else.
