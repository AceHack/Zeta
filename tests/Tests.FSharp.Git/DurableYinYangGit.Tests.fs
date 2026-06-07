module Zeta.Tests.Git.DurableYinYangGitTests

open System
open System.IO
open System.Threading
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.Bonsai
open Zeta.Core.Git


// ═══════════════════════════════════════════════════════════════════
// The yin/yang cell evolving DURABLY on the git DB — "a git DB that unfolds."
// A YinYang cell's Acts folds its shadow inputs into Remains; the inputs ride a
// GitDeltaLog<string> (DynamicValue is NoComparison, so the event is the input's
// canonical-CBOR hex via DurableYinYang.encodeInput); crash → DurableSaga.ResumeAsync
// rebuilds the cell from git alone → exact evolved Remains.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let private codec () = CheckpointDeltaCodec<string>() :> IDeltaCodec<string>

// The cell's yang: Remains := Remains + input (accumulate the shadow inputs).
let private accumulate = Binary(Add, Param "remains", Param "input")
let private stepFn = DurableYinYang.step accumulate 1.0
let private enc (i: int64) = DurableYinYang.encodeInput (DynamicValue.Int i)

// DynamicValue is NoComparison; assert via F#'s structural `=` (uses DynamicValue.Equals).
let private dvShould (expected: DynamicValue) (actual: DynamicValue) =
    if actual = expected then () else failwithf "expected %A, got %A" expected actual

let mutable private counter = 0

let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "yinyang-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openLog (dir: string) : IDeltaLog<string> =
    let repo = new Repository(dir)
    GitDeltaLog<string>(repo, codec (), now = fixedClock) :> IDeltaLog<string>


[<Fact>]
let ``cell evolves over git inputs, then recovers the exact Remains from git alone`` () =
    withRepoDir (fun dir ->
        (let log = openLog dir
         let cell = DurableSaga.start log stepFn (DynamicValue.Int 0L)
         cell.AppendAsync(enc 5L).Wait() // 0 + 5  = 5
         cell.AppendAsync(enc 7L).Wait() // 5 + 7  = 12
         cell.AppendAsync(enc 3L).Wait() // 12 + 3 = 15
         cell.State |> dvShould (DynamicValue.Int 15L))
        // "Crash": discard the cell; resume the evolution from the git log alone.
        let log2 = openLog dir
        let resumed = DurableSaga<DynamicValue, string>.ResumeAsync(log2, stepFn, DynamicValue.Int 0L).Result
        resumed.State |> dvShould (DynamicValue.Int 15L)
        if resumed.AppliedSeq <> 3L then failwithf "expected AppliedSeq 3, got %d" resumed.AppliedSeq)


[<Fact>]
let ``a fresh cell on an empty git repo is at its initial Remains`` () =
    withRepoDir (fun dir ->
        let log = openLog dir
        let resumed = DurableSaga<DynamicValue, string>.ResumeAsync(log, stepFn, DynamicValue.Int 0L).Result
        resumed.State |> dvShould (DynamicValue.Int 0L)
        if resumed.AppliedSeq <> 0L then failwithf "expected AppliedSeq 0, got %d" resumed.AppliedSeq)
