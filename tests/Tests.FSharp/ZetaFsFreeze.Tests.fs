[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.ZetaFsFreezeTests

open System
open System.Globalization
open System.IO
open System.Text
open System.Threading
open System.Threading.Tasks
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

let private rng () =
    let e = Environment.createVirtual 17L :> Zeta.Core.ISimulationEnvironment
    ZetaFsNamespace.Entropy(fun () -> e.NextInt64())

let private mintId () =
    let entropy = rng ()
    let ns = ZetaFsNamespace.create entropy
    let id, _ = ZetaFsNamespace.mint ns ZetaFsNamespace.EntityKind.File entropy
    id

let private ensureHasher () =
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)

let private tempStore () =
    let path = Path.Combine(Path.GetTempPath(), sprintf "zetafs-freeze-%s" (Guid.NewGuid().ToString("N")))
    Directory.CreateDirectory path |> ignore
    path

let private freezeAsync (volume: ZetaFsFreeze.Volume) id cls =
    ZetaFsFreeze.freezeAsync volume id cls CancellationToken.None

let private assertJournaledCasTrace (stage: string) (fs: InMemoryFileSystem) =
    let captured = fs :> IFileSystem

    Assert.True(
        Object.ReferenceEquals(captured, FileSystem.Current),
        sprintf "ZetaFs CAS trace: provider-changed at %s" stage
    )

    Assert.True(
        fs.Files.ContainsKey "/freeze-mem/cas",
        sprintf "ZetaFs CAS trace: missing-at-%s on the captured provider" stage
    )

    Assert.True(
        FileSystem.Current.Exists "/freeze-mem/cas",
        sprintf "ZetaFs CAS trace: missing-at-%s through FileSystem.Current" stage
    )

[<Fact>]
let ``Journaled freeze ContentId matches the mutbuf snapshot, not a later pwrite`` () : Task =
    task {
        ensureHasher ()
        let fs = InMemoryFileSystem()
        FileSystem.Register fs
        let volume = ZetaFsFreeze.create "/freeze-mem" (ZetaFsMutbuf.create "/freeze-mem" ZetaFsMutbuf.Coherence.Shared) None

        try
            assertJournaledCasTrace "after-create" fs
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            assertJournaledCasTrace "before-first-freeze" fs
            let! first = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask().ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                assertJournaledCasTrace "after-first-freeze" fs
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 9uy; 9uy |] |> ignore
                assertJournaledCasTrace "before-second-freeze" fs
                let! second = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask().ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    assertJournaledCasTrace "after-second-freeze" fs
                    Assert.NotEqual<string>(first.Content.ToHex(), second.Content.ToHex())
                    Assert.Equal(0UL, first.Generation)
                    Assert.Equal(1UL, second.Generation)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
                    Assert.True(FileSystem.Current.Exists "/freeze-mem/cas")
                    Assert.Equal(0, FileSystem.Current.GetFiles("/freeze-mem/objects", "*").Length)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``pwrite during freeze keeps ContentId at snapshot G`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/pwrite-during-freeze"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let payloadG = [| 1uy; 2uy; 3uy |]
        let payloadG1 = [| 9uy; 8uy; 7uy |]

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadG |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadG1 |> ignore
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                let ropeG = ZetaFsJumprope.buildV1 payloadG
                let ropeG1 = ZetaFsJumprope.buildV1 payloadG1
                Assert.Equal(ropeG.Content.ToHex(), ok.Content.ToHex())
                Assert.NotEqual<string>(ropeG1.Content.ToHex(), ok.Content.ToHex())
                Assert.Equal(0UL, ok.Generation)
                Assert.True(ZetaFsFreeze.isReadable volume ok.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``subset of jumprope leaves is not readable after freeze`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/subset-of-leaves"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payload = Array.init 80_000 (fun i -> byte (i % 223))
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payload |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                firstContent <- ok.Content
                Assert.True(ZetaFsFreeze.isReadable volume1 firstContent)
                let rope = ZetaFsJumprope.buildV1 payload
                Assert.Equal(ok.Content.ToHex(), rope.Content.ToHex())
                Assert.True(rope.Leaves.Length > 1)
                let leaf =
                    rope.Leaves
                    |> Array.map fst
                    |> Array.find (fun hid -> not (hid.Equals rope.Content))
                let key = (ContentHash256.toContentAddress128 leaf).ToHex()
                Assert.True(cas.Delete key)
                Assert.False(ZetaFsFreeze.isReadable volume1 firstContent)
        finally
            ZetaFsFreeze.dispose volume1

        let logClone = logDev.CloneMedia()
        let objClone = objDev.CloneMedia()
        let cas2 = BlockCas(objClone)
        let volume2 = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logClone cas2
        try
            Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled block CAS path is specific to the default profile, not the stream control`` () =
    ensureHasher ()
    let fs = InMemoryFileSystem()
    FileSystem.Register fs

    try
        let defaultVolume =
            ZetaFsFreeze.create "/freeze-mem" (ZetaFsMutbuf.create "/freeze-mem" ZetaFsMutbuf.Coherence.Shared) None

        try
            assertJournaledCasTrace "default-profile-create" fs
        finally
            ZetaFsFreeze.dispose defaultVolume

        let streamVolume =
            ZetaFsFreeze.createManualStream "/freeze-stream" (ZetaFsMutbuf.create "/freeze-stream" ZetaFsMutbuf.Coherence.Shared) None

        try
            Assert.True(Object.ReferenceEquals((fs :> IFileSystem), FileSystem.Current), "ZetaFs CAS trace: provider-changed at stream-control-create")
            Assert.False(fs.Files.ContainsKey "/freeze-stream/cas", "ZetaFs CAS trace: stream control unexpectedly created a BlockCas path")
        finally
            ZetaFsFreeze.dispose streamVolume
    finally
        FileSystem.Reset()

