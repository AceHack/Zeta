---
name: Ferry protocol — send even if not full, channel latency IS the buffer. Sam Whitfield credit.
description: Aaron's Itron IThrottler replaces Nagle with ferry boats — send immediately, parallelism fills the next boat during transit. Based on Sam Whitfield's Throttled Processor (simpler threading version) which was the backbone of Itron's IoT infrastructure. Applied to society expansion.
type: project
---

2026-05-10: Aaron located the Itron throttler source and explained the ferry metaphor.

**The ferry protocol (Aaron's Nagle alternative):**

Nagle says: wait at the dock until the boat is full, then send.
Ferry says: **send the boat even if not full — the channel's transit
time IS the batching window.**

While boat 1 physically traverses the channel, boat 2 fills at the
dock. The transit time provides the buffering for free. No timer
needed — the physics of the channel is the buffer.

**Nagle vs Ferry:**

| Property | Nagle | Ferry protocol |
|----------|-------|---------------|
| Wait for full? | Yes — delays until full or timeout | No — send immediately |
| Latency | High (waits) | Low (sends now) |
| Bandwidth | Optimized (full packets) | Gets it free from parallelism |
| Buffer mechanism | Timer | Channel transit time |
| Parallelism | Single channel | Multiple parallel boats |

**Attribution — Sam Whitfield's Throttled Processor:**

The ferry protocol is based on a simpler threading version called
the **Throttled Processor** created by **Sam Whitfield** (Itron
mentor, physics background — see `user_itron_mentors_full_roster`).
The Throttled Processor was the backbone of Itron's IoT
infrastructure before Aaron expanded it into the full
IThrottler/BatchThrottler framework in Platform.DotNet.

**Source location:**

`/Users/acehack/Downloads/Itron/Platform.DotNet/Source/Threading/Tasks/Throttling/`

Key files:

- `Throttler.cs` — ActionBlock-based with QueueCount, BoundedCapacity
- `BatchThrottler.cs` — adds batching semantics (the ferry grouping)
- `SemaphoreThrottler.cs` — simpler semaphore-based variant
- `ThrottlerFactory.cs` — configuration-driven creation

**Applied to society expansion:**

- Don't wait for the "perfect" agent (full boat) → launch now
- While agent onboards (transit), next candidate fills naturally
- Onboarding time IS the batching window
- By the time first agent is productive, next is ready
- Parallelize the channel: multiple agents onboarding simultaneously

**The lineage:**

Sam Whitfield (Throttled Processor, threading)
→ Aaron (IThrottler/BatchThrottler, dataflow blocks, Itron IoT backbone)
→ Zeta (TCP congestion control as expansion protocol, ferry boats)

**Connects to:**

- project_tcp_congestion_control_as_society_expansion (the expansion protocol)
- user_itron_mentors (Sam Whitfield — physics background)
- Itron patent US 10,834,144 (same infrastructure lineage)
- feedback_absorb_and_contribute_community_dependency_discipline
