module Zeta.Tests.Formal.ErasureRepresentationLawsTests

open System
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Reflection
open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ERASURE IS A PROPERTY OF THE REPRESENTATION — the law pack for the spine/log/eviction sites
//
// `WSet.ErasureClassification.Laws.Tests.fs` established the machinery for the four-corner
// algebra: a class DECLARED beside each operation, MEASURED by exhaustive sweep, required to agree
// in BOTH directions, with a reflection drift guard so a new operation fails rather than passes.
// This pack extends that same machinery down to the storage layer, which declared nothing.
//
// WHY IT COULD NOT BE A LIST OF OPERATION NAMES. `IDeltaLog.TruncateAsync` is ONE interface method
// with ONE call site — `RecoverableSpine.CommitAsync`. Across the backends this repo ships it has
// three different thermodynamic classes, for three unrelated reasons:
//
//   InMemoryDeltaLog        `list.RemoveAll`                      -> ERASING
//   ZetaFsDeltaLog          new commit WITH old as parent         -> REVERSIBLE (DAG); ERASING (read surface)
//   GitDeltaLog             new tree committed WITH old as parent -> REVERSIBLE
//   GroupCommitDiskDeltaLog no-op; compaction unimplemented in v1 -> REVERSIBLE (the identity)
//
// Same name, same caller, opposite class, decided entirely by the injected backend. So the
// classification attaches to the concrete type via `IErasureDeclaring`, never to the interface —
// and the pin below (`the same interface method carries opposite classes`) fails if anyone ever
// "tidies" that away.
//
// WHY EVERY ROW NAMES AN OBSERVATION. "Is the preimage recoverable" is not a question until you
// say through what. `ZetaFsDeltaLog` is Erasing through its own read surface and Reversible
// through the commit DAG (the parent edge). Two honest rows beat one dishonest average, so
// `(Representation, Operation, Observation)` is the key.
//
// WHY `Unmeasured` IS NOT ZERO. An operation nobody has swept has an UNKNOWN cost. Recording that
// as `0` is the closed-ledger free lunch this whole thread is about — a channel that looks free
// because nothing is watching it. `ErasureClass.bitsErasedPpm` returns `None`, not `0L`, and the
// guards below refuse to let an `Unmeasured` row wear a measured row's clothes.
//
// Anchors (Beacon): Landauer 1961; Bennett 1973; Goguen-Meseguer 1982 (noninterference).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── the swept universe ────────────────────────────────────────────────────────────────────────
// Three deltas, chosen so the pair that annihilates under the fold is present: a key, its
// retraction, and nothing at all.

let private deltaUniverse: ZSet<int> list =
    [ ZSet<int>.Empty
      ZSet.ofSeq [ (1, 1L) ]
      ZSet.ofSeq [ (1, -1L) ] ]

/// Every delta sequence of length 0..2 — 13 states.
let private deltaSequences: ZSet<int> list list =
    [ yield ([]: ZSet<int> list)
      for a in deltaUniverse -> [ a ]
      for a in deltaUniverse do
          for b in deltaUniverse -> [ a; b ] ]

/// The truncation points a 2-entry log can be asked about.
let private truncationPoints = [ 0L; 1L; 2L ]

/// The pinned point: truncate through 2 asks every backend to drop everything it holds. Pinning it
/// is what separates the question that DISCRIMINATES backends — what happened to the data — from
/// the question every backend answers the same way, which is that the truncation argument itself
/// is not written down anywhere (measured separately below, on `InMemoryDeltaLog`).
let private pinnedTruncationPoint = 2L

let private keyEnc (i: int) = DynamicValue.Int(int64 i)

let private keyDec =
    function
    | DynamicValue.Int v -> int v
    | other -> failwithf "key not Int: %A" other

let private codec () =
    CborEntryCodec<int>(keyEnc, keyDec) :> IEntryCodec<int>

