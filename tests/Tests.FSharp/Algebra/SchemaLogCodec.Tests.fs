module Zeta.Tests.Algebra.SchemaLogCodecTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// SchemaLogCodec — canonical persistence for the schema event log
// (081KYWE8Q4008QG0R000H558SH, increment 2).
//
// Law families:
//  1. ROUND-TRIP — `decode (encode log) = Ok log`, quantified over logs
//     whose names/ids include every separator and escape character the
//     format uses (injectivity is exercised, not assumed).
//  2. GOLDEN VECTORS — the exact BYTES of a fixed log are locked. A
//     drifted encoder fails these literals; other oracles (C#/TS/Rust)
//     replay the same strings for cross-language parity.
//  3. LOUD DECODE — header mismatch, unknown ops/types, wrong arity,
//     dangling escapes: every offence reported with its line number,
//     all-or-nothing, nothing skipped.
//  4. STREAMED DEDUPE — `dedupe = List.ofSeq ∘ dedupeStream` (the
//     materialised and streamed forms are ONE semantics), first
//     occurrence wins, and the stream is genuinely lazy.
// ═══════════════════════════════════════════════════════════════════

let private ev id op = SchemaEvent.create id op
let private fid n t : FieldId = { Name = n; Type = t }

// Adversarial string pool: every character the escaping must carry.
let private nastyStrings =
    [ ""; "a"; "count"; "with\ttab"; "with\nnewline"; "with\rcr"; "back\\slash"; "\\t"; "π-héĺĺo"; "trailing\\" ]

type private LogArb =
    static member private GenType: Gen<DynamicValueType> =
        Gen.elements
            [ DynamicValueType.Null
              DynamicValueType.Bool
              DynamicValueType.Int
              DynamicValueType.Float
              DynamicValueType.String
              DynamicValueType.Bytes
              DynamicValueType.Array
              DynamicValueType.Object ]

    static member private GenOp: Gen<SchemaOp> =
        gen {
            let! which = Gen.choose (0, 3)
            let! name = Gen.elements nastyStrings
            let! t = LogArb.GenType
            match which with
            | 0 -> return AddField(fid name t)
            | 1 -> return DropField(fid name t)
            | 2 ->
                let! toName = Gen.elements nastyStrings
                return RenameField(name, toName, t)
            | _ ->
                let! t2 = LogArb.GenType
                return RetypeField(name, t, t2)
        }

    static member SchemaLog() : Arbitrary<SchemaLog> =
        gen {
            let! events =
                Gen.listOf (
                    gen {
                        let! id = Gen.elements nastyStrings
                        let! op = LogArb.GenOp
                        return ev id op
                    }
                )
            return events
        }
        |> Arb.fromGen

// ── 1. Round-trip ────────────────────────────────────────────────────

[<Property(Arbitrary = [| typeof<LogArb> |])>]
let ``ROUND-TRIP: decode (encode log) = Ok log — separators and escapes included`` (log: SchemaLog) =
    SchemaLogCodec.decode (SchemaLogCodec.encode log) = Ok log

[<Property(Arbitrary = [| typeof<LogArb> |])>]
let ``the persisted form folds to the same schema as the live log`` (log: SchemaLog) =
    match SchemaLogCodec.decode (SchemaLogCodec.encode log) with
    | Ok decoded -> SchemaLog.current decoded = SchemaLog.current log
    | Error e -> failwithf "round-trip failed: %A" e

[<Property(Arbitrary = [| typeof<LogArb> |])>]
let ``encode is deterministic: same log, same bytes`` (log: SchemaLog) =
    SchemaLogCodec.encode log = SchemaLogCodec.encode log

// ── 2. Golden vectors (cross-oracle byte lock) ───────────────────────

/// The fixed reference log every oracle replays.
let private goldenLog: SchemaLog =
    [ ev "081K-EV1" (AddField(fid "count" DynamicValueType.Int))
      ev "081K-EV2" (AddField(fid "label" DynamicValueType.String))
      ev "081K-EV3" (RenameField("label", "title", DynamicValueType.String))
      ev "081K-EV4" (RetypeField("count", DynamicValueType.Int, DynamicValueType.Float))
      ev "081K-EV5" (DropField(fid "title" DynamicValueType.String))
      // adversarial: separators inside names/ids must survive the wire
      ev "id\twith\ttabs" (AddField(fid "name\nwith\nnewlines" DynamicValueType.Bytes))
      ev "back\\slash" (DropField(fid "π-héĺĺo" DynamicValueType.Object)) ]

