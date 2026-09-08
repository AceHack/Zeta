namespace Zeta.Core

open System
open System.Buffers.Binary
open System.Collections.Generic
open System.IO
open System.IO.Hashing
open System.Text
open System.Threading
open System.Threading.Tasks

/// A generic file system interface that can be replaced under simulation testing.
type IFileSystem =
    abstract Exists: path: string -> bool
    abstract Delete: path: string -> unit
    abstract Move: src: string * dest: string * overwrite: bool -> unit
    abstract ReadAllBytes: path: string -> byte[]
    abstract ReadAllBytesAsync: path: string * ct: CancellationToken -> Task<byte[]>
    abstract OpenFile: path: string * mode: FileMode * access: FileAccess * share: FileShare -> Stream
    abstract OpenWrite: path: string * fsync: bool -> Stream
    abstract OpenRead: path: string -> Stream
    abstract GetFiles: path: string * searchPattern: string -> string[]
    abstract CreateDirectory: path: string -> unit
    /// Write `src` at `offset` without replacing the rest of the file.
    /// Crash/corrupt/reorder/torn-sector arms on `InMemoryFileSystem` apply
    /// to `src`, not to a whole-file Dispose buffer.
    abstract WriteAt: path: string * offset: int64 * src: ReadOnlyMemory<byte> -> int

/// Native-volume block *primitive* (one LBA, one call). This is the device,
/// not the IO program. Batch/single/multibatch dispatch is `BlockIoFerry`
/// (Haskell `IO a` interpreted by `FerryThrottler`, including adjacent
/// whole-block coalesce). The polyfill adapter maps a host file through
/// `IFileSystem`. A later device impl must not go through POSIX files.
///
/// Geometry: `LbaCount` is NVMe Identify-shaped. 0 means unbounded
/// (`SimulatedBlockIo` sparse DST). A native impl reports the namespace
/// size. Signatures are synchronous (DST DoP=1). Native NVMe needs an
/// async completion door (io_uring / SPDK) — wrapping these methods in
/// Task.Run is not that door.
type IBlockIo =
    abstract BlockSize: int
    /// Number of addressable LBAs. 0 = unbounded (DST sparse).
    abstract LbaCount: uint64
    abstract Read: lba: uint64 * dst: Memory<byte> -> int
    abstract Write: lba: uint64 * src: ReadOnlyMemory<byte> -> int
    abstract Flush: unit -> unit

/// Issued device ops for DST record/replay. Call order, completed ops only.
/// This is **what acts** (the event stream). Durable media after Flush is
/// **what remains** (μένω). Chaos arms are intercepts, not commands.
/// Native NVMe is not claimed.
[<RequireQualifiedAccess>]
type BlockIoOp =
    | Write of lba: uint64 * data: byte[]
    | Flush

/// Replay a recorded op log onto any `IBlockIo` (sim, polyfill, later native).
[<RequireQualifiedAccess>]
module BlockIoReplay =
    let replay (ops: BlockIoOp[]) (io: IBlockIo) =
        for op in ops do
            match op with
            | BlockIoOp.Write(lba, data) ->
                io.Write(lba, System.ReadOnlyMemory<byte>.op_Implicit data) |> ignore
            | BlockIoOp.Flush -> io.Flush()

/// Yielding completion door for a later native NVMe impl (io_uring / SPDK).
/// DST polyfill and `SimulatedBlockIo` complete synchronously
/// (`IsCompletedSuccessfully`). Wrapping `IBlockIo` in `Task.Run` is not
/// this interface.
type IAsyncBlockIo =
    abstract BlockSize: int
    abstract LbaCount: uint64
    abstract ReadAsync: lba: uint64 * dst: Memory<byte> * ct: CancellationToken -> ValueTask<int>
    abstract WriteAsync: lba: uint64 * src: ReadOnlyMemory<byte> * ct: CancellationToken -> ValueTask<int>
    abstract FlushAsync: ct: CancellationToken -> ValueTask

module private PhysicalFileSystemLimits =
    let maxReadAllBytes = 256L * 1024L * 1024L

    let checkReadAllBytesCap (path: string) =
        let info = FileInfo(path)
        if info.Exists && info.Length > maxReadAllBytes then
            raise (IOException(sprintf "File exceeds ReadAllBytes cap (%d bytes): %s" maxReadAllBytes path))

    let checkStreamCap (path: string) (stream: Stream) =
        if stream.Length > maxReadAllBytes then
            raise (IOException(sprintf "File exceeds ReadAllBytes cap (%d bytes): %s" maxReadAllBytes path))

    let readAllBytes (path: string) =
        checkReadAllBytesCap path
        use stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.SequentialScan)
        checkStreamCap path stream
        use buffer = new MemoryStream(int stream.Length)
        stream.CopyTo(buffer)
        buffer.ToArray()

    let readAllBytesAsync (path: string) (ct: CancellationToken) = task {
        checkReadAllBytesCap path
        use stream =
            new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                4096,
                FileOptions.Asynchronous ||| FileOptions.SequentialScan
            )
        checkStreamCap path stream
        use buffer = new MemoryStream(int stream.Length)
        do! stream.CopyToAsync(buffer, ct)
        return buffer.ToArray()
    }

/// The default physical file system wrapper delegating to System.IO.
type PhysicalFileSystem() =
    interface IFileSystem with
        member _.Exists(path) = File.Exists(path)
        member _.Delete(path) = File.Delete(path)
        member _.Move(src, dest, overwrite) = File.Move(src, dest, overwrite)
        member _.ReadAllBytes(path) =
            PhysicalFileSystemLimits.readAllBytes path
        member _.ReadAllBytesAsync(path, ct) =
            PhysicalFileSystemLimits.readAllBytesAsync path ct
        member _.OpenFile(path, mode, access, share) =
            new FileStream(path, mode, access, share, 4096, true) :> Stream
        member _.OpenWrite(path, fsync) =
            let opts = if fsync then FileOptions.WriteThrough else FileOptions.None
            new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, opts) :> Stream
        member _.OpenRead(path) =
            new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read) :> Stream
        member _.GetFiles(path, searchPattern) = Directory.GetFiles(path, searchPattern)
        member _.CreateDirectory(path) = Directory.CreateDirectory(path) |> ignore

        member _.WriteAt(path, offset, src) =
            if offset < 0L then
                invalidArg (nameof offset) "offset must be >= 0"

            let dir = Path.GetDirectoryName path

            if not (String.IsNullOrEmpty dir) then
                Directory.CreateDirectory dir |> ignore

            use stream =
                new FileStream(path, FileMode.OpenOrCreate, FileAccess.Write, FileShare.Read, 4096, true)

            stream.Seek(offset, SeekOrigin.Begin) |> ignore
            stream.Write(src.Span)
            src.Length

