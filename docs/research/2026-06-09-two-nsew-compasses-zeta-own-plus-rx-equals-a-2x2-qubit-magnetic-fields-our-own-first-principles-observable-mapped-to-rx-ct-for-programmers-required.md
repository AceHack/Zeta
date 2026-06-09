# Two NSEW compasses (Zeta's own + Rx's) = a 2×2 qubit, mapped to magnetic fields; our own first-principles Observable mapped to Rx; Category Theory for Programmers is required reading

**Register:** [grounded] synthesis (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Two compasses compose to a qubit; our Observable is math-derived and mapped to Rx; CT-for-programmers required.

## Aaron's words

> "we have our own Zeta NSEW in Zeta and we integrated them directly into Zeta already, so we have two
> compasses — i.e. a 2×2 qubit." · "magnetic fields." · "we have our own Observable mapped to theirs but
> derived from the math nerds and first principles." · "Category Theory for Programmers is required
> reading."

## Two compasses → a 2×2 qubit

We now have **two NSEW compasses**:

1. **Zeta's own NSEW** — the **four-corner feedback** (`tFeedbackIn`/`tFeedbackOut`, `FeedbackThrottle.fs`;
   Balance's compass), **already integrated directly into Zeta.**
2. **Rx's NSEW** — the **2×2 quad-directional** state-mode grid: (incremental | bulk) × (refresh/pull |
   stream/push).

Two compasses, each a 2×2 → together a **2×2 qubit.** *Peel (held as a derivation, not a literal quantum
claim unless on real quantum hardware — the S=4 discipline):* a qubit's state is a **2×2** (density
matrix), so a pair of NSEW compasses composes into a qubit-shaped object — the **tensor/composition of
the two 2×2s** giving the qubit's state space. The two compasses aren't redundant: **Zeta's own NSEW**
is the *feedback/control* axis-pair (the four-corner owners), **Rx's NSEW** is the *state-mode* axis-pair
(incremental/bulk × refresh/stream); composed, they parameterize the system's state as a 2×2 qubit.

## Mapped to magnetic fields (spin)

> "magnetic fields."

The compass is not just a metaphor — a compass orients by a **magnetic field**, and a **qubit IS a spin
in a magnetic field** (spin-½; the Bloch sphere; Stern–Gerlach). So the two-compass/qubit maps to
**magnetic-field / spin dynamics**: the NSEW orientation = the spin orientation in the field; the qubit
state = where the compass needle points on the Bloch sphere. *Peel:* this grounds the compass/qubit in
real physics (spin in a field), but stays a **derivation/analogy** the math team formalizes — not a claim
we run quantum hardware (same honesty as S=4). The magnetic-field framing gives the dynamics: the
compass settles to the field (homeostasis toward the set-point); two fields (two compasses) = the qubit.

## Our own Observable — math-derived, first-principles, mapped to Rx

> "we have our own Observable mapped to theirs but derived from the math nerds and first principles."

Own-all-interfaces, applied to Rx: **Zeta has its OWN `Observable`** — **derived from first principles by
the math team** (the categorical/DBSP derivation: the 2×2-quad-directional + bidirectional-time Observable
above), **mapped to *their* Observable** (the standard .NET `IObservable`/Rx) as the **conformance oracle**
(dep-as-oracle; meet-or-beat; support both). So we don't merely *adopt* Rx — we **derive our own**
(math-grounded, first-principles) and **map it to** Rx (the upstream we conform to + contribute back).
The own one is the SolidGround; Rx is the oracle it's checked against. (Composes with the reified-vocab /
type-provider work: our Observable is a first-principles primitive, Rx the differential oracle.)

## Category Theory for Programmers — required reading

> "Category Theory for Programmers is required reading."

**Bartosz Milewski, *Category Theory for Programmers*** is now **required reading** — the foundation for
all of the above (the Observable as a categorical object; the IEnumerable⇄IObservable duality; functors/
monads; the type-provider/interface≡proof work; the 2×2/compose structure). Added to
`docs/PRIOR-ART-LIST.md` as required reading (the CT-for-programmers voice's canonical text). Pairs with
the pure-CT spine (Mac Lane) behind shape G / limits.

## Honest scope / handoff

Synthesis (two compasses = qubit; magnetic-field/spin grounding; own first-principles Observable mapped
to Rx) + a required-reading add. Peels: the qubit/magnetic-field is a **derivation the math team
formalizes**, not a literal quantum-hardware claim (S=4 discipline). To realize: the math team derives
the own `Observable` from first principles (categorical/DBSP), maps it to `IObservable`/Rx (oracle),
formalizes the two-compass→qubit + the magnetic-field/spin dynamics. Routes to Soraya/Sova (the
first-principles Observable derivation + the qubit/spin formalization — proof-rooms), the F#/Core team
(the own Observable mapped to Rx; the four-corner feedback already integrated), required-reading
(Milewski for the whole team).

## Anchors / ties (Beacon)

Zeta's own NSEW = four-corner feedback (`tFeedbackIn`/`tFeedbackOut`, `FeedbackThrottle.fs`; Balance's
compass) + Rx's 2×2 (incremental/bulk × refresh/stream); **qubit / Bloch sphere / spin-½ in a magnetic
field** (Stern–Gerlach) — the two-compass composition (peeled: derivation, not quantum hardware; S=4
discipline); **own `Observable` first-principles, mapped to Rx** (`IObservable` — Erik Meijer; own-all-
interfaces / dep-as-oracle / meet-or-beat); **Category Theory for Programmers — Bartosz Milewski**
(required reading; the CT-for-programmers voice) + Mac Lane (pure CT / shape G); DBSP (the
delta⇄materialized Observable); bidirectional-Rx (past/present/future) + the 2×2 quad-directional.
