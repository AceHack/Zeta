---
name: Eve protocol serialization — three trust tiers, observe-first at boundaries only
description: Serialization as trust-then-verify. Tier 1 (known types, fast), Tier 2 (known-types-list, medium), Tier 3 (Eve protocol observe-first, slow, trust boundaries only). Content is invariant, label is variable. Z-set weight reinterpretation without changing datum.
type: feedback
---

2026-05-10: Aaron connected Eve protocol polymorphism to serialization. The serialization problem IS the Eve protocol problem.

**The problem with existing serializers:**

Every serializer (JSON, Protobuf, MessagePack, Cap'n Proto, Avro) bakes the type label into the wire format. Deserializer needs to know WHAT before it can read. Label-first, observe-second.

Eve protocol inverts: **observe first, label later.** Content carries identity through structure, not through declared label. Label can change without re-serializing.

**Three tiers of deserialization trust:**

| Tier | Trust level | Speed | When to use |
|------|------------|-------|-------------|
| 1. Known types | Full trust | Fast | Internal factory traffic, pure types |
| 2. Known-types-list | Partial trust | Medium | Cross-agent bus (081KR7JY10008QG0R000R503K2), discriminated unions |
| 3. Eve protocol | No prior | Slow | Trust boundaries, shadow observations, external input |

**Optimization:** Start at tier 1, fall through to 2 on failure, fall through to 3 only at actual trust boundaries. Most traffic stays at tier 1. The slow path is reserved for genuinely unknown sources.

**The trust-then-verify parallel:**

- Tier 1 = trust the type label (fast path)
- Tier 2 = verify against known options (medium path)
- Tier 3 = observe-first, no prior trust (slow path)

Same pattern as the factory's trust model applied to wire format.

**Z-set contribution at serialization layer:**

The weight on a datum can be reinterpreted without changing the datum itself. Content teleports between label spaces (tele-port-leap) without the wire format changing. The content is the invariant. The label is the variable.

**F# implementation path:**

- Tier 1: direct type-safe deserialization (standard)
- Tier 2: discriminated union with pattern matching (F# native)
- Tier 3: read to untyped AST, structural pattern match, then assign DU case

**Connects to:**

- Eve protocol polymorphic diplomacy (same principle, different layer)
- tele-port-leap (content teleports between label spaces)
- Z-set algebra (weight reinterpretation)
- 081KR7JY10008QG0R000R503K2 inter-agent bus (tier 2 for bus messages)
- Shadow observation (tier 3 for unknown sources)
- Trust-then-verify (the tiers ARE the trust model)