[<Fact>]
let ``Buffered freeze is not POSIX-readable (no freeze-commit)`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let volume = ZetaFsFreeze.create "/freeze-buf" (ZetaFsMutbuf.create "/freeze-buf" ZetaFsMutbuf.Coherence.Shared) None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 7uy |] |> ignore
            let! r = (freezeAsync volume id ZetaFsFreeze.Buffered).AsTask().ConfigureAwait(false)

            match r with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok r ->
                Assert.False(ZetaFsFreeze.isReadable volume r.Content)
                Assert.Equal(0L, r.CommitLsn)
                Assert.Equal(0, ZetaFsFreeze.logBoatCount volume)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``D10 DurabilityMode maps onto freeze class and Journaled has no twin`` () =
    Assert.Equal(ZetaFsFreeze.Buffered, DurabilityFreezeMap.freezeClass DurabilityMode.InMemoryOnly)
    Assert.Equal(ZetaFsFreeze.Buffered, DurabilityFreezeMap.freezeClass DurabilityMode.OsBuffered)
    Assert.Equal(ZetaFsFreeze.Durable, DurabilityFreezeMap.freezeClass DurabilityMode.StableStorage)
    Assert.Equal(ZetaFsFreeze.Durable, DurabilityFreezeMap.freezeClass DurabilityMode.WitnessDurable)
    match DurabilityFreezeMap.tryDurabilityMode ZetaFsFreeze.Buffered with
    | Some DurabilityMode.OsBuffered -> ()
    | other -> Assert.Fail(sprintf "Buffered maps to OsBuffered, got %A" other)
    match DurabilityFreezeMap.tryDurabilityMode ZetaFsFreeze.Journaled with
    | None -> ()
    | Some m -> Assert.Fail(sprintf "Journaled has no DurabilityMode twin, got %A" m)
    match DurabilityFreezeMap.tryDurabilityMode ZetaFsFreeze.Durable with
    | Some DurabilityMode.StableStorage -> ()
    | other -> Assert.Fail(sprintf "Durable maps to StableStorage, got %A" other)

[<Fact>]
let ``a POSIX-rooted store path is NOT rewritten by OS path resolution`` () =
    // THE WINDOWS-ONLY FAILURE, pinned as a rule instead of as a platform.
    //
    // `ZetaFsDeltaLog` used to do `Path.GetFullPath dir` unconditionally. On Linux and macOS
    // that is the identity for "/store"; on Windows it returns "D:\store" — drive-qualified and
    // backslashed. The `FileSystem` still holds the store at "/store", so the FORMAT probe
    // missed, an `ns=bindings` store was read as a NEW store, and the refusal the test below
    // asserts never fired. One failure in 6545, on both Windows legs, every run.
    //
    // HONEST LIMIT: on a POSIX runner this assertion is trivially true and would NOT have gone
    // red before the fix. It cannot be made to — the divergence only exists where the OS path
    // rules differ. What it does is state the rule in a place a reader will find, so the guard
    // is not just a comment inside a constructor: a virtual, POSIX-rooted ZetaFs path is
    // resolved by `ZetaFsPath`, never by `System.IO.Path`.
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    try
        let store = "/rooted-virtual-store"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        try
            // Every file the volume created must live under the path we asked for, unchanged.
            let formatPath = ZetaFsPath.combine2 store ZetaFsFormat.FileName
            Assert.True(FileSystem.Current.Exists formatPath)
            Assert.StartsWith("/", formatPath, StringComparison.Ordinal)
            Assert.DoesNotContain("\\", formatPath, StringComparison.Ordinal)
        finally
            ZetaFsFreeze.dispose volume
    finally
        FileSystem.Reset()

[<Fact>]
let ``new freeze volume writes ns=bindings and git-trees deltaLog still refuses`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-ns-bindings"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let codec =
            CborEntryCodec<string>(
                (fun (s: string) -> DynamicValue.String s),
                (fun (dv: DynamicValue) ->
                    match dv with
                    | DynamicValue.String s -> s
                    | _ -> "")
            )

        try
            let formatPath = ZetaFsPath.combine2 store ZetaFsFormat.FileName
            Assert.True(FileSystem.Current.Exists formatPath)
            let text = Encoding.UTF8.GetString(FileSystem.Current.ReadAllBytes formatPath)
            Assert.Contains("ns=bindings", text, StringComparison.Ordinal)
            Assert.DoesNotContain("ns=git-trees", text, StringComparison.Ordinal)
            let rootPath = ZetaFsPath.combine2 store ZetaFsNamespace.RootFileName
            Assert.True(FileSystem.Current.Exists rootPath)
            let rootText = Encoding.UTF8.GetString(FileSystem.Current.ReadAllBytes rootPath)
            let rootId =
                match volume.Root with
                | Some id -> id
                | None ->
                    Assert.Fail("Volume.Root must load the ROOT hub")
                    Unchecked.defaultof<_>
            match ZetaFsNamespace.EntityId.tryParse rootText with
            | Some fromFile -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare rootId fromFile)
            | None -> Assert.Fail("ROOT must be a StoreEntity EntityId")
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    match reopened.Root with
                    | None -> Assert.Fail("Volume.Root must load after reopen")
                    | Some again ->
                        Assert.Equal(0, ZetaFsNamespace.EntityId.compare rootId again)
                finally
                    ZetaFsFreeze.dispose reopened
                let ex =
                    Assert.Throws<InvalidOperationException>(fun () ->
                        ZetaFsStore.deltaLog store codec |> ignore)
                Assert.Contains("ns=bindings", ex.Message, StringComparison.Ordinal)
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``bindFile under ROOT liveResolves the same EntityId after reopen`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-bind-file"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let name = [| 97uy |]

    try
        match ZetaFsFreeze.bindFile volume name with
        | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
        | Ok id ->
            match ZetaFsFreeze.liveResolve volume name with
            | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id live)
            | None -> Assert.Fail("liveResolve must find the bound File")
            ZetaFsFreeze.dispose volume
            let reopened = ZetaFsFreeze.createManualStream store mutbuf None
            try
                match ZetaFsFreeze.liveResolve reopened name with
                | None -> Assert.Fail("liveResolve must find the bound File after reopen")
                | Some again -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id again)
            finally
                ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``unlinkFile tombstone makes liveResolve None after reopen`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-unlink-tombstone"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let name = [| 98uy |]

    try
        match ZetaFsFreeze.bindFile volume name with
        | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
        | Ok id ->
            match ZetaFsFreeze.liveResolve volume name with
            | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id live)
            | None -> Assert.Fail("liveResolve must find the bound File before unlink")
            match ZetaFsFreeze.unlinkFile volume name with
            | Error e -> Assert.Fail(sprintf "unlinkFile failed: %A" e)
            | Ok() ->
                match ZetaFsFreeze.liveResolve volume name with
                | Some _ -> Assert.Fail("liveResolve must be None after unlink")
                | None -> ()
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                try
                    match ZetaFsFreeze.liveResolve reopened name with
                    | Some _ -> Assert.Fail("liveResolve must be None after reopen")
                    | None -> ()
                finally
                    ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``resolveAt prior phase still sees Live after unlink`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-resolve-at"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let name = [| 99uy |]
    let liveStamp = Versionstamp.ofInt64 0L

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            match ZetaFsFreeze.bindFile volume name with
            | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
            | Ok id ->
                match ZetaFsFreeze.unlinkFile volume name with
                | Error e -> Assert.Fail(sprintf "unlinkFile failed: %A" e)
                | Ok() ->
                    match ZetaFsFreeze.liveResolve volume name with
                    | Some _ -> Assert.Fail("liveResolve must be None after unlink")
                    | None -> ()
                    match ZetaFsFreeze.resolveAt volume root name liveStamp with
                    | Some(ZetaFsNamespace.Live prior) ->
                        Assert.Equal(0, ZetaFsNamespace.EntityId.compare id prior)
                    | other -> Assert.Fail(sprintf "resolveAt Live stamp must be Live, got %A" other)
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                    try
                        match ZetaFsFreeze.resolveAt reopened root name liveStamp with
                        | Some(ZetaFsNamespace.Live prior) ->
                            Assert.Equal(0, ZetaFsNamespace.EntityId.compare id prior)
                        | other -> Assert.Fail(sprintf "resolveAt after reopen must be Live, got %A" other)
                    finally
                        ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``bindFile copies nearest ByPrefix onto ByEntity and later prefix edits do not rewrite`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-policy-first-bind"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let prefix = Encoding.UTF8.GetBytes "src/"
    let name = Encoding.UTF8.GetBytes "src/a"

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            ZetaFsFreeze.assertPolicyBinding
                volume
                { Subject = ZetaFsPolicy.ByPrefix(root, prefix)
                  Kind = ZetaFsPolicy.sourceHistory
                  Phase =
                    { Line = ZetaFsNamespace.PhaseLine
                      Stamp = Versionstamp.ofInt64 1L }
                  Asserter = ZetaFsNamespace.ActorId "freeze" }
            match ZetaFsFreeze.bindFile volume name with
            | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
            | Ok id ->
                match ZetaFsFreeze.effectiveHistory volume id with
                | Some ZetaFsPolicy.KeepAll -> ()
                | other -> Assert.Fail(sprintf "first bind must copy src/ keep-all, got %A" other)
                ZetaFsFreeze.assertPolicyBinding
                    volume
                    { Subject = ZetaFsPolicy.ByPrefix(root, prefix)
                      Kind = ZetaFsPolicy.targetHistory
                      Phase =
                        { Line = ZetaFsNamespace.PhaseLine
                          Stamp = Versionstamp.ofInt64 9L }
                      Asserter = ZetaFsNamespace.ActorId "freeze" }
                match ZetaFsFreeze.effectiveHistory volume id with
                | Some ZetaFsPolicy.KeepAll -> ()
                | other -> Assert.Fail(sprintf "later prefix edit must not rewrite, got %A" other)
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                try
                    match ZetaFsFreeze.effectiveHistory reopened id with
                    | Some ZetaFsPolicy.KeepAll -> ()
                    | other -> Assert.Fail(sprintf "reopen must keep first-bind copy, got %A" other)
                    Assert.True(FileSystem.Current.Exists(ZetaFsPath.combine2 store "policy"))
                finally
                    ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``bindName second parent does not rewrite first-bind policy`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-policy-two-parent"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let srcPrefix = Encoding.UTF8.GetBytes "src/"
    let targetPrefix = Encoding.UTF8.GetBytes "target/"
    let srcName = Encoding.UTF8.GetBytes "src/a"
    let targetName = Encoding.UTF8.GetBytes "target/a"

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            ZetaFsFreeze.assertPolicyBinding
                volume
                { Subject = ZetaFsPolicy.ByPrefix(root, srcPrefix)
                  Kind = ZetaFsPolicy.sourceHistory
                  Phase =
                    { Line = ZetaFsNamespace.PhaseLine
                      Stamp = Versionstamp.ofInt64 1L }
                  Asserter = ZetaFsNamespace.ActorId "freeze" }
            ZetaFsFreeze.assertPolicyBinding
                volume
                { Subject = ZetaFsPolicy.ByPrefix(root, targetPrefix)
                  Kind = ZetaFsPolicy.targetHistory
                  Phase =
                    { Line = ZetaFsNamespace.PhaseLine
                      Stamp = Versionstamp.ofInt64 1L }
                  Asserter = ZetaFsNamespace.ActorId "freeze" }
            match ZetaFsFreeze.bindFile volume srcName with
            | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
            | Ok id ->
                match ZetaFsFreeze.bindName volume root targetName id with
                | Error e -> Assert.Fail(sprintf "bindName failed: %A" e)
                | Ok() ->
                    match ZetaFsFreeze.effectiveHistory volume id with
                    | Some ZetaFsPolicy.KeepAll -> ()
                    | other -> Assert.Fail(sprintf "first-bind src/ keep-all must win, got %A" other)
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                    try
                        match ZetaFsFreeze.effectiveHistory reopened id with
                        | Some ZetaFsPolicy.KeepAll -> ()
                        | other -> Assert.Fail(sprintf "reopen must keep first-bind copy, got %A" other)
                        match ZetaFsFreeze.liveResolve reopened srcName with
                        | None -> Assert.Fail("src/a must stay live")
                        | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id live)
                        match ZetaFsFreeze.liveResolve reopened targetName with
                        | None -> Assert.Fail("target/a must stay live")
                        | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id live)
                    finally
                        ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``bindName refuses a directory cycle and does not persist it`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-bind-cycle"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let nameA = [| 97uy |]
    let nameB = [| 98uy |]
    let nameUp = [| 117uy |]

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            match ZetaFsFreeze.bindDirectory volume root nameA with
            | Error e -> Assert.Fail(sprintf "bindDirectory a failed: %A" e)
            | Ok a ->
                match ZetaFsFreeze.bindDirectory volume a nameB with
                | Error e -> Assert.Fail(sprintf "bindDirectory b failed: %A" e)
                | Ok b ->
                    match ZetaFsFreeze.bindName volume b nameUp a with
                    | Ok() -> Assert.Fail("bindName must refuse a directory cycle")
                    | Error(ZetaFsNamespace.Cycle _) -> ()
                    | Error e -> Assert.Fail(sprintf "expected Cycle, got %A" e)
                    match ZetaFsFreeze.liveResolveUnder volume b nameUp with
                    | Some _ -> Assert.Fail("cycle must not be live")
                    | None -> ()
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                    try
                        match ZetaFsFreeze.liveResolveUnder reopened b nameUp with
                        | Some _ -> Assert.Fail("cycle must not persist")
                        | None -> ()
                    finally
                        ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``bindSymlink persists UTF-8 target bytes across reopen`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-bind-symlink"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let name = Encoding.UTF8.GetBytes "link"
    let target = Encoding.UTF8.GetBytes "src/a"

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            match ZetaFsFreeze.bindSymlink volume root name target with
            | Error e -> Assert.Fail(sprintf "bindSymlink failed: %A" e)
            | Ok id ->
                match ZetaFsFreeze.liveResolve volume name with
                | None -> Assert.Fail("symlink name must be live")
                | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id live)
                match ZetaFsFreeze.readSymlink volume id with
                | None -> Assert.Fail("readSymlink must see the target")
                | Some bytes ->
                    Assert.True(
                        bytes.Length = target.Length
                        && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> bytes, ReadOnlySpan<byte> target)
                    )
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                try
                    match ZetaFsFreeze.liveResolve reopened name with
                    | None -> Assert.Fail("symlink name must survive reopen")
                    | Some again -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare id again)
                    match ZetaFsFreeze.readSymlink reopened id with
                    | None -> Assert.Fail("readSymlink must survive reopen")
                    | Some bytes ->
                        Assert.True(
                            bytes.Length = target.Length
                            && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> bytes, ReadOnlySpan<byte> target)
                        )
                finally
                    ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``rename dest directory and source file is Eisdir and persists both names`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-rename-eisdir"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let fileName = Encoding.UTF8.GetBytes "a"
    let dirName = Encoding.UTF8.GetBytes "d"

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            match ZetaFsFreeze.bindFile volume fileName with
            | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
            | Ok file ->
                match ZetaFsFreeze.bindDirectory volume root dirName with
                | Error e -> Assert.Fail(sprintf "bindDirectory failed: %A" e)
                | Ok dir ->
                    match ZetaFsFreeze.rename volume root fileName root dirName with
                    | Ok() -> Assert.Fail("rename file onto directory must be Eisdir")
                    | Error(ZetaFsNamespace.Eisdir dest) ->
                        Assert.Equal(0, ZetaFsNamespace.EntityId.compare dir dest)
                    | Error e -> Assert.Fail(sprintf "expected Eisdir, got %A" e)
                    match ZetaFsFreeze.liveResolve volume fileName with
                    | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare file live)
                    | None -> Assert.Fail("source file name must stay live")
                    match ZetaFsFreeze.liveResolve volume dirName with
                    | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare dir live)
                    | None -> Assert.Fail("dest directory name must stay live")
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                    try
                        match ZetaFsFreeze.liveResolve reopened fileName with
                        | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare file live)
                        | None -> Assert.Fail("source file name must survive reopen")
                        match ZetaFsFreeze.liveResolve reopened dirName with
                        | Some live -> Assert.Equal(0, ZetaFsNamespace.EntityId.compare dir live)
                        | None -> Assert.Fail("dest directory name must survive reopen")
                    finally
                        ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``readdir lists live names after reopen and omits tombstones`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-readdir"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStream store mutbuf None
    let nameA = Encoding.UTF8.GetBytes "a"
    let nameB = Encoding.UTF8.GetBytes "b"

    try
        match volume.Root with
        | None -> Assert.Fail("Volume.Root must exist")
        | Some root ->
            match ZetaFsFreeze.bindFile volume nameA with
            | Error e -> Assert.Fail(sprintf "bindFile a failed: %A" e)
            | Ok a ->
                match ZetaFsFreeze.bindFile volume nameB with
                | Error e -> Assert.Fail(sprintf "bindFile b failed: %A" e)
                | Ok b ->
                    match ZetaFsFreeze.unlinkFile volume nameA with
                    | Error e -> Assert.Fail(sprintf "unlinkFile failed: %A" e)
                    | Ok() ->
                        match ZetaFsFreeze.readdir volume root with
                        | Error e -> Assert.Fail(sprintf "readdir failed: %A" e)
                        | Ok names ->
                            Assert.Equal(1, names.Length)
                            Assert.Equal(0, ZetaFsNamespace.EntityId.compare b (snd names.[0]))
                        ZetaFsFreeze.dispose volume
                        let reopened = ZetaFsFreeze.createManualStream store mutbuf None
                        try
                            match ZetaFsFreeze.readdir reopened root with
                            | Error e -> Assert.Fail(sprintf "readdir reopen failed: %A" e)
                            | Ok names ->
                                Assert.Equal(1, names.Length)
                                Assert.Equal(0, ZetaFsNamespace.EntityId.compare b (snd names.[0]))
                        finally
                            ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``getattr stamps from the injected clock and setattr caller times persist`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-posix-meta"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let clock =
        Environment.createVirtualAt (DateTimeOffset.FromUnixTimeSeconds 1L) 11L
        :> ISimulationEnvironment
    let volume = ZetaFsFreeze.createManualStreamWith store mutbuf None clock
    let name = Encoding.UTF8.GetBytes "a"

    try
        match ZetaFsFreeze.bindFile volume name with
        | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
        | Ok id ->
            match ZetaFsFreeze.getattr volume id with
            | Error e -> Assert.Fail(sprintf "getattr failed: %A" e)
            | Ok stat ->
                Assert.Equal(1_000_000_000L, stat.Meta.MtimeNs)
                Assert.Equal(1_000_000_000L, stat.Meta.CtimeNs)
                Assert.Equal(ZetaFsPosixMeta.fileMode, stat.Meta.Mode)
                Assert.Equal(1L, stat.Nlink)
                Assert.Equal(0UL, stat.Size)
            match
                ZetaFsFreeze.setattr
                    volume
                    id
                    { ZetaFsPosixMeta.emptyPatch with
                        MtimeNs = Some 42L
                        CtimeNs = Some 43L }
            with
            | Error e -> Assert.Fail(sprintf "setattr failed: %A" e)
            | Ok() ->
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStreamWith store mutbuf None clock
                try
                    match ZetaFsFreeze.getattr reopened id with
                    | Error e -> Assert.Fail(sprintf "getattr reopen failed: %A" e)
                    | Ok stat ->
                        Assert.Equal(42L, stat.Meta.MtimeNs)
                        Assert.Equal(43L, stat.Meta.CtimeNs)
                finally
                    ZetaFsFreeze.dispose reopened
    finally
        FileSystem.Reset()

