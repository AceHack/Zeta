namespace Zeta.Core

open System
open System.IO
open System.Threading
open System.Threading.Tasks

// Checkpoint interfaces (ICheckpointReader, ICheckpointWriter, ICheckpointable, ICheckpointStore, CheckpointLoadResult) are defined in C# (Zeta.Core.Abstractions).

/// File-based checkpoint store with fsync for crash-safe
/// operator state persistence. StableStorage mode for
/// the checkpoint control plane.
///
/// Design lineage:
/// - Reaqtor checkpoint persistence (periodic state snapshots)
/// - Atomic-rename pattern (write-to-temp, fsync, rename)
/// - WitnessDurableBackingStore path-canonicalization pattern
[<Sealed>]
type FileCheckpointStore(rootDir: string) =
    // Canonicalise path once — same TOCTOU-avoidance pattern
    // as WitnessDurableBackingStore.
    let canonicalRoot = Path.GetFullPath rootDir

    do
        Directory.CreateDirectory canonicalRoot |> ignore

    /// Is Windows / macOS case-insensitive filesystem?
    /// Same pattern as DiskBackingStore.
    let isCaseInsensitivePathFs =
        OperatingSystem.IsWindows() || OperatingSystem.IsMacOS()

    let pathComparison =
        if isCaseInsensitivePathFs then StringComparison.OrdinalIgnoreCase
        else StringComparison.Ordinal

    let checkpointPath (circuitId: string) =
        let candidate =
            Path.GetFullPath(
                Path.Combine(canonicalRoot, circuitId + ".checkpoint"))
        let rootWithSep =
            canonicalRoot.TrimEnd(Path.DirectorySeparatorChar)
            + string Path.DirectorySeparatorChar
        if not (candidate.StartsWith(rootWithSep, pathComparison)) then
            raise (ArgumentException(
                $"Circuit ID would escape checkpoint root: {circuitId}",
                nameof circuitId))
        candidate

    interface ICheckpointStore with
        member _.SaveCheckpointAsync
            (circuitId, tick, states, _ct) =
            // Serialize to a MemoryStream first, then write
            // atomically via temp-file + fsync + rename.
            use ms = new MemoryStream()
            use bw = new BinaryWriter(ms)
            bw.Write tick
            bw.Write(states.Length)
            for (opId, checkpointable) in states do
                bw.Write opId
                bw.Write checkpointable.StateVersion
                // Capture operator state into a sub-buffer so
                // we can length-prefix the data blob.
                use opMs = new MemoryStream()
                use opBw = new BinaryWriter(opMs)
                let writer =
                    { new ICheckpointWriter with
                        member _.WriteInt32 v = opBw.Write v
                        member _.WriteInt64 v = opBw.Write v
                        member _.WriteFloat v = opBw.Write v
                        member _.WriteBool v = opBw.Write v
                        member _.WriteBytes v =
                            opBw.Write(v.Length)
                            opBw.Write v
                        member _.WriteString v = opBw.Write v }
                checkpointable.SaveState writer
                opBw.Flush()
                let data = opMs.ToArray()
                bw.Write(data.Length)
                bw.Write data
            bw.Flush()

            let payload = ms.ToArray()
            let target = checkpointPath circuitId
            let tmpPath =
                target + ".tmp." + Guid.NewGuid().ToString("N")

            // Write to temp file, fsync, then atomic rename.
            use fs =
                new FileStream(
                    tmpPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None)
            fs.Write(payload, 0, payload.Length)
            // Flush(true) = FlushFileBuffers / fsync
            fs.Flush true
            fs.Close()

            File.Move(tmpPath, target, true)

            // Best-effort directory fsync — ensures the rename
            // metadata is durable on POSIX. On Linux/macOS we
            // can open the directory as a FileStream and flush;
            // on Windows this is not supported and we accept
            // the limitation (.NET has no portable dir-fsync
            // API). The checkpoint is still recoverable via the
            // temp file pattern; worst case under power loss is
            // reverting to the prior checkpoint.
            try
                let dirPath = Path.GetDirectoryName target
                use dirFs =
                    new FileStream(
                        dirPath,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.ReadWrite)
                dirFs.Flush true
            with
            | :? UnauthorizedAccessException -> ()
            | :? IOException -> ()

            ValueTask.CompletedTask

        member _.LoadCheckpointAsync(circuitId, _ct) =
            let path = checkpointPath circuitId
            if not (File.Exists path) then
                ValueTask.FromResult<CheckpointLoadResult>(null)
            else
                // Treat corrupt / truncated checkpoint as
                // missing — safer than crashing recovery.
                // The circuit will fall back to replay from
                // the event stream (Temporal model).
                try
                    let bytes = File.ReadAllBytes path
                    use ms = new MemoryStream(bytes)
                    use br = new BinaryReader(ms)
                    let tick = br.ReadInt64()
                    let count = br.ReadInt32()
                    if count < 0 then
                        ValueTask.FromResult<CheckpointLoadResult>(null)
                    else
                        let readers =
                            Array.init count (fun _ ->
                                let opId = br.ReadInt32()
                                let _version = br.ReadInt32()
                                let dataLen = br.ReadInt32()
                                let data = br.ReadBytes dataLen
                                let opMs = new MemoryStream(data)
                                let opBr = new BinaryReader(opMs)
                                let reader =
                                    { new ICheckpointReader with
                                        member _.ReadInt32() =
                                            opBr.ReadInt32()
                                        member _.ReadInt64() =
                                            opBr.ReadInt64()
                                        member _.ReadFloat() =
                                            opBr.ReadDouble()
                                        member _.ReadBool() =
                                            opBr.ReadBoolean()
                                        member _.ReadBytes() =
                                            let len = opBr.ReadInt32()
                                            opBr.ReadBytes len
                                        member _.ReadString() =
                                            opBr.ReadString() }
                                Tuple.Create(opId, reader))
                        let result = CheckpointLoadResult(tick, readers)
                        ValueTask.FromResult(result)
                with
                | :? EndOfStreamException -> ValueTask.FromResult<CheckpointLoadResult>(null)
                | :? IOException -> ValueTask.FromResult<CheckpointLoadResult>(null)


