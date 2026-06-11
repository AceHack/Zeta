namespace Zeta.Core

/// Computation expression for the repo's F# `Result<'T, 'Feedback>` convention.
/// The feedback channel stays authored by the called function; `Bind` only
/// propagates it without translating, throwing, or collapsing it to strings.
[<AutoOpen>]
module ResultComputation =

    type ResultBuilder() =
        member _.Return(value: 'T) : Result<'T, 'Feedback> = Ok value

        member _.ReturnFrom(result: Result<'T, 'Feedback>) : Result<'T, 'Feedback> = result

        member _.Bind(result: Result<'T, 'Feedback>, next: 'T -> Result<'U, 'Feedback>) : Result<'U, 'Feedback> =
            Result.bind next result

        member _.Zero() : Result<unit, 'Feedback> = Ok()

        member _.Delay(thunk: unit -> Result<'T, 'Feedback>) : unit -> Result<'T, 'Feedback> = thunk

        member _.Run(thunk: unit -> Result<'T, 'Feedback>) : Result<'T, 'Feedback> = thunk()

        member _.Combine(first: Result<unit, 'Feedback>, next: unit -> Result<'T, 'Feedback>) : Result<'T, 'Feedback> =
            match first with
            | Ok() -> next()
            | Error feedback -> Error feedback

    let result = ResultBuilder()
