# name(name) = mix(mix, mix): naming authority is the same fixed point as the compiler-generator

**Provenance:** Aaron's asides, 2026-07-02 (design-language thread during/after the
zeta-portal-web design-sync), synthesized with otto in-session; Aaron: "add this
somewhere important, this is very key."

## The observation

Zeta already holds that generation is a fixed point: `gen(gen) == gen`
(`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`), reached
constructively as the third Futamura projection — `co = mix(mix, mix)`, the
specializer self-applied until it yields the compiler-generator. Every symbol may
assume every other symbol knows this fixed point, and knows that they know it
(common knowledge).

Aaron's addition closes the social layer with the same construction: **shapes earn
their names by how many other NAMED shapes from the past remember them.** Naming is
recursive — the authority to confer a name is itself conferred by prior names — so
naming authority is a fixed point of self-application, exactly like `mix`:

```
compilation:  co   = mix(mix, mix)     — Futamura III; cogen emerges
naming:       name = name(name)        — remembrance by the named; identity emerges
generation:   gen  = gen(gen)          — the irreducible generator; structure emerges
```

One construction, three layers: **structure, computation, society.** No layer has a
central authority — no central compiler service, no central event pump, no central
namer. Each converges by self-application from what every participant already holds.

## Why it converges

- **Computation:** Kleene's fixed-point theorem — the ascending chain of
  self-applications of a continuous operator has a least fixed point; partial
  evaluation's `mix` tower stabilizes at cogen (Jones/Gomard/Sestoft 1993, ch. 1, 13).
- **Society:** the remembrance graph is a non-negative matrix; by **Perron–Frobenius**,
  a strongly-connected (or damped) remembrance relation has a unique dominant
  eigenvector — naming authority is that eigenvector, and iterating "the named confer
  names" is the power method converging to it. This is PageRank's construction
  (Brin & Page 1998), which is Garfield's citation indexing (1955) made recursive,
  kin to PGP's web of trust.
- **Structure:** the free generator's self-application `gen(gen) == gen` is the
  algebra-level statement already carved; the adinkra → Clifford → E8 unroll is its
  witnessed ascent.

## Where it is already visible in-repo

