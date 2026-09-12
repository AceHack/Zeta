namespace Zeta.Core

/// **DualScore — a belief is TWO independent chances in `[0,1]`, never one normalised weight.**
///
/// The F# sibling of `src/Core.TypeScript/belief/dual-score.ts`. Vocabulary is deliberately the
/// same (`mass` / `ignorance` / `contradiction` / `massShape` / `swapLegs` / `toyJoin` /
/// `toyClassify` / `vacuous`); the three places it diverges are named at the bottom of this
/// header, with reasons, because an unstated divergence between two oracles is a treaty broken
/// by accident.
///
/// ## The observation this exists to serve
///
/// Aaron 2026-09-11, quoted because the wording IS the specification:
///
///   *"refutations should also have a numerical score not just true false … we should also track
///   TRUE CHANCE AND FALSE CHANCE SEPRATLY, there is a lot of good data there WHEN THEY DON'T
///   ADD UP TO 1, THAT IS SIGNAL ITSELF … we should let them FLOAT INDEPENDLY of each other."*
///
/// …and, commissioning this file specifically:
///
///   *"yes lets try to make SoftValue also respect these rules. you are correct it does not
///   today, but this is the **better Eve protocol** that preserves four corners — not a single
///   belief weight but a dual false/true."*
///
/// ## What was measured first, because the whole design rests on it
///
/// `SoftValue`'s stated invariant is *"non-empty, all weights > 0, weights sum to 1"*. That pins
/// the residual `r = 1 − Σwᵢ` at **0 for every value any normalising constructor can produce**, so
/// the knowledge order has no extent and two of Belnap's four corners — `Neither` (nobody has
/// looked) and `Both` (two sources landed and disagree) — are unreachable.
/// **It is the INVARIANT, not the representation:** `SoftValue.unnormalized` builds the same
/// `WeightedSet` carrier with normalisation skipped, and that carrier holds a glut fine. Both
/// halves of that claim are pinned as falsifiers in `DualScore.Tests.fs` §THE FINDING — they are
/// *tests*, not a summary of somebody's reading.
///
/// **"0" there is the exact-arithmetic claim, and measuring it turned up a third fact worth
/// having.** In `float` the normalisation does not land on the slice: the 7/2/1 distribution sums
/// to `1.000000000000000222` and a `combine` posterior to `0.99999999999999988898`, so `r` is
/// `±1 ULP` rather than `0` and its SIGN is noise. That is why `massShapeWithin` exists and takes
/// its tolerance as a value — see §FLOAT in the tests.
///
/// ## Why a SIBLING type rather than a change to `SoftValue`
///
/// `SoftValue` is a distribution on the **value** axis — which of these `DynamicValue`s is it.
/// The belief pair is on the **truth** axis — does this proposition hold. The research note that
/// commissioned this (`docs/research/2026-09-11-the-belief-pair-as-a-weight-for-the-universal-tensor-bilattice-boole-slack-and-the-typed-regulariser-lumen.md`,
/// §9) reaches the same conclusion from the other direction: *"The belief pair is a refinement of
/// the truth axis — a continuous `UNKNOWN` with a sign — and it composes with `SoftValue` rather
/// than replacing it."*
///
/// So nothing in `SoftValue.fs` changed and no existing caller moved. The two axes are joined by
/// `SoftValueBelief` (`src/Core/SoftValueBelief.fs`), which (a) gives `SoftValue` itself a
/// first-class signed residual — the N-candidate generalisation of the same Boole slack — and
/// (b) projects a `SoftValue` onto a `DualScore` **through a caller-declared predicate**, which
/// is §9's scope note made mechanical: a numeric claim is not a proposition until a predicate is
/// fixed, so the predicate is passed as a value, exactly as `SnapPolicy` already is.
///
/// ## The identification, with the invariants that earn it
///
/// `[0,1] × [0,1]` under the two orders `≤_t` (t↑, f↓) and `≤_k` (t↑, f↑) is the **interlaced
/// bilattice `[0,1] ⊙ [0,1]`** (Ginsberg 1988; Fitting 1991; Avron 1996 — whose representation
/// theorem says every bounded interlaced bilattice IS such a product). Belnap's FOUR (1977) sits
/// at its four extreme points. Per `.claude/rules/numerology-vs-number-theory.md` a count of four
/// identifies nothing on its own, so the invariants that exclude the competitors:
///
///   • **two** lattice orders on one carrier — excludes any single-order structure;
///   • **interlacing** — each order's join/meet is monotone w.r.t. the other;
///   • **negation** `¬(t,f) = (f,t)` is `≤_t`-antitone, `≤_k`-**monotone**, and an involution
///     (order 2) — this is what excludes `C₄`/`ℤ/4`, which has an order-4 generator.
///
/// > **Standing guard, because this repo has a live four-element object.** `src/Core/FourCornerC4.fs`
/// > carries a `C₄` compass `{1, i, −1, −i}`. **FOUR is not `C₄`** and this type must not be
/// > identified with that compass: `C₄` is cyclic with an order-4 element; the negation here is an
/// > involution. `DualScore.Tests.fs` §NUMEROLOGY GUARD pins that non-isomorphism rather than
/// > asserting it.
///
/// ## The residual is a PRICED quantity, which is why it is signed here
///
/// `r = 1 − t − f` is the slack in Boole's *conditions of possible experience* (Boole 1854;
/// Pitowsky 1989 for the quantum form). A classical assignment with `P(A)=t`, `P(¬A)=f` exists
/// **iff `r = 0`**. So:
///
///   • `r > 0` — the constraint is **slack**: a polytope of joints fits. Imprecision, whose width
///     is a bid–ask spread (Smith 1961; Walley 1991).
///   • `r < 0` — the constraint is **violated**: by de Finetti (1937) this is incoherence, a
///     Dutch book exists, and **`−r` is the guaranteed loss per unit stake**.
///   • `r = 0` — classical.
///
/// Of the established theories only Belnap/bilattice covers both signs: Dempster–Shafer
/// (`bel(A)+bel(¬A) ≤ 1` is a theorem), Jøsang subjective logic (`b+d+u = 1` imposed), Walley, and
/// possibility theory each forbid `r < 0` by construction. That is why the pair is worth building
/// rather than replaced by Jøsang's triple.
///
/// ## >> THERE IS NO COMBINATION RULE HERE, AND THAT IS A REFUSAL, NOT AN OMISSION
///
/// No `and`, no `or`, no `combine`, no `normalise`, and **no `ISemiring`/`IRing` instance**. Three
/// separate reasons, each of which is on its own sufficient:
///
///   1. **The obvious algebra is refuted.** Under the independence-motivated operations the pair
///      is not a semiring — distributivity fails (witness: `a = ½, b = c = 1` for probabilistic
///      sum). `ISemiring` would be a lie, and `IRing` a louder one: there is no additive inverse,
///      so there is no retraction.
///   2. **One slot, two orders.** `ISemiring<'W>` has a single `(Add, Mul)` pair; a bilattice has
///      four operations (`∧,∨` for `≤_t`; `⊗,⊕` for `≤_k`). Instantiating it would silently pick
///      one order and discard the other — and the discarded one is exactly the axis carrying the
///      signal. The choice would not even be recorded in the type.
///   3. **Picking a fusion rule today would be guessing.** Dempster's rule is pathological under
///      high conflict: Zadeh's counterexample (1979/1986) has two experts each put 0.99 on a
///      different diagnosis and 0.01 on a third, and the rule returns the third with probability
///      **1** — the option both thought nearly impossible. Its mechanism is precisely *the
///      residual was divided away* by the `1 − K` normalisation. A single merge operator also
///      cannot be both accumulating and idempotent, which is already proven in-repo
///      (`BeliefConvergence.fs`) and is not re-proven here.
///
/// In-repo precedent for stating the rung down rather than up: `IntervalRing` in
/// `src/Core/Semiring.fs` is **DEMOTED** to `ISemiring` with a substrate-honest exception on file
/// (`081KWGA0C7`) and carries no `Negate`. This type goes one rung further and claims **no**
/// algebra at all. The live counter-example to avoid is the open work item
/// `081M29N1AX9087G0R001GSJD6G` — an `IRing<Sedenion>` asserting a contract 168/343 octonion
/// triples refute. A rung asserted and not held is the vacuity class with a type signature.
///
/// ## "The better Eve protocol" — what the reference is, and what it buys here
///
/// The Eve protocol is the repo's **consent-first fusion–negotiation cycle**:
/// `GSet →(banana-split)→ ZSet (±1, retraction-native proposal space) →(fuse)→ GSet`
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`; work item `081KRW63S0008QG0R0030F8ZXA`,
/// "neutral polymorphic diplomatic language"). Its defining property is **non-coercion**: a
/// difference is *proposed* into the diff space and *consented* back, never imposed, and
/// *"positions translate AS-IS, not laundered through diplomatic euphemism."*
///
/// A single normalised belief weight cannot carry that, because normalisation IS the laundering:
/// two witnesses at `{1,0}` and `{0,1}` average to `0.5`, which reads identically to *"nobody has
/// looked"* — the one state they are furthest from. The dual pair keeps them at `{1,1}`,
/// contradiction 1, and hands the disagreement onward intact. That is the raw-vault sentence
/// (`a single version of the FACTS, never a single version of the TRUTH`) arriving as an
/// order-theoretic fact: **the knowledge order is the raw vault; the truth order is the mart.**
/// `toyJoin` below is the `≤_k` join and is therefore the non-coercive one; the `≤_t` join
/// `(max t, min f)` is the deciding one and is deliberately **not shipped**, because deciding is
/// the boundary's job and the boundary is a caller-supplied value.
///
/// **Register: the Eve mapping and the raw-vault reading are Mirror-register READINGS.** The
/// bilattice identification, the Boole/de Finetti reading of `r`, and `FOUR ≇ C₄` are structural
/// and checkable. Nothing here is calibrated: no study in this repo measures what a `trueChance`
/// of 0.7 predicts about the world, so every JUDGING function is named `toy*` and ships no
/// default margin (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
///
/// ## Declared divergences from `dual-score.ts` — and what the TREATY did to them
///
/// A cross-language treaty is where a declared divergence gets **paid off** rather than
/// re-documented. `src/Core.TypeScript/belief/dual-score-treaty-transcript.json` is that treaty:
/// generated from the TypeScript side, replayed by `tests/Tests.FSharp/DualScoreTreaty.Tests.fs`,
/// with every double travelling as its exact IEEE-754 bit pattern in hex.
///
///   1. **`dualScore(t, f)` → `DualScore.create t f`.** STILL A DIVERGENCE, and a permanent one:
///      the module already carries the name under `RequireQualifiedAccess`, so
///      `DualScore.dualScore` would stutter. Same function, same argument order, same refusals —
///      a SPELLING, and the treaty pins VALUES rather than spellings.
///   2. **`residual`, SIGNED — CLOSED.** `dual-score.ts` exports `residual` now. The two sides
///      still derive the excess independently (`max 0 (-(1 - mass))` here, `mass - 1` there) and
///      the `Facts` vectors check the two derivations against each other BY BITS. That check
///      immediately found its own exception: at `r = 0` the intermediates are `-0.0` and `+0.0`,
///      which do not escape only because both clamps emit a positive literal zero.
///   3. **The four corners NAMED — CLOSED.** `ONLY_TRUE`, `ONLY_FALSE`, `BOTH` and the `CORNERS`
///      roster are exported there now, in the same `≤_k` order, pinned positionally.
///   4. **`massShapeWithin` — CLOSED, and closing it found a live defect ON THIS SIDE.** The
///      tolerance fold was `max 0.0 tolerance`, and F#'s `max` propagates `nan`, so a `nan`
///      tolerance made **every** score read `Coherent`. See the note on that function.
///
/// `equals` is not ported: F# structural equality on the record is that function, and shipping a
/// duplicate would be noise. `parseDualScore` is ported as `ofDynamicValue`, over the repo's own
/// dynamic carrier rather than `unknown` — so the treaty encodes parser inputs STRUCTURALLY and
/// each runtime builds its own carrier from that encoding.
///
/// ## Beacon anchors
///
/// Belnap, *A Useful Four-Valued Logic* (1977) · Dunn (1976) · Ginsberg (1988), Fitting (1991),
/// Avron (1996) — bilattices and the representation theorem · Boole, *The Laws of Thought* (1854)
/// — conditions of possible experience · de Finetti (1937) — coherence and the Dutch book ·
/// Smith (1961), Walley (1991) — lower/upper previsions, the bid–ask reading · Dempster (1967),
/// Shafer (1976) — belief/plausibility · Zadeh (1979/1986) — the conflict counterexample ·
/// Jøsang (2001, 2016) — subjective logic · Smets & Kennes (1994) — the Transferable Belief
/// Model's credal/pignistic split, which is `WSet.fs`'s *nonlinear step at the outer boundary
/// only* arrived at independently twenty years earlier.
[<RequireQualifiedAccess>]
module DualScore =

    /// The unit interval's ends, named so refusals and tests quote one source.
    [<Literal>]
    let UNIT_MIN = 0.0

    [<Literal>]
    let UNIT_MAX = 1.0

    /// Which quantity a refusal is about. Both legs are checked, so a caller learns about both.
    type Leg =
        | TrueChance
        | FalseChance
        /// Not a leg — the caller-supplied threshold in `toyClassify`, which is also a `[0,1]`
        /// quantity and is refused by the same rule rather than by a second one.
        | Margin

    /// Why a value was refused. **Data, never thrown** — same discipline as
    /// `SoftValue.ExactError`.
    type Refusal =
        /// `NaN` or an infinity. Refused rather than coerced: a coerced leg reads downstream as a
        /// measurement somebody took.
        | NotFinite of leg: Leg * value: float
        /// Finite but outside `[0,1]`. **REFUSED, NOT CLAMPED** — a clamp turns a caller's
        /// arithmetic bug into a plausible belief and leaves nothing to find later. Note the SUM
        /// of the two legs is deliberately unconstrained; a sum above 1 is contradiction, which
        /// is legal and is the signal.
        | OutsideUnitInterval of leg: Leg * value: float
        /// The input was not shaped like a pair of legs at all (`ofDynamicValue`).
        | NotADualScore of detail: string

    /// **Two independent chances, each in `[0,1]`.** They are NOT complementary: `FalseChance` is
    /// never `1 − TrueChance`, and no function in this module derives either from the other.
    ///
    /// The representation is private so the `[0,1]` bound cannot be bypassed by building the
    /// record directly — the constructors are the only door and every one of them refuses.
    ///
    /// **`NoComparison` is deliberate.** The carrier has *two* partial orders (§4 above) and
    /// neither is total; F#'s structural `compare` would silently impose a lexicographic third
    /// order that means nothing here. Equality is structural and is kept — two beliefs are the
    /// same iff both legs are.
    [<NoComparison>]
    type DualScore =
        private
            { T: float
              F: float }

        /// Chance the proposition holds, from whatever evidence landed FOR it.
        member this.TrueChance: float = this.T
        /// Chance the proposition fails, from whatever evidence landed AGAINST it. Independent.
        member this.FalseChance: float = this.F

    let private refuseUnit (leg: Leg) (value: float) : Refusal option =
        if System.Double.IsNaN value || System.Double.IsInfinity value then Some(NotFinite(leg, value))
        elif value < UNIT_MIN || value > UNIT_MAX then Some(OutsideUnitInterval(leg, value))
        else None

    /// **The only constructor.** Refuses non-finite and out-of-range legs; NEVER clamps, NEVER
    /// derives one leg from the other, and NEVER constrains the SUM — `{1,1}` (maximal
    /// contradiction) and `{0,0}` (maximal ignorance) are both legal and building them must
    /// succeed.
    ///
    /// Both legs are checked and `TrueChance` is reported first when both are bad; that ordering
    /// is pinned by a test so the refusal is a stable contract rather than an accident of
    /// evaluation order.
    let create (trueChance: float) (falseChance: float) : Result<DualScore, Refusal> =
        match refuseUnit TrueChance trueChance with
        | Some r -> Error r
        | None ->
            match refuseUnit FalseChance falseChance with
            | Some r -> Error r
            | None -> Ok { T = trueChance; F = falseChance }

    // ── The four corners, named ──────────────────────────────────────────────
    // Belnap's FOUR as the extreme points of [0,1]². All four are REACHABLE, which is the whole
    // claim of this type; naming them is what makes "reachable" testable. They are built by
    // hand rather than through `create` only because `create` returns a `Result` and a corner
    // that could fail to exist would be a strange thing to ship; the tests check each one
    // round-trips through `create` to exactly the same value.

    /// **Belnap `None`** — nothing has been observed either way. Maximal ignorance, `r = 1`.
    ///
    /// This is the value a single probability cannot express: under one `p`, *"I have no
    /// evidence"* collapses onto `0.5`, i.e. onto *"I have perfectly balanced evidence"*, and
    /// those are opposite epistemic states.
    let vacuous: DualScore = { T = UNIT_MIN; F = UNIT_MIN }

    /// **Belnap `True`** — full support, no refutation. `r = 0` (classical).
    let onlyTrue: DualScore = { T = UNIT_MAX; F = UNIT_MIN }

    /// **Belnap `False`** — full refutation, no support. `r = 0` (classical).
    let onlyFalse: DualScore = { T = UNIT_MIN; F = UNIT_MAX }

    /// **Belnap `Both`** — the glut. Two sources both landed, pointing opposite ways. `r = −1`,
    /// the maximal Dutch book. Reported, never resolved.
    let both: DualScore = { T = UNIT_MAX; F = UNIT_MAX }

    /// The four corners in `≤_k` order (least informative first, then the two classical points,
    /// then the glut). A roster, so a test can quantify over the corners instead of listing them.
    let corners: DualScore list = [ vacuous; onlyTrue; onlyFalse; both ]

    // ── The facts: pure arithmetic, no thresholds, honest at any register ────

    /// Total mass on the two legs, in `[0,2]`. `1` is the classical slice, not the norm.
    let mass (s: DualScore) : float = s.TrueChance + s.FalseChance

    /// **The residual `r = 1 − t − f`, SIGNED.** The first-class quantity of this module.
    ///
    /// `r > 0` ignorance (Boole slack — a polytope of joints fits) · `r < 0` contradiction
    /// (de Finetti incoherence — a Dutch book exists and `−r` is the loss per unit stake) ·
    /// `r = 0` classical. See the header for the anchors.
    let residual (s: DualScore) : float = 1.0 - mass s

    /// The non-negative half of the residual: `max 0 r`. Dempster–Shafer's `m(Θ)`, Jøsang's `u`,
    /// and the dual-Bloom UNKNOWN region are all this quantity. TypeScript parity.
    let ignorance (s: DualScore) : float = max 0.0 (residual s)

    /// The non-negative half of the *negated* residual: `max 0 (−r)`. Belnap's glut. TypeScript
    /// parity.
    ///
    /// Reported, never resolved. Picking a winner here would destroy the disagreement, which is
    /// the information (`dv2-data-split-discipline-activated.md`, raw vault), and it is exactly
    /// the regime where Dempster's rule misbehaves.
    let contradiction (s: DualScore) : float = max 0.0 (-(residual s))

    /// The three-valued readout. **Structural** — it depends only on the residual, so it carries
    /// no calibration. Two readers below: an exact one, and one that takes the tolerance as a
    /// value because float-summed legs do not land on zero.
    type MassShape =
        | Ignorant
        | Coherent
        | Contradictory

    /// The **exact** shape: the sign of the residual, no tolerance. TypeScript parity
    /// (`massShape` in `dual-score.ts` compares `mass` against 1 exactly), and the right reading
    /// for legs a caller stated directly.
    ///
    /// WARNING -- **it is the WRONG reading for legs that came out of float arithmetic, and that
    /// was measured rather than guessed.** Projecting a *normalised* `SoftValue` through
    /// `SoftValueBelief.beliefOf` does not land on `Coherent`: the 7/2/1 distribution sums to
    /// `1.000000000000000222` (`r = -2.22e-16`, reading **Contradictory**) and a `combine`
    /// posterior to `0.99999999999999988898` (`r = +1.11e-16`, reading **Ignorant**). Those signs
    /// are one ULP of float noise and carry no evidence whatever. Use `massShapeWithin` with a
    /// tolerance you own for any leg that was summed. Falsifiers: `DualScore.Tests.fs` section
    /// FLOAT.
    let massShape (s: DualScore) : MassShape =
        let r = residual s
        if r > 0.0 then Ignorant
        elif r < 0.0 then Contradictory
        else Coherent

    /// The shape with a **caller-supplied** tolerance: a residual within `+/-tolerance` of zero
    /// reads as `Coherent`. Added because of the measurement quoted on `massShape` above.
    ///
    /// `dual-score.ts` ships the same function under the same name, and the two are pinned against
    /// each other by `dual-score-treaty-transcript.json` — see the NaN paragraph below, which is
    /// there because the treaty found a live divergence, not because anyone anticipated one.
    ///
    /// **There is no default tolerance and there will not be one.** The honest value depends on
    /// how the legs were produced -- a directly-stated pair wants `0`, a sum of `n` floats wants
    /// something near `n` ULP, a calibrated evidence lane wants whatever its calibration says.
    /// Inventing one here would be an unearned constant asserted as a measurement
    /// (`.claude/rules/toy-is-free-metered-must-be-earned.md`). A negative tolerance is folded to
    /// zero rather than refused: it is a degenerate input to a total arithmetic function, not a
    /// belief that could mislead anyone downstream.
    ///
    /// > **The fold is `if tolerance > 0.0 then tolerance else 0.0`, NOT `max 0.0 tolerance`, and
    /// > the difference is a defect this treaty caught.** F#'s `max` **propagates `nan`**
    /// > (measured: `max 0.0 nan = NaN` and `max nan 0.0 = NaN`) — and under a `nan` tolerance
    /// > every comparison below is false, so **every score would read `Coherent`**. That is the
    /// > vacuity class inside a reading function: a caller who passed `nan` by accident would be
    /// > told, silently and for every belief, that nothing is contradictory and nothing is
    /// > ignorant — the one answer that erases the whole signal this type exists to carry.
    /// > `if tolerance > 0.0` sends `nan` to `0.0` (`nan > 0.0` is false), failing closed onto the
    /// > exact reading. TypeScript's `tolerance > 0 ? tolerance : 0` was already correct for the
    /// > same reason (`Math.max(0, NaN)` is `NaN` there too); the two sides genuinely disagreed
    /// > until the `nan-tolerance-folds-to-zero` vector made them agree.
    let massShapeWithin (tolerance: float) (s: DualScore) : MassShape =
        let tol = if tolerance > 0.0 then tolerance else 0.0
        let r = residual s
        if r > tol then Ignorant
        elif r < -tol then Contradictory
        else Coherent

    /// Negation — the belief about the negated proposition. `¬(t,f) = (f,t)`.
    ///
    /// An **involution** (`swapLegs (swapLegs s) = s`), `≤_t`-antitone and `≤_k`-monotone. `mass`,
    /// `residual`, `ignorance`, `contradiction` and `massShape` are all invariant under it, which
    /// is the check that the two legs really are symmetric in the type — and the order-2 property
    /// is what separates FOUR from `C₄`.
    ///
    /// This is a **relabelling of one score, not a combination of two**, so it is safe to ship
    /// while the algebra is under review: it introduces no rule for fusing evidence.
    let swapLegs (s: DualScore) : DualScore = { T = s.FalseChance; F = s.TrueChance }

    // ── The one combining operation, and it is `toy` in its name ─────────────

    /// **`toy` — componentwise max: the knowledge-order (`≤_k`) join.**
    ///
    /// It is the weakest thing that is definitely not a probabilistic fusion: the grow-only G-set
    /// join, therefore idempotent, commutative and associative, therefore safe under replay and
    /// reorder (DV2.0 #4 DST, #6 idempotency). It **surfaces** conflict instead of resolving it —
    /// `toyJoin onlyTrue onlyFalse = both`, contradiction 1 — which is precisely what Dempster's
    /// rule gets wrong under Zadeh's counterexample, and precisely the non-coercion the Eve
    /// protocol requires.
    ///
    /// What it is NOT, and must not be read as: a belief-combination rule, a consensus operator,
    /// or an answer to the open algebra question. It does not model independent evidence
    /// accumulating — two weak witnesses stay weak under max, where any real fusion rule would
    /// strengthen them. **When the math team rules on the algebra, THIS is the function that gets
    /// replaced**, and the `toy` prefix is what makes that search cheap.
    let toyJoin (a: DualScore) (b: DualScore) : DualScore =
        { T = max a.TrueChance b.TrueChance
          F = max a.FalseChance b.FalseChance }

    /// A reading of a belief. Produced only by `toyClassify`.
    type ToyReading =
        | LeansTrue
        | LeansFalse
        | Unknown
        | Contradicted

    /// **`toy` — the one JUDGING function, and it ships NO DEFAULT MARGIN.**
    ///
    /// A reading needs a margin; a margin is a calibrated threshold; nothing in this repo has
    /// calibrated one for this primitive. A default of `0.5` here would be a `toy` number
    /// asserted as `metered` inside the file that argues against exactly that. The caller passes
    /// the margin and owns the judgement — the same boundary-as-a-value discipline as
    /// `SoftValue.SnapPolicy`.
    ///
    /// Contradiction is checked FIRST: a glut is not a weak `LeansTrue`, and a classifier that
    /// reported it as one would re-introduce the collapse this type exists to prevent.
    let toyClassify (s: DualScore) (margin: float) : Result<ToyReading, Refusal> =
        match refuseUnit Margin margin with
        | Some r -> Error r
        | None ->
            if contradiction s > 0.0 then Ok Contradicted
            elif s.TrueChance >= margin && s.FalseChance < margin then Ok LeansTrue
            elif s.FalseChance >= margin && s.TrueChance < margin then Ok LeansFalse
            else Ok Unknown

    // ── Parsing untrusted input ──────────────────────────────────────────────

    /// Ordinal key for the support leg on the wire. Named so the parser and its tests quote one
    /// source, and so the four oracles spell it identically.
    [<Literal>]
    let TRUE_CHANCE_KEY = "trueChance"

    [<Literal>]
    let FALSE_CHANCE_KEY = "falseChance"

    /// Parse an untrusted `DynamicValue` (a stored row, a peer's message) into a `DualScore`,
    /// refusing anything that is not two in-range legs. The port of TypeScript's
    /// `parseDualScore`, over the repo's own dynamic carrier.
    ///
    /// **A missing leg is a refusal, never defaulted to 0.** `0` is a real and meaningful value
    /// here — *"evidence landed and found nothing"* — and defaulting would make it
    /// indistinguishable from *"no field was sent"*. `Int` is accepted alongside `Float` so that
    /// an encoder which emitted `1` rather than `1.0` is read, not rejected; every other shape is
    /// refused. Key lookup is ordinal (`System.String.Equals(_, _, StringComparison.Ordinal)`).
    let ofDynamicValue (dv: DynamicValue) : Result<DualScore, Refusal> =
        let leg (fields: (string * DynamicValue) list) (key: string) : Result<float, Refusal> =
            let found =
                fields
                |> List.tryPick (fun (k, v) ->
                    if System.String.Equals(k, key, System.StringComparison.Ordinal) then Some v else None)

            match found with
            | Some(DynamicValue.Float f) -> Ok f
            | Some(DynamicValue.Int i) -> Ok(float i)
            | Some _ -> Error(NotADualScore($"'{key}' must be a number"))
            | None -> Error(NotADualScore($"'{key}' is absent; a missing leg is refused, never defaulted to 0"))

        match dv with
        | DynamicValue.Object fields ->
            match leg fields TRUE_CHANCE_KEY with
            | Error e -> Error e
            | Ok t ->
                match leg fields FALSE_CHANCE_KEY with
                | Error e -> Error e
                | Ok f -> create t f
        | _ -> Error(NotADualScore "expected an Object carrying both legs")

    /// The inverse of `ofDynamicValue` for the values it accepts: both legs as `Float`, in the
    /// ordinal key order the parser reads. Round-trip is pinned by a test.
    let toDynamicValue (s: DualScore) : DynamicValue =
        DynamicValue.Object
            [ FALSE_CHANCE_KEY, DynamicValue.Float s.FalseChance
              TRUE_CHANCE_KEY, DynamicValue.Float s.TrueChance ]
