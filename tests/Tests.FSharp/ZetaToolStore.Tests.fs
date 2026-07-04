module Zeta.Tests.ZetaToolStoreTests

open global.Xunit
open Zeta.Core

module TS = Zeta.Core.ZetaToolStore

/// Run a parsed tool and return the result + store.
let private run (tool: TS.ZetaTool) (s: TS.Store) = TS.execute tool s

[<Fact>]
let ``ZTS-1 fs_link then fs_resolve round-trips the content`` () =
    let _, s = run (TS.FsLink("a.txt", "hello")) TS.empty
    match TS.execute (TS.FsResolve "a.txt") s |> fst with
    | TS.Resolved (Some c) -> Assert.Equal("hello", c)
    | other -> Assert.Fail(sprintf "expected Resolved (Some hello), got %A" other)

[<Fact>]
let ``ZTS-2 resolve of a missing path is None`` () =
    match TS.execute (TS.FsResolve "nope") TS.empty |> fst with
    | TS.Resolved None -> ()
    | other -> Assert.Fail(sprintf "expected Resolved None, got %A" other)

[<Fact>]
let ``ZTS-3 editLocal is a COW fork; editEverywhere follows all paths sharing the node`` () =
    // x and y share the same content
    let _, s0 = run (TS.FsLink("x", "shared")) TS.empty
    let _, s1 = run (TS.FsLink("y", "shared")) s0
    let _, s2 = run (TS.FsEditEverywhere("x", "new")) s1
    Assert.Equal(Some "new", DagFs.resolve "x" s2.Fs)
    Assert.Equal(Some "new", DagFs.resolve "y" s2.Fs) // followed (shared-object edit)

    // p and q share; editLocal forks only p
    let _, s3 = run (TS.FsLink("p", "same")) s2
    let _, s4 = run (TS.FsLink("q", "same")) s3
    let _, s5 = run (TS.FsEditLocal("p", "forked")) s4
    Assert.Equal(Some "forked", DagFs.resolve "p" s5.Fs)
    Assert.Equal(Some "same", DagFs.resolve "q" s5.Fs) // COW — only p changed

[<Fact>]
let ``ZTS-4 fs_unlink removes the link`` () =
    let _, s0 = run (TS.FsLink("a", "v")) TS.empty
    let _, s1 = run (TS.FsUnlink "a") s0
    Assert.Equal(None, DagFs.resolve "a" s1.Fs)

[<Fact>]
let ``ZTS-5 db_append then query log contains the event; retract removes it from the fold`` () =
    let _, s0 = run (TS.DbAppend "grant:alice") TS.empty
    match TS.execute (TS.DbQuery "log") s0 |> fst with
    | TS.Queried events -> Assert.Contains("grant:alice", events)
    | other -> Assert.Fail(sprintf "expected Queried, got %A" other)
    // retract the grant (Z-set −1) → it leaves the net-present fold
    let s1 = TS.retract "grant:alice" s0
    match TS.execute (TS.DbQuery "log") s1 |> fst with
    | TS.Queried events -> Assert.DoesNotContain("grant:alice", events)
    | other -> Assert.Fail(sprintf "expected Queried, got %A" other)

[<Fact>]
let ``ZTS-6 the call IS an IR node - executing records a tool_call event`` () =
    let _, s = run (TS.FsLink("a", "b")) TS.empty
    let events = TS.netEvents s
    Assert.Contains("tool_call|fs_link|a|b", events)

[<Fact>]
let ``ZTS-7 parse enforces the closed surface`` () =
    let no _ = None
    let some v = fun _ -> Some v
    // off-surface refused
    match TS.parse "bash_run" no with
    | Error e -> Assert.Contains("off-surface tool refused", e)
    | Ok _ -> Assert.Fail("bash_run should be refused")
    // fs_ prefix but unknown op
    match TS.parse "fs_teleport" no with
    | Error e -> Assert.Contains("unknown tool", e)
    | Ok _ -> Assert.Fail("fs_teleport should be unknown")
    // valid single-arg
    match TS.parse "fs_resolve" (some "README.md") with
    | Ok (TS.FsResolve p) -> Assert.Equal("README.md", p)
    | other -> Assert.Fail(sprintf "expected FsResolve, got %A" other)
    // missing arg
    match TS.parse "fs_resolve" no with
    | Error e -> Assert.Contains("required", e)
    | Ok _ -> Assert.Fail("missing path should error")
