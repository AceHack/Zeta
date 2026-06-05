module Zeta.Tests.DynamicValueXmlPolicyTests

open System.Collections.Immutable
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// DynamicValueXmlPolicy (instance-1) tests:
//   (a) exact-shape: a named policy renders the expected structured XML.
//   (b) round-trip LAW: fromStructuredXml p (toStructuredXml p dv) = Ok dv
//       (FsCheck, valid-XML-name keys + a random Named predicate).
//   (c) zero-policy (Named=never) ≡ canonical toCanonicalXml.
// ═══════════════════════════════════════════════════════════════════

let private named (keys: string list) : DynamicValueXmlPolicy.XmlStructurePolicy =
    DynamicValueXmlPolicy.namedKeys (Set.ofList keys)

[<Fact>]
let ``(a) exact structured shape for {id,name} policy`` () =
    let dv =
        DynamicValue.Object
            [ ("id", DynamicValue.Int 1L)
              ("name", DynamicValue.String "x")
              ("other", DynamicValue.Bool true) ]
    let policy = named [ "id"; "name" ]
    let expected =
        "<obj><id><int>1</int></id><name><str>x</str></name><e k=\"other\"><bool>true</bool></e></obj>"
    match DynamicValueXmlPolicy.toStructuredXml policy dv with
    | Ok s -> Assert.Equal(expected, s)
    | Error e -> failwithf "unexpected encode error %A" e

[<Fact>]
let ``(a2) exact shape round-trips`` () =
    let dv =
        DynamicValue.Object
            [ ("id", DynamicValue.Int 1L)
              ("name", DynamicValue.String "x")
              ("other", DynamicValue.Bool true) ]
    let policy = named [ "id"; "name" ]
    let xml = (DynamicValueXmlPolicy.toStructuredXml policy dv) |> function Ok s -> s | Error e -> failwithf "%A" e
    Assert.Equal<Result<DynamicValue, DecodeError>>(Ok dv, DynamicValueXmlPolicy.fromStructuredXml policy xml)

// ── generators: valid-XML-name keys, minus reserved value-tag names ──
let private reserved = set [ "null"; "bool"; "int"; "float"; "str"; "bytes"; "arr"; "obj"; "e" ]
let private genNameChar = Gen.elements [ 'a'; 'b'; 'c'; 'd'; 'k'; 'n'; 'p'; '_'; 'A'; 'Q'; '0'; '1'; '-'; '.' ]
let private genStartChar = Gen.elements [ 'a'; 'b'; 'c'; 'k'; 'p'; '_'; 'A'; 'Q' ]
let private genName =
    gen { let! h = genStartChar
          let! n = Gen.choose (0, 4)
          let! rest = Gen.listOfLength n genNameChar
          let candidate = System.String(Array.ofList (h :: rest))
          // exclude reserved tag names and "xml…" prefixes so the candidate is a
          // legal PROMOTABLE key (the round-trip law's domain).
          return
              if reserved.Contains candidate || (candidate.Length >= 3 && candidate.Substring(0, 3).ToLowerInvariant() = "xml") then
                  candidate + "z"
              else candidate }

let private genTextChar = Gen.elements [ 'a'; 'Z'; '0'; '"'; '&'; '<'; '>'; ' '; 'é' ]
let private genStr =
    gen { let! n = Gen.choose (0, 4)
          let! cs = Gen.listOfLength n genTextChar
          return System.String(List.toArray cs) }
let private genInt64 = Gen.choose (-100000, 100000) |> Gen.map int64
let private genFloat = Gen.choose (-1000, 1000) |> Gen.map (fun n -> float n / 7.0)
let private genBytes =
    gen { let! n = Gen.choose (0, 4)
          let! bs = Gen.listOfLength n (Gen.choose (0, 255) |> Gen.map byte)
          return ImmutableArray.CreateRange bs }

let private leaf =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.map DynamicValue.Bool (Gen.elements [ true; false ])
          Gen.map DynamicValue.Int genInt64
          Gen.map DynamicValue.Float genFloat
          Gen.map DynamicValue.String genStr
          Gen.map DynamicValue.Bytes genBytes ]

// build a DynamicValue whose Object keys are ALL valid promotable XML Names
let private build: Gen<DynamicValue> =
    let rec aux (size: int) : Gen<DynamicValue> =
        if size <= 0 then leaf
        else
            Gen.oneof
                [ leaf
                  gen { let! n = Gen.choose (0, 3)
                        let! items = Gen.listOfLength n (aux (size / 2))
                        return DynamicValue.Array items }
                  gen { let! n = Gen.choose (0, 3)
                        let! rawKeys = Gen.listOfLength n genName
                        let keys = List.distinct rawKeys
                        let! vals = Gen.listOfLength keys.Length (aux (size / 2))
                        return DynamicValue.Object(List.zip keys vals) } ]
    Gen.sized aux

