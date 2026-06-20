# `zeta-ir-v1` extension: Z-set operations (Phase C design)

**Status:** DESIGN (not frozen). **Owner:** Alexa. **Date:** 2026-06-20.
**Trajectory:** `gen-gen-self-hosting-bytelock` Phase C.

## Motivation

`zeta-ir-v1` covers arithmetic finalizers (`mul`, `xorshr`) — sufficient for RNG/hash
generators. Phase C extends the codegen to higher-level primitives: ZSet, DynamicValue,
Bag, GSet. These require a richer op grammar while maintaining the same properties:
total, deterministic, cross-language-reproducible.

## Design decision: domain schemas, not a universal IR

Rather than cramming everything into one schema, each domain gets its own `zeta-ir-v1-<domain>`
schema tag. This follows the evolution contract (v1 § "Freeze-then-grow"): the existing
`zeta-ir-v1` golden stays unchanged; new domains are additive.

## Proposed: `zeta-ir-v1-zset`

```json
{
  "schema": "zeta-ir-v1-zset",
  "primitive": "merkle-root",
  "version": 1,
  "algorithm": {
    "leaf": "4-byte-LE-keylen + key-bytes + 8-byte-LE-weight",
    "hash": "xxhash128",
    "sort": "byte-ordinal",
    "fold": "binary-merkle-tree (odd-promotes)"
  },
  "golden": [
    { "id": "empty", "entries": [], "root": "7f498d4624c30160d8984701d306aa99" }
  ]
}
```

## Properties required

1. **Total:** every valid input has a deterministic output (no partial functions)
2. **Cross-language:** the algorithm is specified at byte-level precision
3. **Golden-gated:** committed golden vectors byte-lock the implementation
4. **Additive:** new schemas don't change existing `zeta-ir-v1` artifacts

## Open questions (for next session)

1. Should the hash function (xxhash128) be inlined or referenced by name?
2. Should the leaf encoding be parameterized or fixed?
3. How do DynamicValue/Bag/GSet map onto this pattern? (Same schema, different `primitive`?)

## Relationship to the gen(gen) trajectory

Phase C doesn't need the full IR-driven codegen to be "self-hosting" — it needs the
*golden vectors* to be reproducible from a declarative description. The codegen for
ZSet operations is structurally different from arithmetic finalizers: it's an algorithm
specification (not an op pipeline), so the "total interpreter" approach still works but
the interpreter is domain-specific.

The gen(gen) property at this tier: `describe(algorithm) + codegen(description) === implementation`.
Same fixpoint, different substrate.
