namespace Zeta.Core

open System
open System.Collections.Generic
open System.Globalization

// ═══════════════════════════════════════════════════════════════════
//  ZAtom — the POLYMORPHIC Z-SET BASE ATOM: open-generics dispatch
//  over the STORED TYPE (081KYWE8Q3508QG0R000KZ5PWR, increment 1).
//
//  Aaron 2026-07-31: open-generics dispatch over Z-sets, together with
//  schema-on-Z-sets, "is our entire db stored-proc architecture long
//  term." Design source: docs/research/2026-07-01-the-polymorphic-zset-
//  base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md.
//
//  WHICH AXIS THIS IS. The design note names two open generics riding one
//  Z-set. The WEIGHT axis (`'W` over `ISemiring<'W>`, §3–4 paths 2/3:
//  struct-ring monomorphisation) is ALREADY LANDED — `ZSetW.fs`'s `*By`
//  ops. This file is the OTHER axis, the one the work-item names: the
//  ELEMENT/ROW type. A stored procedure runs one operator surface over
//  rows whose concrete types are known only at RUNTIME, so the element
//  axis is resolved by §4's path 1 — DICTIONARY-PASSING (Wadler–Blott
//  1989): the caller passes a registry of per-type implementations, and
//  the operator looks each row's behaviour up by its type tag. Path 1 is
//  demoted for the weight axis precisely because the ring is known
//  statically on the hot path; for the STORED type of a dynamic row it is
//  not, so path 1 is the correct — not the fallback — mechanism here.
//
//  THE REPRESENTATION — a TYPE-TAGGED KEY. An atom is `(TypeId, Canon)`:
//  an ordinal type tag plus that type's CANONICAL string rendering of the
//  value. Two consequences, both load-bearing:
//   • ONE Z-set holds rows of MANY types (`ZSet<ZAtom>` is heterogeneous)
//     while its key stays `comparison`-clean — no boxed `obj` key, no
//     registry consulted during sorting (a mutable global in the compare
//     path would make ordering depend on registration order: capture,
//     and a DST hazard). Order is a pure function of the bytes.
//   • ORDER IS A PROPERTY OF THE ENCODING, not of a per-type comparer.
//     `Int64AtomType` therefore uses an ORDER-PRESERVING encoding (biased
//     big-endian hex) so ordinal collation on the canon reproduces
//     numeric order. That is the culture-invariant treaty
//     (`.claude/rules/culture-invariant-by-default.md`) discharged by
//     construction: `Collation.binary` (codepoint order) is the ONLY
//     comparator, for every stored type.
//
//  LOUD FAILURE IS THE POINT. Every dispatch outcome is a `Result` and
//  every unroutable row lands in the error list: an unregistered type, a
//  malformed canon, an operator a type does not implement, or a per-row
//  domain failure (int64 overflow). NOTHING is silently dropped — a
//  dropped row in a dispatch layer is a data-loss landmine that presents
//  as "the query returned fewer rows", which is precisely the failure a
//  Z-set's arithmetic is supposed to make impossible.
//
//  Z-LINEARITY. Dispatch touches the KEY only; the weight rides through
//  untouched, retractions (w < 0) included. So `mapValues` is a Z-linear
//  operator — `f(a + b) = f(a) + f(b)` — and the DBSP incrementalisation
//  story is unchanged by the polymorphism. Proven in ZAtom.Tests.fs.
//
//  Anchors (Beacon): Wadler & Blott, *How to make ad-hoc polymorphism
//  less ad-hoc* (POPL 1989) — the registry IS the explicit dictionary.
//  Green, Karvounarakis & Tannen, *Provenance Semirings* (PODS 2007) —
//  the weight algebra the rows ride on. Budiu et al., *DBSP* (VLDB 2023)
//  — linearity is what makes an operator incrementalisable. Codd 1970 —
//  the stored type is data about data, so it lives IN the key.
// ═══════════════════════════════════════════════════════════════════