/// Byte helpers over `IFileSystem`. Temp+rename so a crash cannot leave a
/// half-written FORMAT / object / ref. Dispose the write stream *before*
/// Move: `InMemoryFileSystem` commits on Dispose (prefix + throw if armed).
[<RequireQualifiedAccess>]
module FileSystemIo =
    let writeAllBytes (fs: IFileSystem) (path: string) (bytes: byte[]) =
        let tmp = path + ".tmp"

        do
            use stream = fs.OpenWrite(tmp, false)
            stream.Write(bytes, 0, bytes.Length)
            stream.Flush()

        fs.Move(tmp, path, true)

    let writeAllText (fs: IFileSystem) (path: string) (text: string) =
        writeAllBytes fs path (Encoding.UTF8.GetBytes text)

    let tryReadBytesCapped (fs: IFileSystem) (maxBytes: int64) (path: string) : byte[] option =
        if not (fs.Exists path) then
            None
        else
            use stream = fs.OpenRead path

            if stream.Length > maxBytes then
                None
            else
                let bytes = Array.zeroCreate<byte> (int stream.Length)
                let mutable offset = 0
                let mutable eof = false

                while offset < bytes.Length && not eof do
                    let read = stream.Read(bytes, offset, bytes.Length - offset)

                    if read = 0 then
                        eof <- true
                    else
                        offset <- offset + read

                if offset = bytes.Length then
                    Some bytes
                else
                    Some(Array.take offset bytes)

/// DST: write committed a prefix, then the process died. Not a FreezeError.
[<Sealed>]
type CrashMidWriteException(path: string, committedBytes: int, attemptedBytes: int) =
    inherit IOException(
        sprintf
            "crash-mid-write: committed %d of %d bytes at %s"
            committedBytes
            attemptedBytes
            path)

    member _.Path = path
    member _.CommittedBytes = committedBytes
    member _.AttemptedBytes = attemptedBytes

/// DST: reclaim Delete committed, then the process died. Extra garbage may
/// remain; a live object must not be missing.
[<Sealed>]
type CrashMidSweepException(path: string) =
    inherit IOException(sprintf "crash-mid-sweep at %s" path)
    member _.Path = path

/// DST: power was cut. Volatile (un-Flush'd) cache is gone. Not a process
/// crash, not bad RAM, not EIO on Flush. Only previously Flush'd media remains.
[<Sealed>]
type PowerOutageException() =
    inherit IOException("power-outage: volatile cache dropped; only Flush'd media remains")

/// DST: RAM went bad. The in-flight Write may have published XOR'd bytes,
/// then the process died. Not a clean power cut (media can contain garbage).
[<Sealed>]
type BadMemoryException(path: string) =
    inherit IOException(sprintf "bad-memory: RAM corruption at %s" path)
    member _.Path = path

/// A mock FileStream that commits its MemoryStream buffer to the InMemoryFileSystem registry upon disposal.
/// `Flush` publishes the current buffer without firing crash/corrupt/reorder
/// arms. Those arms stay on Dispose (`commitWrite`). A Flush that used
/// `commitWrite` would let a later Dispose republish the full buffer and
/// undo a tear.
type SimulatedFileStream
    (
        path: string,
        mode: FileMode,
        access: FileAccess,
        files: System.Collections.Concurrent.ConcurrentDictionary<string, byte[]>,
        checkFault: unit -> unit,
        applyLatency: unit -> unit,
        commitWrite: string -> byte[] -> unit,
        flushPublish: string -> byte[] -> unit
    ) =
    inherit MemoryStream()
    let mutable isDisposed = false
    do
        checkFault()
        applyLatency()
        let exists = files.ContainsKey(path)
        if exists && (mode = FileMode.Open || mode = FileMode.OpenOrCreate || mode = FileMode.Append) then
            let bytes = files.[path]
            base.Write(bytes, 0, bytes.Length)
            if mode = FileMode.Append then
                base.Seek(0L, SeekOrigin.End) |> ignore
            else
                base.Seek(0L, SeekOrigin.Begin) |> ignore
        elif not exists && mode = FileMode.Open then
            raise (FileNotFoundException(path))

    override this.Flush() =
        if (not isDisposed) && access.HasFlag(FileAccess.Write) then
            flushPublish path (this.ToArray())

        base.Flush()

    override this.FlushAsync(cancellationToken) =
        if cancellationToken.IsCancellationRequested then
            Task.FromCanceled cancellationToken
        elif isDisposed then
            Task.CompletedTask
        else
            try
                this.Flush()
                Task.CompletedTask
            with ex ->
                Task.FromException ex

    override this.Dispose(disposing) =
        if disposing && not isDisposed then
            isDisposed <- true
            checkFault()
            applyLatency()
            if access.HasFlag(FileAccess.Write) then
                commitWrite path (this.ToArray())
        base.Dispose(disposing)

/// An in-memory mock file system that supports simulating latency, read/write sector corruption exceptions,
/// file creation/modification tracking, and one-shot crash-mid-write /
/// corrupt-last-write / reorder / torn-sector (D12 door).
/// Canonicalise a path so that two spellings of the SAME file map to one key.
///
/// WHY THIS EXISTS. This double keys a dictionary on the path string, and a
/// dictionary is exact where a filesystem is not. On Windows `\` and `/` are BOTH
/// directory separators -- `Path.DirectorySeparatorChar` is `\` and
/// `AltDirectorySeparatorChar` is `/` -- so `/store/cas` and `/store\cas` name the
/// same file to Win32 and named two different entries here. That is a double that
/// disagrees with the thing it doubles, which is worse than no double: the test it
/// breaks is testing the mock, not the code.
///
/// MEASURED: `Zeta.Tests.ZetaFsFreezeTests."Journaled freeze ContentId matches the
/// mutbuf snapshot, not a later pwrite"` line 60 asserted `Exists "/freeze-mem/cas"`
/// while `ZetaFsFreeze.fs:670` created the file with `Path.Combine(storeDir, "cas")`
/// -- `/freeze-mem\cas` on Windows. Red on `windows-2025` (35/59 runs) and
/// `windows-11-arm` (33/59), green on every Unix runner, and it was the ONLY
/// failure on either lane.
///
/// PLATFORM-CONDITIONAL, AND THAT IS NOT A DETAIL. On Unix `\` is a LEGAL FILENAME
/// CHARACTER, so folding it to `/` there would merge two genuinely different files
/// and invent a collision the real filesystem does not have. The fold is therefore
/// applied only where the platform actually treats both as separators.
module private InMemoryPathKey =
    let normalize (path: string) : string =
        if Path.DirectorySeparatorChar = '\\' then path.Replace('\\', '/') else path

