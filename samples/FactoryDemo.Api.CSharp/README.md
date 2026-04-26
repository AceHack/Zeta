# Factory-demo — JSON API (C#)

**What this is:** The C# version of the factory-demo JSON API.
Identical 9 endpoints, identical JSON shapes, identical seed
data as the F# sibling at `samples/FactoryDemo.Api.FSharp/`.
Minimal ASP.NET Core, no heavy frameworks.

**Why C# leads:** C# is the more popular language in the .NET
ecosystem by a wide margin; starting the factory demo in C#
meets the largest audience where they already are. The F#
sibling is the reference — F# looks closer to math, so
theorems over the algebra are easier to express — but the
demo path-of-least-friction is C#.

**What this demonstrates about the factory:** The factory
produces code in the target audience's stack. Same CRM-shape,
two implementations, behavioural parity — a small but concrete
signal that the factory is language-independent where it needs
to be and language-opinionated where correctness matters.

## How to run

```bash
dotnet run --project samples/FactoryDemo.Api.CSharp/FactoryDemo.Api.CSharp.csproj
# API on http://localhost:5000 (or whatever ASP.NET picks)
curl http://localhost:5000/api/pipeline/funnel
```

## Endpoints (identical to the F# sibling)

| Method | Path | Returns |
|---|---|---|
| GET | `/` | API metadata + endpoint list |
| GET | `/api/customers` | All customers |
| GET | `/api/customers/{id}` | Single customer, 404 if missing |
| GET | `/api/customers/{id}/activities` | Activities for one customer |
| GET | `/api/opportunities` | All opportunities |
| GET | `/api/opportunities/{id}` | Single opportunity, 404 if missing |
| GET | `/api/activities` | All activities |
| GET | `/api/pipeline/funnel` | Per-stage count + $ total |
| GET | `/api/pipeline/duplicates` | Customers sharing an email |

## Parity guarantee

Both versions return byte-identical JSON shapes for every
endpoint given the same seed. The only differences are:

- `name` field at `/` — `"(F#)"` vs `"(C#)"` so the consumer
  can tell which one is running
- JSON property ordering (both are valid JSON; order is
  serializer-dependent)

Otherwise: identical `customers`, `opportunities`, `activities`,
`funnel`, `duplicates`. Frontends can switch between them
without code changes.

## Design notes (C# specifics)

- **`Microsoft.NET.Sdk.Web` SDK.** ASP.NET Core via framework
  reference; no NuGet package pin needed.
- **Records instead of classes.** `Customer`, `Opportunity`,
  `Activity` are `record` types — immutable, value-equality,
  trivially serializable. Matches the F# record semantics one
  file over.
- **One type per file** — satisfies `MA0048`. F# allows
  multiple types per file so the F# version is one-file;
  C# convention is file-per-type.
- **`StringComparer.Ordinal` on GroupBy** — satisfies `MA0002`.
  Ordinal is correct for our seed data (emails are ASCII /
  lowercased); culture-aware comparison would introduce
  unneeded overhead and non-determinism across locales.
- **Static endpoint array for `/`** — satisfies `CA1861`.
  Declared once at startup, not on every request.
- **Nullable reference types + implicit usings.** Modern C#
  defaults. Keeps the code short and idiomatic for C#
  readers.

## What this does NOT do

Same as the F# sibling: no Postgres (v0), no writes, no auth,
no docker-compose. All are follow-up PRs.

## Composes with

- `samples/FactoryDemo.Api.FSharp/` — the F# sibling; reference
  behaviour; use it as the algebraic truth when debugging
- A Postgres-backed sibling sample (schema + seed SQL) is a v1
  follow-up tracked in `docs/BACKLOG.md`; both API samples will
  wire to it when it lands
- `docs/BACKLOG.md` — factory-demo scope rows
