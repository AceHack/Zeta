using System;
using System.Globalization;
using System.Linq;
using System.Linq.Expressions;

namespace Zeta.Core.CSharp.Linq;

/// <summary>
/// Expression-tree-collecting provider for the pull corner. Its "execution"
/// IS translation: it returns a plan, never rows. EXPERIMENTAL.
/// </summary>
public sealed class ZetaQueryProvider : IQueryProvider
{
    /// <inheritdoc />
    public IQueryable CreateQuery(Expression expression) => CreateQuery<object>(expression);

    /// <inheritdoc />
    public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
    {
        var root = PlanTranslator.FindRoot(expression);
        return new ZetaQueryable<TElement>(this, expression, root.RelationName, root.Columns);
    }

    /// <inheritdoc />
    public object Execute(Expression expression) => PlanTranslator.Translate(expression);

    /// <summary>
    /// Returns the translated plan when <typeparamref name="TResult"/> is
    /// <c>ToyPlan</c>. Anything else throws rather than fabricating rows.
    /// </summary>
    /// <typeparam name="TResult">Requested result type.</typeparam>
    /// <param name="expression">The query expression tree.</param>
    /// <returns>The translated plan.</returns>
    /// <exception cref="NotSupportedException">
    /// When <typeparamref name="TResult"/> is not the plan type.
    /// </exception>
    public TResult Execute<TResult>(Expression expression)
    {
        var plan = PlanTranslator.Translate(expression);
        if (plan is TResult typed)
        {
            return typed;
        }

        throw new NotSupportedException(
            string.Format(
                CultureInfo.InvariantCulture,
                "ZetaQueryProvider translates to ToyPlan; it cannot produce {0}.",
                typeof(TResult)));
    }
}