type InMemoryFileSystem() =
    let files = System.Collections.Concurrent.ConcurrentDictionary<string, byte[]>()
    let mutable latencyMs = 0L
    let mutable virtualElapsedMs = 0L
    let mutable errorRate = 0.0
    let mutable rngState = 12345L
    let mutable crashArm: (string * int) option = None
    let mutable corruptArm: (string * int) option = None
    let mutable reorderNeedle: string option = None
    let mutable heldWrite: (string * byte[]) option = None
    let mutable deleteCrashArm: string option = None
    let mutable tornArm: (string * int) option = None
    let mutable heldRange: (string * int64 * byte[]) option = None
    let commitOrder = ResizeArray<string>()
    let lockObj = obj ()

    let corruptXor = 0xA5uy

    let pathMatches (needle: string) (path: string) =
        path.IndexOf(needle, StringComparison.Ordinal) >= 0

    // `publish` and `existingBytes` normalise too, even though every current caller
    // already hands them a canonical key. `InMemoryPathKey.normalize` is idempotent, so the second
    // application costs nothing -- and requiring each caller to remember is the same
    // shape as an include-list: correct until someone adds a call site.
    let publish (path: string) (bytes: byte[]) =
        let path = InMemoryPathKey.normalize path
        files.[path] <- bytes
        commitOrder.Add path

    let overlay (existing: byte[]) (offset: int64) (src: ReadOnlySpan<byte>) (take: int) =
        if offset < 0L || offset > int64 Int32.MaxValue then
            invalidArg (nameof offset) "offset must fit in a 32-bit file"

        let off = int offset
        let endAt = off + take
        let buf = Array.zeroCreate (max existing.Length endAt)

        if existing.Length > 0 then
            Array.Copy(existing, buf, existing.Length)

        if take > 0 then
            src.Slice(0, take).CopyTo(Span(buf, off, take))

        buf

    let existingBytes (path: string) =
        match files.TryGetValue(InMemoryPathKey.normalize path) with
        | true, b -> b
        | false, _ -> Array.empty

    let splitMix () =
        rngState <- rngState + 0x9E3779B97F4A7C15L
        let mutable z = rngState
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
        z ^^^ (z >>> 31)

    let checkFault () =
        if errorRate > 0.0 then
            let roll = lock lockObj (fun () -> (splitMix() &&& 0xFFFF_FFFFL |> float) / 4294967295.0)
            if roll < errorRate then
                failwith "BUGGIFY: Simulated disk read/write fault"

    let applyLatency () =
        if latencyMs > 0L then
            lock lockObj (fun () -> virtualElapsedMs <- virtualElapsedMs + latencyMs)

    let flushPublish (path: string) (bytes: byte[]) =
        lock lockObj (fun () -> publish path bytes)

    let commitWrite (path: string) (bytes: byte[]) =
        lock lockObj (fun () ->
            match crashArm with
            | Some(needle, afterBytes) when pathMatches needle path && bytes.Length > afterBytes ->
                crashArm <- None
                let prefix = Array.sub bytes 0 afterBytes
                publish path prefix
                raise (CrashMidWriteException(path, afterBytes, bytes.Length))
            | _ ->
                match corruptArm with
                | Some(needle, lastBytes) when
                    pathMatches needle path && bytes.Length > 0 && lastBytes > 0
                    ->
                    corruptArm <- None
                    let copy = Array.copy bytes
                    let n = min lastBytes copy.Length
                    let start = copy.Length - n

                    for i in start .. copy.Length - 1 do
                        copy.[i] <- copy.[i] ^^^ corruptXor

                    publish path copy
                | _ ->
                    match tornArm with
                    | Some(needle, sectorBytes) when
                        pathMatches needle path && bytes.Length > sectorBytes
                        ->
                        tornArm <- None
                        let buf =
                            overlay (existingBytes path) 0L (ReadOnlySpan bytes) sectorBytes

                        publish path buf
                    | _ ->
                    match reorderNeedle, heldWrite with
                    | Some needle, None when pathMatches needle path ->
                        heldWrite <- Some(path, bytes)
                    | Some needle, Some(heldPath, heldBytes) when pathMatches needle path ->
                        reorderNeedle <- None
                        heldWrite <- None
                        publish path bytes
                        publish heldPath heldBytes
                    | _ -> publish path bytes)

    /// Exposed so the platform branch above is falsifiable on its own, rather than only
    /// through a filesystem operation that happens to depend on it.
    static member NormalizeKey(path: string) = InMemoryPathKey.normalize path

    member _.Files = files

    /// One-shot: next matching write Dispose commits `afterBytes` then throws.
    /// `ISimulatedFs` is flush-fail and write-fail; this is the crash-mid-write intercept.
    member _.ArmCrashMidWrite(pathContains: string, afterBytes: int) =
        if String.IsNullOrEmpty pathContains then
            invalidArg (nameof pathContains) "pathContains must be non-empty"

        if afterBytes < 0 then
            invalidArg (nameof afterBytes) "afterBytes must be >= 0"

        lock lockObj (fun () -> crashArm <- Some(pathContains, afterBytes))

    /// One-shot: next matching write Dispose XORs the last `lastBytes` with 0xA5
    /// and commits. The write acks; recovery must not trust the tail.
    member _.ArmCorruptLastWrite(pathContains: string, lastBytes: int) =
        if String.IsNullOrEmpty pathContains then
            invalidArg (nameof pathContains) "pathContains must be non-empty"

        if lastBytes < 1 then
            invalidArg (nameof lastBytes) "lastBytes must be >= 1"

        lock lockObj (fun () -> corruptArm <- Some(pathContains, lastBytes))

    /// One-shot: hold the first matching Dispose (file not yet visible), then
    /// the second matching Dispose commits itself first and flushes the held
    /// write. Flush-publish does not arm this door. Freeze writes intent
    /// (Flush), then leaves (object Dispose), then commit (log Dispose).
    member _.ArmReorderNextTwo(pathContains: string) =
        if String.IsNullOrEmpty pathContains then
            invalidArg (nameof pathContains) "pathContains must be non-empty"

        lock lockObj (fun () ->
            reorderNeedle <- Some pathContains
            heldWrite <- None
            heldRange <- None)

    /// One-shot: next matching write longer than `sectorBytes` overlays only
    /// that prefix of the NEW bytes; the rest of the range stays OLD. The
    /// write acks. SQLite/PostgreSQL torn-page: a multi-sector write that
    /// only some sectors persist.
    member _.ArmTornSector(pathContains: string, sectorBytes: int) =
        if String.IsNullOrEmpty pathContains then
            invalidArg (nameof pathContains) "pathContains must be non-empty"

        if sectorBytes < 1 then
            invalidArg (nameof sectorBytes) "sectorBytes must be >= 1"

        lock lockObj (fun () -> tornArm <- Some(pathContains, sectorBytes))

    /// One-shot: next matching Delete removes the file then throws.
    member _.ArmCrashOnDelete(pathContains: string) =
        if String.IsNullOrEmpty pathContains then
            invalidArg (nameof pathContains) "pathContains must be non-empty"

        lock lockObj (fun () -> deleteCrashArm <- Some pathContains)

    /// Paths in the order they became visible. Held writes are absent until flushed.
    member _.CommitOrder = lock lockObj (fun () -> commitOrder.ToArray())

    /// Injected latency in virtual milliseconds. Never wall-clock sleep.
    member _.VirtualElapsedMs = lock lockObj (fun () -> virtualElapsedMs)

    /// Set simulated latency (in milliseconds) and probabilistic error rate [0.0, 1.0].
    member _.SetFaults(rate: float, latency: int64, seed: int64) =
        lock lockObj (fun () ->
            errorRate <- rate
            latencyMs <- latency
            rngState <- seed)

    interface IFileSystem with
        member _.Exists(path) =
            checkFault()
            files.ContainsKey(InMemoryPathKey.normalize path)

        member _.Delete(path) =
            checkFault()
            let crash =
                lock lockObj (fun () ->
                    match deleteCrashArm with
                    | Some needle when pathMatches needle path ->
                        deleteCrashArm <- None
                        true
                    | _ -> false)

            files.TryRemove(InMemoryPathKey.normalize path) |> ignore

            if crash then
                raise (CrashMidSweepException path)

        member _.Move(src, dest, _overwrite) =
            checkFault()
            match files.TryRemove(InMemoryPathKey.normalize src) with
            | true, bytes -> files.[InMemoryPathKey.normalize dest] <- bytes
            | false, _ -> raise (FileNotFoundException(src))

        member _.ReadAllBytes(path) =
            checkFault()
            applyLatency()
            match files.TryGetValue(InMemoryPathKey.normalize path) with
            | true, bytes -> bytes
            | false, _ -> raise (FileNotFoundException(path))

        member _.ReadAllBytesAsync(path, ct) = task {
            ct.ThrowIfCancellationRequested()
            checkFault()
            applyLatency()
            match files.TryGetValue(InMemoryPathKey.normalize path) with
            | true, bytes -> return bytes
            | false, _ -> return raise (FileNotFoundException(path))
        }

        member _.OpenFile(path, mode, access, _share) =
            new SimulatedFileStream(InMemoryPathKey.normalize path, mode, access, files, checkFault, applyLatency, commitWrite, flushPublish) :> Stream

        member _.OpenWrite(path, _fsync) =
            new SimulatedFileStream(InMemoryPathKey.normalize path, FileMode.Create, FileAccess.Write, files, checkFault, applyLatency, commitWrite, flushPublish) :> Stream

        member _.OpenRead(path) =
            new SimulatedFileStream(InMemoryPathKey.normalize path, FileMode.Open, FileAccess.Read, files, checkFault, applyLatency, commitWrite, flushPublish) :> Stream

        member _.GetFiles(path, searchPattern) =
            checkFault()
            let suffix = searchPattern.Replace("*", "")
            // The PREFIX is normalised as well as the stored keys. Normalising only one
            // side would leave `GetFiles "/a/b"` blind to entries this same double keyed
            // as `/a\b`, which is the defect one layer along rather than fixed.
            let prefix = InMemoryPathKey.normalize path
            files.Keys
            |> Seq.filter (fun k -> k.StartsWith(prefix, StringComparison.Ordinal) && k.EndsWith(suffix, StringComparison.Ordinal))
            |> Seq.toArray

        member _.CreateDirectory(_path) =
            checkFault()
            ()

        member _.WriteAt(path, offset, src) =
            if offset < 0L then
                invalidArg (nameof offset) "offset must be >= 0"

            // Shadowed once at the top rather than at each of the eight uses below --
            // `publish`, `existingBytes`, the crash/corrupt/reorder arms and the return
            // path all key or match on it, and normalising some of them would be worse
            // than normalising none: a write published under one spelling and armed under
            // another is a fault the double would report in the wrong place.
            let path = InMemoryPathKey.normalize path

            checkFault()
            applyLatency()
            lock lockObj (fun () ->
                let srcArr = src.ToArray()

                match crashArm with
                | Some(needle, afterBytes) when pathMatches needle path && srcArr.Length > afterBytes ->
                    crashArm <- None
                    let buf = overlay (existingBytes path) offset (ReadOnlySpan srcArr) afterBytes
                    publish path buf
                    raise (CrashMidWriteException(path, afterBytes, srcArr.Length))
                | _ ->
                    match corruptArm with
                    | Some(needle, lastBytes) when
                        pathMatches needle path && srcArr.Length > 0 && lastBytes > 0
                        ->
                        corruptArm <- None
                        let copy = Array.copy srcArr
                        let n = min lastBytes copy.Length
                        let start = copy.Length - n

                        for i in start .. copy.Length - 1 do
                            copy.[i] <- copy.[i] ^^^ corruptXor

                        let buf = overlay (existingBytes path) offset (ReadOnlySpan copy) copy.Length
                        publish path buf
                        srcArr.Length
                    | _ ->
                        match tornArm with
                        | Some(needle, sectorBytes) when
                            pathMatches needle path && srcArr.Length > sectorBytes
                            ->
                            tornArm <- None
                            let buf =
                                overlay (existingBytes path) offset (ReadOnlySpan srcArr) sectorBytes

                            publish path buf
                            srcArr.Length
                        | _ ->
                        match reorderNeedle, heldRange with
                        | Some needle, None when pathMatches needle path ->
                            heldRange <- Some(path, offset, srcArr)
                            srcArr.Length
                        | Some needle, Some(heldPath, heldOff, heldBytes) when pathMatches needle path ->
                            reorderNeedle <- None
                            heldRange <- None
                            let buf2 =
                                overlay (existingBytes path) offset (ReadOnlySpan srcArr) srcArr.Length

                            publish path buf2

                            let heldExisting =
                                if heldPath = path then
                                    buf2
                                else
                                    existingBytes heldPath

                            let buf1 =
                                overlay heldExisting heldOff (ReadOnlySpan heldBytes) heldBytes.Length

                            publish heldPath buf1
                            srcArr.Length
                        | _ ->
                            let buf =
                                overlay (existingBytes path) offset (ReadOnlySpan srcArr) srcArr.Length

                            publish path buf
                            srcArr.Length)

