namespace Zeta.Core

open System
open System.Collections.Concurrent
open System.Globalization
open System.IO
open System.Text

/// One shared scratch buffer per EntityId (E5). `pwrite` / `truncate` / `append`
/// do not mint a new hub and do not append a binding. Freeze snapshots generation
/// G; concurrent writes land on G+1 and are not mixed into G.
module ZetaFsMutbuf =

    [<Literal>]
    let DirName = "mutbuf"

    type Coherence =
        | Shared
        | CloseToOpen

    type MutbufError =
        | NegativeOffset of int64

    type Snapshot =
        { Entity: ZetaFsNamespace.EntityId
          Generation: uint64
          Bytes: byte[] }

    type Handle =
        { Entity: ZetaFsNamespace.EntityId
          Coherence: Coherence
          /// Close-to-open private copy. None on the shared path.
          mutable Isolated: byte[] option
          /// Close-to-open only: close publishes Isolated iff this fd wrote.
          mutable Dirty: bool }

    type Slot =
        { Entity: ZetaFsNamespace.EntityId
          Gate: obj
          mutable Live: byte[]
          mutable Generation: uint64 }

    type Catalog =
        { StoreDir: string
          Coherence: Coherence
          Slots: ConcurrentDictionary<string, Slot> }

    let private keyOf (id: ZetaFsNamespace.EntityId) = ZetaFsNamespace.EntityId.format id

    let private slotPath (catalog: Catalog) (id: ZetaFsNamespace.EntityId) =
        ZetaFsPath.combine3 catalog.StoreDir DirName (keyOf id)

    let private dataPath catalog id = ZetaFsPath.combine2 (slotPath catalog id) "data"
    let private genPath catalog id = ZetaFsPath.combine2 (slotPath catalog id) "gen"
    let private slotFile catalog id = ZetaFsPath.combine2 (slotPath catalog id) "slot"

    let private encodeSlot (generation: uint64) (live: byte[]) : byte[] =
        let prefix =
            Encoding.ASCII.GetBytes(generation.ToString(CultureInfo.InvariantCulture) + "\n")

        let payload = Array.zeroCreate (prefix.Length + live.Length)
        Buffer.BlockCopy(prefix, 0, payload, 0, prefix.Length)

        if live.Length > 0 then
            Buffer.BlockCopy(live, 0, payload, prefix.Length, live.Length)

        payload

    let private tryDecodeSlot (bytes: byte[]) : (byte[] * uint64) option =
        let nl = Array.IndexOf(bytes, byte '\n')

        if nl < 0 then
            None
        else
            let text = Encoding.ASCII.GetString(bytes, 0, nl).Trim()

            match UInt64.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture) with
            | false, _ -> None
            | true, g ->
                let n = bytes.Length - nl - 1

                if n <= 0 then
                    Some(Array.empty, g)
                else
                    let live = Array.zeroCreate n
                    Buffer.BlockCopy(bytes, nl + 1, live, 0, n)
                    Some(live, g)

    let create (storeDir: string) (coherence: Coherence) : Catalog =
        FileSystem.Current.CreateDirectory (ZetaFsPath.combine2 storeDir DirName)
        { StoreDir = storeDir
          Coherence = coherence
          Slots = ConcurrentDictionary<string, Slot>(StringComparer.Ordinal) }

    let private loadLegacy
        (fs: IFileSystem)
        (catalog: Catalog)
        (id: ZetaFsNamespace.EntityId)
        : byte[] * uint64 =
        let bytes =
            match FileSystemIo.tryReadBytesCapped fs (64L * 1024L * 1024L) (dataPath catalog id) with
            | Some b -> b
            | None -> Array.empty

        let generation =
            match FileSystemIo.tryReadBytesCapped fs 64L (genPath catalog id) with
            | Some b ->
                let text = Encoding.ASCII.GetString(b).Trim()

                match UInt64.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture) with
                | true, g -> g
                | _ -> 0UL
            | None -> 0UL

        bytes, generation

    let private loadSlot (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : Slot =
        let fs = FileSystem.Current
        let bytes, generation =
            match FileSystemIo.tryReadBytesCapped fs (64L * 1024L * 1024L + 64L) (slotFile catalog id) with
            | Some b ->
                match tryDecodeSlot b with
                | Some parsed -> parsed
                | None -> loadLegacy fs catalog id
            | None -> loadLegacy fs catalog id

        { Entity = id
          Gate = obj ()
          Live = bytes
          Generation = generation }

    let private slotOf (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : Slot =
        catalog.Slots.GetOrAdd(keyOf id, fun _ -> loadSlot catalog id)

    let persist (catalog: Catalog) (id: ZetaFsNamespace.EntityId) =
        let slot = slotOf catalog id
        lock slot.Gate (fun () ->
            let fs = FileSystem.Current
            fs.CreateDirectory (slotPath catalog id)
            FileSystemIo.writeAllBytes fs (slotFile catalog id) (encodeSlot slot.Generation slot.Live))

    /// Live bytes from the atomic `slot` file, else legacy `data`. None if neither exists.
    let tryReadPersisted (storeDir: string) (id: ZetaFsNamespace.EntityId) : byte[] option =
        let fs = FileSystem.Current
        let dir = ZetaFsPath.combine3 storeDir DirName (keyOf id)
        match FileSystemIo.tryReadBytesCapped fs (64L * 1024L * 1024L + 64L) (ZetaFsPath.combine2 dir "slot") with
        | Some b ->
            match tryDecodeSlot b with
            | Some(live, _) -> Some live
            | None -> FileSystemIo.tryReadBytesCapped fs (64L * 1024L * 1024L) (ZetaFsPath.combine2 dir "data")
        | None -> FileSystemIo.tryReadBytesCapped fs (64L * 1024L * 1024L) (ZetaFsPath.combine2 dir "data")

    let openHandle (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : Handle =
        let slot = slotOf catalog id
        match catalog.Coherence with
        | Coherence.Shared ->
            { Entity = id
              Coherence = Coherence.Shared
              Isolated = None
              Dirty = false }
        | Coherence.CloseToOpen ->
            let copy = lock slot.Gate (fun () -> Array.copy slot.Live)
            { Entity = id
              Coherence = Coherence.CloseToOpen
              Isolated = Some copy
              Dirty = false }

    let close (catalog: Catalog) (handle: Handle) =
        match handle.Coherence, handle.Isolated, handle.Dirty with
        | Coherence.CloseToOpen, Some copy, true ->
            let slot = slotOf catalog handle.Entity
            lock slot.Gate (fun () -> slot.Live <- Array.copy copy)
            handle.Isolated <- None
            handle.Dirty <- false
            persist catalog handle.Entity
        | Coherence.CloseToOpen, _, _ ->
            handle.Isolated <- None
            handle.Dirty <- false
        | _ -> ()

    let private grow (buf: byte[]) (needed: int) : byte[] =
        if needed <= buf.Length then
            buf
        else
            let next = Array.zeroCreate needed
            Buffer.BlockCopy(buf, 0, next, 0, buf.Length)
            next

    let private activeBuffer (slot: Slot) (handle: Handle) : byte[] =
        match handle.Isolated with
        | Some copy -> copy
        | None -> slot.Live

    let private setActive (slot: Slot) (handle: Handle) (buf: byte[]) =
        match handle.Coherence with
        | Coherence.CloseToOpen -> handle.Isolated <- Some buf
        | Coherence.Shared -> slot.Live <- buf

    let pwrite
        (catalog: Catalog)
        (handle: Handle)
        (offset: int64)
        (src: byte[])
        : Result<int, MutbufError> =
        if offset < 0L then
            Error(NegativeOffset offset)
        else
            let slot = slotOf catalog handle.Entity
            lock slot.Gate (fun () ->
                let buf = activeBuffer slot handle
                let start = int offset
                let needed = start + src.Length
                let grown = grow buf needed
                if src.Length > 0 then
                    Buffer.BlockCopy(src, 0, grown, start, src.Length)
                setActive slot handle grown

                if handle.Coherence = Coherence.CloseToOpen then
                    handle.Dirty <- true

                Ok src.Length)

    let pread
        (catalog: Catalog)
        (handle: Handle)
        (offset: int64)
        (dst: byte[])
        : Result<int, MutbufError> =
        if offset < 0L then
            Error(NegativeOffset offset)
        else
            let slot = slotOf catalog handle.Entity
            lock slot.Gate (fun () ->
                let buf = activeBuffer slot handle
                if offset >= int64 buf.Length then
                    Ok 0
                else
                    let start = int offset
                    let n = min dst.Length (buf.Length - start)
                    Buffer.BlockCopy(buf, start, dst, 0, n)
                    Ok n)

    let truncate (catalog: Catalog) (handle: Handle) (len: int64) : Result<unit, MutbufError> =
        if len < 0L then
            Error(NegativeOffset len)
        else
            let slot = slotOf catalog handle.Entity
            lock slot.Gate (fun () ->
                let buf = activeBuffer slot handle
                let n = int len
                let next = Array.zeroCreate n
                let copy = min n buf.Length
                Buffer.BlockCopy(buf, 0, next, 0, copy)
                setActive slot handle next

                if handle.Coherence = Coherence.CloseToOpen then
                    handle.Dirty <- true

                Ok())

    /// O_APPEND: serialized per EntityId (DoP=1). Does not tear two appends.
    let append (catalog: Catalog) (handle: Handle) (src: byte[]) : Result<int, MutbufError> =
        let slot = slotOf catalog handle.Entity
        lock slot.Gate (fun () ->
            let buf = activeBuffer slot handle
            let needed = buf.Length + src.Length
            let grown = grow buf needed
            if src.Length > 0 then
                Buffer.BlockCopy(src, 0, grown, buf.Length, src.Length)
            setActive slot handle grown

            if handle.Coherence = Coherence.CloseToOpen then
                handle.Dirty <- true

            Ok src.Length)

    let length (catalog: Catalog) (handle: Handle) : int64 =
        let slot = slotOf catalog handle.Entity
        lock slot.Gate (fun () -> int64 (activeBuffer slot handle).Length)

    /// Live shared-buffer length if this hub already has a slot. Does not
    /// create one. Getattr uses this for dirty size; else PosixMeta.Size.
    let tryLiveLength (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : uint64 option =
        match catalog.Slots.TryGetValue(keyOf id) with
        | true, slot -> lock slot.Gate (fun () -> Some(uint64 slot.Live.Length))
        | false, _ -> None

    /// Byte-copy generation G; live becomes G+1 starting as a copy of G.
    /// Later pwrite mutates live only. Snapshot bytes never mix with those writes.
    let snapshot (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : Snapshot =
        let slot = slotOf catalog id
        lock slot.Gate (fun () ->
            let g = slot.Generation
            let frozen = Array.copy slot.Live
            slot.Live <- Array.copy frozen
            slot.Generation <- g + 1UL
            { Entity = id
              Generation = g
              Bytes = frozen })

    let generation (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : uint64 =
        let slot = slotOf catalog id
        lock slot.Gate (fun () -> slot.Generation)
