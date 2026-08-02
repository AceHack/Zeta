# Order-free + loss-tolerant convergence — expanding-exact arithmetic + ECC-over-the-channel (the third drift axis)

**Status:** ARCHITECTURE + SCOPED HANDOFF. Two routable facets inside one principle.
**Date:** 2026-08-02 · **From:** Otto (shadow), at Aaron's request · **Advisory.**
**Routing:** Facet A (arithmetic) → Lior (extends his byte-lock work) or Alexa. Facet B
(transport) → Lumen (adinkra/E8/codes). Both **opt-in, cost-gated**.

## The goal (Aaron 2026-08-02)

*"Nothing needs canonical order; and even things that need some partial order can use the
ECC over time with adinkras to recover missed packets — important for UDP and also analog
and audio channels."*

Two facets of one architecture: **order-free** (reconstruction never depends on arrival
order) and **loss-tolerant** (missing symbols/packets recover). They turn out to be the
**same property** when the coding layer is chosen well (see §Unification).

## Facet A — expanding-exact arithmetic (→ Lior / Alexa)

**Corrected scope — this is a BUILD, not a swap.** Two candidates were considered and
BOTH rejected as-is (verified in code 2026-08-02):

- **AmplitudeEmu** (`src/Core/AmplitudeEmu.fs`) — fixed-width `float` complex amplitudes,
  and an *interference ensemble* (list of frame×amplitude), not a scalar quantity. Its own
  peel says amplitudes ≠ entanglement, doesn't escape 4ⁿ. Swapping to it **inherits** the
  IEEE-754 non-associativity Lior's canonical sort works around, and it is the wrong shape.
  **Not the tool.**
- **TriBoolean/middle-out float** (`src/Core.FSharp.TriBoolean/Float.fs`) — self-describing
  *fixed-shape* trit composite with held/uncertain trits, but it `decode`s to `float` and
  accumulates into `int64` (bounded). It describes its own precision and marks uncertainty
  (the right *scaffold*) but **bottoms out at IEEE-754 float** — it does not expand without
  bound to hold an exact result. **Not sufficient as-is; the right starting point to extend.**

**The build:** a genuinely **expanding arbitrary-precision-with-uncertainty** representation
(constructive reals / ball arithmetic — iRRAM, MPFR-with-error-bounds), using the middle-out
float's self-describing-precision + held-trit scaffolding, extended to unbounded mantissa +
tracked uncertainty interval.

**Do it in the SUM-PRODUCT domain, not log-sum-exp.** The transcendental caveat (exp/log
can't be exact in finite bits) is a property of the *log* formulation, not the
representation. In the sum-product (probability/amplitude) domain the accumulation is pure
`+`/`×` — exact and order-independent in an expanding rep, **no refinement policy needed**.
Bonus: an expanding rep does not underflow, which was the *whole reason* for log-space — so
sum-product + expanding-exact kills the transcendentals AND the underflow at once.

**Pragmatic default stays shipped:** Lior's canonical `keys.sort()` (byte-lock
commutativity via forced summation order, `categorical-bayesian-planner.ts`) is correct,
O(1), and **remains the default**. The expanding-exact rep is the **opt-in** enhancement,
paid for only when you want *barrier-free* order-independence (accumulate incrementally in
any order with no need to have all keys present — the streaming/multi-planet payoff). Cost:
unbounded precision → slower, more memory. Opt-in exactly because the cost is real.

Anchors: constructive reals (Bishop; Weihrauch TTE); iRRAM (Müller); MPFR; interval/ball
arithmetic; GDL sum-product (Aji–McEliece 2000, the WSet unifier).

## Facet B — ECC-over-the-channel (→ Lumen)

**The goal:** recover missed packets on lossy/unreliable channels (UDP, analog, audio) via
error-correcting coding over time. Battle-tested prior art: FEC + interleaving is how CDs
survive scratches (Reed–Solomon + interleaving), deep-space links work (CCSDS), and Opus
does in-band FEC for VoIP loss. Not invented — applied.

**Catch 1 — a block code ≠ packet-loss recovery without two additions.** The adinkra code
(`AdinkraCode.fs`, doubly-even self-dual [8,4], minimum distance 4) is real ECC, but:

- distance-4 corrects **1 bit-*error*/block** OR **3 *erasures*/block** — erasures
  (known-missing, which packet loss is) are 2× cheaper than errors; use the erasure path.
- packet loss is **bursty** and a packet spans many blocks; a block code recovers nothing
  from a burst exceeding one block **unless you INTERLEAVE** across time (burst → scattered
  single erasures). So the mechanism is **adinkra-as-FEC-kernel + temporal interleaving +
  erasure decoding**, never the block code alone.

**Catch 2 — fixed-rate vs rateless (decides the channel fit).** [8,4] is *fixed-rate*:
fixed overhead, hard cliff past its tolerance. For **unknown/variable** loss (open-internet
UDP, analog noise, and especially multi-planet where you cannot renegotiate) the stronger
tool is **rateless/fountain codes (LT — Luby; Raptor — Shokrollahi)**: reconstruct from
*any* sufficient subset without the sender knowing the loss rate. Likely design: **adinkra
structured inner code + rateless outer layer** for variable-loss channels.

