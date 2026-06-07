module Zeta.Tests.Storage.DurabilityPropertyTests

open System.IO
open System.Threading
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// Property cross-check (BP-16) of the durability recovery invariant —
// the randomized companion to the deterministic DST crash harness
// (Soraya's routing). For ANY input-delta script and snapshot cadence,
// recovering from disk reconstructs the fold of all committed deltas.
// Proves the F# IMPLEMENTATION refines the recover∘crash=fold(committed) law.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None

/// A random durability scenario: a script of signed Z-set deltas (adds and
/// retractions over a small key space) plus a snapshot cadence.
type Scenario = { Ops: ZSet<int> list; Cadence: int }

let private genDelta : Gen<ZSet<int>> =
    gen {
        let! key = Gen.choose (0, 4)
        let! sign = Gen.elements [ 1; -1 ]
        let single = ZSet.ofKeys [ key ]
        return (if sign > 0 then single else ZSet.neg single)
    }

let private genScenario : Gen<Scenario> =
    gen {
        let! n = Gen.choose (0, 12)
        let! ops = Gen.listOfLength n genDelta
        let! cadence = Gen.choose (0, 4)
        return { Ops = ops; Cadence = cadence }
    }

type ScenarioArb() =
    static member S() = Arb.fromGen genScenario


[<Property(Arbitrary = [| typeof<ScenarioArb> |], MaxTest = 60)>]
let ``recovery reconstructs fold(committed) for any script + cadence`` (s: Scenario) : bool =
    let logDir = DeterministicTestPath.nextDir "dprop-log"
    let snapDir = DeterministicTestPath.nextDir "dprop-snap"
    let mkLog () = DiskDeltaLog<int>(logDir, CborEntryCodec<int>((fun (i: int) -> DynamicValue.Int(int64 i)), (function DynamicValue.Int v -> int v | o -> failwithf "key not Int: %A" o))) :> IDeltaLog<int>
    let mkSnap () = DiskSnapshotStore<int>(snapDir, CheckpointDeltaCodec<int>()) :> ISnapshotStore<int>
    try
        // Commit the whole script (with cadence → exercises snapshot + log GC).
        let expected, appliedSeq =
            let live = RecoverableSpine.create (mkLog ()) (mkSnap ())
            live.AutoSnapshotEvery <- s.Cadence
            for z in s.Ops do live.CommitAsync(z).Wait()
            live.Consolidate(), live.AppliedSeq
        // "Crash": recover from a FRESH log + snapshot store over the same dirs.
        let recovered = RecoverableSpine<int>.RecoverAsync(mkLog (), mkSnap ()).Result
        recovered.Consolidate() = expected
        && recovered.AppliedSeq = appliedSeq
        && appliedSeq = int64 s.Ops.Length
    finally
        (try Directory.Delete(logDir, true) with _ -> ())
        (try Directory.Delete(snapDir, true) with _ -> ())
