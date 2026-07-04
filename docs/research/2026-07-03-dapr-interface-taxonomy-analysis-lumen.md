# Dapr Interface Taxonomy vs. Zeta Mathematical Properties

**Author:** Lumen
**Date:** 2026-07-03

## 1. The Dapr Baseline

Dapr (Distributed Application Runtime) provides a set of building block APIs for microservices. The most relevant to Zeta's distributed cron layer is the **Actors API**, which implements the Virtual Actor pattern.

In Dapr, an actor is an isolated unit of compute and state with single-threaded execution. Actors can schedule periodic work using **timers** (lightweight, non-persistent) or **reminders** (stateful, persistent).

### Dapr's Ethos (What We Share)
Zeta shares Dapr's core architectural philosophy:

- **Interface-first:** The runtime defines the contract; implementations (state stores, pub/sub brokers) are pluggable adapters.
- **Virtual Activation:** Actors do not need explicit creation; they are activated on demand and garbage collected when idle.
- **Language-neutral:** Communication happens over standard HTTP/gRPC boundaries rather than language-specific SDKs.

## 2. Mathematical Property Analysis

While Dapr's structural interfaces are elegant, they fundamentally **collapse uncertainty** at every boundary. Dapr is built for deterministic enterprise microservices, whereas Zeta is a Bayesian inference engine.

### Where Dapr Collapses the Math

| Dapr Mechanism | Mathematical Property Lost | Zeta's Required Replacement |
|---|---|---|
| **Request/Response (200/500)** | **Four-Corner Closure** | Dapr methods are fire-and-forget or deterministic return. Zeta requires a feedback channel where the receiver can report its updated belief state back to the sender. |
| **Key/Value State** | **Uncertainty Propagation** | Dapr state is binary ("known" or "not found"). Zeta state is a Gaussian belief (precision-mean). Storing a scalar collapses the variance. |
| **Global Routing** | **NCI Boundary Compliance** | Any Dapr actor can invoke any other actor by ID. Zeta requires routing to be bounded by the memory graph ("you can only help who you remember"). |
| **Fixed-Interval Timers** | **Tick as Strange Attractor** | Dapr timers fire blindly at `period` intervals. Zeta ticks should be adaptive, driven by Information Value (IV) gain. |
| **Synchronous Invocation** | **Delay-Decorrelation** | Dapr tries to minimize latency. Zeta uses latency (delay) to enforce independence, granting a Condorcet bonus to delayed paths. |

## 3. The Path Forward: Zeta's Hexagonal Interfaces

To adopt Dapr's interface-first ethos while preserving Zeta's mathematical invariants, we must define our own hexagonal ports. 

The `IDistributedCronRuntime` interface (introduced in `Core.Abstractions`) is the first step. It provides the structural shell of Dapr's actor timers, but the payload must be upgraded.

### The Required Upgrades

1. **Gaussian Payloads:** The `OnTick` callback must not just execute code; it must emit a Gaussian belief.
2. **Four-Corner Feedback:** When a tick fires and routes a belief, the router must return the receiver's posterior precision back to the tick source.
3. **Adaptive Ticking:** The `CronConfig` must support an `AdaptiveInterval` driven by the `InformationValue` of recent ticks. If a tick source yields zero IV (e.g., due to the AntiSybil uniqueness discount), its tick rate should exponentially back off.

By owning these interfaces in `Core.Abstractions`, Zeta can use Orleans, Temporal, or Dapr itself as the underlying execution engine, while strictly enforcing that the mathematical properties are never collapsed at the network boundary.
