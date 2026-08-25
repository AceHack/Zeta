using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Linq.Expressions;
using Microsoft.FSharp.Collections;
using Zeta.Core.QuerySurface;

namespace Zeta.Core.CSharp.Linq;

/// <summary>
/// Translates a LINQ expression tree into a <see cref="ToyPlan"/> — the same
/// closure-free logical plan the F# <c>zquery</c> CE produces.
/// </summary>
/// <remarks>
/// <para>
/// STATUS: toy. EXPERIMENTAL.
/// </para>
/// <para>
/// <b>It matches on method NAME and ARITY, never on declaring type.</b> That
/// is the whole trick, and it is Meijer's duality made mechanical:
/// <c>System.Linq.Queryable.Where</c> (pull) and
/// <c>QbservableOperators.Where</c> (push) build structurally identical
/// <see cref="MethodCallExpression"/>s, so both corners of the duality square
/// collapse onto this one code path. Nothing here knows or cares whether it is
/// reading an <c>IQueryable</c> or an <c>IQbservable</c>.
/// </para>
/// <para>
/// <b>Transparent identifiers.</b> C# query syntax compiles
/// <c>join c in customers on o.Cust equals c.Id</c> into a
/// <c>Join(..., (o, c) =&gt; new { o, c })</c> whose result selector is a
/// "transparent identifier" — an anonymous type whose members are exactly the
/// two range variables. That anonymous row IS the merged row of relational
/// algebra, so the translator recognises it and emits a bare
/// <c>ToyPlan.Join</c> with no extra projection. This is what lets the C#
/// query-syntax form and the F# CE form produce the byte-identical plan the
/// equivalence test demands.
/// </para>
/// <para>
/// A join result selector that is NOT a transparent identifier is rejected
/// rather than silently approximated — see <see cref="Translate"/>.
/// </para>
/// </remarks>
public static class PlanTranslator
{
    /// <summary>
    /// Walk to the left-most source node of the expression tree.
    /// </summary>
    internal static IZetaSourceNode FindRoot(Expression expression)
    {
        ArgumentNullException.ThrowIfNull(expression);

        while (true)
        {
            switch (expression)
            {
                case ConstantExpression { Value: IZetaSourceNode node }:
                    return node;
                case MethodCallExpression call when call.Arguments.Count > 0:
                    expression = call.Arguments[0];
                    break;
                default:
                    throw new NotSupportedException(
                        string.Format(
                            CultureInfo.InvariantCulture,
                            "No Zeta source at the root of the query: {0}.",
                            expression));
            }
        }
    }

    /// <summary>
    /// The scope maps a path from a lambda's parameter to a source alias.
    /// The empty path means "the parameter IS a row of this source"; a
    /// non-empty path is a transparent-identifier member such as <c>t.o</c>.
    /// </summary>
    private sealed record Scope(IReadOnlyDictionary<string, string> PathToAlias)
    {
        internal static Scope Single(string alias) =>
            new(new Dictionary<string, string>(StringComparer.Ordinal) { [string.Empty] = alias });

        internal static Scope Merge(string leftMember, Scope left, string rightMember, Scope right)
        {
            var merged = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (path, alias) in left.PathToAlias)
            {
                merged[path.Length == 0 ? leftMember : leftMember + "." + path] = alias;
            }

            foreach (var (path, alias) in right.PathToAlias)
            {
                merged[path.Length == 0 ? rightMember : rightMember + "." + path] = alias;
            }

