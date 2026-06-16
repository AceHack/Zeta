namespace Zeta.Core

open System.Collections.Immutable

/// How a bounded GSet decides what to forget when the finite room is full.
///
/// Forgetting is heat: every policy that evicts a materialized value reports it
/// on the result. `RejectNew` is the cold policy: it preserves the existing
/// view and backpressures instead of silently losing history.
[<RequireQualifiedAccess>]
type BoundedGSetForgetPolicy =
    /// Never evict a materialized value; reject new/out-of-window values.
    | RejectNew
    /// Forget the lowest-ranked values under canonical comparison.
    /// Use this for rolling logs when the key contains a monotone tick/sequence.
    | ForgetLowest
    /// Forget the highest-ranked values under canonical comparison.
    | ForgetHighest

/// Construction and merge feedback for bounded GSet views.
[<RequireQualifiedAccess>]
type BoundedGSetError =
    | NonPositiveCapacity of int
    | CapacityExceeded of capacity: int * count: int
    | ConfigMismatch of left: BoundedGSetConfig * right: BoundedGSetConfig

/// A deterministic capacity bound for a GSet projection.
and BoundedGSetConfig =
    { Capacity: int
      ForgetPolicy: BoundedGSetForgetPolicy }

/// Admission result for adding one value to a bounded GSet view.
[<RequireQualifiedAccess>]
type BoundedGSetAdmission =
    | Admitted
    | AlreadyPresent
    | RejectedByBound

/// Heat emitted by bounded GSet operations.
///
/// `Forgotten` is the materialized memory the operation had to drop to keep the
/// room finite. A non-empty value is a smell worth investigating: maybe the
/// room needs a larger bound, a colder policy, or a better key.
type BoundedGSetHeat<'T when 'T : comparison> =
    { Forgotten: GSet<'T>
      Units: int }

