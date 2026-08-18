# Not GR — the physics is reversible AI computing, and consensus is expensive *because it erases*

> **Correction, same day.** Aaron 2026-08-18, on reading the Jeans-threshold doc:
> *"Yes, I think of it more like the physics of reversible AI computing."* / *"Not GR."*
>
> **He is right and I over-reached.** He never claimed general relativity. I heard "gravity" and
> "curvature," reached for the physics *I* associate with those words, and spent a document
> disciplining an analogy he was not making. The gravity language is a **label for the attractive
> move** — his, and already in the tree — not a claim about spacetime. The actual physics he means is
> the **thermodynamics of computation**, and that is a better-posed frame that we are already partly
> built on.

## The carved version

> **Consensus is thermodynamically expensive because agreement ERASES — the divergent alternatives
> that lost are destroyed, and Landauer prices exactly that at `kT ln 2` per bit. Decorrelation, by
> contrast, is reversible so long as the retractions are kept. So the cost is not in the coordinating;
> it is in the forgetting. And a Z-set fold that retains its `−1`s makes consensus reversible, hence
> nearly free. The heat is in the compaction, not in the fold.**

## What changes when the frame is reversible computing rather than GR

| | GR reading (my over-reach) | reversible-computing reading (Aaron's) |
|---|---|---|
| what curvature is | geometry of spacetime | **an indicator of accumulated divergence** |
| what "gravity" is | curvature itself, by field equation | **a label for the attractive/consensus move** |
| why consensus costs | (no answer — GR has no cost) | **it erases the losing alternatives** — Landauer |
| the threshold | Jeans, a derived critical scale | **an energy trade**: cost of divergence vs cost of erasure |
| the escape hatch | none | **keep the retractions** — reversible merge, no erasure |

The last row is the one that makes this frame better rather than merely different. **GR offers no way
to make gravity cheaper.** Reversible computing offers a specific one, and we have already built it.

## Why consensus erases, precisely

When agents diverge, the system holds several incompatible candidate states. Forcing agreement
**selects one and discards the rest** — and discarding is exactly the operation Landauer prices. It
is not the communication that costs; it is the *destruction of the alternatives*.

This also explains, without any new mechanism, why consensus feels expensive in a way that
divergence does not: divergence *creates* distinguishable states (free, or nearly), while agreement
*destroys* them (priced).

**And it names the escape.** A `+1` followed by a `−1` destroys nothing — the retraction restores, so
the pair is reversible and carries no Landauer floor. A consensus fold that **keeps** the retractions
is agreement-with-history: everyone converges on a current value while the alternatives remain
recoverable. Nothing is erased, so nothing is charged. It is **compaction** — discarding the
retraction history — that erases, and therefore compaction is where the bill arrives.

That is the same conclusion reached from the other direction earlier and recorded then as *"the heat
is in the compaction, not in the fold"* — now with a reason rather than an observation.

## What is already built

- **`src/Core/ToffoliGate.fs`** — Z-set encoding for reversible computing, with the precise note that
  *"a reversible network erases nothing internally by construction; what Landauer prices is ancilla
  left dirty at the end."* **Ancilla-left-dirty is compaction.** The module already says where the
  cost is.
- **`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`** — the bridge.
- **`src/Bayesian/BayesianTemperature.fs`** — uncertainty → a shared temperature readout, which is the
  `T` in `kT ln 2`.

So the three pieces of a cost model exist: a reversible substrate, a pricing principle, and a
temperature. What has not been written down is the **budget equation**.

## The budget equation, offered as a toy

> Escalate to consensus when the accumulated cost of continued divergence exceeds the erasure cost of
> merging: `C_divergence(t) > kT ln 2 × (bits destroyed by the merge)`.

This makes the threshold **derived rather than chosen** — which was the weakest point of the Jeans
framing, where I had to concede the threshold was ours to pick. Here it falls out of a comparison of
two costs, both in principle measurable.

**How it fails, cheapest first:**

1. **"Bits destroyed by the merge" may not be well-defined.** If the alternatives are not
   distinguishable states but overlapping distributions, the count is a differential entropy and
   differential entropy is not a bit count. **This is the likely failure** and should be checked
   before anything is built on it.
2. **`C_divergence` may not be a cost at all.** Divergence is usually the *product* — distinct
   identities are what we want. If continued divergence is free or beneficial, the inequality never
   triggers and there is no threshold, only a preference.
3. **`BayesianTemperature` is not a thermodynamic temperature.** It is a projection of belief
   uncertainty. Using it as the `T` in Landauer is an identification that has not been earned, and
   `toy-is-free-metered-must-be-earned.md` says it stays `toy` until it is.

## What I retract

The Jeans-threshold document (`2026-08-18-curvature-is-not-gravity-here-*.md`) is **not withdrawn** —
its detector/actuator distinction is Aaron's and stands — but its framing is corrected here: it
disciplines a GR analogy that was never claimed, and its "threshold we choose" concession is
superseded by the budget equation above, which derives one. **The error was mine and it is the ordinary
one:** I supplied the physics I associate with a word instead of asking which physics was meant.

## Pointers

- `docs/research/2026-08-18-curvature-is-not-gravity-here-*.md` — the doc this corrects
- `docs/research/2026-08-18-the-two-e8s-meet-at-the-root-system-and-the-zset-landauer-bridge-already-exists.md`
  — where "the heat is in the compaction, not in the fold" was first recorded
- `src/Core/ToffoliGate.fs` · `src/Bayesian/BayesianTemperature.fs` ·
  `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`
- Landauer 1961 · Bennett 1973, 1982 (*The Thermodynamics of Computation*) · Fredkin & Toffoli 1982
- `.claude/rules/toy-is-free-metered-must-be-earned.md`
