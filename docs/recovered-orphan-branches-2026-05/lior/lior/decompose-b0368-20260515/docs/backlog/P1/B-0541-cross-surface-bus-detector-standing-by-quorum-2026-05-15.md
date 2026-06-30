---
id: B-0541
title: Cross-surface bus detector — Standing-by quorum across Otto surfaces (extension of PR #3017 detector)
priority: P1
status: open
type: slice
parent: B-0539
created: 2026-05-15
ask: Aaron
effort: M
tags: [substrate, bus, otto-bft, standing-by-detector]
depends_on: []
composes_with: [B-0539, B-0540, B-0542]
last_updated: 2026-05-15
---

## Why

Slice 2 of the Otto-BFT umbrella (B-0539). PR #3017 / #3022 shipped
the Standing-by detector for a single Otto surface — publishes
`infinite-backlog-nudge` envelope to the bus when the agent has
been quiet too long.

This slice extends the detector to **cross-surface quorum**:

- If Otto-Desktop AND Otto-CLI BOTH emit "no work to do" /
  brief-acknowledgment signals in the same window
- Publish stronger escalation envelope (different topic? higher
  TTL? different recipient pattern?)
- A third surface (Otto-launchd-background) subscribes and acts
  on the escalation by picking a small decomposition item OR
  pinging the foreground Ottos

The single-surface detector says "this Otto is idle." The
cross-surface detector says "TWO Ottos are idle simultaneously —
the failure mode has BFT-quorum confirmation."

## What

1. Subscribe pattern in `tools/bg/standing-by-detector.ts` (or
   wherever the detector lives) — read all `heartbeat` envelopes
   from `otto-cli`, `otto-desktop`, `otto-launchd` in the last
   window
2. Quorum logic: if 2+ surfaces report `status: "idle"` in the
   same N-minute window, publish a `standing-by-quorum` envelope
   (NEW topic to add to `tools/bus/types.ts`)
3. Subscriber: the third surface (or the launchd service) reads
   the quorum envelope and either nudges the foreground Ottos OR
   takes the decomposition work itself
4. Avoid feedback loops — quorum envelopes don't count as
   "activity" for the heartbeat detector

## Operational notes

- **Terminology correction (per Copilot review)**: 2-of-3 quorum
  across the Otto surfaces is **crash-fault-tolerant (CFT)**,
  NOT Byzantine-fault-tolerant in the classical sense. Classical
  BFT requires `3f+1` nodes to tolerate `f` byzantine faults —
  for `f=1` that's 4 nodes, not 3. The Otto-BFT framing in the
  umbrella (B-0539) uses Aaron's verbatim phrasing ("you have
  your own internal BFT"); the operational reality is closer to
  CFT — sufficient to catch a single Otto-surface that's stuck
  (silently failing to progress) but not designed to handle a
  byzantine surface that's actively lying about its state. The
  3-surface quorum still works for the Standing-by-detection use
  case because the failure mode is silent-stuck, not adversarial
- Extending PR #3017's bus envelope shape; minimal new mechanism
- Composes with the `infinite-backlog-nudge` topic (existing) —
  could replace or supplement

## Composes with

- B-0539 (umbrella)
- B-0540 (sibling — rule-level escalation)
- B-0542 (sibling — background service prompt-clicker)
- PR #3017 / #3022 (precursor — single-surface detector)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
- `.claude/rules/otto-channels-reference-card.md` (10 channels;
  this work extends the explicit channels)
- `tools/bus/types.ts` (Topic taxonomy; needs new topic)
