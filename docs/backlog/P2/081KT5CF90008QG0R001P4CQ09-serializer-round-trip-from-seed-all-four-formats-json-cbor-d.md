---
id: 081KT5CF90008QG0R001P4CQ09
priority: P2
status: open
title: "Serializer round-trip-from-seed for all four formats (JSON/CBOR/YAML/XML) — extend the DynamicValue canonical homeostat proof; JSON+CBOR DONE, YAML needs a canonical encoder (parse-only today), XML unimplemented (Aaron 2026-06-03)"
tier: codec-algebra
effort: M
created: 2026-06-03
last_updated: 2026-06-03
depends_on: []
composes_with: [081KT2T2J0008QG0R0008TFHJT, 081KT2T2J0008QG0R000YZ3NMY, 081KT07NV0008QG0R0032MCYER]
tags: [codec, codec-algebra, serializer, round-trip, homeostat, proven-from-seed, canonical, json, cbor, yaml, xml, formal-proof-first, infer-net, aaron]
type: design
---

# Serializer round-trip-from-seed — the same canonical proof for all four formats

## Origin (Aaron 2026-06-03)

> *"take the serializer round-trip next … we want to support json yaml xml and
> cbor so we would need the same for these."*

"The same" = the **round-trip-from-seed homeostat proof** the DynamicValue
canonical work established (`decode ∘ encode = id` over arbitrary values +
the seed's canonical bytes as a fixed point — the proof axis, half-(a) +
the seed-lineage edge, half-(b)). Applied to all four formats Aaron named.

## State (2026-06-03) — honest, per the proof bar (no fabricated round-trips)

| Format | encode | decode | round-trip proof | gap |
|---|---|---|---|---|
| **JSON** | `DynamicValue.toCanonicalJson` | `fromCanonicalJson` | ✅ DONE — `decode∘encode=id` (6/8 shapes) + seed fixed-point, `DynamicValue.Canonical.Tests.fs` | — |
| **CBOR** | `DynamicValue.toCanonicalCbor` | `fromCanonicalCbor` | ✅ DONE — `decode∘encode=id` (8/8 shapes, TOTAL) + seed fixed-point | — |
| **YAML** | **none** (parse-only) | `Zeta.Core.FSharp.Yaml.Dom.parse` | ❌ **impossible today** | `Dom.fs`/`Reader.fs` are **forward-only** (a `YamlValue` parser, no renderer); a round-trip needs a **canonical YAML ENCODER** first. Also a separate `YamlValue` DOM, not `DynamicValue`. |
| **XML** | none | none | ❌ not implemented | the registry has XML as ⬜ (text + XSD schema); needs a full `DynamicValue`↔XML codec. |

So a YAML/XML round-trip is **blocked on encoder implementation** — proving a
round-trip on code that can't encode would be a fabricated test (the exact
"bullshit math" the proof bar forbids). This row scopes the real prerequisite.

## Work

1. **YAML canonical encoder** (the prerequisite). Either:
   - (a) a `YamlValue` renderer (`render : YamlValue -> string`) so
     `parse ∘ render = id` on the YAML DOM, **or**
   - (b) ride the `DynamicValue` model: `toCanonicalYaml : DynamicValue ->
     Result<string, EncodeError>` + `fromCanonicalYaml` (the registry's
     "same dynamic-object model over any format" vision — preferred, so the
     DynamicValue canonical proof extends directly).
   Canonical-YAML rules need deciding (safe-subset; block vs flow; key order —
   order-significant like the JSON/CBOR Object decision). **Design decision →
   Aaron/Soraya before building.**
2. **YAML round-trip proof** — once an encoder exists, the same
   `DynamicValue.Canonical.Tests.fs` shape: FsCheck `decode∘encode=id` +
   the YAML seed (`tests/cross-verification/yaml/vectors.json`) as fixed point.
3. **XML codec** (`DynamicValue`↔XML, text + optional XSD) — then the same
   round-trip proof. Larger; later.
4. Each format's seed (per **081KT07NV0008QG0R0032MCYER** four-oracle multi-format golden vectors)
   is the fixed-point anchor — the homeostat, consensus-free in the math half.

## Acceptance

- YAML: a canonical encoder + `decode∘encode=id` (FsCheck) + YAML-seed
  fixed-point — meeting both axes (consensus byte-lock already exists 4/4;
  this adds the proof axis), candidate for canonical.
