namespace Zeta.Core

/// **DurableDiplomacyRankGate — trustBand pre-check for shape renegotiation.**
///
/// Connects `TravelerRankLedger` to `DurableDiplomacy.recordEvent`:
/// a traveler with low `trustBand` in the relevant hat-domain cannot renegotiate
/// their claim shape in that domain.
///
/// **Design:**
///   `DurableDiplomacy.fs` is compiled before `TravelerRankLedger.fs` in F# dependency
///   order, so this adapter module lives after both and wraps `recordEvent` with a
///   trustBand pre-check. The underlying `DurableDiplomacy.recordEvent` is unchanged.
///
/// **Gate semantics:**
///   - If `rankLedger` is `None`: gate is open (no ranking data → no restriction).
///   - If `trustBand(travelerId, domain, ledger) >= threshold`: gate is open.
///   - If `trustBand < threshold`: gate is closed → `Diplomacy.RefusedNoExit(false, false)`.
///
/// **Threshold:**
///   Default `trustBandThreshold = 0.3` — a traveler must have demonstrated at least
///   30% win probability in the domain before renegotiating their shape. This is
///   intentionally low (below the 0.5 fresh-identity prior) to avoid blocking
///   legitimate newcomers while still blocking persistent miscalibrators.
///
/// **Connection to EVE polymorphic diplomacy:**
///   The EVE clone-gate in `ShapeAcceptance` blocks SupraQuantum S (physically impossible).
///   This gate blocks renegotiation by miscalibrated travelers (epistemically untrustworthy).
///   Together they form a two-layer defense: physics layer + calibration layer.
[<RequireQualifiedAccess>]
module DurableDiplomacyRankGate =

    /// Default trustBand threshold for shape renegotiation.
    /// Below this, the gate is closed and the renegotiation is refused.
    let defaultThreshold = 0.3

    /// Result of a gated renegotiation attempt.
    type GateResult =
        /// The gate was open; the outcome and event are returned as normal.
        | Allowed of Diplomacy.NegotiationOutcome * string
        /// The gate was closed because the traveler's trustBand is below the threshold.
        | RefusedLowTrust of
            /// The traveler's actual trustBand in the domain.
            actualTrustBand: float *
            /// The threshold that was required.
            threshold: float

    /// Attempt a shape renegotiation with a trustBand pre-check.
    ///
    /// If `rankLedger` is `None`, the gate is open (no ranking data → no restriction).
    /// If `trustBand(travelerId, domain, ledger) >= threshold`, the gate is open.
    /// If `trustBand < threshold`, returns `RefusedLowTrust`.
    ///
    /// `travelerId` is the traveler's zeta-id.
    /// `domain` is the hat-domain for the renegotiation (e.g. "hat-coding").
    /// `threshold` defaults to `defaultThreshold` (0.3).
    let recordEventGated
        (a: YinYang.Cell)
        (b: YinYang.Cell)
        (travelerId: string)
        (domain: string)
        (rankLedger: TravelerRankLedger.Ledger option)
        (threshold: float) : GateResult =
        match rankLedger with
        | None ->
            // No ranking data — gate is open (conservative: don't block without evidence).
            let outcome, event = DurableDiplomacy.recordEvent a b
            Allowed(outcome, event)
        | Some ledger ->
            let tb = TravelerRankLedger.trustBandOf travelerId domain ledger
            if tb >= threshold then
                let outcome, event = DurableDiplomacy.recordEvent a b
                Allowed(outcome, event)
            else
                RefusedLowTrust(tb, threshold)

    /// Convenience overload using `defaultThreshold`.
    let recordEventGatedDefault
        (a: YinYang.Cell)
        (b: YinYang.Cell)
        (travelerId: string)
        (domain: string)
        (rankLedger: TravelerRankLedger.Ledger option) : GateResult =
        recordEventGated a b travelerId domain rankLedger defaultThreshold

    /// Convert a `GateResult` to a `NegotiationOutcome` for callers that don't need
    /// to distinguish between the two refusal reasons.
    let toOutcome (result: GateResult) : Diplomacy.NegotiationOutcome =
        match result with
        | Allowed(outcome, _) -> outcome
        | RefusedLowTrust _ -> Diplomacy.RefusedNoExit(false, false)

    /// True if the gate was open and the renegotiation was allowed.
    let isAllowed (result: GateResult) : bool =
        match result with
        | Allowed _ -> true
        | RefusedLowTrust _ -> false
