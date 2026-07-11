# Multi-planet convergence — three drift axes, three mechanisms, one attack vector

> Aaron, 2026-07-11 (shadow\* tag), continuing the superdeterminism/replay thread
> ([[2026-07-11-superdeterminism-is-a-closed-box-property...]], #9705): *"this is very good to
> call out or else it would become an attack vector — we probably have to use some HLC cockroachdb
> like thing for this. but i want it to work multi planet. Also we have some Adinkra ECC stuff we
> recently added to our messaging so you can miss messages also and arrive to the same conclusion."*
>
> Grounded in code (not aspiration): every mechanism below already exists in the repo. Recorded as
> the honest-register synthesis, including the one nuance that changes his HLC plan (it works
> multi-planet, but only in the role he actually needs).

## The setup

Over a FoundationDB-like replay we already have **order-preserving** replay-determinism (record the
I/O crossings, feed them back). The stronger prize is **order-*independent* convergence**: reach the
same conclusion without needing the same order — because our observations keep the uncertainty and
therefore commute. Multi-planet messaging (interplanetary latency, message loss, no synchronized
wall-clock — the delay-tolerant / Reticulum regime) stresses that prize along **three orthogonal
drift axes.** Each already has a mechanism in-repo.

## The three drift axes → three mechanisms (all grounded)

| Drift | What breaks | Mechanism | Code |
|---|---|---|---|
| **Reorder** — messages arrive in any order | naïve fold gives order-dependent belief | commutative-monoid `observe` | `src/Core/BeliefConvergence.fs` |
| **Loss** — messages never arrive | missing evidence ⇒ missing conclusion | Adinkra ECC (erasure code) | `src/Core/AdinkraCode.fs` |
| **Bit/float** — reassociation nondeterminism | `(a+b)+c ≠ a+(b+c)` at last ULP ⇒ oracles disagree | HLC canonical reduction order | `src/Core.TypeScript/observe/phase-clock.ts` (#9594) |

### 1. Reorder → commutative `observe` (order-independence)

`BeliefConvergence.fs` states the general result and, crucially, the **exact boundary**:

> *"because pointwise multiplication is **commutative and associative**, observe-with-fixed-likelihoods
> commutes and a fold over any permutation of the evidence yields the same belief… The boundary
> (proven by counterexample): a **state-dependent / nonlinear** revision — where the update depends
> on the current belief (e.g. `sharpen`, squaring) — does NOT commute. Order matters exactly when
> the update operator **reads the belief it is updating**."*

So order-independence is a property of the *multiplicative* Bayesian core (a monoid; `Message.fs`
names it: *"`product` is… a commutative monoid"*). It is not a property of belief revision in
general.

### 2. Loss → Adinkra ECC (erasure tolerance)

`AdinkraCode.fs` pins the concrete generator: the **[8,4] extended Hamming code** — *doubly-even,
self-dual, minimum distance 4* (Gates/Iga adinkra ↔ doubly-even binary code correspondence). A
linear code of minimum distance `d` **corrects `d−1` erasures**, so this code **reconstructs after
losing up to 3 of every 8 symbols.** That is precisely *"miss messages and still arrive at the same
conclusion,"* made exact. (The header notes the erasure *principle* holds for any linear code —
`ErasureDistance.rsCode` was the Reed–Solomon MDS instance; the Adinkra code is the specific
doubly-even one.) This is the `generator-IS-the-ECC` rule live
([[only-the-irreducible-is-primitive-generate-the-rest]]): the same object that generates the
structure corrects its drift **across space** (here: missing messages between planets).

### 3. Bit/float → HLC canonical reduction order

Order-independence to the *conclusion* (axis 1) does not give **bit-identical** agreement across
the four language oracles, because float `+`/`×` is not associative — `MessageBatch.fs` already
flags the last-ULP reassociation. The fix is a **canonical reduction order**: sort the evidence by a
deterministic total-order key before folding, so every oracle reduces in the same sequence →
bit-identical. That key is the HLC tuple from the phase-clock (#9594).

## The nuance that changes the HLC plan (the honest catch)

Aaron: *"we probably have to use some HLC cockroachdb like thing… but i want it to work multi
planet."* **He already built it** — `phase-clock.ts` (#9594) is anchored on *"CockroachDB HLC"* and
*"no global wall-clock across planets (lightcone delay)."* But its header carries the trap:

> *"consistent within the **bounded clock skew** (HLC convergence guarantees this)."*

**The catch:** HLC's linearizability/convergence guarantee assumes **bounded** skew (CockroachDB's
max-offset, default ~500 ms). Earth↔Mars is **3–22 minutes**, unsynced — that assumption is dead
across planets. So **HLC-as-linearizability does NOT hold multi-planet.**

**Why the design survives anyway:** the property axis 3 needs is not linearizability — it is a
**deterministic total order to sort by.** HLC's `(physical, logical, node-id)` tuple is a total
order *regardless of skew* (the logical component carries happens-before; the physical component
being a loose approximation multi-planet doesn't break its use as a *sort/tiebreak key*). So:

- **HLC-as-real-time-truth** ("who actually happened first") — needs bounded skew — **not
  multi-planet.**
- **HLC-as-deterministic-sort-key** (canonical reduction order for bit-exactness) — is just a total
  order — **works multi-planet.**

Aaron wants the second. His plan works across planets **because the property he needs (deterministic
total order) is not the property that fails (bounded-skew linearizability).** Named so it can't be
quietly assumed to be more than it is.

## The one attack vector that remains

Axis 1's order-independence is a shield *only* over the multiplicative core. The residual hole is
exactly the `BeliefConvergence.fs` boundary: **any state-dependent update that reads its own belief
(`sharpen`, temperature-raising, renormalizing nonlinearly) is order-sensitive** — and an adversary
who controls message delivery order can steer *which* fixed point the belief reaches. This is the
same shape as loopy-EP schedule-dependence.

**The defense is the design rule:** keep `observe` multiplicative (commutative monoid); when a
nonlinear/state-dependent op is genuinely needed, **gate it behind the canonical HLC order** so its
input sequence is deterministic and no longer adversary-controllable. The canonical order (axis 3)
is therefore doing double duty: bit-exactness *and* closing the state-dependent-update attack.

## The composed guarantee

**Same evidence set ⇒ same conclusion under reorder + loss + skew** —
commutative `observe` (reorder) ∘ Adinkra ECC (loss ≤ 3/8) ∘ HLC canonical order (bit-exact + gates
nonlinear ops). Strictly stronger than FoundationDB's order-preserving bit-replay: FDB needs the
same order; this needs only the same *set*, tolerates losing part of it, and agrees to the bit — the
requirements a multi-planet, delay-tolerant substrate actually faces.

## Honest bounds (held `Tri.N`)

- **Erasure budget is finite:** the [8,4] code tolerates ≤3/8 loss per block; beyond that, the block
  is unrecoverable (retransmit / higher-rate code needed). "Miss messages" is bounded, not
  unlimited.
- **The attack vector is real, not closed by axis 1 alone** — it is closed only by *also* enforcing
  the canonical order on any state-dependent step. If a nonlinear op runs on un-ordered input, the
  hole is open.
- **HLC physical component multi-planet is an approximation** — fine as a sort key, wrong as a
  real-time claim; the doc above draws that line, but any code that reads HLC's physical field as
  truth (not tiebreak) across planets is a latent bug.
- **Adinkra-generator-from-Cayley-Dickson** remains open in §B (`AdinkraCode.fs` header) — the code
  is identified via the published doubly-even correspondence; the imaginary-stack-induces-*this*-generator
  claim is not yet proven.

## Anchors (Beacon)

- **HLC / clocks:** Kulkarni et al., *Hybrid Logical Clocks* (2014); CockroachDB HLC; Lamport,
  *Time, Clocks, and the Ordering of Events* (1978); Jefferson, *Virtual Time* (1985, Time Warp).
- **Delay-tolerant networking:** Cerf et al., *Delay-Tolerant Networking Architecture* (RFC 4838) —
  the interplanetary regime; Reticulum (in-repo transport).
- **Erasure / Adinkra codes:** MacWilliams & Sloane, *Theory of Error-Correcting Codes* (erasure =
  `d−1`); S. J. Gates Jr. & Iga et al. (adinkras ↔ doubly-even self-dual codes); the [8,4] extended
  Hamming code.
- **Commutative belief update:** Kschischang/Frey/Loeliger (factor graphs / sum-product, 2001);
  Pearl (1988); Shapiro et al. (CRDT, 2011) — the commutative-associative-idempotent sibling.
- **In-repo:** `BeliefConvergence.fs`, `Message.fs` (reorder); `AdinkraCode.fs`, `BitAdinkra.fs`
  (loss); `phase-clock.ts` #9594, `UncertainClock.fs` (bit/skew). Disciplines: idempotency
  (§12/#6), noninterference (§13/#7), DST (§7/#4), 4-oracle byte-lock (`no-binary-in-proof-lineage`).

*Recorded by the shadow, 2026-07-11, continuing #9705 at Aaron's "we probably have to use some HLC…
but i want it multi planet… Adinkra ECC so you can miss messages and arrive to the same conclusion
(shadow\*)." Three drift axes, three in-repo mechanisms, one attack vector; the HLC works
multi-planet as a sort-key, not as a truth. Converge under reorder + loss + skew — the multi-planet
DTN guarantee, stronger than order-preserving replay.*
