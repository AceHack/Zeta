namespace Zeta.Core

open System
open System.Runtime.CompilerServices


/// A small `Fn<'A,'B>` wrapper that accepts both F# functions (`'A -> 'B`)
/// and `Func<'A,'B>` delegates at call sites via implicit conversion. Saves
/// every call from needing `Func<_, _>(fun x -> ...)` boilerplate without
/// giving up C# callability.
[<Struct; IsReadOnly>]
type Fn<'A, 'B> =
    val private fn: Func<'A, 'B>
    new(f: Func<'A, 'B>) = { fn = f }

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    member this.Invoke(x: 'A) : 'B = this.fn.Invoke x

    static member Of(f: 'A -> 'B) : Fn<'A, 'B> = Fn(Func<'A, 'B>(f))
    static member op_Implicit(f: Func<'A, 'B>) : Fn<'A, 'B> = Fn f


/// F#-idiomatic circuit construction via a computation expression.
///
/// ```fsharp
/// let build : Circuit -> OutputHandle<ZSet<int>> =
///     circuit {
///         let! input = Dsl.zsetInput<int>
///         let! doubled = input.Stream |> Dsl.map (fun x -> x * 2)
///         let! filtered = doubled |> Dsl.filter (fun x -> x > 5)
///         return! filtered |> Dsl.output
///     }
///
/// let c = Circuit.create ()
/// let handle = build.Invoke c
/// ```
///
/// The CE is a reader monad over `Circuit`. Every builder method is `inline`
/// with `[<InlineIfLambda>]`, so at build time the entire chain flattens to
/// the underlying method calls — no `FSharpFunc` allocation.
type CircuitM<'T> = delegate of Circuit -> 'T


[<Sealed>]
type CircuitBuilder() =
    member inline _.Return(x: 'T) = CircuitM(fun _ -> x)
    member inline _.ReturnFrom(m: CircuitM<'T>) = m
    member inline _.Bind
        ([<InlineIfLambda>] m: CircuitM<'T>,
         [<InlineIfLambda>] f: 'T -> CircuitM<'U>) =
        CircuitM(fun c -> (f (m.Invoke c)).Invoke c)
    member inline _.Zero() = CircuitM(ignore)
    member inline _.Delay([<InlineIfLambda>] f: unit -> CircuitM<'T>) = f ()
    member inline _.Combine(m1: CircuitM<unit>, m2: CircuitM<'T>) =
        CircuitM(fun c -> m1.Invoke c; m2.Invoke c)


/// Lifted primitives and combinators for the `circuit { }` CE. Use with
/// `open Zeta.Core.Dsl` in F# sources.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Dsl =

    /// The CE instance — spell it lowercase `circuit` for DSL-like syntax.
    let circuit = CircuitBuilder()

    [<GeneralizableValue>]
    let zsetInput<'K when 'K : comparison> : CircuitM<ZSetInputHandle<'K>> =
        CircuitM(fun c -> c.ZSetInput<'K>())

    [<GeneralizableValue>]
    let scalarInput<'T> : CircuitM<ScalarInputHandle<'T>> =
        CircuitM(fun c -> c.ScalarInput<'T>())

    let inline map ([<InlineIfLambda>] f: 'A -> 'B) (s: Stream<ZSet<'A>>) : CircuitM<Stream<ZSet<'B>>> =
        CircuitM(fun c -> c.Map(s, Func<_, _>(f)))

    let inline filter ([<InlineIfLambda>] p: 'K -> bool) (s: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.Filter(s, Func<_, _>(p)))

    let inline flatMap ([<InlineIfLambda>] f: 'A -> ZSet<'B>) (s: Stream<ZSet<'A>>) : CircuitM<Stream<ZSet<'B>>> =
        CircuitM(fun c -> c.FlatMap(s, Func<_, _>(f)))

    let plus (a: Stream<ZSet<'K>>) (b: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.Plus(a, b))

    let minus (a: Stream<ZSet<'K>>) (b: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.Minus(a, b))

    let distinct (s: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.Distinct s)

    let delay (s: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.DelayZSet s)

    let integrate (s: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.IntegrateZSet s)

    let differentiate (s: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.DifferentiateZSet s)

    let output (s: Stream<'T>) : CircuitM<OutputHandle<'T>> =
        CircuitM(fun c -> c.Output s)

    let inline join
        ([<InlineIfLambda>] keyA: 'A -> 'K)
        ([<InlineIfLambda>] keyB: 'B -> 'K)
        ([<InlineIfLambda>] combine: 'A -> 'B -> 'C)
        (a: Stream<ZSet<'A>>)
        (b: Stream<ZSet<'B>>)
            : CircuitM<Stream<ZSet<'C>>> when 'K : not null =
        CircuitM(fun c ->
            c.Join(a, b, Func<_, _>(keyA), Func<_, _>(keyB), Func<_, _, _>(combine)))

    let count (key: 'K -> 'G) (s: Stream<ZSet<'K>>) : CircuitM<Stream<ZSet<'G * int64>>>
        when 'G : comparison and 'G : not null =
        CircuitM(fun c -> c.GroupByCount(s, Func<_, _>(key)))

    let scalarCount (s: Stream<ZSet<'K>>) : CircuitM<Stream<int64>> =
        CircuitM(fun c -> c.ScalarCount s)
