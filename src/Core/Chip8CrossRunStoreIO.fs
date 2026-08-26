namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Text
open System.Threading
open System.Threading.Tasks

/// Async IO adapter for immutable CHIP-8 orbit artifacts. The pure store remains
/// unaware of files; callers inject this adapter's completed reader into a room.
[<RequireQualifiedAccess>]
module Chip8CrossRunStoreIO =

    type Feedback =
        | RootNotSpecified
        | EnumerationFailed of root: string * detail: string
        | ReadFailed of path: string * detail: string
        | TextDecodeFailed of path: string
        | ArtifactRejected of path: string * feedback: Chip8CrossRunStore.Feedback
        | ArtifactFileNameMismatch of path: string * expectedFileName: string
        | DuplicateRunKey of key: string * firstPath: string * duplicatePath: string
        | Cancelled of path: string option

    type LoadedStore =
        { Reader: Chip8CrossRunStore.Reader
          Artifacts: Chip8CrossRunStore.Artifact list
          Paths: string list
          ByteCount: bigint }

    type private LoadedArtifact =
        { Path: string
          Artifact: Chip8CrossRunStore.Artifact
          ByteCount: int64 }

    let private strictUtf8 = UTF8Encoding(false, true)

    let private exceptionDetail (ex: exn) =
        ex.GetType().Name + ": " + ex.Message

    let private readArtifactAsync
        (fileSystem: IFileSystem)
        (path: string)
        (ct: CancellationToken)
        : Task<Result<LoadedArtifact, Feedback>> =
        task {
            try
                if ct.IsCancellationRequested then
                    return Error(Cancelled(Some path))
                else
                    let! bytes = fileSystem.ReadAllBytesAsync(path, ct).ConfigureAwait(false)

                    if ct.IsCancellationRequested then
                        return Error(Cancelled(Some path))
                    else
                        let text = strictUtf8.GetString bytes

                        return
                            Chip8CrossRunStore.parse text
                            |> Result.mapError (fun feedback -> ArtifactRejected(path, feedback))
                            |> Result.bind (fun artifact ->
                                let expected = Chip8CrossRunStore.artifactFileName artifact.Key
                                let actual = Path.GetFileName path

                                if String.Equals(actual, expected, StringComparison.Ordinal) then
                                    Ok
                                        { Path = path
                                          Artifact = artifact
                                          ByteCount = bytes.LongLength }
                                else
                                    Error(ArtifactFileNameMismatch(path, expected)))
            with
            | :? OperationCanceledException -> return Error(Cancelled(Some path))
            | :? DecoderFallbackException -> return Error(TextDecodeFailed path)
            | ex -> return Error(ReadFailed(path, exceptionDetail ex))
        }

    let private validateSet (loaded: LoadedArtifact list) : Result<LoadedStore, Feedback> =
        let seen = Dictionary<string, string>(StringComparer.Ordinal)
        let mutable duplicate: Feedback option = None

        for item in loaded do
            if duplicate.IsNone then
                let key = Chip8CrossRunStore.keyText item.Artifact.Key

                match seen.TryGetValue key with
                | true, firstPath -> duplicate <- Some(DuplicateRunKey(key, firstPath, item.Path))
                | false, _ -> seen.Add(key, item.Path)

        match duplicate with
        | Some feedback -> Error feedback
        | None ->
            let artifacts = loaded |> List.map _.Artifact

            Ok
                { Reader = Chip8CrossRunStore.readerOf artifacts
                  Artifacts = artifacts
                  Paths = loaded |> List.map _.Path
                  ByteCount = loaded |> List.sumBy (fun item -> bigint item.ByteCount) }

    /// Enumerate, read, parse, and validate every orbit before publishing a reader.
    /// Any refusal returns no reader, so a room cannot observe a partially loaded set.
    let loadDirectoryAsync
        (fileSystem: IFileSystem)
        (root: string)
        (ct: CancellationToken)
        : Task<Result<LoadedStore, Feedback>> =
        task {
            if ct.IsCancellationRequested then
                return Error(Cancelled None)
            elif String.IsNullOrWhiteSpace root then
                return Error RootNotSpecified
            else
                let enumerated =
                    try
                        let paths = fileSystem.GetFiles(root, "*.orbit.json")

                        if isNull paths then
                            Error(EnumerationFailed(root, "GetFiles returned null"))
                        else
                            paths
                            |> Array.sortWith (fun left right -> StringComparer.Ordinal.Compare(left, right))
                            |> Ok
                    with ex ->
                        Error(EnumerationFailed(root, exceptionDetail ex))

                match enumerated with
                | Error feedback -> return Error feedback
                | Ok paths ->
                    let loaded = ResizeArray<LoadedArtifact>()
                    let mutable refused: Feedback option = None

                    for path in paths do
                        if refused.IsNone then
                            let! result = readArtifactAsync fileSystem path ct

                            match result with
                            | Ok artifact -> loaded.Add artifact
                            | Error feedback -> refused <- Some feedback

                    match refused with
                    | Some feedback -> return Error feedback
                    | None -> return validateSet (List.ofSeq loaded)
        }
