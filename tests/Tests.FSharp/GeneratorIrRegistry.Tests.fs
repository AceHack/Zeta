module Zeta.Tests.GeneratorIrRegistryTests

open System.IO
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════
// GeneratorIrRegistry — the generator IR carried as a LIVE TUPLE on a DBSP Z-set relation.
//
// This closes the codegen-forward trajectory's last open thread: the splitmix64/fmix32
// oracle IR is no longer ONLY a checked-in *.ir.json document — it is the PAYLOAD of a row
// on a real `ZSet<IrRow>`. These tests pin the four facts that make that claim honest:
//   1. MATERIALISED VIEW   — the relation row's `IrCanonicalJson` reproduces the committed
//                            cross-verification *.ir.json byte-for-byte (so the file the TS
//                            oracle reads is a projection of the row, not an independent
//                            artifact). Combined with DynamicValue.Canonical.Tests' TS↔F#
//                            byte-lock, the row is locked all the way to the TS oracle.
//   2. GROUP LAW           — register r + retract r = Zero (the abelian-group inverse a Bag
//                            cannot satisfy; why the Z-set is the DBSP substrate for undo).
//   3. full == incremental — relationOf rows == fold (+) of per-row +1 deltas (DBSP
//                            incrementalization soundness on the constant stream).
//   4. CONTENT-ADDRESS     — the row's ZetaId IS GeneratorRegistry.idOf name version, and
//                            byZetaId returns a LIVE row but NOT a retracted one (rollback
//                            observed through the same query, no separate tombstone).
// ═══════════════════════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private irFile (primitive: string) (name: string) =
    Path.Join(repoRoot (), "tests", "cross-verification", primitive, "_gen", name)

// ── 1. materialised view: the row payload reproduces the committed *.ir.json byte-for-byte ──

[<Theory>]
[<InlineData("rng.splitmix64", 1, "splitmix64", "splitmix64.ir.json")>]
[<InlineData("hash.fmix32", 1, "fmix32", "fmix32.ir.json")>]
[<InlineData("hash.fmix64", 1, "fmix64", "fmix64.ir.json")>]
[<InlineData("rng.xoshiro256ss", 1, "xoshiro256ss", "xoshiro256ss.ir.json")>]
let ``IR relation row reproduces the committed cross-verification IR file byte-for-byte``
    (name: string)
    (version: int)
    (primitive: string)
    (file: string)
    =
    let r =
        GeneratorIrRegistry.known
        |> List.tryFind (fun r -> r.Name = name && r.Version = version)

    Assert.True(r.IsSome, sprintf "no known IR row for %s@%d" name version)
    let committed = (File.ReadAllText(irFile primitive file)).Trim()
    Assert.Equal(committed, r.Value.IrCanonicalJson)

[<Fact>]
let ``decodeIr round-trips the row payload back through the real canonical decoder`` () =
    for r in GeneratorIrRegistry.known do
        match GeneratorIrRegistry.decodeIr r with
        | Ok dv ->
            match DynamicValue.toCanonicalJson dv with
            | Ok reJson -> Assert.Equal(r.IrCanonicalJson, reJson) // fixed point: decode∘encode = id on the row
            | Error e -> failwithf "re-encode of %s failed: %A" r.Name e
        | Error e -> failwithf "decodeIr of %s failed: %A" r.Name e

// ── 2. register / retract obey the abelian-group law ──

[<Fact>]
let ``register r + retract r = Zero (group inverse; the DBSP undo law)`` () =
    let r = List.head GeneratorIrRegistry.known
    let net = ZSet.add (GeneratorIrRegistry.register r) (GeneratorIrRegistry.retract r)
    Assert.True(net.IsEmpty, "register then retract must cancel to the empty relation")

[<Fact>]
let ``retract removes exactly one row from a populated relation`` () =
    let r = List.head GeneratorIrRegistry.known
    let afterRetract = ZSet.add GeneratorIrRegistry.relation (GeneratorIrRegistry.retract r)
    // the retracted row is now absent (net weight 0); every OTHER known row survives.
    Assert.Equal(0L, ZSet.lookup r afterRetract)
    for other in GeneratorIrRegistry.known |> List.filter (fun x -> x <> r) do
        Assert.Equal(1L, ZSet.lookup other afterRetract)

// ── 3. full == incremental (DBSP incrementalization soundness) ──

[<Fact>]
let ``relationOf (full) equals incremental fold of per-row deltas`` () =
    let full = GeneratorIrRegistry.relationOf GeneratorIrRegistry.known
    let incr = GeneratorIrRegistry.incremental GeneratorIrRegistry.known
    // equal as Z-sets: their difference is the empty relation (a + (-b) = Zero ⇔ a = b).
    Assert.True((ZSet.add full (ZSet.neg incr)).IsEmpty, "full and incremental relations must be byte-identical Z-sets")
    Assert.Equal(full.Count, incr.Count)

// ── 4. content-address + byZetaId liveness ──

[<Fact>]
let ``each IR row's ZetaId is the real GeneratorRegistry content-address`` () =
    for r in GeneratorIrRegistry.known do
        Assert.Equal(GeneratorRegistry.idOf r.Name r.Version, r.ZetaId)

