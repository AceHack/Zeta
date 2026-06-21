namespace Zeta.Core.FSharp.TriBoolean

/// Tri-boolean core primitive -- the digital qubit cell (081KSV2WD0008QG0R00051XS0N).
///
/// Three-valued state: True | False | N. The N case is the HELD living-uncertainty
/// (superposition) state -- a discriminated-union case, NOT .NET/F# `null`. It is never
/// silently collapsed. measure is the only collapsing operation, and collapsing an N cell
/// is surfaced as feedback rather than performed silently (Result-over-exception /
/// asymmetric-authorship).
///
/// F# implementation -- oracle #2 of four (TS/F#/C#/Rust) in the summonable-BFT
/// cross-language consensus. The F# compiler is a non-Byzantine oracle.

/// The three-valued state. The N case is the held / superposed living-uncertainty case
/// (a DU case, not .NET null). Single-letter cases -> RequireQualifiedAccess so they do
/// not leak into consumers' open scopes (use Tri.T / Tri.F / Tri.N).
[<RequireQualifiedAccess>]
type Tri =
    | T
    | F
    | N

/// Feedback surfaced when measure is asked to collapse a living (Tri.N) cell -- the
/// forbidden move, surfaced rather than silently performed.
[<RequireQualifiedAccess>]
type CollapseFeedback =
    | CollapsedLivingUncertainty
