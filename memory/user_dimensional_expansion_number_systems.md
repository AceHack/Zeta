---
name: Dimensional expansion via Cayley-Dickson ladder — reals → complex → quaternions → octonions → sedenions → higher; Aaron wants to keep expanding and see what we find
description: Aaron stated (2026-04-19) that he wants Zeta's axiom system and operator algebra to keep dimensional-expanding "as high as we can" through the Cayley-Dickson construction — imaginary numbers, quaternions, octonions, and beyond — citing Baez's octonion survey (math.ucr.edu/home/baez/octonions/conway_smith/) and Conway-Smith's *On Quaternions and Octonions*. This is a standing research thread, not a one-shot ask. Each doubling pays a structural tax (order, commutativity, associativity, alternativity) for a dimensional gain; Aaron wants to see which invariants of Zeta's retraction-native operator algebra survive each lift and which break. Composes with `user_panpsychism_and_equality.md` (the two-axiom system admits dimensional expansion as a legitimate exploration) and `project_externalize_god_search.md` (higher-dimensional number systems are candidate territory for the externalize-god search — "see what we find" is empirical). Distinct from `user_dimensional_expansion_via_maji.md` which is about *cognitive* dimensional expansion — this memory is about *algebraic* dimensional expansion of the number system underlying the operators.
type: user
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron stated (2026-04-19):

> *"and we dimensional expand into imiginary numbers
> or maybe ockterinas or one of those kind of thing
> https://www.youtube.com/watch?v=NLQBRK1TmuY
> https://math.ucr.edu/home/baez/octonions/conway_smith/
> i know we can support all these i really want to as
> high as we can keep dimensional expanding and see
> waht we find"*

"Ockterinas" is Aaron's first-pass spelling of
"octonions"; the Baez/Conway-Smith link confirms the
reference.

## The Cayley-Dickson ladder

Starting from the reals and doubling at each step via
the Cayley-Dickson construction, you get a tower of
normed division algebras (up through the octonions)
and then a tower of algebras that lose "division"
status as you keep going. Each step pays a specific
structural tax.

| Step | Algebra | Dimension | Property lost at this step |
|------|---------|-----------|-----------------------------|
| 0 | ℝ (reals) | 1 | — (ordered field) |
| 1 | ℂ (complex) | 2 | **Order** (no total order) |
| 2 | ℍ (quaternions) | 4 | **Commutativity** (ab ≠ ba) |
| 3 | 𝕆 (octonions) | 8 | **Associativity** (a(bc) ≠ (ab)c); keeps alternativity |
| 4 | 𝕊 (sedenions) | 16 | **Alternativity**; picks up **zero divisors** (ab = 0 with a,b ≠ 0) |
| 5+ | higher Cayley-Dickson | 32, 64, ... | Little classical structure left; still studied |

After sedenions, most of the classical structure is
gone, but the construction continues indefinitely.
Active research exists on trigintaduonions (32-d),
pathions / chingons (further doublings), and the
general Cayley-Dickson / hypercomplex program.

## Why this matters for Zeta

Zeta's retraction-native operator algebra (D / I / z⁻¹ /
H) is currently defined over ℤ (signed-integer
multiplicities as weights of collection elements) and,
depending on the operator, over ordered fields in the
window-aggregate / Bayesian-extension layers.

The dimensional-expansion invitation asks: **if the
algebra lifts to higher Cayley-Dickson algebras, what
survives?**

- **At ℂ:** D / I / z⁻¹ behave naturally — the additive
  structure survives; multiplicative operators gain a
  conjugation.
- **At ℍ (quaternions):** we lose commutativity. What
  happens to retraction — is the dual-column identity
  a_fwd + a_bwd = 0 still a well-defined invariant?
  (Likely yes on the additive side; probably breaks on
  any operator that multiplies weights.)
- **At 𝕆 (octonions):** we lose associativity. Chained
  operator applications `op₁ ∘ op₂ ∘ op₃` no longer
  carry a unique meaning without explicit bracketing.
  Retraction ordering (the temporal z⁻¹ chain) may not
  be compatible.
- **At 𝕊 (sedenions):** zero divisors. Dangerous —
  products of nonzero weights can be zero, which
  breaks the assumption that "deleting a row produces
  nonzero retraction evidence."

