module Zeta.Tests.Formal.ClockLawsTests

open System
open System.Diagnostics
open System.IO
open System.Reflection
open System.Text.Json
open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// 081KT7YW00008QG0R002T1XNWT clock primitive (gap #1) — PROVEN. The temporal index the cost curve +
// curvature are defined over. Three legs (mirrors byte-cost / Jaccard):
//   1. Z3 — the order axioms (total order) + monotone tick hold over unbounded ℤ.
//   2. FsCheck — the same laws on the real Versionstamp/Scheduler types.
//   3. DST replay — Scheduler.run agrees with the shared seed (deterministic,
//      and 4-language-replayable later).

// ── repo root (Zeta.sln sentinel) ──
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)."
    dir.FullName


// ════════════════════════════════════════════════════════════════════
// 1. Z3 — versionstamp order is a TOTAL order + tick is the monotone unit step.
//    (Versionstamp's order IS int64 order; proving it symbolically over ℤ shows
//     the temporal index is well-defined — what ∂/∂² over time requires.)
// ════════════════════════════════════════════════════════════════════
let private which (tool: string) : string option =
    try
        let psi = ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        let out = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists out then Some out else None
    with _ -> None

let private z3Holds (name: string) (claim: string) =
    let script =
        "(declare-const a Int)\n(declare-const b Int)\n(declare-const c Int)\n"
        + "(assert (not " + claim + "))\n(check-sat)\n"
    match which "z3" with
    | None -> ()  // z3 absent — CI installs it; skip cleanly.
    | Some _ ->
        let psi = ProcessStartInfo("z3", "-in",
                    RedirectStandardInput = true, RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let out = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        if not (out.Contains "unsat") then failwithf "Z3 failed to prove clock %s law. Output:\n%s" name out

[<Fact>]
let ``Z3 proves versionstamp order is total (trichotomy)`` () =
    z3Holds "trichotomy" "(or (< a b) (= a b) (> a b))"

[<Fact>]
let ``Z3 proves versionstamp order is transitive`` () =
    z3Holds "transitivity" "(=> (and (< a b) (< b c)) (< a c))"

[<Fact>]
let ``Z3 proves versionstamp order is antisymmetric`` () =
    z3Holds "antisymmetry" "(=> (and (<= a b) (<= b a)) (= a b))"

[<Fact>]
let ``Z3 proves tick is strictly monotone increasing`` () =
    z3Holds "monotone tick" "(> (+ a 1) a)"

[<Fact>]
let ``Z3 proves tick preserves order (a<b => tick a < tick b)`` () =
    z3Holds "tick order-preserving" "(=> (< a b) (< (+ a 1) (+ b 1)))"

[<Fact>]
let ``Z3 proves delay is the inverse of tick (z-inv)`` () =
    z3Holds "delay∘tick = id" "(= (- (+ a 1) 1) a)"


// ════════════════════════════════════════════════════════════════════
// 2. FsCheck — the laws on the REAL Versionstamp / Scheduler.
// ════════════════════════════════════════════════════════════════════
let private vs (n: int64) = Versionstamp.ofInt64 n

[<Property>]
let ``tick strictly increases the version`` (n: int64) =
    let v = vs (n % 1_000_000_000L)
    (Versionstamp.tick v).Version > v.Version

[<Property>]
let ``delay undoes tick`` (n: int64) =
    let v = vs (n % 1_000_000_000L)
    Versionstamp.delay (Versionstamp.tick v) = v

[<Property>]
let ``compare is a total order (trichotomy, exactly one holds)`` (x: int64) (y: int64) =
    let a, b = vs x, vs y
    let c = Versionstamp.compare a b
    (c < 0) <> (c = 0) <> (c > 0) && (Versionstamp.isBefore a b = (c < 0))

[<Property>]
let ``step advances the scheduler by exactly one tick`` (seed: int64) =
    let s = Scheduler.fromSeed (seed % 1_000_000_000L)
    (Scheduler.step s).Now.Version = s.Now.Version + 1L

[<Property>]
let ``run is deterministic (same seed,n => same timeline) — DST`` (seed: int64) (k: int) =
    let s = seed % 1_000_000L
    let n = abs (k % 64)
    Scheduler.run s n = Scheduler.run s n

[<Property>]
let ``run is strictly increasing — append order embeds clock order`` (seed: int64) (k: int) =
    let n = abs (k % 64)
    let stamps = Scheduler.run (seed % 1_000_000L) n |> List.toArray
    Array.forall (fun i -> stamps.[i].Version < stamps.[i + 1].Version) [| 0 .. stamps.Length - 2 |]


// MACHINE-BOUNDARY (Lior review 2026-06-04, gap #1): the Z3 proofs above model the
// LOGICAL clock over unbounded ℤ (correct for the model), but the impl runs on
// int64. The honest closure: the impl is NOT blind to the machine boundary — tick
// uses Checked.(+), so at Int64.MaxValue it THROWS (OverflowException) rather than
// silently wrapping to a smaller stamp (which would violate monotonicity + corrupt
// ordering). The boundary is guarded + tested; full BitVec64 modeling is optional
// extra rigor noted in the map.
[<Fact>]
let ``tick at Int64.MaxValue throws (Checked guards the machine boundary, no silent wrap)`` () =
    let atMax = Versionstamp.ofInt64 System.Int64.MaxValue
    Assert.Throws<OverflowException>(fun () -> Versionstamp.tick atMax |> ignore) |> ignore

[<Fact>]
let ``delay at Int64.MinValue throws (Checked guards underflow)`` () =
    let atMin = Versionstamp.ofInt64 System.Int64.MinValue
    Assert.Throws<OverflowException>(fun () -> Versionstamp.delay atMin |> ignore) |> ignore


// ════════════════════════════════════════════════════════════════════
// 3. DST replay — Scheduler.run agrees with the shared seed (deterministic
//    timeline; the 4-language-replayable golden vectors).
// ════════════════════════════════════════════════════════════════════
[<Fact>]
let ``Scheduler.run matches the clock golden vectors`` () =
    let seedPath = Path.Join(repoRoot (), "src", "Core.TypeScript", "clock", "golden-vectors.json")
    File.Exists seedPath |> should equal true
    use doc = JsonDocument.Parse(File.ReadAllText seedPath)
    let mutable n = 0
    for v in doc.RootElement.GetProperty("vectors").EnumerateArray() do
        let name = v.GetProperty("name").GetString()
        let seed = v.GetProperty("seed").GetInt64()
        let steps = v.GetProperty("steps").GetInt32()
        let expected = [ for s in v.GetProperty("stamps").EnumerateArray() -> s.GetInt64() ]
        let actual = Scheduler.run seed steps |> List.map (fun vstamp -> vstamp.Version)
        if actual <> expected then
            failwithf "clock vector '%s': expected %A, got %A" name expected actual
        n <- n + 1
    n |> should greaterThan 0

// ════════════════════════════════════════════════════════════════════
// 4. Gate T2 — Versionstamp canonical codec byte-lock.
//    encode/decode round-trips and hex strings must match the shared
//    golden vectors (tick-codec-golden-vectors.json) across all 4 oracles.
// ════════════════════════════════════════════════════════════════════
[<Fact>]
let ``Gate T2 Versionstamp encode matches golden vectors`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "clock", "tick-codec-golden-vectors.json")
    File.Exists path |> should equal true
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let mutable n = 0
    for v in doc.RootElement.GetProperty("vectors").EnumerateArray() do
        let name    = v.GetProperty("name").GetString()
        let version = v.GetProperty("version").GetString() |> fun s -> System.Int64.Parse(s, System.Globalization.CultureInfo.InvariantCulture)
        let hex     = v.GetProperty("hex").GetString()
        let encoded = Versionstamp.encode (Versionstamp.ofInt64 version)
        let actual  = encoded |> Array.map (fun b -> sprintf "%02x" b) |> String.concat ""
        if actual <> hex then
            failwithf "Gate T2 encode vector '%s' (version=%d): expected %s, got %s" name version hex actual
        n <- n + 1
    n |> should greaterThan 0

[<Fact>]
let ``Gate T2 Versionstamp decode matches golden vectors`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "clock", "tick-codec-golden-vectors.json")
    File.Exists path |> should equal true
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let mutable n = 0
    for v in doc.RootElement.GetProperty("vectors").EnumerateArray() do
        let name    = v.GetProperty("name").GetString()
        let version = v.GetProperty("version").GetString() |> fun s -> System.Int64.Parse(s, System.Globalization.CultureInfo.InvariantCulture)
        let hex     = v.GetProperty("hex").GetString()
        let buf     = hex |> Seq.chunkBySize 2 |> Seq.map (fun c -> System.Convert.ToByte(System.String(c), 16)) |> Seq.toArray
        let decoded = Versionstamp.decode buf
        if decoded.Version <> version then
            failwithf "Gate T2 decode vector '%s' (hex=%s): expected %d, got %d" name hex version decoded.Version
        n <- n + 1
    n |> should greaterThan 0

[<Fact>]
let ``Gate T2 Versionstamp encode-decode round-trip`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "clock", "tick-codec-golden-vectors.json")
    File.Exists path |> should equal true
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let mutable n = 0
    for v in doc.RootElement.GetProperty("vectors").EnumerateArray() do
        let version = v.GetProperty("version").GetString() |> fun s -> System.Int64.Parse(s, System.Globalization.CultureInfo.InvariantCulture)
        let vstamp  = Versionstamp.ofInt64 version
        let rt      = Versionstamp.decode (Versionstamp.encode vstamp)
        if rt.Version <> version then
            failwithf "Gate T2 round-trip: expected %d, got %d" version rt.Version
        n <- n + 1
    n |> should greaterThan 0