            return new Scope(merged);
        }
    }

    /// <summary>
    /// Translate a LINQ expression tree into the shared logical plan.
    /// </summary>
    /// <exception cref="NotSupportedException">
    /// Thrown for any construct outside the deliberately tiny supported set.
    /// Every unsupported case throws rather than degrading, because a plan
    /// that silently drops a predicate would still compare equal to the CE's
    /// plan for the wrong reason — a vacuous pass.
    /// </exception>
    public static ToyPlan Translate(Expression expression)
    {
        var (plan, _) = TranslateNode(expression);
        return plan;
    }

    private static (ToyPlan Plan, Scope Scope) TranslateNode(Expression expression)
    {
        ArgumentNullException.ThrowIfNull(expression);

        if (expression is ConstantExpression { Value: IZetaSourceNode node })
        {
            var columns = ListModule.OfSeq(node.Columns);
            return (ToyPlan.NewSource(node.RelationName, columns), Scope.Single(node.RelationName));
        }

        if (expression is not MethodCallExpression call)
        {
            throw new NotSupportedException(
                string.Format(CultureInfo.InvariantCulture, "Unsupported query node: {0}.", expression));
        }

        // NAME + ARITY only — never the declaring type. See the class remarks.
        return (call.Method.Name, call.Arguments.Count) switch
        {
            ("Where", 2) => TranslateWhere(call),
            ("Select", 2) => TranslateSelect(call),
            ("AsTable", 1) => TranslateAsTable(call),
            ("Join", 5) => TranslateJoin(call),
            _ => throw new NotSupportedException(
                string.Format(
                    CultureInfo.InvariantCulture,
                    "Query operator '{0}'/{1} is outside this prototype's supported set " +
                    "(Where/2, Select/2, Join/5, AsTable/1).",
                    call.Method.Name,
                    call.Arguments.Count)),
        };
    }

    private static (ToyPlan Plan, Scope Scope) TranslateWhere(MethodCallExpression call)
    {
        var (input, scope) = TranslateNode(call.Arguments[0]);
        var lambda = StripQuotes(call.Arguments[1]);
        var predicate = TranslateScalar(lambda.Body, Bind(lambda.Parameters, scope));
        return (ToyPlan.NewWhere(input, predicate), scope);
    }

    private static (ToyPlan Plan, Scope Scope) TranslateSelect(MethodCallExpression call)
    {
        var (input, scope) = TranslateNode(call.Arguments[0]);
        var lambda = StripQuotes(call.Arguments[1]);
        var projections = TranslateProjection(lambda.Body, Bind(lambda.Parameters, scope));
        // A projection produces a new, flat row. The scope is returned
        // unchanged because this prototype does not support referencing a
        // projected column further downstream — that would need a fresh
        // alias for the projected relation, which is left out on purpose.
        return (ToyPlan.NewSelect(input, projections), scope);
    }

    private static (ToyPlan Plan, Scope Scope) TranslateAsTable(MethodCallExpression call)
    {
        var (input, scope) = TranslateNode(call.Arguments[0]);
        return (ToyPlan.NewAsTable(input), scope);
    }

    private static (ToyPlan Plan, Scope Scope) TranslateJoin(MethodCallExpression call)
    {
        var (outer, outerScope) = TranslateNode(call.Arguments[0]);
        var (inner, innerScope) = TranslateNode(call.Arguments[1]);

        var outerKeyLambda = StripQuotes(call.Arguments[2]);
        var innerKeyLambda = StripQuotes(call.Arguments[3]);
        var resultLambda = StripQuotes(call.Arguments[4]);

        var outerKey = TranslateScalar(outerKeyLambda.Body, Bind(outerKeyLambda.Parameters, outerScope));
        var innerKey = TranslateScalar(innerKeyLambda.Body, Bind(innerKeyLambda.Parameters, innerScope));

        var join = ToyPlan.NewJoin(outer, inner, outerKey, innerKey);

        // TWO SHAPES, and which one C# emits depends on what FOLLOWS the join.
        //
        //  • `join ... where ... select ...` — the compiler introduces a
        //    TRANSPARENT IDENTIFIER, `(o, c) => new { o, c }`, so the range
        //    variables stay in scope for the `where`. That anonymous row IS
        //    relational algebra's merged row, so the plan is a bare Join and
        //    the following `where`/`select` become their own nodes.
        //
        //  • `join ... select ...` with nothing in between — the compiler
        //    OPTIMIZES the transparent identifier away and fuses the
        //    projection into the join's own result selector.
        //
        // Both must land on the same plan shape the F# CE produces, so the
        // fused form is unfused here back into Codd's join-then-project.
        // Neither is an error; treating the second as one (an earlier draft
        // of this file did) would have made the surface reject the most
        // natural way to write a projecting join.
        if (TryTransparentIdentifier(resultLambda, out var leftMember, out var rightMember))
        {
            return (join, Scope.Merge(leftMember, outerScope, rightMember, innerScope));
        }

        var env = new Dictionary<ParameterExpression, Scope>
        {
            [resultLambda.Parameters[0]] = outerScope,
            [resultLambda.Parameters[1]] = innerScope,
        };
        var projections = TranslateProjection(resultLambda.Body, env);
        return (ToyPlan.NewSelect(join, projections), Scope.Merge("left", outerScope, "right", innerScope));
    }

    /// <summary>
    /// Recognise a transparent identifier — <c>(o, c) =&gt; new { o, c }</c>, an
    /// anonymous type whose two members are exactly the two range variables,
    /// unprojected. This is what C# query syntax emits for
    /// <c>join ... on ... equals ...</c> when another clause follows.
    /// </summary>
    /// <returns><c>true</c> when the selector is a transparent identifier.</returns>
    private static bool TryTransparentIdentifier(
        LambdaExpression resultSelector,
        out string leftMember,
        out string rightMember)
    {
        if (resultSelector.Body is NewExpression { Members: { Count: 2 } members } newExpr
            && newExpr.Arguments.Count == 2
            && newExpr.Arguments[0] is ParameterExpression p0
            && newExpr.Arguments[1] is ParameterExpression p1
            && ReferenceEquals(p0, resultSelector.Parameters[0])
            && ReferenceEquals(p1, resultSelector.Parameters[1]))
        {
            leftMember = members[0].Name;
            rightMember = members[1].Name;
            return true;
        }

        leftMember = string.Empty;
        rightMember = string.Empty;
        return false;
    }

    /// <summary>Bind every lambda parameter to the same scope.</summary>
    private static Dictionary<ParameterExpression, Scope> Bind(
        IReadOnlyList<ParameterExpression> parameters,
        Scope scope)
    {
        var env = new Dictionary<ParameterExpression, Scope>();
        foreach (var p in parameters)
        {
            env[p] = scope;
        }

        return env;
    }

    private static FSharpList<Tuple<string, ToyScalar>> TranslateProjection(
        Expression body,
        IReadOnlyDictionary<ParameterExpression, Scope> env)
    {
        if (body is NewExpression { Members: not null } newExpr)
        {
            var items = newExpr.Members
                .Select((m, i) => Tuple.Create(m.Name, TranslateScalar(newExpr.Arguments[i], env)))
                .ToList();
            return ListModule.OfSeq(items);
        }

        if (body is MemberInitExpression init)
        {
            var items = init.Bindings
                .OfType<MemberAssignment>()
                .Select(b => Tuple.Create(b.Member.Name, TranslateScalar(b.Expression, env)))
                .ToList();
            return ListModule.OfSeq(items);
        }

        throw new NotSupportedException(
            "A projection must be an anonymous type or an object initializer, e.g. " +
            "`select new { Name = c.Name, Amount = o.Amount }`.");
    }

    private static ToyScalar TranslateScalar(
        Expression expression,
        IReadOnlyDictionary<ParameterExpression, Scope> env)
    {
        switch (expression)
        {
            case UnaryExpression { NodeType: ExpressionType.Convert or ExpressionType.ConvertChecked } conv:
                return TranslateScalar(conv.Operand, env);

            case MemberExpression member:
                return TranslateColumn(member, env);

            case ConstantExpression constant:
                return ToyScalar.NewLit(ToLiteral(constant.Value));

            case BinaryExpression binary:
                {
                    var left = TranslateScalar(binary.Left, env);
                    var right = TranslateScalar(binary.Right, env);
                    return binary.NodeType switch
                    {
                        ExpressionType.Equal => ToyScalar.NewEq(left, right),
                        ExpressionType.GreaterThan => ToyScalar.NewGt(left, right),
                        ExpressionType.LessThan => ToyScalar.NewLt(left, right),
                        ExpressionType.AndAlso or ExpressionType.And => ToyScalar.NewAndAlso(left, right),
                        _ => throw new NotSupportedException(
                            string.Format(
                                CultureInfo.InvariantCulture,
                                "Operator {0} is outside this prototype's scalar language (=, >, <, &&).",
                                binary.NodeType)),
                    };
                }

            default:
                throw new NotSupportedException(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "Unsupported scalar expression: {0}.",
                        expression));
        }
    }

    /// <summary>
    /// Resolve a member access back to an alias-qualified column, walking
    /// through any transparent-identifier hops (<c>t.o.Amount</c>).
    /// </summary>
    private static ToyScalar TranslateColumn(
        MemberExpression member,
        IReadOnlyDictionary<ParameterExpression, Scope> env)
    {
        var field = member.Member.Name;

        // Collect the hops between the field and the parameter, innermost last.
        var hops = new List<string>();
        Expression? current = member.Expression;
        while (current is MemberExpression hop)
        {
            hops.Insert(0, hop.Member.Name);
            current = hop.Expression;
        }

        if (current is not ParameterExpression parameter || !env.TryGetValue(parameter, out var scope))
        {
            throw new NotSupportedException(
                string.Format(
                    CultureInfo.InvariantCulture,
                    "Cannot resolve '{0}' to a source column — it does not root in a bound query parameter.",
                    member));
        }

        var path = string.Join(".", hops);
        if (!scope.PathToAlias.TryGetValue(path, out var alias))
        {
            throw new NotSupportedException(
                string.Format(
                    CultureInfo.InvariantCulture,
                    "No source bound at path '{0}' for member '{1}'. Bound paths: [{2}].",
                    path,
                    field,
                    string.Join("; ", scope.PathToAlias.Keys)));
        }

        return ToyScalar.NewCol(alias, field);
    }

    private static ToyValue ToLiteral(object? value) => value switch
    {
        long l => ToyValue.NewVInt(l),
        int i => ToyValue.NewVInt(i),
        string s => ToyValue.NewVStr(s),
        bool b => ToyValue.NewVBool(b),
        _ => throw new NotSupportedException(
            string.Format(
                CultureInfo.InvariantCulture,
                "Literal of type {0} is outside this prototype's value language (int64, string, bool).",
                value?.GetType())),
    };

    private static LambdaExpression StripQuotes(Expression expression)
    {
        while (expression is UnaryExpression { NodeType: ExpressionType.Quote } quote)
        {
            expression = quote.Operand;
        }

        return (LambdaExpression)expression;
    }
}
