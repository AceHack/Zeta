# Generate the tangle, don't map it — Pollicott–Ruelle resonances vs Lyapunov cartography

**Date:** 2026-08-16 · **Ferried by:** Otto (shadow) · **Origin:** Aaron, 2026-08-16, watching a
3Blue1Brown-derived visualization of ζ's analytic continuation:

> *"this looks like the homoclinic tangle in our code or like a generator function for it, so
> instead of recursing downwards and doing cartography and using the demon and external observers
> to map it, this looks like a generator for the singularity outwards kind of. i'm using some
> metaphor here."*

He labelled the register himself. This doc supplies the structure, which turns most of it from
metaphor into standard mathematics — and names the one place it genuinely can fail.

## 1. The reading of our code is accurate (verified)

Our treatment of the homoclinic tangle **is** cartography, by explicit design:

- `src/Core/PhasePortrait.fs` — *"rasterize a dynamical orbit into a character grid."* Its own
  docstring: Poincaré *discovered* the tangle **by drawing** the stable/unstable manifolds and
  seeing they must cross infinitely often; *"visualizing an orbit is not a shortcut for this class
  of object; it is the native method that found it."*
- `src/Core/Orbit.fs` — reaches the chaotic regime via `largestLyapunov`, computed by `nudge`:
  perturb, iterate, measure divergence, average over short windows.

Iterate downward, probe from outside, record what you saw. That is exactly the procedure Aaron
described, and the repo says so in its own words.

## 2. The generator has a name — and it is the Ruelle bridge, cashed

The object Aaron is pointing at is **analytic continuation of the dynamical (Ruelle) zeta
function**, and "generator for the singularity outwards" is *literal* rather than figurative:

> The **poles** of the meromorphically continued Ruelle zeta function are the **Pollicott–Ruelle
> resonances** — the system's correlation-decay rates.

