module Zeta.Tests.Chip8CrossRunStoreIOTests

open System
open System.IO
open System.Text
open System.Threading
open global.Xunit
open Zeta.Core

let private root = "/orbits"
let private rom = [| 0x12uy; 0x00uy |]

let private ok (result: Result<'T, Chip8CrossRunStore.Feedback>) =
    match result with
    | Ok value -> value
    | Error feedback -> failwithf "expected artifact, got %A" feedback

let private artifact seed =
    let key =
        Chip8CrossRunStore.runKey
            rom
            seed
            Chip8.ProgramStart
            "chip8"
            Chip8CrossRunStore.RunChannelLabel.clean

    Chip8CrossRunStore.precompute
        { MaxSteps = 8
          Attribution = "Chip8CrossRunStoreIO.Tests: fixed-point fixture closes at one step" }
        1
        key
        rom
    |> ok

let private pathFor (artifact: Chip8CrossRunStore.Artifact) =
    Path.Combine(root, Chip8CrossRunStore.artifactFileName artifact.Key)

let private seedFile (fileSystem: InMemoryFileSystem) path bytes =
    fileSystem.Files.[path] <- bytes

let private seedArtifact fileSystem path artifact =
    artifact
    |> Chip8CrossRunStore.toJson
    |> Encoding.UTF8.GetBytes
    |> seedFile fileSystem path

let private cancelAfterReadFileSystem (inner: IFileSystem) (cancelled: CancellationTokenSource) =
    { new IFileSystem with
        member _.Exists path = inner.Exists path
        member _.Delete path = inner.Delete path
        member _.Move(src, dest, overwrite) = inner.Move(src, dest, overwrite)
        member _.ReadAllBytes path = inner.ReadAllBytes path

        member _.ReadAllBytesAsync(path, ct) =
            task {
                let! bytes = inner.ReadAllBytesAsync(path, ct)
                cancelled.Cancel()
                return bytes
            }

        member _.OpenFile(path, mode, access, share) = inner.OpenFile(path, mode, access, share)
        member _.OpenWrite(path, fsync) = inner.OpenWrite(path, fsync)
        member _.OpenRead path = inner.OpenRead path
        member _.GetFiles(path, searchPattern) = inner.GetFiles(path, searchPattern)
        member _.CreateDirectory path = inner.CreateDirectory path }

[<Fact>]
let ``IO1 a fully verified directory publishes one exact reader`` () =
    task {
        let fileSystem = InMemoryFileSystem()
        let stored = artifact 7UL
        let path = pathFor stored
        seedArtifact fileSystem path stored

        let! result =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root CancellationToken.None

        match result with
        | Error feedback -> failwithf "expected loaded store, got %A" feedback
        | Ok loaded ->
            Assert.Equal(1, loaded.Artifacts.Length)
            Assert.Equal<string list>([ path ], loaded.Paths)
            Assert.Equal(bigint (Encoding.UTF8.GetByteCount(Chip8CrossRunStore.toJson stored)), loaded.ByteCount)

            match loaded.Reader.TryGet stored.Key with
            | Some read -> Assert.Equal(Chip8CrossRunStore.toJson stored, Chip8CrossRunStore.toJson read)
            | None -> failwith "the published reader did not contain the verified artifact"
    }

[<Fact>]
let ``IO2 an empty directory publishes the honest empty reader`` () =
    task {
        let fileSystem = InMemoryFileSystem()
        let! result =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root CancellationToken.None

        match result with
        | Error feedback -> failwithf "expected empty store, got %A" feedback
        | Ok loaded ->
            Assert.Empty loaded.Artifacts
            Assert.Equal(0I, loaded.ByteCount)
            Assert.True(loaded.Reader.TryGet((artifact 1UL).Key).IsNone)
    }

[<Fact>]
let ``IO3 one corrupt artifact refuses the entire directory`` () =
    task {
        let fileSystem = InMemoryFileSystem()
        let valid = artifact 2UL
        let corrupt = artifact 3UL
        seedArtifact fileSystem (pathFor valid) valid

        let corruptText =
            (Chip8CrossRunStore.toJson corrupt)
                .Replace("\"bodyDigest\": \"", "\"bodyDigest\": \"0", StringComparison.Ordinal)

        seedFile fileSystem (pathFor corrupt) (Encoding.UTF8.GetBytes corruptText)

        let! result =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root CancellationToken.None

        match result with
        | Error(Chip8CrossRunStoreIO.ArtifactRejected(path, Chip8CrossRunStore.DigestMismatch _)) ->
            Assert.Equal(pathFor corrupt, path)
        | other -> failwithf "a corrupt member must refuse the whole set, got %A" other
    }

[<Fact>]
let ``IO4 a valid artifact under a non-canonical filename is refused`` () =
    task {
        let fileSystem = InMemoryFileSystem()
        let stored = artifact 4UL
        let wrongPath = Path.Combine(root, "0000000000000000.orbit.json")
        seedArtifact fileSystem wrongPath stored

        let! result =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root CancellationToken.None

        match result with
        | Error(Chip8CrossRunStoreIO.ArtifactFileNameMismatch(path, expected)) ->
            Assert.Equal(wrongPath, path)
            Assert.Equal(Chip8CrossRunStore.artifactFileName stored.Key, expected)
        | other -> failwithf "a misnamed artifact must be refused, got %A" other
    }

[<Fact>]
let ``IO5 two files for one run key are refused instead of last-writer-wins`` () =
    task {
        let fileSystem = InMemoryFileSystem()
        let stored = artifact 5UL
        let fileName = Chip8CrossRunStore.artifactFileName stored.Key
        let first = Path.Combine(root, "a", fileName)
        let second = Path.Combine(root, "b", fileName)
        seedArtifact fileSystem first stored
        seedArtifact fileSystem second stored

        let! result =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root CancellationToken.None

        match result with
        | Error(Chip8CrossRunStoreIO.DuplicateRunKey(key, firstPath, duplicatePath)) ->
            Assert.Equal(Chip8CrossRunStore.keyText stored.Key, key)
            Assert.Equal(first, firstPath)
            Assert.Equal(second, duplicatePath)
        | other -> failwithf "duplicate keys must be refused, got %A" other
    }

[<Fact>]
let ``IO6 invalid UTF-8 and cancellation are typed refusals`` () =
    task {
        let fileSystem = InMemoryFileSystem()
        let stored = artifact 6UL
        seedFile fileSystem (pathFor stored) [| 0xC3uy; 0x28uy |]

        let! invalid =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root CancellationToken.None

        match invalid with
        | Error(Chip8CrossRunStoreIO.TextDecodeFailed path) -> Assert.Equal(pathFor stored, path)
        | other -> failwithf "invalid UTF-8 must be refused, got %A" other

        use cancelled = new CancellationTokenSource()
        cancelled.Cancel()

        let! stopped =
            Chip8CrossRunStoreIO.loadDirectoryAsync (fileSystem :> IFileSystem) root cancelled.Token

        Assert.Equal<Result<Chip8CrossRunStoreIO.LoadedStore, Chip8CrossRunStoreIO.Feedback>>(
            Error(Chip8CrossRunStoreIO.Cancelled None),
            stopped
        )

        seedArtifact fileSystem (pathFor stored) stored
        use cancelledAfterRead = new CancellationTokenSource()

        let! stoppedBeforePublication =
            Chip8CrossRunStoreIO.loadDirectoryAsync
                (cancelAfterReadFileSystem (fileSystem :> IFileSystem) cancelledAfterRead)
                root
                cancelledAfterRead.Token

        Assert.Equal<Result<Chip8CrossRunStoreIO.LoadedStore, Chip8CrossRunStoreIO.Feedback>>(
            Error(Chip8CrossRunStoreIO.Cancelled(Some(pathFor stored))),
            stoppedBeforePublication
        )
    }