/// Polyfill `IBlockIo`: one host file, LBA * BlockSize offset, through `IFileSystem`.
[<Sealed>]
type FileSystemBlockIo(fs: IFileSystem, path: string, blockSize: int) =
    let lockObj = obj ()
    let mutable logicalBytes = 0L

    do
        if blockSize <= 0 || (blockSize &&& (blockSize - 1)) <> 0 then
            invalidArg "blockSize" "block size must be a positive power of two"

        if not (fs.Exists path) then
            use stream = fs.OpenWrite(path, false)
            // Creation must be visible before the constructor returns. InMemory
            // providers publish on Flush; relying on Dispose alone leaves an
            // armed reorder path able to hide the empty backing file.
            stream.Flush()

    member _.Path = path

    member _.LogicalBytes
        with get () = lock lockObj (fun () -> logicalBytes)
        and set v = lock lockObj (fun () -> logicalBytes <- v)

    interface IBlockIo with
        member _.BlockSize = blockSize

        member _.LbaCount =
            if not (fs.Exists path) then
                0UL
            else
                use stream = fs.OpenFile(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)
                if stream.Length <= 0L then
                    0UL
                else
                    uint64 ((stream.Length + int64 blockSize - 1L) / int64 blockSize)

        member _.Read(lba, dst) =
            use stream = fs.OpenFile(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)
            let offset = int64 lba * int64 blockSize

            if offset >= stream.Length then
                0
            else
                stream.Seek(offset, SeekOrigin.Begin) |> ignore
                let remaining = int (stream.Length - offset)
                let toRead = min dst.Length remaining
                stream.Read(dst.Span.Slice(0, toRead))

        member _.Write(lba, src) =
            let offset = int64 lba * int64 blockSize
            fs.WriteAt(path, offset, src)

        member _.Flush() =
            use stream = fs.OpenFile(path, FileMode.Open, FileAccess.ReadWrite, FileShare.Read)
            stream.Flush()

    interface IAsyncBlockIo with
        member this.BlockSize = (this :> IBlockIo).BlockSize
        member this.LbaCount = (this :> IBlockIo).LbaCount

        member this.ReadAsync(lba, dst, ct) =
            if ct.IsCancellationRequested then
                ValueTask<int>(Task.FromCanceled<int> ct)
            else
                ValueTask<int>((this :> IBlockIo).Read(lba, dst))

        member this.WriteAsync(lba, src, ct) =
            if ct.IsCancellationRequested then
                ValueTask<int>(Task.FromCanceled<int> ct)
            else
                ValueTask<int>((this :> IBlockIo).Write(lba, src))

        member this.FlushAsync(ct) =
            if ct.IsCancellationRequested then
                ValueTask(Task.FromCanceled ct)
            else
                (this :> IBlockIo).Flush()
                ValueTask()

