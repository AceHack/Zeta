module Zeta.Tests.ShivaGcRegenTests

// THE REGENERABILITY DISJUNCT — `retain <=> reachable OR NOT regenerable`.
//
// WHY THIS FILE EXISTS. `ShivaGc.partition` splits a heap by reachability alone, so every unreachable
// object is PAUSED and nothing is ever freed. That is safe and it is also the whole cost: reachability
// is not the only reason to keep an object. If a generator can rebuild an object byte-identically,
// storing it is redundant — the real retention predicate is `reachable OR NOT regenerable`, and the
// interesting class is `unreachable AND regenerable`, which is genuinely free to drop.
//
// THE VACUITY TRAP THIS FILE IS BUILT TO AVOID, stated up front because the repo already contains the
// near-miss. `ShivaGc.Tests.fs` has a test named "NOTHING DIES: partition then resume reconstructs the
// heap byte-identically". That test is correct about what it measures — `partition` returns the paused
// objects WHOLE and `resume` concatenates them back — but the byte-identity it observes is trivially
// guaranteed, because the value was never dropped. It is a RETENTION test, and it is not evidence that
// anything can be regenerated. Comparing a retained value to itself is the "compared to itself"
// disposition (`no-binary-in-proof-lineage`, condition 2). So the test below never reads the collected
// object's value on the regeneration path: the replacement bytes are recomputed by RE-RUNNING the
// reified generator over its recipe, and the negative control at the bottom proves the comparison can
// actually fail.
//
// Proofs:
//   1. COMPATIBILITY: `partition3 (fun _ -> false)` IS `partition` — the no-oracle case is the
//      conservative default, so the disjunct generalizes the collector rather than replacing it.
//   2. THREE-WAY: unreachable+regenerable is droppable; unreachable+NOT-regenerable still PAUSES
//      (Memory Preservation, manifesto §5 — an unregenerable object may never be silently dropped).
//   3. CONSERVATION: the three classes partition the heap — nothing duplicated, nothing lost.
//   4. BYTE-IDENTITY: a dropped object, regenerated from its reified `MixCall` recipe, is byte-
//      identical under canonical CBOR to the object that was dropped. This is the falsifier that the
//      collect-and-regenerate discipline needs, at object granularity.
//   5. NEGATIVE CONTROL (mandatory): perturbing the recipe by ONE instruction changes the canonical
//      bytes. Without this, #4 is a check that cannot fail.
//
// Anchors: Futamura 1971 (mix over RETAINED inputs — determinism of regeneration); Zaharia et al. 2012
// (Spark RDD lineage — a lost partition is recomputed from its recipe, not replicated); McCarthy 1960.
// Register: ShivaGc stays `toy` (no production consumer). What this file promotes is narrower and
// stated exactly — regeneration is byte-identical FOR THE REIFIED-MIX GENERATOR. The oracle in general
// is only as sound as its caller.

open global.Xunit
open Zeta.Core

/// The canonical CBOR bytes of a value — the byte-identity instrument (`DvKey`'s content address).
let private bytes (v: DynamicValue) : byte[] = DynamicValue.toCanonicalCborOk v

let private ids (h: DynamicValue) =
    match h with
    | DynamicValue.Array xs ->
        xs
        |> List.choose (fun o ->
            match DynamicValue.get "id" o with
            | Some(DynamicValue.String s) -> Some s
            | _ -> None)
        |> List.sort
    | _ -> []

let private v (s: string) = DynamicValue.String s

// ── the generator: a reified mix invocation. Recipe IN (data), product OUT (data). ──────────────

/// A CHIP-8 program whose specialization is the product we will drop and rebuild.
let private program = Isa.prog [ Isa.set 0 5; Isa.add 0 3; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ]

/// The RECIPE — a whole mix invocation reified as one `DynamicValue` (`MixIr.mixCall`). This is the
/// object's generator, and it is data, so it is byte-lockable and travels wherever the heap travels.
let private recipeFor (p: DynamicValue) : DynamicValue =
    MixIr.mixCall IsaSpec.chip8 MixIr.chip8Load p Map.empty Map.empty

/// RUN the recipe — the regeneration step. Pure: same recipe in, same residual out (Futamura).
let private run (recipe: DynamicValue) : DynamicValue =
    match MixIr.runMixCall recipe with
    | Ok r ->
        match MixIr.residualOf r with
        | Some res -> res
        | None -> failwith "regen: no residual in the mix result"
    | Error e -> failwithf "regen: runMixCall failed: %s" e

// ── 1. COMPATIBILITY — the no-oracle case is exactly today's collector ──────────────────────────

[<Fact>]
let ``COMPATIBILITY: partition3 with NO regeneration oracle is exactly partition (conservative default)``
    ()
    =
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") []
              ShivaGc.object' "island1" (v "i1") []
              ShivaGc.object' "island2" (v "i2") [] ]
    let resident0, paused0 = ShivaGc.partition [ "root" ] h
    let resident1, droppable1, paused1 = ShivaGc.partition3 (fun _ -> false) [ "root" ] h
    // Byte-identical, not merely same-ids: the generalization must not perturb the existing behaviour.
    Assert.Equal<byte[]>(bytes resident0, bytes resident1)
    Assert.Equal<byte[]>(bytes paused0, bytes paused1)
    // With no oracle NOTHING is droppable — which is why `partition` frees nothing.
    Assert.Equal<byte[]>(bytes (DynamicValue.Array []), bytes droppable1)

// ── 2. THREE-WAY — and the §5 guard: unregenerable garbage still pauses ─────────────────────────

