# Trajectory - Autonomous Backlog Pickup

Status: active child packet
Last refreshed: 2026-05-08
Parent trajectory: `docs/trajectories/factory-trajectory-surface/RESUME.md`
Grounding backlog:
`docs/backlog/P0/081KQZVQW0008QG0R000C35RNY-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
and children 081KR2E4K0008QG0R001GFXN05 through 081KR2E4K0008QG0R002FSPPQR.

## Why This Exists

Autonomous backlog pickup is the lane that lets background loops start
reviewable work when the PR queue is empty. Without it, the factory can
maintain itself but cannot grow: the loop wakes, drains PRs, writes a heartbeat,
and sleeps without turning committed backlog substrate into shipped work.

This packet keeps the growth lane resumable without expanding runner-core work
inside a trajectory doc. The trajectory names the agenda and boundary; backlog
rows carry atomic execution; claim branches own concrete path sets.

## Current Rule

Queue-empty is runway. A loop may select one bounded backlog row only after PR
maintenance has no actionable review, CI, or merge work. The loop must claim
before editing, use an isolated worktree, keep the root checkout untouched, run
focused checks, publish a PR, and arm auto-merge only when the gate is clean or
legitimately pending.

This packet owns the resume surface for the lane. While
`claim/backlog-0249-tier1-runner` is active, runner-core edits stay out of this
packet.

## Recommended Next Action

Next concrete action: finish the PR-publication executor path for 081KR2E4K0008QG0R0022RVRCZ.

Use the already-landed selector and claim/worktree bootstrap as inputs, then
wire the publication step so a selected backlog row becomes a pushed branch and
reviewable PR without the maintainer acting as courier. Keep the slice bounded
to publication behavior; leave empty-queue loop integration to 081KR2E4K0008QG0R002FSPPQR.

## Next Child Packets

- PR-publication executor completion, grounded in 081KR2E4K0008QG0R0022RVRCZ
- empty-queue loop integration, grounded in 081KR2E4K0008QG0R002FSPPQR
- stale-selection skip receipt for active claim/path overlap
- focused-check summary contract for autonomous PR packets

## Evidence Links

- `docs/backlog/P0/081KQZVQW0008QG0R000C35RNY-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
- `docs/backlog/P0/081KR2E4K0008QG0R001GFXN05-autonomous-backlog-selector-priority-safe-pickup-2026-05-08.md`
- `docs/backlog/P0/081KR2E4K0008QG0R000YTJS3Q-autonomous-backlog-claim-worktree-bootstrap-2026-05-08.md`
- `docs/backlog/P0/081KR2E4K0008QG0R0022RVRCZ-autonomous-backlog-pr-publication-and-automerge-2026-05-08.md`
- `docs/backlog/P0/081KR2E4K0008QG0R002FSPPQR-codex-loop-empty-queue-backlog-pickup-integration-2026-05-08.md`
- `docs/AGENT-CLAIM-PROTOCOL.md`
- `docs/AGENT-ISSUE-WORKFLOW.md`
- `docs/AUTONOMOUS-LOOP.md`
- `docs/SAFE-AUTONOMOUS-ACTIONS.md`

## Out Of Scope

- No runner-core implementation in this packet.
- No backlog row closure in this packet.
- No broad autonomous action beyond existing safe-action surfaces.
- No writes in the contested root checkout.
- No claim that local broadcast state is authoritative over git and PR state.

This packet exists so autonomous pickup has a durable lane memory: the backlog
coordinates what, the trajectory coordinates why, and the claim branch
coordinates who may touch which paths.
