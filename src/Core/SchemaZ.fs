namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════
//  SchemaZ — schema-as-events on the Z-set (081KWFXTHJY step 5, slice 1).
//
//  The schema plane made first-class data: a schema IS a Z-set of fields,
//  and a migration's schema half IS a Z-set delta — applied by the same
//  shared merge kernel as data, rolled back by ring `negate`. "Schema is
//  also just events on the ZSet" (Aaron, 2026-07-01).
//
//  Two planes (design: docs/research/2026-07-02-schema-as-events-…md):
//   • SCHEMA plane (this module): pure ℤ-weighted algebra. Apply = sum;
//     rollback = sum of negate. Every delta is invertible here — additive
//     inverse is a ring axiom, not a hand-written Down function.
//   • DATA plane (SchemaEvolution.fs, UNCHANGED): the `Up`/`Down` value
//     transforms, defaults, the windowed garbage dump. Lossiness was
//     always a data-plane fact; the split makes that visible.
//
//  Key identity = (FieldName, DynamicValueType) — the whole pair, so
//  rename and retype are retract+insert, never in-place mutation. The
//  field's DEFAULT value is deliberately NOT part of the key: DynamicValue
//  is NoComparison, and DV2.0 says the default is satellite/data-plane
//  (it parameterises the data transform, not the schema identity).
//
//  Well-formedness: every weight = +1 (a field present exactly once).
//  Weight 0 rows drop out of the fold; any other weight is a DETECTED
//  inconsistency (duplicate add, remove-before-add, concurrent-merge
//  conflict) — integrity as arithmetic, never a silent overwrite.
// ═══════════════════════════════════════════════════════════════════

/// A field's schema-plane identity: name + runtime shape tag. Comparable
/// (ZSet key); ordering is the binary-collation default on the name.
[<Struct>]
type FieldId =
    { Name: string
      Type: DynamicValueType }

/// The schema plane: one row per field, weight = multiplicity in ℤ.
/// A well-formed schema has every weight = +1.
type SchemaZ = ZSet<FieldId>

[<RequireQualifiedAccess>]
module SchemaZ =

    /// The empty schema.
    [<CompiledName "Empty">]
    let empty: SchemaZ = ZSet.Empty

    /// A schema from a field list (each present once). Duplicate (name, type)
    /// pairs consolidate to weight >1 and will FAIL wellFormed — garbage in,
    /// detected out.
    [<CompiledName "OfFields">]
    let ofFields (fields: FieldId seq) : SchemaZ =
        ZSet.ofSeq (fields |> Seq.map (fun f -> f, 1L))

    /// Every field present exactly once (all weights = +1). The integrity
    /// check the fold gives us for free: weight 2 = duplicate add; -1 =
    /// remove-before-add; any ≠ +1 after a merge = a real conflict, surfaced.
    [<CompiledName "WellFormed">]
    let wellFormed (s: SchemaZ) : bool =
        s.AsSpan().ToArray() |> Array.forall (fun e -> e.Weight = 1L)

    /// The fields of a well-formed schema (weight-+1 rows), sorted by the
    /// binary-collation key order.
    [<CompiledName "Fields">]
    let fields (s: SchemaZ) : FieldId list =
        [ for e in s do
            if e.Weight = 1L then yield e.Key ]

    // ── Deltas: the schema half of a migration, as data ──────────────

    /// Delta: add a field. (+1 on the pair.)
    [<CompiledName "AddFieldDelta">]
    let addFieldDelta (name: string) (ty: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = name; Type = ty }, 1L ]

    /// Delta: remove a field. (−1 on the pair — a retraction.)
    [<CompiledName "RemoveFieldDelta">]
    let removeFieldDelta (name: string) (ty: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = name; Type = ty }, -1L ]

    /// Delta: rename a field. Retract the old identity, insert the new —
    /// never an in-place mutation.
    [<CompiledName "RenameFieldDelta">]
    let renameFieldDelta (oldName: string) (newName: string) (ty: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = oldName; Type = ty }, -1L; { Name = newName; Type = ty }, 1L ]

    /// Delta: retype a field. Same retract+insert shape as rename — the
    /// pair is the identity, so a type change is a different field row.
    [<CompiledName "RetypeFieldDelta">]
    let retypeFieldDelta (name: string) (oldTy: DynamicValueType) (newTy: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = name; Type = oldTy }, -1L; { Name = name; Type = newTy }, 1L ]

    // ── The fold: apply and its algebraic inverse ─────────────────────

    /// Apply a delta: Z-set sum via the one shared merge kernel — the same
    /// fold that maintains data. No privileged schema channel.
    [<CompiledName "ApplyDelta">]
    let applyDelta (delta: SchemaZ) (s: SchemaZ) : SchemaZ = s + delta

    /// Roll back a delta: sum of the ring NEGATE. Always defined — on the
    /// schema plane there is no such thing as a non-invertible migration
    /// (`(s + d) + (-d) = s` is a theorem of ℤ, not a promise of a Down
    /// function). Data-plane recovery (the value a dropped field held) is
    /// SchemaEvolution's dump machinery, untouched.
    [<CompiledName "RollbackDelta">]
    let rollbackDelta (delta: SchemaZ) (s: SchemaZ) : SchemaZ = s + (-delta)

    /// Fold a delta stream from a starting schema. A schema VERSION is a
    /// prefix of this stream — position in the fold, not a privileged int.
    [<CompiledName "Fold">]
    let fold (deltas: SchemaZ seq) (start: SchemaZ) : SchemaZ =
        deltas |> Seq.fold (fun acc d -> acc + d) start

    /// The rows that make a schema ill-formed (weight ≠ +1), WITH their
    /// weights — the conflict PAYLOAD `wellFormed`'s bool cannot carry
    /// (Iris event-storm 2026-07-02: a detected conflict must name the
    /// offending field, not just say "false"). Empty list ⇔ well-formed.
    [<CompiledName "Conflicts">]
    let conflicts (s: SchemaZ) : (FieldId * int64) list =
        [ for e in s do
            if e.Weight <> 1L then yield e.Key, e.Weight ]


