// This file contains two tightly-related types that form the fluent C# builder
// surface: `ZetaCircuitBuilder<T>` (the chain) and `CircuitBuilderExtensions`
// (the entry-point extension). They are in one file by namespace-concept, not
// one-type-per-file; `CircuitBuilderExtensions` carries a MA0048 suppression.
using System;
using System.Diagnostics.CodeAnalysis;
using Zeta.Core;

namespace Zeta.Core.CSharp;

/// <summary>
/// Fluent builder for constructing Zeta Z-set operator pipelines from C#.
/// </summary>
/// <remarks>
/// <para>
/// Enter the chain with <see cref="CircuitBuilderExtensions.From{T}(Circuit,Stream{Zeta.Core.ZSet{T}})"/>
/// and terminate with <see cref="Build"/> to obtain an <see cref="OutputHandle{T}"/>.
/// </para>
/// <para>
/// Each method registers the corresponding operator with the owning
/// <see cref="Circuit"/> and returns a new builder over the result stream.
/// All operators delegate to the F# <c>Operators.fs</c> implementation —
/// one cost model, one semantic definition, zero behavioural divergence.
/// </para>
/// </remarks>
/// <typeparam name="T">Element type of the Z-set stream.</typeparam>
public sealed class ZetaCircuitBuilder<T>
{
    private readonly Circuit _circuit;
    private readonly Stream<global::Zeta.Core.ZSet<T>> _stream;

    internal ZetaCircuitBuilder(Circuit circuit, Stream<global::Zeta.Core.ZSet<T>> stream)
    {
        _circuit = circuit;
        _stream = stream;
    }

    /// <summary>Projects each element through <paramref name="selector"/>.</summary>
    public ZetaCircuitBuilder<TResult> Map<TResult>(Func<T, TResult> selector)
        => new(_circuit, _circuit.Map(_stream, selector));

    /// <summary>Retains only elements satisfying <paramref name="predicate"/>.</summary>
    public ZetaCircuitBuilder<T> Filter(Func<T, bool> predicate)
        => new(_circuit, _circuit.Filter(_stream, predicate));

    /// <summary>Flattens each element to a Z-set of <typeparamref name="TResult"/> values.</summary>
    public ZetaCircuitBuilder<TResult> FlatMap<TResult>(Func<T, global::Zeta.Core.ZSet<TResult>> selector)
        => new(_circuit, _circuit.FlatMap(_stream, selector));

    /// <summary>
    /// Collapses multiplicities: elements with positive weight become weight 1;
    /// elements with zero or negative weight are removed.
    /// </summary>
    public ZetaCircuitBuilder<T> Distinct()
        => new(_circuit, _circuit.Distinct(_stream));

    /// <summary>
    /// Integrates (accumulates across ticks) the delta stream into a running snapshot.
    /// Equivalent to a continuously-maintained <c>SELECT … FROM …</c> materialised view.
    /// </summary>
    public ZetaCircuitBuilder<T> Integrate()
        => new(_circuit, _circuit.IntegrateZSet(_stream));

    /// <summary>
    /// Joins this stream with <paramref name="other"/> on matching keys extracted by
    /// <paramref name="keyLeft"/> and <paramref name="keyRight"/>, combining matched
    /// pairs with <paramref name="combine"/>.
    /// </summary>
    /// <typeparam name="TRight">Element type of the right-hand stream.</typeparam>
    /// <typeparam name="TKey">Join-key type; must be non-null and comparable.</typeparam>
    /// <typeparam name="TResult">Output element type.</typeparam>
    public ZetaCircuitBuilder<TResult> Join<TRight, TKey, TResult>(
        ZetaCircuitBuilder<TRight> other,
        Func<T, TKey> keyLeft,
        Func<TRight, TKey> keyRight,
        Func<T, TRight, TResult> combine)
        where TKey : notnull
        => new(_circuit, _circuit.Join(_stream, other._stream, keyLeft, keyRight, combine));

    /// <summary>
    /// Groups elements by <paramref name="key"/> and sums the <see cref="long"/> values
    /// extracted by <paramref name="value"/>. The output stream contains
    /// <c>(group, sum)</c> value-tuples.
    /// </summary>
    /// <typeparam name="TGroup">Group-key type; must be non-null and comparable.</typeparam>
    public ZetaCircuitBuilder<(TGroup, long)> GroupBySum<TGroup>(
        Func<T, TGroup> key,
        Func<T, long> value)
        where TGroup : notnull
    {
        // F# tuples compile to System.Tuple (reference type); Map converts to
        // C# ValueTuple so downstream chain and indexer use idiomatic (G, long).
        var s = _circuit.GroupBySum(_stream, key, value);
        return new(_circuit, _circuit.Map(s, t => (t.Item1, t.Item2)));
    }

    /// <summary>
    /// Returns the underlying <see cref="Stream{T}"/> for use with Circuit APIs
    /// not exposed on this builder (e.g. <c>SpeculativeWindow</c> for temporal windowing).
    /// </summary>
    public Stream<global::Zeta.Core.ZSet<T>> ToStream() => _stream;

    /// <summary>
    /// Registers an output handle for the current stream.
    /// After each <see cref="Circuit.StepAsync()"/>, read results from
    /// <see cref="OutputHandle{T}.Current"/>.
    /// </summary>
    public OutputHandle<global::Zeta.Core.ZSet<T>> Build() => _circuit.Output(_stream);
}

/// <summary>Entry-point extension that begins a <see cref="ZetaCircuitBuilder{T}"/> chain.</summary>
[SuppressMessage("Design", "MA0048:File name must match type name",
    Justification = "Entry-point extension collected with ZetaCircuitBuilder<T> by namespace concept; see file header.")]
public static class CircuitBuilderExtensions
{
    /// <summary>
    /// Wraps <paramref name="stream"/> in a <see cref="ZetaCircuitBuilder{T}"/> so
    /// operator calls can be chained without re-specifying the circuit on each call.
    /// </summary>
    /// <example>
    /// <code>
    /// var output = circuit
    ///     .From(input.Stream)
    ///     .Filter(x => x > 0)
    ///     .Map(x => x * 2)
    ///     .Distinct()
    ///     .Build();
    /// </code>
    /// </example>
    public static ZetaCircuitBuilder<T> From<T>(this Circuit circuit, Stream<global::Zeta.Core.ZSet<T>> stream)
        => new(circuit, stream);
}
