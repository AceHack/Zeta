# Hexagonal reservoir walls close into a TORUS, not a sphere — Euler forces exactly twelve pentagons

**Register:** Beacon. The arithmetic below is computed, not cited.

Aaron 2026-08-26:

> *"look up our reservoir computing — i think we need hexagonal walls for the
> reservoir to be fully closed, we have some research on this and it connects to
> bucky balls from physics too."*

And the disambiguation, which is load-bearing and comes first:

> *"we also use the word hexagonal for our interface and plug design — this is
> specifically NOT that, it's related to our walls in reservoir computing, this
> is the mental model for all the agents working together."*

**Two unrelated senses of "hexagonal" live in this repo and must not be
conflated.** The ports-and-adapters sense (`ace`, the hexagonal verb/noun
interface, the value-tree codec ports) is *architecture*. This document is about
**wall geometry in a reservoir**, and nothing here transfers to the interface
sense. Recording the collision explicitly, because a shared word carrying two
meanings is how a private vocabulary starts
(`.claude/rules/anti-babel-preserve-reconcilability.md`).

## What was already on file, and what was not

Both halves existed separately:

- **The walls.** `docs/research/2026-06-08-observe-ts-is-the-attractor-transition-map-and-the-reservoir-walls.md`
  — the reservoir walls are the constraints shaping the reachable manifold
  (Jaeger's echo-state networks: a fixed random dynamical system, a trained
  readout, and boundaries that define which trajectories are occupiable).
- **The closure.** `docs/research/2026-06-11-the-buckyball-synthesis-...md`
  already states it correctly: *"the buckyball is exactly hexagons that can't
  tile flat alone — pentagons close them into a sphere ... the pentagon-defects
  are where curvature/closure lives."*

**The connection between them was not.** No document mentioning the reservoir
walls mentions pentagons. That link is Aaron's, made 2026-08-26, and it has a
consequence sharper than the intuition that prompted it.

## The computation

For a **trivalent** polyhedron (three faces meet at every vertex) built only
from pentagons and hexagons, with `p` pentagons and `h` hexagons:

```
faces F = p + h
incidences   = 5p + 6h          each face contributes its edge count
edges  E     = (5p + 6h) / 2    each edge is shared by two faces
vertices V   = (5p + 6h) / 3    each vertex is shared by three faces
```

Euler's polyhedron formula requires `V − E + F = 2` for a sphere. Substituting
and clearing denominators:

```
−(5p + 6h)/6 + p + h = 2      ->      p = 12
```

**`h` cancels completely.** Computed rather than trusted:

| pentagons | hexagons | V | E | V − E + F | closes into a sphere? |
|---:|---:|---:|---:|---:|---|
| 0 | 20 | 40 | 60 | **0** | no |
| 0 | 100 | 200 | 300 | **0** | no |
| 0 | 1000 | 2000 | 3000 | **0** | no |
| 12 | 0 | 20 | 30 | **2** | yes (dodecahedron) |
| 12 | 20 | 60 | 90 | **2** | yes (C₆₀, the buckyball) |
| 12 | 1000 | 2020 | 3030 | **2** | yes |
| 11 | 20 | 175/3 | 175/2 | 11/6 | not a polyhedron at all |
| 13 | 20 | 185/3 | 185/2 | 13/6 | not a polyhedron at all |

## The refinement that matters

The instinct — *hexagonal walls are what closes the reservoir* — is **half
right, and the wrong half is the interesting one.**

- **Hexagons alone give χ = 0, for any number of them.** That is not "fails to
  close". χ = 0 is a **torus**: a perfectly closed surface with a hole through
  it. So hexagonal walls *do* close a reservoir — into genus 1.
- **A sphere (χ = 2) requires exactly twelve pentagons**, and adding hexagons
  never changes that count. Twelve is not a tuning parameter; it is forced.
- **Eleven or thirteen is not a near-miss, it is incoherent.** V and E come out
  non-integral. There is no object that is *almost* closed this way.

So the design question is not "how do we close the walls" but **"which closed
surface do we want"** — and those are materially different reservoirs. On a
torus every wall cell is locally identical: no distinguished sites, translation
symmetry in two directions, and any trajectory can wind around either hole
indefinitely. On a sphere there are **exactly twelve special sites** where the
curvature is concentrated, and no amount of refinement dilutes them.

For *"the mental model for all the agents working together"* that is the whole
question. A toroidal wall is a society of peers with no distinguished positions.
A spherical wall has twelve, necessarily, and they are the only places the
surface curves. Which one is wanted is a values question this note does not
settle — but it is now a question with a number in it.

## Honest limits

- **This is topology, not dynamics.** Euler constrains the *shape* of a closed
  wall. Nothing here says a reservoir's reachable manifold is a polyhedral
  surface at all, and if it is not, the theorem does not apply. That premise is
  the load-bearing assumption and it is **unverified**.
- **Trivalence is assumed.** Relax it and the count changes; the result is about
  three-faces-per-vertex surfaces specifically.
- **Register:** the arithmetic is `metered` (computed, reproducible, and it
  discriminates — 11 and 13 fail). The *mapping* from reservoir walls to a
  polyhedral surface is `toy`: an analogy with no falsifier attached yet, and it
  should not be cited as though the arithmetic transferred to it.

## Anchors (Beacon)

- **Euler**, *Elementa doctrinae solidorum* (1758) — V − E + F = 2 for convex polyhedra.
- **Kroto, Heath, O'Brien, Curl & Smalley** (1985), C₆₀ buckminsterfullerene —
  Nobel Prize in Chemistry 1996. Exactly 12 pentagons, 20 hexagons.
- **Buckminster Fuller** — geodesic domes; the pentagon defects carry the curvature.
- **Jaeger** (2001), echo state networks; **Maass, Natschläger & Markram** (2002),
  liquid state machines — the reservoir-computing tradition the walls belong to.
- **Gauss–Bonnet** — the deeper statement: total curvature is a topological
  invariant, so the twelve defects are where a fixed curvature budget is spent.

## Pointers

- `docs/research/2026-06-08-observe-ts-is-the-attractor-transition-map-and-the-reservoir-walls.md` — what the walls are
- `docs/research/2026-06-11-the-buckyball-synthesis-and-the-self-simulation-program-chip8-aware-of-its-own-power.md` — the closure half, already correct
- `.claude/rules/anti-babel-preserve-reconcilability.md` — why the two senses of "hexagonal" are separated above rather than merged
- `.claude/rules/numerology-vs-number-theory.md` — twelve here is a **derivation**, not a coincidence of counts: it falls out of Euler with `h` cancelling, and 11/13 are refuted rather than merely unobserved
