namespace Zeta.Bayesian

/// A bound and the reason it is believed, as a type rather than as a comment.
///
/// **Why this exists.** `OrbitalAsymmetryBudget.deltaMaxMs` carried a `* 1.2`
/// documented as a "20% conservative margin". It survived months of review, an
/// independent external check (PR #10387) and a formal-methods pass (PR #10418)
/// before being refuted: the underlying endpoint-speed envelope is *sharp*
/// (equality attained, exact rational witness in
/// `tools/Z3Verify/light-time-endpoint-speed-envelope.smt2` and
/// `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean`), so no `k > 1` is justified
/// and no `k < 1` is safe. It survived because *"is this constant justified?"*
/// is a question a reviewer has to think to ask.
///
/// **What this module changes.** Two things, and only two:
///
/// 1. A contribution to a bound cannot be made without a `Justification`. Guesses
///    stay legal — `Assumption "fudge factor"` compiles — they just stop being
///    silent. Same move as the Lean orphan allow-list: exclusion stays possible,
///    invisibility does not.
/// 2. **A bound is a sum of terms and nothing else. There is no multiply.** That
///    is deliberate and it encodes the finding rather than merely recording it:
///    the residuals a margin was supposed to cover (curvature, V-sup over the
///    interval, ephemeris error, Shapiro) are *additive* and do not scale with
///    the quantity `1.2` multiplied. A multiplicative margin also vanishes exactly
///    where the additive residuals do not. So the wrong shape is unrepresentable,
///    and widening a bound costs you a named magnitude and a reason.
///
/// **What it does NOT claim.** Leaf magnitudes are still `float`, so
/// `{ Value = x * 1.2; Why = Assumption "..." }` remains writable. The guarantee
/// is *no unnamed, unjustified contribution to a total* — not *no wrong
/// arithmetic*. Stating that plainly matters here, because overclaiming a check
/// is the defect class this module exists to answer.
///
/// **Scope, deliberately narrow.** This applies where a constant is a claim about
/// a bound whose being-too-small produces a *false verdict* — `BusRegime` convicts
/// `OutOfCone` when `best > deadline + δ_max`, so an under-stated δ_max is an
/// unsound conviction. It does **not** apply to policy knobs (retry timeouts,
/// batch sizes, backoff): those have no truth value, `Assumption` would be the
/// answer every time, and a discriminator that returns one case for 95% of its
/// inputs discriminates nothing.
///
/// **Internal on purpose.** No consumer outside this assembly constructs or reads
/// a justification today, and `internal → public` is a widening available any day
/// while `public → internal` is a break. See
/// `docs/DECISIONS/2026-08-13-bound-justification-is-an-authoring-type-not-a-public-contract.md`.
module internal BoundJustification =

    /// Why a magnitude is believed. Three registers, and the third is the point:
    /// a guess must be expressible, or the type gets routed around instead of used.
    type Justification =
        /// Proved. `theorem` states what was proved; `certificate` is where the
        /// machine-checkable artifact lives (an `.smt2` file, a Lean module, both).
        /// The certificate is a path, not prose, so the claim is followable.
        | Derivation of theorem: string * certificate: string
        /// Empirically bounded. `over` names the sample or domain the measurement
        /// ranged over, because a measurement without its domain is an anecdote —
        /// and a scan over a stated window is *not* a proof of a supremum.
        | Measurement of quantity: string * over: string
        /// Explicitly a guess. Permitted, never silent. This is the case that keeps
        /// the type honest; deleting it would only push guesses back into literals.
        | Assumption of reason: string

    /// Whether a justification is backed by something another party could check.
    /// `Assumption` deliberately is not — that is what makes it worth naming.
    let isChecked (j: Justification) : bool =
        match j with
        | Derivation _
        | Measurement _ -> true
        | Assumption _ -> false

    /// One additive contribution to a bound. `Value` carries the bound's unit,
    /// which is named once by the bound's owner rather than repeated per term.
    type Term =
        { /// What this term accounts for. Appears in audit output; keep it specific.
          Name: string
          /// The magnitude, non-negative for a widening term.
          Value: float
          /// Why that magnitude is believed.
          Why: Justification }

    /// A bound is the sum of its named, justified terms. The union case is private,
    /// so a total can never be *authored* — only derived from terms that each carry
    /// a reason.
    type Bound = private OfTerms of Term list

    /// Operations on `Bound`. Note what is absent: there is no `scale`, no
    /// operator overload, and no way to adjust a total without adding a term.
    [<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
    [<RequireQualifiedAccess>]
    module Bound =

        /// The only constructor. An empty term list is a legitimate bound of zero —
        /// "nothing contributes" is a claim the caller may honestly make.
        let ofTerms (terms: Term list) : Bound = OfTerms terms

        /// The terms, in the order given.
        let terms (bound: Bound) : Term list =
            let (OfTerms ts) = bound
            ts

        /// The total. Derived by summation, never supplied.
        let value (bound: Bound) : float =
            terms bound |> List.sumBy (fun t -> t.Value)

        /// The terms nobody has checked. Empty is the good case; anything here is a
        /// magnitude the substrate is taking on faith, and it is now enumerable
        /// rather than buried in an expression.
        let assumed (bound: Bound) : Term list =
            terms bound |> List.filter (fun t -> not (isChecked t.Why))

        /// Whether every contributing magnitude is derived or measured.
        let isFullyChecked (bound: Bound) : bool = assumed bound |> List.isEmpty
