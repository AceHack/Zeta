using System;
using System.Linq.Expressions;
using System.Reactive.Linq;
using System.Reflection;

namespace Zeta.Core.CSharp.Linq;

/// <summary>
/// Query-pattern operators for the push corner.
/// </summary>
/// <remarks>
/// <para>
/// These exist because Rx's own <c>Qbservable.Join</c> is the DURATION-based
/// join (left/right window selectors), not the relational key-based join the
/// LINQ query pattern binds to. The relational join is simply not in Rx's
/// vocabulary.
/// </para>
/// <para>
/// Each method only records itself into the expression tree. The shapes are
/// deliberately identical to <see cref="System.Linq.Queryable"/>'s, which is
/// what lets <see cref="PlanTranslator"/> read both corners of the duality
/// square with one code path.
/// </para>
/// </remarks>
public static class QbservableOperators
{
    private static readonly MethodInfo WhereMethod =
        typeof(QbservableOperators).GetMethod(nameof(Where), BindingFlags.Public | BindingFlags.Static)!;

    private static readonly MethodInfo SelectMethod =
        typeof(QbservableOperators).GetMethod(nameof(Select), BindingFlags.Public | BindingFlags.Static)!;

    private static readonly MethodInfo JoinMethod =
        typeof(QbservableOperators).GetMethod(nameof(Join), BindingFlags.Public | BindingFlags.Static)!;

    private static readonly MethodInfo AsTableMethod =
        typeof(QbservableOperators).GetMethod(nameof(AsTable), BindingFlags.Public | BindingFlags.Static)!;

    /// <summary>Filter — the push-corner twin of <c>Queryable.Where</c>.</summary>
    /// <typeparam name="T">Row type.</typeparam>
    /// <param name="source">The stream to filter.</param>
    /// <param name="predicate">The predicate, as an expression tree.</param>
    /// <returns>A stream carrying the extended expression tree.</returns>
    public static IQbservable<T> Where<T>(this IQbservable<T> source, Expression<Func<T, bool>> predicate)
    {
        ArgumentNullException.ThrowIfNull(source);
        return source.Provider.CreateQuery<T>(
            Expression.Call(
                null,
                WhereMethod.MakeGenericMethod(typeof(T)),
                source.Expression,
                Expression.Quote(predicate)));
    }

    /// <summary>Project — the push-corner twin of <c>Queryable.Select</c>.</summary>
    /// <typeparam name="T">Input row type.</typeparam>
    /// <typeparam name="TResult">Output row type.</typeparam>
    /// <param name="source">The stream to project.</param>
    /// <param name="selector">The projection, as an expression tree.</param>
    /// <returns>A stream carrying the extended expression tree.</returns>
    public static IQbservable<TResult> Select<T, TResult>(this IQbservable<T> source, Expression<Func<T, TResult>> selector)
    {
        ArgumentNullException.ThrowIfNull(source);
        return source.Provider.CreateQuery<TResult>(
            Expression.Call(
                null,
                SelectMethod.MakeGenericMethod(typeof(T), typeof(TResult)),
                source.Expression,
                Expression.Quote(selector)));
    }

    /// <summary>
    /// Relational equi-join — the push-corner twin of <c>Queryable.Join</c>,
    /// and the operator Rx does not have.
    /// </summary>
    /// <typeparam name="TOuter">Left row type.</typeparam>
    /// <typeparam name="TInner">Right row type.</typeparam>
    /// <typeparam name="TKey">Join key type.</typeparam>
    /// <typeparam name="TResult">Result row type.</typeparam>
    /// <param name="outer">Left stream.</param>
    /// <param name="inner">Right stream.</param>
    /// <param name="outerKeySelector">Left key expression.</param>
    /// <param name="innerKeySelector">Right key expression.</param>
    /// <param name="resultSelector">Must be a transparent identifier.</param>
    /// <returns>A stream carrying the extended expression tree.</returns>
    public static IQbservable<TResult> Join<TOuter, TInner, TKey, TResult>(
        this IQbservable<TOuter> outer,
        IQbservable<TInner> inner,
        Expression<Func<TOuter, TKey>> outerKeySelector,
        Expression<Func<TInner, TKey>> innerKeySelector,
        Expression<Func<TOuter, TInner, TResult>> resultSelector)
    {
        ArgumentNullException.ThrowIfNull(outer);
        ArgumentNullException.ThrowIfNull(inner);
        return outer.Provider.CreateQuery<TResult>(
            Expression.Call(
                null,
                JoinMethod.MakeGenericMethod(typeof(TOuter), typeof(TInner), typeof(TKey), typeof(TResult)),
                outer.Expression,
                inner.Expression,
                Expression.Quote(outerKeySelector),
                Expression.Quote(innerKeySelector),
                Expression.Quote(resultSelector)));
    }

    /// <summary>
    /// Stream to relation. Marks this side of a join as a materialized TABLE
    /// rather than a stream: lowers to <c>ToyPlan.AsTable</c>, hence to DBSP's
    /// <c>I</c> (<c>Circuit.IntegrateZSet</c>).
    /// </summary>
    /// <remarks>
    /// This is the "join between streams and tables" the Rx / StreamInsight
    /// framing asks for, and it needs no new operator — a table is a stream
    /// you integrated. Note the retroactivity caveat on <c>ToyPlan.AsTable</c>:
    /// a stream-table join is NOT retroactive, so it does not satisfy the
    /// batch-equals-fold-of-deltas law unless the table is loaded first.
    /// </remarks>
    /// <typeparam name="T">Row type.</typeparam>
    /// <param name="source">The changelog to materialize.</param>
    /// <returns>A stream carrying the extended expression tree.</returns>
    public static IQbservable<T> AsTable<T>(this IQbservable<T> source)
    {
        ArgumentNullException.ThrowIfNull(source);
        return source.Provider.CreateQuery<T>(
            Expression.Call(
                null,
                AsTableMethod.MakeGenericMethod(typeof(T)),
                source.Expression));
    }
}
