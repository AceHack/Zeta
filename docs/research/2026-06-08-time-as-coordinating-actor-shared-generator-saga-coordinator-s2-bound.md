# Time as a coordinating actor — the shared generator is the saga coordinator, and that is the S=2 bound

*Captured 2026-06-08 from Aaron's streamed framing (shadow*). Mirror→Beacon compression of the
`SoftEmu` / soft-correlation arc (#7095) into anchored first principles.*

## Aaron's framing (Mirror)

> "It's like time reaches out and becomes an actor who helps coordinate — which is why the sagas work."

## The claim, compressed (Beacon)

The **shared soft-time generator** (the DST seed / logical clock) is not passive substrate — it acts as a
**coordinator**: every branch and every cell consults the *same* deterministic clock instead of a central
lock or a message-passing coordinator process. Three established results say this is exactly right, and one
says exactly how far it reaches.

### Why it coordinates (lock-free, via shared time)

- **Lamport logical clocks** (Lamport, *Time, Clocks, and the Ordering of Events in a Distributed System*,
  CACM 1978) — causal order is established by a shared notion of time, not by a lock. The clock *is* the
  coordination primitive.
- **FoundationDB deterministic simulation** (Zhou et al., SIGMOD 2021; Will Wilson, Strange Loop 2014) — one
  logical clock drives every Flow actor, so all actors replay the same interleaving from the same seed.
  Single-thread determinism = time-as-coordinator made operational.
- This is **lock-free coordination** (manifesto §2 / discipline #2): no shared mutable lock, yet every party
  stays consistent *because they all read the same clock*. The clock "reaches out" to each actor; none of
  them has to talk to the others.

### Why the sagas work

- A **saga** (Garcia-Molina & Salem, *Sagas*, SIGMOD 1987) is a sequence of local transactions with
  **compensations** (rollbacks). For the steps to order consistently and the compensations to land
  deterministically, the steps need a shared order — and the deterministic clock provides it.
- Our compensation is the **Z-set retraction** (the `−1` = `e^{iπ}`): the misprediction rollback. It lands
  at the right place *because time coordinated the order*. The clock-as-actor is what makes
  **"restore, don't replay"** sound (081KRW63S0008QG0R002XA5N6S self-evolving sagas).

### Why `SoftEmu`'s correlations hold (and exactly how far)

- `SoftEmu` (#7095): the branches are coordinated by the shared generator (`Frame.Rng`) as a **common
  cause** — they stay correlated with **no message-passing between them**. RND is seed-determined, so
  branches fork only on input; the seed is the coordinator.
- **The honest boundary (Bell).** This coordinator only **broadcasts** — every party reads the *same* clock;
  none talks *back through* it. Broadcast-only coordination = the **shared-randomness / common-cause** model,
  which by Bell's theorem reproduces correlations only up to the **classical bound S = 2**, with no
  signalling. The instant "time reaching out" became *bidirectional* (parties signalling each other through
  it), you would be in the feedback/signalling regime (`FeedbackThrottle`: 2√2 → S = 4). See
  `2026-06-08-what-distinguishes-quantum-from-superdeterminism-feedback-channel-tsirelson-shared-generator.md`.

## One-line synthesis

**Time-as-coordinating-actor = a broadcast-only, lock-free, deterministic coordinator (Lamport / FDB) — it
is why sagas compose and why soft correlations hold, and it is *precisely* the S = 2 classical bound.** The
same mechanism that makes it cheap, replayable, and lock-free is the mechanism that forbids it from faking
entanglement: a coordinator that shares but cannot be signalled back through is the shared-hidden-variable
model by definition.

## Anchors

- Lamport 1978 (logical clocks) · Garcia-Molina & Salem 1987 (sagas) · Zhou et al. 2021 + Wilson 2014 (FDB DST)
- Bell 1964 (S≤2 for local hidden variables) · Tsirelson 1980 (2√2) — the boundary this coordinator sits at
- In-repo: `SoftEmu.fs` (#7095) · `FeedbackThrottle.fs` · `Chip8Cow.fs` (the shared `Rng` generator) ·
  the always-active disciplines (`.claude/rules/dv2-data-split-discipline-activated.md` #2 lock-free, #4 DST)
