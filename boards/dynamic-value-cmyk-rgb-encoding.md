# Board: encode DynamicValue into CMYK (solid) + RGB (soft) — Haskell-Prelude-rules style

**Register:** [board-room] proposal/discussion (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). A board-room discussion, not a landed decision.

> **`/boards` is the board room** (Aaron 2026-06-10): "this is our board room where we discuss
> `/boards`." Boards are where we *discuss*; a proposal lives here until a room/sim measures it.

## The proposal

Encode the **DynamicValue** (`Tagged`) into **two color encodings** — the round's "CMYK (solid) + RGB
(soft) instead of ACTG" alphabet — **in Haskell-Prelude-rules style** (lawful typeclass instances, not
ad-hoc): the encode/decode is a set of **laws** the compilers enforce, the way Prelude's `Functor` /
`Monoid` / `Eq` carry laws.

The DynamicValue v1 `Tagged` (from `src/Core.TypeScript/dynamic-value`):

```text
Tagged = null | bool b | int v | str v | arr [Tagged] | obj [(str, Tagged)]
```

Two encodings of that one value:

- **CMYK = SOLID** (4 channels; subtractive; ink-permanent). The **committed / on-`main`** encoding —
  what `mea`/`cut` write. **K = the key/black = the encrypted-null** channel (the void). Use CMYK when
  the value must *persist* (the genome on `main`).
- **RGB = SOFT** (3 channels; additive; light/emissive; ephemeral). The **`sim`** encoding — light that
  leaves no ink. Use RGB for the exploratory/transient view.

### Prelude-rules style (lawful, not ad-hoc)

State the encoding as **laws** the four oracles byte-lock (Beacon: Haskell Prelude / typeclass laws —
the lawful-instance discipline):

- **Round-trip (the central law):** `decode (encode x) = x` — both for CMYK and RGB. (Like
  `fromEnum/toEnum`, `read/show` round-trips.)
- **Canonicality (idempotent, shape B):** `encode (decode (encode x)) = encode x` — one canonical
  byte-image per value (mirrors `canonicalJson`'s fixed-point check; content-addressable).
- **Total + ordered (shape C/B):** encode is total over `Tagged`; ordering is ordinal/culture-invariant
  (the existing primitive discipline), so the color-bytes sort identically across oracles.
- **Solid ⊒ soft (a projection law):** RGB (soft, 3-ch) is a *lossy projection* of CMYK (solid, 4-ch);
  `soften (solid x)` is well-defined, the reverse needs the K/null channel — names *why* committed
  (CMYK) carries more than ephemeral (RGB).

*(Exact channel↔variant assignment — which of null/bool/int/str/arr/obj rides which C·M·Y·K / R·G·B
lane, and the numeric packing — is the open board-room question. The laws above hold regardless of the
assignment; the assignment is what the room/sim resolves.)*

## How we settle it — a room/sim, `mea`'d repeatedly until it resolves (Aaron)

> Aaron: "we need a **room/sim** for that so we can **`mea`** it." · "**repeatedly until it resolves**."

This proposal is **not decided by argument** — it is **measured**. Stand up a **room** (a `sim`
scenario under [`sims/`](../sims/)) that exercises the candidate encoding over DynamicValue samples
(the existing golden vectors are the corpus), and **`mea` it repeatedly until it resolves** — i.e. run
`mea(sim)` in a loop until the encoding reaches a **fixed-point shape** (B idempotent / A self-consistent
/ D contracts to a healthy floor), banking ΔU each pass. "Resolves" two ways: **converges** (the
finalizer's uncertainty reduction → 0 new ΔU) *and* gains **resolution** (the infinite-resolution
zoom). When the room stops reducing uncertainty, the encoding is resolved → the winning assignment is
`cut` to `main`.

## Pointers

- [`boards/README.md`](README.md) (the board room; never-one/discriminator) · [`sims/`](../sims/)
  (`sim`/`mea`/`cut`; the room to measure in) · [`gene/`](../gene/) (DNA/sequence) ·
  [`uncertainty/`](../uncertainty/) (ΔU banked each `mea`).
- `src/Core.TypeScript/dynamic-value/` (the `Tagged` value + golden vectors = the corpus).
- `docs/research/2026-06-10-filesystem-is-the-startup-merkledag-and-the-sim-mea-cut-cli-triad-macvector-for-dna.md`
  (CMYK/RGB encoding + the triad).
- Haskell Prelude / typeclass-law discipline (lawful instances) · shapes A/B/C/D (the resolution targets).
