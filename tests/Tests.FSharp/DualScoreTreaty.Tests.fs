namespace Zeta.Tests.FSharp

open System
open System.Globalization
open System.IO
open System.Text.Json
open Xunit
open Zeta.Core

/// The cross-language treaty for `DualScore` — the belief primitive that is TWO independent
/// chances in `[0,1]`, never one normalised weight.
///
/// WHY THIS PAIR. `src/Core.TypeScript/belief/dual-score.ts` (#17308) and `src/Core/DualScore.fs`
/// (#17329) are two implementations of one idea, and `audit-cross-language-pairs.ts` reported them
/// unwatched the day the F# side landed. The `DECLARED_UNPINNED` waiver was available and was NOT
/// taken: that list is for NAME COLLISIONS — two files sharing an English word and nothing else —
/// and this is the opposite case. The whole argument for the dual legs is that a disagreement
/// between two witnesses must SURVIVE rather than average away, so two runtimes disagreeing about
/// what a belief says is the failure the type exists to prevent, committed one layer down.
///
/// THE CARRIER IS TEXT, AND EVERY DOUBLE IS A BIT PATTERN. `.claude/rules/no-binary-in-proof-lineage.md`
/// requires text; the FLOAT HAZARD requires exactness. The F# module's own header records the
/// measurement: projecting a normalised `SoftValue` gives a 7/2/1 distribution summing to
/// `1.000000000000000222` and a `combine` posterior summing to `0.99999999999999988898` —
/// residuals of `-2.22e-16` and `+1.11e-16`, one ULP either side of 1, so an EXACT `massShape` read
/// says *contradictory* and *ignorant* about two values that are both, in intent, classical.
/// Neither mass is expressible as a short decimal literal. Both are in the transcript as hex, and
/// the comparison below is EXACT BIT EQUALITY: a treaty that disagreed only in the last ULP would
/// still be a disagreement, and rounding it away would hide exactly the class of defect this pair
/// is most likely to have.
///
/// THE DIVERGENCE RISKS, each with vectors:
///
///   1. FLOAT — the two ULP masses above, and `massShapeWithin` on both sides of its boundary.
///   2. REFUSAL vs CLAMP — an out-of-unit leg must be REFUSED in both runtimes. A clamp turns a
///      caller's arithmetic bug into a plausible belief, and the same wire row would then be a
///      defect in one runtime and a confident belief in the other.
///   3. THE RESIDUAL'S SIGN — `r > 0` is Boole slack (imprecision), `r < 0` is de Finetti
///      incoherence (a Dutch book, `-r` the loss per unit stake). A side that shipped `|r|` or
///      flipped the convention still returns two plausible non-negative readings and is wrong
///      about which epistemic state it is in.
///   4. TWO DERIVATIONS OF ONE QUANTITY — F# computes `contradiction` as `max 0 (-(1 - mass))`,
///      TypeScript as `mass - 1`. See the finding below.
///   5. `swapLegs` IS AN INVOLUTION, not a complement. Order 2 is also what separates Belnap's
///      FOUR from the `C₄` compass in `src/Core/FourCornerC4.fs`.
///   6. `toyJoin` IS THE KNOWLEDGE-ORDER JOIN — componentwise max, which SURFACES conflict. The
///      truth-order join `(max t, min f)` DECIDES it, and would turn two disagreeing witnesses
///      into a confident `true`.
///   7. THE TOLERANCE FOLD — a negative tolerance folds to 0, and so does a NaN one. F#'s
///      `max 0.0 nan` returns `0.0` (`0.0 < nan` is false); JavaScript's `Math.max(0, NaN)`
///      returns `NaN`, which would make EVERY reading coherent. The TypeScript side spells the
///      fold `tolerance > 0 ? tolerance : 0` for that reason, and the vector is what checks it.
///   8. PARSE REFUSES ABSENCE — a missing leg must never default to 0, because `0` is a real
///      measurement ("evidence landed and found nothing") and absence is not.
///
/// THE FINDING (risk 4), recorded because it is what the treaty bought on its first run. The two
/// derivations of the excess are equal away from zero — IEEE-754 round-to-nearest is symmetric
/// under negation — but at `r = 0` exactly they are `-0.0` and `+0.0`, which are NOT the same
/// bits. It does not escape either module: both clamps route the zero through a `> 0` test and
/// return a positive literal, so `ignorance` and `contradiction` agree everywhere, which the
/// vectors pin. A refactor returning the negated intermediate directly would break that, and this
/// file is what would say so.
///
/// WHAT IS DELIBERATELY NOT PINNED. The refusal PROSE — F# formats its `Refusal` DU, TypeScript
/// writes an English `detail`; independently authored diagnostics for a human, not protocol. And
/// the FIELD SPELLINGS — F# carries `T`/`F` behind `TrueChance`/`FalseChance`, TypeScript carries
/// `trueChance`/`falseChance`. The transcript pins VALUES. What IS pinned about a refusal is
/// everything a caller branches on: that it happened, its REASON code, and its LEG.
module DualScoreTreatyTests =

    [<Literal>]
    let private MaxTranscriptBytes = 4L * 1024L * 1024L

    // ── The carrier ─────────────────────────────────────────────────────────

    /// Big-endian IEEE-754 hex -> double. `Convert.ToInt64(_, 16)` reads the full 64-bit two's
    /// complement, so a sign bit (`8...`, `B...`, `F...`) round-trips rather than overflowing.
    let private ofHex (hex: string) : float =
        BitConverter.Int64BitsToDouble(Convert.ToInt64(hex, 16))

    let private toHex (x: float) : string =
        BitConverter.DoubleToInt64Bits(x).ToString("X16", CultureInfo.InvariantCulture)

    // ── JSON readers ────────────────────────────────────────────────────────

    let private strOf (el: JsonElement) (p: string) = el.GetProperty(p).GetString()

    /// A `{hex, dec}` pair -> the double its HEX names. The decimal is commentary and is checked
    /// against the hex separately; nothing in this file computes from it.
    let private dblOf (el: JsonElement) (p: string) : float =
        ofHex (strOf (el.GetProperty p) "hex")

    let private repoRoot () =
        let mutable dir = DirectoryInfo(AppContext.BaseDirectory)

        while dir <> null && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
            dir <- dir.Parent

        if dir = null then
            invalidOp "could not locate the repo root (no Zeta.sln above the test binary)"

        dir.FullName

    let private transcript =
        lazy
            (let path =
                Path.Join(repoRoot (), "src", "Core.TypeScript", "belief", "dual-score-treaty-transcript.json")

             let info = FileInfo(path)

             if not info.Exists then
                 invalidOp (
                     sprintf
                         "DualScore treaty transcript missing at %s — regenerate with: bun src/Core.TypeScript/belief/generate-dual-score-treaty-transcript.ts"
                         path
                 )

             if info.Length > MaxTranscriptBytes then
                 invalidOp $"DualScore treaty transcript is too large: {info.Length} bytes."

             use stream = File.OpenRead path
             let doc = JsonDocument.Parse(stream)
             [ for v in doc.RootElement.GetProperty("vectors").EnumerateArray() -> v ])

    let private vectorsOf (kind: string) =
        transcript.Value |> List.filter (fun v -> strOf v "vectorType" = kind)

    // ── Translating the two type systems onto the transcript's vocabulary ────
    //
    // Neither runtime's spelling is privileged: both are mapped onto the wire words, so the
    // treaty pins the DISTINCTION rather than either language's rendering of it.

    let private legWord (leg: DualScore.Leg) =
        match leg with
        | DualScore.TrueChance -> "trueChance"
        | DualScore.FalseChance -> "falseChance"
        | DualScore.Margin -> "margin"

    /// `(reason, leg)` — the two things a caller branches on. The DETAIL is checked for
    /// non-emptiness only; see the module header.
    let private refusalWords (r: DualScore.Refusal) =
        match r with
        | DualScore.NotFinite(leg, _) -> "not-finite", legWord leg
        | DualScore.OutsideUnitInterval(leg, _) -> "outside-unit-interval", legWord leg
        | DualScore.NotADualScore _ -> "not-a-dual-score", "null"

    let private refusalDetail (r: DualScore.Refusal) =
        match r with
        | DualScore.NotFinite(_, v) -> sprintf "not finite: %s" (toHex v)
        | DualScore.OutsideUnitInterval(_, v) -> sprintf "outside [0,1]: %s" (toHex v)
        | DualScore.NotADualScore d -> d

    let private shapeWord (s: DualScore.MassShape) =
        match s with
        | DualScore.Ignorant -> "ignorant"
        | DualScore.Coherent -> "coherent"
        | DualScore.Contradictory -> "contradictory"

    let private readingWord (r: DualScore.ToyReading) =
        match r with
        | DualScore.LeansTrue -> "leans-true"
        | DualScore.LeansFalse -> "leans-false"
        | DualScore.Unknown -> "unknown"
        | DualScore.Contradicted -> "contradicted"

    /// A labelled bit comparison, so a failure names the vector rather than printing two doubles
    /// whose decimal renderings can be identical while their bits are not (`-0.0` is the live
    /// instance: see THE FINDING in the module header).
    let private assertBits (label: string) (expected: float) (actual: float) =
        Assert.Equal(sprintf "%s=%s" label (toHex expected), sprintf "%s=%s" label (toHex actual))

    /// Build a score the transcript declares legal. A fixture that will not build is a defect in
    /// the transcript, so it fails loudly rather than being skipped.
    let private scoreOf (v: JsonElement) (tKey: string) (fKey: string) =
        match DualScore.create (dblOf v tKey) (dblOf v fKey) with
        | Ok s -> s
        | Error e -> failwithf "vector %s: fixture is not a legal score (%A)" (strOf v "name") e

    let private expected (v: JsonElement) = v.GetProperty "expected"

    /// Replay one `Result<DualScore, Refusal>` against a transcript `expected` block.
    let private assertResult (name: string) (expectedEl: JsonElement) (actual: Result<DualScore.DualScore, DualScore.Refusal>) =
        if expectedEl.GetProperty("ok").GetBoolean() then
            match actual with
            | Ok s ->
                assertBits (sprintf "%s.t" name) (ofHex (strOf (expectedEl.GetProperty "t") "hex")) s.TrueChance
                assertBits (sprintf "%s.f" name) (ofHex (strOf (expectedEl.GetProperty "f") "hex")) s.FalseChance
            | Error e -> failwithf "vector %s: TypeScript accepted, F# refused with %A" name e
        else
            match actual with
            | Ok s ->
                failwithf
                    "vector %s: TypeScript refused (%s), F# ACCEPTED {%s,%s}"
                    name
                    (strOf expectedEl "reason")
                    (toHex s.TrueChance)
                    (toHex s.FalseChance)
            | Error e ->
                let reason, leg = refusalWords e
                let expectedLeg = strOf expectedEl "leg"
                let expectedLeg = if isNull expectedLeg then "null" else expectedLeg
                Assert.Equal(sprintf "%s %s/%s" name (strOf expectedEl "reason") expectedLeg, sprintf "%s %s/%s" name reason leg)
                // The PROSE is not pinned. That it says SOMETHING a reader can act on is.
                Assert.False(String.IsNullOrWhiteSpace(refusalDetail e), sprintf "vector %s: empty refusal detail" name)

    // ═══════════════════════════════════════════════════════════════════════════
    // 0. The transcript itself
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``the transcript is present, non-empty, and carries every vector type`` () =
        let vs = transcript.Value
        Assert.NotEmpty vs

        for kind in [ "Corner"; "Construct"; "Facts"; "Tolerance"; "Swap"; "Join"; "Classify"; "Parse" ] do
            Assert.True(not (List.isEmpty (vectorsOf kind)), sprintf "transcript carries no %s vectors" kind)

    [<Fact>]
    let ``every decimal annotation agrees with the hex it annotates`` () =
        // The hex is authoritative and the decimal is commentary — but a commentary that drifted
        // from the value it describes would lie to every human reader of the diff while every
        // value check still passed, because nothing below reads the decimal.
        let mutable checked' = 0

        let rec walk (el: JsonElement) =
            match el.ValueKind with
            | JsonValueKind.Array ->
                for x in el.EnumerateArray() do
                    walk x
            | JsonValueKind.Object ->
                let mutable hex = Unchecked.defaultof<JsonElement>
                let mutable dec = Unchecked.defaultof<JsonElement>

                if el.TryGetProperty("hex", &hex) && el.TryGetProperty("dec", &dec) then
                    let x = ofHex (hex.GetString())
                    let rendered = dec.GetString()

                    if Double.IsNaN x then
                        Assert.Equal("NaN", rendered)
                    elif Double.IsInfinity x then
                        Assert.Equal((if x > 0.0 then "Infinity" else "-Infinity"), rendered)
                    else
                        // Parsed with InvariantCulture: the file's bytes must not depend on the
                        // locale of the machine reading them any more than on the one that wrote
                        // them. Round-trip through the decimal must land on the same double, or
                        // very nearly — JavaScript renders the shortest round-tripping decimal,
                        // and .NET's parser is correctly rounded, so equality is the normal case.
                        let parsed = Double.Parse(rendered, NumberStyles.Float, CultureInfo.InvariantCulture)

                        Assert.True(
                            (parsed = x),
                            sprintf "annotation %s does not round-trip to its hex %s" rendered (hex.GetString())
                        )

                    checked' <- checked' + 1
                else
                    for p in el.EnumerateObject() do
                        walk p.Value
            | _ -> ()

        for v in transcript.Value do
            walk v

        Assert.True(checked' > 200, sprintf "only %d annotations checked — the walk is not reaching them" checked')

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. The four corners, BY NAME and IN ORDER
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Corner: all four of Belnap's corners hold the pinned legs and the pinned facts`` () =
        let byName =
            dict
                [ "vacuous", DualScore.vacuous
                  "onlyTrue", DualScore.onlyTrue
                  "onlyFalse", DualScore.onlyFalse
                  "both", DualScore.both ]

        let vectors = vectorsOf "Corner"
        Assert.Equal(4, List.length vectors)

        for v in vectors do
            let name = strOf v "name"
            Assert.True(byName.ContainsKey name, sprintf "F# has no corner named %s" name)
            let s = byName.[name]
            assertBits (sprintf "%s.t" name) (dblOf v "t") s.TrueChance
            assertBits (sprintf "%s.f" name) (dblOf v "f") s.FalseChance
            assertBits (sprintf "%s.mass" name) (dblOf v "mass") (DualScore.mass s)
            assertBits (sprintf "%s.residual" name) (dblOf v "residual") (DualScore.residual s)
            assertBits (sprintf "%s.ignorance" name) (dblOf v "ignorance") (DualScore.ignorance s)
            assertBits (sprintf "%s.contradiction" name) (dblOf v "contradiction") (DualScore.contradiction s)
            Assert.Equal(strOf v "massShape", shapeWord (DualScore.massShape s))

            // A corner built by hand must be the same value `create` produces — otherwise the
            // named constants are a second, unchecked construction path.
            match DualScore.create s.TrueChance s.FalseChance with
            | Ok viaCreate -> Assert.Equal(s, viaCreate)
            | Error e -> failwithf "corner %s does not round-trip through create: %A" name e

    [<Fact>]
    let ``Corner: the corners roster is in the pinned order — the order is contract`` () =
        let roster = DualScore.corners
        let vectors = vectorsOf "Corner"
        Assert.Equal(List.length vectors, List.length roster)

        for v in vectors do
            let i = v.GetProperty("index").GetInt32()
            let s = roster.[i]
            assertBits (sprintf "corners[%d].t" i) (dblOf v "t") s.TrueChance
            assertBits (sprintf "corners[%d].f" i) (dblOf v "f") s.FalseChance

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Construction — REFUSES, never clamps
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Construct: every construction vector replays, accepted and refused alike`` () =
        let vectors = vectorsOf "Construct"
        Assert.NotEmpty vectors

        // CONTROL. A constructor that refused EVERYTHING would satisfy every refusal vector in
        // this block, so the roster must contain accepted ones and this assertion is what makes
        // the block non-vacuous.
        let accepted =
            vectors |> List.filter (fun v -> (expected v).GetProperty("ok").GetBoolean())

        Assert.True(List.length accepted >= 5, "the Construct roster has too few ACCEPTED vectors to be a control")

        for v in vectors do
            assertResult (strOf v "name") (expected v) (DualScore.create (dblOf v "t") (dblOf v "f"))

    [<Fact>]
    let ``Construct: the SUM is unconstrained — the glut builds, and so does maximal ignorance`` () =
        // The one thing a normalising constructor would get wrong, stated as its own falsifier:
        // {1,1} and {0,0} must both exist, because they are the two states a single probability
        // cannot represent.
        let builds (t: float) (f: float) =
            match DualScore.create t f with
            | Ok _ -> true
            | Error _ -> false

        Assert.True(builds 1.0 1.0, "the glut {1,1} must build — it is the state a single p cannot hold")
        Assert.True(builds 0.0 0.0, "maximal ignorance {0,0} must build — and it is NOT {0.5,0.5}")

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. The facts — mass, the SIGNED residual, and its two clamped halves
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Facts: mass, residual, ignorance, contradiction and shape, by exact bits`` () =
        let vectors = vectorsOf "Facts"
        Assert.NotEmpty vectors

        for v in vectors do
            let name = strOf v "name"
            let s = scoreOf v "t" "f"
            assertBits (sprintf "%s.mass" name) (dblOf v "mass") (DualScore.mass s)
            assertBits (sprintf "%s.residual" name) (dblOf v "residual") (DualScore.residual s)
            assertBits (sprintf "%s.ignorance" name) (dblOf v "ignorance") (DualScore.ignorance s)
            assertBits (sprintf "%s.contradiction" name) (dblOf v "contradiction") (DualScore.contradiction s)
            Assert.Equal(sprintf "%s %s" name (strOf v "massShape"), sprintf "%s %s" name (shapeWord (DualScore.massShape s)))

    [<Fact>]
    let ``Facts: the two MEASURED float hazards are in the roster and read as OPPOSITE states`` () =
        // These are the two masses the F# module's header records from projecting a normalised
        // `SoftValue`: one ULP above and one ULP below 1. They are why `massShapeWithin` exists,
        // and why every double here is a bit pattern — neither is a short decimal literal.
        let vectors = vectorsOf "Facts"

        let above =
            vectors |> List.tryFind (fun v -> strOf (v.GetProperty "mass") "hex" = "3FF0000000000001")

        let below =
            vectors |> List.tryFind (fun v -> strOf (v.GetProperty "mass") "hex" = "3FEFFFFFFFFFFFFF")

        Assert.True(above.IsSome, "the +1 ULP mass (1.0000000000000002) is missing from the roster")
        Assert.True(below.IsSome, "the -1 ULP mass (0.9999999999999999) is missing from the roster")

        let a = scoreOf above.Value "t" "f"
        let b = scoreOf below.Value "t" "f"
        Assert.Equal(DualScore.Contradictory, DualScore.massShape a)
        Assert.Equal(DualScore.Ignorant, DualScore.massShape b)
        // …and the residuals whose SIGNS produced those two opposite readings are one ULP each.
        Assert.Equal("BCB0000000000000", toHex (DualScore.residual a))
        Assert.Equal("3CA0000000000000", toHex (DualScore.residual b))

    [<Fact>]
    let ``Facts: the two derivations of the excess agree bit-for-bit AWAY FROM ZERO`` () =
        // THE FINDING. `-(1 - mass)` (F#) and `mass - 1` (TypeScript) are the same double away
        // from zero, and are `-0.0` vs `+0.0` at zero. The transcript carries both intermediates
        // so the exception is visible rather than re-derived — wrongly — by the next reader.
        let vectors = vectorsOf "Facts"
        let mutable sawZero = false

        for v in vectors do
            let name = strOf v "name"
            let s = scoreOf v "t" "f"
            let r = DualScore.residual s
            assertBits (sprintf "%s.negatedResidual" name) (dblOf v "negatedResidual") (-r)
            assertBits (sprintf "%s.massMinusOne" name) (dblOf v "massMinusOne") (DualScore.mass s - 1.0)

            if r = 0.0 then
                sawZero <- true
                // Numerically equal, NOT bit-equal — and the difference must not escape: both
                // clamps route the zero through their `> 0` branch and emit POSITIVE zero.
                Assert.Equal("8000000000000000", toHex (-r))
                Assert.Equal("0000000000000000", toHex (DualScore.mass s - 1.0))
                Assert.Equal("0000000000000000", toHex (DualScore.ignorance s))
                Assert.Equal("0000000000000000", toHex (DualScore.contradiction s))
            else
                Assert.Equal(toHex (-r), toHex (DualScore.mass s - 1.0))

        Assert.True(sawZero, "no r = 0 vector in the roster — the signed-zero finding is untested")

    [<Fact>]
    let ``Facts: ignorance and contradiction are never both positive — one signed quantity, two halves`` () =
        for v in vectorsOf "Facts" do
            let s = scoreOf v "t" "f"
            Assert.True(DualScore.ignorance s >= 0.0)
            Assert.True(DualScore.contradiction s >= 0.0)
            Assert.Equal(0.0, min (DualScore.ignorance s) (DualScore.contradiction s))

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. massShapeWithin — on BOTH sides of the tolerance boundary
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Tolerance: massShapeWithin replays on both sides of the boundary`` () =
        let vectors = vectorsOf "Tolerance"
        Assert.NotEmpty vectors

        // The boundary is only pinned if the roster carries all three readings — otherwise a
        // function returning one constant would pass.
        let shapes = vectors |> List.map (fun v -> strOf v "expectedShape") |> Set.ofList
        Assert.True(shapes.Contains "coherent", "no coherent reading in the Tolerance roster")
        Assert.True(shapes.Contains "ignorant", "no ignorant reading in the Tolerance roster")
        Assert.True(shapes.Contains "contradictory", "no contradictory reading in the Tolerance roster")

        for v in vectors do
            let name = strOf v "name"
            let s = scoreOf v "t" "f"
            assertBits (sprintf "%s.residual" name) (dblOf v "residual") (DualScore.residual s)

            Assert.Equal(
                sprintf "%s within=%s" name (strOf v "expectedShape"),
                sprintf "%s within=%s" name (shapeWord (DualScore.massShapeWithin (dblOf v "tolerance") s))
            )

            Assert.Equal(
                sprintf "%s exact=%s" name (strOf v "exactShape"),
                sprintf "%s exact=%s" name (shapeWord (DualScore.massShape s))
            )

    [<Fact>]
    let ``Tolerance: a NaN tolerance folds to ZERO in BOTH runtimes`` () =
        // RISK 7, and it is the sharpest of them because the two languages' obvious spellings
        // disagree. F#'s `max 0.0 nan` is `0.0` — `0.0 < nan` is false, so `max` returns its first
        // argument. JavaScript's `Math.max(0, NaN)` is `NaN`, under which every comparison is
        // false and EVERY score reads `coherent`. The TypeScript side therefore spells the fold
        // `tolerance > 0 ? tolerance : 0`, and this vector is what holds it there.
        let v =
            vectorsOf "Tolerance"
            |> List.tryFind (fun v -> strOf v "name" = "nan-tolerance-folds-to-zero")

        Assert.True(v.IsSome, "the NaN-tolerance vector is missing")
        let v = v.Value
        Assert.True(Double.IsNaN(dblOf v "tolerance"))
        let s = scoreOf v "t" "f"
        // Folding to NaN would read `coherent`; folding to 0 reads the exact shape, which for this
        // fixture is `contradictory`. The two are distinguishable, which is what makes it a test.
        Assert.Equal(DualScore.massShape s, DualScore.massShapeWithin nan s)
        Assert.Equal(DualScore.Contradictory, DualScore.massShapeWithin nan s)

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. swapLegs — an involution, and every fact is invariant under it
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Swap: legs swap, twice is identity, and every fact is invariant`` () =
        let vectors = vectorsOf "Swap"
        Assert.NotEmpty vectors

        // CONTROL. `swapLegs = id` satisfies every invariance assertion below, and genuinely
        // satisfies the fixed points (`vacuous`, `both`). The roster must therefore contain a
        // vector where swapping MOVES the score.
        let moved =
            vectors
            |> List.filter (fun v -> strOf (v.GetProperty "t") "hex" <> strOf (v.GetProperty "swappedT") "hex")

        Assert.True(not (List.isEmpty moved), "no Swap vector where swapping changes the score — the block is vacuous")

        for v in vectors do
            let name = strOf v "name"
            let s = scoreOf v "t" "f"
            let once = DualScore.swapLegs s
            assertBits (sprintf "%s.swappedT" name) (dblOf v "swappedT") once.TrueChance
            assertBits (sprintf "%s.swappedF" name) (dblOf v "swappedF") once.FalseChance
            let twice = DualScore.swapLegs once
            assertBits (sprintf "%s.twiceT" name) (dblOf v "twiceT") twice.TrueChance
            assertBits (sprintf "%s.twiceF" name) (dblOf v "twiceF") twice.FalseChance
            assertBits (sprintf "%s.swappedMass" name) (dblOf v "swappedMass") (DualScore.mass once)
            assertBits (sprintf "%s.swappedResidual" name) (dblOf v "swappedResidual") (DualScore.residual once)
            assertBits (sprintf "%s.swappedIgnorance" name) (dblOf v "swappedIgnorance") (DualScore.ignorance once)

            assertBits
                (sprintf "%s.swappedContradiction" name)
                (dblOf v "swappedContradiction")
                (DualScore.contradiction once)

            Assert.Equal(strOf v "swappedMassShape", shapeWord (DualScore.massShape once))
            // Order 2, structurally — this is what separates Belnap's FOUR from a `C₄` compass.
            Assert.Equal(s, twice)

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. toyJoin — the knowledge-order join
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Join: componentwise max, commutative, and every pinned fact about the result`` () =
        let vectors = vectorsOf "Join"
        Assert.NotEmpty vectors

        for v in vectors do
            let name = strOf v "name"
            let a = scoreOf v "aT" "aF"
            let b = scoreOf v "bT" "bF"
            let j = DualScore.toyJoin a b
            assertBits (sprintf "%s.joinT" name) (dblOf v "joinT") j.TrueChance
            assertBits (sprintf "%s.joinF" name) (dblOf v "joinF") j.FalseChance
            let c = DualScore.toyJoin b a
            assertBits (sprintf "%s.commutedT" name) (dblOf v "commutedT") c.TrueChance
            assertBits (sprintf "%s.commutedF" name) (dblOf v "commutedF") c.FalseChance
            assertBits (sprintf "%s.joinResidual" name) (dblOf v "joinResidual") (DualScore.residual j)
            assertBits (sprintf "%s.joinContradiction" name) (dblOf v "joinContradiction") (DualScore.contradiction j)
            Assert.Equal(strOf v "joinMassShape", shapeWord (DualScore.massShape j))
            // Idempotent and commutative as STRUCTURE, not just on this pair's values.
            Assert.Equal(j, DualScore.toyJoin j j)

    [<Fact>]
    let ``Join: two witnesses who disagree land on the GLUT, not on a confident true`` () =
        // RISK 6. The truth-order join `(max t, min f)` would give `{1,0}` here — a decision
        // manufactured out of a standoff, which is precisely the collapse the dual pair exists to
        // prevent and precisely where Dempster's rule misbehaves (Zadeh 1979/1986). The
        // knowledge-order join gives `{1,1}`: contradiction 1, handed onward intact.
        let v =
            vectorsOf "Join"
            |> List.tryFind (fun v -> strOf v "name" = "two-witnesses-who-disagree")

        Assert.True(v.IsSome, "the disagreeing-witnesses vector is missing")
        let v = v.Value
        let j = DualScore.toyJoin (scoreOf v "aT" "aF") (scoreOf v "bT" "bF")
        Assert.Equal(DualScore.both, j)
        Assert.Equal(1.0, DualScore.contradiction j)

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. toyClassify — the one judging function
    // ═══════════════════════════════════════════════════════════════════════════

    [<Fact>]
    let ``Classify: every reading and every margin refusal replays`` () =
        let vectors = vectorsOf "Classify"
        Assert.NotEmpty vectors

        for v in vectors do
            let name = strOf v "name"
            let s = scoreOf v "t" "f"
            let exp = expected v

            match DualScore.toyClassify s (dblOf v "margin"), exp.GetProperty("ok").GetBoolean() with
            | Ok reading, true ->
                Assert.Equal(
                    sprintf "%s %s" name (strOf exp "reading"),
                    sprintf "%s %s" name (readingWord reading)
                )
            | Error e, false ->
                let reason, leg = refusalWords e
                Assert.Equal(sprintf "%s %s/%s" name (strOf exp "reason") (strOf exp "leg"), sprintf "%s %s/%s" name reason leg)
            | Ok reading, false ->
                failwithf "vector %s: TypeScript refused the margin, F# read %s" name (readingWord reading)
            | Error e, true -> failwithf "vector %s: TypeScript read a value, F# refused with %A" name e

    [<Fact>]
    let ``Classify: the same legs read differently at two margins — the judgement is the caller's`` () =
        let find n =
            vectorsOf "Classify" |> List.tryFind (fun v -> strOf v "name" = n)

        let low = find "same-score-different-margin-low"
        let high = find "same-score-different-margin-high"
        Assert.True(low.IsSome && high.IsSome, "the two same-score vectors are missing")
        // Same legs by bits…
        Assert.Equal(strOf (low.Value.GetProperty "t") "hex", strOf (high.Value.GetProperty "t") "hex")
        Assert.Equal(strOf (low.Value.GetProperty "f") "hex", strOf (high.Value.GetProperty "f") "hex")
        // …different reading. A classifier carrying a hidden default margin could not do this.
        Assert.NotEqual<string>(strOf (expected low.Value) "reading", strOf (expected high.Value) "reading")

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. Parsing untrusted input
    // ═══════════════════════════════════════════════════════════════════════════

    /// The two parsers read DIFFERENT CARRIERS — `parseDualScore` takes an `unknown` JSON value,
    /// `ofDynamicValue` takes the repo's own `DynamicValue`. So the transcript encodes the input
    /// STRUCTURALLY and each runtime builds its own carrier. A transcript carrying raw JSON could
    /// not express a NaN leg at all (JSON has no such literal), and the NaN leg is the only way a
    /// well-SHAPED row reaches `not-finite` through the parser.
    let private buildDynamic (input: JsonElement) : DynamicValue =
        let fieldValue (el: JsonElement) : DynamicValue =
            match strOf el "kind" with
            | "float" -> DynamicValue.Float(ofHex (strOf el "hex"))
            | "int" -> DynamicValue.Int(Int64.Parse(strOf el "value", CultureInfo.InvariantCulture))
            | "string" -> DynamicValue.String(strOf el "value")
            | "bool" -> DynamicValue.Bool(el.GetProperty("value").GetBoolean())
            | "null" -> DynamicValue.Null
            | other -> failwithf "unknown encoded field kind: %s" other

        match strOf input "shape" with
        | "array" -> DynamicValue.Array []
        | "null" -> DynamicValue.Null
        | "number" -> DynamicValue.Float(ofHex (strOf input "hex"))
        | "string" -> DynamicValue.String "not a score"
        | "bool" -> DynamicValue.Bool true
        | "object" ->
            let fields =
                [ for f in input.GetProperty("fields").EnumerateArray() -> strOf f "key", fieldValue (f.GetProperty "value") ]

            DynamicValue.Object fields
        | other -> failwithf "unknown encoded shape: %s" other

    [<Fact>]
    let ``Parse: every parse vector replays, accepted and refused alike`` () =
        let vectors = vectorsOf "Parse"
        Assert.NotEmpty vectors

        // CONTROL, again: a parser that refused every input passes every refusal vector below.
        let accepted =
            vectors |> List.filter (fun v -> (expected v).GetProperty("ok").GetBoolean())

        Assert.True(List.length accepted >= 4, "the Parse roster has too few ACCEPTED vectors to be a control")

        for v in vectors do
            let name = strOf v "name"
            assertResult name (expected v) (DualScore.ofDynamicValue (buildDynamic (v.GetProperty "input")))

    [<Fact>]
    let ``Parse: a missing leg is REFUSED, never defaulted to 0`` () =
        // RISK 8. `0` is a real and meaningful value here — "evidence landed and found nothing" —
        // so a default would make it indistinguishable from "no field was sent", and the ledger
        // would carry a measurement nobody took.
        for name in [ "missing-false-leg"; "missing-true-leg"; "empty-object" ] do
            let v =
                vectorsOf "Parse" |> List.tryFind (fun v -> strOf v "name" = name)

            Assert.True(v.IsSome, sprintf "the %s vector is missing" name)
            Assert.False((expected v.Value).GetProperty("ok").GetBoolean())

            match DualScore.ofDynamicValue (buildDynamic (v.Value.GetProperty "input")) with
            | Ok s -> failwithf "%s: F# defaulted a missing leg to {%f,%f}" name s.TrueChance s.FalseChance
            | Error _ -> ()

    [<Fact>]
    let ``Parse: the F# round-trip agrees with the treaty's accepted legs`` () =
        // `toDynamicValue` is F#-only (TypeScript's consumer hands `parseDualScore` a plain JSON
        // object). It is still checked here, because a writer that disagreed with its own reader
        // would emit rows the OTHER runtime could not read either.
        for v in vectorsOf "Parse" do
            let exp = expected v

            if exp.GetProperty("ok").GetBoolean() then
                match DualScore.ofDynamicValue (buildDynamic (v.GetProperty "input")) with
                | Error e -> failwithf "vector %s: expected Ok, got %A" (strOf v "name") e
                | Ok s ->
                    match DualScore.ofDynamicValue (DualScore.toDynamicValue s) with
                    | Ok back -> Assert.Equal(s, back)
                    | Error e -> failwithf "vector %s: round-trip refused its own output (%A)" (strOf v "name") e
