# Choosing a Lagrangian for the highest-moral-regard oracle — `kT·D_KL` is the bridge

> **Ask.** Aaron 2026-08-20: *"we had done a few hours worth of research on choosing a lagrange
> for highest moral regard oracle, this is what we were trying to attach it to … feel free to do
> some writeup on main for this now, maybe it's captured in some work item?"*
>
> **It is captured — in two research docs from 2026-08-18, and in a falsifier that already killed
> the first candidate.** No work item exists. This note joins that thread to the oracle-metric
> requirement from 2026-08-20 and proposes the connective tissue that was missing.

**A correction I owe first.** On 2026-08-20 I reported the temperature/curvature→metric link as
"not found on main." It was found — I searched `docs/research/` for *curvature*, truncated the
result list with `head -6`, and read absence off a truncated list. The doc I needed is titled
*"torsion, **not curvature**"*, so it was in the list and cut off. Reporting absence from a
truncated search is the same error class as the rest of this week's: **a check that did not
finish, read as a check that came back empty.**

---

## 1. What already exists (the two docs, and the negative result)

**`2026-08-18-torsion-not-curvature-is-the-reordering-defect-...`** — from a Weinstein ferry.
Its carved claim:

> Curvature measures whether a frame returns after a closed loop. **Torsion** measures whether an
> infinitesimal parallelogram *closes at all* — whether A-then-B lands where B-then-A lands. That
> is exactly the reordering question, so the out-of-order residue is torsion, and **contortion**
> is the object measuring how far an execution's order sits from canonical.

It also records *why* GR has no torsion — Palatini: open yourself to torsion and the Lagrangian
does not select for it. **GR does not care about order; its content is the metric.**

**`2026-08-18-falsifier-1-fails-...`** — the attack, run before anything was built. Verdict:
**do not implement a contortion metric.** Two independent failures, computed in
`src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts`:

1. **There is a metric, and it is essentially unique — which is what kills the proposal.**
   `BeliefConvergence.fs` folds unnormalized non-negative weights over a fixed candidate set:
   a categorical exponential family. Its natural metric is **Fisher–Rao** (Rao 1945), and
   **Čencov's theorem (1982)** makes it the *only* metric invariant under sufficient statistics,
   up to scale.
