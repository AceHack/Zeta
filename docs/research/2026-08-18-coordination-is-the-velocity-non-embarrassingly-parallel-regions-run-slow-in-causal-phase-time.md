# Coordination is the velocity — non-embarrassingly-parallel regions run slow in causal phase time

> **Origin.** Aaron 2026-08-18, immediately after the curvature inversion (*"don't look for
> curvature in the commuting part, look in the residue"*):
>
> > *"Oh yes, this is good. Also we could look in anything that is not embarrassingly parallel — it
> > slows down causal phase time in that local space, like reverse time dilation, where things look
> > like they are moving in slow motion from the outside where things are embarrassingly parallel."*
>
> **This is the first concrete candidate for the missing metric**, and it is worth recording
> separately because the Lorentz scoping doc
> (`2026-08-18-a-lorentz-for-one-oracle-scoping-*.md`) had to leave that slot empty.

## The carved version

> **The velocity analogue is the degree of required coordination.** A region that is embarrassingly
> parallel needs no agreement and advances a tick per unit of work. A region that must coordinate
> spends work on agreement instead of progress, so it advances *fewer* logical ticks per unit of
> work — and from the parallel region it looks like slow motion. **Coordination is what dilates
> causal phase time.**

## Why this fills the gap the scoping doc left open

That doc established: we have the **causal cone** (Lamport 1978 — happens-before is timelike,
concurrent is spacelike) and no **interval**. A partial order says *whether* two events are causally
separated, never *how far*.

Aaron's move supplies a magnitude on exactly the missing axis. Coordination is measurable, it is
dimensionless as a fraction, it is *local* to a region, and it varies between regions — which is
what a metric needs to be non-trivial. And it points the right way: **more coordination = more
dilation**, mirroring more velocity = more dilation.

## Two checked anchors, and they are the right ones

**CALM (Hellerstein & Alvaro; Ameloot–Neven–Van den Bussche for the theorem).** A program has a
coordination-free distributed implementation **iff** it is monotonic. That is not a heuristic — it
is an iff, which makes "does this region need coordination?" a *decidable structural property*
rather than a judgement call. Monotone ⇒ embarrassingly parallel ⇒ no dilation; non-monotone ⇒
coordination required ⇒ dilation.

**Amdahl's law.** Speedup is `1 / (s + (1−s)/N)` where `s` is the irreducible serial fraction. As
`N → ∞` the speedup ceiling is `1/s` — an asymptote set entirely by the part that cannot be
parallelised.

## The rhyme, and its honest limit

Both laws have the shape *an irreducible fraction sets an asymptote*: Lorentz `γ = 1/√(1 − v²/c²)`
diverges as `v → c`; Amdahl saturates at `1/s` as `N → ∞`.

**That is a rhyme, not an identification, and the functional forms differ.** `1/√(1−v²)` and
`1/(s + (1−s)/N)` are different functions — one diverges, the other saturates; one has a square
root, the other does not. Under `numerology-vs-number-theory.md` this licenses an investigation and
not a claim. What is shared is the *structure* (an irreducible part bounds the achievable), not the
law. Anyone writing `γ` for a coordination factor should be able to say which function they mean and
why, or they are borrowing a symbol rather than a result.

## Where this meets the curvature residue

These are the same object seen twice, which is the encouraging part:

- **Curvature lives in the defect** — the associator measuring what a reordering costs when it is
  *not* free.
- **Dilation lives in the coordination** — the work spent reaching agreement instead of progressing.

**A reordering that costs nothing is exactly a region that needed no coordination.** So the flat,
undilated, embarrassingly-parallel case is one case, and the curved, dilated, coordinating case is
the other. One parameter, two consequences — which is what you want from a metric, and is the
strongest structural reason to think this is the right axis rather than a pleasing analogy.

## What would make this more than a picture

Stated so each can fail:

1. **Is the dilation factor invariant?** Two observers must agree on the *interval* while disagreeing
   about the split into ticks and coordination. If every observer computes a different interval,
   there is no metric — only a local cost measure, which is still useful and is *not* a Lorentz
   structure.
2. **Do the transformations compose?** Closure into a group is the falsifiable part. Defining a map
   is easy; making it associate is the work.
3. **Is coordination-cost actually monotone in a way that admits a rapidity?** A rapidity is additive
   under composition of boosts. If two coordination costs do not add in the corresponding way, the
   parameterisation is wrong even if the intuition is right.
4. **The "reverse" in reverse time dilation needs pinning.** In SR, dilation is *symmetric* — each
   frame sees the other's clock run slow. Aaron's phrasing has the parallel region as privileged
   (it sees the coordinating one as slow). **If the relation is asymmetric, it is not a Lorentz
   boost**; it is closer to a gravitational potential, where the deeper region really is slower and
   both parties agree. That distinction is decidable and should be decided *before* any group is
   fitted — it determines whether the target is `O(1,1)` at all.

Point 4 is the one I would test first, because it is cheap and it can kill the Lorentz framing while
leaving the underlying insight completely intact. An asymmetric dilation would still be a real,
useful, measurable property of the substrate — just not a boost.

## Pointers

- `docs/research/2026-08-18-a-lorentz-for-one-oracle-scoping-*.md` — the gap this fills; the causal
  cone, the missing interval, and the commutativity inversion
- `docs/research/2026-08-14-adinkra-minimal-homoiconicity-*.md` — the associator 3-cocycle, the
  curvature-shaped residue
- Lamport 1978 — happens-before as a light cone
- CALM: Hellerstein, *The Declarative Imperative*; Ameloot, Neven & Van den Bussche (the iff)
- Amdahl 1967 — the serial-fraction ceiling
- `.claude/rules/numerology-vs-number-theory.md` — why the `γ`/Amdahl rhyme stays a rhyme