let private tempDir () =
    let d = Path.Combine(Path.GetTempPath(), "zeta-erasure-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory d |> ignore
    d

// ── the sweep primitive ───────────────────────────────────────────────────────────────────────
// Identical in shape to the WSet pack: group the domain by image, read the largest fibre.
// maxFibre = 1 <=> injective <=> Reversible. bits erased = log2(maxFibre).

let private measureLargestFibre (inputs: 'a list) (probe: 'a -> Task<string>) : Task<int> =
    task {
        let images = ResizeArray<string>()

        for input in inputs do
            let! image = probe input
            images.Add image

        return
            images
            |> Seq.toList
            |> List.groupBy id
            |> List.map (snd >> List.length)
            |> List.max
    }

// ── probes ────────────────────────────────────────────────────────────────────────────────────

/// A delta log's own read surface, rendered exactly: every surviving entry and the high-water
/// mark. This is what a recovering `RecoverableSpine` can actually see.
let private readSurface (log: IDeltaLog<int>) : Task<string> =
    task {
        let! entries = log.ReplayAsync(0L, CancellationToken.None)

        let rendered =
            entries
            |> Array.map (fun e ->
                String.Format(CultureInfo.InvariantCulture, "{0}={1}", e.Seq, e.Delta.ToString()))
            |> String.concat ","

        return String.Format(CultureInfo.InvariantCulture, "hw={0}|{1}", log.HighWater, rendered)
    }

/// Build a log, append the sequence, truncate through `t`, then observe.
let private truncationProbe
    (mkLog: unit -> IDeltaLog<int>)
    (observe: IDeltaLog<int> -> Task<string>)
    (deltas: ZSet<int> list, t: int64)
    : Task<string> =
    task {
        let log = mkLog ()

        for d in deltas do
            let! _ = log.AppendAsync(d, Map.empty, CancellationToken.None)
            ()

        do! log.TruncateAsync(t, CancellationToken.None)
        return! observe log
    }

/// Pre-states only; the truncation point is pinned.
let private pinnedDomain =
    deltaSequences |> List.map (fun s -> (s, pinnedTruncationPoint))

/// Pre-states crossed with every truncation point — the argument is part of the input, exactly as
/// `WSetHeat` treats `plus`'s ordered pair.
let private fullDomain =
    [ for s in deltaSequences do
          for t in truncationPoints -> (s, t) ]

// ── backing-store probes ──────────────────────────────────────────────────────────────────────

let private batchUniverse: ZSet<int> list =
    [ ZSet.ofSeq [ (1, 1L) ]
      ZSet.ofSeq [ (2, 1L) ]
      ZSet.ofSeq [ (3, 1L) ] ]

/// Every subset of the three reference batches — the pre-states a store can be in.
let private batchSubsets: ZSet<int> list list =
    [ for mask in 0..7 ->
        [ for i in 0..2 do
              if (mask >>> i) &&& 1 = 1 then yield batchUniverse.[i] ] ]

/// **The store's content function, observed over the whole reference universe** — not over the
/// handles we happen to have saved. That distinction matters: an observer of a post-state does not
/// get a list of what used to be in it, so asking "what does `Load` return for each of the three
/// reference hashes" is the honest reader's view. A handle that no longer loads renders `gone`,
/// which is what makes a DROP distinguishable from a SPILL — and a spill indistinguishable from
/// never having evicted, which is the whole finding at the quota sites.
let private universeHandles: obj list =
    batchUniverse
    |> List.map (fun b -> box (MerkleHash.ofBytes(ReadOnlySpan(Checkpoint.toBytes b))))

let private renderHandle (h: obj) =
    match h with
    | :? MerkleHash as m -> m.ToHex()
    | other -> other.ToString()

let private contentFunction (load: obj -> ZSet<int> option) : string =
    universeHandles
    |> List.map (fun h ->
        match load h with
        | Some z -> renderHandle h + "=" + z.ToString()
        | None -> renderHandle h + "=gone")
    |> String.concat ","

let private trySyncLoad (store: IBackingStore<int>) (h: obj) : ZSet<int> option =
    try Some(store.Load h) with _ -> None

let private tryAsyncLoad (store: IAsyncBackingStore<int>) (h: obj) : ZSet<int> option =
    try Some((store.LoadAsync(h, CancellationToken.None)).AsTask().GetAwaiter().GetResult()) with _ -> None

/// The pinned batch every `Save`/`Release` sweep uses. Arguments are pinned for the same reason
/// the truncation point is: an operation that does not record its own arguments erases them, that
/// term is universal and uninteresting, and letting it dominate would hide the question the
/// classification exists to answer — what happened to the DATA.
let private pinnedBatch = batchUniverse.[0]

/// A quota of one byte evicts on every save; a quota of one gigabyte never does. The pair is what
/// makes "eviction erases nothing" a falsifiable statement rather than a reassuring one.
let private evictingQuota = 1L
let private nonEvictingQuota = 1_000_000_000L

// ── GiftOfErasure sweeps ──────────────────────────────────────────────────────────────────────
// The module whose entire PURPOSE is that a preimage be unrecoverable, and which until now
// declared nothing. Four distinct sealed members over four contributors, all the same algorithm
// tag and length so `mix` does not refuse the batch for a silhouette leak.

module private GiftOfErasureSweeps =

    let private policy =
        match GiftOfErasure.mixPolicy 2 1 "law-pack sweep: the smallest honest floor, one colluding contributor" with
        | Ok p -> p
        | Error r -> failwith (GiftOfErasure.describe r)

    /// Four members, four contributors. No contributor name is a substring of the consent string
    /// below — `forget` refuses a consent record that names a contributor, and rightly so.
    let private universe: GiftOfErasure.SealedEvent list =
        [ for i in 0..3 ->
            { Contributor = [| "alpha"; "bravo"; "delta"; "gamma" |].[i]
              AlgorithmTag = "test-aead"
              Ciphertext = [| byte (10 + i); 0uy; 0uy; 0uy |] } ]

    let private consent = "witnessed under standing consent"

    /// Every 3-subset of the four — the sets a mix of the required size can be in.
    let private subsets3 =
        [ for skip in 0..3 ->
            universe |> List.indexed |> List.filter (fun (i, _) -> i <> skip) |> List.map snd ]

    let rec private permutations xs =
        match xs with
        | [] -> [ [] ]
        | _ ->
            xs
            |> List.collect (fun x ->
                permutations (xs |> List.filter (fun y -> y <> x)) |> List.map (fun p -> x :: p))

    let private renderMembers (ms: GiftOfErasure.SealedEvent list) =
        ms
        |> List.map (fun m -> m.Contributor + "/" + m.AlgorithmTag + "/" + String.Join("-", m.Ciphertext))
        |> String.concat ","

    let private renderSet (set: GiftOfErasure.AnonymitySet) =
        String.Format(
            CultureInfo.InvariantCulture,
            "{0}|{1}|erasures={2}",
            set.SetId,
            renderMembers set.Members,
            set.Erasures
            |> List.map (fun w ->
                String.Format(
                    CultureInfo.InvariantCulture,
                    "{0}:{1}:{2}",
                    w.Ordinal,
                    w.AnonymitySetSizeAtErasure,
                    w.EffectiveAnonymityAtErasure
                ))
            |> String.concat ";"
        )

    let private mixOrFail (members: GiftOfErasure.SealedEvent list) =
        match GiftOfErasure.mix policy "sweep-set" members with
        | Ok set -> set
        | Error r -> failwith (GiftOfErasure.describe r)

    let private largest (images: string list) =
        images |> List.groupBy id |> List.map (snd >> List.length) |> List.max

    /// `mix` destroys arrival order: every permutation of a batch lands on one canonical set.
    let mixFibre () : int =
        [ for subset in subsets3 do
              for p in permutations subset -> p ]
        |> List.map (mixOrFail >> renderSet)
        |> largest

    /// `forget` destroys the released member: two 3-sets sharing two members land on the same
    /// post-state, because the witness records the FACT and never the name.
    let forgetFibre () : int =
        [ for subset in subsets3 do
              for target in subset -> (subset, target) ]
        |> List.map (fun (subset, target) ->
            let set = mixOrFail subset

            match GiftOfErasure.forget consent (fun m -> m = target) set with
            | Ok after -> renderSet after
            | Error r -> failwith (GiftOfErasure.describe r))
        |> largest


// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE SWEEP TABLE — one row per declared, measurable (Representation, Operation, Observation).
//
// Every row here must match a declaration found by reflection, and every declaration that claims
// to be swept must appear here. Both directions are checked: a declaration nobody measures is a
// golden vector nobody reads, which is the vacuity class one level out.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

type private Sweep =
    { Representation: string
      Operation: string
      Observation: string
      Measure: unit -> Task<int> }

let private sweepKey (s: Sweep) =
    String.Format(CultureInfo.InvariantCulture, "{0}::{1}::{2}", s.Representation, s.Operation, s.Observation)

let private pinnedObservation =
    "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"

let private fullObservation =
    "the log's own read surface (ReplayAsync(0) plus HighWater), including the truncation argument"
let private contentObservation = "the store's content function (Load over every live handle)"

let private asyncContentObservation =
    "the store's content function (LoadAsync over every live handle)"

let private sweeps: Sweep list =
    [
      // ── delta logs: the same interface method, four representations ────────────────────────
      { Representation = "InMemoryDeltaLog"
        Operation = "IDeltaLog.TruncateAsync"
        Observation = pinnedObservation
        Measure =
          fun () ->
              measureLargestFibre
                  pinnedDomain
                  (truncationProbe (fun () -> InMemoryDeltaLog<int>() :> IDeltaLog<int>) readSurface) }

      { Representation = "InMemoryDeltaLog"
        Operation = "IDeltaLog.TruncateAsync"
        Observation = fullObservation
        Measure =
          fun () ->
              measureLargestFibre
                  fullDomain
                  (truncationProbe (fun () -> InMemoryDeltaLog<int>() :> IDeltaLog<int>) readSurface) }

      { Representation = "InMemoryDeltaLog"
        Operation = "IRefDeltaLog.Reset"
        Observation = "the log's own read surface: ReplayAsync(0) on the active branch after Reset"
        Measure =
          fun () ->
              // Reset overwrites the active branch with another. The source branch is untouched, so
              // the fibre is measured on the active one, which is the branch that loses its history.
              measureLargestFibre
                  [ for active in deltaSequences do
                        for source in deltaSequences -> (active, source) ]
                  (fun (active, source) ->
                      task {
                          let log = InMemoryDeltaLog<int>()
                          let asLog = log :> IDeltaLog<int>
                          let asRef = log :> IRefDeltaLog<int>

                          for d in source do
                              let! _ = asLog.AppendAsync(d, Map.empty, CancellationToken.None)
                              ()

                          asRef.Branch "refs/heads/source" |> ignore
                          asRef.Checkout "refs/heads/active" |> ignore

                          for d in active do
                              let! _ = asLog.AppendAsync(d, Map.empty, CancellationToken.None)
                              ()

                          asRef.Reset "refs/heads/source" |> ignore
                          return! readSurface asLog
                      }) }

      { Representation = "DiskDeltaLog"
        Operation = "IDeltaLog.TruncateAsync"
        Observation = pinnedObservation
        Measure =
          fun () ->
              measureLargestFibre
                  pinnedDomain
                  (truncationProbe (fun () -> DiskDeltaLog<int>(tempDir (), codec ()) :> IDeltaLog<int>) readSurface) }

      { Representation = "GroupCommitDiskDeltaLog"
        Operation = "IDeltaLog.TruncateAsync"
        Observation = pinnedObservation
        Measure =
          fun () ->
              measureLargestFibre
                  pinnedDomain
                  (truncationProbe
                      (fun () -> new GroupCommitDiskDeltaLog<int>(tempDir (), codec ()) :> IDeltaLog<int>)
                      readSurface) }

      { Representation = "ZetaFsDeltaLog"
        Operation = "IDeltaLog.TruncateAsync"
        Observation = pinnedObservation
        Measure =
          fun () ->
              measureLargestFibre
                  pinnedDomain
                  (truncationProbe (fun () -> ZetaFsStore.deltaLog (tempDir ()) (codec ()) :> IDeltaLog<int>) readSurface) }

      // The DAG observation: same operation, same representation, DIFFERENT channel, and the
      // answer flips. This row is why `Observation` is part of the key. Walking commit
      // parents from the live ref is the recovery channel (Git's shape).
      { Representation = "ZetaFsDeltaLog"
        Operation = "IDeltaLog.TruncateAsync"
        Observation = "the object DAG reachable from the live ref, walking commit parents"
        Measure =
          fun () ->
              measureLargestFibre pinnedDomain (fun (deltas, t) ->
                  task {
                      let dir = tempDir ()
                      let log = ZetaFsStore.deltaLog dir (codec ())
                      let asLog = log :> IDeltaLog<int>

                      for d in deltas do
                          let! _ = asLog.AppendAsync(d, Map.empty, CancellationToken.None)
                          ()

                      do! asLog.TruncateAsync(t, CancellationToken.None)
                      return log.ReachableDagDigest()
                  }) }

      // ── backing stores ──────────────────────────────────────────────────────────────────────
      // Two aspects of `Save`, two rows, and the split IS the correction restated at this site:
      // the erasure in `Save` lives in the CONTENT-ADDRESSING (an idempotent upsert forgets
      // whether the batch was already there), not in the quota eviction, which is where the
      // refuted lifecycle list pointed.
      { Representation = "InMemoryBackingStore"
        Operation = "IBackingStore.Save"
        Observation = contentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = InMemoryBackingStore<int>() :> IBackingStore<int>
                      for p in pre do store.Save(0, p) |> ignore
                      store.Save(0, pinnedBatch) |> ignore
                      return contentFunction (trySyncLoad store)
                  }) }

      { Representation = "InMemoryBackingStore"
        Operation = "IBackingStore.Release"
        Observation = contentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = InMemoryBackingStore<int>() :> IBackingStore<int>
                      for p in pre do store.Save(0, p) |> ignore
                      store.Release(List.head universeHandles)
                      return contentFunction (trySyncLoad store)
                  }) }

      { Representation = "DiskBackingStore"
        Operation = "IBackingStore.Save"
        Observation = contentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = DiskBackingStore<int>(tempDir (), evictingQuota) :> IBackingStore<int>
                      for p in pre do store.Save(0, p) |> ignore
                      store.Save(0, pinnedBatch) |> ignore
                      return contentFunction (trySyncLoad store)
                  }) }

      // The eviction row. Every save spills, because the quota is one byte — and the content
      // function still separates all eight pre-states, so nothing was lost on the way to disk.
      // Break `spillLocked` (drop the batch instead of writing it) and this collapses immediately.
      { Representation = "DiskBackingStore"
        Operation = "IBackingStore.Save (quota eviction via evictIfOverQuotaLocked)"
        Observation = contentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = DiskBackingStore<int>(tempDir (), evictingQuota) :> IBackingStore<int>
                      for p in pre do store.Save(0, p) |> ignore
                      return contentFunction (trySyncLoad store)
                  }) }

      { Representation = "DiskBackingStore"
        Operation = "IBackingStore.Release"
        Observation = contentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = DiskBackingStore<int>(tempDir (), evictingQuota) :> IBackingStore<int>
                      for p in pre do store.Save(0, p) |> ignore
                      store.Release(List.head universeHandles)
                      return contentFunction (trySyncLoad store)
                  }) }

      { Representation = "InMemoryAsyncBackingStore"
        Operation = "IAsyncBackingStore.SaveAsync"
        Observation = asyncContentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = InMemoryAsyncBackingStore<int>() :> IAsyncBackingStore<int>
                      for p in pre do
                          let! _ = store.SaveAsync(0, p, CancellationToken.None)
                          ()
                      let! _ = store.SaveAsync(0, pinnedBatch, CancellationToken.None)
                      return contentFunction (tryAsyncLoad store)
                  }) }

      { Representation = "InMemoryAsyncBackingStore"
        Operation = "IAsyncBackingStore.ReleaseAsync"
        Observation = asyncContentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = InMemoryAsyncBackingStore<int>() :> IAsyncBackingStore<int>
                      for p in pre do
                          let! _ = store.SaveAsync(0, p, CancellationToken.None)
                          ()
                      do! store.ReleaseAsync(List.head universeHandles, CancellationToken.None)
                      return contentFunction (tryAsyncLoad store)
                  }) }

      { Representation = "DiskAsyncBackingStore"
        Operation = "IAsyncBackingStore.SaveAsync"
        Observation = asyncContentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = DiskAsyncBackingStore<int>(tempDir (), evictingQuota) :> IAsyncBackingStore<int>
                      for p in pre do
                          let! _ = store.SaveAsync(0, p, CancellationToken.None)
                          ()
                      let! _ = store.SaveAsync(0, pinnedBatch, CancellationToken.None)
                      return contentFunction (tryAsyncLoad store)
                  }) }

      { Representation = "DiskAsyncBackingStore"
        Operation = "IAsyncBackingStore.SaveAsync (quota eviction via evictIfOverQuotaLocked)"
        Observation = asyncContentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = DiskAsyncBackingStore<int>(tempDir (), evictingQuota) :> IAsyncBackingStore<int>
                      for p in pre do
                          let! _ = store.SaveAsync(0, p, CancellationToken.None)
                          ()
                      return contentFunction (tryAsyncLoad store)
                  }) }

      { Representation = "DiskAsyncBackingStore"
        Operation = "IAsyncBackingStore.ReleaseAsync"
        Observation = asyncContentObservation
        Measure =
          fun () ->
              measureLargestFibre batchSubsets (fun pre ->
                  task {
                      let store = DiskAsyncBackingStore<int>(tempDir (), evictingQuota) :> IAsyncBackingStore<int>
                      for p in pre do
                          let! _ = store.SaveAsync(0, p, CancellationToken.None)
                          ()
                      do! store.ReleaseAsync(List.head universeHandles, CancellationToken.None)
                      return contentFunction (tryAsyncLoad store)
                  }) }

      // ── the spine's own fold: the erasure that fires on EVERY commit ────────────────────────
      // Not at the snapshot boundary, not at a GC — in the ordinary arithmetic. `ZSet.add`
      // consolidates, so a delta and its retraction annihilate and the folded state is
      // byte-identical to never having applied either. This row fires once per commit; the
      // truncation row above fires once per snapshot cadence.
      { Representation = "RecoverableSpine"
        Operation = "CommitAsync / ApplyReplayed (the fold: ZSet.add into state)"
        Observation = "the folded state returned by Consolidate()"
        Measure =
          fun () ->
              measureLargestFibre deltaSequences (fun deltas ->
                  task {
                      let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
                      let snap = InMemorySnapshotStore<int>() :> ISnapshotStore<int>
                      let spine = RecoverableSpine.create log snap

                      for d in deltas do
                          let! _ = spine.CommitAsync(d)
                          ()

                      return spine.Consolidate().ToString()
                  }) }

      // ── the composite: the spine's inherited truncation, measured end to end ────────────────
      // The row `RecoverableSpine.ErasureProfiles` inherits from its injected backend, measured on
      // the composite rather than taken on the backend's word. With cadence 1 every commit
      // snapshots and truncates, so this exercises the one snapshot-supersedes-log site in the
      // repo through the code path that actually calls it.
      { Representation = "RecoverableSpine over InMemoryDeltaLog"
        Operation = "CommitAsync (snapshot-triggered log truncation)"
        Observation = pinnedObservation
        Measure =
          fun () ->
              measureLargestFibre deltaSequences (fun deltas ->
                  task {
                      let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
                      let snap = InMemorySnapshotStore<int>() :> ISnapshotStore<int>
                      let spine = RecoverableSpine.create log snap
                      spine.AutoSnapshotEvery <- 1

                      for d in deltas do
                          let! _ = spine.CommitAsync(d)
                          ()

                      return! readSurface log
                  }) }

      // ── GiftOfErasure ───────────────────────────────────────────────────────────────────────
      { Representation = "GiftOfErasure"
        Operation = "mix"
        Observation = "the AnonymitySet returned by mix"
        Measure = fun () -> task { return GiftOfErasureSweeps.mixFibre () } }

      { Representation = "GiftOfErasure"
        Operation = "forget"
        Observation = "the AnonymitySet returned by forget"
        Measure = fun () -> task { return GiftOfErasureSweeps.forgetFibre () } }
 ]

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE DECLARERS — every representation in Zeta.Core that answers for its own erasure.
//
// A hand-written list, exactly as `WSetHeat`'s `table` is, and guarded the same way: the drift
// test below reflects over the assembly and fails if any type implementing a preimage-bearing
// interface is missing from it. Adding a backend without classifying it is a red build, not a
// silent zero.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