/// A migration with both planes explicit: the schema half as a Z-set delta
/// (this file's algebra), the data half as the shipped `SchemaEvolution`
/// migration (Up/Down value transforms, dump window — verbatim, unchanged).
/// `MigrationZ.compile` (slice 2) DERIVES the data plane from the delta for
/// the standard field ops; hand-written data planes remain available for
/// custom migrations.
type MigrationZ =
    { SchemaDelta: SchemaZ
      Data: SchemaEvolution.Migration }

[<RequireQualifiedAccess>]
module MigrationZ =

    // ═════════════════════════════════════════════════════════════════
    //  Slice 2 — the data plane DERIVED from the delta (081KWFXTHJY):
    //  the generator-is-the-ECC move. The opaque Up/Down functions become
    //  the COMPILED form of the schema delta; the delta is the source of
    //  truth, the code is generated from it.
    //
    //  The one honest limit (a theorem about the design, tested):
    //  `renameFieldDelta a b T` and `removeFieldDelta a T + addFieldDelta
    //  b T` are EQUAL as schema deltas — the algebra deliberately cannot
    //  tell them apart — but they are DIFFERENT data transforms (rename
    //  carries the value across; remove+add does not). Value
    //  correspondence is data-plane intent that the schema plane does not
    //  and should not carry. So `compile` takes explicit RENAME HINTS;
    //  every unhinted −1/+1 pair derives as the conservative
    //  windowed-lossless form (stash-to-dump on remove, default on add) —
    //  nothing is ever silently lost, per the dump doctrine.
    // ═════════════════════════════════════════════════════════════════

    /// Data-plane intent the schema delta cannot carry: "the value of
    /// `From` becomes the value of `To`" (rename keeps the type; the
    /// schema rows differ only in name).
    type RenameHint = { From: string; To: string }

    /// Compile a schema delta into a data-plane `SchemaEvolution.Migration`.
    ///
    /// Classification (deterministic, binary-collation order):
    ///  • hinted (−1 (a,T), +1 (b,T)) pairs  → `renameField a b` (value carried)
    ///  • remaining −1 rows                  → `stashToDump` (windowed-lossless remove)
    ///  • remaining +1 rows                  → `addField` with `defaults` (backward compat)
    /// `Down` composes the exact inverses in reverse order — total, because
    /// every derived op is invertible-in-the-window (`restoreFromDump` /
    /// `removeField` / rename-swapped).
    ///
    /// Errors (Result, never silent): a weight outside {−1,+1} (an
    /// ill-formed delta is not a migration); a hint that doesn't match the
    /// delta's rows; an add row with no default supplied.
    [<CompiledName "Compile">]
    let compile
        (fromV: int)
        (hints: RenameHint list)
        (defaults: Map<string, DynamicValue>)
        (delta: SchemaZ)
        : Result<SchemaEvolution.Migration, string> =
        // 1. Split rows; reject non-unit weights up front.
        let rows = [ for e in delta -> e.Key, e.Weight ]
        match rows |> List.tryFind (fun (_, w) -> w <> 1L && w <> -1L) with
        | Some (k, w) -> Error(sprintf "delta row (%s: %A) has weight %d — not a unit migration delta" k.Name k.Type w)
        | None ->

        let removes = rows |> List.filter (fun (_, w) -> w = -1L) |> List.map fst
        let adds = rows |> List.filter (fun (_, w) -> w = 1L) |> List.map fst

        // 2. Consume rename hints: each must match a (−1 From, +1 To) pair of equal type.
        let validate () =
            hints
            |> List.fold
                (fun acc hint ->
                    match acc with
                    | Error _ -> acc
                    | Ok (rem: FieldId list, add: FieldId list, ren) ->
                        match rem |> List.tryFind (fun r -> r.Name = hint.From),
                              add |> List.tryFind (fun a -> a.Name = hint.To) with
                        | Some r, Some a when r.Type = a.Type ->
                            Ok(List.filter ((<>) r) rem, List.filter ((<>) a) add, (hint, r.Type) :: ren)
                        | Some r, Some a ->
                            Error(sprintf "rename hint %s->%s: types differ (%A vs %A) — that is a retype, not a rename" hint.From hint.To r.Type a.Type)
                        | _ ->
                            Error(sprintf "rename hint %s->%s does not match the delta's -1/+1 rows" hint.From hint.To))
                (Ok(removes, adds, []))

        match validate () with
        | Error e -> Error e
        | Ok (remainingRemoves, remainingAdds, renames) ->

        // 3. Every remaining add needs a default (backward compat is a data-plane fact).
        match remainingAdds |> List.tryFind (fun a -> not (defaults.ContainsKey a.Name)) with
        | Some a -> Error(sprintf "add of field '%s' has no default supplied — backward compatibility needs one" a.Name)
        | None ->

        // 4. Compose Up/Down in deterministic (binary-collation) order:
        //    renames, then removes (stash — windowed-lossless), then adds.
        let sortByName xs = xs |> List.sortWith (fun (a: FieldId) b -> Collation.binary.Compare(a.Name, b.Name))
        let renamesSorted = renames |> List.sortWith (fun ((h1, _): RenameHint * _) (h2, _) -> Collation.binary.Compare(h1.From, h2.From))
        let removesSorted = sortByName remainingRemoves
        let addsSorted = sortByName remainingAdds

        let upSteps =
            [ for (h, _) in renamesSorted -> SchemaEvolution.renameField h.From h.To
              for r in removesSorted -> SchemaEvolution.stashToDump r.Name
              for a in addsSorted -> SchemaEvolution.addField a.Name defaults.[a.Name] ]

        let downSteps =
            [ for a in List.rev addsSorted -> SchemaEvolution.removeField a.Name
              for r in List.rev removesSorted -> SchemaEvolution.restoreFromDump r.Name
              for (h, _) in List.rev renamesSorted -> SchemaEvolution.renameField h.To h.From ]

        let composeAll steps v = steps |> List.fold (fun acc f -> f acc) v

        Ok
            { From = fromV
              To = fromV + 1
              Up = composeAll upSteps
              Down = Some(composeAll downSteps) }