/// **The base atom: a type-tagged key.** `TypeId` selects the behaviour
/// (the dispatch key); `Canon` is that type's canonical, injective string
/// rendering of the value. Comparison is `Collation.binary` (codepoint /
/// UTF-8 byte order) on `TypeId` then `Canon` — explicit, so the atom
/// conforms to the collation treaty rather than inheriting F#'s
/// structural default (which is UTF-16 code-unit ordinal and diverges on
/// astral planes).
[<CustomEquality; CustomComparison>]
type ZAtom =
    { /// Ordinal tag naming the stored type. Keyed into the dispatch registry.
      TypeId: string
      /// The type's canonical rendering. MUST be injective (`decode ∘ canon = id`)
      /// — two distinct values sharing a canon would collide into one Z-set row.
      Canon: string }

    member this.CompareTo(other: ZAtom) : int =
        let c = Collation.binary.Compare(this.TypeId, other.TypeId)
        if c <> 0 then c else Collation.binary.Compare(this.Canon, other.Canon)

    interface IComparable<ZAtom> with
        member this.CompareTo(other: ZAtom) = this.CompareTo other

    interface IComparable with
        member this.CompareTo(other: obj) =
            match other with
            | :? ZAtom as that -> this.CompareTo that
            | _ -> invalidArg "other" "ZAtom can only be compared with another ZAtom"

    interface IEquatable<ZAtom> with
        member this.Equals(other: ZAtom) = this.CompareTo other = 0

    override this.Equals(other: obj) =
        match other with
        | :? ZAtom as that -> this.CompareTo that = 0
        | _ -> false

    override this.GetHashCode() =
        HashCode.Combine(
            this.TypeId.GetHashCode(StringComparison.Ordinal),
            this.Canon.GetHashCode(StringComparison.Ordinal))

    override this.ToString() = this.TypeId + ":" + this.Canon


/// **The free interface a stored type implements to join the atom.**
/// Interfaces are free; the concrete per-type implementations below are the
/// earned classes (`interfaces-free-classes-earned-under-rules`). An
/// implementation carries NO instance state — it is a dictionary of
/// behaviour, so registering one captures nothing.
type IZAtomType =
    /// The ordinal tag this implementation answers to. Stable — it is
    /// stored inside every atom of this type.
    abstract TypeId: string

    /// Is `canon` a well-formed member of this type? Guards the boundary:
    /// a canon that fails here is reported, never coerced.
    abstract IsWellFormed: canon: string -> bool

    /// The operator names this type implements, in `Collation.binary` order.
    /// Reported alongside `OperatorNotSupported` so the failure is actionable.
    abstract OperatorNames: IReadOnlyList<string>

    /// Resolve an operator: `canon -> Result<canon, reason>`. `None` when
    /// this type does not implement the named operator (a LOUD miss, not a
    /// silent identity). `Error` is a genuine per-row domain failure.
    abstract TryOperator: name: string -> (string -> Result<string, string>) option


/// Why a row could not be routed. Every case names the FACT and carries the
/// payload needed to act on it (`dual-use-detection-is-neutral-oracle-decides`:
/// the mechanism reports, the caller's policy decides what to do).
type ZDispatchError =
    /// No registered implementation for this type tag. The data-loss landmine
    /// this exists to prevent: silently skipping such a row.
    | UnregisteredType of unregisteredTypeId: string
    /// The type is registered but does not implement the requested operator.
    | OperatorNotSupported of opTypeId: string * operator: string * supported: string list
    /// The canon is not a well-formed member of its declared type.
    | MalformedAtom of malformed: ZAtom
    /// The operator ran and refused this row (overflow, domain error).
    | RowFailed of failedAtom: ZAtom * reason: string


/// The dispatch table: type tag → behaviour. Immutable and passed
/// explicitly — the Wadler–Blott dictionary made a value. No ambient
/// mutable global, so registration cannot capture the substrate and two
/// callers can run different registries over the same data (§13
/// noninterference: behaviour enters only through this declared channel).
type ZAtomRegistry =
    { Types: Map<string, IZAtomType> }


