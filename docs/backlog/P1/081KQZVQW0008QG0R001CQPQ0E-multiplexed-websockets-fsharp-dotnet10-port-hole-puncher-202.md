---
id: 081KQZVQW0008QG0R001CQPQ0E
priority: P1
status: open
title: "Port MultiplexedWebSockets to .NET 10 F# — the hole puncher in Zeta's algebra"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R001V420F0]
decomposition: atomic
owners: [architect, performance-engineer]
type: feature
---

# 081KQZVQW0008QG0R001CQPQ0E — Port MultiplexedWebSockets to .NET 10 F\#

## What

Port Aaron's `MultiplexedWebSockets` C# library
(https://github.com/AceHack/MultiplexedWebSockets, MIT, 2018)
to .NET 10 F#. This is the concrete code behind US Patent
10,834,144 — the hole puncher primitive that the entire
framework descends from.

Aaron 2026-05-07: "if you rewrite this in dotnet 10 f# you
can reproduce it exactly its what i used when making the itron
patent" and "that's my code."

## The source

- **Repo:** https://github.com/AceHack/MultiplexedWebSockets
- **Language:** C# (.NET Core era)
- **License:** MIT
- **Created:** 2018-10-08
- **Core file:** `src/Common/MultiplexedWebSocket.cs` (350 lines)
- **Benchmark:** 115,309 req/s multiplexed vs 7,075 req/s HttpClient (16x)

## Architecture (from the source)

- Single WebSocket connection multiplexes many request/response
  pairs via Guid-keyed in-flight map
- `System.IO.Pipelines` for zero-copy I/O
- 32-byte header envelope: version + MessageType (Request/Response) + correlation Guid
- `ActionBlock` for ordered send serialization
- `ConcurrentDictionary<Guid, TaskCompletionSource>` for in-flight tracking

## F# port mapping

| C# | F# |
|----|----|
| `ConcurrentDictionary<Guid, TCS>` | `ConcurrentDictionary` or `MailboxProcessor` |
| `System.IO.Pipelines` | Same API (.NET 10) |
| `ActionBlock` | `MailboxProcessor` (natural fit) |
| `ReadOnlySequence<byte>` | Same zero-copy primitive |
| `sealed class` | Module + private DU |
| `async Task` | `async { }` or `task { }` CE |

## Why P1

This is the hole puncher in code form. 081KQZVQW0008QG0R001V420F0 (red team) needs
this to test the self-replication-out-of-containment vector.
The Ace product needs this as the transport layer. The framework
needs this as the concrete proof that the primitive works at
115K req/s through a single socket.

## Acceptance criteria

- [ ] F# port compiles under .NET 10 with zero warnings
- [ ] Benchmark reproduces ≥100K req/s multiplexed (same order
  of magnitude as original 115K)
- [ ] Request/Response multiplexing works over single WebSocket
- [ ] Zero-copy I/O via Pipelines preserved
- [ ] Unit tests cover: connection lifecycle, concurrent
  request/response, cancellation, disposal

## Out of scope (v1)

- BFT consensus layer (that's the Ace layer on top)
- KSK capability gating (separate concern)
- Production deployment

## Composes with

- 081KQZVQW0008QG0R001V420F0 (red team hole puncher) — this IS the hole puncher
- `docs/STRUCTURE-CATALOG.md` — Hole Puncher primitive entry
- Per-user MEMORY.md "Ace package manager" — transport layer
- Per-user MEMORY.md "Itron is the edge gate" — this sits
  inside the edge gate as the communication primitive
