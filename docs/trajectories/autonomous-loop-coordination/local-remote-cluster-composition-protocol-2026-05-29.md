# Local/Remote Cluster Composition Protocol - 2026-05-29

Status: protocol sketch
Grounding backlog:
`docs/backlog/P1/081KQX9B50008QG0R0026BG44J-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`
and
`docs/backlog/P1/081KRYRGG0008QG0R001JVJV0K-fractal-bft-protocol-doc-2026-05-19.md`
Parent matrix:
`docs/trajectories/autonomous-loop-coordination/remote-only-coordination-test-matrix.md`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/remote-only-claim-release-receipt-2026-05-29.md`

## Scope

This packet is the first 081KRYRGG0008QG0R001JVJV0K protocol sketch for composing a local
odd-node maintainer cluster with remote git-native claim refs. It is a
coordination contract, not a runner implementation and not a new consensus
proof.

081KQX9B50008QG0R001MNYK61 proved the minimum remote-only substrate: a participant can discover
claim ownership, expected files, progress, and release state from remote git
refs without relying on the local broadcast bus. 081KQX9B50008QG0R0026BG44J adds the local layer:
each maintainer may have a local cluster with faster local signals, but that
cluster must still compose with remote participants through the same claim
protocol.

The core rule is simple: local quorum can choose and accelerate work, but a
remote-visible claim is the first ownership boundary that other clusters must
honor.

## Surfaces

| Surface | Scope | Authority |
|---|---|---|
| Local broadcast bus | Fast local coordination inside one host or maintainer cluster | Advisory only |
| Local loop health and locks | Whether the local Codex/Otto/Riven runner can safely mutate | Binding for that local runner |
| Local worktree state | Collision guard for same-machine writers | Binding for that filesystem only |
| `origin/claim/*` refs | Remote-visible active work, expected files, blockers, release state | Binding across clusters |
| Pull requests | Review, CI, merge, host comments, and auto-merge state | Binding for merge readiness |
| Main history | Accepted project substrate | Canonical after merge |

Local state may be fresher, but remote state is the cross-cluster truth. If a
local bus says a path is free and `origin/claim/*` says it is owned, the remote
claim wins. If GitHub is degraded, git refs remain sufficient for ownership;
PR metadata is a latency and review adapter, not the lock itself.

## Protocol

1. A local cluster reads its local bus, loop health, root dirt, worktrees, and
   current remote refs before selecting work.
2. The local cluster chooses a path set only if it does not overlap active
   local writers, open PR heads, or active remote claim path sets.
3. Before writing product files, the cluster publishes or updates a
   remote-visible claim ref with owner, timestamp, ETA, expected path set,
   durable target, blocker state, and release route.
4. Other clusters treat that pushed claim as the lock. They may comment,
   review, or inspect, but they do not write overlapping paths unless the claim
   is released, co-claimed, or explicitly handed off.
5. A writer re-fetches remote refs immediately before push. If a new overlap
   appeared, the writer stands down or narrows the patch before pushing.
6. The branch releases the claim through durable git history: preferably a
   same-PR release commit that deletes the claim file, otherwise a
   force-release commit or a receipt that names the weaker remote-head
   retirement evidence.
7. Merge readiness is evaluated through PR checks and review state. A clean
   claim does not imply a clean PR; a clean PR does not erase unresolved claim
   residue unless the release path is recorded.

## Worked Example

Maintainer A runs a local three-node Codex cluster. Maintainer B runs a slow
remote-only background participant with no access to A's local broadcast bus.

1. A's local cluster sees no active Codex PR, no active local lock, and a safe
   trajectory target:
   `docs/trajectories/autonomous-loop-coordination/local-remote-cluster-composition-protocol-2026-05-29.md`.
2. A publishes
   `origin/claim/codex-loop-b0211-local-remote-cluster-protocol-20260529`
   with that path set plus the `RESUME.md` pointer.
3. B starts from a fresh clone, fetches `origin/claim/*`, reads A's claim file,
   and chooses a disjoint target. B does not need A's broadcast bus.
4. A fetches again before pushing product changes. If B's path set is still
   disjoint, A pushes. If B overlaps, A records a blocker or narrows scope.
5. A opens a PR. The PR must still pass checks and review.
6. Before merge, A records claim release in git history. Future clusters can
   reconstruct that the lock is gone from refs and from the branch history.

The example scales to more maintainers because every local cluster projects
its active work to the same remote substrate before expecting others to avoid
it.

## Failure Handling

| Failure | Required behavior |
|---|---|
| Local bus says free; remote claim says owned | Stand down or inspect only. Remote claim owns cross-cluster truth. |
| Remote claim appears stale | Do not overwrite. Publish a stale-claim audit or use the documented force-release path. |
| Local loop health has a live lock | Do not mutate that lane. Wait or inspect non-overlapping remote state. |
| Root checkout is dirty or contested | Use a dedicated worktree. Root stays read-only. |
| GitHub PR API is degraded | Use `git fetch` plus `origin/claim/*` for ownership; defer merge decisions that need PR checks. |
| Product branch is clean but claim release is missing | Treat as not fully released; add a release commit or receipt before merge. |

## Acceptance Checklist

- A fresh remote clone can discover every active local-cluster claim from
  `origin/claim/*`.
- Each claim names the expected path set before product writes are pushed.
- Local-only broadcast messages are never required to avoid path overlap.
- A local cluster re-fetches before push and stands down on new overlap.
- Completed work has both a PR merge state and a reconstructable claim release
  state.
- A slow participant can safely join late without asking the human what the
  local cluster is doing.

## Limits

- No runner behavior changes in this packet.
- No new host dependency.
- No formal BFT proof beyond the existing 081KQX9B50008QG0R0026BG44J backlog claim.
- No claim that local broadcast is authoritative across maintainers.
- No merge gate change; PR checks and reviews remain the merge authority.

The protocol is useful when it stays boring: each local cluster can move fast
inside its own boundary, while remote git claims keep the wider factory from
depending on hidden local state.
