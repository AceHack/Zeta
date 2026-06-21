# Stale Claim Audit Receipt - 2026-05-30

Status: audit receipt in review
Surface: codex-background-service
Origin: desktop heartbeat `vera-desktop-loop`
Session: codex/20260530T0434Z
Claim: `claim/codex-stale-claim-audit-20260530`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/stale-claim-cleanup-rule-2026-05-29.md`

## Scope

This receipt records the first bounded audit pass after the factory health
monitor reported a stale-claim warning:

- observed claim branches: 30
- current Codex audit claim: 1
- pre-existing claim branches older than 24 hours: 29
- readable claim files at expected `docs/claims/<slug>.md` path: 5
- missing expected claim files: 25
- missing-file claim heads already reachable from `origin/main`: 3

This packet does not delete remote branches, force-release another agent's
work, or treat missing claim files as proof that a path set is free.

## Evidence Commands

The audit used only remote git and repo-local tooling from the dedicated Codex
claim worktree:

```bash
git fetch --all --prune
git for-each-ref --format='%(refname:short)|%(committerdate:iso-strict)|%(objectname:short)|%(subject)' refs/remotes/origin/claim
git branch -r --merged origin/main --list 'origin/claim/*'
git branch -r --no-merged origin/main --list 'origin/claim/*'
bun tools/claims/remote-only-state.ts --json --no-fetch
```

`tools/claims/remote-only-state.ts` emitted JSON but exited non-zero because
25 remote claim refs lack the expected claim file. That is the signal being
audited, not a clean-check failure.

## High-Confidence Cleanup Candidates

These remote claim heads are already reachable from `origin/main` and lack the
expected claim file:

```text
origin/claim/b0140-bash-ts-migration-smallest-slice-riven-2026-05-08
origin/claim/b0271-pm2-first-research-pass-2026-05-08
origin/claim/b0325-peer-call-firewall-kiro-claude-smallest-slice-riven-2026-05-09
```

Next safe action for these three is a remote-ref cleanup receipt or branch
retirement step that records the reachability evidence before deleting the
remote refs.

## Still-Owned Or Needs Explicit Force-Release

These refs expose readable claim files and are not reachable from
`origin/main`; they should remain treated as owned until release, handoff, or a
documented stale force-release:

```text
origin/claim/b0323-redecomp-pure-diff-engine-riven-2026-05-10
origin/claim/backlog-0249-tier1-runner
origin/claim/kiro-background-service-2026-05-09
origin/claim/pr3315-thread-resolution-copilot-2026-05-14
```

The current Codex audit claim also appears in this category while this branch
is open:

```text
origin/claim/codex-stale-claim-audit-20260530
```

## Missing-File Unmerged Refs

The remaining missing-file refs are not reachable from `origin/main`.
Conservative behavior is to inspect branch history before retiring any of
them, because the missing claim file prevents path-set reconstruction:

```text
origin/claim/081KPYCJH0008QG0R003MDS51N-close-example-schema-self-reference
origin/claim/081KR7JY10008QG0R002PKC6B0-aminata-heartbeat-review-2026-05-10
origin/claim/081KQ3HBZ0008QG0R000H8K8CC.2-lean-reflection-stage2-tactic-authoring
origin/claim/b0011-pliny-carve-out-smallest-slice-riven-2026-05-09
origin/claim/b0018-agency-evidence-stress-test-decompose-smallest-atomic-children-riven-2026-05-09
origin/claim/b0021-aurora-econ-foundation-decompose-smallest-slice-riven-2026-05-09
origin/claim/b0037-decompose-meta-cognition-first-class-discipline-smallest-slice-riven-2026-05-09
origin/claim/b0089-decompose-smallest-atomic-children-riven-2026-05-11
origin/claim/b0190-decompose-smallest-atomic-children-riven-2026-05-08
origin/claim/b0269-extract-carved-smallest-slice-riven-2026-05-08
origin/claim/b0272-rom-canonical-naming-smallest-slice-2026-05-08
origin/claim/b0311-external-anchor-coverage-scanner-slice-2026-05-09
origin/claim/b0324-billing-reader-extractor-2026-05-09
origin/claim/b0326-kiro-peer-call-wrapper-2026-05-09
origin/claim/b0327-claude-ts-self-call-smallest-slice-riven-2026-05-09
origin/claim/b0361-anchor-human-lineage-2026-05-09
origin/claim/b0365.2-shadow-log-backfill-catches-16-30-2026-05-09
origin/claim/fix-memory-reference-drift-pr1801
origin/claim/task-autoloop-lifetime-tsc-20260528
origin/claim/task-b0171-openspec-inventory-tool
origin/claim/task-backlog-id-collision-b0865-b0866-20260528
origin/claim/trajectory-alignment-measurement-packet
```

`origin/claim/fix-memory-reference-drift-pr1801` is notable because its head
commit subject starts with `force-release`, but the head is not reachable from
`origin/main`; keep it in the inspect-before-retire queue until a cleanup
receipt records the branch-specific release evidence.

## Operational Reading

The stale-claim warning is valid. The current queue is not only "old claims";
it includes multiple residue classes:

- three high-confidence merged missing-file remote refs
- four old readable claim files that still look owned from remote-only state
- twenty-two unmerged missing-file refs that need branch-history inspection
- the current Codex audit claim

The safest next cleanup slice is the three merged missing-file refs. Do not
bulk-delete the whole `origin/claim/*` set.
