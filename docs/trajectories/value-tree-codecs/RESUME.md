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
| (this) | `EventEnvelope` — CloudEvents + Debezium categories; Debezium `op` ≈ Z-set ±1; envelopes ride the whole codec stack |

## Rollout status (the ledger, short form)

- **1-ary `Ours`:** JSON ✅ · CBOR ✅ (total) · YAML ✅ — parity envelope closes Bytes/Float ✅
- **2-ary:** ASN.1/DER ✅ `Ours` · XML (RomDat, `Bcl System.Xml.Linq` seam) → our tokenizer TODO
- **Event envelopes:** CloudEvents ✅ · Debezium ✅ (op≈±1)

## NEXT PICKUP (delayed slices — Aaron 2026-07-02 "either both … whichever we delay")

1. **KDL** — the clean text 2-ary codec (node children ⊕ properties). Our-own reader/writer;
   the delayed half of the event-envelopes-vs-KDL fork. **← resume here.**
2. **Frontmatter ⇄ value-tree bijection** — `---\n<yaml>\n---\n<body>` ↔ `{meta, body}`
   (metadata⊕payload, the repo-serving case; scope to what our canonical YAML parses).
3. Parity categories needing a core `DynamicValue` shape first (Decimal / SoftValue / Kleene
   tri-boolean) — each needs a DU decision, do NOT add unilaterally.
4. HDF5 (starts `ThirdParty` — the case the port exists for); GraphViz DOT (graph, lossy).

## Anchors

Cockburn (hexagonal); Thompson *Trusting Trust*, SolarWinds, xz/CVE-2024-3094; ITU-T
X.690 (ASN.1), IEC 62056 (DLMS/COSEM); RFC 8949 (CBOR), RFC 4648 (base64); CloudEvents
(CNCF), Debezium; `SchemaEvolution` 081KSRGFP0008QG0R001Y6RTY9 (version/roll seed).
`ZetaId` = the universal pointer on envelope graph edges (inside + outside the
superdeterministic Markov boundary).
