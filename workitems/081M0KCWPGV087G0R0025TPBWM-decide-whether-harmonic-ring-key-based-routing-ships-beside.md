---
id: 081M0KCWPGV087G0R0025TPBWM
type: task
state: backlog
priority: P2
slug: decide-whether-harmonic-ring-key-based-routing-ships-beside
title: "Decide whether harmonic-ring key-based routing ships beside, replaces, or does not join the shipped Kademlia geometry"
created: 2026-08-22T00:10:52.827Z
depends_on: []
composes_with: []
---

# Decide whether harmonic-ring key-based routing ships beside, replaces, or does not join the shipped Kademlia geometry

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0KCWPGV087G0R0025TPBWM-*.md` glob. -->

## Why this is open

`docs/research/2026-08-21-greedy-small-world-routing-is-hub-free-by-construction-and-our-kademlia-has-less-exit-than-a-ring.md`
derives a harmonic-ring key-based-routing design from published literature (Kleinberg STOC 2000;
Symphony USITS 2003) and measures the shipped Kademlia geometry against it using Gummadi et al.
(SIGCOMM 2003). Two findings need a decision, and neither is answered by the doc:

1. **§6.4** — on the EXIT discriminator of
   `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`, the XOR geometry we ship has
   route-selection flexibility `1` on optimal paths and no native sequential-neighbour support;
   a ring has `c₁(log n)!` and does. That is a measurable §1 weakness in a *working, tested,
   DST-pure* module — an input to a decision, not a mandate to rewrite.
2. **§6.3** — key *responsibility* is route-through by construction in any DHT (one manager per
   key). Replication over a successor list is the standard answer; we have no key-value layer at
   all, so this is an unanswered gap rather than a solved one.

## Gates before any implementation (doc §8)

- Admissibility of a locally-derived estimate of `n` under the no-enumeration discipline in
  `src/Core.TypeScript/observe/local-neighbourhood.ts` (doc §5.6). Explicit decision required.
- Identifier binding: `docs/BUGS.md` "Reticulum announce wire is unsigned AND `dest` is unbound to
  `zid`" is on the critical path — greedy KBR over an unbound identifier lets an attacker choose
  its own coordinates (doc §D9, §5.1b).
- Anti-Sybil posture: Castro et al. (certified identifiers) vs this repo's socially-conferred
  standing (`TravelerRankLedger`, `SocietyUsefulWork`). Never compared here.

## Status

Design only. **Nothing in the doc is metered** — no simulation, no test, no measurement of ours.
The falsifier it would need is a DST-seeded harness reproducing both the `(log n)²` scaling and the
`Θ(√n/k)` degradation under deliberately-uniform links; the second matters more, because a hop
count that fails to blow up on a wrong distribution proves the harness was not measuring routing.

## Clean-room note

The design doc was written by an agent that never saw the contaminated Freenet talk transcript, no
Freenet source, and no Freenet-authored paper
(`.claude/rules/cleanroom-two-team-separation.md`). Any implementation must be routed to an agent
under the same wall.
