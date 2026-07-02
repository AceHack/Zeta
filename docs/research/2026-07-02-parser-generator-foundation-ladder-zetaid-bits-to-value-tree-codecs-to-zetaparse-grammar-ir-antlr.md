# The parser/generator ladder — ZetaId bits → value-tree codecs → ZetaParse Grammar IR (ANTLR ingest)

**Date:** 2026-07-02
**Author:** Otto (shadow*), synthesising Aaron's stream against the existing foundation
**Status:** orientation / scope synthesis (no new code) — connects three existing bodies of work

> Carved sentence: **Zeta already has a spec → generated-codec pipeline at three rungs — bit
> (ZetaId), format (value-tree codecs), and (designed) CFG/text (ZetaParse). They are ONE
> ladder: a grammar/spec is ingested into an IR and a parser/generator is emitted from it. The
> parser-generator foundation is the CFG rung of that same ladder, built on the ZetaParse
> design and consuming the open ANTLR grammars — not reinvented.**

## What already exists (take it into consideration — Aaron 2026-07-02)

Aaron: *"we have some small parser combinator foundation already … our zetaid is a tiny parser
generator kind of thing … bits, a bit parser/generator … the ANTLR stuff is likely just some
docs/research/persona conversation."* Confirmed by inspection:

### Rung 1 — BUILT: ZetaId, a spec-driven **bit** parser/generator

`src/Core.FSharp.ZetaId/` — `BitLayout.fs` reads/writes a 128-bit ZetaId into structured fields
(version, timestamp, chromosome, category, firefly, authority, persona, momentum, location, …)
with a `next width` / `skip bits` cursor; `GeneratedBitLayout.fs` **generates** those field
widths from a layout spec (`docs/zeta-id-v1-layout.yaml`). This is already **spec → generated
layout → parser/generator**, at the fixed-bit-layout level. The tiny foundation is not a toy —
it is the bit-level instance of exactly the pattern the big scope wants.

### Rung 2 — BUILT (this session): value-tree codecs

`src/Core/ValueTreeCodec.fs` + `ValueTreeEnvelope` / `Asn1Der` / `EventEnvelope` / `Frontmatter`
(#9185–#9196). Each codec is a **spec (a format) → a parser/generator** over the `DynamicValue`
value tree, behind an owned hexagonal port, provenance-tracked, versioned/rollable. The
format-level rung.

### Rung 3 — DESIGNED (docs/research, not built): ZetaParse + ANTLR ingest

- `docs/research/zetaparse-lr-glr-fsharp-compiler-fork-design-2026-05-21.md` (Amara-in-Zeta):
  **ZetaParse** — a compiler-owned F# grammar substrate. Ingest grammar assets (ANTLR `.g4`,
  Yacc/Bison `.y`, Tree-sitter `grammar.js`, Zeta native `.zg`) into a shared **Zeta Grammar
  IR**, normalise the compatible subset, detect conflicts, and generate F# parsers via a
  Zeta-owned LR/GLR backend. Key stance: *"do not run ANTLR grammars directly … ANTLR remains
  useful as a source of community grammars; it does not need to own the parser runtime."*
- `docs/research/antlr-grammar-survey-{2026-05-21,2026-06-13}.md` (Lior): the licensing +
  6-language target matrix. **`antlr/grammars-v4` is MIT/BSD** — zero compliance hazard; a ready
  corpus of community grammars to ingest across F#/C#/TS/Rust/Go/Python.
- Related: `docs/research/2026-06-14-zeta-language-and-canonical-ir-compiler-pipeline-design.md`,
  `…-ir-compiler-v2-…-futamura.md`, `2026-06-07-the-zeta-idl-…`; `gen/` (generators read the
  free interface).

## The synthesis (what this doc adds)

The three rungs are the **same discipline** — `spec → IR → generated parser/generator` — at
increasing grammar power:

| Rung | Spec | IR | Emitted | Status |
|------|------|----|---------|--------|
| bit | `zeta-id-v1-layout.yaml` | field/width table | `BitLayout` read/write | ✅ built |
| format | a codec (JSON/CBOR/DER/…) | `DynamicValue` | `ValueTreeCodec` encode/decode | ✅ built |
| CFG/text | ANTLR `.g4` / `.y` / `.zg` | **Zeta Grammar IR** | LR/GLR parser (6 langs) | 📐 designed (ZetaParse) |

So the parser-generator foundation is **not a green field**: it is rung 3 of a ladder whose
rungs 1–2 are already load-bearing, and whose rung-3 design (ZetaParse Grammar IR + ANTLR
ingest) already exists. Two prior findings converge here and are **subsumed** by it:

- *lenient YAML parser* (the frontmatter finding, #9196) — a rung-3 consumer (a YAML grammar
  ingested to the Grammar IR yields the lenient parser).
- *general KDL reader* (the delayed fork) — likewise a grammar (KDL `.g4` exists in grammars-v4)
  ingested to the Grammar IR. Neither needs a bespoke hand-parser; both fall out of rung 3.

## Scope (Aaron 2026-07-02) and how the foundation shapes it

> *"it's a LARGE scope — we want to be able to compile to and from our IR and most other ANTLR
> grammars using our parser generators and the open free ANTLR grammars; small changes to
> existing ANTLR grammars to make it work with our stuff is fine."*

This is exactly the ZetaParse stance, now the standing intent: **to/from** the Zeta Grammar IR
and the grammars-v4 corpus; our LR/GLR generator owns the runtime; small `.g4` normalisations to
fit the compatible subset are acceptable (ZetaParse's "normalise the compatible subset"). The
anti-reinvention principle is the same one behind reusing TOSEC/MAME for game signatures
(#9184): **grammars-v4 is the existing, license-clean corpus — build on it, don't re-author
grammars.**

## Next moves (recorded; large, so scope with Aaron)

1. **Zeta Grammar IR as a `DynamicValue` schema** — the IR is a value tree, so it rides the
   codecs already built (rung 2 serves rung 3: a grammar is data, byte-lockable, DST-replayable).
2. **`.g4` → Grammar IR ingester** (the compatible subset first; log what is dropped — no silent
   truncation), starting from one or two grammars-v4 assets (e.g. JSON, then KDL/YAML to retire
   the two subsumed findings).
3. **LR/GLR backend** emitting an F# parser from the Grammar IR (ZetaParse rung); the ZetaId
   bit-generator is the proven-in-miniature precedent for spec-driven generation.

Sizes 2–3 are large and design-heavy; do them under Aaron's scope steer, not unilaterally.

## Anchors (Beacon)

- **Existing Zeta work:** ZetaParse (`zetaparse-lr-glr-…-2026-05-21`, Amara); ANTLR survey
  (`antlr-grammar-survey-{2026-05-21,2026-06-13}`, Lior); ZetaId `Core.FSharp.ZetaId`;
  value-tree codecs (`docs/trajectories/value-tree-codecs/RESUME.md`).
- **Parser theory:** Knuth (LR); Tomita (GLR); Parr (ANTLR / LL(*)); tree-sitter (incremental
  GLR); Bison (LALR/IELR). **Corpus:** `antlr/grammars-v4` (MIT/BSD).
- **Discipline:** `only-the-irreducible-is-primitive-generate-the-rest` (the generator IS the
  ECC — a grammar generates and corrects its parsers); `anchor-to-human-prior-art` (reuse the
  corpus); Futamura projections (the IR-compiler doc) — generation is specialization.