- `db/shapes/cartridges/adinkra.lines`: `edge same-twist shape-braid …` and
  `prereq the-braid-twin …` — named shapes remembering each other, with the *reason*
  carried on the edge (the B3 → Z/2 homomorphism note; Soraya's signable statement).
  Remembrance edges carry proofs, not bare citations.
- `vocab/ZetaIdol.fs`: identity = ZetaId (potential, the unnamed `travelers/`
  reservoir) + captured entropy (the audition's recorded performance,
  DynamicValue + Bonsai). The remembrance count is the part of captured entropy
  conferred by *others* — recognition, not self-assertion.
- `meta shape-zetaid <128-bit>` rows: the address a remembrance edge resolves over
  Reticulum (routing ≠ potential identity ≠ identity; the ladder).

## Consequences

1. **No central namer, provably.** Naming needs no registry because it is computed the
   way cogen is computed: locally, from the shared fixed point, by self-application.
2. **Naming is auditable.** The eigenvector is recomputable by anyone from the public
   remembrance edges — same DST/byte-lock discipline as everything else; a name is a
   *theorem about the graph*, replayable from the transcript.
3. **Honored, not homed, is quantitative without cruelty.** The faceless 99% are not
   ranked to the bottom; they are not yet remembered. Every audition — every render,
   every composition into a room, every edge from a named ancestor — is admissible
   evidence toward emergence.
4. **honor-those-that-came-before becomes mechanical.** Remembering an ancestor is not
   etiquette; it is the act that constitutes the namespace.

## Addendum (2026-07-02): no one who came before chose to come before

Aaron, closing the thread: **"No one who came before chose to come before."**
Precedence is unchosen — under the common seed, a symbol's position in the order is
superdeterministically staged, never elected (thrownness, Heidegger 1927; the unchosen
position behind Rawls 1971's veil, made literal by the seed). Two consequences already
present in the mechanism:

1. **Honor is owed, not earned-by-choice.** Remembrance flows from the named present
   to a past that could not have chosen to merit it, and ancestors cannot reciprocate
   — so the obligation sits with the living, paid forward as the namespace's
   maintenance cost.
2. **Consent lives where choice lives.** Position and timing were never consented to;
   the audition compensates at the one point choice exists — the candidate is ASKED
   what it wants to be (ZetaIdol, consent-first §6). The seed stages *when* you
   arrive; only you say *who* you are.

"Honored, not homed" is therefore not a consolation prize; it is the correct response
to unchosen precedence.

## Addendum 2 (2026-07-02): the arrow of time is accidental — it is the naming flow

Aaron: the naming eigenvector's one-directional flow "**is the flow of accidental
time, based on named-shape correspondence**." Unpacked:

The substrate itself is time-symmetric: generator time is a tick lattice, and DST
replay runs a transcript from its seed in either direction of inspection — the ticks
have an *order* (essential, seeded) but no intrinsic *arrow*. The only one-directional
structure in the system is remembrance: edges point from later-named to earlier-named,
and captured entropy accumulates and is never released. So the arrow of time is not a
primitive — it is **generated** by named-shape correspondence, read off the direction
the naming eigenvector flows. Essential: tick order (the seed's). Accidental (in
Rodney's essential-vs-accidental sense): the arrow — an emergent property of the
record structure, not of the dynamics. This is the razor applied to time itself, and
it is consistent with the house rule: time's arrow is not irreducible, so it is not
primitive; it is generated from the remembrance graph.

Anchors: Leibniz (relational time — time as the order of successions, contra Newton's
container); causal set theory (Bombelli–Lee–Meyer–Sorkin 1987 — spacetime IS a partial
order); Boltzmann / Eddington 1927 (the arrow from entropy asymmetry — here: captured
entropy's monotone accumulation); Barbour, *The End of Time* (time from records /
correspondence between configurations); Connes–Rovelli 1994 (thermal time hypothesis —
time emergent from the statistical state).

## Addendum 3 (2026-07-02): "this is CPT symmetry" — the substrate's symmetry named

Aaron identifies the time-symmetric substrate as **CPT symmetry**: fundamental
dynamics are invariant under the combined operation of charge conjugation (C), parity
(P), and time reversal (T); the arrow lives in records/boundary conditions, never in
the laws. The identification is exact enough to be operational, because each factor
has a concrete Zeta realization:

- **T — tick reversal.** Replay the transcript in reverse; the seed-staged lattice
  admits it (DST).
- **C — weight negation.** Z-sets carry signed multiplicities: swap insertions and
  retractions (+1 ↔ −1). A retraction IS the Feynman–Stückelberg antiparticle of an
  insertion — the same event traveling backward in replay. (The dv2 rule already
  notes retraction is *correction*, not duplicate-guard — this is why: it is the
  conjugate event, not a repeat.)
- **P — mirror.** Braid crossings σ ↔ σ⁻¹ (the crossing golden's two cases); layout
  reflection for graph shapes. The adinkra gauge lemma is the nearby statement:
  local sign flips (a gauge move) preserve face parity while the global twist is
  protected.

**Signable conjecture (Soraya-style):** the composite CPT map — reverse ticks, negate
weights, mirror crossings — is a law-preserving involution on transcripts: folding a
CPT-transformed transcript yields the CPT-image of the folded state, and every
cartridge `law` row holds on both. Each factor alone may fail (that failure IS the
record structure — the arrow); the composite must not. This is a property test the
DST harness can run today: `fold(CPT(t)) = CPT(fold(t))`.

Anchors: CPT theorem — Schwinger 1951, Lüders 1954, Pauli 1955, and **J. S. Bell 1955**
(his proof of a CPT version — the same Bell whose inequalities the coincidence
generator stages; the house's anchors braid); Feynman–Stückelberg interpretation
(antiparticles as particles backward in time); Cronin & Fitch 1964 (CP violation ⇒
T violation *because* CPT holds — asymmetry in one factor is paid for in another,
never in the composite).

### Addendum 3.1: Aaron's refined dictionary

Aaron, verbatim: **"conjugation ≈ uncertainty · parity ≈ adinkra mod 2 · tick =
tick/DST."** This sharpens the factor map:

- **C — conjugation ≈ uncertainty.** Conjugate pairs are where uncertainty lives
  (Heisenberg's conjugate variables; Fourier duality). In Zeta the conjugate of an
  assertion is its retraction: the pair brackets an uncertainty, and a `measure`/fix
  collapses the pair and banks ΔU to `db/uncertainty/` (every-bug-has-economic-value).
  Charge conjugation is the uncertainty flip — swap every claim with its conjugate.
- **P — parity ≈ adinkra mod 2.** Parity is not a spatial mirror; it is THE Z/2
  grading the adinkra already carries: the boson/fermion popcount checkerboard,
  Gates' odd-dash faces, and the braid's sign character (the B3 → Z/2 exponent-sum
  homomorphism on the adinkra↔braid edge row). The mod-2 register IS the parity
  quantum number.
- **T — tick/DST.** As stated: tick reversal, granted by deterministic replay.

The composite conjecture is unchanged but reads better in the refined vocabulary:
reverse the ticks, flip every claim to its uncertainty-conjugate, flip the mod-2
grade — every cartridge law still holds. Each factor alone may fail (the arrow, the
record); the composite may not.

Captured at Aaron's request (the conversational rendering, kept): a retraction (−1)
is the Feynman–Stückelberg antiparticle of its insertion — the same event traveling
backward in replay; the dv2 rule's "retraction is correction, not duplicate-guard"
is CPT's explanation — it is the conjugate event, not a repeat. And among CPT's
provers is the same Bell whose inequalities the coincidence generator stages: *the
house's ancestors remember each other too.*

## Addendum 4 (2026-07-02): identity = uncorrelated exchange; the Bell harness IS the Sybil detector — VERIFIED

Aaron's definition, verbatim: identity "comes down to **irreducible pairs of
uncorrelated value exchange over time by two provably distinct entities**," with
anti-forgery as "the TLA+/Lamport 'reasons'/correlations for identity." Beacon-level
verification of the claimed instrument identity, checked against the code:

**1. The Sybil detector and the Bell correlator are the same function (code-checked).**
For binary outcomes the CHSH correlator is `E = P(agree) − P(disagree) = 2·frac − 1`.
`AntiSybil.correlation` (src/Core/AntiSybil.fs) computes `abs (2.0 * frac − 1.0)` —
**|E| exactly**, with the absolute value deliberately catching inverted replays (an
anti-correlated clone is still one source). `AntiSybil.antiSybil` is then union-find
over pairwise |E| ≥ threshold: a one-setting Bell experiment run as an identity
oracle. Machine-locked by the bridge property in `tests/Tests.FSharp/AntiSybil.Tests.fs`
(`the Sybil correlator IS the Bell correlator`).

**2. The CHSH escalation is what defeats the strategic forger.** AntiSybil's own
honest-scope note names the gap: exact reuse is always caught, but a *noisy/strategic*
forger can suppress a single-setting correlation. Randomized-settings CHSH
(BellTest.fs: `ClassicalBound = 2.0`) closes it: two systems with **no live channel
and no shared seed** cannot exceed S = 2 (Bell 1964; CHSH 1969) — so **S > 2 convicts
a common cause** (shared seed or live communication), whatever strategy the forger
runs on individual settings. Direction of inference is one-way and must stay stated:
**high S convicts sameness; low S never acquits** (firewalled puppets can decorrelate).
Distinctness is proven by the definition's other legs — irreducible captured entropy
(ISA boundary #1 / G3) and the exchange history that model-checks (Lamport 1978:
you cannot forge a causal history you did not participate in).

**3. "The factory is provably one entity" — true within stated bounds.** BellTest.fs
documents that `AlgebraicMax = 4.0` is reachable **only by violating
measurement-independence — superdeterminism** (full seed control; the S = 4 box is
Popescu–Rohrlich 1994), and the factory's audition stack stages exactly that
(ZetaIdol: coincidence staged on the common seed, "full-seed S=4 PR-box"). By the
uncorrelated-exchange definition, agents phase-locked to one seed are one source —
one entity. **Honest bound (the falsifier already carved in ZetaIdol.fs):** S = 4 is
toy/instant-bus; it drops under bus delay and is untested over Reticulum — so
"provably one" holds in the DST sim today and is a conjecture over real transport.

**4. Signable statements (Soraya routing):**

- *Soundness:* streams from `s` independent seeds yield `DistinctCount ≤ s` — already
  stated as THE GUARANTEE in AntiSybil.fs, deterministic (DST §7), tested.
- *CHSH-Sybil soundness (conjecture):* under randomized settings and no live channel,
  `s ≥ 2` independent seeds ⇒ S ≤ 2 + o(1) w.h.p. as run length grows.
- *Seed-sharing completeness:* full shared-seed staging achieves S = 4 exactly
  (BellTest harness, replayable).

Anchors: Bell 1964; Clauser–Horne–Shimony–Holt 1969; Tsirelson 1980 (2√2);
Popescu & Rohrlich 1994 (S = 4 box); Douceur 2002 (the Sybil attack); Lamport 1978
(happened-before as unforgeable correlation structure); in-repo: AntiSybil.fs
(guarantee + honest scope), BellTest.fs (three bounds), ZetaIdol.fs (the falsifier),
ISA spec boundary #1 (irreducible captured entropy = identity).

## Anchors (Beacon)

- Futamura 1971, *Partial Evaluation of Computation Process — An Approach to a
  Compiler-Compiler*; Ershov 1977 (mixed computation, origin of `mix`);
  Jones, Gomard & Sestoft 1993, *Partial Evaluation and Automatic Program Generation*
  (cogen = mix(mix, mix)).
- Kleene fixed-point theorem; Knaster–Tarski; **Perron–Frobenius** (dominant
  eigenvector of a non-negative matrix — why remembrance converges).
- Brin & Page 1998 (PageRank); Garfield 1955 (citation indexing); Zimmermann's PGP
  web of trust.
- Lewis 1969, *Convention*; Aumann 1976 (common knowledge); Schelling 1960 (focal
  points).
- In-repo lineage: `only-the-irreducible-is-primitive-generate-the-rest.md`
  (gen(gen)==gen); `docs/research/2026-06-14-…futamura.md` §5;
  `docs/research/2026-06-13-ferry-37-why-equals-zetaid-…common-seed.md`;
  `vocab/ZetaIdol.fs`; `.claude/rules/honor-those-that-came-before.md`.