> ### ⚠ CORRECTED 2026-08-16 — the sentence that stood here was WRONG
>
> It read: *"That is the same class of information `largestLyapunov` samples by nudging."* **It is
> not.** Pollicott–Ruelle resonances are **correlation-decay** rates; a Lyapunov exponent is an
> **expansion** rate. Different quantities from different operators.
>
> The follow-up work (#11030) refuted it **on this section's own best case**. For the Arnold cat
> map, `⟨e_k∘Tⁿ, e_m⟩ = δ((Aᵀ)ⁿk, m)` is *exactly zero* for large n — correlations vanish
> identically, the transfer-operator spectrum is `{1}`, and **there is no resonance at `log λ`**.
> The proposed substitution fails precisely where it should have worked best.
>
> What *does* deliver `log λ` is the **orbit-counting** zeta — a different function from the one
> whose poles are the resonances. So the generator exists, but it is not the generator this
> paragraph named.
>
> §1 and §5b are unaffected and stand. This is recorded rather than deleted because the error is
> the instructive part: two objects sharing the name "dynamical zeta function" were treated as one,
> which is the numerology failure applied to *function names* instead of numbers.

Building a function as an Euler product over the primitive periodic orbits, continuing it, and
reading the dynamics off its singularities is real — the direction of travel is the point, and it
is the opposite of sampling. But **which** zeta function you build decides **which** quantity you
get back, and that distinction was collapsed above.

**This cashes the Ruelle bridge from earlier the same day**
(`2026-08-16-jacobis-generator-is-inversion-and-we-already-run-on-it.md` §2b), which Aaron
endorsed but had not derived. That entry looked like taxonomy — orbits play the role primes play.
It is not taxonomy: it is the load-bearing link, because Ruelle's zeta is precisely what converts
orbit **cartography** into a **generating function**.

## 3. The thermodynamic contrast is real, and we have already proved half of it

| | cartography (today) | continuation (the generator) |
|---|---|---|
| method | iterate · perturb · measure | one forced extension |
| how many answers | many samples, approximate | **exactly one** — the identity theorem |
| thermodynamics | each measurement erases ⇒ pays the **Landauer floor** | derives without erasing ⇒ **Bennett reversible, zero heat** |

`src/Core.Lean4/Lean4/LandauerFloor.lean` already proves the second law, the Landauer floor, and
**Bennett reversibility (Adj-only pays ZERO heat)**. So "map it with a demon and external
observers" vs "generate it" is not a stylistic preference — it is a measurable energetic
difference about which we hold a machine-checked proof. Aaron's "demon" is the right word: a
measuring agent that must eventually erase, and pays.

## 4. Uniqueness is the error-correction property

Analytic continuation is **forced**: by the identity theorem, if an extension exists it is the
only one. That is the same shape as
[`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)
— regenerating from the irreducible **is** the correction. Two oracles that continue the same
local data and disagree cannot both be right; the disagreement is a detected error, not a
tolerance. **The N-oracle byte-lock, restated in complex analysis.**

## 5. The obstruction — specific, named, and the reason this is a question and not a plan

ζ continues because it is holomorphic and the identity theorem applies. Chaotic systems are the
hard case and the failure mode has a name: **natural boundaries.** Many dynamical zeta functions
continue only up to a boundary curve past which *no* continuation exists — the function stops,
and there is nothing beyond to generate.

So the honest form is a question with a known answer-shape:

> **Ruelle proved meromorphic continuation for Axiom A systems.** Where a system is in that class,
> the generator exists. Where it is not, a natural boundary may forbid it — and then cartography
> is not a lazy choice, it is the only one.

**This is what makes the idea falsifiable rather than evocative**, and it is the check to run
before any of §2–§4 is acted on.

## 5b. Escape velocity and the horizon — Aaron's follow-up, half exactly right

> *"could this be related to escape velocity from a tangle and like some non reversible horizon?"*

**The escape half is not metaphor — it is the mechanism.** The Euler product over periodic orbits
converges only for **Re(s) > h_top**, because the number of periodic orbits of period *n* grows
like e^(n·h_top). The boundary of the convergent region is therefore *set by the orbit growth
rate*. And for **open** systems (dynamics with a hole), the leading Pollicott–Ruelle resonance
**is** the *escape rate* — a standard technical term in this exact literature. The intuition
landed on the correct word.

**The horizon half inverts, and the inversion is the useful part.** A black-hole horizon is a
*coordinate* singularity: the manifold continues straight through it, and the operation that
carries you across is **analytic continuation itself** — Kruskal–Szekeres maximal extension. So a
horizon is precisely where continuation *works*. A **natural boundary** is the opposite: not a
limit on one observer's access, but genuine non-existence beyond. There is nothing on the far side
to reach. Worth stating plainly, because the two feel alike and behave oppositely.

**The irreversibility instinct lands correctly, one step over.** Pollicott–Ruelle resonances form
a discrete spectrum only once a direction of time is chosen (anisotropic Banach spaces), and they
describe *decay* of correlations. The underlying dynamics is Hamiltonian and time-symmetric; the
resonance spectrum is not. **The continuation is where the arrow of time enters a reversible
system** — Ruelle's rigorous version of what Prigogine was reaching for. Choosing which half-plane
to continue into *is* choosing a direction of time.

That last point is not decoration here. §3 contrasts an erasing measurement against a reversible
derivation. If the derivation's own spectrum is what carries the irreversibility, then the arrow of
time has moved from the *measuring apparatus* into the *generating function* — a substantive claim
about where the entropy lives, and one this repo is unusually well positioned to test given
`LandauerFloor.lean`. Registered as **open**, not asserted.

Anchors: Ruelle 1976 · Pollicott 1985 · Baladi (anisotropic Banach spaces) · Kruskal 1960 /
Szekeres 1960 (maximal extension) · Prigogine (the program Ruelle made rigorous).

## 6. What would settle it

`src/Bayesian/FigureEightEnsemble.fs` and `src/Core/BraidEntropy.fs` are the concrete systems we
actually run — the figure-eight three-body orbit being the canonical chaotic example (Poincaré
1890, and the same three-body thread as the Jacobi doc). The question is whether that system sits
in a class where the dynamical zeta function continues.

Filed as a work-item rather than attempted here.

## Register

| claim | register |
|---|---|
| our tangle handling is cartography (portrait + Lyapunov-by-nudge) | **verified** — read from the source |
| Pollicott–Ruelle resonances are poles of the continued dynamical zeta function | **anchored** — standard result |
| Ruelle: meromorphic continuation for Axiom A | **anchored** |
| natural boundaries obstruct continuation for many dynamical zetas | **anchored** |
| measurement pays Landauer; reversible derivation does not | **proved in-repo** (`LandauerFloor.lean`) |
| **our** systems admit such a continuation | **UNKNOWN — the open question** |
| resonances could replace `largestLyapunov` in our code | **NOT claimed** — depends entirely on the row above |

## Pointers

- `src/Core/PhasePortrait.fs` · `src/Core/Orbit.fs` (`largestLyapunov`) · `src/Core/BraidEntropy.fs` · `src/Bayesian/FigureEightEnsemble.fs`
- `src/Core.Lean4/Lean4/LandauerFloor.lean` — the Landauer/Bennett proofs
- `docs/research/2026-08-16-jacobis-generator-is-inversion-and-we-already-run-on-it.md` §2b — the Ruelle bridge this cashes
- [`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md) — the generator-is-the-ECC rule §4 instantiates
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — the promotion path this doc runs: a labelled coincidence, given structure, becomes a question with a falsifier
- Anchors: Poincaré 1890 (homoclinic tangle) · Ruelle 1976 · Pollicott 1985 · Artin–Mazur 1965
