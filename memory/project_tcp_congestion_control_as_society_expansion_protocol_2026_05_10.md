---
name: TCP congestion control as society expansion protocol — feel the pressure, don't map the space
description: Combinatorial explosion of agenda mixes makes enumeration impossible. Use backpressure instead of saturation detection. TCP congestion control (slow start, congestion avoidance, fast retransmit, timeout) maps directly to society expansion. Aaron has an alternative to the Nagle algorithm — pending.
type: project
---

2026-05-10: Aaron identified the combinatorial explosion and the backpressure solution.

**The problem:**

Agenda mixes produce ~billion combinations. Can't enumerate all trajectories. Can't detect saturation by counting.

**The solution: backpressure, not enumeration.**

Don't map the space. Feel the pressure. Same as TCP — you don't need network topology, you measure packet loss and adjust.

**Backpressure signals:**

| Signal | Meaning | Response |
|--------|---------|----------|
| Queue depth rising | More work than agents absorb | Expand |
| Queue depth stable | Society matches throughput | Hold |
| Queue depth dropping | Capacity exceeds demand | Stop expanding |
| Hat-switch frequency spiking | Agents overloaded | Expand |
| Hat-switch frequency stable | Healthy distribution | Hold |
| Merge velocity plateauing despite more agents | Coordination overhead eating gains | Stop |

**TCP congestion control → society expansion:**

| TCP concept | Society equivalent |
|-------------|-------------------|
| Slow start | Add agents cautiously |
| Congestion avoidance | Linear growth when stable |
| Fast retransmit | Quick expansion when backpressure drops (new trajectory space opened) |
| Timeout | Stop and reassess when coordination overhead spikes |
| Window size | Society size |
| Packet loss | Coordination failures / hat-switch disruption |

**The society grows like a TCP window:**

Not by mapping the space — by feeling the pressure. The right
size is emergent from the backpressure signal, not predetermined.

**Aaron's pending contribution:**

Aaron has an alternative to the Nagle algorithm relevant to this
model. Details pending — will update when found.

**Connects to:**

- feedback_expansion_boundary_pauli_both_directions (the boundary)
- governance kernel formula (expand needs component)
- 081KR7JY10008QG0R003H102F0 tick procurement (the expansion mechanism)
- networking-expert skill (TCP internals)
- Weight-free (society size = no unnecessary participants)
