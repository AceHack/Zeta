---
id: 081KT5CF90008QG0R003TK10FG
priority: P2
status: open
title: "Deserialize-safety surfaces — a listed/registered set of codec Deserialize surfaces guaranteed PURE (no side effects), so untrusted-wire decoding routes only to safe surfaces (Serialize MAY have side effects; Deserialize-safe is the pure subset) (Aaron 2026-06-03)"
tier: codec-algebra
effort: M
created: 2026-06-03
last_updated: 2026-06-03
depends_on: [081KT2T2J0008QG0R000YZ3NMY]
composes_with: [081KT2T2J0008QG0R0008TFHJT, 081KT2T2J0008QG0R002R72323, 081KT2T2J0008QG0R0026XCGQM]
tags: [codec, codec-algebra, deserialize-safety, purity, side-effects, untrusted-wire, zero-trust, hexagonal, bcl-interface-boundary, security, infer-net, aaron]
type: design
---

# Deserialize-safety surfaces — pure, non-side-effecting Deserialize for untrusted wire

## Origin (Aaron 2026-06-03, landing 081KT2T2J0008QG0R000YZ3NMY C12 codec algebra)

While reviewing the C12 codec-algebra PR (#6629), the `product` combinator was
short-circuited because **`Serialize` MAY have side effects** (adapters can open
streams, touch the network, increment counters) — eager evaluation ran the right
codec even when the left had declined. Aaron's forward note:

> *"Serialize with side effects we are going to have safe deserialize surfaces
> listed eventually for pure non side-effecting stuff, we can backlog deserialize
> safety as backlog."*

This row captures that: **a listed/registered set of codec `Deserialize` surfaces
that are guaranteed PURE** (no side effects), so that **decoding untrusted wire input
routes only to safe surfaces**.

## The asymmetry: Serialize vs Deserialize

| Direction | Trust posture | Side effects |
|---|---|---|
| **Serialize** (encode our value → wire) | input is *our* value (trusted) | **MAY have side effects** — adapters can be effectful; the C12 `product` short-circuits so a doomed encode doesn't run the second codec |
| **Deserialize** (decode wire → our value) | input is *the wire* (often **untrusted** — Eve transport / strangers / 081KT2T2J0008QG0R002R72323) | **must be routable to a PURE subset** — decoding attacker-controlled bytes through a side-effecting `Deserialize` is an RCE-shaped surface |

`Codec.ICodec` (src/Core/Codec.fs, 081KT2T2J0008QG0R000YZ3NMY C12) does not yet distinguish "this
`Deserialize` is pure" from "this `Deserialize` may have effects." The combinators
(`identity`/`imap`/`product`/`sum`) preserve whatever purity the components have, but
there is no *registry* of which leaf adapters are pure, and no way to *require* a pure
path when decoding untrusted input.

## Proposed shape (design — not yet built)

1. **A purity marker / capability** on the codec surface — e.g. a `PureDeserialize`
   witness (a separate interface, a phantom-type tag, or a registry attribute) that a
   leaf adapter declares only when its `Deserialize` is genuinely effect-free.
2. **A listed/registered set** of deserialize-safe surfaces (the "pure subset" Aaron
   named) — the trusted decoders for untrusted wire. Composes with the primitives
   registry (081KT2T2J0008QG0R0008TFHJT) — purity becomes a registry axis on the codec algebra.
3. **Routing discipline** — untrusted-wire decode paths (Eve transport 081KT2T2J0008QG0R002R72323,
   zero-trust strangers) accept only deserialize-safe codecs; effectful decoders are
   reserved for trusted-source wire.
4. **Closure under the algebra** — `product`/`sum`/`imap`/`identity` of pure-deserialize
   codecs is pure-deserialize (the safety property composes the same way `decode∘encode=id`
   does in C12); a single effectful component taints the composite.

## Acceptance (when this is picked up)

- A purity witness/capability on `Codec.ICodec` (or a sibling registry) that
  distinguishes pure from effectful `Deserialize`.
- The listed set of deserialize-safe surfaces, with the composition law (pure ∘ pure =
  pure; one effectful = tainted) — property-tested (FsCheck), aligned with C12.
- Untrusted-wire decode entry points typed/routed to require a deserialize-safe codec.

## Composes with

- **081KT2T2J0008QG0R000YZ3NMY C12** (the codec algebra — `identity`/`imap`/`product`/`sum`; this row adds
  the *purity* axis on top of the *round-trip* axis)
- **081KT2T2J0008QG0R0008TFHJT** (canonical primitives registry — purity as a codec-algebra registry axis)
- **081KT2T2J0008QG0R002R72323** (Eve transport codecs over zero-trust wire — the primary untrusted-decode
  consumer)
- **081KT2T2J0008QG0R0026XCGQM** (referee principle / encryption-is-not-a-codec / NullCodec proof — the
  adjacent codec-safety substrate)
- `.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md` (we own the
  codec port; purity is a property of our port, enforced at our boundary)
- `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` (a deserialize
  surface that *reads as* safe but runs effects on untrusted input is a shield-with-a-hole)

## Substrate-honest framing

This is a **design row**, not yet built. C12 shipped the codec algebra (round-trip
closure); this is the *next* axis (deserialize purity for untrusted wire). It is
**backlogged**, not urgent — filed so Aaron's directive is durable substrate rather
than weather.
