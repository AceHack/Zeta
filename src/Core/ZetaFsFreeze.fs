namespace Zeta.Core

open System
open System.Buffers.Binary
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Text
open System.Threading
open System.Threading.Tasks
open Zeta.Core.FSharp.Blake3

/// WAL freeze (E2 / PR7). Snapshot mutbuf G, Jumprope that snapshot, log
/// freeze-intent then CAS puts then freeze-commit. Durable fsyncs every
/// leaf+trunk **before** commit and withholds the ack. Readable iff commit
/// exists and every leaf is present. Crash-mid-write *intercept* is
/// `InMemoryFileSystem.ArmCrashMidWrite`. Journaled/Durable boats write
/// intent, Flush (visible, no crash arm), put leaves, then commit.
/// Plain and sealed log replay restore intact intent+commit pairs on create
/// (torn tail / intent-without-commit / mid-log CRC dropped from the bad
/// frame; prefix kept). Sealed frames carry LSN in the clear so `openLog`
/// can rebuild the nonce. Reclaim volume door is `reclaimSweep` (journal
/// under `StoreDir`). `reclaimTick` is the sync core. `reclaimAsync` +
/// `pumpReclaim` are the DoP=1 FerryThrottler boat. Freeze bytes since
/// last reclaim tick are metered on the volume (`reclaimTickMetered`).
/// Orphan catalog keeps full ContentHash256 (`orphanObjects`); a path
/// scan cannot reconstruct ids. Catalog persists in dual-slot
/// `known.pins.0` / `known.pins.1` (generation + CRC). Reopen still
/// loads a leftover `known.pins` alias if both slots are missing.
/// Successful freeze enqueues orphan
/// reclaim when the catalog is nonempty. Reopen enqueues from leftover
/// sizes. The freeze-byte meter persists in the catalog so reopen
/// does not start at pacer(0). Default `create` stores CAS on `BlockCas`; reclaim
/// unpublishes those keys (`Delete`). POSIX `createManualStream` still
/// deletes files. Manual volumes still `pumpReclaim`. `KeepNone` /
/// `rolling(N)` unpin previous generations of the same entity; product
/// `create` uses `rollingDefault`. DST manuals stay `KeepAll` until
/// `known.pins` / slots record `history keep-none` / `rolling N`.
/// Catalog also persists `ObjectSets` (`set <content> <id>...`) so reopen
/// hash-verifies jumprope internals, not only trunk plus leaves. Buffered
/// `putObject` maps catalog persist IOException/BUGGIFY to `FreezeError.Fsync`
/// (Buffered does not ride FreezeLog). History setter, reclaim-meter,
/// `noteFreeze` / `applyRetention` / `noteKnownObject` persist are best-effort
/// (write-fail does not throw; next FreezeLog persist retries). After putLeaves,
/// stored object bytes are hashed; mismatch withholds commit as
/// `FreezeError.MissingLeaves`. Buffered `putObject` hash-verifies the same way.
///
/// DoP=1 on this log. No Task.Run except the ferry launch (injected context
/// on the DST path; `manual` + `PumpToIdleAsync` for tests).
///
/// ZD2 / D4: Journaled and Durable log appends go through `FerryThrottler`
/// the way `GroupCommitDiskDeltaLog` already does. One boat writes N freeze
/// records then one Flush/fsync. Buffered still skips the log.
///
/// Cancellation: `freezeAsync` takes the token (DST / Generic Host
/// `ApplicationStopping`). Nested ferry calls pass it through. There is no
/// ambient token (noninterference). Cancel before admit skips the boat;
/// cancel after admit still writes (same shield as group-commit).
module ZetaFsFreeze =

    type DurabilityClass =
        | Buffered
        | Journaled
        | Durable

    type FreezeError =
        | Fsync of FileSync.FileSyncError
        | WindowsDurableNotClaimed
        | MissingLeaves of int
        | Observer of string
        | Malformed of string
        | Crypto of ZetaFsCrypto.CryptoError

    type FreezeResult =
        { Entity: ZetaFsNamespace.EntityId
          Content: ContentHash256
          Span: uint64
          Class: DurabilityClass
          Generation: uint64
          IntentLsn: int64
          CommitLsn: int64 }

    type IDurabilityObserver =
        abstract OnJournaled: FreezeResult -> Result<unit, FreezeError>
        abstract OnDurable: FreezeResult -> Result<unit, FreezeError>

    type internal LogItem =
        { IntentLsn: int64
          CommitLsn: int64
          IntentFrame: byte[]
          CommitFrame: byte[]
          Durable: bool
          Objects: struct (ContentHash256 * byte[])[]
          Reply: TaskCompletionSource<Result<struct (int64 * int64), FreezeError>> }

    /// Log device for freeze frames. `Simulated` is the LBA DST door.
    /// `HostFile` is the `FileSystemBlockIo` polyfill (`create` / `createManual`).
    type FreezeBlockIo =
        | Simulated of SimulatedBlockIo
        | HostFile of FileSystemBlockIo

        member this.Device =
            match this with
            | Simulated io -> io :> IBlockIo
            | HostFile io -> io :> IBlockIo

        member this.LogicalBytes
            with get () =
                match this with
                | Simulated io -> io.LogicalBytes
                | HostFile io -> io.LogicalBytes
            and set v =
                match this with
                | Simulated io -> io.LogicalBytes <- v
                | HostFile io -> io.LogicalBytes <- v

    let private catalogPath (storeDir: string) =
        ZetaFsPath.combine2 storeDir "known.pins"

    let private catalogSlot (storeDir: string) (slot: int) =
        ZetaFsPath.combine2
            storeDir
            ("known.pins." + slot.ToString(CultureInfo.InvariantCulture))

    let private formatHistory (h: ZetaFsPolicy.HistoryPolicy) : string =
        match h with
        | ZetaFsPolicy.HistoryPolicy.KeepNone -> "history keep-none"
        | ZetaFsPolicy.HistoryPolicy.Rolling(Some n, _, _) ->
            "history rolling " + n.ToString(CultureInfo.InvariantCulture)
        | ZetaFsPolicy.HistoryPolicy.KeepAll
        | ZetaFsPolicy.HistoryPolicy.Rolling(None, _, _)
        | ZetaFsPolicy.HistoryPolicy.Regen _ -> "history keep-all"

    let private parseHistory (line: string) : ZetaFsPolicy.HistoryPolicy option =
        let parts = line.Split(' ')

        if parts.Length >= 2 && parts.[0] = "history" then
            match parts.[1] with
            | "keep-none" -> Some ZetaFsPolicy.HistoryPolicy.KeepNone
            | "keep-all" -> Some ZetaFsPolicy.HistoryPolicy.KeepAll
            | "rolling" when parts.Length >= 3 ->
                match Int32.TryParse(parts.[2], NumberStyles.Integer, CultureInfo.InvariantCulture) with
                | true, n when n >= 1 -> Some(ZetaFsPolicy.HistoryPolicy.Rolling(Some n, None, None))
                | _ -> Some ZetaFsPolicy.HistoryPolicy.KeepAll
            | _ -> None
        else
            None

    let private encodeCatalog
        (gen: int64)
        (history: ZetaFsPolicy.HistoryPolicy)
        (meter: uint64)
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (objectSets: Dictionary<ContentHash256, ContentHash256[]>)
        : byte[] =
        let sb = StringBuilder()

        sb
            .Append("gen ")
            .Append(gen.ToString(CultureInfo.InvariantCulture))
            .Append('\n')
            .Append(formatHistory history)
            .Append('\n')
            .Append("meter ")
            .Append(meter.ToString(CultureInfo.InvariantCulture))
        |> ignore

        for kv in known do
            sb
                .Append('\n')
                .Append(kv.Key.ToHex())
                .Append(' ')
                .Append(kv.Value.ToString(CultureInfo.InvariantCulture))
                .Append(' ')
                .Append(if livePins.Contains kv.Key then "1" else "0")
            |> ignore

        for kv in objectSets do
            sb.Append('\n').Append("set ").Append(kv.Key.ToHex()) |> ignore

            for id in kv.Value do
                sb.Append(' ').Append(id.ToHex()) |> ignore

        let payloadBytes = Encoding.UTF8.GetBytes(sb.ToString())
        let crc = HardwareCrc.Crc32C(ReadOnlySpan payloadBytes)
        let headerBytes =
            Encoding.UTF8.GetBytes("crc " + crc.ToString(CultureInfo.InvariantCulture) + "\n")
        let bytes = Array.zeroCreate (headerBytes.Length + payloadBytes.Length)
        Buffer.BlockCopy(headerBytes, 0, bytes, 0, headerBytes.Length)
        Buffer.BlockCopy(payloadBytes, 0, bytes, headerBytes.Length, payloadBytes.Length)
        bytes

    let private parsePinLines
        (lines: string[])
        : ZetaFsPolicy.HistoryPolicy * uint64 * (ContentHash256 * uint64 * bool)[] * (ContentHash256 * ContentHash256[])[] =
        let mutable history = ZetaFsPolicy.HistoryPolicy.KeepAll
        let mutable meter = 0UL
        let acc = ResizeArray<_>()
        let sets = ResizeArray<_>()

        for line in lines do
            if line.Length > 0 then
                match parseHistory line with
                | Some h -> history <- h
                | None ->
                    let parts = line.Split(' ')

                    if parts.Length >= 2 && parts.[0] = "meter" then
                        match UInt64.TryParse(parts.[1], NumberStyles.Integer, CultureInfo.InvariantCulture) with
                        | true, n -> meter <- n
                        | _ -> ()
                    elif parts.Length >= 2 && parts.[0] = "set" && parts.[1].Length = 64 then
                        let content = ContentHash256.ofHex parts.[1]
                        let ids = ResizeArray<ContentHash256>()
                        let mutable k = 2
                        let mutable ok = true

                        while ok && k < parts.Length do
                            if parts.[k].Length = 64 then
                                ids.Add(ContentHash256.ofHex parts.[k])
                                k <- k + 1
                            else
                                ok <- false

                        if ok then
                            sets.Add(content, ids.ToArray())
                    elif parts.Length = 3 && parts.[0].Length = 64 then
                        match UInt64.TryParse(parts.[1], NumberStyles.Integer, CultureInfo.InvariantCulture) with
                        | true, size ->
                            let id = ContentHash256.ofHex parts.[0]
                            acc.Add(id, size, parts.[2] = "1")
                        | _ -> ()

        history, meter, acc.ToArray(), sets.ToArray()

    let private tryDecodeCatalog
        (text: string)
        : (int64 * ZetaFsPolicy.HistoryPolicy * uint64 * (ContentHash256 * uint64 * bool)[] * (ContentHash256 * ContentHash256[])[]) option =
        let lines =
            text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

        if
            lines.Length >= 2
            && lines.[0].StartsWith("crc ", StringComparison.Ordinal)
            && lines.[1].StartsWith("gen ", StringComparison.Ordinal)
        then
            match UInt32.TryParse(lines.[0].Substring(4), NumberStyles.Integer, CultureInfo.InvariantCulture) with
            | false, _ -> None
            | true, stored ->
                let payload = String.concat "\n" (Array.skip 1 lines)
                let actual = HardwareCrc.Crc32C(ReadOnlySpan(Encoding.UTF8.GetBytes payload))

                if actual <> stored then
                    None
                else
                    match Int64.TryParse(lines.[1].Substring(4), NumberStyles.Integer, CultureInfo.InvariantCulture) with
                    | false, _ -> None
                    | true, gen when gen < 1L -> None
                    | true, gen ->
                        let history, meter, entries, sets = parsePinLines (Array.skip 2 lines)
                        Some(gen, history, meter, entries, sets)
        else
            None

    let private tryDecodePath (fs: IFileSystem) (path: string) =
        if not (fs.Exists path) then
            None
        else
            tryDecodeCatalog (Encoding.UTF8.GetString(fs.ReadAllBytes path))

    let private applyEntries
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (entries: (ContentHash256 * uint64 * bool)[])
        =
        known.Clear()
        livePins.Clear()

        for id, size, pin in entries do
            known.[id] <- size

            if pin then
                livePins.Add id |> ignore

    let private applySets
        (objectSets: Dictionary<ContentHash256, ContentHash256[]>)
        (sets: (ContentHash256 * ContentHash256[])[])
        =
        objectSets.Clear()

        for content, ids in sets do
            objectSets.[content] <- ids

    let private persistCatalog
        (storeDir: string)
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (history: ZetaFsPolicy.HistoryPolicy)
        (meter: uint64)
        (objectSets: Dictionary<ContentHash256, ContentHash256[]>)
        (catalogGen: int64 ref)
        =
        // In-memory gen; slots are reopen truth. Do not re-decode on persist.
        let gen = !catalogGen + 1L
        catalogGen := gen
        let slot = int (gen % 2L)
        let fs = FileSystem.Current
        let bytes = encodeCatalog gen history meter known livePins objectSets

        let writePublished path =
            let tmp = path + ".tmp"

            do
                use stream = fs.OpenWrite(tmp, false)
                stream.Write(bytes, 0, bytes.Length)
                stream.Flush()

            SimulatedFs.Write tmp
            fs.Move(tmp, path, true)

        writePublished (catalogSlot storeDir slot)

    let private catalogPersistError (storeDir: string) =
        FreezeError.Fsync(FileSync.FileSyncError.FlushFailed(catalogPath storeDir, 5))

    let private tryPersistCatalog
        (storeDir: string)
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (history: ZetaFsPolicy.HistoryPolicy)
        (meter: uint64)
        (objectSets: Dictionary<ContentHash256, ContentHash256[]>)
        (catalogGen: int64 ref)
        : Result<unit, FreezeError> =
        try
            persistCatalog storeDir known livePins history meter objectSets catalogGen
            Ok()
        with
        | :? CrashMidWriteException as ex -> raise ex
        | :? PowerOutageException as ex -> raise ex
        | :? BadMemoryException as ex -> raise ex
        | :? IOException -> Error(catalogPersistError storeDir)
        | ex when ex.Message.IndexOf("BUGGIFY", StringComparison.Ordinal) >= 0 ->
            Error(catalogPersistError storeDir)

    /// Volume catalog persist outside FreezeLog is not the freeze ack.
    /// Crash/power/bad-memory still raise. Fsync is ignored; the next
    /// FreezeLog persist retries.
    let private persistCatalogBestEffort
        (storeDir: string)
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (history: ZetaFsPolicy.HistoryPolicy)
        (meter: uint64)
        (objectSets: Dictionary<ContentHash256, ContentHash256[]>)
        (catalogGen: int64 ref)
        =
        match tryPersistCatalog storeDir known livePins history meter objectSets catalogGen with
        | Ok() -> ()
        | Error _ -> ()

    let private loadCatalog
        (storeDir: string)
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (meter: uint64 ref)
        (objectSets: Dictionary<ContentHash256, ContentHash256[]>)
        (catalogGen: int64 ref)
        : ZetaFsPolicy.HistoryPolicy =
        let fs = FileSystem.Current
        let mutable bestGen = 0L
        let mutable bestHistory = ZetaFsPolicy.HistoryPolicy.KeepAll
        let mutable bestMeter = 0UL
        let mutable bestEntries: (ContentHash256 * uint64 * bool)[] = [||]
        let mutable bestSets: (ContentHash256 * ContentHash256[])[] = [||]
        let mutable found = false

        let consider path =
            match tryDecodePath fs path with
            | Some(g, h, m, entries, sets) when (not found) || g > bestGen ->
                found <- true
                bestGen <- g
                bestHistory <- h
                bestMeter <- m
                bestEntries <- entries
                bestSets <- sets
            | _ -> ()

        consider (catalogSlot storeDir 0)
        consider (catalogSlot storeDir 1)

        if found then
            applyEntries known livePins bestEntries
            applySets objectSets bestSets
            meter := bestMeter
            catalogGen := bestGen
            bestHistory
        else
            let path = catalogPath storeDir
            let mutable history = ZetaFsPolicy.HistoryPolicy.KeepAll

            if fs.Exists path then
                let text = Encoding.UTF8.GetString(fs.ReadAllBytes path)
                let lines =
                    text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')
                let h, m, entries, sets = parsePinLines lines
                history <- h
                meter := m
                applyEntries known livePins entries
                applySets objectSets sets

            catalogGen := 0L
            history

    /// DoP=1 segment writer. One boat = N freezes, one Flush; Durable adds one
    /// fsync of objects-dir + log. `manual` is the DST pump (no background ferry).
    [<Sealed>]
    type internal FreezeLog
        (
            storeDir: string,
            config: FerryThrottlerConfig,
            manual: bool,
            blockIo: FreezeBlockIo option,
            objectCas: BlockCas option,
            known: Dictionary<ContentHash256, uint64>,
            livePins: HashSet<ContentHash256>,
            history: ZetaFsPolicy.HistoryPolicy ref,
            meter: uint64 ref,
            objectSets: Dictionary<ContentHash256, ContentHash256[]>,
            catalogGen: int64 ref
        ) =

        do
            if config.MaxDegreeOfParallelism <> 1 then
                invalidArg (nameof config) "FreezeLog writes one segment file; MaxDegreeOfParallelism must be 1."

        let logDir = ZetaFsPath.combine2 storeDir "log"
        let logPath = ZetaFsPath.combine2 logDir "freeze"
        let objectsDir = ZetaFsPath.combine2 storeDir "objects"
        let fsDoor = FileSystem.Current
        let mutable boats = 0
        let mutable lastBoat = 0

        let processBatch (boat: ReadOnlyMemory<LogItem>) (ct: CancellationToken) : Task =
            let mutable err: FreezeError option = None

            let persist () =
                if err.IsNone then
                    match tryPersistCatalog storeDir known livePins !history !meter objectSets catalogGen with
                    | Ok() -> ()
                    | Error e -> err <- Some e

            let succeed () =
                // Per-item persist already ran before each commit frame.
                // A second write here is the same catalog without new pins.
                if err.IsNone then
                    for i in 0 .. boat.Length - 1 do
                        let it = boat.Span.[i]
                        let mutable j = 0

                        while j < it.Objects.Length do
                            let struct (id, _) = it.Objects.[j]
                            livePins.Add id |> ignore
                            j <- j + 1

                for i in 0 .. boat.Length - 1 do
                    let it = boat.Span.[i]
                    let outcome =
                        match err with
                        | Some e -> Error e
                        | None -> Ok(struct (it.IntentLsn, it.CommitLsn))

                    it.Reply.TrySetResult outcome |> ignore

                Task.CompletedTask

            let fail (ex: exn) =
                for i in 0 .. boat.Length - 1 do
                    boat.Span.[i].Reply.TrySetException ex |> ignore

                Task.CompletedTask

            try
                ct.ThrowIfCancellationRequested()
                boats <- boats + 1
                lastBoat <- boat.Length
                fsDoor.CreateDirectory logDir

                let tryFlush (io: IBlockIo) (path: string) =
                    if err.IsNone then
                        try
                            SimulatedFs.Flush path
                            io.Flush()
                        with
                        | :? CrashMidWriteException as ex -> raise ex
                        | :? PowerOutageException as ex -> raise ex
                        | :? BadMemoryException as ex -> raise ex
                        | :? IOException ->
                            err <- Some(FreezeError.Fsync(FileSync.FileSyncError.FlushFailed(path, 5)))
                        | ex when ex.Message.IndexOf("BUGGIFY", StringComparison.Ordinal) >= 0 ->
                            err <- Some(FreezeError.Fsync(FileSync.FileSyncError.FlushFailed(path, 5)))

                let tryWrite (path: string) =
                    if err.IsNone then
                        try
                            SimulatedFs.Write path
                        with
                        | :? CrashMidWriteException as ex -> raise ex
                        | :? PowerOutageException as ex -> raise ex
                        | :? BadMemoryException as ex -> raise ex
                        | :? IOException ->
                            err <- Some(FreezeError.Fsync(FileSync.FileSyncError.FlushFailed(path, 5)))
                        | ex when ex.Message.IndexOf("BUGGIFY", StringComparison.Ordinal) >= 0 ->
                            err <- Some(FreezeError.Fsync(FileSync.FileSyncError.FlushFailed(path, 5)))

                let anyDurable =
                    let mutable d = false
                    let mutable i = 0

                    while i < boat.Length do
                        if boat.Span.[i].Durable then
                            d <- true

                        i <- i + 1

                    d

                let putLeaves (item: LogItem) =
                    match objectCas with
                    | Some cas ->
                        if err.IsNone && item.Objects.Length > 0 then
                            let staged = Array.zeroCreate item.Objects.Length

                            for j in 0 .. item.Objects.Length - 1 do
                                let struct (id, bytes) = item.Objects.[j]
                                let hex = (ContentHash256.toContentAddress128 id).ToHex()
                                staged.[j] <- hex, bytes

                            try
                                cas.PutMany staged

                                for j in 0 .. item.Objects.Length - 1 do
                                    let struct (id, bytes) = item.Objects.[j]
                                    known.[id] <- uint64 bytes.Length

                                tryWrite (ZetaFsPath.combine2 storeDir "cas")

                                if item.Durable then
                                    tryFlush cas.Device (ZetaFsPath.combine2 storeDir "cas")
                            with
                            | :? CrashMidWriteException as ex -> raise ex
                            | :? PowerOutageException as ex -> raise ex
                            | :? BadMemoryException as ex -> raise ex
                            | :? IOException ->
                                err <-
                                    Some(
                                        FreezeError.Fsync(
                                            FileSync.FileSyncError.FlushFailed(
                                                ZetaFsPath.combine2 storeDir "cas",
                                                5
                                            )
                                        )
                                    )
                            | ex when ex.Message.IndexOf("BUGGIFY", StringComparison.Ordinal) >= 0 ->
                                err <-
                                    Some(
                                        FreezeError.Fsync(
                                            FileSync.FileSyncError.FlushFailed(
                                                ZetaFsPath.combine2 storeDir "cas",
                                                5
                                            )
                                        )
                                    )
                    | None ->
                        let mutable j = 0

                        while err.IsNone && j < item.Objects.Length do
                            let struct (id, bytes) = item.Objects.[j]
                            let hex = (ContentHash256.toContentAddress128 id).ToHex()
                            let path = ZetaFsPath.combine3 objectsDir (hex.Substring(0, 2)) (hex.Substring(2))
                            let dir = ZetaFsPath.directoryName path
                            fsDoor.CreateDirectory dir

                            try
                                if not (fsDoor.Exists path) then
                                    FileSystemIo.writeAllBytes fsDoor path bytes
                                    tryWrite path

                                known.[id] <- uint64 bytes.Length
                            with
                            | :? CrashMidWriteException as ex ->
                                let tmp = path + ".tmp"
                                let leftover =
                                    if fsDoor.Exists path then
                                        path
                                    elif fsDoor.Exists tmp then
                                        tmp
                                    else
                                        null

                                if leftover <> null then
                                    if leftover <> path then
                                        fsDoor.Move(leftover, path, true)

                                    let n = fsDoor.ReadAllBytes(path).Length

                                    if n > 0 then
                                        known.[id] <- uint64 n
                                        persist ()

                                raise ex

                            if item.Durable then
                                match FileSync.fsyncFile path with
                                | Ok() -> ()
                                | Error e -> err <- Some(FreezeError.Fsync e)

                            j <- j + 1

                        if err.IsNone && item.Durable then
                            match FileSync.fsyncDir objectsDir with
                            | Error e -> err <- Some(FreezeError.Fsync e)
                            | Ok() -> ()

                let objectMatchesStored (id: ContentHash256) : bool =
                    let hex = (ContentHash256.toContentAddress128 id).ToHex()

                    match objectCas with
                    | Some cas ->
                        match cas.TryGet hex with
                        | None -> false
                        | Some b -> (ContentHash256.ofBytes b).Equals(id)
                    | None ->
                        let path = ZetaFsPath.combine3 objectsDir (hex.Substring(0, 2)) (hex.Substring(2))

                        if not (fsDoor.Exists path) then
                            false
                        else
                            (ContentHash256.ofBytes (fsDoor.ReadAllBytes path)).Equals(id)

                let verifyLeaves (item: LogItem) =
                    if err.IsNone then
                        let mutable missing = 0
                        let mutable k = 0

                        while k < item.Objects.Length do
                            let struct (id, _) = item.Objects.[k]

                            if not (objectMatchesStored id) then
                                missing <- missing + 1

                            k <- k + 1

                        if missing > 0 then
                            err <- Some(FreezeError.MissingLeaves missing)

                // Intent Flush publishes without crash arms on the file door.
                // On IBlockIo, Flush is the barrier; crash arms fire on Write.
                match blockIo with
                | Some door ->
                    let mutable i = 0
                    let device = door.Device
                    let origin = BlockLog.origin device

                    while err.IsNone && i < boat.Length do
                        let item = boat.Span.[i]
                        let afterIntent =
                            BlockLog.append
                                device
                                (origin + door.LogicalBytes)
                                (System.ReadOnlyMemory<byte>.op_Implicit item.IntentFrame)

                        door.LogicalBytes <- afterIntent - origin
                        BlockSuper.writeLog device door.LogicalBytes
                        tryFlush device logPath

                        if err.IsNone then
                            putLeaves item
                            verifyLeaves item

                        if err.IsNone then
                            persist ()

                        if err.IsNone then
                            let afterCommit =
                                BlockLog.append
                                    device
                                    (origin + door.LogicalBytes)
                                    (System.ReadOnlyMemory<byte>.op_Implicit item.CommitFrame)

                            door.LogicalBytes <- afterCommit - origin
                            BlockSuper.writeLog device door.LogicalBytes
                            tryFlush device logPath

                        i <- i + 1
                | None ->
                    do
                        use stream = fsDoor.OpenFile(logPath, FileMode.Append, FileAccess.Write, FileShare.Read)

                        let mutable i = 0

                        while err.IsNone && i < boat.Length do
                            let item = boat.Span.[i]
                            stream.Write(item.IntentFrame, 0, item.IntentFrame.Length)
                            stream.Flush()
                            putLeaves item
                            verifyLeaves item

                            if err.IsNone then
                                persist ()

                            if err.IsNone then
                                stream.Write(item.CommitFrame, 0, item.CommitFrame.Length)

                            i <- i + 1

                        if err.IsNone && anyDurable then
                            match FileSync.fsyncFile logPath with
                            | Error e -> err <- Some(FreezeError.Fsync e)
                            | Ok() ->
                                match FileSync.fsyncDir logDir with
                                | Error e -> err <- Some(FreezeError.Fsync e)
                                | Ok() -> ()

                succeed ()
            with
            | ex -> fail ex

        let throttler = new FerryThrottler<LogItem>(config, processBatch, manual = manual)

        member _.Boats = boats
        member _.LastBoatSize = lastBoat
        member _.LogPath = logPath
        member _.BlockIo = blockIo
        member _.ObjectCas = objectCas

        member _.SubmitAsync(item: LogItem, ct: CancellationToken) : ValueTask<Result<struct (int64 * int64), FreezeError>> =
            if ct.IsCancellationRequested then
                item.Reply.TrySetCanceled ct |> ignore
                ValueTask<Result<struct (int64 * int64), FreezeError>>(Task.FromCanceled<Result<struct (int64 * int64), FreezeError>> ct)
            else
                let write = throttler.EnqueueAsync(item, ct)
                let wait (enqueue: ValueTask) =
                    task {
                        try
                            if not enqueue.IsCompletedSuccessfully then
                                do! enqueue.AsTask().ConfigureAwait(false)

                            return! item.Reply.Task.WaitAsync(ct).ConfigureAwait(false)
                        with
                        | :? OperationCanceledException as ex ->
                            item.Reply.TrySetCanceled ct |> ignore
                            return raise ex
                        | ex ->
                            item.Reply.TrySetException ex |> ignore
                            return raise ex
                    }

                if write.IsCompletedSuccessfully then
                    ValueTask<Result<struct (int64 * int64), FreezeError>>(wait (ValueTask()))
                else
                    ValueTask<Result<struct (int64 * int64), FreezeError>>(wait write)

        member _.PumpToIdleAsync(?cancellationToken: CancellationToken) =
            throttler.PumpToIdleAsync(?cancellationToken = cancellationToken)

        interface IDisposable with
            member _.Dispose() = (throttler :> IDisposable).Dispose()

    let private objectPath (storeDir: string) (id: ContentHash256) =
        let hex = (ContentHash256.toContentAddress128 id).ToHex()
        ZetaFsPath.combine4 storeDir "objects" (hex.Substring(0, 2)) (hex.Substring(2))

    let private objectKey (id: ContentHash256) =
        (ContentHash256.toContentAddress128 id).ToHex()

    let private catalogOrphans
        (storeDir: string)
        (known: Dictionary<ContentHash256, uint64>)
        (livePins: HashSet<ContentHash256>)
        (objectCas: BlockCas option)
        : ZetaFsReclaim.Object[] =
        [| for kv in known do
               if not (livePins.Contains kv.Key) then
                   let published =
                       match objectCas with
                       | Some cas -> cas.Exists(objectKey kv.Key)
                       | None -> FileSystem.Current.Exists(objectPath storeDir kv.Key)

                   if published then
                       { Id = kv.Key
                         Size = kv.Value
                         Refs = [||] } |]

    let private journalPath (storeDir: string) =
        ZetaFsPath.combine2 storeDir "sweep.journal"

    let private tickStore
        (storeDir: string)
        (fs: IFileSystem)
        (objectCas: BlockCas option)
        (roots: ZetaFsReclaim.Roots)
        (objects: ZetaFsReclaim.Object[])
        (freezeBytesSinceLastTick: uint64)
        : int =
        let budget = ZetaFsReclaim.pacer freezeBytesSinceLastTick
        let ids = ZetaFsReclaim.propose roots objects budget

        match objectCas with
        | Some cas ->
            let keys = ids |> Array.map (fun id -> id, objectKey id)

            ZetaFsReclaim.applyWithJournalUsing
                (fun key -> cas.Exists key)
                (fun key -> cas.Delete key |> ignore)
                fs
                (journalPath storeDir)
                keys
                budget
        | None ->
            let paths = ids |> Array.map (fun id -> id, objectPath storeDir id)
            ZetaFsReclaim.applyWithJournal fs (journalPath storeDir) paths budget

    type internal ReclaimItem =
        { Roots: ZetaFsReclaim.Roots
          Objects: ZetaFsReclaim.Object[]
          FreezeBytes: uint64
          Reply: TaskCompletionSource<int> }

    /// DoP=1 reclaim boat. Separate from FreezeLog so WAL writes and deletes
    /// do not share a boat (crash-mid-write vs crash-on-delete).
    [<Sealed>]
    type internal ReclaimFerry
        (
            storeDir: string,
            config: FerryThrottlerConfig,
            manual: bool,
            objectCas: BlockCas option
        ) =
        do
            if config.MaxDegreeOfParallelism <> 1 then
                invalidArg (nameof config) "ReclaimFerry MaxDegreeOfParallelism must be 1."

        let mutable boats = 0
        let mutable lastBoat = 0

        let processBatch (boat: ReadOnlyMemory<ReclaimItem>) (ct: CancellationToken) : Task =
            try
                ct.ThrowIfCancellationRequested()
                boats <- boats + 1
                lastBoat <- boat.Length
                let fs = FileSystem.Current
                let mutable i = 0

                while i < boat.Length do
                    let item = boat.Span.[i]
                    let n =
                        tickStore storeDir fs objectCas item.Roots item.Objects item.FreezeBytes
                    item.Reply.TrySetResult n |> ignore
                    i <- i + 1

                Task.CompletedTask
            with ex ->
                for i in 0 .. boat.Length - 1 do
                    boat.Span.[i].Reply.TrySetException ex |> ignore

                Task.CompletedTask

        let throttler = new FerryThrottler<ReclaimItem>(config, processBatch, manual = manual)

        member _.Boats = boats
        member _.LastBoatSize = lastBoat

        member _.SubmitAsync(item: ReclaimItem, ct: CancellationToken) : ValueTask =
            throttler.EnqueueAsync(item, ct)

        member _.PumpToIdleAsync(?cancellationToken: CancellationToken) =
            throttler.PumpToIdleAsync(?cancellationToken = cancellationToken)

        interface IDisposable with
            member _.Dispose() = (throttler :> IDisposable).Dispose()

    let private bindingsPath (storeDir: string) =
        ZetaFsPath.combine2 storeDir "bindings"

    let private kindName (k: ZetaFsNamespace.EntityKind) =
        match k with
        | ZetaFsNamespace.EntityKind.File -> "file"
        | ZetaFsNamespace.EntityKind.Directory -> "directory"
        | ZetaFsNamespace.EntityKind.Essence -> "essence"
        | ZetaFsNamespace.EntityKind.Symlink -> "symlink"

    let private parseKind (s: string) : ZetaFsNamespace.EntityKind option =
        if String.Equals(s, "file", StringComparison.Ordinal) then
            Some ZetaFsNamespace.EntityKind.File
        elif String.Equals(s, "directory", StringComparison.Ordinal) then
            Some ZetaFsNamespace.EntityKind.Directory
        elif String.Equals(s, "essence", StringComparison.Ordinal) then
            Some ZetaFsNamespace.EntityKind.Essence
        elif String.Equals(s, "symlink", StringComparison.Ordinal) then
            Some ZetaFsNamespace.EntityKind.Symlink
        else
            None

    let private persistNamespace (storeDir: string) (state: ZetaFsNamespace.State) =
        let fs = FileSystem.Current
        let sb = StringBuilder()

        for kv in state.Entities do
            sb
                .Append("entity ")
                .Append(ZetaFsNamespace.EntityId.format kv.Key)
                .Append(' ')
                .Append(kindName kv.Value)
                .Append('\n')
            |> ignore

        for b in List.rev state.Bindings do
            let nameHex = Convert.ToHexString b.Name
            let asserter =
                match b.Asserter with
                | ZetaFsNamespace.ActorId a -> a

            match b.Target with
            | ZetaFsNamespace.Live target ->
                sb
                    .Append("live ")
                    .Append(ZetaFsNamespace.EntityId.format b.Parent)
                    .Append(' ')
                    .Append(nameHex)
                    .Append(' ')
                    .Append(ZetaFsNamespace.EntityId.format target)
                    .Append(' ')
                    .Append(asserter)
                    .Append(' ')
                    .Append(b.Phase.Stamp.Version.ToString(CultureInfo.InvariantCulture))
                    .Append('\n')
                |> ignore
            | ZetaFsNamespace.Tombstone ->
                sb
                    .Append("tombstone ")
                    .Append(ZetaFsNamespace.EntityId.format b.Parent)
                    .Append(' ')
                    .Append(nameHex)
                    .Append(' ')
                    .Append(asserter)
                    .Append(' ')
                    .Append(b.Phase.Stamp.Version.ToString(CultureInfo.InvariantCulture))
                    .Append('\n')
                |> ignore

        FileSystemIo.writeAllText fs (bindingsPath storeDir) (sb.ToString())

    let private policyPath (storeDir: string) =
        ZetaFsPath.combine2 storeDir "policy"

    let private persistPolicy (storeDir: string) (catalog: ZetaFsPolicy.Catalog) =
        FileSystemIo.writeAllText (FileSystem.Current) (policyPath storeDir) (ZetaFsPolicy.formatCatalog catalog)

    let private loadPolicy (storeDir: string) : ZetaFsPolicy.Catalog =
        let fs = FileSystem.Current
        let path = policyPath storeDir

        if not (fs.Exists path) then
            ZetaFsPolicy.empty
        else
            ZetaFsPolicy.parseCatalog (Encoding.UTF8.GetString(fs.ReadAllBytes path))

    let private symlinksPath (storeDir: string) =
        ZetaFsPath.combine2 storeDir "symlinks"

    let private persistSymlinks (storeDir: string) (targets: Dictionary<System.UInt128, byte[]>) =
        let sb = StringBuilder()

        for kv in targets do
            sb
                .Append(ZetaFsNamespace.EntityId.format (ZetaFsNamespace.EntityId.ofRaw kv.Key))
                .Append(' ')
                .Append(Convert.ToHexString kv.Value)
                .Append('\n')
            |> ignore

        FileSystemIo.writeAllText (FileSystem.Current) (symlinksPath storeDir) (sb.ToString())

    let private loadSymlinks (storeDir: string) : Dictionary<System.UInt128, byte[]> =
        let acc = Dictionary<System.UInt128, byte[]>()
        let fs = FileSystem.Current
        let path = symlinksPath storeDir

        if fs.Exists path then
            let text = Encoding.UTF8.GetString(fs.ReadAllBytes path)
            let lines = text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

            for raw in lines do
                if raw.Length > 0 then
                    let parts = raw.Split(' ')

                    if parts.Length >= 1 then
                        match ZetaFsNamespace.EntityId.tryParse parts.[0] with
                        | None -> ()
                        | Some id ->
                            let bytes =
                                if parts.Length < 2 || parts.[1].Length = 0 then
                                    Array.empty
                                else
                                    try
                                        Convert.FromHexString parts.[1]
                                    with _ ->
                                        Array.empty

                            acc.[id.Raw] <- bytes

        acc

    let private posixPath (storeDir: string) =
        ZetaFsPath.combine2 storeDir "posix-meta"

    let private persistPosix
        (storeDir: string)
        (metas: Dictionary<System.UInt128, ZetaFsPosixMeta.PosixMeta>)
        =
        let sb = StringBuilder()

        for kv in metas do
            sb.Append(ZetaFsPosixMeta.format kv.Value).Append('\n') |> ignore

        FileSystemIo.writeAllText (FileSystem.Current) (posixPath storeDir) (sb.ToString())

    let private loadPosix (storeDir: string) : Dictionary<System.UInt128, ZetaFsPosixMeta.PosixMeta> =
        let acc = Dictionary<System.UInt128, ZetaFsPosixMeta.PosixMeta>()
        let fs = FileSystem.Current
        let path = posixPath storeDir

        if fs.Exists path then
            let text = Encoding.UTF8.GetString(fs.ReadAllBytes path)
            let lines = text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

            for raw in lines do
                if raw.Length > 0 then
                    match ZetaFsPosixMeta.parse raw with
                    | None -> ()
                    | Some meta -> acc.[meta.Entity.Raw] <- meta

        acc

    let private loadNamespace (storeDir: string) (root: ZetaFsNamespace.EntityId) : ZetaFsNamespace.State =
        let fs = FileSystem.Current
        let path = bindingsPath storeDir
        let mutable entities = Map.add root ZetaFsNamespace.EntityKind.Directory Map.empty
        let mutable bindings: ZetaFsNamespace.TagBinding list = []
        let mutable next = Versionstamp.zero

        if fs.Exists path then
            let text = Encoding.UTF8.GetString(fs.ReadAllBytes path)
            let lines =
                text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

            for raw in lines do
                if raw.Length > 0 then
                    let parts = raw.Split(' ')

                    if parts.Length >= 3 && String.Equals(parts.[0], "entity", StringComparison.Ordinal) then
                        match ZetaFsNamespace.EntityId.tryParse parts.[1], parseKind parts.[2] with
                        | Some id, Some kind -> entities <- Map.add id kind entities
                        | _ -> ()
                    elif parts.Length >= 6 && String.Equals(parts.[0], "live", StringComparison.Ordinal) then
                        match
                            ZetaFsNamespace.EntityId.tryParse parts.[1],
                            ZetaFsNamespace.EntityId.tryParse parts.[3],
                            Int64.TryParse(parts.[5], NumberStyles.Integer, CultureInfo.InvariantCulture)
                        with
                        | Some parent, Some target, (true, ver) ->
                            let name = Convert.FromHexString parts.[2]
                            let stamp = Versionstamp.ofInt64 ver
                            if stamp.Version >= next.Version then
                                next <- Versionstamp.tick stamp

                            bindings <-
                                { Name = name
                                  Parent = parent
                                  Target = ZetaFsNamespace.Live target
                                  Phase = { Line = ZetaFsNamespace.PhaseLine; Stamp = stamp }
                                  Asserter = ZetaFsNamespace.ActorId parts.[4] }
                                :: bindings
                        | _ -> ()
                    elif parts.Length >= 5 && String.Equals(parts.[0], "tombstone", StringComparison.Ordinal) then
                        match
                            ZetaFsNamespace.EntityId.tryParse parts.[1],
                            Int64.TryParse(parts.[4], NumberStyles.Integer, CultureInfo.InvariantCulture)
                        with
                        | Some parent, (true, ver) ->
                            let name = Convert.FromHexString parts.[2]
                            let stamp = Versionstamp.ofInt64 ver
                            if stamp.Version >= next.Version then
                                next <- Versionstamp.tick stamp

                            bindings <-
                                { Name = name
                                  Parent = parent
                                  Target = ZetaFsNamespace.Tombstone
                                  Phase = { Line = ZetaFsNamespace.PhaseLine; Stamp = stamp }
                                  Asserter = ZetaFsNamespace.ActorId parts.[3] }
                                :: bindings
                        | _ -> ()

        { Root = root
          Entities = entities
          Bindings = bindings
          Next = next
          Line = ZetaFsNamespace.PhaseLine }

    type internal LastLayout =
        { Prev: ZetaFsJumprope.Prev
          ObjectIds: ContentHash256[] }

    let private layoutPath (storeDir: string) (entity: ZetaFsNamespace.EntityId) =
        ZetaFsPath.combine3 storeDir "layout" (ZetaFsNamespace.EntityId.format entity)

    let private encodeLayout (layout: LastLayout) : string =
        let sb = StringBuilder()
        sb.Append("layout/1\n") |> ignore
        sb.Append("content ").Append(layout.Prev.Content.ToHex()).Append('\n') |> ignore
        sb.Append("span ").Append(layout.Prev.Span.ToString(CultureInfo.InvariantCulture)).Append('\n')
        |> ignore
        sb.Append("chunker ").Append(ZetaFsJumprope.chunkerName layout.Prev.Chunker).Append('\n')
        |> ignore
        sb.Append("objects") |> ignore

        for id in layout.ObjectIds do
            sb.Append(' ').Append(id.ToHex()) |> ignore

        sb.Append('\n') |> ignore

        for i in 0 .. layout.Prev.Leaves.Length - 1 do
            let id, span = layout.Prev.Leaves.[i]
            let start = layout.Prev.Starts.[i]

            sb.Append("leaf ")
                .Append(start.ToString(CultureInfo.InvariantCulture))
                .Append(' ')
                .Append(id.ToHex())
                .Append(' ')
                .Append(span.ToString(CultureInfo.InvariantCulture))
                .Append('\n')
            |> ignore

        sb.ToString()

    let private tryParseHex (s: string) : ContentHash256 option =
        try
            Some(ContentHash256.ofHex s)
        with _ ->
            None

    let private tryParseUInt64 (s: string) : uint64 option =
        match UInt64.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture) with
        | true, n -> Some n
        | _ -> None

    let private tryDecodeLayout (text: string) : LastLayout option =
        let lines =
            text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

        if lines.Length = 0 || not (String.Equals(lines.[0], "layout/1", StringComparison.Ordinal)) then
            None
        else
            let mutable content = None
            let mutable span = None
            let mutable chunker = None
            let mutable objects: ContentHash256[] = [||]
            let leaves = ResizeArray<uint64 * ContentHash256 * uint64>()
            let mutable bad = false
            let mutable i = 1

            while (not bad) && i < lines.Length do
                let line = lines.[i]

                if line.Length > 0 then
                    if line.StartsWith("content ", StringComparison.Ordinal) then
                        content <- tryParseHex (line.Substring(8))
                        if content.IsNone then bad <- true
                    elif line.StartsWith("span ", StringComparison.Ordinal) then
                        span <- tryParseUInt64 (line.Substring(5))
                        if span.IsNone then bad <- true
                    elif line.StartsWith("chunker ", StringComparison.Ordinal) then
                        chunker <- ZetaFsJumprope.parseChunker (line.Substring(8))
                        if chunker.IsNone then bad <- true
                    elif line.StartsWith("objects", StringComparison.Ordinal) then
                        let rest =
                            if line.Length = 7 then ""
                            elif line.Length > 8 && line.[7] = ' ' then line.Substring(8)
                            else
                                bad <- true
                                ""

                        if not bad then
                            if rest.Length = 0 then
                                objects <- [||]
                            else
                                let parts = rest.Split(' ')
                                let acc = ResizeArray<ContentHash256>(parts.Length)
                                let mutable j = 0

                                while (not bad) && j < parts.Length do
                                    match tryParseHex parts.[j] with
                                    | Some id -> acc.Add id
                                    | None -> bad <- true

                                    j <- j + 1

                                if not bad then
                                    objects <- acc.ToArray()
                    elif line.StartsWith("leaf ", StringComparison.Ordinal) then
                        let parts = line.Substring(5).Split(' ')

                        if parts.Length <> 3 then
                            bad <- true
                        else
                            match tryParseUInt64 parts.[0], tryParseHex parts.[1], tryParseUInt64 parts.[2] with
                            | Some start, Some id, Some n -> leaves.Add(start, id, n)
                            | _ -> bad <- true
                    else
                        bad <- true

                i <- i + 1

            match bad, content, span, chunker with
            | false, Some c, Some n, Some ch when leaves.Count > 0 ->
                let starts = Array.zeroCreate leaves.Count
                let leafIds = Array.zeroCreate leaves.Count

                for k in 0 .. leaves.Count - 1 do
                    let start, id, ln = leaves.[k]
                    starts.[k] <- start
                    leafIds.[k] <- (id, ln)

                Some
                    { Prev =
                        { Content = c
                          Span = n
                          Chunker = ch
                          Starts = starts
                          Leaves = leafIds }
                      ObjectIds = objects }
            | _ -> None

    let private tryLoadLayout (storeDir: string) (entity: ZetaFsNamespace.EntityId) : LastLayout option =
        let path = layoutPath storeDir entity
        let fs = FileSystem.Current

        if not (fs.Exists path) then
            None
        else
            tryDecodeLayout (Encoding.UTF8.GetString(fs.ReadAllBytes path))

    let private persistLayoutBestEffort
        (storeDir: string)
        (entity: ZetaFsNamespace.EntityId)
        (layout: LastLayout)
        =
        // Single-leaf is a hint we can rebuild cheaply. Skip the disk write
        // on the 1-byte freeze storm. LastLayout in memory still holds.
        if layout.Prev.Leaves.Length <= 1 || layout.Prev.Starts.Length <> layout.Prev.Leaves.Length then
            ()
        else
            try
                let path = layoutPath storeDir entity
                FileSystem.Current.CreateDirectory(ZetaFsPath.directoryName path)
                FileSystemIo.writeAllText FileSystem.Current path (encodeLayout layout)
            with
            | :? CrashMidWriteException -> ()
            | :? PowerOutageException -> ()
            | :? BadMemoryException -> ()
            | :? IOException -> ()
            | ex when ex.Message.IndexOf("BUGGIFY", StringComparison.Ordinal) >= 0 -> ()

    [<Sealed>]
    type Volume
        (
            storeDir: string,
            mutbuf: ZetaFsMutbuf.Catalog,
            observer: IDurabilityObserver option,
            session: ZetaFsCrypto.Session option,
            config: FerryThrottlerConfig,
            manual: bool,
            blockIo: FreezeBlockIo option,
            objectCas: BlockCas option,
            clock: ISimulationEnvironment
        ) =
        let gate = obj ()
        let commits = Dictionary<ContentHash256, FreezeResult>()
        let leaves = Dictionary<ContentHash256, ContentHash256[]>()
        let mutable nextLsn = 1L
        let freezeBytesSinceReclaim = ref 0UL
        let known = Dictionary<ContentHash256, uint64>()
        let livePins = HashSet<ContentHash256>()
        let objectSets = Dictionary<ContentHash256, ContentHash256[]>()
        let catalogGen = ref 0L
        let lastLayout = Dictionary<ZetaFsNamespace.EntityId, LastLayout>()
        let history = ref (loadCatalog storeDir known livePins freezeBytesSinceReclaim objectSets catalogGen)
        let root =
            let path = ZetaFsPath.combine2 storeDir ZetaFsNamespace.RootFileName
            let fs = FileSystem.Current

            if not (fs.Exists path) then
                None
            else
                ZetaFsNamespace.EntityId.tryParse (Encoding.UTF8.GetString(fs.ReadAllBytes path))
        let nsState =
            ref (
                match root with
                | None -> None
                | Some rootId -> Some(loadNamespace storeDir rootId)
            )
        let policyState = ref (loadPolicy storeDir)
        let symlinkTargets = loadSymlinks storeDir
        let posixMeta = loadPosix storeDir
        let log =
            new FreezeLog(
                storeDir,
                config,
                manual,
                blockIo,
                objectCas,
                known,
                livePins,
                history,
                freezeBytesSinceReclaim,
                objectSets,
                catalogGen
            )
        let reclaim = new ReclaimFerry(storeDir, config, manual, objectCas)
        do
            // Reopen meter comes from the catalog. Leftover orphan sizes
            // still enqueue if the catalog has orphans. Does not wait for
            // the next freeze.
            let orphans = catalogOrphans storeDir known livePins objectCas

            if orphans.Length > 0 then
                let mutable budget = 0UL
                let mutable i = 0

                while i < orphans.Length do
                    budget <- budget + orphans.[i].Size
                    i <- i + 1

                if budget > 0UL then
                    let reply =
                        TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously)

                    let item =
                        { Roots = ZetaFsReclaim.emptyRoots
                          Objects = orphans
                          FreezeBytes = budget
                          Reply = reply }

                    reclaim.SubmitAsync(item, CancellationToken.None) |> ignore

        member _.StoreDir = storeDir
        member _.Mutbuf = mutbuf
        member _.Observer = observer
        member _.Session = session
        member internal _.Gate = gate
        member internal _.Commits = commits
        member internal _.Leaves = leaves
        member internal _.NextLsn
            with get () = nextLsn
            and set v = nextLsn <- v
        member internal _.Log = log
        member internal _.Reclaim = reclaim
        member internal _.FreezeBytesSinceReclaim
            with get () = !freezeBytesSinceReclaim
            and set v = freezeBytesSinceReclaim := v
        member internal _.KnownObjects = known
        member internal _.LivePins = livePins
        member internal _.ObjectSets = objectSets
        member internal _.CatalogGen = catalogGen
        member internal _.LastLayout = lastLayout
        member _.History
            with get () = !history
            and set v =
                history := v
                persistCatalogBestEffort storeDir known livePins v !freezeBytesSinceReclaim objectSets catalogGen
        member _.Root = root
        member internal _.Ns = nsState
        member internal _.Policy = policyState
        member internal _.Symlinks = symlinkTargets
        member internal _.Posix = posixMeta
        member _.Clock = clock

        interface IDisposable with
            member _.Dispose() =
                (reclaim :> IDisposable).Dispose()
                (log :> IDisposable).Dispose()

    let private applyPolicyCatalog (volume: Volume) (catalog: ZetaFsPolicy.Catalog) =
        persistPolicy volume.StoreDir catalog
        volume.Policy := catalog

    let private stampPosix
        (volume: Volume)
        (id: ZetaFsNamespace.EntityId)
        (kind: ZetaFsNamespace.EntityKind)
        =
        let now = ZetaFsPosixMeta.unixNs volume.Clock
        volume.Posix.[id.Raw] <- ZetaFsPosixMeta.born id kind now
        persistPosix volume.StoreDir volume.Posix

    let private logDir (v: Volume) = ZetaFsPath.combine2 v.StoreDir "log"
    let private objectsDir (v: Volume) = ZetaFsPath.combine2 v.StoreDir "objects"

    let errorName (e: FreezeError) : string =
        match e with
        | FreezeError.Fsync _ -> "Fsync"
        | FreezeError.WindowsDurableNotClaimed -> "WindowsDurableNotClaimed"
        | FreezeError.MissingLeaves _ -> "MissingLeaves"
        | FreezeError.Observer _ -> "Observer"
        | FreezeError.Malformed _ -> "Malformed"
        | FreezeError.Crypto e -> ZetaFsCrypto.errorName e

    let private defaultConfig =
        { FerryThrottlerConfig.deterministic with MaxBatchSize = 64 }

    let private tryHash (v: DynamicValue) : ContentHash256 option =
        match v with
        | DynamicValue.Bytes b when not b.IsDefault && b.Length = 32 ->
            let raw = Array.zeroCreate 32
            b.AsSpan().CopyTo(Span<byte> raw)
            Some { Raw = raw }
        | _ -> None

    let private tryInt (v: DynamicValue) : int64 option =
        match v with
        | DynamicValue.Int x -> Some x
        | _ -> None

    let private tryString (v: DynamicValue) : string option =
        match v with
        | DynamicValue.String s -> Some s
        | _ -> None

    let private tryFind (pairs: (string * DynamicValue) list) (key: string) : DynamicValue option =
        pairs
        |> List.tryFind (fun (k, _) -> k.Equals(key, StringComparison.Ordinal))
        |> Option.map snd

    let private classFromName (s: string) : DurabilityClass option =
        match s with
        | "buffered" -> Some DurabilityClass.Buffered
        | "journaled" -> Some DurabilityClass.Journaled
        | "durable" -> Some DurabilityClass.Durable
        | _ -> None

    type private PlainRec =
        | Intent of entity: ZetaFsNamespace.EntityId * content: ContentHash256 * leaves: ContentHash256[] * cls: DurabilityClass * lsn: int64
        | Commit of intentLsn: int64 * content: ContentHash256 * lsn: int64

    let private decodePlain (payload: byte[]) : PlainRec option =
        match DynamicValue.fromCanonicalCbor payload with
        | Error _ -> None
        | Ok(DynamicValue.Object pairs) ->
            match tryFind pairs "t" |> Option.bind tryString with
            | Some "freeze-intent/1" ->
                let entity =
                    tryFind pairs "entity"
                    |> Option.bind tryString
                    |> Option.bind ZetaFsNamespace.EntityId.tryParse
                let content = tryFind pairs "content" |> Option.bind tryHash
                let cls = tryFind pairs "class" |> Option.bind tryString |> Option.bind classFromName
                let lsn = tryFind pairs "lsn" |> Option.bind tryInt
                let leaves =
                    match tryFind pairs "leaves" with
                    | Some(DynamicValue.Array xs) ->
                        let acc = ResizeArray<ContentHash256>()
                        let mutable ok = true

                        for x in xs do
                            match tryHash x with
                            | Some h when ok -> acc.Add h
                            | _ -> ok <- false

                        if ok then Some(acc.ToArray()) else None
                    | _ -> None

                match entity, content, leaves, cls, lsn with
                | Some e, Some c, Some ls, Some k, Some n -> Some(Intent(e, c, ls, k, n))
                | _ -> None
            | Some "freeze-commit/1" ->
                match
                    tryFind pairs "intentLsn" |> Option.bind tryInt,
                    tryFind pairs "content" |> Option.bind tryHash,
                    tryFind pairs "lsn" |> Option.bind tryInt
                with
                | Some i, Some c, Some n -> Some(Commit(i, c, n))
                | _ -> None
            | _ -> None
        | Ok _ -> None

    let private objectsFromIntent (content: ContentHash256) (leaves: ContentHash256[]) : ContentHash256[] =
        let acc = ResizeArray<ContentHash256>(leaves.Length + 1)
        acc.Add content
        let mutable i = 0

        while i < leaves.Length do
            if not (leaves.[i].Equals content) then
                acc.Add leaves.[i]

            i <- i + 1

        acc.ToArray()

    let private applyDecoded
        (volume: Volume)
        (pending: byref<PlainRec option>)
        (pendingStart: byref<int64>)
        (maxLsn: byref<int64>)
        (recordStart: int64)
        (atTail: bool)
        (truncate: int64 -> unit)
        (decoded: PlainRec option)
        : bool =
        match decoded with
        | None ->
            if atTail then
                truncate recordStart
                false
            else
                invalidOp (sprintf "ZetaFsFreeze: malformed frame at byte %d" recordStart)
        | Some(Intent _ as intentRec) ->
            match pending with
            | Some _ ->
                invalidOp (sprintf "ZetaFsFreeze: intent without commit at byte %d" pendingStart)
            | None ->
                pending <- Some intentRec
                pendingStart <- recordStart
                true
        | Some(Commit(intentLsn, content, commitLsn)) ->
            match pending with
            | Some(Intent(entity, intentContent, leaves, cls, intentLsn2)) when
                intentLsn = intentLsn2 && content.Equals intentContent
                ->
                pending <- None
                pendingStart <- -1L

                if intentLsn > maxLsn then
                    maxLsn <- intentLsn

                if commitLsn > maxLsn then
                    maxLsn <- commitLsn

                volume.Commits.[content] <-
                    { Entity = entity
                      Content = content
                      Span = 0UL
                      Class = cls
                      Generation = 0UL
                      IntentLsn = intentLsn
                      CommitLsn = commitLsn }

                volume.Leaves.[content] <- leaves

                match volume.ObjectSets.TryGetValue content with
                | true, existing when existing.Length > 0 -> ()
                | _ -> volume.ObjectSets.[content] <- objectsFromIntent content leaves

                true
            | _ ->
                if atTail then
                    truncate recordStart
                    false
                else
                    invalidOp (sprintf "ZetaFsFreeze: commit without matching intent at byte %d" recordStart)

    /// Restore Commits/Leaves from intact plain frames. Trailing torn frame,
    /// intent-without-commit, or a CRC mismatch (tail or mid) is truncated
    /// from that frame; the verified prefix is kept.
    let private replayPlainFromStream (stream: Stream) (volume: Volume) =
        use br = new BinaryReader(stream, Text.Encoding.UTF8, leaveOpen = true)
        let mutable scanning = true
        let mutable pendingStart = -1L
        let mutable pending: PlainRec option = None
        let mutable maxLsn = 0L

        while scanning do
            let recordStart = stream.Position

            if stream.Length - stream.Position = 0L then
                scanning <- false
            elif stream.Length - stream.Position < 8L then
                stream.SetLength recordStart
                scanning <- false
            else
                let len = br.ReadInt32()
                let expectedCrc = br.ReadUInt32()

                if len < 0 then
                    invalidOp (sprintf "ZetaFsFreeze: negative frame length %d at byte %d" len recordStart)
                elif stream.Length - stream.Position < int64 len then
                    stream.SetLength recordStart
                    scanning <- false
                else
                    let payload = br.ReadBytes len
                    let actualCrc = HardwareCrc.Crc32C(ReadOnlySpan payload)

                    if actualCrc <> expectedCrc then
                        stream.SetLength recordStart
                        scanning <- false
                    else
                        let atTail = stream.Position = stream.Length
                        scanning <-
                            applyDecoded
                                volume
                                &pending
                                &pendingStart
                                &maxLsn
                                recordStart
                                atTail
                                stream.SetLength
                                (decodePlain payload)

        match pending with
        | Some _ when pendingStart >= 0L -> stream.SetLength pendingStart
        | _ -> ()

        if maxLsn >= volume.NextLsn then
            volume.NextLsn <- maxLsn + 1L

    let private replayPlainLog (fs: IFileSystem) (volume: Volume) =
        match volume.Log.BlockIo with
        | Some door ->
            let device = door.Device

            match BlockSuper.tryReadLog device with
            | Some n -> door.LogicalBytes <- n
            | None -> ()

            if door.LogicalBytes > 0L then
                let bytes = BlockLog.readAt device (BlockLog.origin device) door.LogicalBytes
                use stream = new MemoryStream(bytes, 0, bytes.Length, writable = true, publiclyVisible = true)
                replayPlainFromStream stream volume
                door.LogicalBytes <- stream.Length
                BlockSuper.writeLog device door.LogicalBytes
        | None ->
            let logPath = volume.Log.LogPath

            if fs.Exists logPath then
                use stream = fs.OpenFile(logPath, FileMode.Open, FileAccess.ReadWrite, FileShare.Read)
                replayPlainFromStream stream volume

    /// Sealed frames: [len:i32][lsn:i64][inner]. LSN is public so openLog can
    /// rebuild the nonce. Wrong-key MAC on the first frame recovers nothing
    /// and does not truncate.
    let private replaySealedFromStream (stream: Stream) (volume: Volume) (session: ZetaFsCrypto.Session) =
        use br = new BinaryReader(stream, Text.Encoding.UTF8, leaveOpen = true)
        let mutable scanning = true
        let mutable pendingStart = -1L
        let mutable pending: PlainRec option = None
        let mutable maxLsn = 0L

        while scanning do
            let recordStart = stream.Position

            if stream.Length - stream.Position = 0L then
                scanning <- false
            elif stream.Length - stream.Position < 12L then
                stream.SetLength recordStart
                scanning <- false
            else
                let len = br.ReadInt32()
                let lsn = br.ReadInt64()

                if len < 0 then
                    invalidOp (sprintf "ZetaFsFreeze: negative sealed length %d at byte %d" len recordStart)
                elif stream.Length - stream.Position < int64 len then
                    stream.SetLength recordStart
                    scanning <- false
                else
                    let inner = br.ReadBytes len
                    let atTail = stream.Position = stream.Length

                    match ZetaFsCrypto.openLog session lsn inner with
                    | Error ZetaFsCrypto.CryptoError.MacMismatch
                    | Error ZetaFsCrypto.CryptoError.GcmAuthFailed when pending.IsNone && recordStart = 0L ->
                        scanning <- false
                    | Error ZetaFsCrypto.CryptoError.MacMismatch
                    | Error ZetaFsCrypto.CryptoError.GcmAuthFailed ->
                        stream.SetLength recordStart
                        scanning <- false
                    | Error e ->
                        invalidOp (sprintf "ZetaFsFreeze: sealed frame at byte %d: %s" recordStart (ZetaFsCrypto.errorName e))
                    | Ok plaintext ->
                        scanning <-
                            applyDecoded
                                volume
                                &pending
                                &pendingStart
                                &maxLsn
                                recordStart
                                atTail
                                stream.SetLength
                                (decodePlain plaintext)

        match pending with
        | Some _ when pendingStart >= 0L -> stream.SetLength pendingStart
        | _ -> ()

        if maxLsn >= volume.NextLsn then
            volume.NextLsn <- maxLsn + 1L

    let private replaySealedLog (fs: IFileSystem) (volume: Volume) (session: ZetaFsCrypto.Session) =
        match volume.Log.BlockIo with
        | Some door ->
            let device = door.Device

            match BlockSuper.tryReadLog device with
            | Some n -> door.LogicalBytes <- n
            | None -> ()

            if door.LogicalBytes > 0L then
                let bytes = BlockLog.readAt device (BlockLog.origin device) door.LogicalBytes
                use stream = new MemoryStream(bytes, 0, bytes.Length, writable = true, publiclyVisible = true)
                replaySealedFromStream stream volume session
                door.LogicalBytes <- stream.Length
                BlockSuper.writeLog device door.LogicalBytes
        | None ->
            let logPath = volume.Log.LogPath

            if fs.Exists logPath then
                use stream = fs.OpenFile(logPath, FileMode.Open, FileAccess.ReadWrite, FileShare.Read)
                replaySealedFromStream stream volume session

    let createFull
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session option)
        (config: FerryThrottlerConfig)
        (manual: bool)
        (blockIo: FreezeBlockIo option)
        (objectCas: BlockCas option)
        (clock: ISimulationEnvironment)
        : Volume =
        let fs = FileSystem.Current
        fs.CreateDirectory storeDir
        fs.CreateDirectory (ZetaFsPath.combine2 storeDir "log")
        fs.CreateDirectory (ZetaFsPath.combine2 storeDir "objects")
        let formatPath = ZetaFsPath.combine2 storeDir ZetaFsFormat.FileName
        let headPath = ZetaFsPath.combine2 storeDir "HEAD"

        if not (fs.Exists formatPath) && not (fs.Exists headPath) then
            ZetaFsFormat.write fs storeDir ZetaFsFormat.bindingsDefault
            let rootPath = ZetaFsPath.combine2 storeDir ZetaFsNamespace.RootFileName

            if not (fs.Exists rootPath) then
                let ns =
                    ZetaFsNamespace.create (
                        ZetaFsNamespace.Entropy(fun () -> SystemEnvironment.Default.NextInt64())
                    )
                FileSystemIo.writeAllText fs rootPath (ZetaFsNamespace.EntityId.format ns.Root)

        let volume =
            new Volume(storeDir, mutbuf, observer, session, config, manual, blockIo, objectCas, clock)

        try
            lock volume.Gate (fun () ->
                match volume.Root with
                | Some root when not (volume.Posix.ContainsKey root.Raw) ->
                    stampPosix volume root ZetaFsNamespace.EntityKind.Directory
                | _ -> ()

                match session with
                | None -> replayPlainLog fs volume
                | Some s -> replaySealedLog fs volume s)

            volume
        with ex ->
            (volume :> IDisposable).Dispose()
            raise ex

    let private hostFileLog
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session option)
        (manual: bool)
        : Volume =
        let fs = FileSystem.Current
        fs.CreateDirectory(ZetaFsPath.combine2 storeDir "log")
        let path = ZetaFsPath.combine3 storeDir "log" "freeze"
        let io = FileSystemBlockIo(fs, path, 4096)
        createFull storeDir mutbuf observer session defaultConfig manual (Some(HostFile io)) None SystemEnvironment.Default

    let private hostFileStore
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session option)
        (manual: bool)
        : Volume =
        let fs = FileSystem.Current
        fs.CreateDirectory(ZetaFsPath.combine2 storeDir "log")
        let logIo = FileSystemBlockIo(fs, ZetaFsPath.combine3 storeDir "log" "freeze", 4096)
        let casIo = FileSystemBlockIo(fs, ZetaFsPath.combine2 storeDir "cas", 4096)
        let cas = BlockCas(casIo)
        createFull storeDir mutbuf observer session defaultConfig manual (Some(HostFile logIo)) (Some cas) SystemEnvironment.Default

    let createWith
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session option)
        : Volume =
        let volume = hostFileStore storeDir mutbuf observer session false
        volume.History <- ZetaFsPolicy.rollingDefault

        lock volume.Gate (fun () ->
            match ZetaFsPolicy.volumeDefault !volume.Policy ZetaFsPolicy.HistoryTag with
            | Some _ -> ()
            | None ->
                applyPolicyCatalog
                    volume
                    (ZetaFsPolicy.assertBinding
                        !volume.Policy
                        { Subject = ZetaFsPolicy.VolumeDefault
                          Kind = ZetaFsPolicy.History ZetaFsPolicy.rollingDefault
                          Phase =
                            ({ Line = ZetaFsNamespace.PhaseLine
                               Stamp = Versionstamp.zero }
                            : ZetaFsNamespace.FsPhase)
                          Asserter = ZetaFsNamespace.ActorId "freeze" }))

        volume

    /// Unencrypted control (FORMAT enc=off). The default first-product profile.
    /// Journaled log and CAS objects ride `FileSystemBlockIo`.
    /// History is `rollingDefault` (N=32). DST `createManual*` stays KeepAll.
    let create (storeDir: string) (mutbuf: ZetaFsMutbuf.Catalog) (observer: IDurabilityObserver option) : Volume =
        createWith storeDir mutbuf observer None

    /// DST: raw frame stream on `IFileSystem` (no superblock). Tests that
    /// poke log bytes or arm whole-file Dispose still use this.
    let createManualStream
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        : Volume =
        createFull storeDir mutbuf observer None defaultConfig true None None SystemEnvironment.Default

    let createManualStreamWith
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (clock: ISimulationEnvironment)
        : Volume =
        createFull storeDir mutbuf observer None defaultConfig true None None clock

    let createManualWithStream
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session option)
        : Volume =
        createFull storeDir mutbuf observer session defaultConfig true None None SystemEnvironment.Default

    /// DST / test: no background ferry. Caller drives with `pumpLog`.
    /// Journaled log and CAS objects ride `FileSystemBlockIo`.
    let createManual
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        : Volume =
        hostFileStore storeDir mutbuf observer None true

    let createManualWith
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session option)
        : Volume =
        hostFileStore storeDir mutbuf observer session true

    /// DST: Journaled log frames go through `IBlockIo` (RMW on the tail block).
    /// Objects still speak files unless `createManualWithBlockStore` is used.
    /// LBA 0 and 1 are checksummed `ZFL2` copies; payload starts at LBA 2.
    let createManualWithBlocks
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (blocks: SimulatedBlockIo)
        : Volume =
        createFull storeDir mutbuf observer None defaultConfig true (Some(Simulated blocks)) None SystemEnvironment.Default

    /// DST: sealed Journaled frames through `IBlockIo`. Same dual-slot
    /// superblock as `createManualWithBlocks`. Wrong-key MAC on the first
    /// frame recovers nothing and does not truncate.
    let createManualWithSealedBlocks
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session)
        (blocks: SimulatedBlockIo)
        : Volume =
        createFull storeDir mutbuf observer (Some session) defaultConfig true (Some(Simulated blocks)) None SystemEnvironment.Default

    /// DST: log on one simulated disk, CAS objects on another. Two devices
    /// so a crash arm on objects cannot tear the log. LBA 0 and 1 on each
    /// disk are checksummed superblock copies (`ZFL2` / `ZCA2`).
    let createManualWithBlockStore
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (logBlocks: SimulatedBlockIo)
        (objectCas: BlockCas)
        : Volume =
        createFull storeDir mutbuf observer None defaultConfig true (Some(Simulated logBlocks)) (Some objectCas) SystemEnvironment.Default

    /// DST inject: log is an already-populated `FileSystemBlockIo` polyfill
    /// (e.g. `SimulatedBlockIo.ReplayTo`). CAS is a `BlockCas` on a second
    /// polyfill. Native two-namespace is not claimed.
    let createManualWithHostFileStore
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (logFile: FileSystemBlockIo)
        (objectCas: BlockCas)
        : Volume =
        createFull storeDir mutbuf observer None defaultConfig true (Some(HostFile logFile)) (Some objectCas) SystemEnvironment.Default

    /// DST: sealed Journaled log on one disk, CAS objects on another.
    let createManualWithSealedBlockStore
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session)
        (logBlocks: SimulatedBlockIo)
        (objectCas: BlockCas)
        : Volume =
        createFull storeDir mutbuf observer (Some session) defaultConfig true (Some(Simulated logBlocks)) (Some objectCas) SystemEnvironment.Default

    /// DST: journaled freeze log through the `FileSystemBlockIo` polyfill
    /// (one host file, LBA offsets). Same door as `createManual`.
    let createManualWithFileLog
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        : Volume =
        hostFileLog storeDir mutbuf observer None true

    /// DST: sealed journaled freeze log through the `FileSystemBlockIo`
    /// polyfill. Wrong-key MAC on the first frame recovers nothing and
    /// does not truncate. Same door as `createManualWith`.
    let createManualWithSealedFileLog
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session)
        : Volume =
        hostFileLog storeDir mutbuf observer (Some session) true

    /// DST: journaled log on one host-file polyfill, CAS objects on another.
    /// Same door as `createManual`.
    let createManualWithFileBlockStore
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        : Volume =
        hostFileStore storeDir mutbuf observer None true

    /// DST: sealed journaled log on one host-file polyfill, CAS objects on
    /// another. Same door as `createManualWith`.
    let createManualWithSealedFileBlockStore
        (storeDir: string)
        (mutbuf: ZetaFsMutbuf.Catalog)
        (observer: IDurabilityObserver option)
        (session: ZetaFsCrypto.Session)
        : Volume =
        hostFileStore storeDir mutbuf observer (Some session) true

    let dispose (volume: Volume) = (volume :> IDisposable).Dispose()

    let private persistBind
        (volume: Volume)
        (state: ZetaFsNamespace.State)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (target: ZetaFsNamespace.EntityId)
        : Result<ZetaFsNamespace.State, ZetaFsNamespace.BindError> =
        match ZetaFsNamespace.bind state parent name target (ZetaFsNamespace.ActorId "freeze") with
        | Error e -> Error e
        | Ok next ->
            persistNamespace volume.StoreDir next
            volume.Ns := Some next
            let phase =
                match next.Bindings with
                | b :: _ -> b.Phase
                | [] ->
                    { Line = ZetaFsNamespace.PhaseLine
                      Stamp = Versionstamp.zero }

            applyPolicyCatalog
                volume
                (ZetaFsPolicy.copyAtFirstBind
                    !volume.Policy
                    target
                    parent
                    name
                    phase
                    (ZetaFsNamespace.ActorId "freeze"))
            Ok next

    /// Mint a File under `parent` and persist the TagBinding. First bind
    /// copies nearest ByPrefix or VolumeDefault onto ByEntity.
    let bindFileUnder
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        : Result<ZetaFsNamespace.EntityId, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity parent)
            | Some state ->
                let entropy =
                    ZetaFsNamespace.Entropy(fun () -> SystemEnvironment.Default.NextInt64())
                let id, minted = ZetaFsNamespace.mint state ZetaFsNamespace.EntityKind.File entropy

                match persistBind volume minted parent name id with
                | Error e -> Error e
                | Ok _ ->
                    stampPosix volume id ZetaFsNamespace.EntityKind.File
                    Ok id)

    /// Mint a File under ROOT. No ROOT => UnknownEntity.
    let bindFile (volume: Volume) (name: byte[]) : Result<ZetaFsNamespace.EntityId, ZetaFsNamespace.BindError> =
        match volume.Root with
        | Some root -> bindFileUnder volume root name
        | None -> Error(ZetaFsNamespace.UnknownEntity { Raw = System.UInt128.Zero })

    /// Mint a Directory under `parent` and persist the TagBinding.
    let bindDirectory
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        : Result<ZetaFsNamespace.EntityId, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity parent)
            | Some state ->
                let entropy =
                    ZetaFsNamespace.Entropy(fun () -> SystemEnvironment.Default.NextInt64())
                let id, minted = ZetaFsNamespace.mint state ZetaFsNamespace.EntityKind.Directory entropy

                match persistBind volume minted parent name id with
                | Error e -> Error e
                | Ok _ ->
                    stampPosix volume id ZetaFsNamespace.EntityKind.Directory
                    Ok id)

    /// Mint a Symlink under `parent`. Body is UTF-8 target bytes, not a
    /// resolved path. Reopen `readSymlink` must return the same bytes.
    let bindSymlink
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (target: byte[])
        : Result<ZetaFsNamespace.EntityId, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity parent)
            | Some state ->
                let entropy =
                    ZetaFsNamespace.Entropy(fun () -> SystemEnvironment.Default.NextInt64())
                let id, minted = ZetaFsNamespace.mint state ZetaFsNamespace.EntityKind.Symlink entropy

                match persistBind volume minted parent name id with
                | Error e -> Error e
                | Ok _ ->
                    volume.Symlinks.[id.Raw] <- target
                    persistSymlinks volume.StoreDir volume.Symlinks
                    stampPosix volume id ZetaFsNamespace.EntityKind.Symlink
                    Ok id)

    let readSymlink (volume: Volume) (id: ZetaFsNamespace.EntityId) : byte[] option =
        lock volume.Gate (fun () ->
            match volume.Symlinks.TryGetValue id.Raw with
            | true, bytes -> Some bytes
            | false, _ -> None)

    /// Bind an existing entity under `parent`. Refuses a Directory cycle.
    let bindName
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (target: ZetaFsNamespace.EntityId)
        : Result<unit, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity parent)
            | Some state ->
                match persistBind volume state parent name target with
                | Error e -> Error e
                | Ok _ -> Ok())

    /// POSIX typed replace. Eisdir / Enotdir / Enotempty do not tombstone.
    let rename
        (volume: Volume)
        (srcParent: ZetaFsNamespace.EntityId)
        (srcName: byte[])
        (dstParent: ZetaFsNamespace.EntityId)
        (dstName: byte[])
        : Result<unit, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity srcParent)
            | Some state ->
                match
                    ZetaFsNamespace.rename
                        state
                        srcParent
                        srcName
                        dstParent
                        dstName
                        (ZetaFsNamespace.ActorId "freeze")
                with
                | Error e -> Error e
                | Ok next ->
                    persistNamespace volume.StoreDir next
                    volume.Ns := Some next
                    Ok())

    /// POSIX unlink: append Tombstone under `parent`. Does not retract Live.
    let unlinkUnder
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        : Result<unit, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity parent)
            | Some state ->
                match ZetaFsNamespace.unlink state parent name (ZetaFsNamespace.ActorId "freeze") with
                | Error e -> Error e
                | Ok next ->
                    persistNamespace volume.StoreDir next
                    volume.Ns := Some next
                    Ok())

    /// POSIX unlink under ROOT.
    let unlinkFile (volume: Volume) (name: byte[]) : Result<unit, ZetaFsNamespace.BindError> =
        match volume.Root with
        | Some root -> unlinkUnder volume root name
        | None -> Error(ZetaFsNamespace.UnknownEntity { Raw = System.UInt128.Zero })

    let liveResolve (volume: Volume) (name: byte[]) : ZetaFsNamespace.EntityId option =
        lock volume.Gate (fun () ->
            match volume.Root, !volume.Ns with
            | Some root, Some state -> ZetaFsNamespace.liveResolve root name state.Bindings
            | _ -> None)

    let liveResolveUnder
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        : ZetaFsNamespace.EntityId option =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | Some state -> ZetaFsNamespace.liveResolve parent name state.Bindings
            | None -> None)

    /// Live names under `dir`. No `.` / `..`.
    let readdir
        (volume: Volume)
        (dir: ZetaFsNamespace.EntityId)
        : Result<(byte[] * ZetaFsNamespace.EntityId)[], ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity dir)
            | Some state -> ZetaFsNamespace.readdir state dir)

    let getattr
        (volume: Volume)
        (id: ZetaFsNamespace.EntityId)
        : Result<ZetaFsPosixMeta.PosixStat, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity id)
            | Some state ->
                match Map.tryFind id state.Entities with
                | None -> Error(ZetaFsNamespace.UnknownEntity id)
                | Some kind ->
                    let meta =
                        match volume.Posix.TryGetValue id.Raw with
                        | true, m -> m
                        | false, _ ->
                            ZetaFsPosixMeta.born id kind (ZetaFsPosixMeta.unixNs volume.Clock)

                    let size =
                        match ZetaFsMutbuf.tryLiveLength volume.Mutbuf id with
                        | Some n -> n
                        | None -> meta.Size

                    Ok
                        { Meta = meta
                          Nlink = ZetaFsNamespace.liveNlink state id
                          Size = size })

    let setattr
        (volume: Volume)
        (id: ZetaFsNamespace.EntityId)
        (patch: ZetaFsPosixMeta.PosixSetattr)
        : Result<unit, ZetaFsNamespace.BindError> =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | None -> Error(ZetaFsNamespace.UnknownEntity id)
            | Some state ->
                match Map.tryFind id state.Entities with
                | None -> Error(ZetaFsNamespace.UnknownEntity id)
                | Some kind ->
                    let now = ZetaFsPosixMeta.unixNs volume.Clock
                    let current =
                        match volume.Posix.TryGetValue id.Raw with
                        | true, m -> m
                        | false, _ -> ZetaFsPosixMeta.born id kind now

                    volume.Posix.[id.Raw] <- ZetaFsPosixMeta.apply current patch now
                    persistPosix volume.StoreDir volume.Posix
                    Ok())

    /// Title at `at` (inclusive). Tombstone does not erase prior Live.
    let resolveAt
        (volume: Volume)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (at: Versionstamp)
        : ZetaFsNamespace.BindingTarget option =
        lock volume.Gate (fun () ->
            match !volume.Ns with
            | Some state -> ZetaFsNamespace.resolveAt parent name at state.Bindings
            | None -> None)

    /// Persist a policy fact (ByPrefix / VolumeDefault / ByEntity). Later
    /// prefix edits do not rewrite an existing ByEntity hub.
    let assertPolicyBinding (volume: Volume) (binding: ZetaFsPolicy.Binding) : unit =
        lock volume.Gate (fun () -> applyPolicyCatalog volume (ZetaFsPolicy.assertBinding !volume.Policy binding))

    /// SELECT stored ByEntity history. None until first bind copied it.
    let effectiveHistory (volume: Volume) (id: ZetaFsNamespace.EntityId) : ZetaFsPolicy.HistoryPolicy option =
        lock volume.Gate (fun () -> ZetaFsPolicy.effectiveHistory !volume.Policy id)

    /// Journal for a crash-mid-sweep. Owned by the volume, not invented by
    /// the caller. `reclaimSweep` is the only apply door that uses it.
    let sweepJournalPath (volume: Volume) = journalPath volume.StoreDir

    /// Journaled reclaim through the freeze volume. Still `toy`: this is
    /// the volume door, not a freeze-boat tick.
    let reclaimSweep
        (volume: Volume)
        (fs: IFileSystem)
        (paths: (ContentHash256 * string)[])
        (budget: ZetaFsReclaim.Budget)
        : int =
        ZetaFsReclaim.applyWithJournal fs (sweepJournalPath volume) paths budget

    /// One reclaim tick: pacer from freeze bytes (not wall-clock), propose
    /// unpinned objects, sweep through the volume journal. The ferry door is
    /// `reclaimAsync` + `pumpReclaim`. Auto-tick after freeze and on reopen
    /// when the orphan catalog is nonempty. Recovery still `toy`.
    let reclaimTick
        (volume: Volume)
        (fs: IFileSystem)
        (roots: ZetaFsReclaim.Roots)
        (objects: ZetaFsReclaim.Object[])
        (freezeBytesSinceLastTick: uint64)
        : int =
        tickStore volume.StoreDir fs volume.Log.ObjectCas roots objects freezeBytesSinceLastTick

    /// Enqueue one reclaim tick on the DoP=1 reclaim ferry. Manual volumes
    /// need `pumpReclaim` before the task completes.
    let reclaimAsync
        (volume: Volume)
        (roots: ZetaFsReclaim.Roots)
        (objects: ZetaFsReclaim.Object[])
        (freezeBytesSinceLastTick: uint64)
        (ct: CancellationToken)
        : Task<int> =
        let reply =
            TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously)

        let item =
            { Roots = roots
              Objects = objects
              FreezeBytes = freezeBytesSinceLastTick
              Reply = reply }

        let write = volume.Reclaim.SubmitAsync(item, ct)

        task {
            try
                if not write.IsCompletedSuccessfully then
                    do! write.AsTask().ConfigureAwait(false)

                return! reply.Task.WaitAsync(ct).ConfigureAwait(false)
            with
            | :? OperationCanceledException as ex ->
                reply.TrySetCanceled ct |> ignore
                return raise ex
        }

    let pumpReclaim (volume: Volume) (ct: CancellationToken) : Task =
        volume.Reclaim.PumpToIdleAsync(ct)

    let reclaimBoatCount (volume: Volume) = volume.Reclaim.Boats

    let freezeBytesSinceReclaim (volume: Volume) = volume.FreezeBytesSinceReclaim

    let knownCount (volume: Volume) =
        lock volume.Gate (fun () -> volume.KnownObjects.Count)

    let hasPrev (volume: Volume) (entity: ZetaFsNamespace.EntityId) : bool =
        lock volume.Gate (fun () ->
            volume.LastLayout.ContainsKey entity
            || FileSystem.Current.Exists(layoutPath volume.StoreDir entity))

    let private objectsNotYetKnown (volume: Volume) (cas: ZetaFsJumprope.Cas) =
        lock volume.Gate (fun () ->
            let acc = ResizeArray<struct (ContentHash256 * byte[])>(cas.Objects.Count)

            for kv in cas.Objects do
                if not (volume.KnownObjects.ContainsKey kv.Key) then
                    acc.Add(struct (kv.Key, kv.Value))

            acc.ToArray())

    /// DST / crash leftover: record a CAS object the volume wrote. Full
    /// ContentHash256, not the 128-bit path. Disk scan cannot reconstruct this.
    let noteKnownObject (volume: Volume) (id: ContentHash256) (size: uint64) =
        lock volume.Gate (fun () ->
            volume.KnownObjects.[id] <- size
            persistCatalogBestEffort volume.StoreDir volume.KnownObjects volume.LivePins volume.History volume.FreezeBytesSinceReclaim volume.ObjectSets volume.CatalogGen)

    /// Objects the volume wrote that no live freeze still pins. Keeps full
    /// ids so reclaim can propose them. Empty until something is unpinned
    /// or noted without a Leaves entry.
    let orphanObjects (volume: Volume) : ZetaFsReclaim.Object[] =
        lock volume.Gate (fun () ->
            catalogOrphans volume.StoreDir volume.KnownObjects volume.LivePins volume.Log.ObjectCas)

    let private takeFreezeBytes (volume: Volume) =
        lock volume.Gate (fun () ->
            let n = volume.FreezeBytesSinceReclaim
            volume.FreezeBytesSinceReclaim <- 0UL
            persistCatalogBestEffort
                volume.StoreDir
                volume.KnownObjects
                volume.LivePins
                volume.History
                0UL
                volume.ObjectSets
                volume.CatalogGen
            n)

    /// Reclaim tick paced from freeze bytes accumulated on this volume
    /// since the last metered tick. Not wall-clock. Consumes the meter
    /// even if nothing was eligible.
    let reclaimTickMetered
        (volume: Volume)
        (fs: IFileSystem)
        (roots: ZetaFsReclaim.Roots)
        (objects: ZetaFsReclaim.Object[])
        : int =
        let bytes = takeFreezeBytes volume
        reclaimTick volume fs roots objects bytes

    let reclaimAsyncMetered
        (volume: Volume)
        (roots: ZetaFsReclaim.Roots)
        (objects: ZetaFsReclaim.Object[])
        (ct: CancellationToken)
        : Task<int> =
        let bytes = takeFreezeBytes volume
        reclaimAsync volume roots objects bytes ct

    /// Enqueue only when there is something to delete. Empty auto-tick
    /// would consume the freeze-byte meter and delete nothing.
    let private enqueueOrphanReclaim (volume: Volume) (ct: CancellationToken) =
        let orphans = orphanObjects volume

        if orphans.Length > 0 then
            let mutable sum = 0UL
            let mutable i = 0

            while i < orphans.Length do
                sum <- sum + orphans.[i].Size
                i <- i + 1

            // Freeze span can be smaller than jumprope node encodings of the
            // previous generation. pacer(span) would skip those objects and
            // leave the dropped ContentId readable.
            let bytes = max (takeFreezeBytes volume) sum
            reclaimAsync volume ZetaFsReclaim.emptyRoots orphans bytes ct |> ignore

    let private afterFreeze
        (volume: Volume)
        (ct: CancellationToken)
        (result: Result<FreezeResult, FreezeError>)
        : Result<FreezeResult, FreezeError> =
        match result with
        | Ok _ -> enqueueOrphanReclaim volume ct
        | Error _ -> ()

        result

    let pumpLog (volume: Volume) (ct: CancellationToken) : Task =
        volume.Log.PumpToIdleAsync(ct)

    let logBoatCount (volume: Volume) = volume.Log.Boats
    let logLastBoatSize (volume: Volume) = volume.Log.LastBoatSize

    let logLogicalBytes (volume: Volume) =
        match volume.Log.BlockIo with
        | Some door -> door.LogicalBytes
        | None ->
            let path = volume.Log.LogPath
            if FileSystem.Current.Exists path then
                int64 (FileSystem.Current.ReadAllBytes path).Length
            else
                0L

    let private putObject (volume: Volume) (id: ContentHash256) (bytes: byte[]) : Result<unit, FreezeError> =
        let path = objectPath volume.StoreDir id
        let fs = FileSystem.Current

        if not (fs.Exists path) then
            let dir = ZetaFsPath.directoryName path
            fs.CreateDirectory dir
            FileSystemIo.writeAllBytes fs path bytes

        let stored =
            if fs.Exists path then
                Some(fs.ReadAllBytes path)
            else
                None

        match stored with
        | Some b when (ContentHash256.ofBytes b).Equals(id) ->
            volume.KnownObjects.[id] <- uint64 bytes.Length
            volume.LivePins.Add id |> ignore
            tryPersistCatalog
                volume.StoreDir
                volume.KnownObjects
                volume.LivePins
                volume.History
                volume.FreezeBytesSinceReclaim
                volume.ObjectSets
                volume.CatalogGen
        | _ -> Error(FreezeError.MissingLeaves 1)

    let private tryReadObject (volume: Volume) (id: ContentHash256) : byte[] option =
        match volume.Log.ObjectCas with
        | Some cas -> cas.TryGet(objectKey id)
        | None ->
            let path = objectPath volume.StoreDir id
            let fs = FileSystem.Current

            if fs.Exists path then
                Some(fs.ReadAllBytes path)
            else
                None

    let private objectMatches (volume: Volume) (id: ContentHash256) : bool =
        match tryReadObject volume id with
        | None -> false
        | Some bytes -> (ContentHash256.ofBytes bytes).Equals(id)

    let private className (c: DurabilityClass) =
        match c with
        | Buffered -> "buffered"
        | Journaled -> "journaled"
        | Durable -> "durable"

    let private encodeIntent entity (content: ContentHash256) (leaves: ContentHash256[]) (cls: DurabilityClass) (lsn: int64) : byte[] =
        let leafArr =
            DynamicValue.Array [ for leaf in leaves -> DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.CreateRange leaf.Raw) ]

        DynamicValue.toCanonicalCborOk (
            DynamicValue.Object
                [ "t", DynamicValue.String "freeze-intent/1"
                  "entity", DynamicValue.String(ZetaFsNamespace.EntityId.format entity)
                  "content", DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.CreateRange content.Raw)
                  "leaves", leafArr
                  "class", DynamicValue.String(className cls)
                  "lsn", DynamicValue.Int lsn ]
        )

    let private encodeCommit (intentLsn: int64) (content: ContentHash256) (lsn: int64) : byte[] =
        DynamicValue.toCanonicalCborOk (
            DynamicValue.Object
                [ "t", DynamicValue.String "freeze-commit/1"
                  "intentLsn", DynamicValue.Int intentLsn
                  "content", DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.CreateRange content.Raw)
                  "lsn", DynamicValue.Int lsn ]
        )

    let private framePlain (payload: byte[]) : byte[] =
        let crc = HardwareCrc.Crc32C(ReadOnlySpan payload)
        let frame = Array.zeroCreate (8 + payload.Length)
        BinaryPrimitives.WriteInt32LittleEndian(Span(frame, 0, 4), payload.Length)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(frame, 4, 4), crc)
        Buffer.BlockCopy(payload, 0, frame, 8, payload.Length)
        frame

    let private frameSealed (lsn: int64) (inner: byte[]) : byte[] =
        let frame = Array.zeroCreate (12 + inner.Length)
        BinaryPrimitives.WriteInt32LittleEndian(Span(frame, 0, 4), inner.Length)
        BinaryPrimitives.WriteInt64LittleEndian(Span(frame, 4, 8), lsn)
        Buffer.BlockCopy(inner, 0, frame, 12, inner.Length)
        frame

    let isReadable (volume: Volume) (content: ContentHash256) : bool =
        lock volume.Gate (fun () ->
            match volume.Commits.TryGetValue content with
            | false, _ -> false
            | true, _ ->
                match volume.Leaves.TryGetValue content with
                | false, _ -> false
                | true, leaves ->
                    let mutable ok = true
                    let mutable i = 0

                    let ids =
                        match volume.ObjectSets.TryGetValue content with
                        | true, xs when xs.Length > 0 -> xs
                        | _ -> leaves

                    while ok && i < ids.Length do
                        if not (objectMatches volume ids.[i]) then
                            ok <- false

                        i <- i + 1

                    ok)

    let private rememberLayout
        (volume: Volume)
        (entity: ZetaFsNamespace.EntityId)
        (rope: ZetaFsJumprope.Rope)
        (objectIds: ContentHash256[])
        =
        let layout =
            { Prev = ZetaFsJumprope.prevOf rope
              ObjectIds = objectIds }

        lock volume.Gate (fun () -> volume.LastLayout.[entity] <- layout)
        persistLayoutBestEffort volume.StoreDir entity layout

    let private noteFreeze (volume: Volume) (span: uint64) (result: FreezeResult) =
        lock volume.Gate (fun () ->
            volume.FreezeBytesSinceReclaim <- volume.FreezeBytesSinceReclaim + span
            persistCatalogBestEffort
                volume.StoreDir
                volume.KnownObjects
                volume.LivePins
                volume.History
                volume.FreezeBytesSinceReclaim
                volume.ObjectSets
                volume.CatalogGen)

        result

    let private keepCount (h: ZetaFsPolicy.HistoryPolicy) : int option =
        match h with
        | ZetaFsPolicy.HistoryPolicy.KeepAll
        | ZetaFsPolicy.HistoryPolicy.Regen _ -> None
        | ZetaFsPolicy.HistoryPolicy.KeepNone -> Some 1
        | ZetaFsPolicy.HistoryPolicy.Rolling(Some n, _, _) when n < 1 -> Some 1
        | ZetaFsPolicy.HistoryPolicy.Rolling(Some n, _, _) -> Some n
        | ZetaFsPolicy.HistoryPolicy.Rolling(None, _, _) -> None

    let private objectsNamed (volume: Volume) (content: ContentHash256) : ContentHash256[] =
        match volume.ObjectSets.TryGetValue content with
        | true, ids -> ids
        | false, _ ->
            match volume.Leaves.TryGetValue content with
            | true, ids -> ids
            | false, _ -> [||]

    /// Unpin objects that no kept generation of this entity still names.
    /// KeepAll / Regen leave pins. Shared Jumprope chunks stay.
    let private applyRetention
        (volume: Volume)
        (entity: ZetaFsNamespace.EntityId)
        (content: ContentHash256)
        (objectIds: ContentHash256[])
        =
        volume.ObjectSets.[content] <- objectIds

        for id in objectIds do
            volume.LivePins.Add id |> ignore

        match keepCount volume.History with
        | None -> ()
        | Some n ->
            let mine =
                volume.Commits.Values
                |> Seq.filter (fun r -> r.Entity = entity)
                |> Seq.sortBy (fun r -> r.CommitLsn)
                |> Seq.toArray

            let dropCount = mine.Length - n

            if dropCount > 0 then
                let kept = HashSet<ContentHash256>()

                for i in dropCount .. mine.Length - 1 do
                    for id in objectsNamed volume mine.[i].Content do
                        kept.Add id |> ignore

                for i in 0 .. dropCount - 1 do
                    for id in objectsNamed volume mine.[i].Content do
                        if not (kept.Contains id) then
                            volume.LivePins.Remove id |> ignore

    let private finish
        (volume: Volume)
        (entity: ZetaFsNamespace.EntityId)
        (content: ContentHash256)
        (span: uint64)
        (cls: DurabilityClass)
        (generation: uint64)
        (leafIds: ContentHash256[])
        (objectIds: ContentHash256[])
        (intentLsn: int64)
        (commitLsn: int64)
        : Result<FreezeResult, FreezeError> =
        let result =
            { Entity = entity
              Content = content
              Span = span
              Class = cls
              Generation = generation
              IntentLsn = intentLsn
              CommitLsn = commitLsn }

        lock volume.Gate (fun () ->
            volume.Commits.[content] <- result
            volume.Leaves.[content] <- leafIds
            applyRetention volume entity content objectIds)

        match cls, volume.Observer with
        | Durable, Some o -> o.OnDurable result |> Result.map (fun () -> noteFreeze volume span result)
        | Durable, None -> Ok(noteFreeze volume span result)
        | _, Some o -> o.OnJournaled result |> Result.map (fun () -> noteFreeze volume span result)
        | _, None -> Ok(noteFreeze volume span result)

    /// Library path: ValueTask. Await once (`let!` / `ConfigureAwait(false)`).
    ///
    /// `ct` is required (F# let-bound functions cannot take optional args).
    /// Callers: tests pass `CancellationToken.None` at *their* entry; a Generic
    /// Host passes `ApplicationStopping`. Nested ferry calls pass `ct` through.
    /// Cancel before admit skips the boat; cancel after admit still writes
    /// (group-commit shield) but the waiter observes the token.
    let freezeAsync
        (volume: Volume)
        (entity: ZetaFsNamespace.EntityId)
        (cls: DurabilityClass)
        (ct: CancellationToken)
        : ValueTask<Result<FreezeResult, FreezeError>> =
        if ct.IsCancellationRequested then
            ValueTask<Result<FreezeResult, FreezeError>>(Task.FromCanceled<Result<FreezeResult, FreezeError>> ct)
        elif cls = Durable && OperatingSystem.IsWindows() then
            ValueTask<Result<FreezeResult, FreezeError>>(Error FreezeError.WindowsDurableNotClaimed)
        else
            let snap = ZetaFsMutbuf.snapshot volume.Mutbuf entity
            let prev =
                lock volume.Gate (fun () ->
                    match volume.LastLayout.TryGetValue entity with
                    | true, layout -> Some layout
                    | _ ->
                        match tryLoadLayout volume.StoreDir entity with
                        | Some layout ->
                            volume.LastLayout.[entity] <- layout
                            Some layout
                        | None -> None)

            let rope =
                match prev with
                | Some layout -> ZetaFsJumprope.buildFromPrev layout.Prev snap.Bytes
                | None -> ZetaFsJumprope.buildV1 snap.Bytes

            let leafIds = [| for id, _ in rope.Leaves -> id |]
            let casIds = [| for kv in rope.Cas.Objects -> kv.Key |]

            let objectIds =
                if rope.Cas.Objects.Count = 0 then
                    match prev with
                    | Some layout when layout.Prev.Content.Equals rope.Content -> layout.ObjectIds
                    | _ -> leafIds
                else
                    Array.append leafIds casIds

            match cls with
            | Buffered ->
                let mutable putErr: FreezeError option = None

                for struct (id, bytes) in objectsNotYetKnown volume rope.Cas do
                    if putErr.IsNone then
                        match putObject volume id bytes with
                        | Error e -> putErr <- Some e
                        | Ok() -> ()

                match putErr with
                | Some e -> ValueTask<Result<FreezeResult, FreezeError>>(Error e)
                | None ->
                    let result =
                        { Entity = entity
                          Content = rope.Content
                          Span = rope.Span
                          Class = cls
                          Generation = snap.Generation
                          IntentLsn = 0L
                          CommitLsn = 0L }

                    rememberLayout volume entity rope objectIds
                    ValueTask<Result<FreezeResult, FreezeError>>(
                        afterFreeze volume ct (Ok(noteFreeze volume rope.Span result))
                    )
            | Journaled
            | Durable ->
                let intentLsn, commitLsn =
                    lock volume.Gate (fun () ->
                        let a = volume.NextLsn
                        volume.NextLsn <- a + 2L
                        a, a + 1L)

                let intentPt = encodeIntent entity rope.Content leafIds cls intentLsn
                let commitPt = encodeCommit intentLsn rope.Content commitLsn

                let framed: Result<byte[] * byte[], FreezeError> =
                    match volume.Session with
                    | None -> Ok(framePlain intentPt, framePlain commitPt)
                    | Some session ->
                        match ZetaFsCrypto.sealLog session intentLsn intentPt with
                        | Error e -> Error(FreezeError.Crypto e)
                        | Ok i ->
                            match ZetaFsCrypto.sealLog session commitLsn commitPt with
                            | Error e -> Error(FreezeError.Crypto e)
                            | Ok c -> Ok(frameSealed intentLsn i, frameSealed commitLsn c)

                match framed with
                | Error e -> ValueTask<Result<FreezeResult, FreezeError>>(Error e)
                | Ok(intentFrame, commitFrame) ->
                    let reply =
                        TaskCompletionSource<Result<struct (int64 * int64), FreezeError>>(
                            TaskCreationOptions.RunContinuationsAsynchronously
                        )

                    let objects = objectsNotYetKnown volume rope.Cas

                    let item =
                        { IntentLsn = intentLsn
                          CommitLsn = commitLsn
                          IntentFrame = intentFrame
                          CommitFrame = commitFrame
                          Durable = (cls = Durable)
                          Objects = objects
                          Reply = reply }

                    let pending = volume.Log.SubmitAsync(item, ct)

                    if pending.IsCompletedSuccessfully then
                        match pending.Result with
                        | Error e -> ValueTask<Result<FreezeResult, FreezeError>>(Error e)
                        | Ok(struct (i, c)) ->
                            let finished =
                                finish volume entity rope.Content rope.Span cls snap.Generation leafIds objectIds i c

                            match finished with
                            | Ok _ -> rememberLayout volume entity rope objectIds
                            | Error _ -> ()

                            ValueTask<Result<FreezeResult, FreezeError>>(afterFreeze volume ct finished)
                    else
                        let work =
                            task {
                                let! logged = pending.AsTask().ConfigureAwait(false)

                                match logged with
                                | Error e -> return Error e
                                | Ok(struct (i, c)) ->
                                    let finished =
                                        finish
                                            volume
                                            entity
                                            rope.Content
                                            rope.Span
                                            cls
                                            snap.Generation
                                            leafIds
                                            objectIds
                                            i
                                            c

                                    match finished with
                                    | Ok _ -> rememberLayout volume entity rope objectIds
                                    | Error _ -> ()

                                    return afterFreeze volume ct finished
                            }

                        ValueTask<Result<FreezeResult, FreezeError>> work
