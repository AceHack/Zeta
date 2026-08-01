module Zeta.Tests.Algebra.ZAtomTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// ZAtom — open-generics dispatch over the polymorphic Z-set base atom
// (081KYWE8Q3508QG0R000KZ5PWR, increment 1).
//
// Three law families, in the order they matter:
//  1. DISPATCH IS HONEST — every row reaches its registered implementation,
//     and every row that cannot be routed is REPORTED. The load-bearing
//     test is the negative one: an unregistered type must never be
//     silently dropped (that failure mode presents as "the query returned
//     fewer rows" and is exactly the data-loss landmine this layer exists
//     to close).
//  2. Z-LINEARITY — dispatch touches the key, never the weight, so
//     `f(a + b) = f(a) + f(b)` and retractions (w < 0) survive intact.
//     Linearity is what keeps a dispatched operator incrementalisable
//     (Budiu et al., DBSP, VLDB 2023).
//  3. DETERMINISM / DST — the result is a pure function of the row SET,
//     independent of insertion order, and replays byte-identically.
// ═══════════════════════════════════════════════════════════════════

let private i (v: int64) = Int64AtomType.Atom v
let private s (v: string) = StringAtomType.Atom v
let private reg = ZAtomRegistry.standard

/// A tag with no registered implementation — the unroutable row.
let private alien (canon: string) : ZAtom = { TypeId = "float"; Canon = canon }

// Small generators: values from a bounded pool so keys collide (collisions
// are where the consolidation arithmetic earns its keep), weights signed so
// retractions occur.
type private AtomArb =
    static member ZAtom() =
        gen {
            let! which = Gen.choose (0, 1)
            if which = 0 then
                let! v = Gen.elements [ -3L; -1L; 0L; 1L; 2L; 7L ]
                return i v
            else
                let! t = Gen.elements [ ""; "a"; "b"; "ab"; "zz" ]
                return s t
        }
        |> Arb.fromGen

    static member AtomZSet() =
        gen {
            let! rows =
                Gen.listOf (
                    gen {
                        let! a = AtomArb.ZAtom().Generator
                        let! w = Gen.elements [ -2L; -1L; 1L; 2L; 3L ]
                        return a, w
                    }
                )
            return ZSet.ofSeq rows
        }
        |> Arb.fromGen

// ── 0. The representation: canonical, injective, order-preserving ────

[<Property>]
let ``int64 canon round-trips: decode (Atom v) = v`` (v: int64) =
    Int64AtomType.Value(i v) = Ok v

[<Property>]
let ``string canon round-trips`` (NonNull (v: string)) = StringAtomType.Value(s v) = Ok v

[<Property>]
let ``int64 encoding is ORDER-PRESERVING: codepoint order on the canon IS numeric order`` (a: int64) (b: int64) =
    let byCanon = compare ((i a).CompareTo(i b)) 0
    let byValue = compare (compare a b) 0
    byCanon = byValue

[<Fact>]
let ``the two type tags are distinct and the atom sorts by tag first`` () =
    Assert.NotEqual<string>((i 1L).TypeId, (s "1").TypeId)
    // "int" < "string" in codepoint order, so every int row precedes every string row.
    Assert.True((i System.Int64.MaxValue).CompareTo(s "") < 0)

// ── 1. Dispatch correctness ──────────────────────────────────────────

[<Fact>]
let ``heterogeneous ZSet routes each row to ITS registered handler`` () =
    // Same operator name, two genuinely different algebras behind it:
    // int64 `double` = 2x in (Z,+); string `double` = s + s in the free monoid.
    let z = ZSet.ofSeq [ i 5L, 1L; s "ab", 1L; i -2L, 1L ]
    match ZAtomDispatch.mapValues reg "double" z with
    | Error e -> failwithf "expected Ok, got %A" e
    | Ok out ->
        Assert.Equal(3, out.Count)
        Assert.Equal(1L, out.[i 10L])
        Assert.Equal(1L, out.[s "abab"])
        Assert.Equal(1L, out.[i -4L])