// ═══════════════════════════════════════════════════════════════════
//  SchemaLog — the EVENT LOG whose fold IS the schema
//  (081KYWE8Q4008QG0R000H558SH, increment 1).
//
//  Aaron 2026-07-31: schema-on-ZSets is "our entire db stored-proc
//  architecture long term." Design source:
//  docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-
//  dispatch-and-schema-as-events-on-the-zset.md §5.
//
//  The layer above `SchemaZ`'s deltas: a schema is NOT a desired-state map
//  that someone edits. It is the FOLD of an append-only log of events, each
//  carrying a +1 (grant/add) or −1 (revoke/drop) Z-set weight. The CURRENT
//  schema is the consolidated Z-set at a position in that log; a schema
//  VERSION is a prefix, not a privileged integer. Revoke ≡ Z-set retraction.
//
//  Three properties fall out of the Z-set abelian group, and each is a
//  quantified law in SchemaZ.Tests.fs — not a hope:
//   • ORDER-INDEPENDENCE — `+` is commutative + associative, so folding the
//     same event set in ANY order gives the same schema. This is the
//     load-bearing DST / merge property (multi-writer, out-of-order delivery).
//   • REPLAY / PREFIX-SPLIT — folding a prefix then the rest == folding all.
//     Checkpoint-and-resume is arithmetic, not a special code path.
//   • RETRACTION CANCELS — grant then revoke ⇒ weight 0 ⇒ the row drops out
//     of the fold entirely. The field is *absent*, not tombstoned.
//
//  IDEMPOTENCY — stated honestly, both halves (discipline #6 says: make it
//  idempotent by key, or NAME where it is not):
//   • REDELIVERY of the SAME event IS idempotent. `EventId` is the
//     idempotency key; `dedupe` collapses byte-identical redeliveries by the
//     WHOLE event (id AND op) before the fold, so at-least-once transports
//     are safe: `current (log @ log) = current log`.
//   • DUPLICATE INTENT is deliberately NOT idempotent. Two DISTINCT events
//     (different ids) that both add the same field fold to weight 2 — a
//     DETECTED conflict (`SchemaZ.wellFormed` = false, `SchemaZ.conflicts`
//     names the row), never a silent last-writer-wins overwrite. Z-set `+`
//     is sum, not G-Set union; that is the whole point of using ℤ weights.
//   • An `EventId` reused for a DIFFERENT op is neither deduped nor
//     resolved — `idCollisions` reports it as the neutral FACT it is and
//     leaves the reading (retry-with-drift? forged id? two writers, one
//     counter?) to caller policy (`dual-use-detection-is-neutral-oracle-decides`).
// ═══════════════════════════════════════════════════════════════════

