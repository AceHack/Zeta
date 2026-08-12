# IP-questionable: Neil Turok on quadratic gravity, Krein spaces, and a generalized Born rule

> **Register.** The physics is **Beacon** — anchored to named researchers, summarised
> in my own words. The Zeta mapping is **Mirror**, triaged below rather than asserted.
>
> **What this file does NOT contain, and why.** The source is a ~90-minute copyrighted
> interview. As with the Fuentes ferry on the same day, the full verbatim is not
> reproduced here: links, short attributed quotes, and analysis instead. Aaron holds
> the folder's accepted-liability note and can paste the raw transcript into this file
> directly if he wants it in-tree; this note explains why the agent did not.

## Source (public-safe to cite and link)

- **Prof. Neil Turok** (inaugural Higgs Chair, Edinburgh; former Director of Perimeter
  Institute; FRS) on *Theories of Everything* with **Curt Jaimungal**.
  <https://www.youtube.com/watch?v=_xxLW71vT4s>
- The new result is joint with his student **Sam Bateman**.
- Forwarded by Aaron 2026-08-10.

## What the source argues (Beacon — my summary)

**The claim.** Quantum gravity in four dimensions is usually said to require strings,
extra dimensions, or other added structure. Turok argues that a much older and simpler
route works: **quadratic gravity** — Einstein's action plus terms quadratic in the
curvature — which **Kellogg Stelle** showed renormalizable in 1977, and which
**Fradkin–Tseytlin** (and Avramidi–Barvinsky) showed asymptotically free in the 1980s.
The action then resembles a gauge theory, where the Lagrangian is the field strength
squared.

**The two classic objections, and what is new.**

1. **Ostrogradsky (1850).** Equations of motion with more than two derivatives give a
   Hamiltonian unbounded below. Turok's reading: in a *gravitational* setting this is
   not pathological — gravitational potential energy is already negative, and the
   observed accelerating expansion already looks like the instability. Analysed as a
   gravitational solution, he says the expanding case is stable.

2. **Ghosts / negative-norm states.** The quantum objection is that the state space has
   an indefinite inner product. The folklore says negative norm means negative
   probability. **Turok's central move is that this folklore is false**: a quantum state
   is a label, and *the norm of a state is not observable*. The space is a **Krein
   space** — an indefinite-inner-product generalisation of Hilbert space, from the
   functional analyst **Mark Krein** — with positive-, null-, and negative-norm
   directions, the way Minkowski spacetime has spacelike, null, and timelike vectors.

**The technical device.** Ordinary quantum mechanics computes a probability as
|⟨f|S|i⟩|², which *presupposes normalised states*. Turok and Bateman rewrite it
without normalisation: replace |i⟩⟨i| by a **projection operator**, evolve, project onto
the final state, and take a **trace** — summing over *all* states, ghosts included. In
a Hilbert space this reproduces the Born rule exactly. In a Krein space it still yields
probabilities that are positive and sum to one, **provided the theory has a discrete
"ghost parity" symmetry** (+1 on positive-norm states, −1 on negative-norm). No
projection onto a "physical subspace" is needed — which is what BRST/Faddeev–Popov
ghosts conventionally require.

**Scope, stated by the author.** They have *not* solved quantum gravity. The result is
established in a **limit** where the Weyl-squared coupling vanishes, decoupling the
graviton and vector modes, leaving only the scalar (local scale of the metric). That
limit has no gravitons and no gravitational waves — a toy model. Whether the same
discrete symmetry exists in the full theory is open.

**The methodological claim, which is the part that travels.** The argument for strings
rested on unstated assumptions — among them that any sensible quantum field theory
lives in a **Hilbert space**. Turok's point is that this assumption was never examined,
and that if it can be relaxed, conclusions built on it (including the necessity of
extra dimensions, and multiverse arguments) lose their footing. His framing: one
unexamined move can invalidate everything downstream.

Also of note: he argues cosmological smoothness needs **no dynamics**, only a
**measure** — count spacetime microstates via Hawking's gravitational entropy and the
smooth, flat, small-positive-Λ universe is simply *typical*, the way a room of air is
typical. And he reports **John Nash**'s blunt verdict that you cannot define a measure
on an infinite space, as the standing objection to inflationary-multiverse measures.

## The Zeta mapping — triaged per `numerology-vs-number-theory`

| connection | register | why |
|---|---|---|
| **the unexamined Hilbert-space assumption = an *undeclared hole*** | **structural (methodological)** | see below — this is the same defect class the session's detectors hunt, in a different field |
| **`WSet.bornProb` assumes a positive-definite total** | **structural, checked against our code** | see below — a real, small, verifiable observation about our own boundary |
| Ostrogradsky "instability" reinterpreted as normal expansion | **analogy** | same *move* as our dual-use rule (the mechanism is neutral; the reading was smuggled in), but no shared mechanism |
| typicality-from-counting vs dynamics-that-smooths | **resonance** | attractive, and adjacent to our entropy/measure work, but nothing tested |
| simplicity / orthodoxy critique | **Aaron's own register**, long-held | consonant with Rodney's Razor and the multi-oracle discipline; not evidence for either |