let private declarers: (Type * IErasureDeclaring) list =
    let spineLog = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    let spineSnap = InMemorySnapshotStore<int>() :> ISnapshotStore<int>

    [ typeof<InMemoryDeltaLog<int>>, InMemoryDeltaLog<int>() :> IErasureDeclaring
      typeof<DiskDeltaLog<int>>, DiskDeltaLog<int>(tempDir (), codec ()) :> IErasureDeclaring
      typeof<GroupCommitDiskDeltaLog<int>>,
      (new GroupCommitDiskDeltaLog<int>(tempDir (), codec ())) :> IErasureDeclaring
      typeof<ZetaFsDeltaLog<int>>, ZetaFsStore.deltaLog (tempDir ()) (codec ()) :> IErasureDeclaring
      typeof<InMemoryBackingStore<int>>, InMemoryBackingStore<int>() :> IErasureDeclaring
      typeof<DiskBackingStore<int>>, DiskBackingStore<int>(tempDir (), 1L) :> IErasureDeclaring
      typeof<InMemoryAsyncBackingStore<int>>, InMemoryAsyncBackingStore<int>() :> IErasureDeclaring
      typeof<DiskAsyncBackingStore<int>>, DiskAsyncBackingStore<int>(tempDir (), 1L) :> IErasureDeclaring
      typeof<WitnessDurableBackingStore<int>>,
      WitnessDurableBackingStore<int>(tempDir (), tempDir (), 4096) :> IErasureDeclaring
      typeof<WitnessDurableAsyncBackingStore<int>>,
      WitnessDurableAsyncBackingStore<int>(tempDir (), tempDir (), 4096) :> IErasureDeclaring
      typeof<RecoverableSpine<int>>,
      RecoverableSpine<int>(spineLog, spineSnap, ZSet<int>.Empty, 0L) :> IErasureDeclaring
      typeof<GiftOfErasureDeclaration>, GiftOfErasureDeclaration() :> IErasureDeclaring ]

