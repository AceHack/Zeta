namespace Zeta.Tests.FSharp.MediatorFixtures

open System.Threading
open System.Threading.Tasks
open Zeta.Mediator

/// An F# request authored against the C# `Zeta.Mediator` port (a marker — no members).
type FSharpPing(name: string) =
    member _.Name = name
    interface IRequest<string>

/// An F# handler for <see cref="FSharpPing"/>, implementing the C# port interface. The question this
/// fixture answers: does the C# source generator (running in the referencing edge assembly) discover a
/// handler that lives in a referenced F# assembly?
type FSharpPingHandler() =
    interface IRequestHandler<FSharpPing, string> with
        member _.Handle(request: FSharpPing, _cancellationToken: CancellationToken) : ValueTask<string> =
            ValueTask<string>("fsharp-pong:" + request.Name)