[<Fact>]
let ``byZetaId resolves a live row but not a retracted one`` () =
    let r = List.head GeneratorIrRegistry.known
    // live in the full relation
    match GeneratorIrRegistry.byZetaId r.ZetaId GeneratorIrRegistry.relation with
    | Some hit -> Assert.Equal(r, hit)
    | None -> failwith "live row must resolve by its ZetaId"
    // absent after retraction (rollback observed through the same query)
    let afterRetract = ZSet.add GeneratorIrRegistry.relation (GeneratorIrRegistry.retract r)
    Assert.True(
        (GeneratorIrRegistry.byZetaId r.ZetaId afterRetract).IsNone,
        "a retracted row must NOT resolve by its ZetaId"
    )


// ── 5. RUNNING DBSP CIRCUIT: the relation as the integral of a delta stream ─────────
//
// The four facts above treat the relation as a constant value or a static sum of
// deltas. These pin the final rung: the deltas ARRIVE OVER TIME on a real DBSP circuit
// (ZSetInput -> IntegrateZSet -> Output, stepped once per delta), and the integrator's
// output is the materialised relation. This is the same `∫` operator the rest of the
// engine runs, specialised to the generator-IR relation.

// 5a. The running integral of the +1 register deltas CONVERGES to the full relation:
//     integrateRegisters known == relationOf known (DBSP incrementalisation soundness).
[<Fact>]
let ``streaming the register deltas through a DBSP circuit materialises relationOf`` () =
    task {
        let! materialised = GeneratorIrRegistry.Stream.integrateRegisters GeneratorIrRegistry.known
        let full = GeneratorIrRegistry.relation
        Assert.True(
            (ZSet.add materialised (ZSet.neg full)).IsEmpty,
            "circuit-materialised relation must equal relationOf known"
        )
        Assert.Equal(full.Count, materialised.Count)
    }

// 5b. A retract (-1) delta arriving LATER removes the row from the live output — rollback
//     observed mid-stream on a running circuit, not just in the static algebra.
[<Fact>]
let ``a retract delta arriving on the stream removes the row from the live integral`` () =
    task {
        let r = List.head GeneratorIrRegistry.known
        // register r, then later retract r: the running integral must end empty of r.
        let deltas =
            [ GeneratorIrRegistry.register r; GeneratorIrRegistry.retract r ]
        let! trajectory = GeneratorIrRegistry.Stream.stepwise deltas
        match trajectory with
        | [ afterRegister; afterRetract ] ->
            Assert.Equal(1L, ZSet.lookup r afterRegister) // present after the +1 step
            Assert.Equal(0L, ZSet.lookup r afterRetract) // gone after the -1 step
            Assert.True((GeneratorIrRegistry.byZetaId r.ZetaId afterRetract).IsNone)
        | _ -> failwith "expected a two-step trajectory"
    }

// 5c. ORDER INDEPENDENCE: the integral is a sum in the abelian group, so any interleaving
//     of the SAME multiset of deltas yields the SAME materialised relation.
[<Fact>]
let ``the running integral is order-independent over the same multiset of deltas`` () =
    task {
        match GeneratorIrRegistry.known with
        | a :: b :: _ ->
            let! forward =
                GeneratorIrRegistry.Stream.integrateDeltas
                    [ GeneratorIrRegistry.register a; GeneratorIrRegistry.register b ]
            let! reversed =
                GeneratorIrRegistry.Stream.integrateDeltas
                    [ GeneratorIrRegistry.register b; GeneratorIrRegistry.register a ]
            Assert.True(
                (ZSet.add forward (ZSet.neg reversed)).IsEmpty,
                "delta order must not change the materialised relation"
            )
        | _ -> () // need at least two known rows; skip otherwise
    }

// ═══════════════════════════════════════════════════════════════════════════════════
// 6. LIVE, EXTERNAL delta feed (zero-downtime schema evolution) — GeneratorIrRegistry.LiveStream
//    Section 5 drains a finite pre-baked list through a build-and-tear-down circuit.
//    These tests use `LiveStream`, where the circuit is built ONCE and kept RUNNING
//    while deltas arrive FROM OUTSIDE on a bounded channel (a genuine producer/consumer
//    boundary), with the materialised relation observed BETWEEN arrivals. This is the
//    in-process core of "zero-downtime schema evolution over a live feed". (Durability /
//    multi-node / crash-replay remain separate obligations — NOT claimed here.)
// ═══════════════════════════════════════════════════════════════════════════════════

