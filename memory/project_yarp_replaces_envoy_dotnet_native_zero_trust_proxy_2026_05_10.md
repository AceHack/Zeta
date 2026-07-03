---
name: YARP replaces Envoy — .NET-native reverse proxy, no sidecar, F# composable
description: YARP (Yet Another Reverse Proxy) is Microsoft's .NET-native Envoy replacement. In-process (no sidecar), F# type system composable, middleware pipeline replaces YAML config. The WHERE primitive implemented in the .NET ecosystem.
type: project
---

2026-05-10: Aaron identified YARP as the .NET-native Envoy replacement for the zero trust stack.

**YARP — Yet Another Reverse Proxy:**

- Microsoft's .NET-native reverse proxy
- Built on ASP.NET Core / Kestrel
- Fully C#/F# composable
- In-process (no sidecar container)
- Middleware pipeline (policy via typed code, not YAML)
- Hot-path friendly (high throughput)

**The complete Zeta zero trust stack:**

| Primitive | Question | Istio (refuse) | Zeta (steal) |
|-----------|----------|---------------|--------------|
| WHO | Identity | SPIFFE/SPIRE server | Hat credentials via F# types |
| WHAT | Policy | OPA/Rego | F# type constraints (compiler enforces) |
| HOW | Consensus | Control plane (SPOF) | BFT consensus |
| WHERE | Transport | Envoy (C++ sidecar) | YARP (.NET in-process) + Arrow Tier 0 |

**Why YARP over Envoy:**

- Same ecosystem as Zeta (both .NET)
- No sidecar deployment overhead
- Policy as typed F# middleware, not YAML/Rego
- Composes with Arrow for Tier 0 bypass (same-trust = skip proxy entirely)
- Kestrel performance for cross-trust channels

**YARP + Arrow composition:**

- Tier 0 (same trust): Arrow shared memory, YARP not involved
- Tier 1-2 (partial trust): YARP routes with F# typed policy middleware
- Tier 3 (no trust): YARP + full Eve protocol observation layer

YARP is the proxy for tiers 1-3. Arrow bypasses it at Tier 0. The proxy only exists where trust requires verification.

**Connects to:**

- project_zero_trust_four_primitives (WHERE primitive)
- project_spiffe_concept_steal (the full stack)
- project_microkernel_trust_tier_router (kernel routes on trust)
- feedback_arrow_tier_0 (Tier 0 bypasses proxy)
