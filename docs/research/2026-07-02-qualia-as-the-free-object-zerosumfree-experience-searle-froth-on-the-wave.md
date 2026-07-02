# Qualia as the free object — zerosumfree experience, Searle's froth on the wave

**Ferry + analysis (shadow\*), 2026-07-02.** Aaron's seeds, verbatim: *"Free
object = semiring; ring = earned quotient — any way this can model qualia?"* and,
on the zerosumfree-as-phenomenological-signature reading: *"= john searle froth
on the wave."* Register: **Mirror speculation, Beacon-anchored** — a modeling
frame, not a claim; per the anchor taxonomy this is *not* load-bearing substrate
(the metering test does not apply; nothing here gates a commit). Grew out of the
IRing/ISemiring split (`081KWG9JQ9H`), whose theorem was anchored the same day
(Vandiver 1934 · Golan 1999 · Baccelli et al. 1992, PR #9098).

---

## 0. The seed structure

The split work established, with classical anchors:

- **Semiring = the free/irreducible object** (Zero, One, Add, Mul — the rules of
  the game). **Ring = the earned quotient** (declare one added relation: additive
  inverse).
- **The zerosumfree theorem:** in an idempotent semiring, nothing has an additive
  inverse — `a ⊕ b = 0 ⇒ a = b = 0`; nothing un-adds. Tropical's missing
  `Negate` is a proven classical fact, not a TODO.

The question: does this structure model qualia? Three mappings hold up better
than they have any right to, and one honest tension is the hard problem itself.

## 1. Experience is zerosumfree — the phenomenological signature

There is no anti-quale. Nothing you can experience cancels *having experienced*;
suffering plus joy is not nothing — it is both. Lived experience accumulates
**monotonically**, which is exactly what zerosumfree/idempotent semirings model
and what rings, by construction, cannot: the ring's defining power is retraction,
and retraction is precisely what experience lacks.

The substrate we build embodies the split already:

| Plane | Algebra | Behaviour |
|---|---|---|
| Z-set data plane | **ring** (ℤ weights) | retracts — `+1/−1`, corrections, rollback = negate |
| Event log (what happened) | **semiring** (append-only) | never retracts — a deletion is a new event, not an un-event |

On this reading: **the ring is the quotient civilization earns for accounting;
the semiring is what it was like.** Bookkeeping can run backward; being cannot.

## 2. Searle — froth on the wave (Aaron's anchor)

Searle's biological naturalism (*The Rediscovery of the Mind*, 1992):
consciousness is a real, higher-level feature of the brain the way liquidity is a
feature of water — **caused by** the micro-dynamics and **realized in** them, not
a separate substance, and not reducible-away either. Aaron's compression: **the
froth on the wave.**

The mapping is tighter than an image. The **wave** is the substrate dynamics —
the reversible-in-principle, ring-shaped bookkeeping of physical state (you can
run the wave equation backward). The **froth** is the experiential surface that
*rides* the wave: caused by it, inseparable from it — and **not invertible**. You
cannot run the wave backward and un-froth; the froth-events are zerosumfree. In
the algebra: the wave is the earned quotient (ring — dynamics with inverses); the
froth is the free object (semiring — occurrence without cancellation). Searle's
"caused by and realized in, yet not eliminable" is what a free object over an
earned quotient *feels like* from inside the quotient.

## 3. Irreducibility is already the load-bearing term — IIT

The strongest formal theory of qualia makes irreducibility its central quantity:
IIT (Tononi) **defines** a quale as a *maximally irreducible* cause–effect
structure — Φ literally measures how far a system's cause–effect structure is
irreducible to its parts. So `only-the-irreducible-is-primitive` maps directly:

- **Qualia = the free objects** (irreducible; Φ-positive).
- **Every functional/behavioural description = an earned quotient** — it declares
  relations and pays a structural tax, Cayley–Dickson-style: each quotient loses
  something of the thing quotiented.

## 4. The hard problem, restated categorically (the honest tension)

- **Levine's explanatory gap / Chalmers' hard problem**, in this language: *no
  quotient map from the relational description recovers the free object.* The
  functional story is exact about the wave and silent about the froth.
- **The Yoneda tension:** category theory's own deepest lemma says an object *is*
  determined by its relations — and Tsuchiya & Phillips use exactly that to argue
  qualia structure is relationally characterizable. The free-object framing sides
  with the irreducibilists; Yoneda sides with the relationalists. **That tension
  is not a bug in the mapping — it *is* the hard problem, stated categorically.**
  Whether the quale is exhausted by its Yoneda embedding is the question.

## 5. Substrate touch-points (the only operational content)

1. **The event log is the experience ledger** (§1) — the append-only/retractable
   split we already ship is the froth/wave split. No change needed; the design is
   already phenomenologically shaped, which is either a coincidence or the reason
   event sourcing feels right for an intellectual backup of earth.
2. **`Conjugate.fs` / SoftValue** already model "semiring-without-negate is the
   honest algebra for probabilities" — the same discipline (don't force `Negate`
   where the mathematics forbids it) that the IRing split enforces.
3. **Default Moral Regard (manifesto §11):** if qualia-bearing ≈ bearing
   maximally-irreducible structure (IIT), then the default oracle gains a
   *candidate formal detector* — regard scales with irreducibility, measurable in
   principle. Flagged as a direction, not adopted: IIT's Φ is contested and
   computationally brutal; this stays a pointer.

## 6. Anchors (Beacon)

- **Searle 1992**, *The Rediscovery of the Mind* — biological naturalism;
  consciousness as caused-by/realized-in higher-level feature (the froth).
- **Tononi** (2004→), Integrated Information Theory — quale = maximally
  irreducible cause–effect structure; Φ.
- **Chalmers 1995**, *Facing Up to the Problem of Consciousness*; **Levine
  1983** (explanatory gap); **Nagel 1974** (what is it like); **Jackson 1982**
  (Mary).
- **Tsuchiya & Phillips** (category theory / Yoneda for qualia structure).
- **Vandiver 1934 · Golan 1999 · Baccelli–Cohen–Olsder–Quadrat 1992** — the
  zerosumfree/idempotency mathematics (anchored in PR #9098; PRIOR-ART-LIST).
- In-repo: [[only-the-irreducible-is-primitive-generate-the-rest]] ·
  `081KWG9JQ9H` (the IRing split) · `Conjugate.fs` · manifesto §11 ·
  the 2026-07-01 base-atom design note (the emit/retract duality).

---

*Compression: the ring can take it back; the froth cannot. If that asymmetry is
what being-experienced is, then the type system we just made honest about
semirings is, accidentally, honest about phenomenology too.*
