module Zeta.Tests.Storage.DurableSagaTests

open System.Collections.Generic
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// DurableSaga — durable workflow at the control→data-plane seam.
// Headline: a saga reacts to RETRACTION events and COMPENSATES, keeping
// even a non-retractable external surface consistent; recovery replays
// applies + compensations without re-firing external effects.
// ═══════════════════════════════════════════════════════════════════


// ─── Reservation saga: state = active reservation ids; +1 reserve, -1 release.
let private reserveStep (s: Set<string>) (id: string) (w: int64) : Set<string> =
    if w > 0L then Set.add id s
    elif w < 0L then Set.remove id s
    else s


[<Fact>]
let ``apply + compensate evolves saga state`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let saga = DurableSaga.start log reserveStep Set.empty
    saga.AppendAsync("A").Wait()
    saga.AppendAsync("B").Wait()
    saga.RetractAsync("B").Wait()          // compensation
    saga.State |> should equal (Set.ofList [ "A" ])
    saga.AppliedSeq |> should equal 3L


[<Fact>]
let ``resume replays applies AND compensations from the log`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let saga = DurableSaga.start log reserveStep Set.empty
    for id in [ "A"; "B"; "C" ] do saga.AppendAsync(id).Wait()
    saga.RetractAsync("B").Wait()
    // Crash: rebuild from the log alone.
    let resumed = DurableSaga<Set<string>, string>.ResumeAsync(log, reserveStep, Set.empty).Result
    resumed.State |> should equal (Set.ofList [ "A"; "C" ])
    resumed.AppliedSeq |> should equal 4L


[<Fact>]
let ``saga keeps a NON-RETRACTABLE surface consistent via compensation, replay-safe`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    // External non-retractable surface: an append-only effect ledger. Effects
    // fire ONCE at emit time (the saga is the connector Z-set→external surface);
    // replay must NOT re-fire them — it only rebuilds state.
    let external = List<string>()
    let saga = DurableSaga.start log reserveStep Set.empty
    saga.AppendAsync("A").Wait();  external.Add "reserve A"
    saga.AppendAsync("B").Wait();  external.Add "reserve B"
    saga.RetractAsync("B").Wait(); external.Add "release B"   // compensate the surface
    saga.State |> should equal (Set.ofList [ "A" ])
    List.ofSeq external |> should equal [ "reserve A"; "reserve B"; "release B" ]
    // Crash + resume: state rebuilt from the log; external surface untouched.
    let resumed = DurableSaga<Set<string>, string>.ResumeAsync(log, reserveStep, Set.empty).Result
    resumed.State |> should equal (Set.ofList [ "A" ])
    external.Count |> should equal 3       // replay did not duplicate external effects


// ─── Workflow saga: a two-phase agent handshake state machine.
type private Phase = Idle | Proposed | Accepted | Committed | Aborted
type private Ev = Propose | Accept | Commit | Abort

let private handshake (p: Phase) (e: Ev) (_w: int64) : Phase =
    match p, e with
    | Idle, Propose -> Proposed
    | Proposed, Accept -> Accepted
    | Accepted, Commit -> Committed
    | _, Abort -> Aborted
    | _ -> p                                // invalid transition: ignore


[<Fact>]
let ``handshake saga drives a workflow and recovers its phase`` () =
    let log = InMemoryDeltaLog<Ev>() :> IDeltaLog<Ev>
    let saga = DurableSaga.start log handshake Idle
    saga.AppendAsync(Propose).Wait()
    saga.AppendAsync(Accept).Wait()
    saga.AppendAsync(Commit).Wait()
    saga.State |> should equal Committed
    let resumed = DurableSaga<Phase, Ev>.ResumeAsync(log, handshake, Idle).Result
    resumed.State |> should equal Committed


[<Fact>]
let ``handshake abort short-circuits to Aborted`` () =
    let log = InMemoryDeltaLog<Ev>() :> IDeltaLog<Ev>
    let saga = DurableSaga.start log handshake Idle
    saga.AppendAsync(Propose).Wait()
    saga.AppendAsync(Abort).Wait()
    saga.State |> should equal Aborted