- XML: codec + the same round-trip proof.
- JSON + CBOR already meet the bar (DynamicValue canonical, 2026-06-03).

## Composes with

- **081KT2T2J0008QG0R000YZ3NMY** (the formal-coverage cadence; C10/C11/C12 + the DynamicValue
  canonical proof are the pattern this extends)
- **081KT2T2J0008QG0R0008TFHJT** (codec algebra — round-trip is the codec's defining law;
  serializers are codec-axis primitives)
- **081KT07NV0008QG0R0032MCYER** (four-oracle multi-format golden-vector seeds — JSON/CBOR/YAML/XML;
  the per-format seed each round-trip anchors to)
- `.claude/rules/formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md`
  (homeostat-proven-from-seed; consensus≠validation — the byte-lock is the
  seed-lineage edge, the round-trip law is the verification)
- `.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md`
  (own the codec port; YAML/XML formats are adapters behind it)

## Substrate-honest framing

Design row, not yet built. JSON + CBOR round-trips are DONE (DynamicValue
canonical). YAML/XML are **blocked on encoder implementation** — filed so
Aaron's "support json yaml xml and cbor" directive is durable, with the real
prerequisite (encoders) named rather than papered over with a fake round-trip.

## Serialization doctrine (Aaron 2026-06-04) — make-or-break, equal rigor

Serializers are our **most-tested surface** and **make-or-break**: "it doesn't
matter how good our CBOR byte-lock is if we store everything in YAML." So:

- **Every serializer gets the SAME rigor** — JSON, CBOR, **YAML**, XML, **Arrow**,
  Bonsai (and any future binary): canonical (deterministic) + cross-language
  agreement + self round-trip. YAML especially — it is the **standard storage of
  record** (text in git), so its rigor matters as much as CBOR's byte-lock.
- **Storage strategy:** YAML/JSON = text, checked into git (the store); CBOR =
  binary capability, only a few golden vectors at junction points (don't
  text-corner ourselves); CBOR/binary is for future git-alternative backends.
- **Different interfaces, same rigor:** base text/binary serializers share one
  interface (value ↔ bytes/text); **Arrow (columnar batch) and Bonsai
  (expression-tree / reactive)** have their OWN interfaces (hexagonal ports per
  shape) — held to the same canonical+cross-lang+round-trip bar.
- **Format-agreement MATRIX (the owed test surface):** test every format-pair, at
  byte level (canonical) or at least parse level — each format round-trips itself
  (YAML→YAML, CBOR→CBOR, Arrow→Arrow…) AND converting BETWEEN any two loses
  nothing (one canonical value, N codecs, all paths commute). The shared seed /
  common value (DynamicValue) is the treaty all codecs target.

Status: F# canonical YAML encoder is WIP (round-trip 3/6 — nesting/escape inverse
vs the block parser still buggy; in Otto's clone, not landed). Cross-lang YAML +
the full matrix + Arrow-as-serializer are the larger owed work under this doctrine.

## YAML encoder v1 landed (F#) + owed work (2026-06-04)

- **Done:** `src/Core.FSharp.Yaml/Encoder.fs` — canonical, deterministic, block-style
  YAML encoder; a true inverse of the parser for all compound/value cases (round-trip
  6/6: scalars/strings/maps/seqs/nesting as values; ambiguous + escaped + ordered).
  Zero-dep, in-house (the swappable hexagonal v1; external libs = differential oracle).
- **Parser gap (owed):** the block reader rejects a top-level BARE scalar document
  (`null`/`0`/`true`/`"x"` alone → UnsupportedConstruct); a document must be a
  mapping/sequence. Real storage is maps, but a single-scalar doc is valid YAML —
  parser fix owed for full rigor.
- **Best-practice round-tripping (Aaron 2026-06-04):** support EXTENSION-DATA
  round-tripping — unknown/future fields preserved across (de)serialize, the
  IExtensibleDataObject (WCF) / [JsonExtensionData] (System.Text.Json) pattern.
  DynamicValue (the open self-describing tree) IS this by construction (preserves
  all keys); typed projections keep an extension bag for fields outside the view.
  The format-agreement matrix must include "unknown fields preserved."
- **Polymorphic type system (Aaron 2026-06-04):** a whole polymorphic type system
  sits ON TOP of this value/serializer substrate — prove AFTER the serializer
  basics + the matrix land (forward work, not now).

