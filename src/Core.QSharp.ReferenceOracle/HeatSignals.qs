/// HeatSignals.qs — the Q# reference-oracle vocabulary for Zeta heat.
///
/// Heat is not a Q# runtime side effect. The room runtime owns heat emission via
/// injected host ports; Q# only mirrors the finite signal alphabet so quantum
/// oracle experiments can label observation loss, stale samples, and refused
/// readouts with the same treaty tokens used by the F#/TypeScript surfaces.

namespace Zeta.Heat {

    /// Cold is deliberately outside the public heat-signal list: no heat was spent.
    function HeatSignalCold() : Int { return 0; }

    function HeatSignalForgotten() : Int { return 1; }
    function HeatSignalBackpressure() : Int { return 2; }
    function HeatSignalDenied() : Int { return 3; }
    function HeatSignalStorageError() : Int { return 4; }
    function HeatSignalInvalid() : Int { return 5; }
    function HeatSignalExpired() : Int { return 6; }
    function HeatSignalStale() : Int { return 7; }
    function HeatSignalOther() : Int { return 8; }

    /// Normalize a committed heat-signal code. Unknown/future codes remain visible
    /// as Other rather than being dropped or silently treated as Cold.
    function HeatSignalFromKindCode(kindCode : Int) : Int {
        if kindCode == HeatSignalForgotten() {
            return HeatSignalForgotten();
        }
        if kindCode == HeatSignalBackpressure() {
            return HeatSignalBackpressure();
        }
        if kindCode == HeatSignalDenied() {
            return HeatSignalDenied();
        }
        if kindCode == HeatSignalStorageError() {
            return HeatSignalStorageError();
        }
        if kindCode == HeatSignalInvalid() {
            return HeatSignalInvalid();
        }
        if kindCode == HeatSignalExpired() {
            return HeatSignalExpired();
        }
        if kindCode == HeatSignalStale() {
            return HeatSignalStale();
        }
        if kindCode == HeatSignalOther() {
            return HeatSignalOther();
        }
        return HeatSignalOther();
    }

    /// A compact row-counter classifier for oracle transcript tests. Storage is
    /// the hottest boundary, then backpressure, then denied/refused work.
    function HeatSignalForCounters(heatRejected : Int, backpressured : Int, storageErrors : Int) : Int {
        if storageErrors > 0 {
            return HeatSignalStorageError();
        }
        if backpressured > 0 {
            return HeatSignalBackpressure();
        }
        if heatRejected > 0 {
            return HeatSignalDenied();
        }
        return HeatSignalCold();
    }

    /// Loss at the oracle observation boundary maps to the same readout-family
    /// tokens used by LLMTV replay: invalid, expired, stale, or cold.
    function HeatSignalForOracleReadoutLoss(rejectedFrames : Int, expiredFrames : Int, staleFrames : Int) : Int {
        if rejectedFrames > 0 {
            return HeatSignalInvalid();
        }
        if expiredFrames > 0 {
            return HeatSignalExpired();
        }
        if staleFrames > 0 {
            return HeatSignalStale();
        }
        return HeatSignalCold();
    }

    function HeatRowIsCold(heatRejected : Int, backpressured : Int, storageErrors : Int) : Bool {
        return heatRejected == 0 and backpressured == 0 and storageErrors == 0;
    }
}
