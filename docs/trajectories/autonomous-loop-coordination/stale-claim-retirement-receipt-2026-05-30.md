# Stale Claim Retirement Receipt - 2026-05-30

Status: three high-confidence stale remote refs retired
Surface: codex-background-service
Origin: codex desktop heartbeat loop
Session: codex/20260530T0448Z
Claim: `claim/task-stale-claim-prune-high-confidence-20260530`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/stale-claim-audit-2026-05-30.md`

## Scope

This receipt covers only the three high-confidence stale claim refs identified
by the 2026-05-30 stale claim audit:

- `origin/claim/b0140-bash-ts-migration-smallest-slice-riven-2026-05-08`
- `origin/claim/b0271-pm2-first-research-pass-2026-05-08`
- `origin/claim/b0325-peer-call-firewall-kiro-claude-smallest-slice-riven-2026-05-09`

It does not bulk-delete remote `claim/*` refs, force-release readable active
claims, or treat unmerged missing-file refs as free.

## Evidence Commands

The evidence was collected from the dedicated Codex claim worktree after a
fresh remote fetch:

```bash
git fetch --all --prune
git rev-parse "$ref"
git for-each-ref --format='%(committerdate:iso-strict)' "refs/remotes/$ref"
git merge-base --is-ancestor "$ref" origin/main
git show "$ref:docs/claims/$slug.md"
```

`git merge-base --is-ancestor` returned exit code `0` for all three refs.
`git show "$ref:docs/claims/$slug.md"` failed for all three expected claim
file paths, proving the refs are missing-file residue rather than readable
active claim files.

## Reachability Table

| Ref | Head | Committer date | Reachable from `origin/main` | Expected claim file |
|---|---:|---:|---:|---:|
| `origin/claim/b0140-bash-ts-migration-smallest-slice-riven-2026-05-08` | `a3be6f2644bc5be69f8e66264eb99d64b2154a27` | `2026-05-08T20:30:37Z` | yes | missing |
| `origin/claim/b0271-pm2-first-research-pass-2026-05-08` | `5d1da7031132049dd4514af1da2afa8f5013f8b4` | `2026-05-09T01:59:24Z` | yes | missing |
| `origin/claim/b0325-peer-call-firewall-kiro-claude-smallest-slice-riven-2026-05-09` | `d832d74fd01cfd8872691899a209214c9e136159` | `2026-05-09T12:35:17Z` | yes | missing |

## Head Subjects

```text
a3be6f2644bc fix(backlog): 081KQGDBJ0008QG0R001JC9HCJ parent -> decomposed (#2127)
5d1da7031132 feat(081KR2E4K0008QG0R002FYNDT1): extract 5 carved sentences from CLAUDE.md to .claude/rules/ (#2164)
d832d74fd01c feat(081KR2E4K0008QG0R002NYV33T): smallest safe slice - Branch Safety ruleset skeleton + start-gate + re-decomp (#2299)
```

## Retirement Output

The remote refs were deleted after the reachability and missing-file checks
above were repeated in the claim worktree.

```text
To https://github.com/Lucent-Financial-Group/Zeta.git
 - [deleted]             claim/b0140-bash-ts-migration-smallest-slice-riven-2026-05-08
 - [deleted]             claim/b0271-pm2-first-research-pass-2026-05-08
 - [deleted]             claim/b0325-peer-call-firewall-kiro-claude-smallest-slice-riven-2026-05-09
```

`git ls-remote --heads origin` for the same three branch names returned no
refs after deletion. A follow-up `git fetch --prune origin` completed cleanly.

## Next Safe Action

Release the Codex claim in the same branch and open a PR carrying the claim,
receipt, and release. Do not delete any unmerged missing-file refs without a
separate branch-history receipt.