[<Fact>]
let ``getattr size is dirty mutbuf length not PosixMeta.Size`` () =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let store = "/freeze-posix-meta-size"
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let clock = Environment.createVirtual 12L :> ISimulationEnvironment
    let volume = ZetaFsFreeze.createManualStreamWith store mutbuf None clock
    let name = Encoding.UTF8.GetBytes "b"

    try
        match ZetaFsFreeze.bindFile volume name with
        | Error e -> Assert.Fail(sprintf "bindFile failed: %A" e)
        | Ok id ->
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            match ZetaFsFreeze.getattr volume id with
            | Error e -> Assert.Fail(sprintf "getattr failed: %A" e)
            | Ok stat ->
                Assert.Equal(3UL, stat.Size)
                Assert.Equal(0UL, stat.Meta.Size)
    finally
        FileSystem.Reset()

[<Fact>]
let ``Durable freeze on a real directory fsyncs and is readable`` () : Task =
    task {
        ensureHasher ()
        let store = tempStore ()
        let volume = ZetaFsFreeze.create store (ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared) None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L (Array.init 4096 (fun i -> byte i)) |> ignore
            let! r = (freezeAsync volume id ZetaFsFreeze.Durable).AsTask().ConfigureAwait(false)

            match r with
            | Error e ->
                if OperatingSystem.IsWindows() then
                    Assert.Equal("WindowsDurableNotClaimed", ZetaFsFreeze.errorName e)
                else
                    Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok r ->
                Assert.False(OperatingSystem.IsWindows())
                Assert.True(ZetaFsFreeze.isReadable volume r.Content)
                Assert.True(r.CommitLsn > 0L)
                Assert.True(File.Exists(ZetaFsPath.combine3 store "log" "freeze"))
                Assert.True(ZetaFsFreeze.logBoatCount volume >= 1)
        finally
            ZetaFsFreeze.dispose volume
            Directory.Delete(store, true)
    }

type private Rec () =
    member val Journaled = 0 with get, set
    member val Durable = 0 with get, set

    interface ZetaFsFreeze.IDurabilityObserver with
        member this.OnJournaled _ =
            this.Journaled <- this.Journaled + 1
            Ok()

        member this.OnDurable _ =
            this.Durable <- this.Durable + 1
            Ok()

[<Fact>]
let ``observer OnJournaled fires for Journaled and not for Buffered`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let recb = Rec()
        let volume =
            ZetaFsFreeze.create "/freeze-obs" (ZetaFsMutbuf.create "/freeze-obs" ZetaFsMutbuf.Coherence.Shared) (Some(recb :> ZetaFsFreeze.IDurabilityObserver))

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy |] |> ignore
            let! _ = (freezeAsync volume id ZetaFsFreeze.Buffered).AsTask().ConfigureAwait(false)
            Assert.Equal(0, recb.Journaled)
            let! _ = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask().ConfigureAwait(false)
            Assert.Equal(1, recb.Journaled)
            Assert.Equal(0, recb.Durable)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``sealed log does not leave freeze-intent ASCII in the clear`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let mutbuf = ZetaFsMutbuf.create "/freeze-enc" ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let mutable volume: ZetaFsFreeze.Volume option = None

        try
            match ZetaFsCrypto.sessionFromVaultKey 1u vault with
            | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
            | Ok session ->
                let v = ZetaFsFreeze.createWith "/freeze-enc" mutbuf None (Some session)
                volume <- Some v
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle mutbuf id
                ZetaFsMutbuf.pwrite mutbuf h 0L [| 1uy; 2uy |] |> ignore
                let! r = (freezeAsync v id ZetaFsFreeze.Journaled).AsTask().ConfigureAwait(false)

                match r with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok r ->
                    Assert.True(ZetaFsFreeze.isReadable v r.Content)
                    let logBytes = FileSystem.Current.ReadAllBytes(ZetaFsPath.combine3 "/freeze-enc" "log" "freeze")
                    let needle = Text.Encoding.UTF8.GetBytes "freeze-intent/1"
                    Assert.Equal(-1, MemoryExtensions.IndexOf(ReadOnlySpan<byte> logBytes, ReadOnlySpan<byte> needle))
        finally
            match volume with
            | Some v -> ZetaFsFreeze.dispose v
            | None -> ()
            FileSystem.Reset()
    }

[<Fact>]
let ``a fresh volume replays a sealed Journaled freeze from the log`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-replay"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let mutable volume: ZetaFsFreeze.Volume option = None

        try
            match ZetaFsCrypto.sessionFromVaultKey 1u vault with
            | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
            | Ok session ->
                let v = ZetaFsFreeze.createManualWith store mutbuf None (Some session)
                volume <- Some v
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle mutbuf id
                ZetaFsMutbuf.pwrite mutbuf h 0L [| 1uy; 2uy |] |> ignore
                let pending = (freezeAsync v id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog v CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    ZetaFsFreeze.dispose v
                    volume <- None
                    let reopened = ZetaFsFreeze.createManualWith store mutbuf None (Some session)

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
        finally
            match volume with
            | Some v -> ZetaFsFreeze.dispose v
            | None -> ()
            FileSystem.Reset()
    }

[<Fact>]
let ``sealed replay with the wrong vault key recovers nothing and leaves the log`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-wrong-key"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let other = Array.init 32 (fun i -> byte (i + 1))
        let mutable volume: ZetaFsFreeze.Volume option = None

        try
            match ZetaFsCrypto.sessionFromVaultKey 1u vault, ZetaFsCrypto.sessionFromVaultKey 1u other with
            | Error e, _ -> Assert.Fail(ZetaFsCrypto.errorName e)
            | _, Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
            | Ok session, Ok otherSession ->
                let v = ZetaFsFreeze.createManualWith store mutbuf None (Some session)
                volume <- Some v
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle mutbuf id
                ZetaFsMutbuf.pwrite mutbuf h 0L [| 9uy |] |> ignore
                let pending = (freezeAsync v id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog v CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    let logPath = ZetaFsPath.combine3 store "log" "freeze"
                    let before = FileSystem.Current.ReadAllBytes logPath
                    ZetaFsFreeze.dispose v
                    volume <- None
                    let reopened = ZetaFsFreeze.createManualWith store mutbuf None (Some otherSession)

                    try
                        Assert.False(ZetaFsFreeze.isReadable reopened first.Content)
                        let after = FileSystem.Current.ReadAllBytes logPath
                        Assert.True((after.Length = before.Length))
                    finally
                        ZetaFsFreeze.dispose reopened
        finally
            match volume with
            | Some v -> ZetaFsFreeze.dispose v
            | None -> ()
            FileSystem.Reset()
    }

