---
name: Fowler Pipelines architecture — MultiplexedWebSockets built on David Fowler's System.IO.Pipelines, ActionBlock shared with IThrottler intentionally
description: Aaron built MultiplexedWebSockets on David Fowler's System.IO.Pipelines (designed for Kestrel HTTP/2). Same ActionBlock pattern as IThrottler — intentional, Aaron was fixing issues he found with ActionBlock. 115,309 req/sec (16x HttpClient). Composing with flux capacitor = wire BatchThrottler as sendBlock.
type: project
---

2026-05-10: Otto analyzed MultiplexedWebSockets architecture, Aaron confirmed ActionBlock sharing was intentional.

**David Fowler connection:**

`System.IO.Pipelines` is David Fowler's (Microsoft) high-performance pipe abstraction designed for Kestrel's HTTP/2 multiplexing. Aaron took the same primitives and built WebSocket multiplexing on top.

**Architecture (from source):**

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| Two Pipes | `System.IO.Pipelines.Pipe` | Bidirectional send/receive |
| Write serializer | `ActionBlock` (DataFlow) | Single-writer to send pipe |
| Request correlation | `ConcurrentDictionary<Guid, TCS>` | In-flight request/response matching |
| Envelope | 32-byte binary header | Version + GUID + length + message type |
| Buffer management | `MemoryPool<byte>.Shared` | Zero-alloc |
| Throughput | 115,309 req/sec | 16x over HttpClient |

**ActionBlock sharing (Aaron's intentional design):**

Otto: "The ActionBlock in MultiplexedWebSocket is the same ActionBlock pattern as the IThrottler."

Aaron: "That was on purpose — I had just learned ActionBlock and I was trying to fix issues I found with it."

Both the multiplexer and the throttler use ActionBlock with BoundedCapacity as their core serialization primitive. This means they're architecturally compatible — composing them is wiring the BatchThrottler as the sendBlock.

**The composition point:**

Replace MultiplexedWebSocket's single-item `ActionBlock<Tuple<...>>` sendBlock with the IThrottler's `BatchThrottler` → adaptive batching across multiplexed channels. One connection point, 10-16x throughput.

**Attribution chain:**

- David Fowler: System.IO.Pipelines (Kestrel, Microsoft)
- Aaron: MultiplexedWebSockets (WebSocket multiplexing on Fowler's pipes)
- Aaron + Chris: IThrottler/BatchThrottler (flux capacitor, ActionBlock-based)
- Sam Whitfield: Throttled Processor (threading foundation)

**Connects to:**

- project_multiplexed_websockets_flux_capacitor (the composition)
- project_flux_capacitor_antifragile (the batching mechanism)
- project_ferry_protocol (send even if not full)
- 081KR7JY10008QG0R000R503K2 inter-agent bus (this IS the transport)
