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

## THE LADDER (2026-07-02): codecs are rung 2 of a spec→generated-parser ladder

Aaron: *"our zetaid is a tiny parser generator … bits, a bit parser/generator … the ANTLR
stuff is likely just docs/research … LARGE scope: compile to/from our IR and most other ANTLR
grammars using our parser generators and the open free ANTLR grammars; small changes to
existing ANTLR grammars is fine."* The value-tree codecs are **rung 2** of one ladder:

- **rung 1 (built):** `Core.FSharp.ZetaId` — spec (`zeta-id-v1-layout.yaml`) → `GeneratedBitLayout`
  → bit parser/generator. The proven-in-miniature seed.
- **rung 2 (built, this trajectory):** format codecs over `DynamicValue`.
- **rung 3 (designed, not built):** **ZetaParse** — ingest ANTLR `.g4` / Yacc / Tree-sitter /
  `.zg` → **Zeta Grammar IR** → LR/GLR parser (6 langs). Consume `antlr/grammars-v4` (MIT/BSD;
  don't reinvent). Docs: `zetaparse-lr-glr-fsharp-compiler-fork-design-2026-05-21` (Amara);
  `antlr-grammar-survey-{2026-05-21,2026-06-13}` (Lior).

**Full synthesis:** `docs/research/2026-07-02-parser-generator-foundation-ladder-zetaid-bits-to-value-tree-codecs-to-zetaparse-grammar-ir-antlr.md`.

## NEXT PICKUP (subsumed by the ladder — scope rung 3 with Aaron; LARGE)

<<<<<<< Updated upstream
1. **Zeta Grammar IR as a `DynamicValue` schema** — the grammar is data ⇒ rides rung-2 codecs
   (byte-lockable, DST-replayable). The natural first, bounded piece.
2. **`.g4` → Grammar IR ingester** (compatible subset; log drops — no silent truncation), from
   one grammars-v4 asset. **KDL and lenient-YAML are subsumed here** — both are just grammars
   ingested (KDL/YAML `.g4` exist), not bespoke hand-parsers.
3. **LR/GLR backend** emitting an F# parser from the Grammar IR (the ZetaParse rung).
4. Parity categories needing a core `DynamicValue` shape first (Decimal / SoftValue / Kleene) —
=======
1. ✅ **Zeta Grammar IR as a `DynamicValue` schema** — LANDED (`src/Core/GrammarIr.fs`):
   `Grammar` (terminals/nonterminals/productions/start) ⇄ `DynamicValue` bijection; grammar rides
   the codec stack (byte-lockable, DST-replayable); total parse. STRUCTURAL core only — v2 adds
   semantic actions / precedence / recovery / incremental hooks (design pass with Aaron).
2. ✅ **`.g4` → Grammar IR ingester** — LANDED (`src/Core/Antlr4Import.fs`): compatible (BNF)
   subset; EBNF/actions **skipped + logged** (`Ingest.Skipped`, no silent truncation);
   deterministic (hex-named literal terminals, not GetHashCode); total on hostile input.
   OPEN FORK (design, for Aaron): how the neutral IR represents **EBNF** (carry it vs. desugar
   to BNF) — currently deferred by log-skipping. Then point it at YAML/KDL `.g4` to retire those.
3. ✅ **Grammar closure check** — `GrammarIr.isClosed`/`undefinedSymbols`: "every word defined by
   other words" (Aaron's dictionary). First machine-checkable step toward the homoiconic
   meta-grammar. **← resume: the homoiconic-meta-grammar vision + math-team proof obligations.**
4. **LR/GLR backend** emitting an F# parser from the Grammar IR (the ZetaParse rung).
5. Parity categories needing a core `DynamicValue` shape first (Decimal / SoftValue / Kleene) —
>>>>>>> Stashed changes
   each needs a DU decision, do NOT add unilaterally. HDF5 / DOT remain on the codec ledger.

## HOMOICONIC META-GRAMMAR (2026-07-02, Aaron): the telos

*"our meta grammar should be homoiconic, provably by the math team … english itself as its own
grammar … a dictionary that has every word it uses defined by other words."* Homoiconic = the
Grammar IR is a `DynamicValue` (already). Dictionary-closure = `isClosed` (landed). Proof
obligations (route to Soraya / `Core.Lean4` math team): homoiconicity fixed point, closure +
totality, self-hosting (Futamura, `gen(gen)==gen`). Full:
`docs/research/2026-07-02-homoiconic-meta-grammar-english-as-its-own-grammar-dictionary-closure-provable-by-math-team.md`.

> Rung 3 is LARGE + design-heavy and already has a design (ZetaParse). Do it under Aaron's
> scope steer, building on the existing foundation — not unilaterally, not reinvented.

## Anchors

Cockburn (hexagonal); Thompson *Trusting Trust*, SolarWinds, xz/CVE-2024-3094; ITU-T
X.690 (ASN.1), IEC 62056 (DLMS/COSEM); RFC 8949 (CBOR), RFC 4648 (base64); CloudEvents
(CNCF), Debezium; `SchemaEvolution` 081KSRGFP0008QG0R001Y6RTY9 (version/roll seed).
`ZetaId` = the universal pointer on envelope graph edges (inside + outside the
superdeterministic Markov boundary).
