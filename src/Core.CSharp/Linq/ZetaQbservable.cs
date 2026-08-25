using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Reactive.Linq;

namespace Zeta.Core.CSharp.Linq;

/// <summary>
/// Push corner of Meijer's duality square: <c>IQbservable&lt;T&gt;</c> over a
/// named Zeta relation — expression trees over a PUSH stream. EXPERIMENTAL.
/// </summary>
/// <remarks>
/// This is the type the "same SQL, executed as a standing subscription" idea
/// actually needs, and it is the direction <c>docs/WONT-DO.md</c> named when
/// it rejected the pull-LINQ contract. The relation it stands for is the
/// same relation the <see cref="ZetaQueryable{T}"/> sibling stands for; only
/// the execution mode differs.
/// </remarks>
/// <typeparam name="T">The row type this relation exposes to the consumer.</typeparam>
public sealed class ZetaQbservable<T> : IQbservable<T>, IZetaSourceNode
{
    private readonly ZetaQbservableProvider _provider;

    internal ZetaQbservable(ZetaQbservableProvider provider, Expression expression, string relationName, IReadOnlyList<string> columns)
    {
        _provider = provider;
        Expression = expression;
        RelationName = relationName;
        Columns = columns;
    }

    /// <summary>Create a push-corner source over a named relation.</summary>
    /// <param name="relationName">The relation name columns are qualified by.</param>
    /// <param name="columns">Declared column names.</param>
    public ZetaQbservable(string relationName, params string[] columns)
    {
        ArgumentNullException.ThrowIfNull(columns);
        _provider = new ZetaQbservableProvider();
        Expression = Expression.Constant(this);
        RelationName = relationName;
        Columns = columns;
    }

    /// <inheritdoc />
    public string RelationName { get; }

    /// <inheritdoc />
    public IReadOnlyList<string> Columns { get; }

    /// <inheritdoc />
    public Type ElementType => typeof(T);

    /// <inheritdoc />
    public Expression Expression { get; }

    /// <inheritdoc />
    public IQbservableProvider Provider => _provider;

    /// <summary>
    /// Not supported, deliberately — same reason as
    /// <see cref="ZetaQueryable{T}.GetEnumerator"/>. Subscribing is
    /// <c>ToyLowering.lower</c> in Streaming mode plus a source feed; the
    /// expression tree alone cannot supply the feed.
    /// </summary>
    /// <param name="observer">Ignored.</param>
    /// <returns>Never returns.</returns>
    /// <exception cref="NotSupportedException">Always.</exception>
    public IDisposable Subscribe(IObserver<T> observer) =>
        throw new NotSupportedException(
            "ZetaQbservable does not subscribe directly. Use PlanTranslator.Translate(query.Expression) " +
            "to obtain the ToyPlan, then ToyLowering.lower in Streaming mode.");
}
