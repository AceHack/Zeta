namespace Zeta.Core

open System
open System.Runtime.CompilerServices


/// Fluent LINQ-style extension methods on `Stream<ZSet<_>>` so both F# and
/// C# callers can chain operators without the usual `c.Map(s, ...)` /
/// `c.Filter(s, ...)` re-spelling.
///
/// ```fsharp
/// let result =
///     input.Stream
///         .Where(c, fun x -> x > 0)
///         .Select(c, fun x -> x * 2)
///         .Distinct(c)
/// ```
///
/// ```csharp
/// var result = input.Stream
///     .Where(c, x => x > 0)
///     .Select(c, x => x * 2)
///     .Distinct(c);
/// ```
///
/// This is *not* a re-implementation of F#'s `query { }` CE — that one is
/// built for `IQueryable` providers and doesn't compose well with the
/// stream-of-Z-sets model. Instead, the extensions below give users a
/// LINQ-familiar surface while preserving every ms of the DBSP fast path.
///
/// For an F#-idiomatic monadic builder see `Dsl.circuit { ... }` in
/// `Dsl.fs`.
[<Extension>]
type StreamLinqExtensions =

    /// Project each row through `f`.
    [<Extension>]
    static member inline Select<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit, f: Func<'A, 'B>) : Stream<ZSet<'B>> =
        c.Map(this, f)

    /// Keep rows for which `predicate` is true.
    [<Extension>]
    static member inline Where<'A when 'A : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit, predicate: Func<'A, bool>) : Stream<ZSet<'A>> =
        c.Filter(this, predicate)

    /// SelectMany — fan-out each row into a Z-set of derived rows.
    [<Extension>]
    static member inline SelectMany<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit, f: Func<'A, ZSet<'B>>) : Stream<ZSet<'B>> =
        c.FlatMap(this, f)

    /// Deduplicate — collapse weights to {0,1} (set semantics).
    [<Extension>]
    static member inline Distinct<'A when 'A : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit) : Stream<ZSet<'A>> =
        c.Distinct this

    /// Union with another Z-set stream.
    [<Extension>]
    static member inline Union<'A when 'A : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit, other: Stream<ZSet<'A>>) : Stream<ZSet<'A>> =
        c.Plus(this, other)

    /// Difference (subtraction with negative weights).
    [<Extension>]
    static member inline Except<'A when 'A : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit, other: Stream<ZSet<'A>>) : Stream<ZSet<'A>> =
        c.Minus(this, other)

    /// Count distinct rows — returns a scalar stream.
    [<Extension>]
    static member inline Count<'A when 'A : comparison>
        (this: Stream<ZSet<'A>>, c: Circuit) : Stream<int64> =
        c.ScalarCount this

    /// Inner equi-join via key functions.
    [<Extension>]
    static member inline Join<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Stream<ZSet<'A>>,
         c: Circuit,
         other: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>,
         keyB: Func<'B, 'K>,
         combine: Func<'A, 'B, 'C>) : Stream<ZSet<'C>> =
        c.Join(this, other, keyA, keyB, combine)