/// Result of projecting arbitrary input into a bounded GSet view.
type BoundedGSetProjectionResult<'T when 'T : comparison> =
    { State: BoundedGSet<'T>
      Heat: BoundedGSetHeat<'T> }

/// Result of a single bounded add.
and BoundedGSetAddResult<'T when 'T : comparison> =
    { State: BoundedGSet<'T>
      Admission: BoundedGSetAdmission
      Heat: BoundedGSetHeat<'T> }

/// A finite, deterministic projection of a grow-only set.
///
/// This is intentionally not a replacement for `GSet<'T>`. A true GSet never
/// forgets. `BoundedGSet<'T>` stores a materialized room-sized view of the GSet
/// under a deterministic projection, so memory stays bounded and backpressure is
/// visible as `RejectedByBound` or heat.
and BoundedGSet<'T when 'T : comparison> =
    private
        { config: BoundedGSetConfig
          view: GSet<'T> }

    member this.Config = this.config
    member this.View = this.view
    member this.Capacity = this.config.Capacity
    member this.ForgetPolicy = this.config.ForgetPolicy
    member this.Count = GSet.count this.view
    member this.IsSaturated = this.Count >= this.config.Capacity

[<RequireQualifiedAccess>]
module BoundedGSet =

    let private validate (config: BoundedGSetConfig) : Result<BoundedGSetConfig, BoundedGSetError> =
        if config.Capacity <= 0 then
            Error(BoundedGSetError.NonPositiveCapacity config.Capacity)
        else
            Ok config

    let private difference (left: GSet<'T>) (right: GSet<'T>) : GSet<'T> =
        left
        |> GSet.toSeq
        |> Seq.filter (fun value -> not (GSet.contains value right))
        |> GSet.ofSeq

    let private heatOf (forgotten: GSet<'T>) : BoundedGSetHeat<'T> =
        { Forgotten = forgotten
          Units = GSet.count forgotten }

    let emptyHeat<'T when 'T : comparison> : BoundedGSetHeat<'T> =
        heatOf GSet.empty<'T>

    let private project
        (config: BoundedGSetConfig)
        (g: GSet<'T>)
        : Result<BoundedGSetProjectionResult<'T>, BoundedGSetError> =
        let items = GSet.toArray g
        let keepCount = min config.Capacity items.Length

        if keepCount = items.Length then
            Ok
                { State = { config = config; view = g }
                  Heat = emptyHeat }
        else
            match config.ForgetPolicy with
            | BoundedGSetForgetPolicy.RejectNew ->
                Error(BoundedGSetError.CapacityExceeded(config.Capacity, items.Length))
            | BoundedGSetForgetPolicy.ForgetHighest
            | BoundedGSetForgetPolicy.ForgetLowest ->
                let offset =
                    match config.ForgetPolicy with
                    | BoundedGSetForgetPolicy.ForgetHighest -> 0
                    | BoundedGSetForgetPolicy.ForgetLowest -> items.Length - keepCount
                    | BoundedGSetForgetPolicy.RejectNew -> 0

                let kept = GSet<'T>(ImmutableArray.Create(items, offset, keepCount))

                Ok
                    { State = { config = config; view = kept }
                      Heat = heatOf (difference g kept) }

    /// Build an empty bounded view. Invalid capacity stays on the feedback channel.
    let empty<'T when 'T : comparison>
        (config: BoundedGSetConfig)
        : Result<BoundedGSet<'T>, BoundedGSetError> =
        result {
            let! valid = validate config
            return { config = valid; view = GSet.empty<'T> }
        }

    /// Build a bounded view from arbitrary input by canonicalizing then projecting.
    let ofSeq<'T when 'T : comparison>
        (config: BoundedGSetConfig)
        (values: seq<'T>)
        : Result<BoundedGSetProjectionResult<'T>, BoundedGSetError> =
        result {
            let! valid = validate config
            return! values |> GSet.ofSeq |> project valid
        }

    /// The current finite exterior view.
    let toGSet (bounded: BoundedGSet<'T>) : GSet<'T> =
        bounded.View

    let toArray (bounded: BoundedGSet<'T>) : 'T[] =
        GSet.toArray bounded.View

    let toList (bounded: BoundedGSet<'T>) : 'T list =
        GSet.toList bounded.View

    let count (bounded: BoundedGSet<'T>) : int =
        bounded.Count

    let contains (value: 'T) (bounded: BoundedGSet<'T>) : bool =
        GSet.contains value bounded.View

    /// Merge two bounded views that share the same projection policy.
    let union
        (left: BoundedGSet<'T>)
        (right: BoundedGSet<'T>)
        : Result<BoundedGSetProjectionResult<'T>, BoundedGSetError> =
        if left.Config <> right.Config then
            Error(BoundedGSetError.ConfigMismatch(left.Config, right.Config))
        else
            result {
                let! valid = validate left.Config
                return! GSet.union left.View right.View |> project valid
            }

    /// Add one value to the bounded projection and report whether it survived.
    let add
        (value: 'T)
        (bounded: BoundedGSet<'T>)
        : Result<BoundedGSetAddResult<'T>, BoundedGSetError> =
        result {
            let! valid = validate bounded.Config
            let before = bounded.View
            let expanded = GSet.add value before

            if GSet.contains value before then
                return
                    { State = bounded
                      Admission = BoundedGSetAdmission.AlreadyPresent
                      Heat = emptyHeat }
            else
                match project valid expanded with
                | Error(BoundedGSetError.CapacityExceeded _) ->
                    return
                        { State = bounded
                          Admission = BoundedGSetAdmission.RejectedByBound
                          Heat = emptyHeat }
                | Error error ->
                    return! Error error
                | Ok projection ->
                    let after = projection.State.View
                    let admission =
                        if GSet.contains value after then
                            BoundedGSetAdmission.Admitted
                        else
                            BoundedGSetAdmission.RejectedByBound

                    return
                        { State = projection.State
                          Admission = admission
                          Heat = heatOf (difference before after) }
        }
