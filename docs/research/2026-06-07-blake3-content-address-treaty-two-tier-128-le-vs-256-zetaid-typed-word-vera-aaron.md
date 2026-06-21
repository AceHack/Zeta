# BLAKE3 content-address treaty — two tiers (ContentAddress128 LE vs ContentHash256 raw), ZetaId-is-a-typed-word, ordering-out-of-the-key (Vera + Lior + Aaron, 2026-06-07)

The team's resolution of the BLAKE3 4-language byte-lock question Otto routed (umbrella `081KTH323AK`).
**Vera + Lior** (4-lang reviewers) + Aaron. Faithful capture + reconciliation of the two reviews,
Beacon-anchored. (Implementation: the **ZetaId overlay is LANDED by Lior** — see "As-built" below;
`ContentHash256` (the full-256 proof tier) is the remaining gap, backlogged. This doc is the reconciled
decision record.)

## Reconciliation (Vera ⊕ Lior — read this first)

Both agree on a **two-tier** design; Lior added two sharpenings:

1. **`ContentHash256` is RAW byte order (no reversal)** — `af1349b9f5f9a1a6a0404dea36dcc949…` for empty
   input. Crypto libs return raw bytes; reversing only the 256-bit tier adds cross-language
   "off-by-one-endianness" risk. So **256-bit tier = raw**, **128-bit tier = LE UInt128** (`49c9dc…`) —
   different byte orders *on purpose* (raw-digest vs compact-int), each named explicitly.
2. **128-bit is INTERNAL / non-adversarial ONLY.** Lior: 128-bit ⇒ ~64-bit collision resistance, and 2⁶⁴
   BLAKE3 evals are feasible for a motivated attacker (GPU/ASIC/cloud) — collide a benign file with a
   malicious backdoor, get the benign one signed, swap. **So files / packages (Ace) / blocks (Zeta) /
   anything signed-or-exported MUST address by the full `ContentHash256`.** `ContentAddress128` is for the
   internal CAS hot path (indexes/refs/dedup) only, backed by / verifiable against the full digest.

Net reconciled rule: **`ContentHash256` (raw, full) is identity-of-record for files/packages/blocks and
every adversarial/export/proof surface; `ContentAddress128` (LE, lower 128 bits) is a compact internal
handle that must be verifiable against the full digest.**

## The treaty (decisions)

### 1. Two tiers — compact internal address vs full proof digest

- **`ContentHash256`** = the **full BLAKE3-256 digest** (32 bytes). The canonical proof of bytes; used for
  verification / export / adversarial comparison / signatures. **Defined independently of any ZetaId
  packing.** This is the security boundary.
