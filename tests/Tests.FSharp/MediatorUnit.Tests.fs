module Zeta.Tests.MediatorUnitTests

open System.Threading.Tasks
open global.Xunit
open Zeta.Mediator.FSharp

// ═══════════════════════════════════════════════════════════════════
// F# unit ↔ Zeta.Mediator.Unit bridge — F# uses its native `unit`, hexagonal into the mediator port.
// Both are the one-valued `1` (terminal object, zero bits), so the conversion is total and round-trips.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``F# unit converts to the C# Zeta.Mediator.Unit value`` () =
    Assert.Equal(Zeta.Mediator.Unit.Value, MediatorUnit.ofFSharp ())
    Assert.Equal(Zeta.Mediator.Unit.Value, MediatorUnit.value)

[<Fact>]
let ``the bridge round-trips F# unit through Zeta.Mediator.Unit`` () =
    let roundTripped : unit = () |> MediatorUnit.ofFSharp |> MediatorUnit.toFSharp
    Assert.Equal((), roundTripped)

[<Fact>]
let ``completedTask yields the unit value`` () =
    task {
        let! r = MediatorUnit.completedTask
        Assert.Equal(Zeta.Mediator.Unit.Value, r)
    }

[<Fact>]
let ``toTask lifts F# unit into a completed ValueTask of Unit`` () =
    task {
        let! r = MediatorUnit.toTask ()
        Assert.Equal(Zeta.Mediator.Unit.Value, r)
    }