/// DST block device: LBA → sparse blocks in memory. Not POSIX, not NVMe.
/// Default: Write is durable immediately (POSIX-like RAM).
/// `volatileUntilFlush = true` is the NVMe Flush/FUA DST: Write is visible
/// on this instance; `CloneMedia` is power-loss remain (un-Flush'd cache
/// dropped). `ArmPowerOutageOnFlush` is that cut on the live device.
/// `ArmCrashMidWrite` tears the next Write (process died mid-DMA; prefix
/// is still good bytes). `ArmBadMemoryOnWrite` XOR's the RAM buffer then
/// dies (media may hold garbage). Those three are not one "crash".
/// Volume recovery stays `toy` until the named corpus is green. Native
/// NVMe Flush/FUA is not claimed.
[<Sealed>]
type SimulatedBlockIo(blockSize: int, ?media: IReadOnlyDictionary<uint64, byte[]>, ?lbaCount: uint64, ?volatileUntilFlush: bool) =
    do
        if blockSize <= 0 || (blockSize &&& (blockSize - 1)) <> 0 then
            invalidArg "blockSize" "block size must be a positive power of two"

    let vol = defaultArg volatileUntilFlush false

    /// 0 = unbounded sparse DST. A positive count is Identify-shaped
    /// namespace size (RAM test adapter; not a real NVMe format).
    let capacity = defaultArg lbaCount 0UL

    let blocks = System.Collections.Concurrent.ConcurrentDictionary<uint64, byte[]>()
    let cache = System.Collections.Concurrent.ConcurrentDictionary<uint64, byte[]>()
    do
        match media with
        | Some seed ->
            for kv in seed do
                blocks.[kv.Key] <- Array.copy kv.Value
        | None -> ()
    let lockObj = obj ()
    let mutable crashArm: int option = None
    let mutable corruptArm: int option = None
    let mutable tornArm: int option = None
    let mutable reorderArmed = false
    let mutable powerOutageArm = false
    let mutable badMemoryArm = false
    let mutable heldWrite: (uint64 * byte[]) option = None
    let commitOrder = ResizeArray<uint64>()
    let recorded = ResizeArray<BlockIoOp>()
    let mutable writes = 0
    let mutable logicalBytes = 0L
    let corruptXor = 0xA5uy

    let writeRange (startLba: uint64) (src: ReadOnlySpan<byte>) =
        let mutable offset = 0

        while offset < src.Length do
            let lba = startLba + uint64 (offset / blockSize)
            let within = offset % blockSize
            let n = min (blockSize - within) (src.Length - offset)

            let block =
                if vol then
                    cache.GetOrAdd(
                        lba,
                        fun key ->
                            match blocks.TryGetValue key with
                            | true, durable -> Array.copy durable
                            | false, _ -> Array.zeroCreate blockSize
                    )
                else
                    blocks.GetOrAdd(lba, fun _ -> Array.zeroCreate blockSize)

            src.Slice(offset, n).CopyTo(Span(block, within, n))
            offset <- offset + n

    let tryGetVisible (lba: uint64) =
        if vol then
            match cache.TryGetValue lba with
            | true, cached -> Some cached
            | false, _ ->
                match blocks.TryGetValue lba with
                | true, durable -> Some durable
                | false, _ -> None
        else
            match blocks.TryGetValue lba with
            | true, durable -> Some durable
            | false, _ -> None

    let publish (startLba: uint64) (bytes: byte[]) =
        writeRange startLba (ReadOnlySpan bytes)
        commitOrder.Add startLba

    let lastLba (start: uint64) (len: int) =
        if len <= 0 then
            start
        else
            start + uint64 ((len + blockSize - 1) / blockSize) - 1UL

    let ensureInRange (start: uint64) (len: int) =
        if capacity > 0UL then
            let last = lastLba start len

            if start >= capacity || last >= capacity then
                raise (
                    IOException(
                        sprintf
                            "LBA out of range (start=%s last=%s LbaCount=%s)"
                            (start.ToString System.Globalization.CultureInfo.InvariantCulture)
                            (last.ToString System.Globalization.CultureInfo.InvariantCulture)
                            (capacity.ToString System.Globalization.CultureInfo.InvariantCulture)
                    )
                )

    /// One-shot: next Write longer than `afterBytes` commits that prefix then throws.
    member _.ArmCrashMidWrite(afterBytes: int) =
        if afterBytes < 0 then
            invalidArg (nameof afterBytes) "afterBytes must be >= 0"

        lock lockObj (fun () -> crashArm <- Some afterBytes)

    /// One-shot: next Write XORs the last `lastBytes` with 0xA5 and commits. Acks.
    member _.ArmCorruptLastWrite(lastBytes: int) =
        if lastBytes < 1 then
            invalidArg (nameof lastBytes) "lastBytes must be >= 1"

        lock lockObj (fun () -> corruptArm <- Some lastBytes)

    /// One-shot: next Write longer than `sectorBytes` overlays only that
    /// prefix of the NEW bytes; the rest of the LBA stays OLD. Acks.
    member _.ArmTornSector(sectorBytes: int) =
        if sectorBytes < 1 then
            invalidArg (nameof sectorBytes) "sectorBytes must be >= 1"

        lock lockObj (fun () -> tornArm <- Some sectorBytes)

    /// One-shot: hold the first Write (not visible), then the second Write
    /// commits itself first and flushes the held write.
    member _.ArmReorderNextTwo() =
        lock lockObj (fun () ->
            reorderArmed <- true
            heldWrite <- None)

    /// One-shot: next Flush drops the volatile cache and throws
    /// `PowerOutageException`. Requires `volatileUntilFlush = true` or the
    /// Writes already hit durable media (write-through is not a power cut).
    member _.ArmPowerOutageOnFlush() =
        lock lockObj (fun () -> powerOutageArm <- true)

    /// One-shot: next Write XOR's the last byte of the RAM buffer, publishes
    /// that garbage, then throws `BadMemoryException`. Last byte so a tail
    /// RMW does not clobber the prior freeze sitting at offset 0. Not a
    /// power cut.
    member _.ArmBadMemoryOnWrite() =
        lock lockObj (fun () -> badMemoryArm <- true)

    member _.Writes = lock lockObj (fun () -> writes)

    member _.CommitOrder = lock lockObj (fun () -> commitOrder.ToArray())

    /// Issued completed Write/Flush ops in call order — what acted.
    /// Not copied by CloneMedia (μένω copies remain, not the act log).
    member _.RecordedOps = lock lockObj (fun () -> recorded.ToArray())

    /// Replay issued ops onto `target`. Chaos intercepts are not in the log.
    /// Copies the log, then replays without holding the sim lock.
    member _.ReplayTo(target: IBlockIo) =
        let ops = lock lockObj (fun () -> recorded.ToArray())
        BlockIoReplay.replay ops target

    /// Logical payload length the caller maintains (log bytes, not padded blocks).
    member _.LogicalBytes
        with get () = lock lockObj (fun () -> logicalBytes)
        and set v = lock lockObj (fun () -> logicalBytes <- v)

    /// Copy durable media onto a fresh device (μένω: what remains).
    /// Volatile cache is dropped (power-outage: un-Flush'd bytes are gone).
    /// Arms, LogicalBytes, RecordedOps (what acted), and any BlockCas index
    /// are not copied — those must reload from the superblock.
    member _.CloneMedia() : SimulatedBlockIo =
        let seed = Dictionary<uint64, byte[]>()

        for kv in blocks do
            seed.[kv.Key] <- Array.copy kv.Value

        SimulatedBlockIo(blockSize, seed, lbaCount = capacity, volatileUntilFlush = vol)

    interface IBlockIo with
        member _.BlockSize = blockSize

        /// 0 = unbounded sparse DST. Positive = RAM namespace size.
        member _.LbaCount = capacity

        member _.Read(lba, dst) =
            ensureInRange lba dst.Length

            if dst.Length = 0 then
                0
            else
                let mutable copied = 0
                let mutable offset = 0

                while offset < dst.Length do
                    let cur = lba + uint64 (offset / blockSize)
                    let within = offset % blockSize
                    let n = min (blockSize - within) (dst.Length - offset)

                    match tryGetVisible cur with
                    | Some block -> Span(block, within, n).CopyTo(dst.Span.Slice(offset, n))
                    | None -> dst.Span.Slice(offset, n).Clear()

                    copied <- copied + n

                    offset <- offset + n

                copied

        member _.Write(lba, src) =
            lock lockObj (fun () ->
                ensureInRange lba src.Length
                writes <- writes + 1

                match crashArm with
                | Some afterBytes when src.Length > afterBytes ->
                    crashArm <- None
                    writeRange lba (src.Span.Slice(0, afterBytes))
                    commitOrder.Add lba
                    raise (
                        CrashMidWriteException(
                            "lba:"
                            + lba.ToString(System.Globalization.CultureInfo.InvariantCulture),
                            afterBytes,
                            src.Length
                        ))
                | _ ->
                    match corruptArm with
                    | Some lastBytes when src.Length > 0 && lastBytes > 0 ->
                        corruptArm <- None
                        let copy = src.ToArray()
                        let n = min lastBytes copy.Length
                        let start = copy.Length - n

                        for i in start .. copy.Length - 1 do
                            copy.[i] <- copy.[i] ^^^ corruptXor

                        publish lba copy
                        recorded.Add(BlockIoOp.Write(lba, src.ToArray()))
                        src.Length
                    | _ ->
                        match tornArm with
                        | Some sectorBytes when src.Length > sectorBytes ->
                            tornArm <- None
                            writeRange lba (src.Span.Slice(0, sectorBytes))
                            commitOrder.Add lba
                            recorded.Add(BlockIoOp.Write(lba, src.ToArray()))
                            src.Length
                        | _ ->
                        match reorderArmed, heldWrite with
                        | true, None ->
                            heldWrite <- Some(lba, src.ToArray())
                            recorded.Add(BlockIoOp.Write(lba, src.ToArray()))
                            src.Length
                        | true, Some(heldLba, heldBytes) ->
                            reorderArmed <- false
                            heldWrite <- None
                            publish lba (src.ToArray())
                            publish heldLba heldBytes
                            recorded.Add(BlockIoOp.Write(lba, src.ToArray()))
                            src.Length
                        | _ when badMemoryArm ->
                            badMemoryArm <- false
                            let copy = src.ToArray()

                            if copy.Length > 0 then
                                let last = copy.Length - 1
                                copy.[last] <- copy.[last] ^^^ corruptXor

                            publish lba copy
                            recorded.Add(BlockIoOp.Write(lba, copy))
                            raise (
                                BadMemoryException(
                                    "lba:"
                                    + lba.ToString(System.Globalization.CultureInfo.InvariantCulture)
                                ))
                        | _ ->
                            publish lba (src.ToArray())
                            recorded.Add(BlockIoOp.Write(lba, src.ToArray()))
                            src.Length)

        member _.Flush() =
            lock lockObj (fun () ->
                if powerOutageArm then
                    powerOutageArm <- false
                    cache.Clear()
                    raise (PowerOutageException())

                if vol then
                    for kv in cache do
                        blocks.[kv.Key] <- Array.copy kv.Value

                    cache.Clear()

                recorded.Add BlockIoOp.Flush)

    interface IAsyncBlockIo with
        member this.BlockSize = (this :> IBlockIo).BlockSize
        member this.LbaCount = (this :> IBlockIo).LbaCount

        member this.ReadAsync(lba, dst, ct) =
            if ct.IsCancellationRequested then
                ValueTask<int>(Task.FromCanceled<int> ct)
            else
                ValueTask<int>((this :> IBlockIo).Read(lba, dst))

        member this.WriteAsync(lba, src, ct) =
            if ct.IsCancellationRequested then
                ValueTask<int>(Task.FromCanceled<int> ct)
            else
                ValueTask<int>((this :> IBlockIo).Write(lba, src))

        member this.FlushAsync(ct) =
            if ct.IsCancellationRequested then
                ValueTask(Task.FromCanceled ct)
            else
                (this :> IBlockIo).Flush()
                ValueTask()

