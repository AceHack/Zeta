---
name: Flux capacitor — IThrottler fuses 5 patterns, antifragile under pressure, small-boat attack only works at no load
description: Aaron/Chris's IThrottler combines batching + throttling + async + parallel + auto-batching-upgrade-under-pressure. System gets MORE efficient under load (antifragile). Only known attack is small-boat flood but it only works under no load — not really dangerous.
type: project
---

2026-05-10: Aaron identified the IThrottler as a "flux capacitor" — five patterns fused into one adaptive primitive.

**The five patterns fused:**

| Pattern | What it does | Under pressure |
|---------|-------------|---------------|
| Batching | Groups items for efficiency | Batches grow larger |
| Throttling | Bounds the rate (backpressure) | Rate adjusts |
| Async | Non-blocking throughout | No thread waste |
| Parallel | Multiple channels simultaneously | Channels fill naturally |
| Auto-batch upgrade | Batch size increases with load | MORE efficient, not less |

**The antifragile property:**

Most systems degrade under load. The flux capacitor upgrades:

- Low load → small batches, fast latency (responsive)
- High load → large batches, better throughput per operation (efficient)
- The pressure IS the optimization signal

Taleb's antifragility at the threading layer — the system gains from disorder.

**The factory parallel:**

Same pattern:

- More backlog = more work for agents = more PRs = more throughput
- The factory doesn't degrade under pressure — it upgrades
- The IThrottler IS the factory's expansion protocol in code form
- Written years before the factory existed at Itron

**Only known attack — small-boat flood:**

Send many small items to prevent batching from kicking in.
Forces the system into small-batch mode where per-item
overhead dominates.

BUT: this attack only works under NO LOAD. Under real load,
legitimate traffic fills the batches naturally and the flood
gets absorbed into the batching. The attack is self-defeating
under the conditions where the system needs protection most.

**Attribution:**

- Sam Whitfield: Throttled Processor (threading foundation)
- Aaron + Chris: IThrottler/BatchThrottler (flux capacitor, 5 patterns fused)
- The "Chris" in the flux capacitor — credit preserved alongside Aaron

**Connects to:**

- project_ferry_protocol (the ferry metaphor for the same mechanism)
- project_tcp_congestion_control_as_society_expansion (backpressure)
- feedback_retraction_native_paraconsistent_set_theory (antifragility)
- Itron patent US 10,834,144 (same infrastructure lineage)
- Taleb antifragility (gains from disorder)