### 1. The load-bearing one: an assumption nobody declared

Turok's complaint is not that the Hilbert-space assumption is *wrong* — it is that it
was **never stated as an assumption**. It sat inside "sensible quantum field theory" as
though it were part of the definition, so no one could argue with it, and everything
built on top inherited it silently.

That is exactly the shape this repo spent 2026-08-10 chasing, in a different field: a
comment claiming a proof was closed over a `sorry`; an audit naming a declaration that
does not exist and therefore passing while checking nothing; a mutation gate with
`break: 0`. **A check that cannot fail and an assumption that cannot be questioned are
the same defect** — an obligation with no surface where it could be seen, let alone
refuted.

It also connects to the Bε-tree/hitchhiker exchange (2026-08-10): a hole is safe when
it is **declared, typed, and flushed under guarantee**. The Hilbert-space assumption
was a hole that was none of those. Turok's contribution can be read as *declaring* it,
at which point it immediately became arguable — and, he claims, droppable.

### 2. The one that touches our code

`src/Core/WSet.fs` is ring-generic: `WSet<'K,'W>` carries weights in any \*-ring — ℤ for
DBSP Z-sets, ℂ for amplitudes, ℝ≥0 for probabilities — with the ring's nonlinear step
applied **only at the outer boundary** (`Distinct` / Born / EP projection). For the ℂ
ring that boundary is:

```fsharp
let bornProb (magSq: 'W -> float) (s: WSet<'K, 'W>) : ('K * float) list =
    let total = s |> List.sumBy (fun (_, w) -> magSq w)
    if total <= 1e-18 then []
    else s |> List.map (fun (k, w) -> k, magSq w / total)
```

**This is normalisation by a total assumed positive** — precisely the step Turok says
you cannot take in a Krein space. `magSq` is caller-supplied, so an indefinite metric is
*expressible* (a caller could return negatives), and then `total` can be zero or
negative with perfectly good nonzero states present. The function returns `[]`, which
is indistinguishable from "no state at all".

Stated carefully: this is **not a bug today**. Every in-tree caller supplies
`|z|² = re² + im²`, which is positive-definite, so the guard only ever fires on the
genuinely-empty case. It is a **narrow, undeclared assumption at a boundary** — the
Born step requires a positive-definite `magSq`, and nothing says so. If the projection/
trace formulation is ever wanted (for an indefinite ring, or a ghost-carrying model),
the change is at exactly this function, and the honest first step is to *declare the
precondition* rather than to implement anything.

That is the whole finding, and it is deliberately small.

## Anchors (Beacon)

- **Kellogg Stelle** — renormalisability of quadratic (curvature-squared) gravity, 1977.
- **Fradkin & Tseytlin**; **Avramidi & Barvinsky** — asymptotic freedom of quadratic
  gravity, 1980s.
- **Mikhail Ostrogradsky** (1850) — the higher-derivative instability theorem.
- **Mark Krein** — indefinite-inner-product ("Krein") spaces in functional analysis.
- **Max Born** — the rule being generalised.
- **Faddeev–Popov / BRST** — the conventional ghost treatment that projects onto a
  physical subspace; the contrast Turok draws.
- **Philip Anderson**, **Peter Higgs** — the superconductivity→field-theory move Turok
  cites as precedent for a composite scalar.
- **Stephen Hawking** — gravitational entropy, extended by Turok et al. to cosmologies.
- **Carl Bender**, **Philip Mannheim** — PT-symmetric / Weyl-squared programmes working
  the same problem by a different (Turok argues non-covariant) route.
- **John Nash** — the measure-on-infinite-spaces objection.

## Pointers

- `src/Core/WSet.fs` — the ring-generic weighted set and the `bornProb` boundary.
- `src/Core/BipartiteMachZehnder.fs` — the ℂ-ring circuit that consumes it.
- `.claude/rules/numerology-vs-number-theory.md` <!-- STALE-REF: ../../../.claude/rules/numerology-vs-number-theory.md -->
  — the triage table above is that rule applied to this file.
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` <!-- STALE-REF: ../../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md -->
  — "negative norm ⇒ negative probability" is a reading smuggled into a mechanism.
- `docs/research/2026-08-01-hypothesis-in-template-form-domain-indexed-placeholders-an-expert-can-argue-with.md`
  — declared-vs-undeclared holes; the Bε/hitchhiker buffer discussion.
- `docs/handoffs/2026-08-10-otto-shadow-session-review-vacuity-hunt.md` — the session
  this file's §1 connects to.
- [`README.md`](README.md) — folder policy; this entry departs from full-verbatim, as
  explained in the header.