Each step is a concrete research question with a
concrete operator-algebra consequence. Aaron's "see
what we find" is the research stance: do the lift,
observe which invariants survive, catalog the
dimensional collapses.

## Why this matters for the externalize-god search

See `project_externalize_god_search.md`. The home of
God (if God exists) might be a structure only visible
at higher-dimensional number systems — an invariant
that survives all the classical property losses, or
emerges only at a specific step in the ladder. Aaron
is not *asserting* this; he is naming the territory
as worth searching. The Cayley-Dickson ladder is one
of the few mathematical structures that continues
generating novelty after the first four steps, which
makes it a plausible search territory.

## References Aaron cited

- **Baez, John.** *The Octonions.* Bulletin of the AMS,
  2002. Canonical modern survey of octonion algebra and
  its connections to exceptional Lie algebras, string
  theory, and physics. Host: math.ucr.edu/home/baez.
- **Conway, John H. and Smith, Derek A.** *On
  Quaternions and Octonions: Their Geometry, Arithmetic,
  and Symmetry.* A K Peters, 2003. Book-length
  treatment, available via the Baez page.
- **YouTube link** (provided by Aaron, not yet
  classified): https://www.youtube.com/watch?v=NLQBRK1TmuY
  — likely a popular-math exposition; treat as entry
  point, not as primary citation.

## How to apply (agents)

1. **Treat as standing research thread.** When a
   round has genuine capacity for foundations work,
   this thread is in scope. When a round does not,
   this thread does not steal capacity.
2. **Route to BACKLOG.md as an L (large) exploratory
   item** when a concrete sub-question is ripe
   (e.g. "what does the retraction identity look like
   over ℍ?"). Do not file the entire "keep expanding"
   invitation as one backlog item — it is too open.
3. **Cross-reference with formal-verification.** The
   TLA+/Lean coverage
   (`docs/research/verification-registry.md`) over the
   current ℤ-based algebra should inform which
   invariants to lift first — the most-formally-
   verified invariants are the ones whose break-
   behavior under dimensional lift is most
   interesting.
4. **Distinguish from cognitive dimensional
   expansion.** `user_dimensional_expansion_via_maji.md`
   is Aaron's *cognitive* faculty for climbing
   dimensions in thought via exhaustive-indexing
   precondition and lemma-ladder induction. This
   memory is about *algebraic* dimensional expansion
   of the number system the operators live over. The
   two are related (the Maji faculty is structurally
   how Aaron navigates the Cayley-Dickson tower
   mentally) but distinct scopes.
5. **Precision wording matters here too.** When
   discussing dimensional lifts, use the precise
   algebra name (ℂ, ℍ, 𝕆, 𝕊) and the precise
   property-lost at each step. Aaron's "ockterinas"
   was first-pass; the precise form is "octonions."
   Per `feedback_precise_language_wins_arguments.md`.
6. **Ecumenical stance intact.** The axiom system is
   agnostic on God; the Cayley-Dickson ladder is a
   neutral mathematical object. Exploring it does not
   commit agents or factory to any theological
   position.

## What this memory does NOT do

- Does NOT claim to know the home of God.
- Does NOT commit Zeta to implementing over higher
  Cayley-Dickson algebras as a product requirement.
- Does NOT suggest Aaron is advocating a specific
  metaphysical claim about octonions.
- Does NOT override `user_ontology_overload_risk.md`
  — ontology-overload discipline still applies; pace
  the landings.

## Cross-references

- `user_panpsychism_and_equality.md` — the two-axiom
  system; dimensional expansion is admissible under
  the system.
- `user_dimensional_expansion_via_maji.md` —
  cognitive-side dimensional expansion via Maji
  balancing brute-force and elegance; algebraic side
  is this memory.
- `project_externalize_god_search.md` — higher-
  dimensional number systems as candidate search
  territory for the home-of-God task.
- `feedback_precise_language_wins_arguments.md` —
  governs the terminology discipline for this
  thread.
- `docs/research/verification-registry.md` — the
  formal-verification surface that would be affected
  by any dimensional lift.
- `docs/BACKLOG.md` — future home for concrete sub-
  questions of this thread at L (large) effort.