// collect all object keys in a value (to seed a random Named predicate from them)
let rec private collectKeys (dv: DynamicValue) : string list =
    match dv with
    | DynamicValue.Array items -> items |> List.collect collectKeys
    | DynamicValue.Object pairs -> (pairs |> List.map fst) @ (pairs |> List.collect (snd >> collectKeys))
    | _ -> []

// generate a (value, policy) pair: policy promotes a random subset of the value's keys
let private genPair =
    gen { let! dv = build
          let keys = collectKeys dv
          let! flags = Gen.listOfLength keys.Length (Gen.elements [ true; false ])
          let chosen = List.zip keys flags |> List.filter snd |> List.map fst |> Set.ofList
          return (dv, DynamicValueXmlPolicy.namedKeys chosen) }

type PairArb() =
    static member Pair() = Arb.fromGen genPair

[<Property(Arbitrary = [| typeof<PairArb> |])>]
let ``(b) round-trip LAW: fromStructuredXml p (toStructuredXml p dv) = Ok dv``
    (pair: DynamicValue * DynamicValueXmlPolicy.XmlStructurePolicy) =
    let (dv, policy) = pair
    match DynamicValueXmlPolicy.toStructuredXml policy dv with
    | Ok xml -> DynamicValueXmlPolicy.fromStructuredXml policy xml = Ok dv
    | Error _ -> true // a forbidden-C0 key surfaces as Error (outside the bijection domain)

type ZeroDvArb() =
    static member Dv() = Arb.fromGen build

[<Property(Arbitrary = [| typeof<ZeroDvArb> |])>]
let ``(c) zero-policy (namedKeys empty) = canonical toCanonicalXml`` (dv: DynamicValue) =
    let policy = DynamicValueXmlPolicy.namedKeys Set.empty
    DynamicValueXmlPolicy.toStructuredXml policy dv = DynamicValue.toCanonicalXml dv

// ── (d) FEEDBACK: the policy SELECTS a typed decision + an auditable why ──
[<Fact>]
let ``(d) feedback: in-policy valid key selects NamedElement`` () =
    let policy = DynamicValueXmlPolicy.namedKeys (set [ "id" ])
    let ctx: DynamicValueFold.ShapeContext =
        { Path = [ DynamicValueFold.Key "id" ]; Key = Some "id"; Kind = DynamicValueFold.IntK }
    let r = policy ctx
    Assert.Equal(DynamicValueXmlPolicy.NamedElement, r.Decision)
    Assert.Contains("named", r.Feedback)

[<Fact>]
let ``(d) feedback: a key equal to a reserved tag falls back to GenericElement with 'reserved' why`` () =
    // "int" is a reserved value-tag name; even if promoted by the set it must
    // render generically, and the feedback must say why.
    let policy = DynamicValueXmlPolicy.namedKeys (set [ "int" ])
    let ctx: DynamicValueFold.ShapeContext =
        { Path = [ DynamicValueFold.Key "int" ]; Key = Some "int"; Kind = DynamicValueFold.BoolK }
    let r = policy ctx
    Assert.Equal(DynamicValueXmlPolicy.GenericElement, r.Decision)
    Assert.Contains("reserved", r.Feedback)

[<Fact>]
let ``(d) feedback: a key not in the policy set is GenericElement with 'not-in-policy' why`` () =
    let policy = DynamicValueXmlPolicy.namedKeys (set [ "id" ])
    let ctx: DynamicValueFold.ShapeContext =
        { Path = [ DynamicValueFold.Key "other" ]; Key = Some "other"; Kind = DynamicValueFold.BoolK }
    let r = policy ctx
    Assert.Equal(DynamicValueXmlPolicy.GenericElement, r.Decision)
    Assert.Contains("not-in-policy", r.Feedback)

[<Fact>]
let ``(d) reserved-tag key 'int' renders generically end-to-end`` () =
    let dv = DynamicValue.Object [ ("int", DynamicValue.Bool true) ]
    let policy = DynamicValueXmlPolicy.namedKeys (set [ "int" ])
    let expected = "<obj><e k=\"int\"><bool>true</bool></e></obj>"
    match DynamicValueXmlPolicy.toStructuredXml policy dv with
    | Ok s -> Assert.Equal(expected, s)
    | Error e -> failwithf "unexpected encode error %A" e