[<Fact>]
let ``THREE-WAY: unreachable+regenerable is DROPPABLE; unreachable+unregenerable still PAUSES (§5)`` () =
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") []
              ShivaGc.object' "derived" (run (recipeFor program)) [] // garbage, but rebuildable
              ShivaGc.object' "handwritten" (v "no-generator") [] ] // garbage, and NOT rebuildable
    // The oracle: only "derived" has a recipe. It is INJECTED — the collector knows nothing of MixIr.
    let regenerable id = id = "derived"
    let resident, droppable, paused = ShivaGc.partition3 regenerable [ "root" ] h
    Assert.Equal<string list>([ "A"; "root" ], ids resident)
    Assert.Equal<string list>([ "derived" ], ids droppable)
    // THE GUARD: an unreachable object with no generator is NOT free. Dropping it would destroy
    // memory that nothing can rebuild — manifesto §5. It pauses.
    Assert.Equal<string list>([ "handwritten" ], ids paused)

[<Fact>]
let ``CONSERVATION: the three classes partition the heap — nothing duplicated, nothing lost`` () =
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") []
              ShivaGc.object' "derived" (run (recipeFor program)) []
              ShivaGc.object' "handwritten" (v "x") []
              ShivaGc.object' "" (v "id-less") [] ]
    let resident, droppable, paused = ShivaGc.partition3 (fun id -> id = "derived") [ "root" ] h
    let all = ids resident @ ids droppable @ ids paused |> List.sort
    // Every object exactly once. The list equality below ALREADY discharges "no
    // duplication": equal lists have equal lengths, so a separate length assertion is
    // strictly implied by this one and constrains nothing. It was here and is deleted
    // rather than registered in the arity census -- recording a redundant assertion as
    // a legitimate check is the vacuity class acquiring a permanent home.
    Assert.Equal<string list>(ids h, all)

// ── 4. THE FALSIFIER — byte-identity across an actual drop ──────────────────────────────────────

[<Fact>]
let ``BYTE-IDENTITY: an object DROPPED by partition3 is regenerated byte-identically from its recipe``
    ()
    =
    let recipe = recipeFor program
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") []
              ShivaGc.object' "derived" (run recipe) [] ] // unreachable from root
    let _resident, droppable, paused = ShivaGc.partition3 (fun id -> id = "derived") [ "root" ] h
    Assert.Equal<string list>([ "derived" ], ids droppable)
    Assert.Equal<string list>([], ids paused)

    // Snapshot the bytes of what is about to be dropped, then DROP the object. From here on the only
    // surviving description of that value is `recipe` — the generator, which sits OUTSIDE the
    // collected set (that exclusion is what makes regeneration total; it is the design, not a leak).
    let droppedBytes =
        match droppable with
        | DynamicValue.Array [ o ] ->
            match DynamicValue.get "value" o with
            | Some value -> bytes value
            | None -> failwith "droppable object has no value"
        | _ -> failwith "expected exactly one droppable object"

    // REGENERATE — recomputed by re-running the generator over the recipe. Note what is NOT read
    // here: the dropped object. These bytes are produced, not copied.
    let regeneratedBytes = bytes (run recipe)

    // THE GOLDEN VECTOR -- committed hex, per `.claude/rules/no-binary-in-proof-lineage.md`
    // (verification artifacts are TEXT: diffable, mergeable, DST-replayable).
    //
    // WHY A THIRD PARTY IS REQUIRED. The heap above stores `run recipe` as the object's value, so
    // `droppedBytes` traces back to `bytes (run recipe)` -- which is exactly what
    // `regeneratedBytes` is. Asserting those two equal establishes that `run` is DETERMINISTIC
    // (real, and DST depends on it) but NOT the claim this test is named for: that regeneration
    // reproduces what was dropped. It cannot, while what was dropped is DEFINED as the
    // regeneration. Pinning both sides against a committed literal breaks the shared producer:
    // neither side is defined in terms of the other, and the expectation lives outside the code
    // under test where a reviewer can read it.
    let goldenHex =
        "83a3626f7063534554617800626e6e08a3626f706441444452617801617900a3626f70634d4f56617802617901"

    let toHex (b: byte[]) = System.Convert.ToHexString(b).ToLowerInvariant()

    Assert.Equal(goldenHex, toHex droppedBytes)
    Assert.Equal(goldenHex, toHex regeneratedBytes)

// ── 5. NEGATIVE CONTROL — without this, #4 is a check that cannot fail ──────────────────────────

[<Fact>]
let ``NEGATIVE CONTROL: perturbing the recipe by ONE instruction changes the bytes (the check can fail)``
    ()
    =
    let original = bytes (run (recipeFor program))
    // One instruction different: `add 0 3` becomes `add 0 4`. Everything else is identical.
    let perturbed = Isa.prog [ Isa.set 0 5; Isa.add 0 4; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ]
    let perturbedBytes = bytes (run (recipeFor perturbed))
    Assert.NotEqual<byte[]>(original, perturbedBytes)
    // ...and the difference above is the RECIPE'S, not run-to-run noise (DST). That determinism
    // claim used to live here as `Assert.Equal(original, bytes (run (recipeFor program)))`, which
    // does real work at runtime -- two separate evaluations -- but is TEXTUALLY `X = X` once
    // `original` is inlined, so `audit-check-arity` R2 could not distinguish it from a tautology
    // and was right not to try. It is discharged upstream and more strongly now: §4 pins
    // `run recipe` against a COMMITTED GOLDEN LITERAL, so determinism is checked against a third
    // party rather than a second evaluation of itself. Deleted rather than registered in the
    // census -- a syntactic self-comparison a reader cannot audit is not worth keeping once a
    // third party discharges the same claim.
