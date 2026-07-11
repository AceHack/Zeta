# Local time never enters the shared fold — two orders, never crossed

Carved sentence:

> Two orders, and they must **never touch**: the **shared conclusion** (the commutative
> belief fold) sees **only agreed phase / logical order**; a node's **local wall-clock and
> receive-order** steer **only local actions** (timeouts, retransmit, UI, "stale to me").
> The instant a local clock **filters or weights the evidence entering the shared fold**
> — e.g. *"drop beliefs older than 5 local-seconds before folding"* — it leaks local time
> into the shared result, and because every node's receive-time differs, nodes fold
> **different evidence sets and DIVERGE**. Local time = local behavior; the shared
> conclusion = phase-ordered evidence only. This is §13 noninterference, stated for time.

## Why this rule exists now (before the code does)

The multi-planet convergence stack (commutative `observe` ∘ Adinkra ECC ∘ phase-canonical
order) gives *same evidence set ⇒ same conclusion under reorder + loss + skew* — but that
guarantee is only as strong as this boundary. Aaron 2026-07-11: *"we should save this
somewhere cause we don't have all this built yet and this would be an easy mistake to
make."* The tempting mistake is real and local-looking (a staleness filter, a wall-time
rate-limit on evidence) — so the guard must be **resident before the fold is implemented**,
not discovered after divergence. The local clock is *proper time* (your frame only, the
only clock you have); the shared phase is the agreed logical order. Keep them apart.

## The test (what a correct implementation looks like)

- A node's local wall-clock / receive-order MAY gate: retransmit timers, local timeouts,
  UI freshness, "is this stale **to me**", congestion/rate control.
- It MUST NOT: filter, drop, weight, reorder, or de-duplicate the evidence **on its way into
  the shared commutative fold**. The fold sees the evidence *set*, phase-ordered — nothing
  local-time-derived.
- Litmus: if two nodes with different receive-times could fold different sets, local time
  has leaked. The fold's inputs must be a pure function of (evidence set, agreed phase).

## Pointers

- `docs/research/2026-07-11-multi-planet-convergence-three-drift-axes-commutative-observe-adinkra-ecc-hlc-canonical-order-one-attack-vector.md` — full derivation (#9706/#9708/#9709): the two-orders guard + proper-time frame.
- `src/Core/BeliefConvergence.fs` — the shared fold (`observeAll`); the invariant is noted at the fold site too.
- `src/Core/TravelerFrame.fs` — "time as a 4th traveler": each locality observes phase independently (the proper-time frame).
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) §7 noninterference — this rule is that discipline applied to time.
- [`async-all-the-way-truthful-signatures.md`](async-all-the-way-truthful-signatures.md) — the sibling guard: no ambient entropy (here: no ambient *time*) into the metered result.
