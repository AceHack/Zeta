module Zeta.Tests.Git.SubstrateFerryGitTests

open System
open System.IO
open System.Threading
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.Git
open Zeta.Core.FSharp.ObserveBridge

module E = Zeta.Core.FSharp.ObserveBridge.Effects

// ═══════════════════════════════════════════════════════════════════
// Bridge D substrate on git: PersistFerry appends the ferried content to a dedicated
// GitDeltaLog<string> ferry stream; the ferry history recovers from git alone.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let private codec () = CborEntryCodec<string>((fun (s: string) -> DynamicValue.String s), (function DynamicValue.String s -> s | o -> failwithf "key not String: %A" o)) :> IEntryCodec<string>

let mutable private counter = 0
let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "ferry-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openLog (dir: string) : IDeltaLog<string> =
    let repo = new Repository(dir)
    GitDeltaLog<string>(repo, codec (), now = fixedClock) :> IDeltaLog<string>

let private contents (log: IDeltaLog<string>) =
    log.ReplayAsync(0L, ct).AsTask().Result
    |> Array.collect (fun e -> e.Delta |> Seq.map (fun entry -> entry.Key) |> Seq.toArray)
    |> Array.toList

[<Fact>]
let ``PersistFerry writes the ferry stream to git; it recovers from git alone`` () =
    withRepoDir (fun dir ->
        (let log = openLog dir
         let h = SubstrateEffectHandler("otto", (fun () -> Some "operator ferried verbatim"), log) :> E.IEffectHandler
         Assert.Equal(E.Executed, (E.runAsync h E.PersistFerry ct).Result))
        // "Crash": a fresh GitDeltaLog over the same repo replays the ferry stream.
        let log2 = openLog dir
        Assert.Equal<string list>([ "operator ferried verbatim" ], contents log2))
