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
    let empty: SchemaZ = ZSet.Empty

    /// A schema from a field list (each present once). Duplicate (name, type)
    /// pairs consolidate to weight >1 and will FAIL wellFormed — garbage in,
    /// detected out.
    let ofFields (fields: FieldId seq) : SchemaZ =
        ZSet.ofSeq (fields |> Seq.map (fun f -> f, 1L))

    /// Every field present exactly once (all weights = +1). The integrity
    /// check the fold gives us for free: weight 2 = duplicate add; -1 =
    /// remove-before-add; any ≠ +1 after a merge = a real conflict, surfaced.
    let wellFormed (s: SchemaZ) : bool =
        s.AsSpan().ToArray() |> Array.forall (fun e -> e.Weight = 1L)

    /// The fields of a well-formed schema (weight-+1 rows), sorted by the
    /// binary-collation key order.
    let fields (s: SchemaZ) : FieldId list =
        [ for e in s do
            if e.Weight = 1L then yield e.Key ]

    // ── Deltas: the schema half of a migration, as data ──────────────

    /// Delta: add a field. (+1 on the pair.)
    let addFieldDelta (name: string) (ty: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = name; Type = ty }, 1L ]

    /// Delta: remove a field. (−1 on the pair — a retraction.)
    let removeFieldDelta (name: string) (ty: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = name; Type = ty }, -1L ]

    /// Delta: rename a field. Retract the old identity, insert the new —
    /// never an in-place mutation.
    let renameFieldDelta (oldName: string) (newName: string) (ty: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = oldName; Type = ty }, -1L; { Name = newName; Type = ty }, 1L ]

    /// Delta: retype a field. Same retract+insert shape as rename — the
    /// pair is the identity, so a type change is a different field row.
    let retypeFieldDelta (name: string) (oldTy: DynamicValueType) (newTy: DynamicValueType) : SchemaZ =
        ZSet.ofSeq [ { Name = name; Type = oldTy }, -1L; { Name = name; Type = newTy }, 1L ]

    // ── The fold: apply and its algebraic inverse ─────────────────────

    /// Apply a delta: Z-set sum via the one shared merge kernel — the same
    /// fold that maintains data. No privileged schema channel.
    let applyDelta (delta: SchemaZ) (s: SchemaZ) : SchemaZ = s + delta

    /// Roll back a delta: sum of the ring NEGATE. Always defined — on the
    /// schema plane there is no such thing as a non-invertible migration
    /// (`(s + d) + (-d) = s` is a theorem of ℤ, not a promise of a Down
    /// function). Data-plane recovery (the value a dropped field held) is
    /// SchemaEvolution's dump machinery, untouched.
    let rollbackDelta (delta: SchemaZ) (s: SchemaZ) : SchemaZ = s + (-delta)

    /// Fold a delta stream from a starting schema. A schema VERSION is a
    /// prefix of this stream — position in the fold, not a privileged int.
    let fold (deltas: SchemaZ seq) (start: SchemaZ) : SchemaZ =
        deltas |> Seq.fold (fun acc d -> acc + d) start


/// A migration with both planes explicit: the schema half as a Z-set delta
/// (this file's algebra), the data half as the shipped `SchemaEvolution`
/// migration (Up/Down value transforms, dump window — verbatim, unchanged).
/// Slice 2 (future) derives the data plane FROM the delta for the standard
/// field ops; until then the two are carried side by side.
type MigrationZ =
    { SchemaDelta: SchemaZ
      Data: SchemaEvolution.Migration }