[<Literal>]
let private GoldenText =
    "zschemalog/1\n\
     081K-EV1\tadd\tcount\tint\n\
     081K-EV2\tadd\tlabel\tstring\n\
     081K-EV3\trename\tlabel\ttitle\tstring\n\
     081K-EV4\tretype\tcount\tint\tfloat\n\
     081K-EV5\tdrop\ttitle\tstring\n\
     id\\twith\\ttabs\tadd\tname\\nwith\\nnewlines\tbytes\n\
     back\\\\slash\tdrop\tπ-héĺĺo\tobject"

[<Fact>]
let ``GOLDEN VECTOR: the reference log encodes to EXACTLY these bytes`` () =
    Assert.Equal<string>(GoldenText, SchemaLogCodec.encode goldenLog)

[<Fact>]
let ``GOLDEN VECTOR: the locked bytes decode to EXACTLY the reference log`` () =
    Assert.Equal<Result<SchemaLog, SchemaLogCodecError list>>(Ok goldenLog, SchemaLogCodec.decode GoldenText)

[<Fact>]
let ``a trailing newline (POSIX tail) is tolerated; the log is unchanged`` () =
    Assert.Equal<Result<SchemaLog, SchemaLogCodecError list>>(Ok goldenLog, SchemaLogCodec.decode (GoldenText + "\n"))

// ── 3. Loud decode ───────────────────────────────────────────────────

[<Fact>]
let ``a wrong header is UnknownFormat — a decoder never guesses`` () =
    match SchemaLogCodec.decode "zschemalog/2\nx\tadd\ty\tint" with
    | Error [ UnknownFormat "zschemalog/2" ] -> ()
    | other -> failwithf "unexpected: %A" other

[<Fact>]
let ``every malformed line is reported with ITS line number — all-or-nothing`` () =
    let text = "zschemalog/1\ne1\tadd\tf\tint\ne2\tadd\tf\tfloop\ne3\tfrobnicate\tf\ne4\tadd\tf" // lines 3,4,5 bad
    match SchemaLogCodec.decode text with
    | Ok _ -> failwith "expected Error"
    | Error errs ->
        Assert.Equal(3, List.length errs)
        Assert.Contains(MalformedLine(3, "unknown type name 'floop'"), errs)
        Assert.Contains(MalformedLine(4, "unknown op tag 'frobnicate'"), errs)
        Assert.Contains(MalformedLine(5, "wrong field count for op 'add'"), errs)

[<Fact>]
let ``a dangling escape is reported, never silently truncated`` () =
    match SchemaLogCodec.decode "zschemalog/1\ne1\tadd\tbad\\\tint" with
    | Ok log -> failwithf "expected Error, got %A" log
    | Error errs -> Assert.True(errs |> List.forall (function MalformedLine (2, _) -> true | _ -> false))

[<Fact>]
let ``an INTERIOR empty line is malformed — positions must not shift`` () =
    match SchemaLogCodec.decode "zschemalog/1\ne1\tadd\tf\tint\n\ne2\tadd\tg\tint" with
    | Ok _ -> failwith "expected Error"
    | Error errs -> Assert.True(errs |> List.exists (function MalformedLine (3, _) -> true | _ -> false))

// ── 4. Streamed dedupe ───────────────────────────────────────────────

[<Property(Arbitrary = [| typeof<LogArb> |])>]
let ``dedupe = List.ofSeq ∘ dedupeStream — one semantics, two forms`` (log: SchemaLog) =
    SchemaLog.dedupe log = List.ofSeq (SchemaLog.dedupeStream log)

[<Property(Arbitrary = [| typeof<LogArb> |])>]
let ``currentFrom (streamed) still equals the fold of the materialised dedupe`` (log: SchemaLog) =
    SchemaLog.current log = SchemaLog.foldRaw (SchemaLog.dedupe log)

[<Fact>]
let ``dedupeStream is first-occurrence-wins and order-preserving`` () =
    let a = ev "e1" (AddField(fid "x" DynamicValueType.Int))
    let b = ev "e2" (AddField(fid "y" DynamicValueType.Int))
    Assert.Equal<SchemaEvent list>([ a; b ], SchemaLog.dedupeStream [ a; b; a; b; a ] |> List.ofSeq)

[<Fact>]
let ``dedupeStream is LAZY — it does not materialise the source`` () =
    // An infinite redelivery stream: any materialising implementation hangs here.
    let a = ev "e1" (AddField(fid "x" DynamicValueType.Int))
    let infinite = Seq.initInfinite (fun _ -> a)
    Assert.Equal<SchemaEvent list>([ a ], SchemaLog.dedupeStream infinite |> Seq.truncate 1 |> List.ofSeq)