[<Fact>]
let ``the two implementations are genuinely different, not one type twice`` () =
    // If `string.double` were secretly the int64 implementation (or vice versa)
    // these would agree. They must not: 12 doubles to 24, "12" doubles to "1212".
    let z = ZSet.ofSeq [ i 12L, 1L; s "12", 1L ]
    match ZAtomDispatch.mapValues reg "double" z with
    | Error e -> failwithf "expected Ok, got %A" e
    | Ok out ->
        Assert.Equal(1L, out.[i 24L])
        Assert.Equal(1L, out.[s "1212"])
        Assert.Equal(0L, out.[s "24"])
        // Different operator SETS too — `succ` exists only where a successor does.
        Assert.True((Int64AtomType.Instance.TryOperator "succ").IsSome)
        Assert.True((StringAtomType.Instance.TryOperator "succ").IsNone)

[<Fact>]
let ``UNREGISTERED type FAILS LOUDLY — never a silent drop`` () =
    let z = ZSet.ofSeq [ i 1L, 1L; alien "3.5", 1L ]
    match ZAtomDispatch.mapValues reg "double" z with
    | Ok out -> failwithf "unregistered row was silently processed: %A" out
    | Error errs -> Assert.Equal<ZDispatchError list>([ UnregisteredType "float" ], errs)

[<Fact>]
let ``an unregistered row cannot hide behind registered rows that all succeed`` () =
    // The regression guard: a per-row `choose`-style implementation would
    // return Ok with 2 rows here and lose the third without a word.
    let z = ZSet.ofSeq [ i 1L, 1L; s "a", 1L; alien "x", 5L ]
    Assert.True(ZAtomDispatch.mapValues reg "double" z |> Result.isError)
    Assert.True(ZAtomDispatch.validate reg z |> Result.isError)

[<Fact>]
let ``validate accepts a fully-routable ZSet and reports every unroutable tag`` () =
    let good = ZSet.ofSeq [ i 1L, 1L; s "a", -1L ]
    Assert.Equal<Result<unit, ZDispatchError list>>(Ok(), ZAtomDispatch.validate reg good)

    let bad = ZSet.ofSeq [ alien "a", 1L; { TypeId = "bytes"; Canon = "00" }, 1L; i 1L, 1L ]
    match ZAtomDispatch.validate reg bad with
    | Ok () -> failwith "expected both alien tags to be reported"
    | Error errs ->
        Assert.Contains(UnregisteredType "float", errs)
        Assert.Contains(UnregisteredType "bytes", errs)

[<Fact>]
let ``an operator a type does not implement FAILS LOUDLY, listing what it does implement`` () =
    let z = ZSet.ofSeq [ i 1L, 1L; s "a", 1L ]
    match ZAtomDispatch.mapValues reg "succ" z with
    | Ok _ -> failwith "string has no successor; expected a loud miss"
    | Error errs ->
        Assert.Equal<ZDispatchError list>([ OperatorNotSupported("string", "succ", [ "double" ]) ], errs)

[<Fact>]
let ``a MALFORMED canon is reported, never coerced`` () =
    let bogus = { TypeId = "int"; Canon = "not-hex" }
    match ZAtomDispatch.mapValues reg "double" (ZSet.ofSeq [ bogus, 1L ]) with
    | Ok _ -> failwith "expected the malformed canon to be reported"
    | Error errs -> Assert.Equal<ZDispatchError list>([ MalformedAtom bogus ], errs)

[<Fact>]
let ``a per-row DOMAIN failure (int64 overflow) is reported, never wrapped`` () =
    let big = i (System.Int64.MaxValue / 2L + 1L)
    match ZAtomDispatch.mapValues reg "double" (ZSet.ofSeq [ big, 1L ]) with
    | Ok out -> failwithf "checked doubling must overflow, got %A" out
    | Error [ RowFailed (a, _) ] -> Assert.Equal<ZAtom>(big, a)
    | Error e -> failwithf "expected exactly one RowFailed, got %A" e

