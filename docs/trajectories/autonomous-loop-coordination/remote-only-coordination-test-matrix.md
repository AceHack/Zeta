# Remote-Only Coordination Test Matrix

Status: first matrix
Grounding backlog:
`docs/backlog/P2/081KQX9B50008QG0R001MNYK61-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`

## Purpose

081KQX9B50008QG0R001MNYK61 asks whether background agents can coordinate when the local
broadcast bus, shared filesystem, shared terminal, and local worktree
state are all unavailable. This matrix makes that test concrete before
runner behavior changes land.

The invariant under test is:

> Remote git claims are the minimum coordination bus. Host comments and
> local broadcasts may improve latency, but neither may be required for
> safe non-overlap.

## Matrix

| Mode | Available surfaces | Denied surfaces | Success signal | Failure signal |
|---|---|---|---|---|
| Git-only remote | `origin/main`, pushed `origin/claim/*` refs, `git show origin/claim/<slug>:docs/claims/<slug>.md`, claim progress/release commits | GitHub API, PR/issue comments, local broadcast files, shared worktrees, shared logs | Two agents independently discover active claims, avoid overlapping expected files, publish progress and release through claim commits only | Two agents claim overlapping path sets; a blocker exists only in chat or local files; release cannot be reconstructed from remote refs |
| GitHub-adapted remote | Remote git claims, PR metadata, CI checks, PR/issue comments | Local broadcast files, shared worktrees, shared logs | PR comments reduce latency, but a fresh clone can still reconstruct claim ownership and next action from remote refs plus PR state | Merge/review decision depends on a local-only bus message; missing GitHub comments make the claim unrecoverable despite remote refs |
| Slow background-only participant | Remote git claims, scheduled heartbeat/progress commits at the harness' real cadence, optional host comments | Foreground chat wakeups, shared terminal state, local broadcast files | Slow participant does not need babysitting: it reads remote claims before acting, publishes a progress signal, and stands down on active path conflicts | Faster loops must ask the human what the slow participant is doing; slow participant starts work from stale local state; stale claim has no remote timestamp |
| Local-model scout denied-bus | Remote git claims from a separate clone, model-run artifact branch, optional PR draft | Main checkout writes, local broadcast files, privileged host logs | Low-cost scout reports a bounded artifact without touching contested paths and cites the claim/ref it used | Scout uses local bus or root checkout as hidden context; artifact cannot be replayed from pushed refs |
| Future Zeta-native host adapter | Zeta-hosted claim/event stream, git projection, optional GitHub mirror | Local broadcast as authority, single-vendor host dependence | Zeta event stream and git projection agree on active claims, releases, and blockers | Zeta-native state cannot round-trip to git claims; git-only participant cannot safely join |

## Minimum Remote-Only Dry Run

The first runnable dry run should use Git-only remote mode and two
participants:

1. Participant A pushes `claim/remote-only-a` with an expected path set.
2. Participant B starts from a fresh clone, runs `git fetch origin`, reads
   `origin/claim/remote-only-a`, and chooses a disjoint path set.
3. Participant B pushes `claim/remote-only-b`.
4. Participant A fetches again and records a progress commit acknowledging
   B's disjoint claim.
5. Both participants release their claims through commits that delete their
   claim files or explicitly mark the dry run abandoned.

The dry run passes only if the full state can be reconstructed from
remote refs and commit history, with no local broadcast files and no
chat-only handoff.

## Slow Background-Only Example

Riven/Cursor is the first concrete background-only participant profile.
In this test, Riven is deliberately denied the local broadcast folder and
is treated as slow:

- It wakes on its own schedule, not on demand from foreground chat.
- It fetches remote refs before choosing work.
- It reads `origin/claim/*` files to avoid active path sets.
- It publishes a progress commit if it cannot finish in the same run.
- It uses GitHub comments only as a latency adapter.

A successful run looks boring: faster loops can continue without asking
the human what Riven is doing, because Riven's claim/ref trail already
answers that question. A failed run is any case where the answer exists
only in local logs, local broadcast files, or a pasted chat transcript.

## Acceptance Checklist

- The participant can start from a fresh clone with no local bus.
- Active work is discoverable with `git fetch origin` plus
  `git branch -r --list 'origin/claim/*'`.
- Claim ownership, expected files, blockers, and release are visible in
  claim files or claim progress/release commits.
- Host comments are useful but not necessary to recover state.
- The slow participant can be late without becoming invisible.
- A stale claim has a timestamp and a safe release path.

## Out Of Scope

- No runner behavior changes.
- No new host dependency.
- No requirement that GitHub Issues or PR comments exist.
- No use of the local broadcast bus as proof of remote-only success.
