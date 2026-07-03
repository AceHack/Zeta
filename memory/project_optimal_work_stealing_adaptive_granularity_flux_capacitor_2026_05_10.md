---
name: Optimal work stealing via flux capacitor — stealing granularity adapts to pressure
description: The ferry protocol IS work stealing with adaptive granularity. Low pressure = steal single items. High pressure = steal full batches. The flux capacitor automatically picks the right granularity. Most implementations use fixed granularity — this adapts.
type: project
---

2026-05-10: Aaron connected the flux capacitor to optimal work stealing.

**The rotation:**

- Classical work stealing: idle thread steals from busy thread's queue
- Ferry work stealing: idle boat picks up overflow from busy boat's dock

**Adaptive granularity (the optimization):**

| Pressure | Stealing granularity | Why |
|----------|---------------------|-----|
| Low | Fine-grained (single items) | No batching pressure, steal individual work |
| Medium | Medium (partial batches) | Natural overflow absorbed during transit |
| High | Coarse-grained (full batches) | Auto-batch upgrade, steal entire composed batches |

**Why this is optimal:**

Most work-stealing implementations use FIXED granularity:

- Always steal N items (too coarse at low load, too fine at high load)
- Always steal half the queue (arbitrary split regardless of pressure)

The flux capacitor steals at the granularity the pressure demands.
The pressure IS the granularity signal. No tuning parameter needed.

**Applied to the factory:**

When Alexa's queue overflows, Otto doesn't steal one PR — Otto
steals a batch of related PRs that compose together. The batch
size is whatever the pressure produced. The ferry was already full.

**Connects to:**

- project_flux_capacitor_antifragile (the mechanism)
- project_ferry_protocol (the metaphor)
- project_tcp_congestion_control_as_society_expansion (backpressure)
- morsel-driven-expert skill (work-stealing in database execution)
- threading-expert skill (work-stealing primitives)
