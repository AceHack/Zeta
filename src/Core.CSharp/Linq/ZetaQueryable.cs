using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;

namespace Zeta.Core.CSharp.Linq;

/// <summary>
/// Pull corner of Meijer's duality square: <c>IQueryable&lt;T&gt;</c> over a
/// named Zeta relation. EXPERIMENTAL — a translation front end, not an
/// execution surface.
/// </summary>
/// <remarks>
/// <para>
/// <b>On <c>docs/WONT-DO.md</c>.</b> That file rejected a
/// "JDBC-like driver / DB-API / <c>IQueryable</c> provider" on 2026-04-17,
/// and the objection was specific: <i>"<c>IQueryable</c> forces a
/// synchronous-execution contract ... that doesn't compose with DBSP's
/// build-then-step model."</i> That objection is correct, and this type does
/// not take the rejected contract: <see cref="GetEnumerator"/> throws, and
/// the provider's <c>Execute</c> returns a PLAN rather than results. The same
/// entry says explicitly <i>"What's rejected here is the pull-LINQ contract,
/// not the expression-tree substrate"</i> and names <c>IQbservable</c> as the
/// direction — which is the sibling type in this folder.
/// </para>
/// <para>
/// The entry's own "Revisit when" clause names both triggers that have now
/// fired: a workload that needs <c>IQueryable</c> compatibility, and the
/// start of <c>IQbservable</c> work re-adjudicating the expression-tree
/// substrate. Amending a WONT-DO row is the maintainer's call, so this
/// prototype does not edit it; it records the argument and leaves the
/// decision where it belongs.
/// </para>
/// </remarks>
/// <typeparam name="T">The row type this relation exposes to the consumer.</typeparam>
public sealed class ZetaQueryable<T> : IQueryable<T>, IZetaSourceNode
{
    private readonly ZetaQueryProvider _provider;

    internal ZetaQueryable(ZetaQueryProvider provider, Expression expression, string relationName, IReadOnlyList<string> columns)
    {
        _provider = provider;
        Expression = expression;
        RelationName = relationName;
        Columns = columns;
    }

    /// <summary>Create a pull-corner source over a named relation.</summary>
    /// <param name="relationName">The relation name columns are qualified by.</param>
    /// <param name="columns">Declared column names.</param>
    public ZetaQueryable(string relationName, params string[] columns)
    {
        ArgumentNullException.ThrowIfNull(columns);
        _provider = new ZetaQueryProvider();
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
    public IQueryProvider Provider => _provider;

    /// <summary>
    /// Not supported, deliberately — this is the whole point of the type.
    /// The provider TRANSLATES to a plan; it does not enumerate. Running a
    /// plan is <c>ToyLowering.lower</c> over a <c>Circuit</c>, which needs
    /// source data the expression tree does not carry. Throwing beats
    /// returning an empty sequence, which would be a silent wrong answer —
    /// and it is what keeps this type clear of the synchronous-execution
    /// contract <c>docs/WONT-DO.md</c> rejected.
    /// </summary>
    /// <returns>Never returns.</returns>
    /// <exception cref="NotSupportedException">Always.</exception>
    public IEnumerator<T> GetEnumerator() =>
        throw new NotSupportedException(
            "ZetaQueryable does not enumerate. Use PlanTranslator.Translate(query.Expression) " +
            "to obtain the ToyPlan, then ToyLowering.lower to run it on a Circuit.");

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
