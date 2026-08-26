---
id: 081M0YSD5VA087G0R000W2Q9QW
type: task
state: done
priority: P2
slug: replace-the-arc-agent-s-three-hardcoded-decay-constants-with
title: "Replace the ARC agent's three hardcoded decay constants with TrueSkill dynamics (measure before/after)"
created: 2026-08-26T10:21:14.474Z
completed: 2026-08-26T14:04:08.110Z
depends_on: []
composes_with: []
---

# Replace the ARC agent's three hardcoded decay constants with TrueSkill dynamics (measure before/after)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix -- resolve cross-refs by `081M0YSD5VA087G0R000W2Q9QW-*.md` glob. -->

## Why

Aaron 2026-08-26, from an unrelated semver-scoring thread: *"i think we can borrow from its
concepts to improve arbitrary decay rates that are hard coded"* -- specifically TrueSkill's
dynamics factor, which *"inflates sigma with time since last observation, so stale evidence
loses confidence rather than being discounted by a number nobody can justify."*

Every hardcoded decay in `src/` is in the ARC agent, and each one's OWN COMMENT describes a
moving world rather than a shrinking value:

| constant | file | its stated reason |
|---|---|---|
| `LAYER_DECAY = 0.9` | `zeta_arc/layered.py:51` | *"after the environment CHANGES what it responds to"* |
| `EVIDENCE_DECAY = 0.9` | `zeta_arc/agent.py:49` | *"a wrong body decays out instead of being welded on"* |
| `INERT_DECAY = 0.75` + `INERT_FLOOR = 0.5` | `zeta_arc/agent.py:108` | *"actions get upgraded over time"* |

That is tau's semantics wearing a multiplier's clothes. The mechanism now exists in
`src/Core/TravelerRankLedger.fs` (`age`, `ticksUntilUninformative`, TRL-34..41).

## What to do

Replace each with a belief carrying `(mu, sigma2)` and:

    observation   ->  the existing ADF update (concentrates)
    elapsed time  ->  sigma2 += tau^2 * dt   (widens; mu untouched)

`INERT_FLOOR` disappears as a separate knob: the eligibility threshold becomes a probability
("I no longer believe this action is dead"), which is a statement about the world rather than
a tuned cutoff.

## The gate: MEASURE, do not assume it helps

**This is a behaviour change, not a refactor.** The agent's behaviour is pinned by 93 tests
including a measured environment score (**0.354** on ZetaChase, **2 of 2** levels on
ZetaPocket, `distinct_grids` 29). Those numbers move under this change and the row is not
done until the before/after is recorded either way.

An honest possible outcome is that it does NOT help and the constants stay. The argument for
the change is that the parameter becomes arguable, not that the agent gets better -- and if
the score drops, that is the finding.

## Honest limit to carry across

`sigma2 += tau^2*dt` is exact for a Wiener-drift latent -- a quantity performing Brownian
motion between observations. An ARC action that unlocks at a discrete moment is a JUMP
process, not that. For the jumping case tau is an approximation chosen to bound the jump
rate rather than to model it, and that should be said in the code rather than discovered
later.

## Pointers

- `docs/research/2026-08-26-a-decay-constant-is-an-unobservable-a-dynamics-factor-is-a-claim-about-the-world.md`
- `src/Core/TravelerRankLedger.fs` SS"Dynamics factor (staleness)"
- `tests/Tests.FSharp/TravelerRankLedger.Tests.fs` TRL-36/37 -- the pair separating dynamics from decay
