module Zeta.Tests.Infra.TracingTests
#nowarn "0893"

open System.Diagnostics
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Tracing (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``DbspTracing source is accessible`` () =
    DbspTracing.Source |> should not' (be null)
    DbspTracing.Source.Name |> should equal "Zeta.Core"


[<Fact>]
let ``DbspTracing StartTick does not crash when no listener`` () =
    // With no ActivityListener attached, Activity is null. We need
    // to verify no NullReference.
    let act = DbspTracing.StartTick 42
    if not (isNull act) then act.Dispose()


[<Fact>]
let ``Traced.withCtx runs function without listener`` () =
    let result = Traced.withCtx (ActivityContext()) (fun () -> 42)
    result |> should equal 42