/// Append/read a byte stream on `IBlockIo` with tail-block read-modify-write.
/// Position is a byte offset. Does not pad the logical length to a block.
[<RequireQualifiedAccess>]
module BlockLog =
    let append (io: IBlockIo) (pos: int64) (src: ReadOnlyMemory<byte>) : int64 =
        if pos < 0L then
            invalidArg (nameof pos) "pos must be >= 0"

        let bs = io.BlockSize
        let mutable off = 0
        let mutable p = pos

        while off < src.Length do
            let lba = uint64 (p / int64 bs)
            let within = int (p % int64 bs)
            let room = bs - within
            let n = min room (src.Length - off)

            if within = 0 && n = bs then
                io.Write(lba, src.Slice(off, n)) |> ignore
            else
                let buf = Array.zeroCreate bs
                io.Read(lba, Memory buf) |> ignore
                src.Span.Slice(off, n).CopyTo(Span(buf, within, n))
                io.Write(lba, System.ReadOnlyMemory<byte>.op_Implicit buf) |> ignore

            off <- off + n
            p <- p + int64 n

        p

    let readAt (io: IBlockIo) (pos: int64) (len: int64) : byte[] =
        if len <= 0L then
            Array.empty
        elif pos < 0L then
            invalidArg (nameof pos) "pos must be >= 0"
        else
            let bs = io.BlockSize
            let dst = Array.zeroCreate (int len)
            let mutable off = 0
            let mutable p = pos

            while off < dst.Length do
                let lba = uint64 (p / int64 bs)
                let within = int (p % int64 bs)
                let n = min (bs - within) (dst.Length - off)
                let buf = Array.zeroCreate bs
                io.Read(lba, Memory buf) |> ignore
                Array.Copy(buf, within, dst, off, n)
                off <- off + n
                p <- p + int64 n

            dst

    let read (io: IBlockIo) (len: int64) : byte[] = readAt io 0L len

    /// Payload starts after two superblock slots (LBA 0 and LBA 1).
    let origin (io: IBlockIo) = 2L * int64 io.BlockSize

