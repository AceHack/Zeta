namespace Zeta.Core

open System.Collections.Immutable

/// How a bounded GSet decides what to forget when the finite room is full.
///
/// Forgetting is heat: every policy that evicts a materialized value reports it
/// on the result. `NoForgetBackpressure` is the cold policy: it preserves the
/// existing view and backpressures instead of silently losing history.
[<RequireQualifiedAccess>]
type BoundedGSetForgetPolicy =
    /// Never evict a materialized value; reject new/out-of-window values.
    | NoForgetBackpressure
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

[<RequireQualifiedAccess>]
module BoundedGSetConfig =

    let withPolicy capacity forgetPolicy : BoundedGSetConfig =
        { Capacity = capacity
          ForgetPolicy = forgetPolicy }

    let noForgetBackpressure capacity : BoundedGSetConfig =
        withPolicy capacity BoundedGSetForgetPolicy.NoForgetBackpressure

    let forgetLowest capacity : BoundedGSetConfig =
        withPolicy capacity BoundedGSetForgetPolicy.ForgetLowest

    let forgetHighest capacity : BoundedGSetConfig =
        withPolicy capacity BoundedGSetForgetPolicy.ForgetHighest

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
            | BoundedGSetForgetPolicy.NoForgetBackpressure ->
                Error(BoundedGSetError.CapacityExceeded(config.Capacity, items.Length))
            | BoundedGSetForgetPolicy.ForgetHighest ->
                let kept = GSet<'T>(ImmutableArray.Create(items, 0, keepCount))

                Ok
                    { State = { config = config; view = kept }
                      Heat = heatOf (difference g kept) }
            | BoundedGSetForgetPolicy.ForgetLowest ->
                let offset =
                    items.Length - keepCount

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


/// How a modulo GSet projection handles two distinct values that map to the
/// same finite slot.
[<RequireQualifiedAccess>]
type ModuloGSetCollisionPolicy =
    /// Preserve the existing occupant and backpressure the newcomer.
    | RejectCollision
    /// Replace the existing occupant and emit the evicted value as heat.
    | ReplaceExisting

/// Construction and admission feedback for modulo GSet views.
[<RequireQualifiedAccess>]
type ModuloGSetError =
    | NonPositiveSlots of int

/// A deterministic modulo-slot bound for a GSet projection.
type ModuloGSetConfig =
    { Slots: int
      CollisionPolicy: ModuloGSetCollisionPolicy }

[<RequireQualifiedAccess>]
module ModuloGSetConfig =

    let withCollisionPolicy slots collisionPolicy : ModuloGSetConfig =
        { Slots = slots
          CollisionPolicy = collisionPolicy }

    let rejectCollision slots : ModuloGSetConfig =
        withCollisionPolicy slots ModuloGSetCollisionPolicy.RejectCollision

    let replaceExisting slots : ModuloGSetConfig =
        withCollisionPolicy slots ModuloGSetCollisionPolicy.ReplaceExisting

/// Admission result for adding one value to a modulo GSet view.
[<RequireQualifiedAccess>]
type ModuloGSetAdmission =
    | Admitted
    | AlreadyPresent
    | Replaced
    | RejectedByCollision

/// Result of projecting arbitrary input into a modulo GSet view.
type ModuloGSetProjectionResult<'T when 'T : comparison> =
    { State: ModuloGSet<'T>
      Heat: BoundedGSetHeat<'T>
      Rejected: int }

