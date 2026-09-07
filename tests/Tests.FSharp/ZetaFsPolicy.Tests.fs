module Zeta.Tests.ZetaFsPolicyTests

open System
open System.Text
open global.Xunit
open Zeta.Core

let private utf8 (s: string) = Encoding.UTF8.GetBytes s

let private rng () =
    let e = Environment.createVirtual 13L :> Zeta.Core.ISimulationEnvironment
    ZetaFsNamespace.Entropy(fun () -> e.NextInt64())

let private asserter = ZetaFsNamespace.ActorId "test"

let private phase (n: int64) : ZetaFsNamespace.FsPhase =
    { Line = ZetaFsNamespace.PhaseLine
      Stamp = Versionstamp.ofInt64 n }

let private mintFile () =
    let next = rng ()
    let ns = ZetaFsNamespace.create next
    let id, _ = ZetaFsNamespace.mint ns ZetaFsNamespace.EntityKind.File next
    ns.Root, id

[<Fact>]
let ``ByEntity wins over ByPrefix and VolumeDefault`` () =
    let parent, id = mintFile ()
    let cat0 =
        ZetaFsPolicy.empty
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.VolumeDefault
                  Kind = ZetaFsPolicy.History ZetaFsPolicy.KeepAll
                  Phase = phase 1L
                  Asserter = asserter }
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.ByPrefix(parent, utf8 "src/")
                  Kind = ZetaFsPolicy.targetHistory
                  Phase = phase 2L
                  Asserter = asserter }
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.ByEntity id
                  Kind = ZetaFsPolicy.History ZetaFsPolicy.rollingDefault
                  Phase = phase 3L
                  Asserter = asserter }

    match ZetaFsPolicy.effectiveHistory cat0 id with
    | Some(ZetaFsPolicy.Rolling(Some 32, None, None)) -> ()
    | other -> Assert.Fail(sprintf "expected rolling 32, got %A" other)

[<Fact>]
let ``first bind copies nearest ByPrefix onto ByEntity`` () =
    let parent, id = mintFile ()
    let cat0 =
        ZetaFsPolicy.assertBinding
            ZetaFsPolicy.empty
            { Subject = ZetaFsPolicy.ByPrefix(parent, utf8 "src/")
              Kind = ZetaFsPolicy.sourceHistory
              Phase = phase 1L
              Asserter = asserter }

    let cat1 =
        ZetaFsPolicy.copyAtFirstBind cat0 id parent (utf8 "src/Core/ZetaFs.fs") (phase 2L) asserter

    match ZetaFsPolicy.effectiveHistory cat1 id with
    | Some ZetaFsPolicy.KeepAll -> ()
    | other -> Assert.Fail(sprintf "expected keep-all from src/ prefix, got %A" other)

[<Fact>]
let ``later ByPrefix edit does not rewrite an existing hub`` () =
    let parent, id = mintFile ()
    let cat0 =
        ZetaFsPolicy.assertBinding
            ZetaFsPolicy.empty
            { Subject = ZetaFsPolicy.ByPrefix(parent, utf8 "src/")
              Kind = ZetaFsPolicy.sourceHistory
              Phase = phase 1L
              Asserter = asserter }

    let cat1 =
        ZetaFsPolicy.copyAtFirstBind cat0 id parent (utf8 "src/a") (phase 2L) asserter

    let cat2 =
        ZetaFsPolicy.assertBinding
            cat1
            { Subject = ZetaFsPolicy.ByPrefix(parent, utf8 "src/")
              Kind = ZetaFsPolicy.targetHistory
              Phase = phase 9L
              Asserter = asserter }

    match ZetaFsPolicy.effectiveHistory cat2 id with
    | Some ZetaFsPolicy.KeepAll -> ()
    | other -> Assert.Fail(sprintf "hub must keep the first-bind copy, got %A" other)