// ── 2. Z-linearity: the weight rides through untouched ───────────────

[<Property(Arbitrary = [| typeof<AtomArb> |])>]
let ``Z-LINEAR: mapValues (a + b) = mapValues a + mapValues b`` (a: ZSet<ZAtom>) (b: ZSet<ZAtom>) =
    match ZAtomDispatch.mapValues reg "double" (a + b),
          ZAtomDispatch.mapValues reg "double" a,
          ZAtomDispatch.mapValues reg "double" b with
    | Ok ab, Ok fa, Ok fb -> ab = fa + fb
    | _ -> false

[<Property(Arbitrary = [| typeof<AtomArb> |])>]
let ``weights survive dispatch EXACTLY, retractions included`` (z: ZSet<ZAtom>) =
    match ZAtomDispatch.mapValues reg "double" z with
    | Error _ -> false
    | Ok out ->
        // `double` is injective on both types, so no two rows collide and the
        // weight multiset is preserved element-for-element.
        ZSet.weightedCount out = ZSet.weightedCount z && out.Count = z.Count

[<Fact>]
let ``a retraction dispatches to the retraction of the image`` () =
    let z = ZSet.ofSeq [ i 5L, 3L; s "a", -2L ]
    match ZAtomDispatch.mapValues reg "double" z with
    | Error e -> failwithf "expected Ok, got %A" e
    | Ok out ->
        Assert.Equal(3L, out.[i 10L])
        Assert.Equal(-2L, out.[s "aa"])

[<Property(Arbitrary = [| typeof<AtomArb> |])>]
let ``dispatch commutes with negation: f(-z) = -f(z)`` (z: ZSet<ZAtom>) =
    match ZAtomDispatch.mapValues reg "double" (-z), ZAtomDispatch.mapValues reg "double" z with
    | Ok fneg, Ok fz -> fneg = -fz
    | _ -> false

[<Fact>]
let ``emit then retract annihilates THROUGH dispatch`` () =
    let z = ZSet.ofSeq [ i 4L, 1L; s "q", 1L ]
    match ZAtomDispatch.mapValues reg "double" (z + (-z)) with
    | Error e -> failwithf "expected Ok, got %A" e
    | Ok out -> Assert.True(ZSet.isEmpty out)

// ── 3. Determinism / DST ─────────────────────────────────────────────

[<Property(Arbitrary = [| typeof<AtomArb> |])>]
let ``DETERMINISTIC: same input ZSet gives the same output, every time`` (z: ZSet<ZAtom>) =
    ZAtomDispatch.mapValues reg "double" z = ZAtomDispatch.mapValues reg "double" z

[<Fact>]
let ``ORDER-INDEPENDENT: insertion order of the rows does not change the result`` () =
    let rows = [ i 1L, 2L; s "b", -1L; i -7L, 1L; s "a", 4L ]
    let forward = ZAtomDispatch.mapValues reg "double" (ZSet.ofSeq rows)
    let reversed = ZAtomDispatch.mapValues reg "double" (ZSet.ofSeq (List.rev rows))
    Assert.Equal<Result<ZSet<ZAtom>, ZDispatchError list>>(forward, reversed)

[<Fact>]
let ``the ERROR report is deterministic and deduplicated`` () =
    let z = ZSet.ofSeq [ alien "a", 1L; alien "b", 1L; alien "c", 1L; i 1L, 1L ]
    let once = ZAtomDispatch.mapValues reg "double" z
    Assert.Equal<Result<ZSet<ZAtom>, ZDispatchError list>>(once, ZAtomDispatch.mapValues reg "double" z)
    match once with
    | Error errs -> Assert.Equal<ZDispatchError list>([ UnregisteredType "float" ], errs)
    | Ok _ -> failwith "expected an error"

// ── 4. Routing as a neutral fact: partition ──────────────────────────

[<Property(Arbitrary = [| typeof<AtomArb> |])>]
let ``partitionByType loses nothing: the parts sum back to the whole`` (z: ZSet<ZAtom>) =
    (ZAtomDispatch.partitionByType z |> List.map snd |> ZSet.sum) = z