## Serializer configuration (Aaron 2026-06-04) — Options/IConfiguration pattern

Serializers take CONFIG pushed into the constructor as a config object (.NET
IOptions / IConfiguration shape; DI). **Default = STATIC one-time configuration**
(immutable at construction). **Real-time updates** (IOptionsMonitor live reload)
are a FUTURE option — only if we decide to do real-time config AND prove it. Until
then the canonical defaults ARE the static config. (Current encoders are pure
canonical-default fns; grow a config object as options appear.)

## Cross-language YAML: F# + TS agree (2026-06-04)

`src/Core.TypeScript/yaml/encoder.ts` is an exact mirror of the F# encoder —
byte-identical canonical output (cross-lang byte-lock tests: TS encode === F#
encode). F# ✓ + TS ✓; C#/Rust YAML encoders next, then the full format matrix.

## DOM decision (Aaron 2026-06-04): UNIFY on DynamicValue for value-tree formats

> "do we keep per-format DOMs or unify on DynamicValue? I think unify unless there
> are real edge cases where we lose a feature for some file types."

**Decision: UNIFY on DynamicValue for the value-tree serializers (JSON / CBOR /
YAML)** — every codec produces/consumes DynamicValue directly; retire the separate
`YamlValue` DOM. No feature loss: DynamicValue is the 8-type common core
(Null/Bool/Int/Float/String/Bytes/Array/Object); CBOR maps directly, JSON is a
subset, and our YAML SUBSET already drops comments/anchors/tags at the reader, so
YamlValue carried nothing extra. Benefit: "all formats agree" becomes
structural-by-construction (no bridge to drift); the matrix is trivial.

**Real edge cases — keep their own interface (same rigor, different interfaces):**

- **XML** — attributes vs elements, namespaces, mixed content, ordering. A value
  tree needs a CONVENTION (`@attr` / `#text`) or a richer node; decide when XML is
  built. (Bytes: YAML has no native byte type → base64-string convention or CBOR.)
- **Arrow** — columnar schema + typed columns + dict encoding (a batch of typed
  columns, not a single value tree).
- **Bonsai** — expression-tree / reactive.

**Unification work (next phase):** point the YAML reader+encoder at DynamicValue
across the 4 oracles (retire YamlValue); the DynamicValue↔YamlValue bridge
(currently a test helper) becomes unnecessary. Refactor across F#/TS/C#/Rust YAML.

## DynamicValue = LCD + bridge-per-type (Aaron 2026-06-04)

> "DynamicValue is the lowest common denominator useful for polymorphic
> [de]serialization, so it could be a bridge per type where DynamicValue is the
> lossy translation; if it's one-to-one then maybe [share] a common base bridge."

Resolves the dependency-graph fork to **(2): extract DynamicValue as the small
foundational LCD value lib** — every codec + typed value sits on it; no lean port
couples to big Core.

**Bridge pattern (per type, to/from DynamicValue):**

- DynamicValue is the **LCD pivot** for polymorphic (de)serialization, and the
  translation through it is **LOSSY** (the LCD can't carry every type's richness).
- **Lossless (1:1) types → a shared COMMON BASE bridge** (generic round-trip;
  no custom code).
- **Lossy types → a custom PER-TYPE bridge** (handles what the LCD drops).
- Ties to the polymorphic type system on top: typed layer bridges DOWN to
  DynamicValue (1:1 → generic, lossy → custom); DynamicValue serializes via the
  value-tree codecs (JSON/CBOR/YAML). XML/Arrow/Bonsai keep their own interface.

Next phase: extract the small DynamicValue core, then the value-tree YAML
reader/encoder target it; typed bridges (generic base + per-type) layer on.

- Math grounding: [`docs/serializer-recursion-schemes.md`](../../serializer-recursion-schemes.md) — DynamicValue = μF; codecs/bridges = folds (cata/ana/hylo); fold laws (universality, fusion, hylo round-trip) make the matrix a theorem. Saved for further proofs.

- **Unify evidence (2026-06-04):** the TS matrix test surfaced that `Tagged` (the DynamicValue shape) is defined SEPARATELY in `json.ts` AND `cbor.ts` (structurally identical, nominally distinct) — concrete duplication the DynamicValue-unify decision removes (one shared Tagged/DynamicValue). Matrix proven in F# + TS.
