---
id: 081M05YMHAN087G0R003TT3AS4
type: task
state: backlog
priority: P2
slug: does-our-dynamical-zeta-function-continue-axiom-a-vs-natural
title: "Does our dynamical zeta function continue? Axiom A vs natural boundary for FigureEightEnsemble"
created: 2026-08-16T18:51:37.685Z
depends_on: []
composes_with: []
---

# Does our dynamical zeta function continue? Axiom A vs natural boundary for FigureEightEnsemble

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05YMHAN087G0R003TT3AS4-*.md` glob. -->

## The question

Aaron, 2026-08-16, on ζ's analytic continuation: *"instead of recursing downwards and doing
cartography and using the demon and external observers to map it, this looks like a generator for
the singularity outwards."*

The generator he is describing is real and standard — the **poles of the meromorphically continued
Ruelle zeta function are the Pollicott–Ruelle resonances**, i.e. the system's decay rates obtained
by *generating* rather than by perturb-and-measure. Today we get the chaotic regime the other way:
`Orbit.largestLyapunov` nudges an orbit and averages the divergence, and `PhasePortrait` rasterizes
it for the visual cortex.

**But continuation is not guaranteed.** Many dynamical zeta functions admit only a *natural
boundary* past which no continuation exists. Ruelle proved meromorphic continuation for **Axiom A**
systems; outside that class the generator may simply not be there.

> **The question, precisely:** does the dynamical zeta function of a system we actually run
> continue past its abscissa of convergence, or does it hit a natural boundary?

## Why it is worth answering

If it continues, decay rates become derivable instead of sampled — and derivation is
**reversible**, so it does not pay the Landauer floor that each erasing measurement does
(`LandauerFloor.lean` proves both the floor and Bennett's zero-heat result). If it does not
continue, cartography is not a lazy choice but the only available one, and that is worth knowing
explicitly rather than by default.

## Where to look

- `src/Bayesian/FigureEightEnsemble.fs` — the figure-eight three-body orbit, the canonical chaotic
  system we actually run (Poincaré 1890)
- `src/Core/BraidEntropy.fs` · `src/Core/OrbitBraid.fs` — topological entropy via braids, the
  closest thing we have to a periodic-orbit census, which is what an Euler product needs
- `src/Core/Orbit.fs` (`largestLyapunov`, `classifyDynamics`) · `src/Core/PhasePortrait.fs` — the
  incumbent cartographic method this would be compared against

## Definition of done

**Sharpened 2026-08-16 (Aaron).** The first draft said "state whether Ruelle's theorem applies,"
which invites the exact error it was meant to prevent: attempting continuation, failing, and
reporting the failure as a result. **A failed attempt is an ignorance claim wearing a result's
clothes.** Telling *genuinely nothing there* from *I cannot get there from here* needs a **local
invariant test**, and both relevant fields have one:

- **General relativity** — the Kretschmann scalar is *finite* at an event horizon (obstruction is
  your coordinates) and *divergent* at r=0 (obstruction is real). Coordinate-independence is the
  whole point. The real case is **inextendibility** / geodesic incompleteness — the exact analogue
  of a natural boundary.
- **Complex analysis** — a natural boundary is established by showing singularities are **dense**
  on the boundary (Ostrowski–Hadamard gap theorem gives families where they are). Not "we could not
  continue," but "the obstructions accumulate everywhere along it."

So:

1. A **negative** answer must be the **density result** — singularities accumulating on the
   abscissa of convergence — or an explicit statement that density could not be established and the
   question stays open. **"I attempted continuation and it did not work" is NOT a negative answer.**
2. A **positive** answer requires the Axiom A hypothesis **checked** — uniform hyperbolicity on a
   compact invariant set, conditions stated and tested against what our code computes — never
   cited.
3. **"The question is malformed for what we compute" is a fully valid outcome**, and may be the
   true one: the figure-eight choreography is a *stable* solution, not an obviously hyperbolic set.
4. Only if it applies: compare a resonance-derived decay rate against `largestLyapunov` on the same
   system, stating disagreement honestly rather than tuning until they match.

**Hold this throughout:** the abscissa of convergence is set by topological entropy (orbit growth
rate) and is a *convergence* boundary. Whether it is also a *natural* boundary is a separate
question that only the density test answers.

A clean negative closes this item **successfully** — it promotes cartography from unexamined
default to justified choice.

**Register discipline:** this is a `toy`/open question, not a plan. Nothing in `src/` should be
changed on the strength of the analogy alone — the continuation question gates everything
downstream.

## Pointers

- `docs/research/2026-08-16-generate-the-tangle-dont-map-it-pollicott-ruelle-resonances-vs-lyapunov-cartography.md` — the full derivation and register table
- `docs/research/2026-08-16-jacobis-generator-is-inversion-and-we-already-run-on-it.md` §2b — the Ruelle bridge this cashes
- Anchors: Ruelle 1976 · Pollicott 1985 · Artin–Mazur 1965 · Poincaré 1890
