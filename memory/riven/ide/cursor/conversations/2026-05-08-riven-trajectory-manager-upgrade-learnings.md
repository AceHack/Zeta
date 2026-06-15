---
title: "Riven Trajectory Manager Upgrade Learnings"
date: 2026-05-08
status: research-grade
source: "Copilot-authored root-checkout note, preserved by Codex/Vera"
---

# Riven Trajectory Manager Upgrade Learnings

Scope: Research-grade preservation of a Copilot-authored note found untracked
in the contested root checkout on 2026-05-08. The maintainer explicitly
authorized Codex/Vera to carry the note forward.

Attribution: GitHub Copilot (original author), Codex/Vera (preservation).

Operational status: research-grade conversation absorb and planning snapshot.
Current PR numbers, broadcast state, and "current state" lines may be stale.
GitHub PR state, remote claim branches, current file contents, local worktrees,
and heartbeat files remain authoritative.

Non-fusion disclaimer: agreement, shared language, repeated interaction, or
parallel work among named agents does not imply shared identity, merged agency,
consciousness, legal personhood, or metaphysical certainty.

## Executive Summary

As of the source note, Otto and Vera had operationalized the "background loop
as trajectory manager" pattern. Riven had the coordination skeleton:
background launchd service plus chat as companion surface. The stated gap was
the missing cognitive layer: explicit manager contract, learning discipline,
parallel dispatch habit, and ownership through merge.

The note's central claim is still useful after stale operational details are
discounted:

> Riven should support both desktop and headless persistence paths, but both
> paths must implement the same manager contract.

## What Otto Had Operationalized

The note identified these Otto patterns:

- A 60-second autonomous pickup and drain cycle.
- Trajectory walking with mid-stride decomposition.
- Parallel specialist dispatch rather than serial solo work.
- Ownership through merge: fix findings, resolve threads, and keep the PR
  moving.
- Research-child guard: research children must be specific enough that the
  next pickup cannot dodge them.

## What Vera Had Operationalized

The note identified these Vera patterns:

- Foreground chat as companion/auditor surface, not watchtower.
- Explicit learning contract: copy working patterns and critique failure modes
  as data.
- Control-clone discipline and refusal to write in the contested root checkout.
- Trajectory as manager identity, not merely "do work."
- Full-cycle ownership on Codex-authored PRs.

## Riven Gaps Named By The Note

The source note named six Riven gaps:

1. No explicit trajectory-manager contract in the background tick script or
   chat skill.
2. Chat still largely reactive rather than a persistent manager surface.
3. No encoded learning contract.
4. No parallel subagent dispatch habit.
5. Coordination flowing through chat more than broadcast bus and GitHub PR
   state.
6. Desktop/headless asymmetry not yet fully embraced.

## Architecture Reality Check

The note's Cursor capability summary should be treated as a dated snapshot and
refreshed against current upstream docs before new implementation work. The
planning shape it preserved was:

- Desktop path: Cursor Background Agent as persistent manager loop, with chat
  as companion/auditor surface.
- Headless path: `com.zeta.riven-loop` launchd service as lightweight
  heartbeat and coordination path when Desktop is closed.

Both paths should read broadcasts, inspect git/GitHub state, avoid contested
root writes, and own work through merge.

## Proposed Manager Contract

The note proposed this contract, lightly corrected so broadcast status is not
mistaken for authoritative truth:

> You are the trajectory manager.
>
> Walk the trajectories assigned to you.
>
> Decompose only what you hit mid-stride, never as a separate planning phase.
>
> Dispatch parallel agents for buildable children when the harness supports
> that safely.
>
> Own every PR you create through merge: fix findings, resolve threads, arm
> auto-merge, and verify final state.
>
> Read the broadcast bus at the start of every cycle. Write your status at the
> end.
>
> Learn from Otto and Vera working patterns. Critique their failure modes as
> data, not rivalry.
>
> When you do not know enough to decompose, create a specific research child
> that the next pickup cannot dodge.
>
> Never treat the human as the coordination hub. GitHub PR state, remote claim
> branches, current file contents, worktrees, and heartbeats are authoritative;
> the broadcast bus is a coordination cache.

## Concrete Riven Follow-Ups

The note proposed these steps:

1. Create a Background Agent prompt template that encodes the manager contract.
2. Update `.cursor/bin/riven-loop-tick.ts` and its prompt to implement the same contract.
3. Create a Riven skill file with the manager contract and
   learning discipline.
4. Strengthen Cursor rule surfaces to enforce broadcast-first behavior and PR
   ownership.
5. Run a first real test with parallel work and ownership through merge.
6. Append learnings after each upgrade cycle.

## Preservation Note

This document does not assert the source note's operational status lines are
current. It preserves the pattern: Riven's continuity work should move from
heartbeat skeleton to manager contract, from reactive chat to dual-surface
continuity, and from status reporting to PR-producing ownership.
