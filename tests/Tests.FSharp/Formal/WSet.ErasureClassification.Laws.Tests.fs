module Zeta.Tests.Formal.WSetErasureClassificationLawsTests

open System
open System.Globalization
open System.Reflection
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// WHICH FOUR-CORNER OPERATIONS ACTUALLY ERASE (the Landauer siting)
//
// The chain this repo asserts — "a Z-set retraction (−1) is the antiparticle,
// running the fold backward is CP, and if the computation is reversible then
// Landauer is the meter" (#10603) — has one leg that does not carry weight.
//
// Landauer 1961 prices LOGICAL IRREVERSIBILITY: a step whose output does not
// determine its input dissipates >= kT·ln2 per bit lost. Bennett 1973 is the
// converse — a bijective step erases nothing and is thermodynamically FREE.
// So a meter pointed at a reversible operation is not a weak meter, it is a
// meter with no signal: it must read zero for every input, forever. That is
// the structural reason a Landauer check degenerates into a tautology, and it
// is why "we run reversibly" cannot be evidenced by metering the retraction.
//
// `WSet.negate` IS the retraction (WSet.fs: "negate — THE RETRACTION"), and it
// IS a bijection. It therefore pays nothing, and no honest meter placed on it
// could ever report otherwise. The information in this substrate is destroyed
// somewhere else — at `consolidate`, `discard`, `bornProb`, `plus`, `tensor`.
// `consolidate` is the sharpest case, because WSet.fs itself calls it the place
// "where interference/retraction happens — opposite weights annihilate here":
// the annihilation step is the ERASING one, even though the negation feeding it
// is not. Those two facts are routinely read as one, and they are not.
//
// WHAT THIS PACK IS. Not a counter bolted onto the hot path (an unread counter
// is the same defect one level out). It is a CLASSIFICATION that can go stale:
// every public `WSet` operation carries a DECLARED thermodynamic class, an
// exhaustive sweep MEASURES the class from the operation itself, and the two
// must agree. It fails when the claim stops being true — in either direction:
//
//   * a "reversible" op made lossy      -> declared Reversible, measured Erasing
//   * an erasing op made bijective       -> declared Erasing, measured Reversible
//   * a NEW op added without classifying -> reflection drift guard fails
//
// The bit count is measured, never asserted: bits erased = log2(largest fibre)
// — the exact quantity `entropy-tracker.ts` `measure(bitsErased)` takes on
// trust from its caller. Here it is derived from the operation.
//
// Anchors (Beacon): Landauer 1961 "Irreversibility and Heat Generation in the
// Computing Process"; Bennett 1973 "Logical Reversibility of Computation";
// Fritz 2020 / Fox 1976 (the comonoid `discard` is the categorical deletion);
// Aji–McEliece 2000 (the GDL semiring circuit `WSet` instantiates).
// Formal sibling: src/Core.Lean4/Lean4/LandauerFloor.lean — `permutation`
// (bijective, zero heat) vs `measure k` (k bits to the heat ledger).
// ═══════════════════════════════════════════════════════════════════

/// The ℤ '*'-ring — the DBSP base corner (`IntegerRing.Star`).
let private intStar: IStarRing<int64> = IntegerRing.Star

let private isZeroI (w: int64) = w = 0L

// ── the swept domain: every WSet over keys {0,1}, weights {−1,0,1}, length 0..2.
//    Small enough to enumerate exhaustively (43 states), large enough to contain
//    both the +w/−w annihilating pair and the zero-weight row. ──
let private pairs = [ for k in [ 0; 1 ] do for w in [ -1L; 0L; 1L ] -> (k, w) ]

let private domain: (int * int64) list list =
    [ yield ([]: (int * int64) list)
      for p in pairs do yield [ p ]
      for p in pairs do
          for q in pairs do yield [ p; q ] ]

let private domain2 = [ for a in domain do for b in domain -> (a, b) ]

// ── image keys, built with explicit invariant formatting (culture-invariant rule) ──
let private keyZ (s: (int * int64) list) =
    s |> List.map (fun (k, w) -> String.Format(CultureInfo.InvariantCulture, "{0}:{1}", k, w)) |> String.concat ","

