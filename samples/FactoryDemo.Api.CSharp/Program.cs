using Zeta.Samples.FactoryDemo.Api;

// Minimal C# ASP.NET Core Web API serving the seed data for the
// factory-demo. Companion to the F# sibling at
// `samples/FactoryDemo.Api.FSharp/` — same 9 endpoints, same JSON
// shapes, same seed data. Any frontend consumes either one
// interchangeably.
//
// Why both F# and C# versions: the factory produces code in
// the target audience's stack. Many adopting teams run C# with
// no F# exposure; the C# version minimises adoption friction
// while the F# version stays the factory's reference-language
// baseline (F# looks closer to math, so theorems over the
// algebra are easier to express there).

// Static endpoint list — extracted to satisfy CA1861 (avoid re-allocating
// the array on every request to the root endpoint). Advertises all 9
// endpoints including `/` and the parameterised `{id}` routes, so the
// root is an honest index of what the API is actually serving. Matches
// the F# sibling's list exactly (parity guarantee: same 9 endpoints,
// same order) — any frontend consumes either implementation without
// seeing a different endpoint set at `/`.
string[] endpoints =
[
    "/",
    "/api/customers",
    "/api/customers/{id}",
    "/api/customers/{id}/activities",
    "/api/opportunities",
    "/api/opportunities/{id}",
    "/api/activities",
    "/api/pipeline/funnel",
    "/api/pipeline/duplicates",
];

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
var app = builder.Build();

app.MapGet("/", () => new
{
    name = "Factory-demo API (C#)",
    version = "0.0.1",
    endpoints,
});

app.MapGet("/api/customers", () => Seed.Customers);
app.MapGet("/api/customers/{id:long}", (long id) =>
    Seed.Customers.FirstOrDefault(c => c.Id == id) is { } c
        ? Results.Ok(c)
        : Results.NotFound());

app.MapGet("/api/customers/{id:long}/activities", (long id) =>
    Seed.Activities.Where(a => a.CustomerId == id));

app.MapGet("/api/opportunities", () => Seed.Opportunities);
app.MapGet("/api/opportunities/{id:long}", (long id) =>
    Seed.Opportunities.FirstOrDefault(o => o.Id == id) is { } o
        ? Results.Ok(o)
        : Results.NotFound());

app.MapGet("/api/activities", () => Seed.Activities);

// MA0002 requires an explicit comparer for string GroupBy; ordinal is
// correct for our seed data — emails are already lowercased and ASCII.
app.MapGet("/api/pipeline/funnel", () =>
    Seed.Opportunities
        .GroupBy(o => o.Stage, StringComparer.Ordinal)
        .Select(g => new
        {
            Stage = g.Key,
            Count = g.Count(),
            TotalCents = g.Sum(o => o.AmountCents),
        }));

app.MapGet("/api/pipeline/duplicates", () =>
    Seed.Customers
        .GroupBy(c => c.Email, StringComparer.Ordinal)
        .Where(g => g.Count() > 1)
        .Select(g => new
        {
            Email = g.Key,
            CustomerIds = g.Select(c => c.Id).ToArray(),
        }));

app.Run();
