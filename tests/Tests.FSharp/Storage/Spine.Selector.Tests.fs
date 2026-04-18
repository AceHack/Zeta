module Zeta.Tests.Storage.SpineSelectorTests
#nowarn "0893"

open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// SpineSelector — auto-pick sync/async/disk from estimated working set
// (moved from SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SpineSelector picks Sync when 4x fits in budget`` () =
    // 100 entries × 24B = 2400B; budget = 10000B ≥ 4× working set.
    let mode = SpineSelector.pick 100L 24L 10_000L None
    mode |> should equal SpineMode.Sync


[<Fact>]
let ``SpineSelector picks Async when fits but no 4x headroom`` () =
    // 100 × 24 = 2400B; budget = 3000B → fits 1× but not 4×.
    let mode = SpineSelector.pick 100L 24L 3_000L None
    mode |> should equal SpineMode.Async


[<Fact>]
let ``SpineSelector picks AsyncOnDisk when budget exceeded and dir supplied`` () =
    let dir = Path.GetTempPath()
    let mode = SpineSelector.pick 1_000_000L 1024L 1024L (Some dir)
    match mode with
    | SpineMode.AsyncOnDisk d -> d |> should equal dir
    | other -> failwithf "expected AsyncOnDisk, got %A" other


[<Fact>]
let ``SpineSelector falls back to Async when budget exceeded and no dir`` () =
    // No workDir → degraded in-memory rather than crash.
    let mode = SpineSelector.pick 1_000_000L 1024L 1024L None
    mode |> should equal SpineMode.Async


[<Fact>]
let ``SpineSelector auto returns Sync for small workloads`` () =
    // A thousand 24-byte entries (24 KB) should always fit 4× in RAM.
    let mode = SpineSelector.auto 1_000L None
    mode |> should equal SpineMode.Sync


[<Fact>]
let ``SpineSelector auto returns AsyncOnDisk when size exceeds budget with dir`` () =
    // 10^13 entries @ 24B = 240TB; will always exceed memory.
    let mode = SpineSelector.auto 10_000_000_000_000L (Some "/tmp")
    match mode with
    | SpineMode.AsyncOnDisk dir -> dir |> should equal "/tmp"
    | other -> failwithf "expected AsyncOnDisk, got %A" other
