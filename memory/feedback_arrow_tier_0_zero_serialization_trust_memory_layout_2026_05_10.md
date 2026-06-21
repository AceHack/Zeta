---
name: Arrow as Tier 0 — zero serialization, absolute trust at memory layer
description: Arrow IS the ultimate trust-then-verify fast path: trust so completely that serialization doesn't exist. In-memory format = wire format = disk format. Extends the Eve protocol serialization tiers with Tier 0 (zero-copy shared memory). F# Span<T> over Arrow buffers = compile-time trust guarantee.
type: feedback
---

2026-05-10: Aaron identified Arrow as the tier below known-types in the serialization trust model.

**The full tier model:**

| Tier | Trust level | Serialization cost | Example |
|------|------------|-------------------|---------|
| 0. Arrow | Absolute trust | Zero — shared memory layout | In-process, same-machine IPC |
| 1. Known types | High trust | Minimal — direct deserialize | Internal factory, Protobuf |
| 2. Known-types-list | Partial | Medium — try N types | Cross-agent bus (081KR7JY10008QG0R000R503K2) |
| 3. Eve protocol | No prior | Full — observe then label | Trust boundaries, shadow |

**Why Arrow is Tier 0:**

Arrow doesn't serialize. The in-memory columnar format IS the wire format IS the disk format. No transformation, no label parsing, no type check at read time. The deserializer trusts the memory structure completely because there's nothing to deserialize.

Trust so complete that the serialization step disappears entirely.

**Zeta hot-path target:**

Z-set weights live in Arrow arrays. No serialization between operators. Data stays in the format it was born in. This is what the columnar storage layer and vectorised execution should target.

**F# + Arrow composition:**

`Span<T>` over Arrow buffers = zero-copy access with type safety at compile time. The F# type system IS the Tier 0 trust guarantee. The compiler verified it — no runtime check needed. `erasableSyntaxOnly` ensures the TS layer has the same property: types erase cleanly, no runtime transformation.

**The trust gradient:**

Tier 0 → 1 → 2 → 3 is a gradient from absolute trust (shared memory, zero cost) to no trust (observe-first, full cost). The factory routes traffic to the cheapest tier that's appropriate for the trust relationship. Hot paths stay at 0. Bus messages at 2. Shadow and external input at 3.

**Connects to:**
- feedback_eve_protocol_serialization_three_tiers (tiers 1-3)
- columnar-storage-expert skill (Arrow internals)
- vectorised-execution-expert skill (Arrow in-memory format)
- F# Span<T> + erasableSyntaxOnly (compile-time trust)
- Z-set algebra (weights in Arrow arrays)