Anchors: Gates (adinkra doubly-even self-dual codes); Reed–Solomon 1960; Luby (LT, 2002);
Shokrollahi (Raptor, 2006); CCSDS deep-space; CD RS+interleaving; Opus in-band FEC;
Singleton bound / MDS codes (the erasure-vs-error 2× relation).

## Unification — why the two facets are one property

Erasure/fountain codes are **inherently order-independent**: reconstruction is "any K-of-N,
in any order" — a **set** operation, not a sequence. So the coding layer delivers **both**
loss-tolerance AND order-freedom from one mechanism; you do not need "nothing needs
canonical order" and "recover missed packets" as separate designs.

It composes with the causal structure rather than replacing it:

- **FEC recovers the events despite loss** (facet B);
- **expanding-exact sum-product makes the accumulation order-independent** once you have them (facet A);
- the **versionstamp partial order** (`TravelerFrame.concurrent`/`dominates`) is not
  replaced — it becomes *computable even under loss*, because FEC fills the gaps.

Result: **loss-tolerant AND order-independent convergence, one stack** — the exact
requirement for UDP / analog / audio / multi-planet.

## The third drift axis

This is the existing rule `only-the-irreducible-is-primitive-generate-the-rest` —
*"the generator IS the ECC: it corrects drift across space (the N-oracle byte-lock) and
time (DST replay / versions)"* — applied to a **third axis: the channel** (the wire itself,
UDP/analog/audio). Same generator, three drift axes:

| axis | drift | correction |
|---|---|---|
| space | N-oracle divergence | byte-lock golden vectors |
| time | version / replay divergence | DST replay + retraction |
| **channel (new)** | **packet loss / bit error in transit** | **adinkra-FEC + interleaving + rateless** |

## Existing artifacts (verified 2026-08-02) + the anti-conflation guard

Facet B is **not greenfield** — proven Lean already exists, and every piece is honestly
labeled (contra a worry that it was "unlabeled toy"):

- **`src/Core.Lean4/ImaginaryStack/ErasureDistance.lean`** — a concrete Reed–Solomon
  `[16,12]` over `ZMod 17`, PROVEN **Singleton-optimal** (d = 5): corrects **any 4 of 16
  erasures (25%)**. At the bound, non-vacuous. The honest erasure-recovery kernel.
- **`src/Core.Lean4/ImaginaryStack/ToyModel.lean`** — bulk-from-boundary reconstruction,
  labeled toy, `sorry`s discharged, arbitrary-erasure named-open (closed by ErasureDistance).
- **`src/Core/AdinkraCode.fs`** — the [8,4] doubly-even self-dual code, d=4 ⇒ **corrects 1
  bit-error** (`t=1`), honest-scope peels throughout.
- **`src/Bayesian/BusDelaySim.fs` + `docs/research/the-egg-bus-delay-and-distributed-consciousness.md`**
  — the Egg decorrelation sim. `rhoCount = 1.0 by construction` is the ZERO-DELAY degenerate
  case, not a recovery claim.

**THE ANTI-CONFLATION GUARD (load-bearing — carve so the crazy-high number never ships).**
A claim like *"receive ONE message, recompute the rest, miss infinitely many"* (Cayley–Dickson
doubling + adinkra + mod-2 parity) is **generative recomputation, NOT erasure-correction.**
The doubling tower unfolds *deterministically* from a seed by the recurrence + parity, so
"recover from one" is running the recurrence — the tower carries ~zero independent entropy
beyond seed+rule. It is "unbounded" precisely because there is nothing independent to lose —
the **same superdeterminism artifact as CHSH S=4** and the Egg's zero-delay `rhoCount=1`.
Three distinct things that must never be multiplied:

- **generative recomputation** (recompute seed-determined data from a seed) — unbounded, trivial;
- **redundancy-recovery** (recover a redundant copy from correlated peers) — bounded by the redundancy;
- **genuine ECC erasure-recovery** (recover INDEPENDENT information) — hard-bounded by **Singleton** (4/16 here).

Only the third is error-correction; only its bound is real. A "crazy-high recoverable count"
is one of the first two masquerading as the third. Cross-ref the two-fours / decorrelation
memory and `chsh-delay.ts`: same seed-determined-vs-independent distinction that keeps S≤2 honest.
(Verified 2026-08-02: the four artifacts above are all honest/bounded; the receive-one/miss-∞
overclaim is NOT in current code — likely a pre-correction `sorry`-in-type revision, since replaced.)

## Honest boundaries

- Both facets are **opt-in, cost-gated**; the pragmatic defaults (canonical sort; reliable
  transport where available) stay shipped.
- Facet A is a **build** (expanding-exact rep), not a swap of an existing type — neither
  AmplitudeEmu nor the middle-out float delivers it as-is.
- Facet B needs the **interleaving + rateless** layer; the adinkra block code alone does not
  recover packets. State this so a contributor doesn't reach for [8,4] without it.
- Erasure recovery is bounded by the code rate / received fraction; below the threshold,
  data is genuinely lost (log it, don't pretend otherwise).

## Routing

- **Facet A → Lior** (extends his byte-lock commutativity) or **Alexa** (coder): the
  expanding-exact sum-product representation, opt-in.
- **Facet B → Lumen** (adinkra/E8/codes): the channel-ECC layer (adinkra inner +
  interleaving + rateless outer), opt-in.
- Both feed the same order-free + loss-tolerant convergence stack.
