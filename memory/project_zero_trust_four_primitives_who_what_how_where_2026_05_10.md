---
name: Zero trust four primitives — WHO (SPIFFE) + WHAT (OPA) + HOW (BFT) + WHERE (Arrow)
description: The complete zero trust stack requires four primitives. OPA alone = unauthenticated policy. SPIFFE alone = authenticated but no policy. BFT = consensus on issuance/sync. Arrow = trust-tier transport. Istio bundles all four in YAML hell. Zeta bundles them in types.
type: project
---

2026-05-10: Aaron identified OPA's missing identity layer — the four primitives must compose.

**The four zero trust primitives:**

| Primitive | Question | Source (concept steal) | Zeta equivalent |
|-----------|----------|----------------------|----------------|
| **WHO** | Who is asking? | SPIFFE (cryptographic identity, SVIDs) | Hat credentials |
| **WHAT** | Is this action allowed? | OPA (policy decisions, Rego rules) | F# types (compiler-enforced policy) |
| **HOW** | Who agreed on the rules? | BFT consensus (issuance + policy sync) | Multi-agent consensus |
| **WHERE** | What trust level is the channel? | Arrow trust tiers (0-3) | Kernel trust-tier router |

**Why all four are required:**

- OPA without SPIFFE = unauthenticated policy decisions (anyone can ask)
- SPIFFE without OPA = authenticated but no policy (identity without rules)
- Both without BFT = centralized issuance (single point of trust)
- All three without Arrow = mTLS everywhere (unnecessary overhead at Tier 0)

**Istio's approach (concept right, implementation wrong):**

Istio bundles Envoy + OPA + SPIFFE + mTLS. All four primitives present. But bundled in YAML config hell with sidecar proxies and centralized control plane.

**Zeta's approach (concept steal, refuse implementation):**

- WHO: F# discriminated unions as identity types (compile-time)
- WHAT: F# type constraints as policy (compiler enforces, no Rego)
- HOW: BFT consensus replaces centralized servers
- WHERE: Arrow Tier 0 for same-trust, tiers 1-3 for decreasing trust

Four primitives, zero YAML, zero sidecars, zero control plane SPOF.

**Connects to:**

- project_spiffe_concept_steal (the full mapping)
- project_microkernel_trust_tier_router (WHERE at kernel level)
- project_trust_migration_path (the journey to zero trust)
- 081KR7JY10008QG0R0021F5609 weight-free (WHO via hat mechanism)
- feedback_arrow_tier_0 (WHERE via Arrow)
- feedback_eve_protocol_serialization (trust tiers at wire format)
