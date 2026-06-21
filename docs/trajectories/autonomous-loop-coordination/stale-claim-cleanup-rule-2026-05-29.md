# Stale Claim Cleanup Rule - 2026-05-29

Status: classifier rule landed in `tools/claims/remote-only-state.ts`
Grounding backlog:
`docs/backlog/P2/081KQX9B50008QG0R001MNYK61-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
and
`docs/backlog/P1/081KQX9B50008QG0R0026BG44J-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/remote-only-claim-release-receipt-2026-05-29.md`

## Scope

This packet adds a bounded cleanup classifier for completed-PR claim residue.
It does not delete claim branches, force-release stale claims, change runner
behavior, or treat GitHub comments as the lock.

The rule exists because remote-only participants must be able to tell the
difference between three states without reading a local broadcast bus:

- active claim branch, still not reachable from `origin/main`
- merged claim residue, where a `claim/*` head is already reachable from main
  but its claim file remains readable
- broken claim branch, where the remote claim ref exists but the expected
  `docs/claims/<slug>.md` file is absent

## Rule

`tools/claims/remote-only-state.ts` now classifies every remote `claim/*` ref:

| Disposition | Meaning | Required behavior |
|---|---|---|
| `active` | Claim head is not reachable from `origin/main`. | Treat the path set as owned until release, handoff, or documented stale force-release. |
| `merged-claim-residue` | Claim head is reachable from `origin/main` and the claim file is still readable. | Do not call the path free from branch absence alone. Add a release commit or cleanup receipt before clearing the residue. |
| `missing-claim-file` | Claim branch exists but the expected claim file is missing. | Inspect branch history; retire the remote ref only after recording release evidence. |
| `merge-state-unknown` | Local git cannot prove reachability against `origin/main`. | Refresh remote refs and retry before force-releasing or overlapping the path set. |

The classifier uses only git surfaces available to a fresh clone:

```text
git fetch --prune origin
git ls-remote --heads origin claim/*
git merge-base --is-ancestor <claim-sha> origin/main
git show origin/claim/<slug>:docs/claims/<slug>.md
```

It does not inspect `.git/agent-heartbeats`, local broadcasts, terminal logs,
shared worktree names, or GitHub PR metadata.

## Why `merged-claim-residue` Is Not Free

The claim protocol says completed work should release its claim through durable
git history, preferably in the same PR that lands the work. A claim branch that
is already reachable from main but still exposes a claim file is completed
work with unreconciled claim residue. It is weaker than an active unmerged
claim, but it is not an ownership-free signal.

The safe cleanup path is one of:

- release commit that deletes `docs/claims/<slug>.md`
- force-release commit after the documented stale window
- cleanup receipt that names weaker remote-head retirement evidence

## Verification

Focused tests cover:

- active remote claim refs
- merged claim residue
- missing claim-file refs
- unknown merge-state classification
- network-bound remote git calls still using the configured timeout

## Next Step

Use this classifier in the loop hygiene pass before selecting new work from an
apparently quiet queue. If all open PR lanes are quiet but remote claims remain,
classify the claims first and avoid overlapping any `active` or
`merge-state-unknown` path set.
