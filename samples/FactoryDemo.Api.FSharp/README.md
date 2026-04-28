# Factory-demo — JSON API (F#)

**What this is:** A minimal F# ASP.NET Core Web API that serves
the demo's seed data as JSON. Stack-independent — any frontend
(Blazor / React / Vue / curl) consumes the same endpoints.

**What this is NOT:** A pitch for Zeta as a data store. The
demo sells the **software factory**, not the database layer.
Backend is in-memory (v0) and will be swapped to Postgres (v1)
without changing the public API contract.

## Why this sample exists

The factory-demo needs a JSON API that any frontend choice can
consume. This API ships now so the backend is not on the
critical path when the frontend stack is chosen.

This is the F# reference implementation. A C# companion sample
(`samples/FactoryDemo.Api.CSharp/`, sibling PR #147) is planned
with the same 9 endpoints, matching JSON shapes, and identical
seed. C# is the more popular .NET language, so it is the natural
primary demo path; F# stays the reference because F# looks
closer to math, which makes theorems over the algebra easier
to express.

## How to run

```bash
dotnet run --project samples/FactoryDemo.Api.FSharp/FactoryDemo.Api.FSharp.fsproj
# API is up on http://localhost:5000 (or whatever ASP.NET picks).
# curl it:
curl http://localhost:5000/api/customers
curl http://localhost:5000/api/pipeline/funnel
curl http://localhost:5000/api/pipeline/duplicates
```

## Endpoints (v0)

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

All responses are JSON.

## V0 seed data

`Seed.fs` carries the in-memory seed (v1 will mirror a Postgres
seed-data.sql under `samples/FactoryDemo.Db/`, not yet in repo):

- 20 customers (trades contractors — plumbing, HVAC, electric, roofing, etc.)
- 30 opportunities across 5 stages (Lead, Qualified, Proposal, Won, Lost)
- 33 activities (calls, emails, SMS, notes)
- 2 intentional email collisions to drive the duplicate-review scenario

Seed is deterministic — restarting the server replays the same data.

## What v1 adds

- Postgres backing (Npgsql) wired against a planned
  `samples/FactoryDemo.Db/` schema + seed (not yet in repo)
- CRUD endpoints (POST / PUT / DELETE) — v0 is read-only
- docker-compose for one-command Postgres + API
- Environment-variable configuration for connection string

Each of those is a follow-up PR.

## Design notes

- **`Microsoft.NET.Sdk.Web` SDK.** Pulls in ASP.NET Core via
  framework reference — no package version edit in
  `Directory.Packages.props` needed. Only `FSharp.Core` is an
  explicit package reference.
- **Minimal APIs over MVC.** F# + minimal APIs is a clean
  combination: one file, no controllers, no heavy routing ceremony.
- **Anonymous records for derived views.** `/api/pipeline/funnel`
  returns an anonymous record with `Stage`, `Count`, and
  `TotalCents` fields using F#'s `{| Stage = ...; Count = ...;
  TotalCents = ... |}` syntax. Keeps the output shape local to
  the endpoint handler.
- **`System.Text.Json` defaults.** No converter customisation in v0.
  If a frontend needs camelCase / different date shapes, add it as
  a targeted follow-up rather than reshape everything.
- **No OpenAPI / Swagger yet.** v0 intentionally minimal; Swagger
  UI lands when endpoint count grows or frontend needs it.

## What this does NOT do

- Does not persist writes — v0 is read-only
- Does not authenticate or authorise — no auth for the demo v0
- Does not wire to Postgres — in-memory for v0
- Does not expose algebraic-delta / retraction-native internals
  to the frontend (that's the internal kernel sample's job; the
  factory-demo audience gets standard CRUD shape)
