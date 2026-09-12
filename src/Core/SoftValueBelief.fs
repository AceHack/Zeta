namespace Zeta.Core

/// **SoftValueBelief — the four corners reached THROUGH `SoftValue`, without moving a caller.**
///
/// Additive module: nothing in `SoftValue.fs` changed, so every existing consumer of `SoftValue`
/// is byte-for-byte unaffected. Same pattern as `SoftValueInfo.fs`.
///
/// ## The finding this module is built on, and how to falsify it
///
/// `SoftValue`'s invariant is *"non-empty, all weights > 0, weights sum to 1"*. Every normalising
/// constructor (`certain`, `ofWeighted`, `map`, `bind`, `observe`, `combine`, `widen`,
/// `foldRetainedBounded`) routes through `build`, which divides by the total. So the residual
/// `r = 1 − Σwᵢ` is pinned at **0** for every reachable value — the knowledge order has no
/// extent, and Belnap's `Neither` and `Both` corners are unrepresentable. (In `float` that is `0`
/// to within one ULP, not bit-exactly; see `massShapeWithin` for the measurement and why it
/// changes the shape of the API.)
///
/// **The limitation is the INVARIANT, not the carrier.** `SoftValue.unnormalized` builds the same
/// `WeightedSet` with normalisation skipped, and it holds `r > 0` and `r < 0` fine. Both halves
/// are pinned in `DualScore.Tests.fs` §THE FINDING; delete `residual` and those tests go red.
///
/// ## The two axes, and the declared predicate that joins them
///
/// `SoftValue` lives on the **value** axis (*which `DynamicValue` is it*); `DualScore` lives on
/// the **truth** axis (*does this proposition hold*). They are joined by a predicate, and the
/// predicate is **passed as a value** because it cannot be recovered from the numbers:
///
/// > *A numeric claim must declare its predicate before it can carry a belief pair, and the
/// > choice of tolerance is a modelling decision the pair cannot recover. Two different
/// > tolerances over the same measurement give two different `(t,f)` pairs with no way to convert
/// > between them.*
/// > — `docs/research/2026-09-11-the-belief-pair-as-a-weight-for-the-universal-tensor-bilattice-boole-slack-and-the-typed-regulariser-lumen.md` §9
///
/// That is the same boundary-as-a-value shape `SoftValue.SnapPolicy` already ships, which is why
/// `Proposition` below is a type abbreviation rather than a new mechanism.
///
/// ## What `residual` generalises
///
/// For a two-candidate `SoftValue` over {holds, fails}, `residual` IS `DualScore.residual`. For N
/// candidates it is the same Boole slack over an N-ary partition: `r > 0` means a polytope of
/// joint distributions fits the observation (imprecision); `r < 0` means none does (de Finetti
/// incoherence, `−r` the Dutch-book loss per unit stake); `r = 0` is the classical case a
/// normalised distribution is confined to. So `SoftValue` does get a first-class signed residual
/// here — it is simply that every *normalised* value sits at `r = 0` (to float rounding), which is
/// correct for the cases that genuinely are distributions and is exactly the confinement this
/// module measures.
///
/// **No algebra is added.** There is no fusion rule for `SoftValue`s in the unnormalised regime
/// in this module, and there deliberately is not one: see the refusal in `DualScore.fs`.
[<RequireQualifiedAccess>]
module SoftValueBelief =

    /// A **declared proposition** over candidate values: the predicate that turns a distribution
    /// on the value axis into a belief on the truth axis. Deliberately the same shape as
    /// `SoftValue.SnapPolicy` — a boundary passed as a value, never inferred.
    type Proposition = DynamicValue -> bool

    /// Total mass a `SoftValue` carries, summed in **ordinal candidate order** (`Candidates` is a
    /// `Map` projection, so the order is a property of the value, not of how it was assembled —
    /// the same reproducibility argument `SoftValue.build` already makes).
    ///
    /// `1.0` for every normalised value. Anything else came through `SoftValue.unnormalized`.
    let totalMass (sv: SoftValue.SoftValue) : float =
        SoftValue.candidates sv |> List.sumBy snd

    /// **The signed residual `r = 1 − Σwᵢ`, first-class on the value axis.**
    ///
    /// `r > 0` ignorance · `r < 0` contradiction · `r = 0` classical. For every `SoftValue` any
    /// normalising constructor can produce this is `0` up to float rounding (measured: within one
    /// ULP, and the *sign* inside that band is noise — see `massShapeWithin`). That confinement is
    /// the finding, not an opinion; `DualScore.Tests.fs` quantifies it over the constructors.
    let residual (sv: SoftValue.SoftValue) : float = 1.0 - totalMass sv

    /// The three-valued readout of `residual`, with the tolerance **passed as a value**.
    ///
    /// There is no exact (tolerance-free) reader here, deliberately, and the reason is measured:
    /// a float-normalised `SoftValue` does not sit on the coherent slice. The 7/2/1 distribution
    /// totals `1.000000000000000222` and a `combine` posterior totals `0.99999999999999988898`,
    /// so an exact sign test calls the first **Contradictory** and the second **Ignorant** on
    /// `±1 ULP` of rounding. Shipping that reader would be shipping a trap, so the caller states
    /// the tolerance it is willing to own. (`DualScore.massShape` keeps the exact form for legs a
    /// caller stated directly, where it is the correct reading and is TypeScript parity.)
    let massShapeWithin (tolerance: float) (sv: SoftValue.SoftValue) : DualScore.MassShape =
        let tol = max 0.0 tolerance
        let r = residual sv
        if r > tol then DualScore.Ignorant
        elif r < -tol then DualScore.Contradictory
        else DualScore.Coherent

    /// **Project a `SoftValue` onto a `DualScore` through a DECLARED proposition.**
    ///
    /// `TrueChance` is the mass on candidates the proposition accepts; `FalseChance` is the mass
    /// on the rest. Negative candidate weights (reachable only through
    /// `SoftValue.unnormalized`) are summed as-is rather than dropped — dropping them would
    /// silently repair the caller's value, and the point of this function is to report what the
    /// carrier actually holds.
    ///
    /// **It refuses rather than clamps.** A leg outside `[0,1]` means the carrier held more than
    /// unit mass on one side of the proposition; that is a fact about the input and
    /// `DualScore.create`'s refusal carries it out intact. Note the *sum* is never constrained —
    /// a `{0.75, 0.75}` projection is a legal contradiction with `r = −0.5`, and building it must
    /// succeed.
    ///
    /// The falsifier that makes this load-bearing: for any normalised `sv` and any proposition,
    /// the result has `|residual| ≤ one ULP` — the finding, mechanised. Feed it an `unnormalized`
    /// value and all three shapes appear at magnitudes far above that floor.
    let beliefOf (proposition: Proposition) (sv: SoftValue.SoftValue) : Result<DualScore.DualScore, DualScore.Refusal> =
        let mutable t = 0.0
        let mutable f = 0.0

        for dv, w in SoftValue.candidates sv do
            if proposition dv then t <- t + w else f <- f + w

        DualScore.create t f

    /// The proposition *"the value is exactly this candidate"* — the commonest declared predicate,
    /// and the one that makes `beliefOf` agree with `SoftValue.weightOf` on the support leg.
    ///
    /// `DynamicValue` carries content equality, so this is value equality, not reference equality.
    let isValue (target: DynamicValue) : Proposition = fun dv -> dv = target
