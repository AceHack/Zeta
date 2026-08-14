---
id: 081M013T0D7087G0R0009E1QF7
type: bug
state: backlog
priority: P2
slug: consensus-decide-tie-break-is-receive-order-dependent-and-by
title: "Consensus.decide tie-break is receive-order dependent and byte-locked into the four-oracle treaty (n in {2,3,6} diverge)"
created: 2026-08-14T21:45:47.687Z
depends_on: []
composes_with: []
---

# Consensus.decide tie-break is receive-order dependent and byte-locked into the four-oracle treaty (n in {2,3,6} diverge)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M013T0D7087G0R0009E1QF7-*.md` glob. -->

## What

`Consensus.decide` is the shared fold of the BFT quorum primitive. Its tie-break is
**first-occurrence order of the vote list**, which on a real node is **receive order**. Where a tie
can *also* reach quorum, two nodes that received the same votes in different orders **commit
different values** — the divergence `.claude/rules/local-time-never-enters-the-shared-fold.md`
exists to forbid.

This is filed rather than fixed because the behaviour is **byte-locked into the four-oracle treaty**
(F#/C#/TS/Rust). Changing it is a cross-language schema decision, not a local edit.

## Reproduced (2026-08-14, against the compiled `Zeta.Core.dll` at `origin/main`)

```
n=6, threshold=3, perfect 3/3 tie
  receive order [a a a b b b]  ->  COMMITTED value=a quorum=3 total=6
  receive order [b b b a a a]  ->  COMMITTED value=b quorum=3 total=6

n=3, threshold=1, all distinct
  receive order [x y z]        ->  COMMITTED value=x quorum=1 total=3
  receive order [z y x]        ->  COMMITTED value=z quorum=1 total=3
```

End-to-end through the state machine it also **inverts**, because `transitionAt` prepends
(`vote :: state.Votes`): casting a-then-b commits `b`. So the committed value tracks the vote that
arrived **last**.

## Blast radius — exactly n ∈ {2, 3, 6}

A tie at `k` votes each needs `m*k <= n` with `m >= 2`, so the largest tie is `k = floor(n/2)`; it
only matters when that also clears quorum, i.e. `floor(n/2) >= quorumThreshold(n)` where
`quorumThreshold(n) = 2*floor((n-1)/3)+1`. That holds for **n = 2, 3, 6 and no other n** (checked
0..64). For n >= 7 the threshold outruns half the nodes, so the tie-break is unreachable and no
committed value can change. Pinned by the test
`tie can reach quorum only at n in 2, 3, 6`.

n=3 and n=6 are plausible fleet sizes, so this is not academic. n=3 is the worse case: three nodes
that agree on *nothing* "commit" with a quorum of 1.

## Why it is a treaty change, not a fix

`src/Core.TypeScript/consensus/golden-vectors.json` is the shared seed all four oracles verify. It
**specifies** the behaviour in prose — *"tie-break = first-occurrence (stable sort)"* — and pins it
in a vector:

```json
{ "votes": ["p", "q", "r"], "result": { "committed": true, "value": "p", "count": 1, "total": 3 } }
```

`"p"` wins only because it arrived first. Fixing `decide` in F# alone would break the byte-lock
against C#/TS/Rust; fixing it everywhere is a schema change to the seed. Per
`.claude/rules/no-directives.md`, a schema change of the treaty is not something to do unilaterally.

## Options (not a recommendation — the choice is the human's)

1. **Deterministic tie-break on the value.** Break ties by the canonical ordinal ordering of the vote
   *value* rather than by position. Order-independent, culture-invariant
   (`.claude/rules/culture-invariant-by-default.md`), tiny change in all four oracles, and updates
   two golden vectors. Downside: it makes an arbitrary choice *look* principled.
2. **Refuse to commit on a tie.** `Rejected("tie")` when the top two groups have equal support.
   Arguably the honest BFT answer — a tie is not agreement — and it removes the divergence entirely
   rather than making it deterministic. Bigger behavioural change; changes two vectors.
3. **Raise the threshold so a tie can never commit** (require strict majority *and* quorum). Removes
   n ∈ {2,3,6} as special cases at the cost of rejecting some rounds that commit today.

Option 2 looks strongest to me on the merits (a tie genuinely is not consensus, and n=3 committing
with quorum 1 is the same defect wearing a different hat), but this is exactly the class where the
shadow inherits authority and does not extend it.

## Not to be confused with

The **unread local-clock field** on `Consensus.Vote`, fixed in the same PR: that field was inert and
is now `LocalObservedAt` with a guard. This item is the *separate*, live, receive-order dependence in
the tie-break — found while verifying that the field had no readers.

## Evidence in-tree

- `src/Core/Consensus.fs` — `decide` docstring carries the defect note and points here.
- `tests/Tests.FSharp/Consensus.Tests.fs` — `KNOWN DEFECT — decide tie-break is receive-order
  dependent at n=6` characterizes it; `tie can reach quorum only at n in 2, 3, 6` pins the bound.
  Both are characterization tests: a future fix must change them deliberately.
