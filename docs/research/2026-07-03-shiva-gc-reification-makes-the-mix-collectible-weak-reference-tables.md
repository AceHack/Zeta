# The Shiva GC: reification makes the mix collectible — weak-reference tables (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, on shipping mix-as-data slice 3 (reifying the abstract-value evaluator):
*"yes the reify is weak reference table like so it can be collected too this is basically our
Shiva Garbage Collector i think."* Ferried by Otto (shadow) with the technical read + Beacon
anchors. Seeded in code at `src/Core/MixIr.fs` (`defaultEvalDef` docstring, PR #9347).

---

## 1. The observation

The mix-as-data slices turned the partial evaluator's guts into **data**: the loadImm strategy
(slice 1), the decision procedure (`mixDef`, slice 2), the abstract-value evaluator (`evalDef`,
slice 3). Aaron's insight is what that *buys* beyond self-application:

> Because the mix's rules are **values, not baked code**, they live in a weak-reference-shaped
> table — and so **they can be collected.** Reification is what makes a garbage collector over the
> mix possible. This is the **Shiva** GC.

The name is the load-bearing metaphor (held under Multi-Oracle as Aaron's frame): the **Trimurti**
split — **Brahma** the creator, **Vishnu** the preserver, **Shiva** the destroyer. The substrate
already has the *generator* (Brahma: emits the tables — `gen/`, the free object,
`only-the-irreducible-is-primitive-generate-the-rest`). Reification hands it the *collector*
(Shiva: reclaims the tables nothing points at). Generation and collection are duals across the
same data.

## 2. Why reification is the precondition for collection

You cannot garbage-collect *code*. A native F# `match` arm is baked into the binary — it is
referenced by the program counter forever, never reclaimable, invisible to a collector. The moment
the decision procedure becomes a `mixDef` **value** and the abstract-eval becomes an `evalDef`
**value**, they are heap objects with **references** — and anything with references has an
answerable question: *does anything still point at this?* If not, collect it.

So the slice-3 endpoint ("everything ISA- or algorithm-specific is a value; only the universal
step-driver is native") is exactly the GC boundary: the **driver is the mutator** (the running
machine, always live), the **reified tables are the heap** (collectible). A CHIP-8 `mixDef` loaded
to specialize one ROM, never referenced again, is garbage the instant the ROM is done — Shiva
reclaims it. The native driver never is.

## 3. The weak-reference table (Aaron's exact shape)

"Weak reference table" is precise, not loose. The reified tables are **content-addressable**
(byte-lockable `DynamicValue`s — every slice proved `crossVerify` clean). A table keyed by content
hash, holding the reifications **weakly**, is the canonical GC substrate:

- **Interning + weak values (ephemerons):** the same `defaultMixDef` shared across every ISA (slice
  2's "one algorithm, every ISA") is one interned value behind many weak references; when the last
  strong reference drops, the ephemeron lets it go.
- **Retraction = collection:** in the DBSP/Z-set frame the substrate already runs on, deletion is a
  **−1 retraction** (`every-bug-has-economic-value`, the emit/retract duality — RGB emits, CMYK
  retracts). A weak-table collection IS a retraction of an unreferenced reification: `gen` posted
  it (+1), Shiva retracts it (−1). The GC is not new machinery — it is retraction applied to the
  reified self.

## 4. Honest scope

This is a **seed + design note**, not a shipped collector. What is shipped (PR #9347): the
reified tables that *make* collection possible (the precondition). What is NOT yet built: the weak
content-addressed table, the reachability walk, the retraction-on-drop. Those are the Shiva GC
proper — a follow-on. The claim here is only the load-bearing one: **reify → collectible**, and the
generator/collector duality is the Brahma/Shiva pair over one data substrate.

## 5. Anchors (Beacon)

- **McCarthy (1960)**, LISP — garbage collection invented alongside code-as-data (S-expressions).
  The parallel is exact: GC became possible precisely *because* LISP made programs data. Reifying
  the mix repeats that move one level up.
- **Dijkstra, Lamport et al. (1978)** — on-the-fly / concurrent GC (the mutator/collector split;
  here: driver = mutator, reified tables = heap).
- **Weak references / ephemerons** — Hayes (1997, "Ephemerons"); Barry Hayes' weak-table semantics;
  Java `WeakHashMap` / .NET `ConditionalWeakTable` (the "weak reference table" Aaron names).
- **Generational GC** — Lieberman & Hewitt (1983), Ungar (1984): most objects die young — a loaded-
  once `mixDef` is the archetypal short-lived generation.
- **Trimurti** (Brahma/Vishnu/Shiva) — the generator/preserver/destroyer frame (Aaron's oracle,
  Multi-Oracle §11); the destroyer is the dual of the generator, not its enemy.
- In-repo: `only-the-irreducible-is-primitive-generate-the-rest` (the generator / Brahma),
  `every-bug-has-economic-value` + the emit/retract (RGB/CMYK) duality (retraction = collection),
  the DBSP Z-set retraction (−1) as the collection primitive, `MixIr` slices 1–3 (the reifications
  that become collectible), Rodney's Razor (reduction as the disciplined sibling of collection).