let private declaredProfiles =
    declarers |> List.collect (fun (_, d) -> d.ErasureProfiles)

// ═══ 1. Declared class must equal measured class — in BOTH directions ═══
// A "reversible" operation made lossy fails. An "erasing" operation made bijective fails too:
// over-charging is exactly as wrong as under-charging, because a ledger that over-charges is
// still a ledger nobody can reconcile.

[<Fact>]
let ``every declared thermodynamic class matches the measured class`` () : Task =
    task {
        let byKey = declaredProfiles |> List.map (fun p -> ErasureClass.key p, p) |> dict
        let mismatches = ResizeArray<string>()

        for sweep in sweeps do
            let k = sweepKey sweep

            match byKey.TryGetValue k with
            | false, _ -> mismatches.Add(k + ": swept, but no representation declares it")
            | true, declared ->
                let! fibre = sweep.Measure()
                let measured = ErasureClass.ofLargestFibre fibre

                if measured <> declared.Classification then
                    mismatches.Add(
                        String.Format(
                            CultureInfo.InvariantCulture,
                            "{0}: declared {1} but measured {2} (largest fibre {3}, {4} bits-ppm)",
                            k,
                            declared.Classification,
                            measured,
                            fibre,
                            ErasureClass.bitsPpmOfLargestFibre fibre
                        )
                    )

        if mismatches.Count > 0 then
            failwith ("declared class disagrees with measured class:" + Environment.NewLine + String.Join(Environment.NewLine, mismatches))
    }

