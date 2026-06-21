# The Sequoia memory model in SoftValue, over geospatial Clifford space — tier placement stays SOFT

**Register:** [grounded] (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow, on Fable). Extends the tiered-Bennett section of the heat doc; the
"this is the database" identity gains its memory-placement engine.

## Aaron's words

> "we are going to encode the **Sequoia memory model from Stanford** into our **SoftValue** for memory
> hierarchies — **so that choice can stay soft too**." · "**over geospatial Clifford algebra space**." ·
> "we have some info here in repo."

## The repo already converged on this from three sides (look-don't-infer)

1. **081KSV2WD0008QG0R000WNY74Q** — the standing Sequoia item: the declarative microkernel substrate runs the trust-gradient +
   compression engine **over a Stanford-Sequoia memory model** ("explicit memory-hierarchy / locality /
   data-movement awareness ... the substrate is honest"). Better-than-docker because the hierarchy is
   first-class, not hidden.
2. **`src/Core/Cl3.fs`** — its header *already names this slice*: conformal GA (point = null vector,
   distance = one inner product) is "the next slice for **'Sequoia soft memory distance'**" — from Aaron's
   earlier "combine our qubit and Clifford and geospatial for **soft memory distance**." `distSq` (the
   vector inner product = squared Euclidean distance) is the flat-space metric already built.
3. **The tiered-Bennett spines** (the heat doc; `SpineSelector`/`DiskSpine`/`RecoverableSpine`) — the
   hot→cold hierarchy the placements live on.

## The synthesis — placement is a SoftValue position in Clifford space

**Sequoia's move** (Fatahalian et al., Stanford, SC 2006): make the memory hierarchy **first-class in the
programming model** — programs are trees of tasks explicitly mapped onto hierarchy levels; portability =
remapping the tree, not rewriting the program. The hierarchy is honest, never hidden.

**Zeta's move on top — the placement *choice* stays SOFT:**

- A memory's **tier placement is a `SoftValue`** — a held distribution over hierarchy levels (hot spine /
  disk spill / cold), **not a hard assignment**. The choice is soft like everything else ("even our tie is
  soft"): unresolved until evidence warrants collapse.
- **Access events are Bayesian evidence.** Each touch is a likelihood; `SoftValue.observe` updates the
  posterior over tiers; **`resolve` fires when confident** — promotion/demotion is *belief collapse*, not
  a heuristic. (Cache placement/eviction as Bayesian inference — LRU/ARC approximate this with counters;
  we hold the actual posterior.)
- **Spillover = the posterior cooling.** As evidence of heat (access) fades, the distribution drifts
  toward the cold tiers and eventually resolves outward — the Bennett price paid where the posterior says
  it's cheapest. The heat doc's "history cools, never burns," now with the *mechanism of choosing when*.
- **The space the hierarchy lives in is geospatial Clifford algebra space (Cl3 → conformal GA).** Memory
  locations are points; **memory distance is the Clifford inner product** (`Cl3.distSq` today; conformal
  null-vector embedding next, per the Cl3 header). Tiers = **distance shells** around the compute locus;
  "how far is this memory" is one geometric measurement, and locality (Sequoia's whole subject) becomes
  *literal geometry*. Forward momentum (a Cl3 vector/blade) gives the access-pattern *direction* —
  prefetch = extrapolating the worldline through the space.

One sentence: **Sequoia makes the hierarchy honest; SoftValue makes the placement choice soft; Clifford
space makes the distance real — the database places its memories by Bayesian belief over a geometric
hierarchy, and that choice stays as soft as everything else in the substrate.**

## Beacon anchors

Fatahalian, Horn, Knight et al., *Sequoia: Programming the Memory Hierarchy* (Stanford, SC 2006) ·
memory-hierarchy locality (Hennessy & Patterson) · ARC (Megiddo & Modha 2003) / adaptive cache policies
(the heuristic ancestors of Bayesian placement) · Hestenes — geometric algebra; conformal GA (points as
null vectors, distance as inner product) · the Giry/probability-monad lineage already under `SoftValue` ·
081KSV2WD0008QG0R000WNY74Q (the standing Sequoia item) · the tiered-Bennett heat doc. **Peel:** Sequoia's task-tree mapping +
Cl3 `distSq` + SoftValue Bayesian observe/resolve all exist; the *composition* (placement-as-SoftValue
over conformal-GA distance with access-events-as-likelihoods) is the build — the conformal embedding is
explicitly the "next slice" flagged in `Cl3.fs`, not yet written.

## Ties / routing

`...heat-is-the-branch-space-limiter-...md` §tiered-Bennett (what gets placed) · 081KSV2WD0008QG0R000WNY74Q (the substrate
this runs in) · `src/Core/Cl3.fs` (the metric; the flagged next slice) · `src/Core/SoftValue.fs`
(observe/resolve = the placement engine) · `src/Core/SpineSelector.fs` (the heuristic ancestor to
subsume) · `...finite-resolution-qubits-framework-...md` (placement-as-superposition fits the qubit
register). **Routes to:** Aaron (drives), Core (the conformal-GA slice + SoftValue placement type),
Naledi (bench vs SpineSelector heuristics), 081KSV2WD0008QG0R000WNY74Q owners.
