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

1. ✅ **Zeta Grammar IR as a `DynamicValue` schema** — LANDED (`src/Core/GrammarIr.fs`):
   `Grammar` (terminals/nonterminals/productions/start) ⇄ `DynamicValue` bijection; grammar rides
   the codec stack (byte-lockable, DST-replayable); total parse. STRUCTURAL core only — v2 adds
   semantic actions / precedence / recovery / incremental hooks (design pass with Aaron).
2. ✅ **`.g4` → Grammar IR ingester** — LANDED (`src/Core/Antlr4Import.fs`). EBNF FORK RESOLVED
   (Aaron's recommended default, 2026-07-02): **EBNF is DESUGARED to BNF** — `x*`→`H:ε|H x`,
   `x+`→`H:x|H x`, `x?`→`H:ε|x`, `(…)`→helper — via a recursive-descent desugarer with
   deterministic helper names (`rule_gN`). Actions/predicates/wildcards still skipped + logged
   (pure-grammar-first). Total on hostile input. **MILESTONE: a real JSON `.g4` fully ingests
   and stays `isClosed`.** Next: point it at YAML/KDL `.g4` → retires the lenient-YAML + KDL findings.
3. ✅ **Grammar closure check** — `GrammarIr.isClosed`/`undefinedSymbols`: "every word defined by
   other words" (Aaron's dictionary). Also the desugar-correctness signal (a dangling helper ⇒
   not closed). First machine-checkable step toward the homoiconic meta-grammar.
4. ✅ **SLR(1) parser backend** — LANDED (`src/Core/Slr.fs`): `Grammar IR → executable parser`.
   LR(0) item-set automaton + nullable-aware FIRST/FOLLOW + ACTION/GOTO tables + shift/reduce
   driver. Conflicts SURFACE (`Tables.Conflicts`), not silently resolved. Deterministic.
   **END-TO-END PROVEN: a real `.g4` → ingest → IR → SLR → a running parser that accepts/rejects.**
   `Slr.parseTree` produces a concrete syntax tree that IS a `DynamicValue` — homoiconic all the
   way through (grammar-as-data → parser → parse-tree-as-data; it rides the codec stack). Executable.
5. ✅ **GLR fallback** — LANDED (`Slr.buildGlr`/`glrParse`): keeps ALL actions per state
   (conflicts retained), forks the parse (BFS over configurations, visited-bounded, total).
   **Parses ambiguous grammars SLR can't** (`E → E + E | id`), agrees with SLR on unambiguous
   ones. Naive GLR — the graph-structured-stack sharing + a GLR parse-FOREST (currently
   accept/reject only) are the next refinements. **← resume: GSS + parse forest, or LALR.**
6. ✅ **KDL fork RETIRED** — full ladder proven end-to-end on a real KDL grammar
   (`tests/…/GrammarLadder.Tests.fs`): `.g4 → ingest → GrammarIr (closed) → buildGlr → glrParse`
   parses KDL documents incl. the genuinely-ambiguous `node ID` case (GLR fork). KDL is a
   grammar we ingest + parse, not a hand-written codec.
   **YAML finding (honest):** YAML is **indentation-sensitive ⇒ NOT context-free**, so an LR/GLR
   grammar cannot consume it without an INDENT/DEDENT lexer preprocessing pass. ✅ **LANDED:
   `Indentation.layout`** (`src/Core/Indentation.fs`) — the off-side-rule pass (Landin / Python
   tokenizer): source → INDENT/DEDENT/NEWLINE token stream; inconsistent-dedent + leading-tab are
   clean Errors. Bridge PROVEN end-to-end (`Indentation.Tests`): indented source → layout →
   GLR-parse a block grammar. Indentation-sensitive languages are now reachable by the CFG backend.
7. ✅ **GLR parse FOREST** — LANDED (`Slr.glrForest`): every distinct parse tree of ambiguous
   input (each a `DynamicValue`), deduped + capped. `id+id+id` under `E→E+E|id` → ≥2 trees; an
   unambiguous string → exactly one.
   **THE TELOS (Aaron 2026-07-02):** the forest is the SUPPORT of a distribution over parses — an
   ambiguous **superposition over the ISA**. Weight it with **EP/BP/VMP (Infer.NET-style message
   passing) + custom emotional propagation** → a `SoftValue` over parses (the forest IS a factor
   graph; inside–outside = BP on it). Full: `docs/research/2026-07-02-ambiguous-parse-forest-as-
   factor-graph-ep-bp-vmp-emotional-propagation-soft-superposition-over-isa.md`.
9. ✅ **Parse forest → `SoftValue`** — LANDED (`src/Core/ParseSoft.fs`): `glrSoft` turns the forest
   into a `SoftValue` superposition over parse trees (uniform v1); `ofWeightedForest` takes explicit
   per-parse potentials (the shape BP/EP produces) → MAP-resolvable. First inference-rung step,
   reusing `SoftValue` (don't reinvent).
   **DISCOVERY (don't reinvent):** `Zeta.Bayesian` ALREADY has `FactorGraph.fs` / `Ep.fs` /
   `Message.fs` / `MessageBatch.fs` / `InferNetTopology.fs` / `QuantumFusion.fs` — the EP /
   message-passing / factor-graph infra. So the EP/BP/VMP weighting rung BUILDS ON that.
10. ✅ **SPPF (shared packed parse forest)** — LANDED (`src/Core/Sppf.fs`): the SHARED, packed
   forest — each sub-parse `(sym,i,j)` is one memoized node, so the forest is polynomial even when
   trees are exponential (Catalan(4)=14 trees, ≤25 nodes). A node with >1 **family** is an
   **ambiguity node** = the SSAS **`NodeDistribution`** point = the **factor-graph variable**.
   Cross-checked: `Sppf.parseCount` (over the shared structure) == `Slr.glrForest` tree count.
   Projects to a `DynamicValue` (homoiconic, DMX-queryable-as-data). Total (cycle-guarded).
   **BI framing:** `docs/research/2026-07-02-how-aaron-thinks-sql-server-bi-decision-forest-…`.
11. ✅ **Weighted INSIDE pass** — LANDED (`Sppf.inside`/`insideTotal`): the forward half of
   inside–outside, which **IS belief propagation on the parse forest** (Baker; Lari–Young). Exact,
   self-contained (no cross-subsystem coupling), cycle-guarded/total. `weight: prodIndex→float` is
   the `NodeDistribution` factor (the `PredictProbability` numerator). Uniform weights ⇒ `inside root
   = parseCount`; weighted scales exactly (id+id+id: 2·w0²·w1³). API-read finding: `IMessage` is
   minimal (Uniform/Product/Divide, Gaussian-oriented) — the EXACT forest case is inside–outside,
   NOT the cross-subsystem `FactorGraph`; `Zeta.Bayesian.FactorGraph`/`Ep` is for the LOOPY /
   approximate / emotional-propagation extension.
   **← resume: the OUTSIDE pass + marginals** — `outside` over the SPPF → per-family posterior =
   `inside·outside·weight / inside(root)` = the `NodeDistribution` / `PredictProbability`; feed
   `ParseSoft.ofWeightedForest`. Then production-weight source (learned/set), and the loopy/EP +
   emotional-propagation rung on `Zeta.Bayesian` (math-team); parses → ISA.
   (Alt: a full regex lexer — word → terminal — so raw text feeds the parser.)
8. Parity categories needing a core `DynamicValue` shape first (Decimal / SoftValue / Kleene) —
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
