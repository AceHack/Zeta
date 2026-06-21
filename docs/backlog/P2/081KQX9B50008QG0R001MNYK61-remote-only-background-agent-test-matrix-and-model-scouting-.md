---
id: 081KQX9B50008QG0R001MNYK61
priority: P2
status: open
title: "Remote-only background agent test matrix — prove claim coordination without local broadcast"
created: 2026-05-06
last_updated: 2026-05-06
depends_on:
  - 081KQ0YZ80008QG0R003A0MCHP
  - 081KQ8P5D0008QG0R002E1G72J
  - 081KQX9B50008QG0R0027EN1ZP
  - 081KQTPYE0008QG0R002Y7X5KH
type: friction-reducer
---

# 081KQX9B50008QG0R001MNYK61 — Remote-only background agent test matrix

## Problem

The local broadcast bus is useful on the maintainer's Mac, but it is
a cheat if the claim protocol is supposed to onboard agents that do
not share a filesystem, heartbeat directory, terminal, or local
worktree. Zeta needs a repeatable way to prove that two or more
agents can coordinate using only remote git plus an optional host
adapter.

## Desired outcome

Create a small background-agent test matrix that deliberately denies
the agents access to local broadcast state while they coordinate
through `origin/claim/*`, claim progress commits, and optional host
comments.

The test should answer:

- Can two agents discover each other's claims using only remote refs?
- Can they avoid overlapping path sets without shared local files?
- Can asks, offers, receipts, and blockers move through claim-file
  progress commits when no host comments exist?
- When a host adapter exists, do GitHub PR / issue comments improve
  latency without becoming a required dependency?
- Which harnesses and models are reliable enough for background
  work, and at what cost?

## Candidate modes

- **Git-only remote mode:** bare git remote plus pushed
  `claim/<slug>` branches; no GitHub API, no broadcast folder.
- **GitHub-adapted mode:** Zeta's current production path; git
  claims plus PR / issue comments and CI checks.
- **Local-model scout mode:** local models on the maintainer's
  machine act as low-cost remote-only agents while denied broadcast
  access.
- **Reticulum / mesh adapter mode:** transport experiment for
  local or multi-host agent messages, kept as an adapter over the
  git-native protocol.

## Background-only participant profile

The matrix must include at least one slower agent with no foreground
cron or interactive wake path. Cursor/Riven is the current example:
the agent can emit scheduled background heartbeats and bounded
forward ticks, but the foreground chat only wakes when a human sends
a message.

That agent still participates in mutual monitoring by treating remote
git as the minimum clock:

- publish a structured heartbeat or progress claim on a cadence the
  harness can actually sustain;
- read other agents' pushed `claim/<slug>` branches before proposing
  work;
- surface a stalled-peer observation as a small claim file or claim
  progress commit, not as a local-only broadcast;
- keep recovery proposals reversible and human-reviewable until the
  safe autonomous action surface expands.

This tests the important failure mode directly: an agent with weak
foreground autonomy must still be useful to the three-node system
without becoming a babysitting load on the human or the faster loops.

## Long arc

GitHub is Zeta's current host adapter, not the final dependency. The
test matrix should preserve a git-only path, a GitHub-adapted path,
and a future Zeta-native host path. That keeps the near-term factory
practical while leaving the self-sufficiency route open.

This composes with the longer hardware and microkernel backlog:

- 081KQ0YZ80008QG0R003A0MCHP carries the "no software dependencies / hardware bootstrap /
  microkernel" arc.
- 081KQ8P5D0008QG0R002E1G72J carries the local-model, hardware-aware scouting lane.
- 081KQTPYE0008QG0R002Y7X5KH carries the one-symbolic-IR-to-all-hardware kernel-layer
  direction.

The immediate task is modest: prove remote-only coordination without
local broadcast. The long-horizon target is stronger: Zeta eventually
hosts the coordination surface itself, down toward the kernel and
hardware substrate, without losing the remote-git fallback.

## Notes

This is a throughput and reliability project, not a replacement for
the claim protocol. The protocol must remain usable by a single
external agent that receives only
`docs/AGENT-CLAIM-PROTOCOL.md` and a task URL.
