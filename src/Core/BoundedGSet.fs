namespace Zeta.Core

open System.Collections.Immutable

/// Which side of the canonical GSet order survives when a bounded view is full.
[<RequireQualifiedAccess>]
type BoundedGSetRetention =
    /// Keep the lowest-ranked values under the canonical comparison.
    | KeepLowest
    /// Keep the highest-ranked values under the canonical comparison.
    /// Use this for rolling logs when the key contains a monotone tick/sequence.
    | KeepHighest

/// Construction and merge feedback for bounded GSet views.
[<RequireQualifiedAccess>]
type BoundedGSetError =
    | NonPositiveCapacity of int
    | ConfigMismatch of left: BoundedGSetConfig * right: BoundedGSetConfig

/// A deterministic capacity bound for a GSet projection.
and BoundedGSetConfig =
    { Capacity: int
      Retention: BoundedGSetRetention }

/// Admission result for adding one value to a bounded GSet view.
[<RequireQualifiedAccess>]
type BoundedGSetAdmission =
    | Admitted
    | AlreadyPresent
    | RejectedByBound

/// Result of a single bounded add.
type BoundedGSetAddResult<'T when 'T : comparison> =
    { State: BoundedGSet<'T>
      Admission: BoundedGSetAdmission
      Evicted: GSet<'T> }

/// A finite, deterministic projection of a grow-only set.
///
/// This is intentionally not a replacement for `GSet<'T>`. A true GSet never
/// forgets. `BoundedGSet<'T>` stores a materialized room-sized view of the GSet
/// under a deterministic projection, so memory stays bounded and backpressure is
/// visible as `RejectedByBound` or `Evicted`.
and BoundedGSet<'T when 'T : comparison> =
    private
        { config: BoundedGSetConfig
          view: GSet<'T> }

    member this.Config = this.config
    member this.View = this.view
    member this.Capacity = this.config.Capacity
    member this.Retention = this.config.Retention
    member this.Count = GSet.count this.view
    member this.IsSaturated = this.Count >= this.config.Capacity

[<RequireQualifiedAccess>]
module BoundedGSet =

    let private validate (config: BoundedGSetConfig) : Result<BoundedGSetConfig, BoundedGSetError> =
        if config.Capacity <= 0 then
            Error(BoundedGSetError.NonPositiveCapacity config.Capacity)
        else
            Ok config

    let private keep (config: BoundedGSetConfig) (g: GSet<'T>) : GSet<'T> =
        let items = GSet.toArray g
        let keepCount = min config.Capacity items.Length

        if keepCount = items.Length then
            g
        else
            let offset =
                match config.Retention with
                | BoundedGSetRetention.KeepLowest -> 0
                | BoundedGSetRetention.KeepHighest -> items.Length - keepCount

            GSet<'T>(ImmutableArray.Create(items, offset, keepCount))

    let private difference (left: GSet<'T>) (right: GSet<'T>) : GSet<'T> =
        left
        |> GSet.toSeq
        |> Seq.filter (fun value -> not (GSet.contains value right))
        |> GSet.ofSeq

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
        : Result<BoundedGSet<'T>, BoundedGSetError> =
        result {
            let! valid = validate config
            let view = values |> GSet.ofSeq |> keep valid
            return { config = valid; view = view }
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
        : Result<BoundedGSet<'T>, BoundedGSetError> =
        if left.Config <> right.Config then
            Error(BoundedGSetError.ConfigMismatch(left.Config, right.Config))
        else
            result {
                let! valid = validate left.Config
                let merged = GSet.union left.View right.View |> keep valid
                return { config = valid; view = merged }
            }

    /// Add one value to the bounded projection and report whether it survived.
    let add
        (value: 'T)
        (bounded: BoundedGSet<'T>)
        : Result<BoundedGSetAddResult<'T>, BoundedGSetError> =
        result {
            let! valid = validate bounded.Config
            let before = bounded.View
            let after = GSet.add value before |> keep valid

            let admission =
                if GSet.contains value before then
                    BoundedGSetAdmission.AlreadyPresent
                elif GSet.contains value after then
                    BoundedGSetAdmission.Admitted
                else
                    BoundedGSetAdmission.RejectedByBound

            return
                { State = { config = valid; view = after }
                  Admission = admission
                  Evicted = difference before after }
        }
