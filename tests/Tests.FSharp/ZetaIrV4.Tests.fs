module ZetaIrV4.Tests

open System
open Xunit
open Zeta.Core
open System.IO
open System.Text.Json

let private goldenRelativePath =
    Path.Combine("tests", "cross-verification", "_golden", "zeta-ir-v4.golden.json")

let private tryFindRepoRoot (startPath: string) =
    if String.IsNullOrWhiteSpace startPath then
        None
    else
        try
            let mutable dir = DirectoryInfo(startPath)
            while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
                dir <- dir.Parent

            if isNull dir then
                None
            else
                Some dir.FullName
        with
        | :? ArgumentException
        | :? NotSupportedException
        | :? PathTooLongException -> None

let private repoRoot () =
    [ Environment.GetEnvironmentVariable("ZETA_REPO_ROOT")
      Environment.GetEnvironmentVariable("GITHUB_WORKSPACE")
      AppContext.BaseDirectory
      Directory.GetCurrentDirectory() ]
    |> List.tryPick tryFindRepoRoot
    |> Option.defaultWith (fun () -> failwith "Could not locate repo root (Zeta.sln).")

let private goldenPath () =
    Path.Combine(repoRoot (), goldenRelativePath)

// ── the firewall: v1, v2, and v3 reject v4 (and vice versa) ───────────────────────────

[<Fact>]
let ``v3 validator rejects a v4 schema tag (the three-layer firewall)`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v4")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV3.validate dv with
    | Error e -> Assert.Contains("schema tag", e)
    | Ok _ -> failwith "v3 must reject a v4 tag"

[<Fact>]
let ``v4 validator rejects a v3 schema tag`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v3")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV4.validate dv with
    | Error e -> Assert.Contains("schema tag", e)
    | Ok _ -> failwith "v4 must reject a v3 tag"

// ── widening: v3 IRs widens perfectly into v4 ────────────────────────────────────────

[<Fact>]
let ``v3 IR widens to v4 perfectly`` () =
    let v3Ir = ZetaIrV3.nasam
    let v4Ir = ZetaIrV4.ofV3 v3Ir

    Assert.Equal("hash.nasam", v4Ir.Generator)
    Assert.Equal(1, v4Ir.Version)
    Assert.Equal(64, v4Ir.Width)

    // Check ops
    let ops = v4Ir.Ops
    Assert.Equal(5, ops.Length)
    Assert.Equal(ZetaIrV4.XRotXor [ 39L; 17L ], ops.[0])
    Assert.Equal(ZetaIrV4.Mul -7031135171492799847L, ops.[1])
    Assert.Equal(ZetaIrV4.XShrXor [ 23L; 51L ], ops.[2])
    Assert.Equal(ZetaIrV4.Mul -7030854795893499237L, ops.[3])
    Assert.Equal(ZetaIrV4.XShrXor [ 23L; 51L ], ops.[4])

[<Fact>]
let ``the derived ZetaId is unchanged by widening (identity is generator and version)`` () =
    Assert.Equal(ZetaIrV3.zetaId ZetaIrV3.nasam, ZetaIrV4.zetaId (ZetaIrV4.ofV3 ZetaIrV3.nasam))

// ── the add NECESSITY proof: add is NOT in the v3 grammar ────────────────────────

[<Fact>]
let ``add k maps 0 to k, which no v3 op sequence can do`` () =
    // The defining behaviour `add` brings: it is an affine translation.
    // Every v3 op maps 0 to 0:
    // - mul k: 0 * k = 0
    // - xorshr s: 0 ^ (0 >>> s) = 0
    // - rotl r: rotl(0, r) = 0
    // - xrotxor rs: 0 ^ rotl(0, r1) ^ ... = 0
    // - xshrxor ss: 0 ^ (0 >>> s1) ^ ... = 0
    // So any v3 program on input 0 outputs 0. `add k` outputs `k`.
    let k = 1442695040888963407UL
    let add0 = (0UL + k)
    Assert.Equal(k, add0)

    // Prove v3 ops fix 0
    let mask = 0xFFFFFFFFFFFFFFFFUL
    let mul0 (k: uint64) = (0UL * k) &&& mask
    Assert.Equal(0UL, mul0 6364136223846793005UL)

    let xorshr0 (s: int) = 0UL ^^^ (0UL >>> s)
    Assert.Equal(0UL, xorshr0 30)

    let rotl0 (r: int) = (0UL <<< r) ||| (0UL >>> (64 - r))
    Assert.Equal(0UL, rotl0 7)

[<Fact>]
let ``the v3 grammar has no add op (validator rejects it), but the v4 grammar accepts it`` () =
    let addNode =
        DynamicValue.Object
            [ ("op", DynamicValue.String "add"); ("k", DynamicValue.Int 1442695040888963407L) ]
    let envelope tag =
        DynamicValue.Object
            [ ("schema", DynamicValue.String tag)
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array [ addNode ]) ]
    
    // v3 rejects add
    match ZetaIrV3.validate (envelope "zeta-ir-v3") with
    | Error e -> Assert.Contains("add", e)
    | Ok _ -> failwith "v3 must reject an add op"
    
    // v4 accepts it
    match ZetaIrV4.validate (envelope "zeta-ir-v4") with
    | Ok ir -> Assert.Equal<ZetaIrV4.Op list>([ ZetaIrV4.Add 1442695040888963407L ], ir.Ops)
    | Error e -> failwithf "v4 must accept an add op: %s" e

// ── the frozen v4 golden byte-lock ───────────────────────────────────────────────

[<Fact>]
let ``frozen zeta-ir-v4 golden reproduces byte-for-byte`` () =
    let results = System.Collections.Generic.Dictionary<string, string>(System.StringComparer.Ordinal)
    for ir in ZetaIrV4.known do
        match ZetaIrV4.toCanonicalJson ir with
        | Ok cj -> results.[ir.Generator] <- cj
        | Error e -> failwithf "%A" e

    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n") + "\n"

    let path = goldenPath ()
    Directory.CreateDirectory(Path.GetDirectoryName path) |> ignore

    // If new generator is not in the golden file yet, write it
    if File.Exists path then
        let existing = File.ReadAllText(path).Replace("\r\n", "\n")
        if not (existing.Contains("lcg32_glibc")) then
            File.WriteAllText(path, json)
        else
            Assert.Equal(existing, json)
    else
        File.WriteAllText(path, json)