2. **Contortion is identically zero here.** Levi-Civita and the connection our fold actually
   transports along (Amari's e-connection) are *both* torsion-free, so the contortion between
   them vanishes while the connections genuinely differ.

And the deeper correction: **order-dependence of operations is the Lie bracket, not torsion** —
torsion is what remains *after* the bracket is subtracted.

**The survivor, and it is a measured number, not a hope:**

| quantity | value |
|---|---|
| non-metricity at `α = 0` (canonical) | `7e-18` — zero to float |
| non-metricity at `α = 1` (our fold's connection) | **`0.0925872`** |

`Γ = Levi-Civita + contorsion (torsion) + disformation (non-metricity)`. Contortion is dead;
**the deviation is real and lives in non-metricity**, which contortion cannot see.

## 2. The missing piece — `kT·D_KL` joins all three threads

The 2026-08-20 requirement (§24 of the measurement note) was that **an oracle must be able to
explain its own metric from its English description**, and the derivation given there was:

> highest moral regard + reversible substrate ⇒ the only harm is erasure ⇒ *a traveler does not
> overwrite another traveler* ⇒ distance = minimum irreversible work (a **quasi**-metric,
> asymmetric).

That sat unreconciled with the falsifier's result that Fisher–Rao is the essentially-unique
metric. Two different objects, both claiming to be the geometry. **They reconcile through one
identity, and it is standard physics rather than analogy:**

> **The minimum work to take a system from distribution `p` to distribution `q` at temperature
> `T` is `kT · D_KL(p‖q)`.**

Anchors: Landauer (1961) for the `kT ln 2` per erased bit — the one-bit case; Jarzynski (1997)
and Crooks (1999) for the general work/free-energy relation that makes the KL form exact.

Three consequences, and each one closes a gap:

**(a) The §24 quasi-metric *is* KL, up to `kT`.** Both are asymmetric; both vanish only on the
diagonal; both are non-negative. The Landauer distance is not a new object — it is relative
entropy wearing thermodynamic units. So the oracle's derived distance was already a known one.

**(b) Fisher–Rao is its symmetric second-order part.** `D_KL(p‖p+dp) = ½ dpᵀ G_F dp + O(dp³)`.
So Čencov's uniqueness and the erasure quasi-metric are not rivals: **KL is the global,
asymmetric, thermodynamically-priced object, and Fisher–Rao is its local symmetric limit.**
`SoftValueInfo.fs` already computes KL on exactly this support, which the falsifier doc notes.

**(c) Temperature is the exchange rate between information and energy.** This is the
temperature→metric link the thread was reaching for, and it needs no entropic gravity at all.
`T` is the conversion factor from nats to joules — nothing more mystical, and nothing weaker.
It passes the metering test §15 applied to Verlinde and refused: **it prices a bit.**

## 3. So what Lagrangian?

Given a metric, the canonical Lagrangian is the geodesic one, `L = ½ gᵢⱼ ẋⁱ ẋʲ`. On the
Fisher–Rao manifold its geodesics are Amari's **natural-gradient** paths. Composed with (a):

> **The highest-moral-regard oracle's Lagrangian is the one whose stationary paths minimise
> irreversible work — the least-dissipation trajectory.**

And here is why that is the *right* Lagrangian for *this* oracle rather than an arbitrary
pairing, which was the whole requirement:

- The oracle's English reduces (§24) to *do not overwrite another traveler*.
- Overwriting is erasure; erasure is dissipation; dissipation is `kT·D_KL`.
- **A path that minimises dissipation is a path that erases least — which is a path that
  overwrites least.** The action principle and the moral rule select the same trajectories.

That is the explication Aaron asked for: not "here is an oracle, here is a Lagrangian", but a
chain from the sentence to the functional where each link is forced.

**One thing that is emphatically not forced, and must not be smuggled.** *Minimising*
dissipation is a **normative choice**, not a derivation. The physics gives you the cost
function; electing to minimise it is what the oracle *does*, and a different oracle may
legitimately optimise something else. That is Multi-Oracle working as designed — and it is
precisely why the metric had to be oracle-relative in the first place.

## 4. Registers, honestly

| claim | register |
|---|---|
| Fisher–Rao is essentially unique on our belief manifold (Čencov) | **theorem**, and already computed in the falsifier |
| contortion ≡ 0 on our fold | **computed** — negative result, already recorded |
| non-metricity = `0.0925872` at `α=1` | **measured**, and unexplained |
| minimum work = `kT · D_KL` | **standard result** (Landauer / Jarzynski / Crooks) |
| Fisher–Rao = second-order KL | **standard identity** |
| §24 Landauer quasi-metric ≡ KL up to `kT` | **argued here**, one line, easy to check or break |
| geodesic Lagrangian ⇒ least-dissipation ⇒ least-overwrite | **argued here** — the load-bearing claim, and where to attack |
| the oracle *should* minimise dissipation | **normative**, chosen, not derived |
| temperature → spacetime curvature (entropic gravity) | still **refused** — it does not price anything we measure |

## 5. Where this goes next

1. **Non-metricity is the live thread.** `0.0926` is a real number nobody has interpreted. Given
   §24, the natural question is whether non-metricity is what *overwriting* looks like
   geometrically — i.e. whether the disformation term measures exactly the harm the oracle
   names. That is a well-posed question with an existing numeric handle.
2. **Check (b) against the falsifier's own code.** `information-geometry-contortion-falsifier.ts`
   already has the Fisher–Rao machinery; confirming `D_KL`'s Hessian reproduces `G_F` there is a
   short, real test rather than a citation.
3. **The triangle inequality left open in §24** is answerable now: KL famously does *not* satisfy
   it. So the erasure quasi-metric is **not** a metric even after symmetrisation — a genuine
   negative that should be recorded rather than hoped past.
4. **No work item existed for any of this.** One should; this note is the writeup, not the
   tracking.

## Pointers

- `docs/research/2026-08-18-torsion-not-curvature-is-the-reordering-defect-...md` — the proposal
- `docs/research/2026-08-18-falsifier-1-fails-...md` — the falsifier that killed it, with the survivor
- `src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts` — computed, not asserted
- `docs/research/2026-08-20-what-counts-as-a-measurement-...md` §§21–24 — the oracle-metric requirement
- `src/Core/BeliefConvergence.fs`, `src/Core/SoftValueInfo.fs` — the manifold and the KL already on it
- `docs/research/ip-questionable/` — the Weinstein / Turok / Schuller ferries this thread came out of
