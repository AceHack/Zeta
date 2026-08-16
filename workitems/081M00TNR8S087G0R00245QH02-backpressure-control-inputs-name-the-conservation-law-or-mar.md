---
id: 081M00TNR8S087G0R00245QH02
type: task
state: backlog
priority: P2
slug: backpressure-control-inputs-name-the-conservation-law-or-mar
title: "Backpressure control inputs: name the conservation law or mark the input correlated"
created: 2026-08-14T19:06:11.097Z
depends_on: []
composes_with: []
---

# Backpressure control inputs: name the conservation law or mark the input correlated

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00TNR8S087G0R00245QH02-*.md` glob. -->

## The practice

An input to a backpressure decision is **derived** when a conservation law connects it to the
quantity being steered on, and **correlated** otherwise. Correlated inputs vary plausibly while
measuring something else, which is why they raise confidence rather than lowering it.

Adopt the rule: **name the conservation law, or mark the input correlated.**

Derived, with the identity written next to it:

| input                                     | law                                         |
| ----------------------------------------- | ------------------------------------------- |
| queue occupancy                           | `arrivals = departures + occupancy + drops` |
| deferred-set size (conservative operator) | `offered = admitted + deferred`             |
| `SoftThrottle` tank charge                | `heatSpent = Capacity - Charge`             |
| bulkhead share                            | `sum(shares) <= C`                          |
| standing-queue-from-delay                 | Little's law `L = lambda*W`                 |

Correlated, with the confound that kills each:

| input                   | confound                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------- |
| loss / NACK rate        | corruption, reorder, receiver silence (5% corruption == 5% congestion in the quotient) |
| latency percentile      | route change, preemption, GC pause                                                     |
| breaker error rate      | client bug, bad input, **an upstream breaker already open**                            |
| throughput              | saturated vs no demand; pinned by capacity under saturation                            |
| threadpool queue length | work vs blocking                                                                       |

## The CHECKED fact this rests on

`CongestionEvidence` in `src/Core.TypeScript/discovery/udp-lossy-transport.ts` is **not
constructible** — its brand symbol is unexported with no minting function. The transport therefore
has **no derived congestion input at all** today; every congestion decision is taken on `unknown`.

## Scope

Documentation + review practice first. A lint that requires a named law is NOT proposed here:
it would itself be an instrument that cannot report what it exists to report (a comment naming a
law is not a law). The concrete next increment is a real queue/delay signal with Little's law
behind it, which is what would make `CongestionEvidence` mintable honestly.

Study: `docs/research/2026-08-14-backpressure-has-no-single-algebra-deferral-composes-destruction-does-not-and-bandwidth-isolation-decorrelates-the-channel-not-the-common-cause.md`
