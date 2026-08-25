using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Linq;
using Zeta.Core.QuerySurface;

namespace Zeta.Core.CSharp.Tests;

// ══════════════════════════════════════════════════════════════════════
//  The LINQ half of the "two front ends, one plan" falsifier.
//
//  These tests read the SAME golden file as
//  tests/Tests.FSharp/QuerySurface.Equivalence.Tests.fs. That shared
//  artifact is the whole point: neither surface holds a private copy of
//  the expected plan, so "the CE and LINQ agree" is a checkable fact about
//  one file rather than two constants that happen to match.
//
//  The pull corner (IQueryable) and the push corner (IQbservable) are
//  BOTH checked against that same text, which is the mechanical form of
//  Meijer's duality claim: same query, same plan, different execution.
// ══════════════════════════════════════════════════════════════════════

public sealed class QuerySurfaceLinqTests
{
    /// <summary>Row type for the `orders` relation.</summary>
    private sealed record Order(long Id, long Cust, long Amount);

    /// <summary>Row type for the `customers` relation.</summary>
    private sealed record Customer(long Id, string Name);

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        Assert.NotNull(dir);
        return dir!.FullName;
    }

    /// <summary>
    /// Read one canonical plan from the shared golden file — the same file
    /// the F# CE test reads.
    /// </summary>
    private static string GoldenCanonical(string name)
    {
        var path = Path.Join(RepoRoot(), "tests", "_golden", "query-surface-plans.json");
        Assert.True(File.Exists(path), $"golden vector not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var lines = doc.RootElement
            .GetProperty("vectors")
            .GetProperty(name)
            .GetProperty("canonical")
            .EnumerateArray()
            .Select(e => e.GetString());
        return string.Join("\n", lines);
    }

    private static ZetaQueryable<Order> PullOrders() => new("orders", "Id", "Cust", "Amount");

    private static ZetaQueryable<Customer> PullCustomers() => new("customers", "Id", "Name");

    private static ZetaQbservable<Order> PushOrders() => new("orders", "Id", "Cust", "Amount");

    private static ZetaQbservable<Customer> PushCustomers() => new("customers", "Id", "Name");

    // ═══ PULL CORNER — IQueryable ════════════════════════════════════

    [Fact]
    public void PullCornerQuerySyntaxMatchesTheSharedGoldenVector()
    {
        // Ordinary C# query syntax. The compiler lowers `join ... on ... equals`
        // into a Join whose result selector is a transparent identifier
        // `(o, c) => new { o, c }` — which is exactly the merged row of
        // relational algebra, so it produces a bare ToyPlan.Join with no
        // extra projection node.
        var query =
            from o in PullOrders()
            join c in PullCustomers() on o.Cust equals c.Id
            where o.Amount > 100L
            select new { Name = c.Name, Amount = o.Amount };

        var plan = PlanTranslator.Translate(query.Expression);

        Assert.Equal(GoldenCanonical("filter-project-join"), ToyPlanModule.canonical(plan));
    }

    // ═══ PUSH CORNER — IQbservable ═══════════════════════════════════

    [Fact]
    public void PushCornerQuerySyntaxMatchesTheSharedGoldenVector()
    {
        // The SAME query text, over IQbservable instead of IQueryable. If
        // this produces the same plan as the test above, the two corners of
        // the duality square really are one surface.
        var query =
            from o in PushOrders()
            join c in PushCustomers() on o.Cust equals c.Id
            where o.Amount > 100L
            select new { Name = c.Name, Amount = o.Amount };

        var plan = PlanTranslator.Translate(query.Expression);

        Assert.Equal(GoldenCanonical("filter-project-join"), ToyPlanModule.canonical(plan));
    }

    [Fact]
    public void PullAndPushCornersProduceTheIdenticalPlan()
    {
        var pull =
            from o in PullOrders()
            join c in PullCustomers() on o.Cust equals c.Id
            where o.Amount > 100L
            select new { Name = c.Name, Amount = o.Amount };

        var push =
            from o in PushOrders()
            join c in PushCustomers() on o.Cust equals c.Id
            where o.Amount > 100L
            select new { Name = c.Name, Amount = o.Amount };

        // Structural equality on the F# union — not just equal text.
        Assert.Equal(
            PlanTranslator.Translate(pull.Expression),
            PlanTranslator.Translate(push.Expression));
    }

    [Fact]
    public void StreamTableJoinMatchesTheSharedGoldenVector()
    {
        // `.AsTable()` marks the right side as a materialized relation, so
        // the plan carries an AsTable (DBSP's `I`) node. Only expressible on
        // the push corner, because only there is there a stream to integrate.
        var query =
            from o in PushOrders()
            join c in PushCustomers().AsTable() on o.Cust equals c.Id
            select new { Name = c.Name, Amount = o.Amount };

        var plan = PlanTranslator.Translate(query.Expression);

        Assert.Equal(GoldenCanonical("stream-table-join"), ToyPlanModule.canonical(plan));
    }

    // ═══ NON-VACUITY AND REFUSAL CONTROLS ════════════════════════════

    [Fact]
    public void ADriftedPredicateDoesNotMatchTheGoldenVector()
    {
        // Guards every assertion above: if the translator dropped predicates,
        // or `canonical` collapsed them, the equality tests would pass for
        // the wrong reason.
        var query =
            from o in PullOrders()
            join c in PullCustomers() on o.Cust equals c.Id
            where o.Amount > 999L
            select new { Name = c.Name, Amount = o.Amount };

        var plan = PlanTranslator.Translate(query.Expression);

        Assert.NotEqual(GoldenCanonical("filter-project-join"), ToyPlanModule.canonical(plan), StringComparer.Ordinal);
    }

    [Fact]
    public void EnumeratingTheQueryableThrowsRatherThanReturningNothing()
    {
        // The specific objection docs/WONT-DO.md raised against IQueryable was
        // its synchronous-execution contract. This provider does not take that
        // contract, and refusing loudly is what keeps that true — returning an
        // empty sequence would be a silent wrong answer.
        var query = PullOrders().Where(o => o.Amount > 100L);
        Assert.Throws<NotSupportedException>(() => query.ToList());
    }

    [Fact]
    public void AnUnsupportedOperatorIsRefusedRatherThanApproximated()
    {
        // A plan that silently dropped an unsupported operator would still
        // compare equal to the CE's plan — a vacuous pass. The prototype's
        // narrow scope has to fail loudly to stay honest.
        var query = PullOrders().Distinct();
        Assert.Throws<NotSupportedException>(() => PlanTranslator.Translate(query.Expression));
    }

    [Fact]
    public void AFusedProjectingJoinUnfoldsToJoinThenProject()
    {
        // When no `where` sits between the join and the select, C# optimizes
        // the transparent identifier away and fuses the projection into the
        // join's result selector. Unfusing it back to Codd's
        // join-then-project is what keeps this form on the same plan as the
        // F# CE's `join` + `select`.
        var query =
            from o in PullOrders()
            join c in PullCustomers() on o.Cust equals c.Id
            select new { Name = c.Name, Amount = o.Amount };

        var plan = PlanTranslator.Translate(query.Expression);

        Assert.Equal(GoldenCanonical("join-project"), ToyPlanModule.canonical(plan));
    }

    [Fact]
    public void MethodSyntaxProjectingJoinAgreesWithQuerySyntax()
    {
        // The same query written in method syntax must reach the identical
        // plan — the surface cannot depend on which spelling the caller used.
        var query = PullOrders().Join(
            PullCustomers(),
            o => o.Cust,
            c => c.Id,
            (o, c) => new { Name = c.Name, Amount = o.Amount });

        var plan = PlanTranslator.Translate(query.Expression);

        Assert.Equal(GoldenCanonical("join-project"), ToyPlanModule.canonical(plan));
    }
}