/// Result of a single modulo add.
and ModuloGSetAddResult<'T when 'T : comparison> =
    { State: ModuloGSet<'T>
      Admission: ModuloGSetAdmission
      Slot: int
      Heat: BoundedGSetHeat<'T> }

/// A finite modulo-slot projection of a grow-only set.
///
/// This stores at most one materialized value per slot. The caller owns the
/// slot function, which keeps domain-specific ordering/hash choices outside the
/// core type and makes the budget policy explicit at the call site.
and ModuloGSet<'T when 'T : comparison> =
    private
        { config: ModuloGSetConfig
          slots: ImmutableSortedDictionary<int, 'T> }

    member this.Config = this.config
    member this.Slots = this.config.Slots
    member this.CollisionPolicy = this.config.CollisionPolicy
    member this.Count = this.slots.Count
    member this.IsSaturated = this.Count >= this.config.Slots

[<RequireQualifiedAccess>]
module ModuloGSet =

    let private validate (config: ModuloGSetConfig) : Result<ModuloGSetConfig, ModuloGSetError> =
        if config.Slots <= 0 then
            Error(ModuloGSetError.NonPositiveSlots config.Slots)
        else
            Ok config

    let private normalizeSlot (slots: int) (rawSlot: int64) : int =
        let modulus = int64 slots
        let remainder = rawSlot % modulus
        if remainder < 0L then
            int (remainder + modulus)
        else
            int remainder

    let emptyHeat<'T when 'T : comparison> : BoundedGSetHeat<'T> =
        BoundedGSet.emptyHeat<'T>

    let private heatOfOne (value: 'T) : BoundedGSetHeat<'T> =
        { Forgotten = GSet.singleton value
          Units = 1 }

    let private combineHeat (left: BoundedGSetHeat<'T>) (right: BoundedGSetHeat<'T>) : BoundedGSetHeat<'T> =
        { Forgotten = GSet.union left.Forgotten right.Forgotten
          Units = left.Units + right.Units }

    /// Build an empty modulo-slot view. Invalid slot counts stay on the
    /// feedback channel.
    let empty<'T when 'T : comparison> (config: ModuloGSetConfig) : Result<ModuloGSet<'T>, ModuloGSetError> =
        result {
            let! valid = validate config

            return
                { config = valid
                  slots = ImmutableSortedDictionary<int, 'T>.Empty }
        }

    /// The current finite exterior view, forgetting slot placement.
    let toGSet (modulo: ModuloGSet<'T>) : GSet<'T> =
        modulo.slots.Values |> GSet.ofSeq

    /// The current finite exterior view in canonical GSet order.
    let toList (modulo: ModuloGSet<'T>) : 'T list =
        modulo |> toGSet |> GSet.toList

    /// Slot occupants in deterministic ascending-slot order.
    let toSlotList (modulo: ModuloGSet<'T>) : (int * 'T) list =
        modulo.slots
        |> Seq.map (fun kvp -> kvp.Key, kvp.Value)
        |> Seq.toList

    let count (modulo: ModuloGSet<'T>) : int =
        modulo.Count

    let contains (value: 'T) (modulo: ModuloGSet<'T>) : bool =
        modulo.slots.Values |> Seq.exists ((=) value)

    /// Add one value using an explicit raw slot. The slot is normalized modulo
    /// the configured slot count, so negative or oversized raw slots stay
    /// deterministic instead of throwing.
    let addWithSlot
        (rawSlot: int64)
        (value: 'T)
        (modulo: ModuloGSet<'T>)
        : Result<ModuloGSetAddResult<'T>, ModuloGSetError> =
        result {
            let! valid = validate modulo.Config
            let slot = normalizeSlot valid.Slots rawSlot

            match modulo.slots.TryGetValue slot with
            | false, _ ->
                return
                    { State =
                        { config = valid
                          slots = modulo.slots.SetItem(slot, value) }
                      Admission = ModuloGSetAdmission.Admitted
                      Slot = slot
                      Heat = emptyHeat }
            | true, existing when existing = value ->
                return
                    { State = modulo
                      Admission = ModuloGSetAdmission.AlreadyPresent
                      Slot = slot
                      Heat = emptyHeat }
            | true, existing ->
                match valid.CollisionPolicy with
                | ModuloGSetCollisionPolicy.RejectCollision ->
                    return
                        { State = modulo
                          Admission = ModuloGSetAdmission.RejectedByCollision
                          Slot = slot
                          Heat = emptyHeat }
                | ModuloGSetCollisionPolicy.ReplaceExisting ->
                    return
                        { State =
                            { config = valid
                              slots = modulo.slots.SetItem(slot, value) }
                          Admission = ModuloGSetAdmission.Replaced
                          Slot = slot
                          Heat = heatOfOne existing }
        }

    /// Add one value using a caller-owned slot function.
    let add
        (slotOf: 'T -> int64)
        (value: 'T)
        (modulo: ModuloGSet<'T>)
        : Result<ModuloGSetAddResult<'T>, ModuloGSetError> =
        addWithSlot (slotOf value) value modulo

    /// Build a modulo view from stable input order.
    let ofSeq
        (slotOf: 'T -> int64)
        (config: ModuloGSetConfig)
        (values: seq<'T>)
        : Result<ModuloGSetProjectionResult<'T>, ModuloGSetError> =
        match empty config with
        | Error e -> Error e
        | Ok state ->
            use enumerator = values.GetEnumerator()
            let mutable current = state
            let mutable heat = emptyHeat
            let mutable rejected = 0
            let mutable error: ModuloGSetError option = None

            while error.IsNone && enumerator.MoveNext() do
                match add slotOf enumerator.Current current with
                | Error e -> error <- Some e
                | Ok added ->
                    current <- added.State
                    heat <- combineHeat heat added.Heat

                    match added.Admission with
                    | ModuloGSetAdmission.RejectedByCollision -> rejected <- rejected + 1
                    | ModuloGSetAdmission.Admitted
                    | ModuloGSetAdmission.AlreadyPresent
                    | ModuloGSetAdmission.Replaced -> ()

            match error with
            | Some e -> Error e
            | None ->
                Ok
                    { State = current
                      Heat = heat
                      Rejected = rejected }

    /// Build a modulo view from a canonical GSet order.
    let ofGSet
        (slotOf: 'T -> int64)
        (config: ModuloGSetConfig)
        (values: GSet<'T>)
        : Result<ModuloGSetProjectionResult<'T>, ModuloGSetError> =
        values |> GSet.toSeq |> ofSeq slotOf config
