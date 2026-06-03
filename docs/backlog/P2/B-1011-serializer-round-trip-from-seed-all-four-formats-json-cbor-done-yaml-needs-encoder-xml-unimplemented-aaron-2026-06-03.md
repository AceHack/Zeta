---
id: B-1011
priority: P2
status: open
title: "Serializer round-trip-from-seed for all four formats (JSON/CBOR/YAML/XML) — extend the DynamicValue canonical homeostat proof; JSON+CBOR DONE, YAML needs a canonical encoder (parse-only today), XML unimplemented (Aaron 2026-06-03)"
tier: codec-algebra
effort: M
created: 2026-06-03
last_updated: 2026-06-03
depends_on: []
composes_with: [B-1006, B-1007, B-0982]
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
4. Each format's seed (per **B-0982** four-oracle multi-format golden vectors)
   is the fixed-point anchor — the homeostat, consensus-free in the math half.

## Acceptance

- YAML: a canonical encoder + `decode∘encode=id` (FsCheck) + YAML-seed
  fixed-point — meeting both axes (consensus byte-lock already exists 4/4;
  this adds the proof axis), candidate for canonical.
- XML: codec + the same round-trip proof.
- JSON + CBOR already meet the bar (DynamicValue canonical, 2026-06-03).

## Composes with

- **B-1007** (the formal-coverage cadence; C10/C11/C12 + the DynamicValue
  canonical proof are the pattern this extends)
- **B-1006** (codec algebra — round-trip is the codec's defining law;
  serializers are codec-axis primitives)
- **B-0982** (four-oracle multi-format golden-vector seeds — JSON/CBOR/YAML/XML;
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