// ═══ 2. The bit count is a MEASUREMENT, not a declaration ═══
// The exact fibre and the exact ppm must match. This is the quantity a Landauer meter would take
// on trust from its caller; here it is derived from running the operation.

[<Fact>]
let ``every declared fibre and bit count matches the measured one`` () : Task =
    task {
        let byKey = declaredProfiles |> List.map (fun p -> ErasureClass.key p, p) |> dict
        let mismatches = ResizeArray<string>()

        for sweep in sweeps do
            let k = sweepKey sweep
            let declared = byKey.[k]
            let! fibre = sweep.Measure()
            let ppm = ErasureClass.bitsPpmOfLargestFibre fibre

            match ErasureClass.largestFibre declared, ErasureClass.bitsErasedPpm declared with
            | Some declaredFibre, Some declaredPpm ->
                if declaredFibre <> fibre || declaredPpm <> ppm then
                    mismatches.Add(
                        String.Format(
                            CultureInfo.InvariantCulture,
                            "{0}: declared fibre {1} / {2} ppm, measured fibre {3} / {4} ppm",
                            k,
                            declaredFibre,
                            declaredPpm,
                            fibre,
                            ppm
                        )
                    )
            | _ -> mismatches.Add(k + ": swept by this pack but declares no measurement")

        if mismatches.Count > 0 then
            failwith ("declared measurement disagrees with the sweep:" + Environment.NewLine + String.Join(Environment.NewLine, mismatches))
    }

