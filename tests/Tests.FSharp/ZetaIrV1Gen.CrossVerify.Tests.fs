module Zeta.Tests.ZetaIrV1GenCrossVerifyTests

open System
open System.IO
open System.Numerics
open System.Text.Json
open global.Xunit
open Zeta.Core

// zeta-ir-v1-gen — Phase B of the gen-gen capstone (F# oracle).
//
// Emits the F# side of the value-preservation byte-lock: for each known generator it
// takes the SHIPPING `ZetaIrV1.toCanonicalJson` (the frozen v1 envelope), decodes it
// back through the REAL `DynamicValue.fromCanonicalJson`, folds the decoded ops with a
// width-parametric total interpreter, and writes the output vectors to
// `fsharp-output.json`. The independent TS oracle (`_gen/gen.ts`) builds the SAME
// envelope through the TS canonical-JSON path and folds it; `compare.ts` asserts the
// two agree AND that both equal the committed LEGACY golden
// (`../splitmix64/ts-output.json`, `../fmix32/ts-output.json`) — proving the freeze is
// behavior-preserving. The interpreter here is a fresh fold over the DECODED v1 IR, not
// a call into any shipping mixer, so the IR (not code) carries the algorithm.

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private outputPath () =
    Path.Join(repoRoot (), "tests", "cross-verification", "zeta-ir-v1-gen", "fsharp-output.json")

// the input sets — identical to the committed legacy goldens these vectors must match.
let private splitmix64Inputs : (string * BigInteger) list =
    [ "x-0", BigInteger 0
      "x-1", BigInteger 1
      "x-2", BigInteger 2
      "x-10", BigInteger 10
      "x-255", BigInteger 255
      "x-u64max", BigInteger.Parse "18446744073709551615"
      "x-golden", BigInteger.Parse "11400714819323198485"
      "x-2pow63", BigInteger.Parse "9223372036854775808"
      "x-12345678901234567890", BigInteger.Parse "12345678901234567890"
      "x-1e18", BigInteger.Parse "1000000000000000000" ]

let private fmix32Inputs : (string * BigInteger) list =
    [ "x-0", BigInteger 0
      "x-1", BigInteger 1
      "x-2", BigInteger 2
      "x-10", BigInteger 10
      "x-255", BigInteger 255
      "x-u32max", BigInteger 4294967295L
      "x-0x9e3779b9", BigInteger 2654435769L
      "x-2pow31", BigInteger 2147483648L
      "x-3735928559", BigInteger 3735928559L
      "x-1e9", BigInteger 1000000000L ]

let private fmix64Inputs : (string * BigInteger) list =
    [ "x-0", BigInteger 0
      "x-1", BigInteger 1
      "x-2", BigInteger 2
      "x-10", BigInteger 10
      "x-255", BigInteger 255
      "x-u64max", BigInteger.Parse "18446744073709551615"
      "x-golden", BigInteger.Parse "11400714819323198485"
      "x-2pow63", BigInteger.Parse "9223372036854775808"
      "x-12345678901234567890", BigInteger.Parse "12345678901234567890"
      "x-1e18", BigInteger.Parse "1000000000000000000" ]

// decode a v1 IR (from its canonical JSON) into (width, ops), enforcing the v1 contract
// through the shipping ZetaIrV1.validate — i.e. the SAME validator the freeze ships.
let private decodeV1 (canonicalJson: string) : int * ZetaIrV1.Op list =
    match ZetaIrV1.validateCanonicalJson canonicalJson with
    | Ok ir -> ir.Width, ir.Ops
    | Error e -> failwithf "v1 IR did not validate: %s" e

// width-parametric total fold over the decoded v1 ops. `k` is stored as a signed-int64
// bit-pattern; reinterpret to the non-negative u-word it encodes before multiplying.
let private fold (width: int) (ops: ZetaIrV1.Op list) (x: BigInteger) : BigInteger =
    let mask = (BigInteger.One <<< width) - BigInteger.One
    let uword (z: BigInteger) = ((z % (mask + BigInteger.One)) + (mask + BigInteger.One)) % (mask + BigInteger.One)
    let fromI64 (k: int64) = uword (BigInteger k)
    ops
    |> List.fold
        (fun z op ->
            match op with
            | ZetaIrV1.Mul k -> uword (z * fromI64 k)
            | ZetaIrV1.XorShr s -> uword (z ^^^ (z >>> int s)))
        (uword x)

let private emit (ir: ZetaIrV1.Ir) (inputs: (string * BigInteger) list) : Map<string, string> =
    match ZetaIrV1.toCanonicalJson ir with
    | Ok cj ->
        let width, ops = decodeV1 cj
        inputs
        |> List.map (fun (id, x) -> id, (fold width ops x).ToString())
        |> List.append [ "_source", "generated-from-zeta-ir-v1" ]
        |> Map.ofList
    | Error e -> failwithf "%A" e

[<Fact>]
let ``emit zeta-ir-v1-gen fsharp-output.json (and value-preservation against legacy golden)`` () =
    let splitmix64 = emit ZetaIrV1.splitmix64 splitmix64Inputs
    let fmix32 = emit ZetaIrV1.fmix32 fmix32Inputs
    let fmix64 = emit ZetaIrV1.fmix64 fmix64Inputs

    // sanity inside this oracle: a couple of pinned values from the committed golden.
    Assert.Equal("16294208416658607535", splitmix64.["x-1"])
    Assert.Equal("1364076727", fmix32.["x-1"])
    Assert.Equal("12994781566227106604", fmix64.["x-1"])

    let result = dict [ "splitmix64", splitmix64; "fmix32", fmix32; "fmix64", fmix64 ]
    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(result, options).Replace("\r\n", "\n") + "\n"

    let path = outputPath ()
    Directory.CreateDirectory(Path.GetDirectoryName path) |> ignore
    File.WriteAllText(path, json)
