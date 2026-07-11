namespace Zeta.Core

open System
open System.IO
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

/// The default physical file system wrapper delegating to System.IO.
type PhysicalFileSystem() =
    interface IFileSystem with
        member _.Exists(path) = File.Exists(path)
        member _.Delete(path) = File.Delete(path)
        member _.Move(src, dest, overwrite) = File.Move(src, dest, overwrite)
        member _.ReadAllBytes(path) = File.ReadAllBytes(path)
        member _.ReadAllBytesAsync(path, ct) = File.ReadAllBytesAsync(path, ct)
        member _.OpenFile(path, mode, access, share) =
            new FileStream(path, mode, access, share, 4096, true) :> Stream
        member _.OpenWrite(path, fsync) =
            let opts = if fsync then FileOptions.WriteThrough else FileOptions.None
            new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, opts) :> Stream
        member _.OpenRead(path) =
            new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read) :> Stream
        member _.GetFiles(path, searchPattern) = Directory.GetFiles(path, searchPattern)
        member _.CreateDirectory(path) = Directory.CreateDirectory(path) |> ignore

/// A mock FileStream that commits its MemoryStream buffer to the InMemoryFileSystem registry upon disposal.
type SimulatedFileStream(path: string, mode: FileMode, access: FileAccess, files: System.Collections.Concurrent.ConcurrentDictionary<string, byte[]>, checkFault: unit -> unit, applyLatency: unit -> unit) =
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

    override this.Dispose(disposing) =
        if disposing && not isDisposed then
            isDisposed <- true
            checkFault()
            applyLatency()
            if access.HasFlag(FileAccess.Write) then
                files.[path] <- this.ToArray()
        base.Dispose(disposing)

/// An in-memory mock file system that supports simulating latency, read/write sector corruption exceptions,
/// and file creation/modification tracking.
type InMemoryFileSystem() =
    let files = System.Collections.Concurrent.ConcurrentDictionary<string, byte[]>()
    let mutable latencyMs = 0L
    let mutable errorRate = 0.0
    let mutable rngState = 12345L
    let lockObj = obj ()

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
            Thread.Sleep(int latencyMs)

    member _.Files = files

    /// Set simulated latency (in milliseconds) and probabilistic error rate [0.0, 1.0].
    member _.SetFaults(rate: float, latency: int64, seed: int64) =
        lock lockObj (fun () ->
            errorRate <- rate
            latencyMs <- latency
            rngState <- seed)

    interface IFileSystem with
        member _.Exists(path) =
            checkFault()
            files.ContainsKey(path)

        member _.Delete(path) =
            checkFault()
            files.TryRemove(path) |> ignore

        member _.Move(src, dest, _overwrite) =
            checkFault()
            match files.TryRemove(src) with
            | true, bytes -> files.[dest] <- bytes
            | false, _ -> raise (FileNotFoundException(src))

        member _.ReadAllBytes(path) =
            checkFault()
            applyLatency()
            match files.TryGetValue(path) with
            | true, bytes -> bytes
            | false, _ -> raise (FileNotFoundException(path))

        member _.ReadAllBytesAsync(path, ct) = task {
            checkFault()
            if latencyMs > 0L then
                do! Task.Delay(int latencyMs, ct)
            match files.TryGetValue(path) with
            | true, bytes -> return bytes
            | false, _ -> return raise (FileNotFoundException(path))
        }

        member _.OpenFile(path, mode, access, _share) =
            new SimulatedFileStream(path, mode, access, files, checkFault, applyLatency) :> Stream
 
        member _.OpenWrite(path, _fsync) =
            new SimulatedFileStream(path, FileMode.Create, FileAccess.Write, files, checkFault, applyLatency) :> Stream
 
        member _.OpenRead(path) =
            new SimulatedFileStream(path, FileMode.Open, FileAccess.Read, files, checkFault, applyLatency) :> Stream

        member _.GetFiles(path, searchPattern) =
            checkFault()
            let suffix = searchPattern.Replace("*", "")
            files.Keys
            |> Seq.filter (fun k -> k.StartsWith(path) && k.EndsWith(suffix))
            |> Seq.toArray

        member _.CreateDirectory(_path) =
            checkFault()
            ()


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