// ═══ 3. Drift guard — a new representation cannot stay silent ═══
// Reflect over the shipped assembly. Every concrete type implementing an interface whose methods
// can destroy a preimage must implement `IErasureDeclaring`, and must be instantiated in the
// `declarers` list above so its rows are actually read. Both halves, or the guard is decorative.

let private preimageBearingInterfaces =
    [ typedefof<IDeltaLog<int, ZSet<int>>>
      typedefof<IBackingStore<int>>
      typedefof<IAsyncBackingStore<int>> ]

let private implementsPreimageBearing (t: Type) =
    t.GetInterfaces()
    |> Array.exists (fun i ->
        i.IsGenericType
        && preimageBearingInterfaces |> List.exists (fun d -> d = i.GetGenericTypeDefinition()))

[<Fact>]
let ``every concrete representation of a preimage-bearing interface declares its erasure class`` () =
    let asm = typeof<InMemoryDeltaLog<int>>.Assembly

    let candidates =
        asm.GetTypes()
        |> Array.filter (fun t -> t.IsClass && not t.IsAbstract && t.IsPublic)
        |> Array.filter implementsPreimageBearing

    // Candidates must be non-empty, or this guard is measuring nothing at all.
    candidates |> Array.isEmpty |> should equal false

    let undeclared =
        candidates
        |> Array.filter (fun t -> not (typeof<IErasureDeclaring>.IsAssignableFrom t))
        |> Array.map (fun t -> t.Name)
        |> Array.sortWith (fun a b -> String.CompareOrdinal(a, b))

    undeclared |> List.ofArray |> should be Empty

    // …and every declarer must be READ. A declaration nobody instantiates is the same defect one
    // level out: rows that exist and constrain nothing.
    let instantiated =
        declarers
        |> List.map (fun (t, _) -> if t.IsGenericType then t.GetGenericTypeDefinition().Name else t.Name)
        |> Set.ofList

    let unread =
        candidates
        |> Array.map (fun t -> if t.IsGenericType then t.GetGenericTypeDefinition().Name else t.Name)
        |> Array.filter (fun n -> not (instantiated.Contains n))
        |> Array.distinct
        |> Array.sortWith (fun a b -> String.CompareOrdinal(a, b))

    unread |> List.ofArray |> should be Empty

// ═══ 4. Internal well-formedness — a class and its evidence may not contradict ═══
// `Reversible` on no measurement is the free-by-default claim; `Unmeasured` carrying a sweep is a
// measurement pretending to be a hole. Both are refused, per declaration, with the key named.

[<Fact>]
let ``every declaration is internally consistent with its own evidence`` () =
    let violations = declaredProfiles |> List.collect ErasureClass.inconsistencies

    if not (List.isEmpty violations) then
        failwith (String.Join(Environment.NewLine, violations))

// ═══ 5. Anti-vacuity — a declaration that claims a sweep must actually be swept ═══
// The mirror of the `no-binary-in-proof-lineage` condition: a golden vector nothing reads looks
// like compliance and constrains nothing. Checked in both directions.

[<Fact>]
let ``every swept declaration is measured here and every measurement has a declaration`` () =
    let sweptKeys = sweeps |> List.map sweepKey |> Set.ofList

    let claimingSweep =
        declaredProfiles |> List.filter ErasureClass.isSwept |> List.map ErasureClass.key |> Set.ofList

    let claimedButUnmeasured = Set.difference claimingSweep sweptKeys
    let measuredButUndeclared = Set.difference sweptKeys claimingSweep

    if not (Set.isEmpty claimedButUnmeasured) then
        failwith (
            "declarations claiming a sweep that this pack never runs (a golden vector nobody reads):"
            + Environment.NewLine
            + String.Join(Environment.NewLine, claimedButUnmeasured)
        )

    if not (Set.isEmpty measuredButUndeclared) then
        failwith (
            "measurements with no declaration to check them against:"
            + Environment.NewLine
            + String.Join(Environment.NewLine, measuredButUndeclared)
        )

