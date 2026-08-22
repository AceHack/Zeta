module Zeta.Tests.SocietyUsefulWorkCrossVerifyTests

open System
open System.Globalization
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SocietyUsefulWork effective-sample-size cross-language agreement.
//
// The F# oracle replays the shared seed
// (src/Core.TypeScript/society/golden-vectors-effective-agent-count.json) that the TypeScript
// oracle (src/Core.TypeScript/society/effective-agent-count.test.ts) also replays. Both passing ==
// F# and TS agree on Kish's design effect, so the TypeScript port that
// `effective-agent-count.ts` uses in production cannot drift from the proven F# reference without
// one of the two going red.
//
// Two comparison strengths, and the difference is not laziness:
//
//   * `effectiveTrialCount` is compared by EXACT IEEE-754 BIT EQUALITY. It uses only subtraction,
//     multiplication, addition and division, all four of which IEEE-754 requires to be correctly
//     rounded — so bit equality is a guarantee the arithmetic already provides, and a tolerance
//     here would be strictly weaker than what can be asserted.
//   * The union functions use `pow` and `log`, which IEEE-754 does NOT require to be correctly
//     rounded; .NET's libm and a JS engine's differ in the last ulp. Those are compared to 1e-12
//     relative. Byte-locking them would produce a check that fails on some machines for reasons
//     that have nothing to do with the model.
//
// Seed format is text per `.claude/rules/no-binary-in-proof-lineage.md`: every double travels as
// its exact big-endian IEEE-754 bit pattern in hex, with a decimal rendering beside it for human
// audit. The hex is authoritative.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private seedPath () =
    Path.Join(repoRoot (), "src", "Core.TypeScript", "society", "golden-vectors-effective-agent-count.json")

/// Big-endian IEEE-754 hex -> double. `Convert.ToInt64(_, 16)` reads the full 64-bit two's
/// complement, so a sign bit (0xB..., 0xF...) round-trips correctly.
let private ofHex (hex: string) : double =
    BitConverter.Int64BitsToDouble(Convert.ToInt64(hex, 16))

let private toHex (x: double) : string =
    BitConverter.DoubleToInt64Bits(x).ToString("X16", CultureInfo.InvariantCulture)

let private dec (s: string) : double =
    Double.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture)

[<Fact>]
let ``F# effectiveTrialCount is BIT-IDENTICAL to the shared golden seed`` () =
    let path = seedPath ()
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)

    let vectors =
        doc.RootElement.GetProperty("kish").GetProperty("vectors").EnumerateArray() |> Seq.toArray

    Assert.NotEmpty vectors

    let mutable sawRhoZero = false
    let mutable sawRhoOne = false

    for v in vectors do
        let n = v.GetProperty("n").GetInt32()
        let rho = ofHex (v.GetProperty("rhoHex").GetString())
        let expectedHex = v.GetProperty("nEffHex").GetString()
        let actual = SocietyUsefulWork.effectiveTrialCount n rho
        // Compared as strings so a failure names the vector rather than printing two doubles.
        Assert.Equal(
            sprintf "n=%d rho=%s nEff=%s" n (v.GetProperty("rhoHex").GetString()) expectedHex,
            sprintf "n=%d rho=%s nEff=%s" n (v.GetProperty("rhoHex").GetString()) (toHex actual)
        )
        // The decimal rendering beside the hex must not have drifted from the hex it annotates.
        Assert.True(
            abs (dec (v.GetProperty("nEff").GetString()) - actual) < 1e-12,
            sprintf "decimal annotation disagrees with the hex for n=%d" n
        )

        if rho = 0.0 then sawRhoZero <- true
        if rho = 1.0 then sawRhoOne <- true

    // A vector set that never touches an endpoint cannot detect an endpoint regression, and the
    // endpoints are the two claims the formula is actually asserting.
    Assert.True(sawRhoZero, "seed contains no rho = 0 vector")
    Assert.True(sawRhoOne, "seed contains no rho = 1 vector")

[<Fact>]
let ``F# union-equivalent count agrees with the shared golden seed to 1e-12`` () =
    let path = seedPath ()
    use doc = JsonDocument.Parse(File.ReadAllText path)

    let vectors =
        doc.RootElement.GetProperty("union").GetProperty("vectors").EnumerateArray() |> Seq.toArray

    Assert.NotEmpty vectors

    // A single unit-valued fact turns `expectedSocietyIdentical` into the bare union probability,
    // so the seed is pinned against the SHIPPED formula rather than against a re-derivation of it.
    let unitFact: SocietyUsefulWork.Fact[] = [| { Id = 0; Value = 1.0 } |]

    for v in vectors do
        let n = v.GetProperty("n").GetInt32()
        let c = ofHex (v.GetProperty("cHex").GetString())
        let rho = ofHex (v.GetProperty("rhoHex").GetString())

        let expectedP = dec (v.GetProperty("unionProbability").GetString())
        let actualP = SocietyUsefulWork.expectedSocietyIdentical n c rho unitFact
        Assert.True(abs (actualP - expectedP) <= 1e-12, sprintf "unionProbability n=%d: %.17g vs %.17g" n actualP expectedP)

        let expectedM = dec (v.GetProperty("unionEquivalentAgentCount").GetString())
        let actualM = SocietyUsefulWork.unionEquivalentAgentCount n c rho
        Assert.True(
            abs (actualM - expectedM) <= 1e-12 * max 1.0 (abs expectedM),
            sprintf "unionEquivalentAgentCount n=%d: %.17g vs %.17g" n actualM expectedM
        )

[<Fact>]
let ``the seed pins BOTH endpoints of the design effect, not only the interior`` () =
    // Guards the seed file itself against being weakened into a set of interior points that a
    // constant-returning stub could satisfy: at n > 1 the two endpoints MUST disagree.
    for n in [ 2; 3; 7; 100 ] do
        Assert.Equal(double n, SocietyUsefulWork.effectiveTrialCount n 0.0)
        Assert.Equal(1.0, SocietyUsefulWork.effectiveTrialCount n 1.0)
        Assert.NotEqual(SocietyUsefulWork.effectiveTrialCount n 0.0, SocietyUsefulWork.effectiveTrialCount n 1.0)