/// Two checksummed superblock copies at LBA 0 and LBA 1. Payload starts at
/// `BlockLog.origin`. Log magic `ZFL2`, CAS magic `ZCA2`, group-commit
/// segment magic `ZGL2`. A torn or corrupt write of the inactive slot
/// leaves the previous generation readable. Index must fit in one block.
/// CRC is IEEE-802 over bytes after offset 8.
[<RequireQualifiedAccess>]
module BlockSuper =
    let logMagic = [| byte 'Z'; byte 'F'; byte 'L'; byte '2' |]
    let casMagic = [| byte 'Z'; byte 'C'; byte 'A'; byte '2' |]
    let groupMagic = [| byte 'Z'; byte 'G'; byte 'L'; byte '2' |]

    let private crcOf (buf: byte[]) =
        Crc32.HashToUInt32(ReadOnlySpan(buf, 8, buf.Length - 8))

    let private magicOk (buf: byte[]) (magic: byte[]) =
        buf.Length >= 24
        && buf.[0] = magic.[0]
        && buf.[1] = magic.[1]
        && buf.[2] = magic.[2]
        && buf.[3] = magic.[3]

    let private crcOk (buf: byte[]) =
        let stored = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 4, 4))
        stored = crcOf buf

    let private readSlot (io: IBlockIo) (lba: uint64) =
        let buf = Array.zeroCreate io.BlockSize
        io.Read(lba, Memory buf) |> ignore
        buf

    let private pick (a: (int64 * 'a) option) (b: (int64 * 'a) option) : (uint64 * int64 * 'a) option =
        match a, b with
        | None, None -> None
        | Some(g, v), None -> Some(0UL, g, v)
        | None, Some(g, v) -> Some(1UL, g, v)
        | Some(g0, v0), Some(g1, v1) ->
            if g0 >= g1 then
                Some(0UL, g0, v0)
            else
                Some(1UL, g1, v1)

    let private nextSlot (current: (uint64 * int64 * 'a) option) =
        match current with
        | None -> 0UL, 1L
        | Some(slot, gen, _) -> 1UL - slot, gen + 1L

    let private parseNamed (buf: byte[]) (magic: byte[]) : (int64 * int64) option =
        if magicOk buf magic && crcOk buf then
            let gen = BinaryPrimitives.ReadInt64LittleEndian(ReadOnlySpan(buf, 8, 8))
            let logical = BinaryPrimitives.ReadInt64LittleEndian(ReadOnlySpan(buf, 16, 8))
            Some(gen, logical)
        else
            None

    /// High bit of the uint16 key-length: payload is raw even-length lowercase
    /// hex decoded to bytes. Clears the UTF-8 tax on ContentAddress128 names
    /// (32 hex chars → 16 bytes) so a 4096-byte ZCA2 superblock holds the ZD4
    /// 32-freeze storm (96 jumprope objects). Old slots with the bit clear
    /// still decode as UTF-8.
    let private hexKeyBit = 0x8000

    let private isLowerHex (s: string) =
        let n = s.Length

        if n < 2 || (n &&& 1) <> 0 then
            false
        else
            let mutable i = 0
            let mutable ok = true

            while ok && i < n do
                let c = s.[i]

                if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') then
                    i <- i + 1
                else
                    ok <- false

            ok

    let private parseCasEntries (buf: byte[]) : (string * int64 * int) array option =
        let count = BinaryPrimitives.ReadInt32LittleEndian(ReadOnlySpan(buf, 16, 4))

        if count < 0 then
            None
        else
            let acc = ResizeArray<_>(count)
            let mutable o = 20
            let mutable ok = true
            let mutable i = 0

            while ok && i < count do
                if o + 2 > buf.Length then
                    ok <- false
                else
                    let stored = int (BinaryPrimitives.ReadUInt16LittleEndian(ReadOnlySpan(buf, o, 2)))
                    o <- o + 2
                    let compact = (stored &&& hexKeyBit) <> 0
                    let klen = stored &&& 0x7FFF

                    if klen < 1 || o + klen + 12 > buf.Length then
                        ok <- false
                    else
                        let key =
                            if compact then
                                Convert.ToHexStringLower(buf, o, klen)
                            else
                                Encoding.UTF8.GetString(buf, o, klen)

                        o <- o + klen
                        let pos = BinaryPrimitives.ReadInt64LittleEndian(ReadOnlySpan(buf, o, 8))
                        o <- o + 8
                        let len = BinaryPrimitives.ReadInt32LittleEndian(ReadOnlySpan(buf, o, 4))
                        o <- o + 4
                        acc.Add((key, pos, len))
                        i <- i + 1

            if ok then Some(acc.ToArray()) else None

    let private parseCas (buf: byte[]) : (int64 * (string * int64 * int) array) option =
        if magicOk buf casMagic && crcOk buf then
            let gen = BinaryPrimitives.ReadInt64LittleEndian(ReadOnlySpan(buf, 8, 8))

            match parseCasEntries buf with
            | Some entries -> Some(gen, entries)
            | None -> None
        else
            None

    let private encodeCas (buf: byte[]) (entries: (string * int64 * int) array) =
        BinaryPrimitives.WriteInt32LittleEndian(Span(buf, 16, 4), entries.Length)
        let mutable o = 20

        for key, pos, len in entries do
            let compact = isLowerHex key
            let kb =
                if compact then
                    Convert.FromHexString key
                else
                    Encoding.UTF8.GetBytes key

            if o + 2 + kb.Length + 8 + 4 > buf.Length then
                invalidOp "BlockCas index does not fit in one superblock"

            let stored =
                if compact then
                    kb.Length ||| hexKeyBit
                else
                    kb.Length

            BinaryPrimitives.WriteUInt16LittleEndian(Span(buf, o, 2), uint16 stored)
            o <- o + 2
            Buffer.BlockCopy(kb, 0, buf, o, kb.Length)
            o <- o + kb.Length
            BinaryPrimitives.WriteInt64LittleEndian(Span(buf, o, 8), pos)
            o <- o + 8
            BinaryPrimitives.WriteInt32LittleEndian(Span(buf, o, 4), len)
            o <- o + 4

    let private writeNamed (io: IBlockIo) (magic: byte[]) (logical: int64) =
        let current = pick (parseNamed (readSlot io 0UL) magic) (parseNamed (readSlot io 1UL) magic)
        let lba, gen = nextSlot current
        let buf = Array.zeroCreate io.BlockSize
        Buffer.BlockCopy(magic, 0, buf, 0, 4)
        BinaryPrimitives.WriteInt64LittleEndian(Span(buf, 8, 8), gen)
        BinaryPrimitives.WriteInt64LittleEndian(Span(buf, 16, 8), logical)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 4, 4), crcOf buf)
        io.Write(lba, System.ReadOnlyMemory<byte>.op_Implicit buf) |> ignore

    let private tryReadNamed (io: IBlockIo) (magic: byte[]) : int64 option =
        match pick (parseNamed (readSlot io 0UL) magic) (parseNamed (readSlot io 1UL) magic) with
        | Some(_, _, logical) -> Some logical
        | None -> None

    let writeLog (io: IBlockIo) (logical: int64) = writeNamed io logMagic logical

    let tryReadLog (io: IBlockIo) : int64 option = tryReadNamed io logMagic

    let writeGroup (io: IBlockIo) (logical: int64) = writeNamed io groupMagic logical

    let tryReadGroup (io: IBlockIo) : int64 option = tryReadNamed io groupMagic

    let writeCas (io: IBlockIo) (entries: (string * int64 * int) array) =
        let current = pick (parseCas (readSlot io 0UL)) (parseCas (readSlot io 1UL))
        let lba, gen = nextSlot current
        let buf = Array.zeroCreate io.BlockSize
        Buffer.BlockCopy(casMagic, 0, buf, 0, 4)
        BinaryPrimitives.WriteInt64LittleEndian(Span(buf, 8, 8), gen)
        encodeCas buf entries
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 4, 4), crcOf buf)
        io.Write(lba, System.ReadOnlyMemory<byte>.op_Implicit buf) |> ignore

    let tryReadCas (io: IBlockIo) : (string * int64 * int) array option =
        match pick (parseCas (readSlot io 0UL)) (parseCas (readSlot io 1UL)) with
        | Some(_, _, entries) -> Some entries
        | None -> None