// 6a. Correctness AT EVERY OBSERVATION POINT: after k externally-sent register deltas,
//     the live relation equals relationOf over exactly those k rows admitted so far —
//     not only at end-of-stream, but at each step of a still-running circuit.
[<Fact>]
let ``live external feed: relation at each step equals relationOf over rows admitted so far`` () =
    task {
        let rows = GeneratorIrRegistry.known
        let session = GeneratorIrRegistry.LiveStream.openSession 16
        let mutable admitted = []

        for r in rows do
            let! observed = GeneratorIrRegistry.LiveStream.feedAndObserve session (GeneratorIrRegistry.register r)
            admitted <- admitted @ [ r ]
            let expected = GeneratorIrRegistry.relationOf admitted
            // observed == expected as Z-sets (difference is empty) and same cardinality.
            Assert.True(
                (ZSet.add observed (ZSet.neg expected)).IsEmpty,
                sprintf "live relation diverged from relationOf after admitting %d rows" admitted.Length
            )
            Assert.Equal(expected.Count, observed.Count)
        // and the final live relation equals the full known relation.
        Assert.True((ZSet.add session.Relation (ZSet.neg GeneratorIrRegistry.relation)).IsEmpty)
    }

// 6b. ZERO-DOWNTIME IR SWAP: while the circuit runs, an externally-fed retract(old)+register(new)
//     evolves a generator's IR row with NO dropped or duplicated rows — old gone, new live,
//     in one observation step, every other row untouched.
[<Fact>]
let ``live external feed: evolving a generator IR row is a lossless swap on a running circuit`` () =
    task {
        // Start the circuit with both known rows live.
        let session = GeneratorIrRegistry.LiveStream.openSession 16

        for r in GeneratorIrRegistry.known do
            do! GeneratorIrRegistry.LiveStream.feed session (GeneratorIrRegistry.register r)

        let oldRow =
            GeneratorIrRegistry.known |> List.find (fun r -> r.Name = "rng.splitmix64")

        // A NEW IR shape for the same generator@version: same identity, different payload
        // (an extra finalising xorshr). The row's structural key changes, so the swap is
        // retract(old) + register(new) — a new fact, not a silent mutate.
        let evolvedIr =
            match GeneratorIrRegistry.decodeIr oldRow with
            | Ok(DynamicValue.Object fields) ->
                let bump =
                    fields
                    |> List.map (fun (k, v) ->
                        if k = "ops" then
                            match v with
                            | DynamicValue.Array ops ->
                                k,
                                DynamicValue.Array(
                                    ops
                                    @ [ DynamicValue.Object [ ("op", DynamicValue.String "xorshr"); ("s", DynamicValue.Int 17L) ] ]
                                )
                            | other -> k, other
                        else
                            k, v)

                DynamicValue.Object bump
            | _ -> failwith "expected splitmix64 IR to decode to an Object"

        let newRow =
            match GeneratorIrRegistry.row oldRow.Name oldRow.Version evolvedIr with
            | Ok r -> r
            | Error _ -> failwith "evolved IR must be canonical-encodable"

        let countBefore = session.Relation.Count
        let! after = GeneratorIrRegistry.LiveStream.evolve session oldRow newRow

        // old row gone, new row live, total row count unchanged (lossless swap).
        Assert.Equal(0L, ZSet.lookup oldRow after)
        Assert.Equal(1L, ZSet.lookup newRow after)
        Assert.Equal(countBefore, after.Count)
        // the OTHER generator (fmix32) is untouched by the swap.
        let fmix =
            GeneratorIrRegistry.known |> List.find (fun r -> r.Name = "hash.fmix32")

        Assert.Equal(1L, ZSet.lookup fmix after)
    }

// 6c. CONTENT-ADDRESS across a live evolution: a same-version IR change keeps the
//     generator's ZetaId (identity is name@version, not payload), while a VERSION BUMP
//     yields a NEW content-address — the "version bump = new fact" rule survives the feed.
[<Fact>]
let ``live external feed: ZetaId is payload-independent within a version and changes on version bump`` () =
    task {
        let session = GeneratorIrRegistry.LiveStream.openSession 16

        let v1 =
            GeneratorIrRegistry.known |> List.find (fun r -> r.Name = "rng.splitmix64")

        do! GeneratorIrRegistry.LiveStream.feed session (GeneratorIrRegistry.register v1)

        // same name@version, different payload → SAME ZetaId (content-address of name@version).
        let v1Evolved =
            match GeneratorIrRegistry.row "rng.splitmix64" 1 GeneratorIrRegistry.fmix32Ir with
            | Ok r -> r
            | Error _ -> failwith "canonical"

        Assert.Equal(v1.ZetaId, v1Evolved.ZetaId)

        // version bump → DIFFERENT ZetaId (a new fact / a new generator identity).
        let v2 =
            match GeneratorIrRegistry.row "rng.splitmix64" 2 GeneratorIrRegistry.splitmix64Ir with
            | Ok r -> r
            | Error _ -> failwith "canonical"

        Assert.NotEqual<string>(v1.ZetaId, v2.ZetaId)

        // feeding v2 alongside v1 leaves BOTH live (distinct ids = distinct rows), so a
        // version bump on a running feed is additive, not a destructive overwrite.
        let! after = GeneratorIrRegistry.LiveStream.feedAndObserve session (GeneratorIrRegistry.register v2)
        Assert.True((GeneratorIrRegistry.byZetaId v1.ZetaId after).IsSome)
        Assert.True((GeneratorIrRegistry.byZetaId v2.ZetaId after).IsSome)
    }