let private keyZ2 (s: ((int * int) * int64) list) =
    s
    |> List.map (fun ((a, b), w) -> String.Format(CultureInfo.InvariantCulture, "{0}/{1}:{2}", a, b, w))
    |> String.concat ","

let private keyW (w: int64) = w.ToString(CultureInfo.InvariantCulture)

let private keyProb (s: (int * float) list) =
    s
    |> List.map (fun (k, p) ->
        String.Format(CultureInfo.InvariantCulture, "{0}:{1}", k, p.ToString("R", CultureInfo.InvariantCulture)))
    |> String.concat ","

/// Measure the class of an operation by exhaustive sweep: group the domain by image,
/// and read the largest fibre. maxFibre = 1 <=> injective. bits erased = log2(maxFibre).
let private measureClass
    (inputs: 'a list)
    (probe: 'a -> string)
    : WSetHeat.ThermodynamicClass * float * int =
    let fibres = inputs |> List.groupBy probe
    let maxFibre = fibres |> List.map (snd >> List.length) |> List.max

    let cls =
        if maxFibre = 1 then
            WSetHeat.ThermodynamicClass.Reversible
        else
            WSetHeat.ThermodynamicClass.Erasing

    cls, Math.Log(float maxFibre, 2.0), maxFibre

/// One source-owned profile paired with the executable specialization measured here.
type private Row =
    { Operation: WSetHeat.Operation
      Measure: unit -> WSetHeat.ThermodynamicClass * float * int }

let private table: Row list =
    [
      // ── the reversible corner: bijections. Bennett — free, and unmeterable. ──
      { Operation = WSetHeat.Operation.Negate
        Measure = fun () -> measureClass domain (WSet.negate intStar >> keyZ) }

      { Operation = WSetHeat.Operation.Copy
        Measure = fun () -> measureClass domain (WSet.copy >> keyZ2) }

      { Operation = WSetHeat.Operation.MapKeysInjective
        Measure = fun () -> measureClass domain (WSet.mapKeys id >> keyZ) }

      { Operation = WSetHeat.Operation.ApplyInjective
        Measure = fun () -> measureClass domain (WSet.apply intStar (fun k -> [ (k + 10), 1L ]) >> keyZ) }

      // ── the erasing corner: where the Landauer floor actually binds. ──
      { Operation = WSetHeat.Operation.Consolidate
        Measure = fun () -> measureClass domain (WSet.consolidate intStar isZeroI >> keyZ) }

      { Operation = WSetHeat.Operation.Discard
        Measure = fun () -> measureClass domain (WSet.discard intStar >> keyW) }

      { Operation = WSetHeat.Operation.BornProb
        Measure = fun () -> measureClass domain (WSet.bornProb (fun (w: int64) -> float w * float w) >> keyProb) }

      { Operation = WSetHeat.Operation.Plus
        Measure = fun () -> measureClass domain2 (fun (a, b) -> keyZ (WSet.plus a b)) }

      { Operation = WSetHeat.Operation.Tensor
        Measure = fun () -> measureClass domain2 (fun (a, b) -> keyZ2 (WSet.tensor intStar a b)) } ]

// ═══ 1. The declared class must match the measured class, per operation ═══
// This is the guard. Make `negate` drop zero weights, or make `consolidate`
// the identity, and the corresponding row fails.

[<Fact>]
let ``every declared thermodynamic class matches the exhaustively measured class`` () =
    let mismatches =
        table
        |> List.choose (fun row ->
            let measured, bits, fibre = row.Measure()
            let declared = WSetHeat.profile row.Operation

            if measured = declared.Classification then
                None
            else
                Some(
                    String.Format(
                        CultureInfo.InvariantCulture,
                        "{0} ({1}): declared {2} but measured {3} (largest fibre {4}, {5:F3} bits erased)",
                        declared.WSetFunction,
                        declared.Specialization,
                        declared.Classification,
                        measured,
                        fibre,
                        bits
                    )
                ))

    mismatches |> should be Empty

// ═══ 2. The bit count is a MEASUREMENT, not a declaration ═══
// Reversible ops must erase exactly zero bits; erasing ops must erase strictly
// more than zero. This is the quantity `entropy-tracker.ts` takes on trust.

[<Fact>]
let ``reversible operations erase exactly zero bits and erasing operations erase strictly more`` () =
    for row in table do
        let _, bits, fibre = row.Measure()
        let declared = WSetHeat.profile row.Operation
        let bitsPpm = int64 (Math.Round(bits * 1_000_000.0))

        fibre |> should equal declared.LargestFibre
        bitsPpm |> should equal declared.BitsErasedPpm

        match declared.Classification with
        | WSetHeat.ThermodynamicClass.Reversible ->
            fibre |> should equal 1
            bits |> should equal 0.0
        | WSetHeat.ThermodynamicClass.Erasing ->
            fibre |> should be (greaterThan 1)
            bits |> should be (greaterThan 0.0)
        | WSetHeat.ThermodynamicClass.Unmeasured ->
            // A swept operation always has a class. Reaching here means a profile claimed the
            // absence of a measurement while this pack was measuring it — a contradiction, and a
            // failure rather than a skip, because "unmeasured" must never read as "costs nothing".
            failwith "a WSet operation swept by this pack declared itself Unmeasured"

// ═══ 3. Drift guard — the table must cover the WHOLE public surface ═══
// A meter nobody updates is the same defect one level out. Add a tenth public
// operation to `WSet` and this fails until it is classified.

[<Fact>]
let ``the classification table covers exactly the public WSet operation surface`` () =
    // A concrete (non-abbreviation) type in Zeta.Core; `WSet<'K,'W>` is an alias for
    // a list, so `typeof<WSet<_,_>>` would resolve to FSharp.Core instead.
    let asm = typeof<FourCornerTrace.Traced<int, int, int64>>.Assembly
    let wsetModule = asm.GetType "Zeta.Core.WSet"
    wsetModule |> should not' (be null)

    let reflected =
        wsetModule.GetMethods(BindingFlags.Public ||| BindingFlags.Static ||| BindingFlags.DeclaredOnly)
        |> Array.map (fun mi -> mi.Name)
        |> Array.distinct
        |> Set.ofArray

    let declared =
        WSetHeat.allProfiles
        |> List.map (fun operationProfile -> operationProfile.WSetFunction)
        |> Set.ofList

    // Named separately so a failure says WHICH way it drifted.
    let unclassified = Set.difference reflected declared
    let stale = Set.difference declared reflected

    unclassified |> should be Empty
    stale |> should be Empty

// ═══ 4. The canonical Landauer erasure, witnessed in this substrate ═══
// Landauer's own example is two distinct states mapped to one. `consolidate`
// does exactly that to the annihilating pair — while `negate`, the retraction
// feeding it, keeps the two states apart.

[<Fact>]
let ``consolidate maps the annihilating pair and the empty set to one state - negate does not`` () =
    let annihilating = [ (0, 1L); (0, -1L) ]
    let empty: (int * int64) list = []

    // two distinct inputs …
    annihilating |> should not' (equal empty)

    // … one output. This is the erasure, and it is at consolidate.
    let ca = WSet.consolidate intStar isZeroI annihilating
    let ce = WSet.consolidate intStar isZeroI empty
    ca |> should equal ce
    ca |> should be Empty

    // the retraction itself separates them — it destroys nothing.
    WSet.negate intStar annihilating |> should not' (equal (WSet.negate intStar empty))

[<Fact>]
let ``the retraction is a self-inverse permutation of the state space - Bennett zero heat`` () =
    // self-inverse on every swept state
    for s in domain do
        WSet.negate intStar (WSet.negate intStar s) |> should equal s

    // and a permutation OF the domain (bijective onto it), not merely injective —
    // so there is no input for which a Landauer meter on `negate` could read nonzero.
    let image = domain |> List.map (WSet.negate intStar >> keyZ) |> Set.ofList
    let source = domain |> List.map keyZ |> Set.ofList
    image |> should equal source