/// Content-addressed objects on an `IBlockIo`. Payload starts at LBA 2.
/// LBA 0 and 1 hold checksummed `ZCA2` copies. Crash during `Put` leaves the
/// previous generation readable. Keys are ordinal strings. Lowercase even-length
/// hex (ContentAddress128 / 32 chars) encodes as raw bytes with the uint16
/// length high bit set, so ~135 compact names fit a 4096-byte superblock.
/// UTF-8 remains for non-hex names; old UTF-8 hex slots still decode.
[<Sealed>]
type BlockCas(io: IBlockIo) =
    let index = Dictionary<string, struct (int64 * int)>(StringComparer.Ordinal)
    let lockObj = obj ()
    let origin = BlockLog.origin io
    let mutable pos = origin
    let mutable deleteCrashArm: string option = None

    do
        if io.BlockSize <= 0 then
            invalidArg (nameof io) "block size must be positive"

        match BlockSuper.tryReadCas io with
        | Some entries ->
            let mutable endAt = origin

            for key, start, len in entries do
                index.[key] <- struct (start, len)
                let e = start + int64 len

                if e > endAt then
                    endAt <- e

            pos <- endAt
        | None -> ()

    let xorLastByte (start: int64) (len: int) : bool =
        if len <= 0 then
            false
        else
            let bytes = BlockLog.readAt io start (int64 len)
            bytes.[bytes.Length - 1] <- bytes.[bytes.Length - 1] ^^^ 0xA5uy
            BlockLog.append io start (System.ReadOnlyMemory<byte>.op_Implicit bytes)
            |> ignore
            true

    member _.Device = io

    member _.Count = lock lockObj (fun () -> index.Count)

    member _.Exists(key: string) =
        if isNull key then
            false
        else
            lock lockObj (fun () -> index.ContainsKey key)

    /// Read the payload published under `key`. Missing key is `None`.
    member _.TryGet(key: string) : byte[] option =
        if String.IsNullOrEmpty key then
            None
        else
            lock lockObj (fun () ->
                match index.TryGetValue key with
                | false, _ -> None
                | true, struct (start, len) ->
                    if len < 0 then
                        None
                    else
                        Some(BlockLog.readAt io start (int64 len)))

    /// DST: XOR 0xA5 into the last byte of one published payload, in place.
    /// Superblock and names stay. Missing or empty key is false. Lets a
    /// freeze test poison one jumprope internal without flipping the trunk.
    member _.XorLastPayloadByte(key: string) : bool =
        if String.IsNullOrEmpty key then
            false
        else
            lock lockObj (fun () ->
                match index.TryGetValue key with
                | false, _ -> false
                | true, struct (start, len) -> xorLastByte start len)

    /// DST: XOR 0xA5 into the last byte of every published payload, in place.
    /// Superblock and names stay. `isReadable` must fail. Returns how many
    /// keys were flipped.
    member _.XorLastPayloadByteAll() : int =
        lock lockObj (fun () ->
            let mutable n = 0

            for kv in index do
                let struct (start, len) = kv.Value

                if xorLastByte start len then
                    n <- n + 1

            n)

    /// Append `bytes` through `BlockLog` after the superblock. Index and
    /// superblock update only after both the payload Write and the superblock
    /// Write return. A torn superblock slot does not publish the name.
    member _.Put(key: string, bytes: byte[]) =
        if String.IsNullOrEmpty key then
            invalidArg (nameof key) "key must be non-empty"

        if isNull bytes then
            invalidArg (nameof bytes) "bytes must not be null"

        lock lockObj (fun () ->
            if index.ContainsKey key then
                ()
            else
                let start = pos
                let after =
                    BlockLog.append io start (System.ReadOnlyMemory<byte>.op_Implicit bytes)

                let snapshot = Dictionary(index, StringComparer.Ordinal)
                snapshot.[key] <- struct (start, bytes.Length)

                let entries =
                    [| for kv in snapshot ->
                           let struct (s, n) = kv.Value
                           kv.Key, s, n |]

                BlockSuper.writeCas io entries
                index.[key] <- struct (start, bytes.Length)
                pos <- after)

    /// One-shot: next matching Delete unpublishes the key then throws
    /// `CrashMidSweepException`. Remaining keys stay. Same shape as
    /// `InMemoryFileSystem.ArmCrashOnDelete`.
    member _.ArmCrashOnDelete(keyContains: string) =
        if String.IsNullOrEmpty keyContains then
            invalidArg (nameof keyContains) "keyContains must be non-empty"

        lock lockObj (fun () -> deleteCrashArm <- Some keyContains)

    /// Unpublish `key`. Superblock first, then RAM, so a torn slot keeps
    /// the previous generation (the name still exists). Payload bytes stay
    /// on the log until a later compaction. Missing key is a no-op.
    /// Armed crash-mid-sweep throws after the key is unpublished so a
    /// partial tick leaves extra garbage, not a missing live object.
    member _.Delete(key: string) : bool =
        if isNull key then
            false
        else
            lock lockObj (fun () ->
                if not (index.ContainsKey key) then
                    false
                else
                    let snapshot = Dictionary(index, StringComparer.Ordinal)
                    snapshot.Remove key |> ignore

                    let entries =
                        [| for kv in snapshot ->
                               let struct (s, n) = kv.Value
                               kv.Key, s, n |]

                    BlockSuper.writeCas io entries
                    index.Remove key |> ignore

                    let crash =
                        match deleteCrashArm with
                        | Some needle when key.IndexOf(needle, StringComparison.Ordinal) >= 0 ->
                            deleteCrashArm <- None
                            true
                        | _ -> false

                    if crash then
                        raise (CrashMidSweepException key)

                    true)


/// The global file system registry containing the active IFileSystem implementation.
[<AbstractClass; Sealed>]
type FileSystem =
    static member val private defaultFs = PhysicalFileSystem() :> IFileSystem
    static member val private localFs = System.Threading.AsyncLocal<IFileSystem>()

    /// Gets the current filesystem provider.
    static member Current =
        let localVal = FileSystem.localFs.Value
        if obj.ReferenceEquals(localVal, null) then FileSystem.defaultFs
        else localVal

    /// Registers a custom filesystem provider (e.g. InMemoryFileSystem).
    static member Register(fs: IFileSystem) = FileSystem.localFs.Value <- fs

    /// Resets the filesystem provider back to PhysicalFileSystem.
    static member Reset() = FileSystem.localFs.Value <- Unchecked.defaultof<IFileSystem>