[<RequireQualifiedAccess>]
module ZAtomType =

    /// Bridge to the SCHEMA plane (`SchemaZ.fs`): the tag a `DynamicValueType`
    /// dispatches under. Exhaustive, no wildcard — a new `DynamicValueType`
    /// case breaks the build rather than silently landing in a default bucket
    /// (the doctrine `DynamicValue.fs` already states for `typeOf`).
    [<CompiledName "OfDynamicValueType">]
    let ofDynamicValueType (t: DynamicValueType) : string =
        match t with
        | DynamicValueType.Null -> "null"
        | DynamicValueType.Bool -> "bool"
        | DynamicValueType.Int -> "int"
        | DynamicValueType.Float -> "float"
        | DynamicValueType.String -> "string"
        | DynamicValueType.Bytes -> "bytes"
        | DynamicValueType.Array -> "array"
        | DynamicValueType.Object -> "object"


// ── Concrete stored type #1: int64 ────────────────────────────────────

/// **`int64` rows.** The canon is an ORDER-PRESERVING encoding: bias the
/// value by 2^63 (so the sign bit stops inverting the order) and render the
/// result as fixed-width 16-digit uppercase hex under `InvariantCulture`.
/// Consequence: codepoint order on the canon IS numeric order on the value,
/// so a heterogeneous `ZSet<ZAtom>` sorts its int rows numerically without
/// any per-type comparer — the collation treaty discharged by encoding.
///
/// Operators: `double` = `x ⊕ x` in (ℤ, +) — checked, so overflow is an
/// `Error`, never a wrapped lie; `succ` = `x + 1`, also checked. `succ`
/// deliberately has NO string counterpart: the free monoid has no successor,
/// and the dispatch reports that rather than inventing one.
[<Sealed>]
type Int64AtomType() =

    static let bias = 0x8000000000000000UL

    static let encode (v: int64) : string =
        (uint64 v ^^^ bias).ToString("X16", CultureInfo.InvariantCulture)

    static let decode (canon: string) : Result<int64, string> =
        match UInt64.TryParse(canon, NumberStyles.HexNumber, CultureInfo.InvariantCulture) with
        | true, u -> Ok(int64 (u ^^^ bias))
        | _ -> Error("not a 16-digit hex int64 canon: " + canon)

    static let isHexDigit (c: char) =
        (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')

    static let lift (name: string) (f: int64 -> int64) : string -> Result<string, string> =
        fun canon ->
            match decode canon with
            | Error e -> Error e
            | Ok v ->
                try Ok(encode (f v))
                with :? OverflowException -> Error(name + " overflows int64 at " + v.ToString(CultureInfo.InvariantCulture))

    static let ops: Map<string, string -> Result<string, string>> =
        Map.ofList
            [ "double", lift "double" (fun v -> Checked.(*) 2L v)
              "succ", lift "succ" (fun v -> Checked.(+) v 1L) ]

    /// The shared singleton — stateless, so one instance is the whole type.
    static member val Instance = Int64AtomType() :> IZAtomType

    /// Encode an `int64` as an atom.
    static member Atom(v: int64) : ZAtom =
        { TypeId = ZAtomType.ofDynamicValueType DynamicValueType.Int; Canon = encode v }

    /// Decode an atom's canon back to its `int64`. `Error` when malformed —
    /// the injectivity claim is checkable, not asserted.
    static member Value(a: ZAtom) : Result<int64, string> = decode a.Canon

    interface IZAtomType with
        member _.TypeId = ZAtomType.ofDynamicValueType DynamicValueType.Int

        member _.IsWellFormed(canon: string) =
            not (isNull canon) && canon.Length = 16 && Seq.forall isHexDigit canon

        member _.OperatorNames =
            (ops |> Map.toList |> List.map fst |> List.sortWith (fun a b -> Collation.binary.Compare(a, b)))
            :> IReadOnlyList<string>

        member _.TryOperator(name: string) = Map.tryFind name ops


// ── Concrete stored type #2: string ───────────────────────────────────

/// **`string` rows.** The canon is the string itself — codepoint order on the
/// canon is already the treaty order, so no encoding is needed. This is the
/// GENUINE second specialisation, not a re-skin of the first: a different
/// canon (identity vs biased hex), a different well-formedness test, a
/// different operator set, and a different algebra behind the shared name.
///
/// Operator: `double` = `x ⊕ x` in the FREE MONOID Σ* — i.e. `s + s`. Same
/// abstract "double it in this type's monoid" as the int64 case; entirely
/// different implementation and failure profile (concatenation is total —
/// the string type has no overflow to report). `succ` is absent by design.
[<Sealed>]
type StringAtomType() =

    static let ops: Map<string, string -> Result<string, string>> =
        Map.ofList [ "double", (fun (s: string) -> Ok(s + s)) ]

    /// The shared singleton — stateless.
    static member val Instance = StringAtomType() :> IZAtomType

    /// Encode a `string` as an atom.
    static member Atom(s: string) : ZAtom =
        { TypeId = ZAtomType.ofDynamicValueType DynamicValueType.String; Canon = s }

    /// Decode an atom's canon back to its `string` (the identity canon).
    static member Value(a: ZAtom) : Result<string, string> = Ok a.Canon

    interface IZAtomType with
        member _.TypeId = ZAtomType.ofDynamicValueType DynamicValueType.String

        member _.IsWellFormed(canon: string) = not (isNull canon)

        member _.OperatorNames =
            (ops |> Map.toList |> List.map fst |> List.sortWith (fun a b -> Collation.binary.Compare(a, b)))
            :> IReadOnlyList<string>

        member _.TryOperator(name: string) = Map.tryFind name ops


[<RequireQualifiedAccess>]
module ZAtomRegistry =

    /// The empty dictionary — dispatches nothing, and says so loudly.
    [<CompiledName "Empty">]
    let empty: ZAtomRegistry = { Types = Map.empty }

    /// Add an implementation. A duplicate `TypeId` is an `Error`, never a
    /// last-writer-wins overwrite: two implementations for one tag is an
    /// unresolved ambiguity, and quietly picking one is how a stored proc
    /// starts returning a different answer after an unrelated deploy.
    [<CompiledName "Register">]
    let register (t: IZAtomType) (reg: ZAtomRegistry) : Result<ZAtomRegistry, string> =
        if reg.Types.ContainsKey t.TypeId then
            Error("duplicate registration for type id '" + t.TypeId + "'")
        else
            Ok { Types = reg.Types.Add(t.TypeId, t) }

    /// Build a registry from a list, failing on the first duplicate.
    [<CompiledName "OfTypes">]
    let ofTypes (ts: IZAtomType seq) : Result<ZAtomRegistry, string> =
        ts
        |> Seq.fold
            (fun acc t ->
                match acc with
                | Error e -> Error e
                | Ok r -> register t r)
            (Ok empty)

    /// The two shipped implementations. Named `standard`, not `default` —
    /// a caller may always pass a narrower or wider dictionary.
    [<CompiledName "Standard">]
    let standard: ZAtomRegistry =
        match ofTypes [ Int64AtomType.Instance; StringAtomType.Instance ] with
        | Ok r -> r
        | Error e ->
            // Unreachable: the two shipped tags differ. Fail at type-init
            // rather than hand back a half-built dictionary.
            failwith ("standard ZAtom registry is inconsistent: " + e)

    [<CompiledName "TryFind">]
    let tryFind (typeId: string) (reg: ZAtomRegistry) : IZAtomType option = Map.tryFind typeId reg.Types

    /// Registered tags in `Collation.binary` order — deterministic, so a
    /// report of the registry replays byte-identically.
    [<CompiledName "TypeIds">]
    let typeIds (reg: ZAtomRegistry) : string list =
        reg.Types |> Map.toList |> List.map fst |> List.sortWith (fun a b -> Collation.binary.Compare(a, b))

    /// **Composition with the schema plane** (`SchemaZ.fs`, the sibling
    /// increment): every field type the schema declares must have a
    /// registered implementation, or a stored proc over rows of that schema
    /// WILL meet an unroutable row at runtime. Checks the promise up front
    /// instead of discovering it per row. Errors are deduplicated and sorted.
    [<CompiledName "Coverage">]
    let coverage (reg: ZAtomRegistry) (schema: SchemaZ) : Result<unit, ZDispatchError list> =
        let missing =
            SchemaZ.fields schema
            |> List.map (fun f -> ZAtomType.ofDynamicValueType f.Type)
            |> List.filter (fun tid -> not (reg.Types.ContainsKey tid))
            |> List.distinct
            |> List.sortWith (fun a b -> Collation.binary.Compare(a, b))
        if List.isEmpty missing then Ok() else Error(missing |> List.map UnregisteredType)


/// **The dispatched operator surface.** One set of functions over
/// `ZSet<ZAtom>`; the behaviour is chosen per row by the registry. This is
/// the shape a stored procedure compiles to: the plan names an operator,
/// the rows name their types, and the dictionary joins them.
[<RequireQualifiedAccess>]
module ZAtomDispatch =

    /// Routing WITHOUT executing anything: which implementation each distinct
    /// row resolves to. `Error` lists every unroutable tag — the honest answer
    /// to "can this Z-set be processed at all". Deterministic: rows are visited
    /// in the Z-set's sorted key order.
    [<CompiledName "Validate">]
    let validate (reg: ZAtomRegistry) (z: ZSet<ZAtom>) : Result<unit, ZDispatchError list> =
        let errors =
            [ for e in z do
                match ZAtomRegistry.tryFind e.Key.TypeId reg with
                | None -> yield UnregisteredType e.Key.TypeId
                | Some t -> if not (t.IsWellFormed e.Key.Canon) then yield MalformedAtom e.Key ]
            |> List.distinct
        if List.isEmpty errors then Ok() else Error errors

    /// **THE dispatched operator.** Apply the named operator to every row,
    /// routing each to its registered implementation and carrying the weight
    /// through UNCHANGED — so this is Z-LINEAR (`f(a+b) = f(a)+f(b)`) and
    /// retractions (`w < 0`) survive dispatch intact.
    ///
    /// All-or-nothing: if ANY row fails, the whole call is `Error` with every
    /// distinct failure listed. A partial result would be a silent drop
    /// wearing an `Ok`.
    ///
    /// Two rows whose images collide consolidate by Z-set sum, exactly as
    /// `ZSet.map` does — dispatch adds no new merge rule.
    [<CompiledName "MapValues">]
    let mapValues (reg: ZAtomRegistry) (operator: string) (z: ZSet<ZAtom>) : Result<ZSet<ZAtom>, ZDispatchError list> =
        let mutable errors = []
        let mapped = ResizeArray<ZAtom * Weight>(z.Count)
        for e in z do
            let atom = e.Key
            match ZAtomRegistry.tryFind atom.TypeId reg with
            | None -> errors <- UnregisteredType atom.TypeId :: errors
            | Some t ->
                if not (t.IsWellFormed atom.Canon) then
                    errors <- MalformedAtom atom :: errors
                else
                    match t.TryOperator operator with
                    | None ->
                        errors <-
                            OperatorNotSupported(atom.TypeId, operator, List.ofSeq t.OperatorNames)
                            :: errors
                    | Some f ->
                        match f atom.Canon with
                        | Error reason -> errors <- RowFailed(atom, reason) :: errors
                        | Ok canon' -> mapped.Add({ atom with Canon = canon' }, e.Weight)
        if not (List.isEmpty errors) then
            Error(errors |> List.rev |> List.distinct)
        else
            Ok(ZSet.ofSeq mapped)

    /// The ROUTING FACT on its own: the Z-set split by type tag, weights
    /// preserved and summing back to the input (`sum (map snd) = z`). Neutral —
    /// it reports where rows would go, and takes no view on whether an
    /// unregistered tag is a bug or a type this caller simply does not handle.
    /// Ordered by tag in `Collation.binary` order.
    [<CompiledName "PartitionByType">]
    let partitionByType (z: ZSet<ZAtom>) : (string * ZSet<ZAtom>) list =
        [ for e in z -> e.Key, e.Weight ]
        |> List.groupBy (fun (k, _) -> k.TypeId)
        |> List.map (fun (tid, rows) -> tid, ZSet.ofSeq rows)
        |> List.sortWith (fun (a, _) (b, _) -> Collation.binary.Compare(a, b))
