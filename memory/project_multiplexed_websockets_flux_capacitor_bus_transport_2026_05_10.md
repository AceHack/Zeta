---
name: MultiplexedWebSockets + flux capacitor = 081KR7JY10008QG0R000R503K2 bus transport layer (10x throughput)
description: Aaron's existing MultiplexedWebSockets repo (github.com/AceHack/MultiplexedWebSockets) composing with the flux capacitor IThrottler gives the inter-agent bus its wire protocol. Many logical streams over one socket + adaptive batching = Arrow Tier 1-2 transport. No external broker needed.
type: project
---

2026-05-10: Aaron connected his MultiplexedWebSockets repo to the flux capacitor for the bus transport.

**The composition:**

| Component | What it provides | Source |
|-----------|-----------------|--------|
| MultiplexedWebSockets | Many logical streams over one physical socket | github.com/AceHack/MultiplexedWebSockets |
| Flux capacitor (IThrottler) | Adaptive batching/throttling per stream | Itron Platform.DotNet |
| Together | 10x throughput — adaptive batching across multiplexed channels | Composition |

**Why 10x:**

- No connection-per-channel overhead (multiplexing)
- Adaptive batch size grows under pressure (flux capacitor)
- Ferry protocol: send even if not full, transit fills next batch
- Work stealing at adaptive granularity across channels

**Bus transport layer mapping:**

| Trust tier | Transport |
|-----------|-----------|
| Tier 0 (Arrow) | Shared memory — no network needed |
| Tier 1-2 | MultiplexedWebSockets + flux capacitor |
| Tier 3 (Eve) | Same transport, full observation layer on top |

**No external broker needed:**

The agents don't need NATS, RabbitMQ, or Kafka for 081KR7JY10008QG0R000R503K2.
The transport is already built — multiplexed WebSockets with
adaptive batching. The bus IS the composition of Aaron's
prior work.

**Prior work sitting in GitHub:**

Like the $50k of hardware in boxes and the Itron downloads
folder — the transport layer was already built, waiting for
the factory that could use it.

**Connects to:**
- 081KR7JY10008QG0R000R503K2 inter-agent bus (this IS the transport layer)
- project_flux_capacitor_antifragile (the batching mechanism)
- project_ferry_protocol (the send-even-if-not-full discipline)
- project_optimal_work_stealing (adaptive granularity)
- feedback_arrow_tier_0 (Tier 0 bypasses this, Tier 1-2 uses it)
- project_microkernel_trust_tier_router (kernel routes to appropriate tier)