// ═══ 6. `Unmeasured` is never zero, and never wears a measured row's clothes ═══
// The demon this whole thread is about is a channel that reads as free because nothing watches it.
// An unmeasured operation has an UNKNOWN cost; `None` is the only honest encoding of that, and it
// is what forces every downstream fold to decide in the open.

[<Fact>]
let ``unmeasured declarations report no bit count rather than zero, and carry a written reason`` () =
    let unmeasured =
        declaredProfiles
        |> List.filter (fun p -> p.Classification = ErasureClass.ThermodynamicClass.Unmeasured)

    // The category must be inhabited — an `Unmeasured` case nobody ever uses would mean the holes
    // were quietly rounded to zero somewhere instead.
    unmeasured |> List.isEmpty |> should equal false

    for p in unmeasured do
        ErasureClass.bitsErasedPpm p |> should equal (None: int64 option)
        ErasureClass.largestFibre p |> should equal (None: int option)
        ErasureClass.isSwept p |> should equal false

        match p.Evidence with
        | ErasureClass.Evidence.NoAdmissibleMeasurement reason ->
            String.IsNullOrWhiteSpace reason |> should equal false
            // A reason has to say something; a placeholder is a hole wearing a justification.
            reason.Length |> should be (greaterThan 40)
        | other -> failwithf "Unmeasured row %s carries %A" (ErasureClass.key p) other

// ═══ 7. THE PIN — one interface method, opposite classes, decided by the backend ═══
// This is the fact that refuted the name-keyed list, and it is asserted here so that a later
// "tidy-up" which unified the backends' truncation semantics fails loudly instead of quietly
// making the surrounding argument false.

[<Fact>]
let ``the same interface method carries opposite classes across representations`` () =
    let truncations =
        declaredProfiles
        |> List.filter (fun p -> p.Operation = "IDeltaLog.TruncateAsync")

    let byObservation =
        truncations
        |> List.filter (fun p -> p.Observation.Contains("pinned truncation point", StringComparison.Ordinal))

    let classes = byObservation |> List.map (fun p -> p.Classification) |> List.distinct

    // Same method, same observation, more than one class. If this ever collapses to a single
    // class, the classification could safely live on the interface — and the whole design of
    // `IErasureDeclaring` would need revisiting rather than silently over-fitting.
    classes |> List.length |> should be (greaterThan 1)

    byObservation
    |> List.filter (fun p -> p.Classification = ErasureClass.ThermodynamicClass.Erasing)
    |> List.isEmpty
    |> should equal false

    byObservation
    |> List.filter (fun p -> p.Classification = ErasureClass.ThermodynamicClass.Reversible)
    |> List.isEmpty
    |> should equal false

// ═══ 8. The observation is load-bearing — one representation, one operation, two answers ═══
// `ZetaFsDeltaLog` truncation is Erasing through the read surface and Reversible through the
// commit DAG (parent edge). If those two rows ever agree, either ReplayAsync started walking
// parents or truncate stopped writing them, and both are facts a reader of this vocabulary needs.

[<Fact>]
let ``one representation and one operation carry different classes under different observations`` () =
    let zetaFs =
        declaredProfiles
        |> List.filter (fun p ->
            p.Representation = "ZetaFsDeltaLog" && p.Operation = "IDeltaLog.TruncateAsync")

    zetaFs |> List.length |> should be (greaterThan 1)
    zetaFs |> List.map (fun p -> p.Classification) |> List.distinct |> List.length |> should equal 2

// ═══ 9. The composite INHERITS its class from the injected backend ═══
// `RecoverableSpine.CommitAsync` is one code path. Run it over a log that declares Erasing and it
// is Erasing; over one that declares Reversible and it is Reversible; over one that declares
// nothing and it is `Unmeasured` — never free. This is the design answer to "the class attaches to
// the implementation, not the interface", exercised rather than asserted.

/// A backend that satisfies `IDeltaLog` and declares NOTHING — the third-party case a reflection
/// guard over our own assembly can never reach.
[<Sealed>]
type private UndeclaredLog<'K when 'K: comparison>() =
    let inner = InMemoryDeltaLog<'K>() :> IDeltaLog<'K>

    interface IDeltaLog<'K> with
        member _.AppendAsync(d, c, ct) = inner.AppendAsync(d, c, ct)
        member _.ReplayAsync(f, ct) = inner.ReplayAsync(f, ct)
        member _.HighWater = inner.HighWater
        member _.TruncateAsync(t, ct) = inner.TruncateAsync(t, ct)

/// A backend that declares its truncation Reversible — standing in for `GitDeltaLog`, which lives
/// in another assembly and is measured in its own pack there.
[<Sealed>]
type private PreservingLog<'K when 'K: comparison>() =
    let inner = InMemoryDeltaLog<'K>() :> IDeltaLog<'K>

    interface IDeltaLog<'K> with
        member _.AppendAsync(d, c, ct) = inner.AppendAsync(d, c, ct)
        member _.ReplayAsync(f, ct) = inner.ReplayAsync(f, ct)
        member _.HighWater = inner.HighWater
        member _.TruncateAsync(t, ct) = inner.TruncateAsync(t, ct)

    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "PreservingLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "a retaining channel supplied by the backend"
                RecoveryChannel = "the whole preimage, by construction of this test double"
                Classification = ErasureClass.ThermodynamicClass.Reversible
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("test double", 1, 0L) } ]

let private truncationRowsOf (log: IDeltaLog<int>) =
    let spine = RecoverableSpine<int>(log, InMemorySnapshotStore<int>() :> ISnapshotStore<int>, ZSet<int>.Empty, 0L)

    spine.ErasureProfiles
    |> List.filter (fun p -> p.Operation.StartsWith("CommitAsync (snapshot", StringComparison.Ordinal))

