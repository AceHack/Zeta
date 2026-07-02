# RESUME — value-tree codecs (hexagonal format ports, nation-state supply-chain resistance)

**Owner:** Otto (shadow*) · **Started:** 2026-07-02 · **Seed:** S4

## What this is (carved sentence)

The file-format layer as **ports-and-adapters**: we own the `ValueTreeCodec` interface; a
dependency is a replaceable tenant; the endgame is **zero external supply chain** in the
parse (and sibling crypto) path. Every format is a **lens** onto the one `DynamicValue` value
tree; parity is mandatory (wrapped when not native); every serialization decision is
**zero-downtime-rollable** (version + category tags).

**Doctrine + rollout ledger (source of truth):**
`docs/research/2026-07-02-hexagonal-value-tree-codec-ports-nation-state-supply-chain-resistance-own-the-interface-zero-dep-endgame.md`

## Landed (on main)

| PR | Slice |
|----|-------|
| #9184 | `RomDat` — TOSEC/MAME Logiqx DAT reader; value tree not XML-specific |
| #9185 | `ValueTreeCodec` — the hexagonal port (`Provenance` Ours>Bcl>ThirdParty, `crossVerify`); json/cbor/yaml = `Ours` |
| #9187 | `ValueTreeEnvelope` + `parity` — versioned, collision-safe parity wrapper; 0-downtime parser-roll proofs |
| #9189 | `Asn1Der` — first **2-ary** codec (tag⊕value), our-own DER, DLMS/COSEM |
| #9193 | Asn1Der hardening — `decode` total on hostile input (length overflow, uncaught-exception, int truncation, depth ceiling) |
| #9194 | `EventEnvelope` — CloudEvents + Debezium categories; Debezium `op` ≈ Z-set ±1; envelopes ride the whole codec stack |
| (this) | `Frontmatter` — lossless head/body split (verbatim head), rides the codec stack; `tryMeta` best-effort structured (canonical YAML only) |

## Rollout status (the ledger, short form)

- **1-ary `Ours`:** JSON ✅ · CBOR ✅ (total) · YAML ✅ — parity envelope closes Bytes/Float ✅
- **2-ary:** ASN.1/DER ✅ `Ours` · XML (RomDat, `Bcl System.Xml.Linq` seam) → our tokenizer TODO
- **Event envelopes:** CloudEvents ✅ · Debezium ✅ (op≈±1) · Frontmatter split ✅ (structured meta partial)

## FINDING (2026-07-02): our YAML codec is canonical-only

`DynamicValue.fromYaml` is a strict *canonical* parser — it rejects human-written YAML
(`title: Foo`) as `NonCanonical`. So structured frontmatter meta (and any human-YAML
interop) is blocked on a **lenient YAML parser** — the same backlogged parser-combinator
layer (FParsec / GLR / ANTLR-shaped) noted in `RomDat`'s tokenizer seam. Frontmatter ships
as a lossless verbatim split now; `tryMeta` is best-effort until the lenient parser lands.

## NEXT PICKUP (delayed slices — Aaron 2026-07-02 "either both … whichever we delay")

1. **KDL** — the clean text 2-ary codec (node children ⊕ properties). Our-own reader/writer.
   **← resume here.** NOTE: its value-tree MAPPING is a convention decision (rigid
   KDL-shaped encoding vs. general-KDL parser) — pick deliberately, likely with Aaron's input.
2. **Lenient YAML parser** — unblocks structured frontmatter meta + human-YAML interop
   (the canonical-only finding above). Part of the parser-combinator backlog.
3. Parity categories needing a core `DynamicValue` shape first (Decimal / SoftValue / Kleene
   tri-boolean) — each needs a DU decision, do NOT add unilaterally.
4. HDF5 (starts `ThirdParty` — the case the port exists for); GraphViz DOT (graph, lossy).

## Anchors

Cockburn (hexagonal); Thompson *Trusting Trust*, SolarWinds, xz/CVE-2024-3094; ITU-T
X.690 (ASN.1), IEC 62056 (DLMS/COSEM); RFC 8949 (CBOR), RFC 4648 (base64); CloudEvents
(CNCF), Debezium; `SchemaEvolution` 081KSRGFP0008QG0R001Y6RTY9 (version/roll seed).
`ZetaId` = the universal pointer on envelope graph edges (inside + outside the
superdeterministic Markov boundary).