/// In-memory checkpoint store for testing and DST.
[<Sealed>]
type InMemoryCheckpointStore() =
    let mutable saved:
        struct (int64 * byte array array) voption = ValueNone

    interface ICheckpointStore with
        member _.SaveCheckpointAsync
            (_circuitId, tick, states, _ct) =
            let buffers =
                states
                |> Array.map (fun (opId, checkpointable) ->
                    use ms = new MemoryStream()
                    use bw = new BinaryWriter(ms)
                    let writer =
                        { new ICheckpointWriter with
                            member _.WriteInt32 v = bw.Write v
                            member _.WriteInt64 v = bw.Write v
                            member _.WriteFloat v = bw.Write v
                            member _.WriteBool v = bw.Write v
                            member _.WriteBytes v =
                                bw.Write(v.Length)
                                bw.Write v
                            member _.WriteString v = bw.Write v }
                    bw.Write opId
                    bw.Write checkpointable.StateVersion
                    checkpointable.SaveState writer
                    ms.ToArray())
            saved <- ValueSome(tick, buffers)
            ValueTask.CompletedTask

        member _.LoadCheckpointAsync(_circuitId, _ct) =
            match saved with
            | ValueNone -> ValueTask.FromResult<CheckpointLoadResult>(null)
            | ValueSome(tick, buffers) ->
                let readers =
                    buffers
                    |> Array.map (fun buf ->
                        let ms = new MemoryStream(buf)
                        let br = new BinaryReader(ms)
                        let opId = br.ReadInt32()
                        let _version = br.ReadInt32()
                        let reader =
                            { new ICheckpointReader with
                                member _.ReadInt32() = br.ReadInt32()
                                member _.ReadInt64() = br.ReadInt64()
                                member _.ReadFloat() = br.ReadDouble()
                                member _.ReadBool() = br.ReadBoolean()
                                member _.ReadBytes() =
                                    let len = br.ReadInt32()
                                    br.ReadBytes len
                                member _.ReadString() = br.ReadString() }
                        Tuple.Create(opId, reader))
                let result = CheckpointLoadResult(tick, readers)
                ValueTask.FromResult(result)
