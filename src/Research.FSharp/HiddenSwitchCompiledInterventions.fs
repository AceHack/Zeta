namespace Zeta.Research

open System
open Zeta.Core

/// Ten fixed native interventions. Returned records describe actual calls;
/// the independent checker, not this collector, judges their invariants.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledInterventions =
    type Case =
        { CaseId: string; Strategy: string; Input: obj; Before: obj; After: obj
          Events: HiddenSwitchCompiledConformance.Event[] }

    let private tapeValue (tape: HiddenSwitchCarrier.Tape) =
        {| Initial = tape.Initial; Drift = HiddenSwitchCompiledConformance.binary tape.Drift
           Errors = HiddenSwitchCompiledConformance.binary tape.Errors |}

    let collect (checkpoint: obj -> unit) guards =
        let rows = ResizeArray<Case>()
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        let mutable active: obj = null
        let mutable caseContext: obj = box (Map.empty<string, string>)
        let keep value =
            match value with Error reason -> primary <- reason | Ok _ -> ()
            value
        let runTimeline strategy tape band scorer = result {
            let observed, events = HiddenSwitchCompiledConformance.timeline checkpoint guards strategy tape band scorer
            if not observed.Episode.Complete then primary <- observed.Episode.Failure
            active <- box {| Kind = "conformance-timeline"; Strategy = strategy
                             Input = {| Tape = tapeValue tape; Effect = true; Geometry = "dot"; Palette = "fixed"
                                        ReplaceBand = band; ZeroReceipt = scorer |}
                             CaseContext = caseContext; Episode = observed.Episode; Initial = observed.Initial
                             Policy = observed.Policy |> Option.map HiddenSwitchCompiledPolicy.snapshot
                             Events = observed.Events; InterventionEvents = events; Calls = observed.Calls |}
            checkpoint active
            if not observed.Episode.Complete then return! Error observed.Episode.Failure
            return observed, events
        }
        let copyCase strategy = result {
            let counter = HiddenSwitchCompiledConformance.Counter()
            let events = ResizeArray<HiddenSwitchCompiledConformance.Event>()
            let mutable currentCells: string = null
            let retain () =
                active <- box {| Kind = "active-copy"; Strategy = strategy
                                 Input = {| Effect = true; Geometry = "dot"; Palette = "fixed" |}
                                 Cells = currentCells; Events = events.ToArray(); Calls = counter.Snapshot() |}
            let keepCopy value = retain(); keep value
            let persist () =
                retain()
                checkpoint (box {| Kind = "copy-event"; Strategy = strategy; Data = events.[events.Count - 1] |})
            let! original = HiddenSwitchCompiledConformance.cueFrame 0 |> keep
            let! alternate = HiddenSwitchCompiledConformance.cueFrame 1 |> keep
            let caller = { original with Cells = Array.copy original.Cells }
            currentCells <- HiddenSwitchCompiledConformance.cells caller.Cells
            let! initial = HiddenSwitchCompiledConformance.create counter |> keepCopy
            let! _, observed = HiddenSwitchCompiledConformance.observe counter events 0 caller initial |> keepCopy
            persist()
            let before = box {| Cells = HiddenSwitchCompiledConformance.cells caller.Cells
                                Snapshot = HiddenSwitchCompiledPolicy.snapshot observed |}
            Array.Copy(alternate.Cells, caller.Cells, caller.Cells.Length)
            currentCells <- HiddenSwitchCompiledConformance.cells caller.Cells
            let _ = HiddenSwitchCompiledConformance.addEvent events "caller-mutate" 0
                        (box {| Cells = HiddenSwitchCompiledConformance.cells original.Cells |})
                        (box {| Cells = HiddenSwitchCompiledConformance.cells caller.Cells |})
            persist()
            let! retainedChoice, retainedPolicy = HiddenSwitchCompiledConformance.choose counter guards strategy events 0 observed |> keepCopy
            persist()
            let! control = HiddenSwitchCompiledConformance.create counter |> keepCopy
            let! _, controlObserved = HiddenSwitchCompiledConformance.observe counter events 0 caller control |> keepCopy
            persist()
            let! controlChoice, controlPolicy = HiddenSwitchCompiledConformance.choose counter guards strategy events 0 controlObserved |> keepCopy
            persist()
            return { CaseId = "caller-copy-isolation/" + strategy; Strategy = strategy
                     Input = box {| Effect = true; Geometry = "dot"; Palette = "fixed" |}; Before = before
                     After = box {| Cells = HiddenSwitchCompiledConformance.cells caller.Cells
                                    RetainedChoice = retainedChoice; RetainedSnapshot = HiddenSwitchCompiledPolicy.snapshot retainedPolicy
                                    ControlObservedSnapshot = HiddenSwitchCompiledPolicy.snapshot controlObserved
                                    ControlChoice = controlChoice; ControlSnapshot = HiddenSwitchCompiledPolicy.snapshot controlPolicy |}
                     Events = events.ToArray() }
        }
        let run kind strategy = result {
            caseContext <- box {| CaseId = kind + "/" + strategy |}
            active <- box {| Kind = "intervention-stage"; CaseId = kind + "/" + strategy |}
            checkpoint active
            if kind = "caller-copy-isolation" then return! copyCase strategy
            else
                let! tape =
                    match HiddenSwitchCarrier.handTapes() |> Array.tryFind (fun (name, _) -> name = "sparse") with
                    | Some (_, value) -> Ok value
                    | None -> Error(HiddenSwitchCompiledReceipt.failure "hand-interventions" "tape" "fixed sparse hand tape is missing") |> keep
                let! baseline, _ = runTimeline strategy tape false false
                caseContext <- box {| Baseline = baseline.Episode |}
                let mutable before = box baseline.Episode
                let mutable after = box baseline.Episode
                let mutable events = [||]
                match kind with
                | "action-before-feedback" -> before <- null; events <- baseline.Events
                | "future-suffix" ->
                    let changed = { tape with Drift = Array.copy tape.Drift }
                    changed.Drift.[8] <- 1 - changed.Drift.[8]
                    let mutation = ResizeArray<HiddenSwitchCompiledConformance.Event>()
                    let _ = HiddenSwitchCompiledConformance.addEvent mutation "tape-replace" 8
                                (box {| Tape = tapeValue tape |}) (box {| Tape = tapeValue changed |})
                    caseContext <- box {| Baseline = baseline.Episode; ChangedTape = tapeValue changed; Events = mutation.ToArray() |}
                    active <- box {| Kind = "active-intervention-mutation"; CaseId = kind + "/" + strategy; Context = caseContext |}
                    checkpoint (box {| Kind = "intervention-mutation"; CaseId = kind + "/" + strategy; Data = mutation.[0] |})
                    let! altered, _ = runTimeline strategy changed false false
                    after <- box altered.Episode; events <- mutation.ToArray()
                | "scorer-receipt-noninterference" ->
                    let! altered, actualScores = runTimeline strategy tape false true
                    after <- box altered.Episode; events <- actualScores
                | "private-band-noninterference" ->
                    let! altered, actualFrames = runTimeline strategy tape true false
                    after <- box altered.Episode; events <- actualFrames
                | _ -> return! Error(HiddenSwitchCompiledReceipt.failure "hand-interventions" "kind" "requires a fixed intervention kind") |> keep
                return { CaseId = kind + "/" + strategy; Strategy = strategy
                         Input = box {| Tape = "sparse"; Effect = true; Geometry = "dot"; Palette = "fixed"; Index = 18 |}
                         Before = before; After = after; Events = events }
        }
        let execution =
            try result {
                do! ["action-before-feedback"; "future-suffix"; "scorer-receipt-noninterference"; "private-band-noninterference"; "caller-copy-isolation"]
                    |> HiddenSwitchCompiledConformance.iterate (fun kind -> result {
                        do! ["native-recursive"; "compiled-guarded"] |> HiddenSwitchCompiledConformance.iterate (fun strategy -> result {
                            let! row = run kind strategy |> keep
                            rows.Add row
                            active <- box row
                            checkpoint (box {| Kind = "intervention-case"; Data = row |})
                        })
                    })
            }
            with error -> if isNull primary then Error(HiddenSwitchCompiledConformance.exceptionFailure "hand-interventions" error) else Error primary
        rows.ToArray(), execution, (if Result.isOk execution then null else active)