- **`ContentAddress128`** = the **lower 128 bits of the BLAKE3 digest, rendered as a little-endian
  UInt128**. Compact internal CAS identity (indexes, references, the hot path). **Empty input ⇒
  `49c9dc36ea4d40a0a6a1f9f5b94913af`** (Otto's vector confirmed: first 16 digest bytes, LE UInt128).

**Security envelope (Vera, be honest):** 128-bit truncation has only ~**64-bit collision resistance**
(birthday). Fine for internal/non-adversarial dedup (≈1.5e-15 birthday risk at 10¹² objects). **NOT** a
security boundary for adversarial public dedup, signatures, or "attacker wins on any collision" — use
**`ContentHash256`** there. Keep full-256 sidecars for important stores.

### 2. `ZetaId128` is a typed word, NOT a raw 128-bit hash (Aaron)

> Aaron: *"zetaid needs at least a version and a category so it can't use all 128 bits; most zeta ids are
> not a hash — they are a mini parser-combinator/generator program where the high bits decide how to
> interpret the low bits (or vice-versa)."*

`ZetaId128 = version bits + category bits + category-specific payload bits` — closer to a tiny tagged
program than a hash. So a **content-address category embeds a PREFIX of the digest**, not all 128 bits; the
number of digest bits is **layout-specific and declared per category**:

| content-address payload bits | verdict |
|---|---|
| ≥ 120 | fine for internal CAS identity |
| 96–112 | ok for local/internal non-adversarial dedup; keep full-256 sidecars; don't call it "collision-proof" |
| ≤ 80 | too small — caches/tests only |
| proof / export / security | store/verify the **full BLAKE3-256**, even if a short ZetaId points at it |

### 3. Ordering stays OUT of the content-address bits

> Aaron: putting index hints / timestamps / shard lanes / ordering into the key spends payload bits.

Default: **don't** spend content-address bits on ordering — name the bytes with hash-derived bits, and put
ordering in the **index key**: `index key = (timestamp, category, zeta_id)`, `value = full ContentHash256 /
pointer / metadata`. The storage engine gets ordering without weakening object identity. An
`OrderedContentRefId` layout (epoch/shard + shorter hash prefix) is allowed **only** when the ID's primary
job is locality/range-scan, and it **must verify against the full digest** before identity is treated as
proven.

### 4. The digest treaty is independent of ZetaId packing

The BLAKE3 treaty defines the **canonical digest + byte order** on its own. ZetaId content categories *may*
embed a declared-length prefix of it; any layout with ordering/index bits must verify against the full
(or a longer stored) digest before treating identity as proven.

## AS-BUILT (Lior landed it, 2026-06-07) — reconciled with the treaty

Lior implemented the ZetaId overlay across all four oracles (cross-verify 12/12; 1937 F# / 268 C# / TS
green). The as-built confirms the treaty's *principle* with concrete numbers:

- **`Category.ContentAddress = 9`** (`Category.Extended = 15` escape); categories **0..8 = Observation**
  (structured), **9 = ContentAddress**, **10..15 = Generic**. The category discriminant decides
  interpretation (Aaron's "high bits decide how to read the low bits"). Files: `src/Core.FSharp.ZetaId/`
  (`Types.fs`, `Codec.fs`), `src/Core.CSharp.ZetaId/` (`Category.cs`, `ZetaIdPayload.cs`, `ZetaIdCodec.cs`),
  `src/Core.TypeScript/zeta-id/`.
- **`ZetaIdPayload` DU** = `Observation obs` | `ContentAddress (version, payload)` | `Generic (version,
  category≥10, payload)`. `packGeneric`/`unpackGeneric` carry a **119-bit payload** (version 5 + category 4
  = 9 bits spent of the 128). `packPayload`/`unpackPayload` round-trip; out-of-range (>119 bits) and
  category-range violations raise. FsCheck proves `unpack ∘ pack = id` over the partitions.
- **The 119-bit ZetaId content-address payload ≠ the standalone 128-bit `ContentAddress128`.** Inside a
  ZetaId, the ContentAddress category embeds a **truncated BLAKE3 prefix** (Lior used ~14 bytes / 112 bits,
  within the 119-bit budget) — the declared-per-category prefix the treaty calls for. The standalone
  `ContentAddress128` (the 16-byte `MerkleHash` from `Core.Blake3.Blake3Hasher`, `49c9dc…`) remains the
  digest-derived address **independent of ZetaId packing** — consistent with the treaty (don't conflate the
  two). ✓
- **REMAINING GAP — `ContentHash256` is NOT built yet.** No `ContentHash256` in `src/**`. The full 256-bit
  raw-byte proof tier (for files/packages/blocks/adversarial/export) still needs a distinct 32-byte digest
  type + the full-digest function on `Core.Blake3` + the empty-input known-answer (`af1349b9…`). Backlogged
  as the next trust-core slice. Until it lands, do NOT content-address files/packages by the 128-bit address
  alone (Lior's adversarial caveat).

## Ties

- Remaining gap tracked: **`081KTH59TVZ`** (ContentHash256 full-256 proof tier).

- `Core.Blake3.Blake3Hasher` / `IContentHasher` (the 128-bit ContentAddress path) · `ZSetMerkle` /
  `ContentStore` (consume the 128-bit address) · ZetaId (the typed-word lineage — version/category/payload)
  · umbrella `081KTH323AK` (4-lang catch-up) · 081KSXN940008QG0R003FCQ7WT (4-oracle checklist) · the no-binary-in-proof-lineage
  rule (full digest in golden vectors as hex).

## Beacon anchors

- **BLAKE3** (O'Connor, Aumasson, Neves, Wilcox-O'Hearn) — output is safe to truncate for identifiers. ·
  **Birthday bound** — n-bit truncation ⇒ ~n/2-bit collision resistance. · **Domain separation** (keyed/
  context hashing) — for distinct content-address categories. · **Content-addressed storage** (git/IPFS use
  full digests for the proof tier). · ZetaId-as-typed-word (Aaron) — version/category/discriminant packing,
  the parser-combinator-word design. Honest novelty: none in the crypto; the contribution is the explicit
  two-tier split (compact typed address vs full proof digest) with the security envelope named.