[<Fact>]
let ``cancelled token before admit does not start a log boat`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let volume =
            ZetaFsFreeze.createManual "/freeze-cancel" (ZetaFsMutbuf.create "/freeze-cancel" ZetaFsMutbuf.Coherence.Shared) None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy |] |> ignore
            use cts = new CancellationTokenSource()
            cts.Cancel()
            let t = (ZetaFsFreeze.freezeAsync volume id ZetaFsFreeze.Journaled cts.Token).AsTask()
            Assert.True(t.IsCompleted)
            Assert.True(t.IsCanceled)
            Assert.Equal(0, ZetaFsFreeze.logBoatCount volume)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``manual pump packs N journaled freezes into one log boat`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let volume =
            ZetaFsFreeze.createManual "/freeze-boat" (ZetaFsMutbuf.create "/freeze-boat" ZetaFsMutbuf.Coherence.Shared) None

        try
            let pending = ResizeArray<Task<Result<ZetaFsFreeze.FreezeResult, ZetaFsFreeze.FreezeError>>>(16)

            for i in 1 .. 16 do
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| byte i |] |> ignore
                pending.Add((freezeAsync volume id ZetaFsFreeze.Journaled).AsTask())

            Assert.Equal(0, ZetaFsFreeze.logBoatCount volume)
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            Assert.Equal(1, ZetaFsFreeze.logBoatCount volume)
            Assert.Equal(16, ZetaFsFreeze.logLastBoatSize volume)

            for t in pending do
                let! r = t.ConfigureAwait(false)

                match r with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok ok -> Assert.True(ZetaFsFreeze.isReadable volume ok.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``catalog persistence failure faults the unresolved freeze reply`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-catalog-failure"
        let volume =
            ZetaFsFreeze.createManualStream store (ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared) None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            mock.ArmCrashMidWrite("known.pins", 0)
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! _ =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)
            ()
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze crash-mid-write leaves a torn log and does not finish`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"
        mock.ArmCrashMidWrite(logNeedle, 8)
        FileSystem.Register(mock)
        let store = "/crash-mid-freeze"
        let volume =
            ZetaFsFreeze.createManualStream store (ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared) None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! ex =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)

            Assert.Equal(8, ex.CommittedBytes)
            Assert.Equal(1, ZetaFsFreeze.logBoatCount volume)
            let logPath = ZetaFsPath.combine3 store "log" "freeze"
            Assert.True(FileSystem.Current.Exists logPath)
            Assert.Equal(8, FileSystem.Current.ReadAllBytes(logPath).Length)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``a fresh volume replays an intact Journaled freeze from the log`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-replay"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManual store mutbuf None

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen after a torn second freeze keeps the first and drops the tail`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-replay-torn"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"
        let logPath = ZetaFsPath.combine3 store "log" "freeze"

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let intactBytes = FileSystem.Current.ReadAllBytes logPath
                mock.ArmCrashMidWrite(logNeedle, intactBytes.Length + 8)
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<CrashMidWriteException>(fun () -> pending2 :> Task)
                        .ConfigureAwait(false)

                let tornLen = FileSystem.Current.ReadAllBytes(logPath).Length
                Assert.True(tornLen > intactBytes.Length)
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStream store mutbuf None

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    let recoveredLen = FileSystem.Current.ReadAllBytes(logPath).Length
                    Assert.True(recoveredLen < tornLen)
                    Assert.True((recoveredLen = intactBytes.Length))
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze that acks with a corrupt last write is not readable after reopen`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"
        mock.ArmCorruptLastWrite(logNeedle, 8)
        FileSystem.Register(mock)
        let store = "/corrupt-last-freeze"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualStream store mutbuf None

                try
                    Assert.False(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze crash during leaf put leaves extra garbage and is not readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        mock.ArmCrashMidWrite("objects", 0)
        FileSystem.Register(mock)
        let store = "/crash-intent-leaves"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let logPath = ZetaFsPath.combine3 store "log" "freeze"

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! _ =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)

            Assert.Equal(1, ZetaFsFreeze.logBoatCount volume)
            Assert.True(FileSystem.Current.Exists logPath)
            let intentLen = FileSystem.Current.ReadAllBytes(logPath).Length
            Assert.True(intentLen > 0)
            let freezeWrites =
                mock.CommitOrder
                |> Array.filter (fun p ->
                    p.IndexOf("FORMAT", StringComparison.Ordinal) < 0
                    && p.IndexOf("ROOT", StringComparison.Ordinal) < 0
                    && p.IndexOf("bindings", StringComparison.Ordinal) < 0
                    && p.IndexOf("posix-meta", StringComparison.Ordinal) < 0
                    && p.IndexOf("policy", StringComparison.Ordinal) < 0
                    && p.IndexOf("symlinks", StringComparison.Ordinal) < 0)
            Assert.Equal(logPath, freezeWrites.[0])
            ZetaFsFreeze.dispose volume
            let reopened = ZetaFsFreeze.createManualStream store mutbuf None

            try
                let recoveredLen = FileSystem.Current.ReadAllBytes(logPath).Length
                Assert.True(recoveredLen < intentLen)
                Assert.Equal(0, recoveredLen)
            finally
                ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen after a mid-log CRC mismatch keeps the prefix and drops the suffix`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-mid-crc"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let logPath = ZetaFsPath.combine3 store "log" "freeze"

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let prefixLen = FileSystem.Current.ReadAllBytes(logPath).Length
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
                    let full = mock.Files.[logPath]
                    Assert.True(full.Length > prefixLen + 8)
                    let flipped = Array.copy full
                    flipped.[prefixLen + 4] <- flipped.[prefixLen + 4] ^^^ 0xA5uy
                    mock.Files.[logPath] <- flipped
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManualStream store mutbuf None

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                        Assert.False(ZetaFsFreeze.isReadable reopened second.Content)
                        let recovered = FileSystem.Current.ReadAllBytes logPath
                        Assert.True(recovered.Length < flipped.Length)
                        Assert.True(recovered.Length > 8)
                        Assert.True((recovered.Length = prefixLen))
                    finally
                        ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen after a mid-log sealed MAC mismatch keeps the prefix and drops the suffix`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-mid-mac"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let mutable volume: ZetaFsFreeze.Volume option = None
        let logPath = ZetaFsPath.combine3 store "log" "freeze"

        try
            match ZetaFsCrypto.sessionFromVaultKey 1u vault with
            | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
            | Ok session ->
                let v = ZetaFsFreeze.createManualWithStream store mutbuf None (Some session)
                volume <- Some v
                let id1 = mintId ()
                let h1 = ZetaFsMutbuf.openHandle mutbuf id1
                ZetaFsMutbuf.pwrite mutbuf h1 0L [| 1uy |] |> ignore
                let pending1 = (freezeAsync v id1 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog v CancellationToken.None).ConfigureAwait(false)
                let! first = pending1.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    let prefixLen = FileSystem.Current.ReadAllBytes(logPath).Length
                    let id2 = mintId ()
                    let h2 = ZetaFsMutbuf.openHandle mutbuf id2
                    ZetaFsMutbuf.pwrite mutbuf h2 0L [| 2uy |] |> ignore
                    let pending2 = (freezeAsync v id2 ZetaFsFreeze.Journaled).AsTask()
                    do! (ZetaFsFreeze.pumpLog v CancellationToken.None).ConfigureAwait(false)
                    let! second = pending2.ConfigureAwait(false)

                    match second with
                    | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                    | Ok second ->
                        let full = mock.Files.[logPath]
                        Assert.True(full.Length > prefixLen + 12)
                        let flipped = Array.copy full
                        flipped.[prefixLen + 12] <- flipped.[prefixLen + 12] ^^^ 0xA5uy
                        mock.Files.[logPath] <- flipped
                        ZetaFsFreeze.dispose v
                        volume <- None
                        let reopened = ZetaFsFreeze.createManualWithStream store mutbuf None (Some session)

                        try
                            Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                            Assert.False(ZetaFsFreeze.isReadable reopened second.Content)
                            let recovered = FileSystem.Current.ReadAllBytes logPath
                            Assert.True(recovered.Length < flipped.Length)
                            Assert.True(recovered.Length > 12)
                            Assert.True((recovered.Length = prefixLen))
                        finally
                            ZetaFsFreeze.dispose reopened
        finally
            match volume with
            | Some v -> ZetaFsFreeze.dispose v
            | None -> ()
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze through SimulatedBlockIo is readable after reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let blocks = SimulatedBlockIo(4096)
        let volume = ZetaFsFreeze.createManualWithBlocks store mutbuf None blocks

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                Assert.True(blocks.LogicalBytes > 0L)
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualWithBlocks store mutbuf None blocks

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze crash-mid-write on IBlockIo does not finish`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-blocks-crash"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let blocks = SimulatedBlockIo(4096)
        blocks.ArmCrashMidWrite(8)
        let volume = ZetaFsFreeze.createManualWithBlocks store mutbuf None blocks

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! _ =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)

            Assert.Equal(1, ZetaFsFreeze.logBoatCount volume)
            ZetaFsFreeze.dispose volume
            let reopened = ZetaFsFreeze.createManualWithBlocks store mutbuf None blocks

            try
                Assert.Equal(0L, blocks.LogicalBytes)
            finally
                ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze CAS objects on IBlockIo are readable and not POSIX files`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-cas-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                Assert.True(cas.Count > 0)
                Assert.Equal(0, FileSystem.Current.GetFiles(ZetaFsPath.combine2 store "objects", "*").Length)
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze crash during block CAS put drops the trailing intent`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-cas-crash"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        objDev.ArmCrashMidWrite(8)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! _ =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)

            Assert.Equal(1, ZetaFsFreeze.logBoatCount volume)
            Assert.True(logDev.LogicalBytes > 0L)
            Assert.Equal(0, cas.Count)
            ZetaFsFreeze.dispose volume
            let reopened = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

            try
                Assert.Equal(0L, logDev.LogicalBytes)
                Assert.Equal(0, cas.Count)
            finally
                ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze log superblock reopens from cloned media without LogicalBytes`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-super-log"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let blocks = SimulatedBlockIo(4096)
        let volume = ZetaFsFreeze.createManualWithBlocks store mutbuf None blocks

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                ZetaFsFreeze.dispose volume
                let cloned = blocks.CloneMedia()
                Assert.Equal(0L, cloned.LogicalBytes)
                let reopened = ZetaFsFreeze.createManualWithBlocks store mutbuf None cloned

                try
                    Assert.True(cloned.LogicalBytes > 0L)
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze CAS superblock reopens from cloned media without the in-memory index`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-super-cas"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(cas.Count > 0)
                ZetaFsFreeze.dispose volume
                let logClone = logDev.CloneMedia()
                let objClone = objDev.CloneMedia()
                let cas2 = BlockCas(objClone)
                Assert.True(cas2.Count > 0)
                Assert.Equal(0L, logClone.LogicalBytes)
                let reopened = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logClone cas2

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze ReplayTo two FileSystemBlockIo devices stays readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-replay-two-dev"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(cas.Count > 0)
                Assert.True(logDev.RecordedOps.Length > 0)
                Assert.True(objDev.RecordedOps.Length > 0)
                ZetaFsFreeze.dispose volume
                let fs = FileSystem.Current
                let logPoly = FileSystemBlockIo(fs, ZetaFsPath.combine2 store "replay-log", 4096)
                let objPoly = FileSystemBlockIo(fs, ZetaFsPath.combine2 store "replay-cas", 4096)
                logDev.ReplayTo(logPoly :> IBlockIo)
                objDev.ReplayTo(objPoly :> IBlockIo)
                let cas2 = BlockCas(objPoly :> IBlockIo)
                Assert.True(cas2.Count > 0)
                let reopened = ZetaFsFreeze.createManualWithHostFileStore store mutbuf None logPoly cas2

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Sealed journaled freeze through SimulatedBlockIo is readable after CloneMedia`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let blocks = SimulatedBlockIo(4096)

        match ZetaFsCrypto.sessionFromVaultKey 1u vault with
        | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
        | Ok session ->
            let volume = ZetaFsFreeze.createManualWithSealedBlocks store mutbuf None session blocks

            try
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy |] |> ignore
                let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    let device = blocks :> IBlockIo
                    let logBytes = BlockLog.readAt device (BlockLog.origin device) blocks.LogicalBytes
                    let needle = Text.Encoding.UTF8.GetBytes "freeze-intent/1"
                    Assert.Equal(-1, MemoryExtensions.IndexOf(ReadOnlySpan<byte> logBytes, ReadOnlySpan<byte> needle))
                    ZetaFsFreeze.dispose volume
                    let cloned = blocks.CloneMedia()
                    let reopened =
                        ZetaFsFreeze.createManualWithSealedBlocks store mutbuf None session cloned

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
            finally
                FileSystem.Reset()
    }

[<Fact>]
let ``Sealed block replay with the wrong vault key recovers nothing and does not truncate`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-blocks-wrong-key"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let other = Array.init 32 (fun i -> byte (i + 1))
        let blocks = SimulatedBlockIo(4096)

        match ZetaFsCrypto.sessionFromVaultKey 1u vault, ZetaFsCrypto.sessionFromVaultKey 1u other with
        | Error e, _ -> Assert.Fail(ZetaFsCrypto.errorName e)
        | _, Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
        | Ok session, Ok otherSession ->
            let volume = ZetaFsFreeze.createManualWithSealedBlocks store mutbuf None session blocks

            try
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy |] |> ignore
                let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    let before = blocks.LogicalBytes
                    ZetaFsFreeze.dispose volume
                    let cloned = blocks.CloneMedia()
                    Assert.Equal(0L, cloned.LogicalBytes)
                    let reopened =
                        ZetaFsFreeze.createManualWithSealedBlocks store mutbuf None otherSession cloned

                    try
                        Assert.False(ZetaFsFreeze.isReadable reopened first.Content)
                        Assert.True((cloned.LogicalBytes = before))
                    finally
                        ZetaFsFreeze.dispose reopened
            finally
                FileSystem.Reset()
    }

[<Fact>]
let ``Sealed journaled freeze CAS objects on IBlockIo reopen from cloned media`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-cas-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)

        match ZetaFsCrypto.sessionFromVaultKey 1u vault with
        | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
        | Ok session ->
            let volume =
                ZetaFsFreeze.createManualWithSealedBlockStore store mutbuf None session logDev cas

            try
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
                let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    Assert.True(cas.Count > 0)
                    Assert.Equal(0, FileSystem.Current.GetFiles(ZetaFsPath.combine2 store "objects", "*").Length)
                    let logIo = logDev :> IBlockIo
                    let logBytes = BlockLog.readAt logIo (BlockLog.origin logIo) logDev.LogicalBytes
                    let needle = Text.Encoding.UTF8.GetBytes "freeze-intent/1"
                    Assert.Equal(-1, MemoryExtensions.IndexOf(ReadOnlySpan<byte> logBytes, ReadOnlySpan<byte> needle))
                    ZetaFsFreeze.dispose volume
                    let logClone = logDev.CloneMedia()
                    let objClone = objDev.CloneMedia()
                    let cas2 = BlockCas(objClone)
                    Assert.True(cas2.Count > 0)
                    let reopened =
                        ZetaFsFreeze.createManualWithSealedBlockStore store mutbuf None session logClone cas2

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
            finally
                FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze through FileSystemBlockIo polyfill is readable after reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-file-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualWithFileLog store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                Assert.True(FileSystem.Current.Exists(ZetaFsPath.combine3 store "log" "freeze"))
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualWithFileLog store mutbuf None

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Sealed journaled freeze through FileSystemBlockIo is readable after reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-file-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)

        match ZetaFsCrypto.sessionFromVaultKey 1u vault with
        | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
        | Ok session ->
            let volume = ZetaFsFreeze.createManualWithSealedFileLog store mutbuf None session

            try
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy |] |> ignore
                let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    let logBytes = FileSystem.Current.ReadAllBytes(ZetaFsPath.combine3 store "log" "freeze")
                    let needle = Text.Encoding.UTF8.GetBytes "freeze-intent/1"
                    Assert.Equal(-1, MemoryExtensions.IndexOf(ReadOnlySpan<byte> logBytes, ReadOnlySpan<byte> needle))
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManualWithSealedFileLog store mutbuf None session

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
            finally
                FileSystem.Reset()
    }

[<Fact>]
let ``Sealed FileSystemBlockIo replay with the wrong vault key recovers nothing and does not truncate`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-file-wrong-key"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)
        let other = Array.init 32 (fun i -> byte (i + 1))

        match ZetaFsCrypto.sessionFromVaultKey 1u vault, ZetaFsCrypto.sessionFromVaultKey 1u other with
        | Error e, _ -> Assert.Fail(ZetaFsCrypto.errorName e)
        | _, Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
        | Ok session, Ok otherSession ->
            let volume = ZetaFsFreeze.createManualWithSealedFileLog store mutbuf None session

            try
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy |] |> ignore
                let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    let before = ZetaFsFreeze.logLogicalBytes volume
                    ZetaFsFreeze.dispose volume
                    let reopened =
                        ZetaFsFreeze.createManualWithSealedFileLog store mutbuf None otherSession

                    try
                        Assert.False(ZetaFsFreeze.isReadable reopened first.Content)
                        Assert.True((ZetaFsFreeze.logLogicalBytes reopened = before))
                    finally
                        ZetaFsFreeze.dispose reopened
            finally
                FileSystem.Reset()
    }

[<Fact>]
let ``Journaled freeze CAS objects through FileSystemBlockIo reopen and are not POSIX files`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-file-cas-blocks"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualWithFileBlockStore store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                Assert.True(FileSystem.Current.Exists(ZetaFsPath.combine2 store "cas"))
                Assert.Equal(0, FileSystem.Current.GetFiles(ZetaFsPath.combine2 store "objects", "*").Length)
                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManualWithFileBlockStore store mutbuf None

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Sealed journaled freeze CAS through FileSystemBlockIo reopen and are not POSIX files`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-sealed-file-cas"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let vault = Array.init 32 (fun i -> byte i)

        match ZetaFsCrypto.sessionFromVaultKey 1u vault with
        | Error e -> Assert.Fail(ZetaFsCrypto.errorName e)
        | Ok session ->
            let volume =
                ZetaFsFreeze.createManualWithSealedFileBlockStore store mutbuf None session

            try
                let id = mintId ()
                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
                let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! first = pending.ConfigureAwait(false)

                match first with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok first ->
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(FileSystem.Current.Exists(ZetaFsPath.combine2 store "cas"))
                    Assert.Equal(0, FileSystem.Current.GetFiles(ZetaFsPath.combine2 store "objects", "*").Length)
                    let logBytes = FileSystem.Current.ReadAllBytes(ZetaFsPath.combine3 store "log" "freeze")
                    let needle = Text.Encoding.UTF8.GetBytes "freeze-intent/1"
                    Assert.Equal(-1, MemoryExtensions.IndexOf(ReadOnlySpan<byte> logBytes, ReadOnlySpan<byte> needle))
                    ZetaFsFreeze.dispose volume
                    let reopened =
                        ZetaFsFreeze.createManualWithSealedFileBlockStore store mutbuf None session

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
            finally
                FileSystem.Reset()
    }

