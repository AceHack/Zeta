module Zeta.Tests.Git.DurableDiplomacyGitTests

open System
open System.IO
open System.Threading
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.Git

module D = Zeta.Core.Diplomacy
module DD = Zeta.Core.DurableDiplomacy

// ═══════════════════════════════════════════════════════════════════
// Cached polymorphic diplomacy OVER AN INFINITE STREAM, on the git DB: agreements ride a
// GitDeltaLog<string>; crash → the shape-keyed cache is rebuilt by folding the git stream.
// ═══════════════════════════════════════════════════════════════════

let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let private codec () = CborEntryCodec<string>((fun (s: string) -> DynamicValue.String s), (function DynamicValue.String s -> s | o -> failwithf "key not String: %A" o)) :> IEntryCodec<string>

let private cellOf (remains: DynamicValue) (names: string list) : YinYang.Cell =
    let acts =
        names |> List.fold (fun acc n -> Bonsai.Binary(Bonsai.Add, Bonsai.Call(n, []), acc)) (Bonsai.Const Bonsai.CNull)
    { YinYang.Remains = remains; YinYang.Acts = acts }

let mutable private counter = 0

let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "ddip-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openLog (dir: string) : IDeltaLog<string> =
    let repo = new Repository(dir)
    GitDeltaLog<string>(repo, codec (), now = fixedClock) :> IDeltaLog<string>


[<Fact>]
let ``agreement stream persists on git and the cache recovers from git alone`` () =
    withRepoDir (fun dir ->
        let a = cellOf (DynamicValue.Int 1L) [ D.ExitCapability; "trade" ]
        let b = cellOf (DynamicValue.Int 9L) [ D.ExitCapability; "trade" ]
        let noExit = cellOf (DynamicValue.Int 3L) [ "trade" ]  // freedom-first will refuse
        let outA, evA = DD.recordEvent a b
        let outR, evR = DD.recordEvent a noExit
        (let log = openLog dir
         let saga = DurableSaga.start log DD.step DD.empty
         saga.AppendAsync(evA).Wait()
         saga.AppendAsync(evR).Wait()
         Assert.Equal(Some outA, DD.lookup saga.State a b))
        // "Crash": rebuild the shape-keyed cache by folding the git agreement stream.
        let log2 = openLog dir
        let resumed = DurableSaga<DD.DurableCache, string>.ResumeAsync(log2, DD.step, DD.empty).Result
        Assert.Equal(Some outA, DD.lookup resumed.State a b)
        Assert.Equal(Some outR, DD.lookup resumed.State a noExit)
        // The refused agreement is faithfully a RefusedNoExit (freedom-first held).
        match DD.lookup resumed.State a noExit with
        | Some(D.RefusedNoExit(true, false)) -> ()
        | other -> Assert.True(false, sprintf "expected RefusedNoExit(true,false), got %A" other))
