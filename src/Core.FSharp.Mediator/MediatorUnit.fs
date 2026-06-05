namespace Zeta.Mediator.FSharp

open System.Threading.Tasks

/// The bridge between F#'s native `unit` and the C# `Zeta.Mediator.Unit`. Both are the one-valued type
/// — the type-semiring multiplicative identity `1`, exactly one inhabitant, zero bits of information —
/// so the conversion is total and information-free. F# code can author requests/handlers against the
/// hexagonal `Zeta.Mediator` port and convert at the boundary, using its native `unit` everywhere else.
/// (F# already HAS a real unit; C# lacks one, which is why the C# side owns `Zeta.Mediator.Unit`.)
///
/// This module references only the `Zeta.Mediator` port — never the underlying Mediator package.
[<RequireQualifiedAccess>]
module MediatorUnit =

    /// The single inhabitant of the C# `Zeta.Mediator.Unit`.
    let value : Zeta.Mediator.Unit = Zeta.Mediator.Unit.Value

    /// F# `unit` → C# `Zeta.Mediator.Unit` (total; one inhabitant maps to one inhabitant).
    let ofFSharp (_: unit) : Zeta.Mediator.Unit = Zeta.Mediator.Unit.Value

    /// C# `Zeta.Mediator.Unit` → F# `unit`.
    let toFSharp (_: Zeta.Mediator.Unit) : unit = ()

    /// A completed `ValueTask<Unit>` — for an F# void handler with nothing to return.
    let completedTask : ValueTask<Zeta.Mediator.Unit> = Zeta.Mediator.Unit.ValueTask

    /// Lift an F# `unit` into a completed `ValueTask<Unit>` at a handler boundary.
    let toTask (_: unit) : ValueTask<Zeta.Mediator.Unit> =
        ValueTask<Zeta.Mediator.Unit>(Zeta.Mediator.Unit.Value)
