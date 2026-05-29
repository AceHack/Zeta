// This file is a deliberate "collected variance-related F#-interop
// types" module: one namespace-concept-per-file, not one type-per-file.
// The four types below are tightly related — each is a declaration-site-
// variant shape F# cannot express natively — and read as a unit. Each
// carries an individual [SuppressMessage] for MA0048. Split the file
// (lifting the suppressions) if it grows past roughly six types or if
// the types diverge in purpose.

using System;
using System.Diagnostics.CodeAnalysis;
using System.Threading;
using System.Threading.Tasks;
using Zeta.Core;

namespace Zeta.Core.CSharp;

/// <summary>
/// Declaration-site-variant interfaces that C# can express but F#
/// can't (F# doesn't support <c>in</c>/<c>out</c> on generic type
/// parameters — they must be inferred, which sometimes yields
/// invariant when co- or contra-variance would actually hold).
/// </summary>
///
/// <remarks>
/// <para>Variance rules in .NET require the interface be generic and
/// the <c>in</c>/<c>out</c> annotations to appear at declaration
/// site. F# can consume these (it honours runtime variance) but
/// cannot produce them syntactically. This shim project keeps the
/// variant shapes and forwards to the F# core impls.</para>
/// </remarks>

/// <summary>
/// Covariant sink — a producer-only interface over <typeparamref name="T"/>.
/// </summary>
/// <typeparam name="T">Element type; covariant.</typeparam>
[SuppressMessage("Design", "MA0048:File name must match type name",
    Justification = "Variance-related F#-interop types collected by namespace concept; see file header.")]
public interface ICovariantSink<out T> where T : IComparable<T>
{
    /// <summary>Mode the sink was configured for.</summary>
    public DeliveryMode Mode { get; }
}

/// <summary>
/// Contravariant hash strategy — consumes keys of any supertype.
/// </summary>
/// <typeparam name="TKey">Key type; contravariant.</typeparam>
[SuppressMessage("Design", "MA0048:File name must match type name",
    Justification = "Variance-related F#-interop types collected by namespace concept; see file header.")]
public interface IContravariantHashStrategy<in TKey>
{
    /// <summary>Compute a 32-bit hash of <paramref name="key"/>.</summary>
    public uint Hash(TKey key);
}

/// <summary>
/// Covariant backing store — produces values of the underlying key
/// type that a base-typed consumer can legitimately read.
/// </summary>
/// <typeparam name="TKey">Key type; covariant.</typeparam>
[SuppressMessage("Design", "MA0048:File name must match type name",
    Justification = "Variance-related F#-interop types collected by namespace concept; see file header.")]
public interface ICovariantBackingStore<out TKey> where TKey : IComparable<TKey>
{
    /// <summary>Number of batches currently stored.</summary>
    public int Count { get; }
}

/// <summary>
/// Builder-style fluent extensions that feel natural to C# callers.
/// These delegate to the F# <c>Pipeline</c> module so there's one
/// implementation, one cost model, and zero behavioural divergence.
/// </summary>
[SuppressMessage("Design", "MA0048:File name must match type name",
    Justification = "Variance-related F#-interop types collected by namespace concept; see file header.")]
public static class StreamExtensions
{
    /// <summary>
    /// Materialise the most recent tick's output as a plain array.
    /// Equivalent to <c>output.Current</c> after awaiting a <c>StepAsync</c>.
    /// </summary>
    /// <typeparam name="T">Element type.</typeparam>
    /// <param name="handle">Output handle to snapshot.</param>
    /// <returns>A newly-allocated array of Z-entries.</returns>
    public static ZEntry<T>[] Snapshot<T>(this OutputHandle<ZSet<T>> handle)
        where T : IComparable<T>
    {
        var zs = handle.Current;
        var span = zs.AsSpan();
        var result = new ZEntry<T>[span.Length];
        span.CopyTo(result);
        return result;
    }
}
