namespace Zeta.Core

open System
open System.Collections.Generic
open System.Text
open Zeta.Core.FSharp.Blake3

/// Budgeted reclaim ferry (K7 / PR10). Not `git gc`.
///
/// Lifetimes: Singleton = keep-all, Scoped = rolling, Transient = none.
/// Open-file is a nested Transient scope (POSIX last-close). Eligibility is
/// a rank-2 brand: a raw ContentId cannot mint a token. Mark is ShivaGc's
/// cycle-safe reachability. Pacer budget is freeze bytes since the last
/// tick, never local wall-clock. Crash-mid-sweep intercept:
/// `InMemoryFileSystem.ArmCrashOnDelete` (POSIX stream) and
/// `BlockCas.ArmCrashOnDelete` (BlockStore / default `create`). A partial
/// tick leaves extra garbage, not a missing live object. A committed Journaled freeze stays
/// readable across that crash (tested). Sweep journal slice:
/// `applyWithJournal` records remaining paths and resumes after
/// crash-mid-sweep. Freeze volume door: `ZetaFsFreeze.reclaimSweep`.
/// Tick: `ZetaFsFreeze.reclaimTick`. Boat: `reclaimAsync` + `pumpReclaim`
/// (DoP=1 FerryThrottler, not the freeze WAL boat). Metered pacer:
/// `ZetaFsFreeze.reclaimTickMetered`. Successful freeze enqueues nonempty
/// orphan reclaim on the reclaim ferry. Default freeze volumes reclaim via
/// `BlockCas.Delete`; POSIX stream volumes still delete files. Manual
/// volumes still `pumpReclaim`.
///
/// DoP=1 on this ferry. No Task.Run.
module ZetaFsReclaim =

    type Lifetime =
        | Singleton
        | Scoped
        | Transient

    /// Brand: minted only inside a tick. Cannot be forged from a raw ContentId.
    [<Struct>]
    type ReclaimToken = private { Content: ContentHash256 }

    type Roots =
        { LiveRefs: string[]
          OpenFiles: string[]
          KeepAll: string[]
          RollingLive: string[]
          FreezeInFlight: string[] }

    type Budget =
        { Bytes: uint64
          Count: int }

    type Object =
        { Id: ContentHash256
          Size: uint64
          Refs: ContentHash256[] }

    type IReclaimScope =
        abstract TryMint: ContentHash256 -> ReclaimToken option

    type IReclaimComputation<'a> =
        abstract Invoke: IReclaimScope -> 'a

    let hex (h: ContentHash256) : string = h.ToHex()

    let lifetimeOf (h: ZetaFsPolicy.HistoryPolicy) : Lifetime =
        match h with
        | ZetaFsPolicy.HistoryPolicy.KeepAll
        | ZetaFsPolicy.HistoryPolicy.Regen _ -> Lifetime.Singleton
        | ZetaFsPolicy.HistoryPolicy.Rolling _ -> Lifetime.Scoped
        | ZetaFsPolicy.HistoryPolicy.KeepNone -> Lifetime.Transient

    let emptyRoots: Roots =
        { LiveRefs = Array.empty
          OpenFiles = Array.empty
          KeepAll = Array.empty
          RollingLive = Array.empty
          FreezeInFlight = Array.empty }

    /// Pacer: budget grows with freeze bytes since the last tick. Not elapsed time.
    let pacer (freezeBytesSinceLastTick: uint64) : Budget =
        let count =
            if freezeBytesSinceLastTick = 0UL then
                0
            elif freezeBytesSinceLastTick > uint64 System.Int32.MaxValue then
                System.Int32.MaxValue
            else
                int freezeBytesSinceLastTick

        { Bytes = freezeBytesSinceLastTick
          Count = max 1 count }

    let private pinSet (roots: Roots) : HashSet<string> =
        let s = HashSet<string>(StringComparer.Ordinal)
        for x in roots.LiveRefs do
            s.Add x |> ignore
        for x in roots.OpenFiles do
            s.Add x |> ignore
        for x in roots.KeepAll do
            s.Add x |> ignore
        for x in roots.RollingLive do
            s.Add x |> ignore
        for x in roots.FreezeInFlight do
            s.Add x |> ignore
        s

    let private heapOf (objects: Object[]) : DynamicValue =
        objects
        |> Seq.map (fun o ->
            let refs = [ for r in o.Refs -> hex r ]
            ShivaGc.object' (hex o.Id) DynamicValue.Null refs)
        |> Seq.toList
        |> ShivaGc.heap

    /// Cycle-safe mark. Live-ref / open-file / keep-all / rolling / freeze LSN
    /// roots, plus Jumprope edges in `objects`.
    let mark (roots: Roots) (objects: Object[]) : Set<string> =
        let pins = pinSet roots |> Seq.toList
        ShivaGc.mark pins (heapOf objects)

    let private isPinned (marked: Set<string>) (id: ContentHash256) : bool =
        Set.contains (hex id) marked

    let run (roots: Roots) (objects: Object[]) (comp: IReclaimComputation<'a>) : 'a =
        let marked = mark roots objects
        let scope =
            { new IReclaimScope with
                member _.TryMint id =
                    if isPinned marked id then
                        None
                    else
                        Some { Content = id } }

        comp.Invoke scope

    let content (t: ReclaimToken) : ContentHash256 = t.Content

    /// One DoP=1 tick. Stops at byte or count budget. Does not delete.
    let propose (roots: Roots) (objects: Object[]) (budget: Budget) : ContentHash256[] =
        run roots objects
            { new IReclaimComputation<ContentHash256[]> with
                member _.Invoke scope =
                    let acc = ResizeArray<ContentHash256>()
                    let mutable spent = 0UL
                    let mutable n = 0
                    let mutable i = 0

                    while i < objects.Length && n < budget.Count do
                        let o = objects.[i]
                        let remaining = budget.Bytes - spent

                        if remaining = 0UL then
                            i <- objects.Length
                        elif o.Size <= remaining then
                            match scope.TryMint o.Id with
                            | Some tok ->
                                acc.Add(content tok)
                                spent <- spent + o.Size
                                n <- n + 1
                            | None -> ()

                        i <- i + 1

                    acc.ToArray() }

    /// Apply minted deletions through IFileSystem. Partial apply is extra
    /// garbage, not a missing live object. ArmCrashOnDelete is the DST door.
    let apply (fs: IFileSystem) (paths: (ContentHash256 * string)[]) (budget: Budget) : int =
        let mutable n = 0
        let mutable i = 0

        while i < paths.Length && n < budget.Count do
            let _, path = paths.[i]

            if fs.Exists path then
                fs.Delete path
                n <- n + 1

            i <- i + 1

        n

    let private formatJournal (rows: (ContentHash256 * string)[]) =
        rows
        |> Array.map (fun (id, path) -> hex id + " " + path)
        |> String.concat "\n"

    let private parseJournal (text: string) : (ContentHash256 * string)[] =
        text.Replace("\r\n", "\n", StringComparison.Ordinal).Split([| '\n' |], StringSplitOptions.None)
        |> Array.choose (fun line ->
            if line.Length < 66 then
                None
            elif line.[64] <> ' ' then
                None
            else
                Some(ContentHash256.ofHex (line.Substring(0, 64)), line.Substring(65)))

    /// Journaled apply through caller-supplied published/retract. POSIX
    /// `applyWithJournal` and BlockCas reclaim share this so the journal
    /// is one door. Partial retract is extra garbage, not a missing live
    /// object.
    let applyWithJournalUsing
        (published: string -> bool)
        (retract: string -> unit)
        (fs: IFileSystem)
        (journalPath: string)
        (paths: (ContentHash256 * string)[])
        (budget: Budget)
        : int =
        let loaded =
            if fs.Exists journalPath then
                parseJournal (Encoding.UTF8.GetString(fs.ReadAllBytes journalPath))
            else
                paths

        let mutable n = 0
        let mutable i = 0

        while i < loaded.Length && n < budget.Count do
            let rest = Array.sub loaded i (loaded.Length - i)
            FileSystemIo.writeAllText fs journalPath (formatJournal rest)
            let _, path = loaded.[i]

            if published path then
                retract path
                n <- n + 1

            i <- i + 1

        if i >= loaded.Length then
            if fs.Exists journalPath then
                fs.Delete journalPath
        else
            FileSystemIo.writeAllText fs journalPath (formatJournal (Array.sub loaded i (loaded.Length - i)))

        n

    /// Journaled apply. Writes remaining (hex, path) lines before each
    /// delete. A crash-mid-sweep leaves the journal; the next call with
    /// this path resumes (empty `paths` still reads the journal).
    /// Freeze volume door is `ZetaFsFreeze.reclaimSweep`. Tick is
    /// `ZetaFsFreeze.reclaimTick`. Boat is `reclaimAsync` + `pumpReclaim`.
    let applyWithJournal
        (fs: IFileSystem)
        (journalPath: string)
        (paths: (ContentHash256 * string)[])
        (budget: Budget)
        : int =
        applyWithJournalUsing
            (fun path -> fs.Exists path)
            (fun path -> fs.Delete path)
            fs
            journalPath
            paths
            budget