/// A schema-plane intent. Each op denotes a Z-set delta (`SchemaOp.delta`)
/// and has an exact additive inverse (`SchemaOp.invert`) — the ring gives
/// undo for free, so there is no hand-written Down on this plane.
type SchemaOp =
    /// Grant: the field becomes present. (+1 on the (name, type) pair.)
    | AddField of added: FieldId
    /// Revoke: the field becomes absent. (−1 — a retraction, the antiparticle.)
    | DropField of dropped: FieldId
    /// Retract the old identity, insert the new. Never in-place mutation.
    | RenameField of renameFrom: string * renameTo: string * renameType: DynamicValueType
    /// Same retract+insert shape — the (name, type) PAIR is the identity.
    | RetypeField of retypeName: string * fromType: DynamicValueType * toType: DynamicValueType

/// One entry in the append-only schema log: an intent plus its idempotency
/// key. `EventId` is a caller-supplied natural/dedup key (a ZetaId in
/// production) — it exists so redelivery is safe, NOT so duplicate intent is
/// hidden. Ordinal string identity throughout (`culture-invariant-by-default`).
type SchemaEvent = { EventId: string; Op: SchemaOp }

/// The log. Append-only; the current schema is its fold, never a stored map.
type SchemaLog = SchemaEvent list

[<RequireQualifiedAccess>]
module SchemaOp =

    /// The Z-set delta an op denotes — the ONLY bridge from intent to algebra.
    [<CompiledName "Delta">]
    let delta (op: SchemaOp) : SchemaZ =
        match op with
        | AddField fid -> SchemaZ.addFieldDelta fid.Name fid.Type
        | DropField fid -> SchemaZ.removeFieldDelta fid.Name fid.Type
        | RenameField (fromName, toName, ty) -> SchemaZ.renameFieldDelta fromName toName ty
        | RetypeField (name, fromTy, toTy) -> SchemaZ.retypeFieldDelta name fromTy toTy

    /// The op whose delta is the ring NEGATE of this one:
    /// `delta (invert op) = -(delta op)` — proven, not asserted.
    [<CompiledName "Invert">]
    let invert (op: SchemaOp) : SchemaOp =
        match op with
        | AddField fid -> DropField fid
        | DropField fid -> AddField fid
        | RenameField (fromName, toName, ty) -> RenameField(toName, fromName, ty)
        | RetypeField (name, fromTy, toTy) -> RetypeField(name, toTy, fromTy)