[<Fact>]
let ``partitionByType groups by tag in binary-collation order`` () =
    let z = ZSet.ofSeq [ s "x", 1L; i 1L, 1L; alien "z", 1L ]
    Assert.Equal<string list>([ "float"; "int"; "string" ], ZAtomDispatch.partitionByType z |> List.map fst)

// ── 5. The registry itself ───────────────────────────────────────────

[<Fact>]
let ``a DUPLICATE registration is an error, never last-writer-wins`` () =
    Assert.True(ZAtomRegistry.ofTypes [ Int64AtomType.Instance; Int64AtomType.Instance ] |> Result.isError)

[<Fact>]
let ``the standard registry carries exactly the two shipped types`` () =
    Assert.Equal<string list>([ "int"; "string" ], ZAtomRegistry.typeIds reg)

[<Fact>]
let ``the empty registry routes NOTHING and says so`` () =
    let z = ZSet.ofSeq [ i 1L, 1L ]
    match ZAtomDispatch.mapValues ZAtomRegistry.empty "double" z with
    | Ok _ -> failwith "the empty dictionary cannot route anything"
    | Error errs -> Assert.Equal<ZDispatchError list>([ UnregisteredType "int" ], errs)

[<Fact>]
let ``a NARROWER registry is honest about what it dropped support for`` () =
    // Dictionary-passing means two callers may hold different dictionaries over
    // the same data — and the narrower one must SAY so, not quietly skip.
    let intsOnly =
        match ZAtomRegistry.ofTypes [ Int64AtomType.Instance ] with
        | Ok r -> r
        | Error e -> failwith e
    match ZAtomDispatch.mapValues intsOnly "double" (ZSet.ofSeq [ i 2L, 1L; s "a", 1L ]) with
    | Ok _ -> failwith "expected the string row to be reported"
    | Error errs -> Assert.Equal<ZDispatchError list>([ UnregisteredType "string" ], errs)

// ── 6. Composition with the schema plane (SchemaZ.fs) ────────────────

[<Fact>]
let ``coverage: a schema whose field types are all registered passes`` () =
    let schema =
        SchemaZ.ofFields
            [ { Name = "id"; Type = DynamicValueType.Int }
              { Name = "name"; Type = DynamicValueType.String } ]
    Assert.Equal<Result<unit, ZDispatchError list>>(Ok(), ZAtomRegistry.coverage reg schema)

[<Fact>]
let ``coverage: a schema declaring an unregistered field type FAILS UP FRONT`` () =
    // Catching this at schema level beats meeting it per row inside a stored proc.
    let schema =
        SchemaZ.ofFields
            [ { Name = "id"; Type = DynamicValueType.Int }
              { Name = "score"; Type = DynamicValueType.Float }
              { Name = "blob"; Type = DynamicValueType.Bytes } ]
    match ZAtomRegistry.coverage reg schema with
    | Ok () -> failwith "float and bytes have no registered implementation"
    | Error errs ->
        Assert.Equal<ZDispatchError list>([ UnregisteredType "bytes"; UnregisteredType "float" ], errs)

[<Fact>]
let ``coverage tracks the schema LOG's fold, so a dropped field stops being required`` () =
    // Schema evolution is events on the Z-set (SchemaZ / SchemaLog); the
    // dispatch requirement is a function of the FOLD, not of the log's history.
    let log =
        [ SchemaEvent.create "e1" (AddField { Name = "id"; Type = DynamicValueType.Int })
          SchemaEvent.create "e2" (AddField { Name = "score"; Type = DynamicValueType.Float })
          SchemaEvent.create "e3" (DropField { Name = "score"; Type = DynamicValueType.Float }) ]
    Assert.True(ZAtomRegistry.coverage reg (SchemaLog.at 2 log) |> Result.isError)
    Assert.Equal<Result<unit, ZDispatchError list>>(Ok(), ZAtomRegistry.coverage reg (SchemaLog.current log))
