namespace Zeta.Core

open System.Threading.Tasks

/// SoftIsr — **SoftValue wired into the ISR Result channel** (Aaron 2026-06-11: "2 let's do it"; the
/// first-night open item: "value-axis uncertainty into the promise/arrow").
///
/// The soft arrow: an `ISR<'A, SoftValue>` — the value channel carries a **held distribution** over
/// `DynamicValue` candidates, so **uncertainty travels WITH the promise** (the rooms-are-IO-packet-
/// wrappers doctrine: in the message, never ambient — §13). Bayesian evidence arrives as arrow steps
/// (`observeWith` — likelihoods compose under `>=>`); collapse is explicit (`resolveAt` — only when
/// confident, else the room keeps holding); a zero-likelihood observation (the distribution annihilated)
/// surfaces honestly in the ERROR channel (`Failed`) — the sum/product split Rodney cut: held softness
/// is the VALUE, genuine failure is the ERROR.
[<RequireQualifiedAccess>]
module SoftIsr =

    /// Lift a certain value into the soft arrow: a point-mass distribution (certain ⇒ soft trivially).
    let certain (f: 'a -> DynamicValue) : ISR<'a, SoftValue.SoftValue> =
        fun _ctx a -> Task.FromResult(Ok(SoftValue.certain (f a)))

    /// Lift a weighted candidate set into the soft arrow. An empty/invalid set is a `Failed` error
    /// (you cannot hold a distribution over nothing).
    let ofWeighted (f: 'a -> (DynamicValue * float) list) : ISR<'a, SoftValue.SoftValue> =
        fun _ctx a ->
            match SoftValue.ofWeighted (f a) with
            | Some sv -> Task.FromResult(Ok sv)
            | None -> Task.FromResult(Error(Failed "soft lift: no valid candidates"))

    /// Bayesian update as an arrow step: posterior ∝ prior · likelihood. Evidence composes under `>=>`
    /// (independent-evidence observes COMMUTE — the SoftValue law). A likelihood that annihilates every
    /// candidate is a genuine failure (`Failed`), surfaced in the error channel.
    let observeWith (likelihood: DynamicValue -> float) : ISR<SoftValue.SoftValue, SoftValue.SoftValue> =
        fun _ctx sv ->
            match SoftValue.observe likelihood sv with
            | Some sv' -> Task.FromResult(Ok sv')
            | None -> Task.FromResult(Error(Failed "observe: likelihood annihilated the distribution"))

    /// Explicit collapse: resolve to a definite `DynamicValue` ONLY when confidence ≥ `threshold`;
    /// otherwise return the still-held distribution (`Choice2Of2`) — the room keeps holding, which is a
    /// VALUE, not an error (soft mode composes; unresolved is a legitimate state).
    let resolveAt (threshold: float) : ISR<SoftValue.SoftValue, Choice<DynamicValue, SoftValue.SoftValue>> =
        fun _ctx sv ->
            match SoftValue.resolve threshold sv with
            | Some dv -> Task.FromResult(Ok(Choice1Of2 dv))
            | None -> Task.FromResult(Ok(Choice2Of2 sv))

    /// The DEMANDING collapse: resolve or fail — for callers that need hardness NOW (the boundary where
    /// soft must become solid; SolidGround-by-proof). Under-threshold ⇒ `Failed` with the confidence
    /// stated (honest refusal, not a silent guess).
    let mustResolveAt (threshold: float) : ISR<SoftValue.SoftValue, DynamicValue> =
        fun _ctx sv ->
            match SoftValue.resolve threshold sv with
            | Some dv -> Task.FromResult(Ok dv)
            | None ->
                Task.FromResult(
                    Error(Failed(sprintf "unresolved: confidence %.3f < threshold %.3f" (SoftValue.confidence sv) threshold))
                )