[<Fact>]
let ``the spine inherits its truncation class from the injected backend and never invents a zero`` () =
    // Erasing backend -> the composite is Erasing.
    let erasing = truncationRowsOf (InMemoryDeltaLog<int>() :> IDeltaLog<int>)
    erasing |> List.isEmpty |> should equal false

    erasing
    |> List.filter (fun p -> p.Classification = ErasureClass.ThermodynamicClass.Erasing)
    |> List.isEmpty
    |> should equal false

    // Reversible backend -> the same code path is Reversible.
    let reversible = truncationRowsOf (PreservingLog<int>() :> IDeltaLog<int>)

    reversible
    |> List.map (fun p -> p.Classification)
    |> should equal [ ErasureClass.ThermodynamicClass.Reversible ]

    // Undeclared backend -> `Unmeasured`, with no bit count. NOT zero, NOT reversible.
    let unknown = truncationRowsOf (UndeclaredLog<int>() :> IDeltaLog<int>)

    unknown
    |> List.map (fun p -> p.Classification)
    |> should equal [ ErasureClass.ThermodynamicClass.Unmeasured ]

    unknown |> List.iter (fun p -> ErasureClass.bitsErasedPpm p |> should equal (None: int64 option))

// ═══ 10. Drift guard for the module surface — GiftOfErasure ═══
// `GiftOfErasure` is a module, so reflection over interfaces cannot reach it. The mechanical
// criterion is the type signature: every public function that RETURNS an `AnonymitySet` is a state
// transition and must be classified. Projections are excluded on purpose — a non-injective
// projection HIDES (which is this module's guarantee, measured as a posterior in its own test
// pack) and destroys nothing, and a sweep of one would be the identity function, which cannot
// fail and therefore checks nothing.

[<Fact>]
let ``every GiftOfErasure function returning an AnonymitySet is classified`` () =
    let asm = typeof<GiftOfErasureDeclaration>.Assembly
    let moduleType = asm.GetType "Zeta.Core.GiftOfErasure"
    moduleType |> should not' (be null)

    let mentionsSet (t: Type) =
        t = typeof<GiftOfErasure.AnonymitySet>
        || (t.IsGenericType && t.GetGenericArguments() |> Array.exists (fun a -> a = typeof<GiftOfErasure.AnonymitySet>))

    let transitions =
        moduleType.GetMethods(BindingFlags.Public ||| BindingFlags.Static ||| BindingFlags.DeclaredOnly)
        |> Array.filter (fun mi -> mentionsSet mi.ReturnType)
        |> Array.map (fun mi -> mi.Name)
        |> Array.distinct
        |> Set.ofArray

    // Non-empty, or the criterion has stopped matching anything and the guard is decorative.
    transitions |> Set.isEmpty |> should equal false

    let declared =
        declaredProfiles
        |> List.filter (fun p -> p.Representation = "GiftOfErasure")
        |> List.map (fun p -> p.Operation)
        |> Set.ofList

    Set.difference transitions declared |> Set.toList |> should be Empty
    Set.difference declared transitions |> Set.toList |> should be Empty


// ═══ 11. The eviction falsifier, stated as a commuting square ═══
// The fibre measurement above says the evicting store separates all eight pre-states. This says
// the stronger and more legible thing directly: the content function under a quota that spills on
// EVERY save is byte-identical to the content function under a quota that never spills. Eviction
// is a relocation. Break `spillLocked` — drop the batch instead of writing it, or record the path
// after removing the heap entry and let a read interleave — and this fails on the first subset.

[<Fact>]
let ``the content function is unchanged by quota eviction - spilling relocates, it does not erase`` () =
    let divergences =
        batchSubsets
        |> List.choose (fun pre ->
            let evicting = DiskBackingStore<int>(tempDir (), evictingQuota) :> IBackingStore<int>
            let resident = DiskBackingStore<int>(tempDir (), nonEvictingQuota) :> IBackingStore<int>

            for p in pre do
                evicting.Save(0, p) |> ignore
                resident.Save(0, p) |> ignore

            let spilled = contentFunction (trySyncLoad evicting)
            let held = contentFunction (trySyncLoad resident)

            if String.Equals(spilled, held, StringComparison.Ordinal) then
                None
            else
                Some(
                    String.Format(
                        CultureInfo.InvariantCulture,
                        "subset of {0}: spilled={1} resident={2}",
                        List.length pre,
                        spilled,
                        held
                    )
                ))

    if not (List.isEmpty divergences) then
        failwith (
            "quota eviction changed what the store can return:"
            + Environment.NewLine
            + String.Join(Environment.NewLine, divergences)
        )

    // …and the async twin must agree with its sync sibling, or one of the two has drifted.
    let asyncDivergences =
        batchSubsets
        |> List.choose (fun pre ->
            let evicting = DiskAsyncBackingStore<int>(tempDir (), evictingQuota) :> IAsyncBackingStore<int>
            let resident = DiskAsyncBackingStore<int>(tempDir (), nonEvictingQuota) :> IAsyncBackingStore<int>

            for p in pre do
                evicting.SaveAsync(0, p, CancellationToken.None).AsTask().GetAwaiter().GetResult() |> ignore
                resident.SaveAsync(0, p, CancellationToken.None).AsTask().GetAwaiter().GetResult() |> ignore

            let spilled = contentFunction (tryAsyncLoad evicting)
            let held = contentFunction (tryAsyncLoad resident)

            if String.Equals(spilled, held, StringComparison.Ordinal) then None else Some spilled)

    asyncDivergences |> should be Empty
