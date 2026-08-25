using System.Linq.Expressions;
using System.Reactive.Linq;

namespace Zeta.Core.CSharp.Linq;

/// <summary>
/// Expression-tree-collecting provider for the push corner. EXPERIMENTAL.
/// </summary>
public sealed class ZetaQbservableProvider : IQbservableProvider
{
    /// <inheritdoc />
    public IQbservable<TResult> CreateQuery<TResult>(Expression expression)
    {
        var root = PlanTranslator.FindRoot(expression);
        return new ZetaQbservable<TResult>(this, expression, root.RelationName, root.Columns);
    }
}