[<Fact>]
let ``two-parent fixture: one EntityId, one policy (first bind)`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    let src = utf8 "src/a"
    let target = utf8 "target/a"
    let cat0 =
        ZetaFsPolicy.empty
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.ByPrefix(ns0.Root, utf8 "src/")
                  Kind = ZetaFsPolicy.sourceHistory
                  Phase = phase 1L
                  Asserter = asserter }
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.ByPrefix(ns0.Root, utf8 "target/")
                  Kind = ZetaFsPolicy.targetHistory
                  Phase = phase 1L
                  Asserter = asserter }

    match ZetaFsNamespace.bind ns1 ns0.Root src file asserter with
    | Error e -> Assert.Fail(sprintf "%A" e)
    | Ok ns2 ->
        let cat1 = ZetaFsPolicy.copyAtFirstBind cat0 file ns0.Root src (phase 2L) asserter

        match ZetaFsNamespace.bind ns2 ns0.Root target file asserter with
        | Error e -> Assert.Fail(sprintf "%A" e)
        | Ok _ ->
            let cat2 = ZetaFsPolicy.copyAtFirstBind cat1 file ns0.Root target (phase 3L) asserter
            match ZetaFsPolicy.effectiveHistory cat2 file with
            | Some ZetaFsPolicy.KeepAll -> ()
            | other -> Assert.Fail(sprintf "first-bind src/ keep-all must win, got %A" other)

            Assert.Equal(
                Some file,
                ZetaFsNamespace.liveResolve ns0.Root src ns2.Bindings
            )

[<Fact>]
let ``VolumeDefault applies when no prefix matches`` () =
    let parent, id = mintFile ()
    let cat0 =
        ZetaFsPolicy.assertBinding
            ZetaFsPolicy.empty
            { Subject = ZetaFsPolicy.VolumeDefault
              Kind = ZetaFsPolicy.History ZetaFsPolicy.rollingDefault
              Phase = phase 1L
              Asserter = asserter }

    let cat1 = ZetaFsPolicy.copyAtFirstBind cat0 id parent (utf8 "other") (phase 2L) asserter

    match ZetaFsPolicy.effectiveHistory cat1 id with
    | Some(ZetaFsPolicy.Rolling(Some 32, None, None)) -> ()
    | other -> Assert.Fail(sprintf "expected volume rolling default, got %A" other)

[<Fact>]
let ``two replicas with the same policy Z-set compute the same EffectivePolicy`` () =
    let parent, id = mintFile ()
    let a : ZetaFsPolicy.Binding =
        { Subject = ZetaFsPolicy.ByEntity id
          Kind = ZetaFsPolicy.sourceHistory
          Phase = phase 4L
          Asserter = asserter }
    let b : ZetaFsPolicy.Binding =
        { Subject = ZetaFsPolicy.VolumeDefault
          Kind = ZetaFsPolicy.targetHistory
          Phase = phase 1L
          Asserter = asserter }

    let left = ZetaFsPolicy.assertBinding (ZetaFsPolicy.assertBinding ZetaFsPolicy.empty a) b
    let right = ZetaFsPolicy.assertBinding (ZetaFsPolicy.assertBinding ZetaFsPolicy.empty b) a
    Assert.Equal(ZetaFsPolicy.effectiveHistory left id, ZetaFsPolicy.effectiveHistory right id)
    match ZetaFsPolicy.effectiveHistory left id with
    | Some ZetaFsPolicy.KeepAll -> ()
    | other -> Assert.Fail(sprintf "%A" other)

[<Fact>]
let ``source vs target fixtures are not OS dogma — they are named templates`` () =
    Assert.Equal(ZetaFsPolicy.History ZetaFsPolicy.KeepAll, ZetaFsPolicy.sourceHistory)
    Assert.Equal(ZetaFsPolicy.History ZetaFsPolicy.KeepNone, ZetaFsPolicy.targetHistory)
    Assert.Equal(ZetaFsPolicy.DurabilityDefault ZetaFsPolicy.Durable, ZetaFsPolicy.sourceDurability)
    Assert.Equal(ZetaFsPolicy.DurabilityDefault ZetaFsPolicy.Buffered, ZetaFsPolicy.targetDurability)

[<Fact>]
let ``policy catalog text round-trips VolumeDefault ByPrefix and ByEntity`` () =
    let parent, id = mintFile ()
    let cat0 =
        ZetaFsPolicy.empty
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.VolumeDefault
                  Kind = ZetaFsPolicy.History ZetaFsPolicy.rollingDefault
                  Phase = phase 0L
                  Asserter = asserter }
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.ByPrefix(parent, utf8 "src/")
                  Kind = ZetaFsPolicy.sourceHistory
                  Phase = phase 1L
                  Asserter = asserter }
        |> fun c ->
            ZetaFsPolicy.assertBinding
                c
                { Subject = ZetaFsPolicy.ByEntity id
                  Kind = ZetaFsPolicy.sourceHistory
                  Phase = phase 2L
                  Asserter = asserter }

    let text = ZetaFsPolicy.formatCatalog cat0
    let cat1 = ZetaFsPolicy.parseCatalog text
    Assert.Equal(ZetaFsPolicy.effectiveHistory cat0 id, ZetaFsPolicy.effectiveHistory cat1 id)
    match ZetaFsPolicy.effectiveHistory cat1 id with
    | Some ZetaFsPolicy.KeepAll -> ()
    | other -> Assert.Fail(sprintf "round-trip must keep ByEntity keep-all, got %A" other)
    match ZetaFsPolicy.volumeDefault cat1 ZetaFsPolicy.HistoryTag with
    | Some b ->
        match b.Kind with
        | ZetaFsPolicy.History(ZetaFsPolicy.Rolling(Some 32, None, None)) -> ()
        | other -> Assert.Fail(sprintf "volume-default rolling 32, got %A" other)
    | None -> Assert.Fail("volume-default must round-trip")