[<Fact>]
let ``Polyfill crash-mid-write on the second freeze keeps the first`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-polyfill-crash-prefix"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                mock.ArmCrashMidWrite(logNeedle, 8)
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<CrashMidWriteException>(fun () -> pending2 :> Task)
                        .ConfigureAwait(false)

                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManual store mutbuf None

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Polyfill corrupt-last-write on the second freeze acks and keeps the first`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-polyfill-corrupt-prefix"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                mock.ArmCorruptLastWrite(logNeedle, 8)
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok _ ->
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManual store mutbuf None

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Polyfill reorder of the second freeze completes and keeps the first`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-polyfill-reorder-prefix"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                mock.ArmReorderNextTwo logNeedle
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok _ ->
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManual store mutbuf None

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``Polyfill torn-sector on the second freeze acks and keeps the first`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-polyfill-torn-prefix"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        let logNeedle = ZetaFsPath.combine2 "log" "freeze"

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                mock.ArmTornSector(logNeedle, 512)
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok _ ->
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    ZetaFsFreeze.dispose volume
                    let reopened = ZetaFsFreeze.createManual store mutbuf None

                    try
                        Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                    finally
                        ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``POSIX freeze of the same ContentId does not rewrite object bits`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-posix-skip"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending1 = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let objectWrites () =
                    mock.CommitOrder
                    |> Array.filter (fun p -> p.IndexOf("objects", StringComparison.Ordinal) >= 0)

                let afterFirst = objectWrites().Length
                Assert.True(afterFirst > 0)
                let pending2 = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    Assert.Equal(first.Content.ToHex(), second.Content.ToHex())
                    // Re-freezing the identical ContentId must add zero new object
                    // writes: the second freeze is a no-op on object bits. Compare the
                    // post-second-freeze count against the count captured after the
                    // first freeze; the delta rides the claim so the check can fail.
                    let afterSecond = objectWrites().Length
                    Assert.Equal(0, afterSecond - afterFirst)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``reclaim crash-mid-sweep of extra garbage keeps a committed freeze readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-reclaim-crash"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let live =
                    FileSystem.Current.GetFiles(ZetaFsPath.combine2 store "objects", "*")

                Assert.True(live.Length > 0)
                let g1 = ZetaFsPath.combine2 store "g1"
                let g2 = ZetaFsPath.combine2 store "g2"
                let journal = ZetaFsFreeze.sweepJournalPath volume
                Assert.True(journal.StartsWith(store, StringComparison.Ordinal))
                FileSystemIo.writeAllBytes FileSystem.Current g1 [| 9uy |]
                FileSystemIo.writeAllBytes FileSystem.Current g2 [| 8uy |]
                mock.ArmCrashOnDelete "g1"
                let ex =
                    Assert.Throws<CrashMidSweepException>(fun () ->
                        ZetaFsFreeze.reclaimSweep
                            volume
                            FileSystem.Current
                            [| dummy 1uy, g1; dummy 2uy, g2 |]
                            { Bytes = 100UL; Count = 10 }
                        |> ignore)

                Assert.Equal(g1, ex.Path)
                Assert.False(FileSystem.Current.Exists g1)
                Assert.True(FileSystem.Current.Exists g2)
                Assert.True(FileSystem.Current.Exists journal)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                let n =
                    ZetaFsFreeze.reclaimSweep
                        volume
                        FileSystem.Current
                        [||]
                        { Bytes = 100UL; Count = 10 }

                Assert.Equal(1, n)
                Assert.False(FileSystem.Current.Exists g2)
                Assert.False(FileSystem.Current.Exists journal)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)

                for p in live do
                    Assert.True(FileSystem.Current.Exists p)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``reclaimTick paces extra CAS garbage and keeps a committed freeze readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/freeze-reclaim-tick"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
        let garbageObj (n: byte) : ZetaFsReclaim.Object =
            { Id = dummy n; Size = 8UL; Refs = [||] }

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let g1 = garbageObj 1uy
                let g2 = garbageObj 2uy
                let p1 = casPath g1.Id
                let p2 = casPath g2.Id
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p1)
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p2)
                FileSystemIo.writeAllBytes FileSystem.Current p1 [| 9uy |]
                FileSystemIo.writeAllBytes FileSystem.Current p2 [| 8uy |]
                let roots =
                    { ZetaFsReclaim.emptyRoots with
                        LiveRefs = [| ZetaFsReclaim.hex first.Content |] }
                let objects = [| g1; g2 |]
                Assert.Equal(
                    0,
                    ZetaFsFreeze.reclaimTick volume FileSystem.Current roots objects 0UL)
                Assert.True(FileSystem.Current.Exists p1)
                Assert.True(FileSystem.Current.Exists p2)
                mock.ArmCrashOnDelete p1
                let ex =
                    Assert.Throws<CrashMidSweepException>(fun () ->
                        ZetaFsFreeze.reclaimTick volume FileSystem.Current roots objects 100UL
                        |> ignore)

                Assert.Equal(p1, ex.Path)
                Assert.False(FileSystem.Current.Exists p1)
                Assert.True(FileSystem.Current.Exists p2)
                Assert.True(FileSystem.Current.Exists(ZetaFsFreeze.sweepJournalPath volume))
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                let n = ZetaFsFreeze.reclaimTick volume FileSystem.Current roots objects 100UL
                Assert.Equal(1, n)
                Assert.False(FileSystem.Current.Exists p2)
                Assert.False(FileSystem.Current.Exists(ZetaFsFreeze.sweepJournalPath volume))
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``BlockCas Delete crash-mid-sweep leaves extra garbage and a readable freeze`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-blockcas-crash-delete"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
        let objectKey (id: ContentHash256) =
            (ContentHash256.toContentAddress128 id).ToHex()
        let garbageObj (n: byte) : ZetaFsReclaim.Object =
            { Id = dummy n; Size = 8UL; Refs = [||] }

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let g1 = garbageObj 1uy
                let g2 = garbageObj 2uy
                let k1 = objectKey g1.Id
                let k2 = objectKey g2.Id
                cas.Put(k1, [| 9uy |])
                cas.Put(k2, [| 8uy |])
                let roots =
                    { ZetaFsReclaim.emptyRoots with
                        LiveRefs = [| ZetaFsReclaim.hex first.Content |] }
                let objects = [| g1; g2 |]
                Assert.Equal(0, ZetaFsFreeze.reclaimTick volume FileSystem.Current roots objects 0UL)
                Assert.True(cas.Exists k1)
                Assert.True(cas.Exists k2)
                cas.ArmCrashOnDelete k1
                let ex =
                    Assert.Throws<CrashMidSweepException>(fun () ->
                        ZetaFsFreeze.reclaimTick volume FileSystem.Current roots objects 100UL
                        |> ignore)

                Assert.Equal(k1, ex.Path)
                Assert.False(cas.Exists k1)
                Assert.True(cas.Exists k2)
                Assert.True(FileSystem.Current.Exists(ZetaFsFreeze.sweepJournalPath volume))
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                let n = ZetaFsFreeze.reclaimTick volume FileSystem.Current roots objects 100UL
                Assert.Equal(1, n)
                Assert.False(cas.Exists k2)
                Assert.False(FileSystem.Current.Exists(ZetaFsFreeze.sweepJournalPath volume))
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``reclaimAsync does not delete until pumpReclaim on a manual volume`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-reclaim-ferry"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
        let garbageObj (n: byte) : ZetaFsReclaim.Object =
            { Id = dummy n; Size = 8UL; Refs = [||] }

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingFreeze = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingFreeze.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let g1 = garbageObj 1uy
                let g2 = garbageObj 2uy
                let p1 = casPath g1.Id
                let p2 = casPath g2.Id
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p1)
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p2)
                FileSystemIo.writeAllBytes FileSystem.Current p1 [| 9uy |]
                FileSystemIo.writeAllBytes FileSystem.Current p2 [| 8uy |]
                let roots =
                    { ZetaFsReclaim.emptyRoots with
                        LiveRefs = [| ZetaFsReclaim.hex first.Content |] }
                let objects = [| g1; g2 |]
                Assert.Equal(0, ZetaFsFreeze.reclaimBoatCount volume)
                let pending =
                    ZetaFsFreeze.reclaimAsync volume roots objects 100UL CancellationToken.None

                Assert.False(pending.IsCompleted)
                Assert.True(FileSystem.Current.Exists p1)
                Assert.True(FileSystem.Current.Exists p2)
                do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                let! n = pending.ConfigureAwait(false)
                Assert.Equal(2, n)
                Assert.Equal(1, ZetaFsFreeze.reclaimBoatCount volume)
                Assert.False(FileSystem.Current.Exists p1)
                Assert.False(FileSystem.Current.Exists p2)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``reclaimTickMetered paces from freeze Span and consumes the meter`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-reclaim-meter"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
        let garbageObj (n: byte) : ZetaFsReclaim.Object =
            { Id = dummy n; Size = 1UL; Refs = [||] }

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(first.Span > 0UL)
                Assert.Equal(first.Span, ZetaFsFreeze.freezeBytesSinceReclaim volume)
                let g1 = garbageObj 1uy
                let g2 = garbageObj 2uy
                let p1 = casPath g1.Id
                let p2 = casPath g2.Id
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p1)
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p2)
                FileSystemIo.writeAllBytes FileSystem.Current p1 [| 9uy |]
                FileSystemIo.writeAllBytes FileSystem.Current p2 [| 8uy |]
                let roots =
                    { ZetaFsReclaim.emptyRoots with
                        LiveRefs = [| ZetaFsReclaim.hex first.Content |] }
                let n =
                    ZetaFsFreeze.reclaimTickMetered
                        volume
                        FileSystem.Current
                        roots
                        [| g1; g2 |]

                Assert.Equal(2, n)
                Assert.Equal(0UL, ZetaFsFreeze.freezeBytesSinceReclaim volume)
                Assert.False(FileSystem.Current.Exists p1)
                Assert.False(FileSystem.Current.Exists p2)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``orphanObjects keeps full ids; path scan is not the catalog`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-orphan-catalog"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume).Length)
                let garbage = dummy 9uy
                let path = casPath garbage
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName path)
                FileSystemIo.writeAllBytes FileSystem.Current path [| 7uy |]
                ZetaFsFreeze.noteKnownObject volume garbage 1UL
                let orphans = ZetaFsFreeze.orphanObjects volume
                Assert.Equal(1, orphans.Length)
                Assert.Equal(garbage, orphans.[0].Id)
                let roots =
                    { ZetaFsReclaim.emptyRoots with
                        LiveRefs = [| ZetaFsReclaim.hex first.Content |] }
                let n =
                    ZetaFsFreeze.reclaimTickMetered volume FileSystem.Current roots orphans

                Assert.Equal(1, n)
                Assert.False(FileSystem.Current.Exists path)
                Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume).Length)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``successful freeze enqueues nonempty orphan reclaim; pumpReclaim deletes`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/freeze-autotick-orphans"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let dummy (n: byte) : ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.Equal(0, ZetaFsFreeze.reclaimBoatCount volume)
                let garbage = dummy 7uy
                let path = casPath garbage
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName path)
                FileSystemIo.writeAllBytes FileSystem.Current path [| 4uy |]
                ZetaFsFreeze.noteKnownObject volume garbage 1UL
                Assert.Equal(1, (ZetaFsFreeze.orphanObjects volume).Length)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    Assert.True(FileSystem.Current.Exists path)
                    Assert.Equal(0, ZetaFsFreeze.reclaimBoatCount volume)
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    Assert.Equal(1, ZetaFsFreeze.reclaimBoatCount volume)
                    Assert.False(FileSystem.Current.Exists path)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``crash leftover CAS object is an orphan the next freeze reclaims`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/crash-orphan-autotick"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume).Length)
                mock.ArmCrashMidWrite("objects", 1)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<CrashMidWriteException>(fun () -> pendingB :> Task)
                        .ConfigureAwait(false)

                let leftovers = ZetaFsFreeze.orphanObjects volume
                Assert.True(leftovers.Length > 0)
                let leftoverPath = casPath leftovers.[0].Id
                Assert.True(FileSystem.Current.Exists leftoverPath)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingC = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! third = pendingC.ConfigureAwait(false)

                match third with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok third ->
                    Assert.True(FileSystem.Current.Exists leftoverPath)
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    Assert.False(FileSystem.Current.Exists leftoverPath)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume third.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``orphan catalog survives volume reopen after crash leftover`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/crash-orphan-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let mutable leftoverId = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                do! (ZetaFsFreeze.pumpReclaim volume1 CancellationToken.None).ConfigureAwait(false)
                firstContent <- ok.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            mock.ArmCrashMidWrite("objects", 1)
            let h = ZetaFsMutbuf.openHandle volume2.Mutbuf id
            ZetaFsMutbuf.pwrite volume2.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
            let pending = (freezeAsync volume2 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume2 CancellationToken.None).ConfigureAwait(false)
            let! _ =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)
            let leftovers = ZetaFsFreeze.orphanObjects volume2
            Assert.True(leftovers.Length > 0)
            leftoverId <- leftovers.[0].Id
        finally
            ZetaFsFreeze.dispose volume2

        let volume3 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            let leftovers = ZetaFsFreeze.orphanObjects volume3
            Assert.True(leftovers.Length > 0)
            Assert.Equal(leftoverId, leftovers.[0].Id)
            let leftoverPath = casPath leftoverId
            let h = ZetaFsMutbuf.openHandle volume3.Mutbuf id
            ZetaFsMutbuf.pwrite volume3.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
            let pending = (freezeAsync volume3 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume3 CancellationToken.None).ConfigureAwait(false)
            let! third = pending.ConfigureAwait(false)
            match third with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok _ ->
                Assert.True(FileSystem.Current.Exists leftoverPath)
                do! (ZetaFsFreeze.pumpReclaim volume3 CancellationToken.None).ConfigureAwait(false)
                Assert.False(FileSystem.Current.Exists leftoverPath)
                Assert.True(ZetaFsFreeze.isReadable volume3 firstContent)
        finally
            ZetaFsFreeze.dispose volume3
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen enqueues orphan reclaim without waiting for the next freeze`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/crash-orphan-reopen-tick"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let casPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let mutable leftoverId = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                do! (ZetaFsFreeze.pumpReclaim volume1 CancellationToken.None).ConfigureAwait(false)
                firstContent <- ok.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            mock.ArmCrashMidWrite("objects", 1)
            let h = ZetaFsMutbuf.openHandle volume2.Mutbuf id
            ZetaFsMutbuf.pwrite volume2.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
            let pending = (freezeAsync volume2 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume2 CancellationToken.None).ConfigureAwait(false)
            let! _ =
                Assert
                    .ThrowsAsync<CrashMidWriteException>(fun () -> pending :> Task)
                    .ConfigureAwait(false)
            let leftovers = ZetaFsFreeze.orphanObjects volume2
            Assert.True(leftovers.Length > 0)
            leftoverId <- leftovers.[0].Id
        finally
            ZetaFsFreeze.dispose volume2

        let volume3 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            let leftoverPath = casPath leftoverId
            Assert.True(FileSystem.Current.Exists leftoverPath)
            Assert.Equal(0, ZetaFsFreeze.reclaimBoatCount volume3)
            do! (ZetaFsFreeze.pumpReclaim volume3 CancellationToken.None).ConfigureAwait(false)
            Assert.Equal(1, ZetaFsFreeze.reclaimBoatCount volume3)
            Assert.False(FileSystem.Current.Exists leftoverPath)
            Assert.True(ZetaFsFreeze.isReadable volume3 firstContent)
        finally
            ZetaFsFreeze.dispose volume3
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen with empty orphan catalog does not enqueue reclaim`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/reopen-empty-orphans"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                do! (ZetaFsFreeze.pumpReclaim volume1 CancellationToken.None).ConfigureAwait(false)
                Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume1).Length)
                firstContent <- ok.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume2).Length)
            do! (ZetaFsFreeze.pumpReclaim volume2 CancellationToken.None).ConfigureAwait(false)
            Assert.Equal(0, ZetaFsFreeze.reclaimBoatCount volume2)
            Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``BlockCas unpinned key is an orphan reopen reclaims`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/block-orphan-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let id = mintId ()
        let leftoverId: ContentHash256 =
            { Raw = Array.init 32 (fun i -> if i = 0 then 0xA5uy else 0uy) }
        let leftoverKey = (ContentHash256.toContentAddress128 leftoverId).ToHex()
        let leftoverBytes = [| 7uy; 7uy; 7uy |]
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManual store mutbuf None

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                do! (ZetaFsFreeze.pumpReclaim volume1 CancellationToken.None).ConfigureAwait(false)
                Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume1).Length)
                match volume1.Log.ObjectCas with
                | None -> Assert.Fail("createManual must have a BlockCas")
                | Some cas ->
                    cas.Put(leftoverKey, leftoverBytes)
                    ZetaFsFreeze.noteKnownObject volume1 leftoverId (uint64 leftoverBytes.Length)
                    Assert.True(cas.Exists leftoverKey)
                    Assert.True((ZetaFsFreeze.orphanObjects volume1).Length > 0)
                firstContent <- ok.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManual store mutbuf None
        try
            let leftovers = ZetaFsFreeze.orphanObjects volume2
            Assert.True(leftovers.Length > 0)
            Assert.Equal(leftoverId, leftovers.[0].Id)
            Assert.Equal(0, ZetaFsFreeze.reclaimBoatCount volume2)
            do! (ZetaFsFreeze.pumpReclaim volume2 CancellationToken.None).ConfigureAwait(false)
            Assert.Equal(1, ZetaFsFreeze.reclaimBoatCount volume2)
            Assert.Equal(0, (ZetaFsFreeze.orphanObjects volume2).Length)
            match volume2.Log.ObjectCas with
            | None -> Assert.Fail("reopen must have a BlockCas")
            | Some cas -> Assert.False(cas.Exists leftoverKey)
            Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``KeepNone second freeze unpins the first after reclaim`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/keepnone-unpin"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        volume.History <- ZetaFsPolicy.HistoryPolicy.KeepNone

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    Assert.False(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``KeepAll second freeze still leaves the first readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/keepall-pins"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``rolling 1 second freeze unpins the first after reclaim`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/rolling-one-unpin"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        volume.History <- ZetaFsPolicy.HistoryPolicy.Rolling(Some 1, None, None)

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    Assert.False(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume second.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``KeepNone unpin survives reopen without pumping reclaim`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/keepnone-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let mutable secondContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManual store mutbuf None
        volume1.History <- ZetaFsPolicy.HistoryPolicy.KeepNone

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.truncate volume1.Mutbuf h 0L |> ignore
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                firstContent <- first.Content
                ZetaFsMutbuf.truncate volume1.Mutbuf h 0L |> ignore
                ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
                let pendingB = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second -> secondContent <- second.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManual store mutbuf None
        try
            Assert.True((ZetaFsFreeze.orphanObjects volume2).Length > 0)
            do! (ZetaFsFreeze.pumpReclaim volume2 CancellationToken.None).ConfigureAwait(false)
            Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
            Assert.True(ZetaFsFreeze.isReadable volume2 secondContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``KeepNone history survives createManual reopen`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/keepnone-history-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManual store mutbuf None
        volume1.History <- ZetaFsPolicy.HistoryPolicy.KeepNone

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.truncate volume1.Mutbuf h 0L |> ignore
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok -> firstContent <- ok.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManual store mutbuf None
        try
            match volume2.History with
            | ZetaFsPolicy.HistoryPolicy.KeepNone -> ()
            | other -> Assert.Fail(sprintf "expected KeepNone, got %A" other)
            let h = ZetaFsMutbuf.openHandle volume2.Mutbuf id
            ZetaFsMutbuf.truncate volume2.Mutbuf h 0L |> ignore
            ZetaFsMutbuf.pwrite volume2.Mutbuf h 0L (Array.init 64 (fun i -> byte i)) |> ignore
            let pending = (freezeAsync volume2 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume2 CancellationToken.None).ConfigureAwait(false)
            let! second = pending.ConfigureAwait(false)
            match second with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok second ->
                do! (ZetaFsFreeze.pumpReclaim volume2 CancellationToken.None).ConfigureAwait(false)
                Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
                Assert.True(ZetaFsFreeze.isReadable volume2 second.Content)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

type private FlushFailFs() =
    interface ISimulatedFs with
        member _.FlushToStableStorage(path) =
            failwith ("BUGGIFY: Simulated disk flush failure for " + path)

        member _.WriteToStableStorage(_) = ()

type private WriteFailFs() =
    interface ISimulatedFs with
        member _.FlushToStableStorage(_) = ()

        member _.WriteToStableStorage(path) =
            failwith ("BUGGIFY: Simulated disk write failure for " + path)

type private CatalogFailFs() =
    interface ISimulatedFs with
        member _.FlushToStableStorage(_) = ()

        member _.WriteToStableStorage(path) =
            if path.IndexOf("known.pins", StringComparison.Ordinal) >= 0 then
                failwith ("BUGGIFY: Simulated disk write failure for " + path)

[<Fact>]
let ``ISimulatedFs flush-fail on the volume door keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/flush-fail-volume"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                SimulatedFs.Register(FlushFailFs() :> ISimulatedFs)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a failed flush")
                | Error e ->
                    Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
                    SimulatedFs.Clear()
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``ISimulatedFs write-fail on object put keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/write-fail-volume"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                SimulatedFs.Register(WriteFailFs() :> ISimulatedFs)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a failed object write")
                | Error e ->
                    Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
                    SimulatedFs.Clear()
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``ISimulatedFs write-fail on BlockCas put keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/write-fail-blockcas"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                SimulatedFs.Register(WriteFailFs() :> ISimulatedFs)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a failed BlockCas put")
                | Error e ->
                    Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
                    SimulatedFs.Clear()
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``ISimulatedFs write-fail on catalog persist keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-write-fail"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                SimulatedFs.Register(CatalogFailFs() :> ISimulatedFs)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a failed catalog persist")
                | Error e ->
                    Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
                    SimulatedFs.Clear()
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``ISimulatedFs write-fail on Buffered catalog persist keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-write-fail-buffered"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                SimulatedFs.Register(CatalogFailFs() :> ISimulatedFs)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let! second =
                    (freezeAsync volume id ZetaFsFreeze.Buffered).AsTask().ConfigureAwait(false)

                match second with
                | Ok _ -> Assert.Fail("Buffered freeze must not ack a failed catalog persist")
                | Error e ->
                    Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
                    SimulatedFs.Clear()
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``catalog write-fail on History setter does not throw and keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-write-fail-history"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                SimulatedFs.Register(CatalogFailFs() :> ISimulatedFs)
                volume.History <- ZetaFsPolicy.HistoryPolicy.KeepNone
                match volume.History with
                | ZetaFsPolicy.HistoryPolicy.KeepNone -> ()
                | other -> Assert.Fail(sprintf "expected KeepNone, got %A" other)
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a failed catalog persist")
                | Error e ->
                    Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
                    SimulatedFs.Clear()
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``planted garbage at the next object path returns MissingLeaves and keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/missing-leaves-garbage-object"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let payloadB = [| 9uy; 8uy; 7uy |]
        let objectPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let ropeB = ZetaFsJumprope.buildV1 payloadB
                for kv in ropeB.Cas.Objects do
                    let path = objectPath kv.Key
                    FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName path)
                    FileSystemIo.writeAllBytes FileSystem.Current path [| 0xA5uy |]
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadB |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a hash-mismatched object")
                | Error e ->
                    Assert.Equal("MissingLeaves", ZetaFsFreeze.errorName e)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.False(ZetaFsFreeze.isReadable volume ropeB.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``planted garbage on BlockCas returns MissingLeaves and keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/missing-leaves-garbage-blockcas"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas
        let payloadB = [| 9uy; 8uy; 7uy |]

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let ropeB = ZetaFsJumprope.buildV1 payloadB
                for kv in ropeB.Cas.Objects do
                    let key = (ContentHash256.toContentAddress128 kv.Key).ToHex()
                    cas.Put(key, [| 0xA5uy |])
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadB |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a hash-mismatched BlockCas object")
                | Error e ->
                    Assert.Equal("MissingLeaves", ZetaFsFreeze.errorName e)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                    Assert.False(ZetaFsFreeze.isReadable volume ropeB.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``planted garbage at the next object path returns MissingLeaves on Buffered freeze`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/missing-leaves-garbage-buffered"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None
        let payloadB = [| 9uy; 8uy; 7uy |]
        let objectPath (id: ContentHash256) =
            let hex = (ContentHash256.toContentAddress128 id).ToHex()
            ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let ropeB = ZetaFsJumprope.buildV1 payloadB
                for kv in ropeB.Cas.Objects do
                    let path = objectPath kv.Key
                    FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName path)
                    FileSystemIo.writeAllBytes FileSystem.Current path [| 0xA5uy |]
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadB |> ignore
                let! second =
                    (freezeAsync volume id ZetaFsFreeze.Buffered).AsTask().ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("Buffered freeze must not ack a hash-mismatched object")
                | Error e ->
                    Assert.Equal("MissingLeaves", ZetaFsFreeze.errorName e)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``catalog write-fail of tmp does not publish the unacked freeze on reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-write-fail-tmp"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payloadA = [| 1uy; 2uy; 3uy |]
        let payloadB = [| 9uy; 8uy; 7uy |]
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payloadA |> ignore
            let pendingA = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                firstContent <- ok.Content
                SimulatedFs.Register(CatalogFailFs() :> ISimulatedFs)
                ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payloadB |> ignore
                let pendingB = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Ok _ -> Assert.Fail("second freeze must not ack a failed catalog persist")
                | Error e -> Assert.Equal("Fsync", ZetaFsFreeze.errorName e)
        finally
            SimulatedFs.Clear()
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
            let ropeB = ZetaFsJumprope.buildV1 payloadB
            Assert.False(ZetaFsFreeze.isReadable volume2 ropeB.Content)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``power outage on the second freeze Flush keeps the first`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/power-outage-second-freeze"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096, volatileUntilFlush = true)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                logDev.ArmPowerOutageOnFlush()
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<PowerOutageException>(fun () -> pendingB :> Task)
                        .ConfigureAwait(false)

                ZetaFsFreeze.dispose volume
                let logClone = logDev.CloneMedia()
                let objClone = objDev.CloneMedia()
                let cas2 = BlockCas(objClone)
                let reopened = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logClone cas2

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``bad memory on the second freeze Write keeps the first`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/bad-memory-second-freeze"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                logDev.ArmBadMemoryOnWrite()
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<BadMemoryException>(fun () -> pendingB :> Task)
                        .ConfigureAwait(false)

                ZetaFsFreeze.dispose volume
                let logClone = logDev.CloneMedia()
                let objClone = objDev.CloneMedia()
                let cas2 = BlockCas(objClone)
                let reopened = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logClone cas2

                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``XOR of a later freeze object is not readable; the prior freeze still is`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/hash-verify-xor-b"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                let objectsDir = ZetaFsPath.combine2 store "objects"
                let afterA =
                    FileSystem.Current.GetFiles(objectsDir, "*")
                    |> Array.filter (fun p -> not (p.EndsWith(".tmp", StringComparison.Ordinal)))
                    |> Set.ofArray
                ZetaFsMutbuf.truncate volume.Mutbuf h 0L |> ignore
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 9uy; 8uy; 7uy |] |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)
                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok second ->
                    let afterB =
                        FileSystem.Current.GetFiles(objectsDir, "*")
                        |> Array.filter (fun p -> not (p.EndsWith(".tmp", StringComparison.Ordinal)))
                    let news =
                        afterB
                        |> Array.filter (fun p -> not (Set.contains p afterA))
                    Assert.True(news.Length > 0)
                    let mutable i = 0

                    while i < news.Length do
                        let path = news.[i]
                        let bytes = FileSystem.Current.ReadAllBytes path

                        if bytes.Length > 0 then
                            bytes.[bytes.Length - 1] <- bytes.[bytes.Length - 1] ^^^ 0xA5uy
                            FileSystemIo.writeAllBytes FileSystem.Current path bytes

                        i <- i + 1

                    Assert.False(ZetaFsFreeze.isReadable volume second.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``XOR after reopen is not readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/hash-verify-reopen-xor"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok -> firstContent <- ok.Content
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
            let objectsDir = ZetaFsPath.combine2 store "objects"
            let files =
                FileSystem.Current.GetFiles(objectsDir, "*")
                |> Array.filter (fun p -> not (p.EndsWith(".tmp", StringComparison.Ordinal)))
            Assert.True(files.Length > 0)
            let mutable i = 0

            while i < files.Length do
                let path = files.[i]
                let bytes = FileSystem.Current.ReadAllBytes path

                if bytes.Length > 0 then
                    bytes.[bytes.Length - 1] <- bytes.[bytes.Length - 1] ^^^ 0xA5uy
                    FileSystemIo.writeAllBytes FileSystem.Current path bytes

                i <- i + 1

            Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``XOR of BlockCas payload is not readable`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/hash-verify-blockcas-xor"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let volume = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                Assert.True(ZetaFsFreeze.isReadable volume first.Content)
                Assert.True(cas.XorLastPayloadByteAll() > 0)
                Assert.False(ZetaFsFreeze.isReadable volume first.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``XOR of BlockCas payload stays unread after CloneMedia reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/hash-verify-blockcas-xor-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                firstContent <- ok.Content
                Assert.True(ZetaFsFreeze.isReadable volume1 firstContent)
                Assert.True(cas.XorLastPayloadByteAll() > 0)
                Assert.False(ZetaFsFreeze.isReadable volume1 firstContent)
        finally
            ZetaFsFreeze.dispose volume1

        let logClone = logDev.CloneMedia()
        let objClone = objDev.CloneMedia()
        let cas2 = BlockCas(objClone)
        let volume2 = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logClone cas2
        try
            Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``crash mid-write of known.pins keeps the prior freeze readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/catalog-crash-keeps-pins"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id1 = mintId ()
            let h1 = ZetaFsMutbuf.openHandle volume.Mutbuf id1
            ZetaFsMutbuf.pwrite volume.Mutbuf h1 0L [| 1uy |] |> ignore
            let pending1 = (freezeAsync volume id1 ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok first ->
                mock.ArmCrashMidWrite("known.pins", 8)
                let id2 = mintId ()
                let h2 = ZetaFsMutbuf.openHandle volume.Mutbuf id2
                ZetaFsMutbuf.pwrite volume.Mutbuf h2 0L [| 2uy |] |> ignore
                let pending2 = (freezeAsync volume id2 ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<CrashMidWriteException>(fun () -> pending2 :> Task)
                        .ConfigureAwait(false)

                ZetaFsFreeze.dispose volume
                let reopened = ZetaFsFreeze.createManual store mutbuf None
                try
                    Assert.True(ZetaFsFreeze.isReadable reopened first.Content)
                finally
                    ZetaFsFreeze.dispose reopened
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``torn higher catalog slot loads the previous history policy`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/dual-slot-catalog"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume1 = ZetaFsFreeze.createManual store mutbuf None

        try
            volume1.History <- ZetaFsPolicy.HistoryPolicy.KeepNone
            volume1.History <- ZetaFsPolicy.HistoryPolicy.KeepAll
            let higher = ZetaFsPath.combine2 store "known.pins.0"
            Assert.True(FileSystem.Current.Exists higher)
            let bytes = FileSystem.Current.ReadAllBytes higher
            Assert.True(bytes.Length > 0)
            bytes.[bytes.Length - 1] <- bytes.[bytes.Length - 1] ^^^ 0xA5uy
            FileSystemIo.writeAllBytes FileSystem.Current higher bytes
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManual store mutbuf None
        try
            match volume2.History with
            | ZetaFsPolicy.HistoryPolicy.KeepNone -> ()
            | other -> Assert.Fail(sprintf "expected KeepNone from slot 1, got %A" other)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

let private catalogGenOf (path: string) : int64 option =
    if not (FileSystem.Current.Exists path) then
        None
    else
        let text = Encoding.UTF8.GetString(FileSystem.Current.ReadAllBytes path)
        let lines = text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

        lines
        |> Array.tryFind (fun line -> line.StartsWith("gen ", StringComparison.Ordinal))
        |> Option.bind (fun line ->
            match Int64.TryParse(line.Substring(4), NumberStyles.Integer, CultureInfo.InvariantCulture) with
            | true, g -> Some g
            | _ -> None)

[<Fact>]
let ``catalog persist keeps in-memory generation when both slots fail to decode`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register mock
        let store = "/catalog-gen-in-memory"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            volume.History <- ZetaFsPolicy.HistoryPolicy.KeepNone
            volume.History <- ZetaFsPolicy.HistoryPolicy.KeepAll
            let slot0 = ZetaFsPath.combine2 store "known.pins.0"
            let slot1 = ZetaFsPath.combine2 store "known.pins.1"
            let tear path =
                let bytes = FileSystem.Current.ReadAllBytes path
                bytes.[bytes.Length - 1] <- bytes.[bytes.Length - 1] ^^^ 0xA5uy
                FileSystemIo.writeAllBytes FileSystem.Current path bytes

            tear slot0
            tear slot1
            volume.History <- ZetaFsPolicy.HistoryPolicy.KeepNone
            let g0 = catalogGenOf slot0
            let g1 = catalogGenOf slot1
            let highest =
                match g0, g1 with
                | Some a, Some b -> max a b
                | Some a, None -> a
                | None, Some b -> b
                | None, None -> 0L

            Assert.Equal(3L, highest)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``catalog persist writes dual slots and not the known.pins alias`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-no-alias"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            volume.History <- ZetaFsPolicy.HistoryPolicy.KeepNone
            let alias = ZetaFsPath.combine2 store "known.pins"
            let slot0 = ZetaFsPath.combine2 store "known.pins.0"
            let slot1 = ZetaFsPath.combine2 store "known.pins.1"
            Assert.False(FileSystem.Current.Exists alias)
            Assert.True(FileSystem.Current.Exists slot0 || FileSystem.Current.Exists slot1)
        finally
            ZetaFsFreeze.dispose volume

        let reopened = ZetaFsFreeze.createManual store mutbuf None
        try
            match reopened.History with
            | ZetaFsPolicy.HistoryPolicy.KeepNone -> ()
            | other -> Assert.Fail(sprintf "expected KeepNone from slots, got %A" other)
        finally
            ZetaFsFreeze.dispose reopened
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen still loads leftover known.pins when both slots are missing`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-legacy-alias"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        FileSystem.Current.CreateDirectory store
        FileSystemIo.writeAllText
            FileSystem.Current
            (ZetaFsPath.combine2 store "known.pins")
            "history keep-none\nmeter 0\n"
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            match volume.History with
            | ZetaFsPolicy.HistoryPolicy.KeepNone -> ()
            | other -> Assert.Fail(sprintf "expected KeepNone from leftover alias, got %A" other)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``one Journaled freeze does not persist catalog again at boat success`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/catalog-no-succeed-persist"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy |] |> ignore
            let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok _ ->
                let slot0 = ZetaFsPath.combine2 store "known.pins.0"
                let slot1 = ZetaFsPath.combine2 store "known.pins.1"
                let g0 = catalogGenOf slot0
                let g1 = catalogGenOf slot1
                let highest =
                    match g0, g1 with
                    | Some a, Some b -> max a b
                    | Some a, None -> a
                    | None, Some b -> b
                    | None, None -> 0L

                // Per-item persist (1) + noteFreeze (2). applyRetention
                // updates pins in memory; noteFreeze writes them once.
                Assert.Equal(2L, highest)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``one-byte edit freeze does not duplicate known CAS objects`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/d9-pointer-not-copy"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            let before = Array.init 500_000 (fun i -> byte (i % 251))
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L before |> ignore
            let n0 = ZetaFsFreeze.knownCount volume
            let pending1 = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a ->
                let n1 = ZetaFsFreeze.knownCount volume
                let firstGrowth = n1 - n0
                Assert.True(firstGrowth > 6, sprintf "first freeze grew known by %d" firstGrowth)
                let after = Array.copy before
                after.[250_000] <- after.[250_000] ^^^ 1uy
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L after |> ignore
                let pending2 = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok b ->
                    Assert.NotEqual<string>(a.Content.ToHex(), b.Content.ToHex())
                    let n2 = ZetaFsFreeze.knownCount volume
                    let secondGrowth = n2 - n1
                    Assert.True(
                        secondGrowth < firstGrowth / 2 && secondGrowth <= 32,
                        sprintf "1-byte edit grew known by %d after first grew by %d" secondGrowth firstGrowth
                    )
                    Assert.True(ZetaFsFreeze.isReadable volume a.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume b.Content)
                    Assert.Equal((ZetaFsJumprope.buildV1 after).Content.ToHex(), b.Content.ToHex())
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen still has layout so a 1-byte edit reuses prefix`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/d9-layout-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payloadA = Array.init 500_000 (fun i -> byte (i % 251))
        let payloadB = Array.copy payloadA
        payloadB.[250_000] <- payloadB.[250_000] ^^^ 1uy
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManual store mutbuf None

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payloadA |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a ->
                firstContent <- a.Content
                Assert.True(ZetaFsFreeze.hasPrev volume1 id)
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManual store mutbuf None

        try
            Assert.True(ZetaFsFreeze.hasPrev volume2 id)
            let h2 = ZetaFsMutbuf.openHandle volume2.Mutbuf id
            ZetaFsMutbuf.pwrite volume2.Mutbuf h2 0L payloadB |> ignore
            let pendingB = (freezeAsync volume2 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume2 CancellationToken.None).ConfigureAwait(false)
            let! second = pendingB.ConfigureAwait(false)

            match second with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok b ->
                Assert.NotEqual<string>(firstContent.ToHex(), b.Content.ToHex())
                Assert.Equal((ZetaFsJumprope.buildV1 payloadB).Content.ToHex(), b.Content.ToHex())
                Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
                Assert.True(ZetaFsFreeze.isReadable volume2 b.Content)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``append freeze ContentId matches full Jumprope build`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/d9-append-length"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let before = Array.init 500_000 (fun i -> byte (i % 251))
        let after = Array.append before (Array.init 8_192 (fun i -> byte (i % 199)))
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L before |> ignore
            let pending1 = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pending1.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a ->
                let n1 = ZetaFsFreeze.knownCount volume
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L after |> ignore
                let pending2 = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pending2.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok b ->
                    Assert.NotEqual<string>(a.Content.ToHex(), b.Content.ToHex())
                    Assert.Equal((ZetaFsJumprope.buildV1 after).Content.ToHex(), b.Content.ToHex())
                    let secondGrowth = ZetaFsFreeze.knownCount volume - n1
                    Assert.True(
                        secondGrowth < n1 / 2 && secondGrowth <= 32,
                        sprintf "append grew known by %d after first count %d" secondGrowth n1
                    )
                    Assert.True(ZetaFsFreeze.isReadable volume a.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume b.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``garbage layout after freeze still lets the next overwrite match a full build`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/d9-layout-garbage"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payloadA = Array.init 500_000 (fun i -> byte (i % 251))
        let payloadB = Array.copy payloadA
        payloadB.[250_000] <- payloadB.[250_000] ^^^ 1uy
        let id = mintId ()
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManual store mutbuf None

        try
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payloadA |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a -> firstContent <- a.Content
        finally
            ZetaFsFreeze.dispose volume1

        let layout =
            ZetaFsPath.combine3 store "layout" (ZetaFsNamespace.EntityId.format id)

        FileSystemIo.writeAllText FileSystem.Current layout "not-a-layout\n"
        let volume2 = ZetaFsFreeze.createManual store mutbuf None

        try
            let h2 = ZetaFsMutbuf.openHandle volume2.Mutbuf id
            ZetaFsMutbuf.pwrite volume2.Mutbuf h2 0L payloadB |> ignore
            let pendingB = (freezeAsync volume2 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume2 CancellationToken.None).ConfigureAwait(false)
            let! second = pendingB.ConfigureAwait(false)

            match second with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok b ->
                Assert.Equal((ZetaFsJumprope.buildV1 payloadB).Content.ToHex(), b.Content.ToHex())
                Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
                Assert.True(ZetaFsFreeze.isReadable volume2 b.Content)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``crash-mid-write of layout during freeze B still acks and keeps A`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/d9-hint-crash"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payloadA = Array.init 500_000 (fun i -> byte (i % 251))
        let payloadB = Array.copy payloadA
        payloadB.[250_000] <- payloadB.[250_000] ^^^ 1uy
        let volume = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadA |> ignore
            let pendingA = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a ->
                mock.ArmCrashMidWrite("/layout/", 1)
                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payloadB |> ignore
                let pendingB = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                let! second = pendingB.ConfigureAwait(false)

                match second with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok b ->
                    Assert.Equal((ZetaFsJumprope.buildV1 payloadB).Content.ToHex(), b.Content.ToHex())
                    Assert.True(ZetaFsFreeze.isReadable volume a.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume b.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``remap-epoch crash-mid-write keeps the prior ContentId readable`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/remap-epoch-crash"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payloadA = Array.init 500_000 (fun i -> byte (i % 251))
        let payloadB = Array.copy payloadA
        payloadB.[250_000] <- payloadB.[250_000] ^^^ 1uy
        let ropeB = ZetaFsJumprope.buildV1 payloadB
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payloadA |> ignore
            let n0 = ZetaFsFreeze.knownCount volume1
            let pendingA = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pendingA.ConfigureAwait(false)

            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a ->
                firstContent <- a.Content
                let firstGrowth = ZetaFsFreeze.knownCount volume1 - n0
                Assert.True(firstGrowth > 6, sprintf "first freeze grew known by %d" firstGrowth)
                Assert.NotEqual<string>(a.Content.ToHex(), ropeB.Content.ToHex())
                Assert.True(ZetaFsFreeze.isReadable volume1 a.Content)
                mock.ArmCrashMidWrite("objects", 1)
                ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payloadB |> ignore
                let pendingB = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
                do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
                let! _ =
                    Assert
                        .ThrowsAsync<CrashMidWriteException>(fun () -> pendingB :> Task)
                        .ConfigureAwait(false)

                Assert.True(ZetaFsFreeze.isReadable volume1 a.Content)
                Assert.False(ZetaFsFreeze.isReadable volume1 ropeB.Content)
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
            Assert.False(ZetaFsFreeze.isReadable volume2 ropeB.Content)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``freeze-byte meter survives createManual reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/meter-reopen"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let mutable span = 0UL
        let volume1 = ZetaFsFreeze.createManual store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                span <- ok.Span
                Assert.True(span > 0UL)
                Assert.Equal(span, ZetaFsFreeze.freezeBytesSinceReclaim volume1)
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManual store mutbuf None
        try
            Assert.Equal(span, ZetaFsFreeze.freezeBytesSinceReclaim volume2)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``reopen freeze-byte meter still paces reclaimTickMetered`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/meter-reopen-paces"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                firstContent <- ok.Content
                Assert.True(ok.Span > 0UL)
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            Assert.True(ZetaFsFreeze.freezeBytesSinceReclaim volume2 > 0UL)
            let dummy (n: byte) : ContentHash256 =
                { Raw = Array.init 32 (fun i -> if i = 0 then n else 0uy) }
            let casPath (id: ContentHash256) =
                let hex = (ContentHash256.toContentAddress128 id).ToHex()
                ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
            let g1 = dummy 1uy
            let p1 = casPath g1
            FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName p1)
            FileSystemIo.writeAllBytes FileSystem.Current p1 [| 9uy |]
            let roots =
                { ZetaFsReclaim.emptyRoots with
                    LiveRefs = [| ZetaFsReclaim.hex firstContent |] }
            let n =
                ZetaFsFreeze.reclaimTickMetered
                    volume2
                    FileSystem.Current
                    roots
                    [| { Id = g1; Size = 1UL; Refs = [||] } |]
            Assert.Equal(1, n)
            Assert.Equal(0UL, ZetaFsFreeze.freezeBytesSinceReclaim volume2)
            Assert.False(FileSystem.Current.Exists p1)
            Assert.True(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``XOR of jumprope internal stays unread after reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/objectsets-reopen-internal"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payload = [| 1uy; 2uy; 3uy |]
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualStream store mutbuf None

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payload |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                firstContent <- ok.Content
                Assert.True(ZetaFsFreeze.isReadable volume1 firstContent)
                let rope = ZetaFsJumprope.buildV1 payload
                Assert.Equal(ok.Content.ToHex(), rope.Content.ToHex())
                let chunks = rope.Leaves |> Array.map fst
                let internals =
                    rope.Cas.Objects
                    |> Seq.map (fun kv -> kv.Key)
                    |> Seq.filter (fun hid ->
                        not (hid.Equals rope.Content)
                        && not (Array.exists (fun c -> c.Equals hid) chunks))
                    |> Seq.toArray
                Assert.True(internals.Length > 0)
                let target = internals.[0]
                let hex = (ContentHash256.toContentAddress128 target).ToHex()
                let path = ZetaFsPath.combine4 store "objects" (hex.Substring(0, 2)) (hex.Substring(2))
                Assert.True(FileSystem.Current.Exists path)
                let bytes = FileSystem.Current.ReadAllBytes path
                Assert.True(bytes.Length > 0)
                let poisoned = Array.copy bytes
                poisoned.[poisoned.Length - 1] <- poisoned.[poisoned.Length - 1] ^^^ 0xA5uy
                FileSystemIo.writeAllBytes FileSystem.Current path poisoned
                Assert.False(ZetaFsFreeze.isReadable volume1 firstContent)
        finally
            ZetaFsFreeze.dispose volume1

        let volume2 = ZetaFsFreeze.createManualStream store mutbuf None
        try
            Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``XOR of one BlockCas jumprope internal stays unread after CloneMedia reopen`` () : Task =
    task {
        ensureHasher ()
        FileSystem.Register(InMemoryFileSystem())
        let store = "/objectsets-blockcas-internal-xor"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let payload = [| 1uy; 2uy; 3uy |]
        let logDev = SimulatedBlockIo(4096)
        let objDev = SimulatedBlockIo(4096)
        let cas = BlockCas(objDev)
        let mutable firstContent = Unchecked.defaultof<ContentHash256>
        let volume1 = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logDev cas

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume1.Mutbuf id
            ZetaFsMutbuf.pwrite volume1.Mutbuf h 0L payload |> ignore
            let pending = (freezeAsync volume1 id ZetaFsFreeze.Journaled).AsTask()
            do! (ZetaFsFreeze.pumpLog volume1 CancellationToken.None).ConfigureAwait(false)
            let! first = pending.ConfigureAwait(false)
            match first with
            | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok ok ->
                firstContent <- ok.Content
                Assert.True(ZetaFsFreeze.isReadable volume1 firstContent)
                let rope = ZetaFsJumprope.buildV1 payload
                Assert.Equal(ok.Content.ToHex(), rope.Content.ToHex())
                let chunks = rope.Leaves |> Array.map fst
                let internals =
                    rope.Cas.Objects
                    |> Seq.map (fun kv -> kv.Key)
                    |> Seq.filter (fun hid ->
                        not (hid.Equals rope.Content)
                        && not (Array.exists (fun c -> c.Equals hid) chunks))
                    |> Seq.toArray
                Assert.True(internals.Length > 0)
                let key = (ContentHash256.toContentAddress128 internals.[0]).ToHex()
                Assert.True(cas.XorLastPayloadByte key)
                Assert.False(ZetaFsFreeze.isReadable volume1 firstContent)
        finally
            ZetaFsFreeze.dispose volume1

        let logClone = logDev.CloneMedia()
        let objClone = objDev.CloneMedia()
        let cas2 = BlockCas(objClone)
        let volume2 = ZetaFsFreeze.createManualWithBlockStore store mutbuf None logClone cas2
        try
            Assert.False(ZetaFsFreeze.isReadable volume2 firstContent)
        finally
            ZetaFsFreeze.dispose volume2
            FileSystem.Reset()
    }

[<Fact>]
let ``rolling 1 third freeze must not revive the first generation`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/rolling-one-three"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        volume.History <- ZetaFsPolicy.HistoryPolicy.Rolling(Some 1, None, None)

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            let freezeOnce (payload: byte[]) =
                task {
                    ZetaFsMutbuf.truncate volume.Mutbuf h 0L |> ignore
                    ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payload |> ignore
                    let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                    do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                    let! r = pending.ConfigureAwait(false)
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    return r
                }

            let! a = freezeOnce [| 1uy; 2uy; 3uy |]
            let! b = freezeOnce [| 9uy; 8uy; 7uy; 6uy |]
            match a, b with
            | Error e, _
            | _, Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a, Ok b ->
                Assert.False(ZetaFsFreeze.isReadable volume a.Content)
                Assert.True(ZetaFsFreeze.isReadable volume b.Content)
                let! c = freezeOnce [| 5uy; 4uy; 3uy; 2uy; 1uy; 0uy |]
                match c with
                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                | Ok c ->
                    Assert.False(ZetaFsFreeze.isReadable volume a.Content)
                    Assert.False(ZetaFsFreeze.isReadable volume b.Content)
                    Assert.True(ZetaFsFreeze.isReadable volume c.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }

[<Fact>]
let ``rolling 2 after three freezes drops only the oldest`` () : Task =
    task {
        ensureHasher ()
        let mock = InMemoryFileSystem()
        FileSystem.Register(mock)
        let store = "/rolling-two-three"
        let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let volume = ZetaFsFreeze.createManual store mutbuf None
        volume.History <- ZetaFsPolicy.HistoryPolicy.Rolling(Some 2, None, None)

        try
            let id = mintId ()
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
            let freezeOnce (payload: byte[]) =
                task {
                    ZetaFsMutbuf.truncate volume.Mutbuf h 0L |> ignore
                    ZetaFsMutbuf.pwrite volume.Mutbuf h 0L payload |> ignore
                    let pending = (freezeAsync volume id ZetaFsFreeze.Journaled).AsTask()
                    do! (ZetaFsFreeze.pumpLog volume CancellationToken.None).ConfigureAwait(false)
                    let! r = pending.ConfigureAwait(false)
                    do! (ZetaFsFreeze.pumpReclaim volume CancellationToken.None).ConfigureAwait(false)
                    return r
                }

            let! a = freezeOnce [| 1uy; 2uy; 3uy |]
            let! b = freezeOnce [| 9uy; 8uy; 7uy; 6uy |]
            let! c = freezeOnce [| 5uy; 4uy; 3uy; 2uy; 1uy; 0uy |]
            match a, b, c with
            | Error e, _, _
            | _, Error e, _
            | _, _, Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
            | Ok a, Ok b, Ok c ->
                Assert.False(ZetaFsFreeze.isReadable volume a.Content)
                Assert.True(ZetaFsFreeze.isReadable volume b.Content)
                Assert.True(ZetaFsFreeze.isReadable volume c.Content)
        finally
            ZetaFsFreeze.dispose volume
            FileSystem.Reset()
    }