[<RequireQualifiedAccess>]
module SchemaEvent =

    /// Mint an event: an idempotency key + an intent.
    [<CompiledName "Create">]
    let create (eventId: string) (op: SchemaOp) : SchemaEvent = { EventId = eventId; Op = op }

    /// The Z-set delta this event contributes to the fold.
    [<CompiledName "Delta">]
    let delta (e: SchemaEvent) : SchemaZ = SchemaOp.delta e.Op

    /// The compensating event — a NEW event (fresh id) that retracts this
    /// one. The log is append-only: undo is an appended retraction, never an
    /// erasure (§5 Memory Preservation).
    [<CompiledName "Compensate">]
    let compensate (eventId: string) (e: SchemaEvent) : SchemaEvent =
        { EventId = eventId; Op = SchemaOp.invert e.Op }

[<RequireQualifiedAccess>]
module SchemaLog =

    /// The empty log.
    [<CompiledName "Empty">]
    let empty: SchemaLog = []

    /// Collapse redeliveries: distinct on the WHOLE event (id AND op),
    /// first occurrence wins, order preserved. Deterministic, so DST
    /// replays it; set-semantics, so it is itself idempotent + commutative.
    [<CompiledName "Dedupe">]
    let dedupe (log: SchemaEvent seq) : SchemaLog = log |> List.ofSeq |> List.distinct

    /// Fold a log into a schema WITHOUT deduplication — the raw ℤ sum of
    /// every event's delta. Honest about at-least-once transports: a
    /// redelivered event doubles a weight here. Use `current` unless you
    /// specifically want the raw arithmetic (the prefix-split law is stated
    /// on this fold, because it holds unconditionally).
    [<CompiledName "FoldRawFrom">]
    let foldRawFrom (start: SchemaZ) (log: SchemaEvent seq) : SchemaZ =
        log |> Seq.fold (fun acc e -> acc + SchemaEvent.delta e) start

    /// `foldRawFrom` from the empty schema.
    [<CompiledName "FoldRaw">]
    let foldRaw (log: SchemaEvent seq) : SchemaZ = foldRawFrom SchemaZ.empty log

    /// THE current schema: dedupe by event identity, then fold. Redelivery-safe
    /// and order-independent — the two properties a replicated log needs.
    [<CompiledName "CurrentFrom">]
    let currentFrom (start: SchemaZ) (log: SchemaEvent seq) : SchemaZ =
        foldRawFrom start (dedupe log)

    /// `currentFrom` from the empty schema — the live schema of a log.
    [<CompiledName "Current">]
    let current (log: SchemaEvent seq) : SchemaZ = currentFrom SchemaZ.empty log

    /// The schema AT version `n` = the fold of the first `n` events. A
    /// version is a POSITION in the log, not a privileged integer stored
    /// beside the data.
    [<CompiledName "At">]
    let at (n: int) (log: SchemaEvent seq) : SchemaZ =
        current (log |> Seq.truncate (max 0 n))

    /// The live fields of a log's current schema (weight-+1 rows).
    [<CompiledName "Fields">]
    let fields (log: SchemaEvent seq) : FieldId list = SchemaZ.fields (current log)

    /// Rows the folded log cannot justify (weight ≠ +1), with their weights:
    /// duplicate intent, revoke-before-grant, concurrent-merge conflict.
    /// Empty ⇔ the current schema is well-formed.
    [<CompiledName "Conflicts">]
    let conflicts (log: SchemaEvent seq) : (FieldId * int64) list = SchemaZ.conflicts (current log)

    /// Event ids carrying MORE THAN ONE distinct op — an idempotency key
    /// that does not key one intent. Reported as the neutral fact; the
    /// reading (retry drift / forged id / two writers sharing a counter) is
    /// caller policy. Deterministic order: ids ascending in binary collation.
    [<CompiledName "IdCollisions">]
    let idCollisions (log: SchemaEvent seq) : (string * SchemaOp list) list =
        dedupe log
        |> List.groupBy (fun e -> e.EventId)
        |> List.choose (fun (id, es) ->
            match es |> List.map (fun e -> e.Op) |> List.distinct with
            | [ _ ] -> None
            | ops -> Some(id, ops))
        |> List.sortWith (fun (a, _) (b, _) -> Collation.binary.Compare(a, b))
