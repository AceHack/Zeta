module Zeta.Tests.Formal.ByteCostLawsTests

open System
open System.IO
open System.Reflection
open System.Diagnostics
open System.Text.Json
open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// 081KT7YW00008QG0R002T1XNWT slice 1 — the context-window minimization byte-cost meter, proven.
// Three legs, mirroring the Z-set abelian-group precedent (Z3.Laws.Tests.fs):
//   1. Z3 (symbolic, unbounded ℤ) — the summation monoid laws hold for all ints.
//   2. FsCheck (real type, large domain) — the same laws on the actual ByteCost.
//   3. Golden vectors (cross-language byte-lock) — measure agrees with the seed.
// Plus the harness-aware apply: a harness's cost = the sum over the surfaces IT
// boots. The meter only measures (NCI-safe).

// ── repo root (Zeta.sln sentinel) — same walk as the other golden-vector tests ──
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)."
    dir.FullName


// ════════════════════════════════════════════════════════════════════
// 1. Z3 — the summation monoid is sound over unbounded integers.
//    (ByteCost.add IS int64 addition; proving it symbolically over ℤ shows
//     the fileset total is order-independent — what DORA aggregation needs.)
// ════════════════════════════════════════════════════════════════════

let private which (tool: string) : string option =
    try
        let psi = ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        let output = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists output then Some output else None
    with _ -> None

let private z3Holds (name: string) (claim: string) =
    let script =
        "(declare-const a Int)\n(declare-const b Int)\n(declare-const c Int)\n"
        + "(assert (not " + claim + "))\n(check-sat)\n"
    match which "z3" with
    | None -> ()  // tool absent — CI installs z3; skip cleanly.
    | Some _ ->
        let psi = ProcessStartInfo("z3", "-in",
                    RedirectStandardInput = true, RedirectStandardOutput = true,
                    UseShellExecute = false)
        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let output = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        if not (output.Contains "unsat") then
            failwithf "Z3 failed to prove ByteCost %s law. Output:\n%s" name output

[<Fact>]
let ``Z3 proves byte-cost sum is associative`` () =
    z3Holds "associativity" "(= (+ (+ a b) c) (+ a (+ b c)))"

[<Fact>]
let ``Z3 proves byte-cost sum is commutative`` () =
    z3Holds "commutativity" "(= (+ a b) (+ b a))"

[<Fact>]
let ``Z3 proves Zero is the byte-cost identity`` () =
    z3Holds "identity" "(= (+ a 0) a)"


// ════════════════════════════════════════════════════════════════════
// 2. FsCheck — the same monoid laws on the REAL ByteCost type + meter.
// ════════════════════════════════════════════════════════════════════

let private nonNeg (n: int64) = ByteCost.ofBytes (abs (n % 1_000_000L))

[<Property>]
let ``ByteCost.add is associative`` (x: int64) (y: int64) (z: int64) =
    let a, b, c = nonNeg x, nonNeg y, nonNeg z
    ByteCost.add (ByteCost.add a b) c = ByteCost.add a (ByteCost.add b c)

[<Property>]
let ``ByteCost.add is commutative`` (x: int64) (y: int64) =
    let a, b = nonNeg x, nonNeg y
    ByteCost.add a b = ByteCost.add b a

[<Property>]
let ``ByteCost.Zero is identity`` (x: int64) =
    let a = nonNeg x
    ByteCost.add a ByteCost.Zero = a && ByteCost.add ByteCost.Zero a = a

[<Property>]
let ``ByteCost.sum is order-independent (DORA aggregate is sound)`` (xs: int64 list) =
    let costs = xs |> List.map nonNeg
    ByteCost.sum costs = ByteCost.sum (List.rev costs)

[<Property>]
let ``measureText is never negative and empty costs Zero`` (s: NonNull<string>) =
    let c = ByteCost.measureText s.Get
    c.Bytes >= 0L && ByteCost.measureText "" = ByteCost.Zero


// ════════════════════════════════════════════════════════════════════
// 3. Golden vectors — the meter agrees with the shared cross-language seed.
// ════════════════════════════════════════════════════════════════════

[<Fact>]
let ``measureText matches the byte-cost golden vectors`` () =
    let seed = Path.Join(repoRoot (), "src", "Core.TypeScript", "byte-cost", "golden-vectors.json")
    File.Exists seed |> should equal true
    use doc = JsonDocument.Parse(File.ReadAllText seed)
    let vectors = doc.RootElement.GetProperty("vectors").EnumerateArray()
    let mutable n = 0
    for v in vectors do
        let name = v.GetProperty("name").GetString()
        let text = v.GetProperty("text").GetString()
        let expected = v.GetProperty("bytes").GetInt64()
        let actual = (ByteCost.measureText text).Bytes
        if actual <> expected then
            failwithf "byte-cost vector '%s': expected %d, measured %d" name expected actual
        n <- n + 1
    n |> should greaterThan 0


// ════════════════════════════════════════════════════════════════════
// 4. Harness-aware apply — a harness's cost is the sum over the surfaces
//    IT boots. Here: the Claude Code harness boots .claude/rules/*.md.
//    (Different harnesses boot different manifests — the (harness × surface)
//     keying of 081KT7YW00008QG0R002T1XNWT; this proves the meter runs on the real surface and
//     that per-file costs fold to the harness total.)
// ════════════════════════════════════════════════════════════════════

[<Fact>]
let ``meter folds the rules surface to a positive harness cost`` () =
    let rulesDir = Path.Join(repoRoot (), ".claude", "rules")
    File.Exists(Path.Join(repoRoot (), "Zeta.sln")) |> should equal true
    if Directory.Exists rulesDir then
        let perFile =
            Directory.GetFiles(rulesDir, "*.md")
            |> Array.map (fun f -> ByteCost.measureText (File.ReadAllText f))
        // The fold equals the monoid sum (order-independent total).
        let total = ByteCost.sum perFile
        let refold = perFile |> Array.fold ByteCost.add ByteCost.Zero
        total |> should equal refold
        if perFile.Length > 0 then total.Bytes |> should greaterThan 0L
