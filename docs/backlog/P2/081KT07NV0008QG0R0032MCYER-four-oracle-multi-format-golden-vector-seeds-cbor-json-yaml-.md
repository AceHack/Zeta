---
id: 081KT07NV0008QG0R0032MCYER
title: 4-oracle multi-format golden-vector seeds (CBOR/JSON/YAML/XML) — nothing is single source of truth, the seed itself must be cross-validated not trusted as one file
status: open
priority: P2
created: 2026-06-01
attribution: aaron-2026-06-01
last_updated: 2026-06-01
decomposition: umbrella
depends_on: []
composes_with:
  - 081KRW63S0008QG0R0030F8ZXA
tags:
  - dynamicvalue
  - golden-vectors
  - seed
  - no-single-source-of-truth
  - four-oracle
  - byte-lock
  - cbor
  - json
  - yaml
  - xml
  - decode
---

# 081KT07NV0008QG0R0032MCYER — 4-oracle multi-format golden-vector seeds; nothing is single source of truth

**Operator (Aaron 2026-06-01):**

> "we really need 4 orcle data format eventaully for seeds too nothing is single source of truth"

> "CBOR JSON YAML XML mybe"

> "i'm pretty sure you can use the c# hkt trick to get uom like behaviors" *(separate
> thread — see "Sibling: C# UoM via the CRTP/HKT trick" below; already substrate)*

## The gap

The DynamicValue byte-lock today makes the *code* 4-oracle (TS/F#/C#/Rust all agree),
but the **seed itself is single source of truth**: `golden-vectors.json` (JSON) and
`golden-vectors-cbor.json` (CBOR vectors carried *as JSON* hex) are each **one JSON
file** that all four oracles trust. If that one file is wrong or drifts, all four
oracles agree on the wrong data. The RFC-8949-Appendix-A anchor mitigates this for the
float vectors (independent ground truth), but the seed *artifact* is still a single
file in a single format.

This cuts against the framework invariant **"nothing is single source of truth."** The
four-oracle / "the compilers don't lie" discipline should apply to the **data** too,
not just the code.

## The shape

Express + cross-validate the seed in **four data formats — CBOR, JSON, YAML, XML**
(Aaron: "CBOR JSON YAML XML mybe") — so no single file is authoritative. The four
representations mutually validate: decoding each must yield the *same* canonical
`DynamicValue` set, and re-encoding must reproduce each format's canonical bytes.

```
decode_cbor(seed.cbor) == decode_json(seed.json)
                       == decode_yaml(seed.yaml)
                       == decode_xml(seed.xml)
                       == the canonical value set
```

**The DynamicValue primitive + its format codecs ARE the mechanism.** DynamicValue is
the format-agnostic value tree riding the `ISerializer<'T>` seam (JSON / CBOR / YAML /
XML / …). Once each format has **both encode and decode**, the seed becomes a set of
canonical `DynamicValue`s serialized into all four formats + cross-validated — no
format privileged.

## Enabler: the decode side (in progress)

This requires the **decode side** (bytes/text → DynamicValue), currently being built
(CBOR decode: C# #6512; F#/Rust/TS + JSON decode to follow). Cross-format seed
validation needs decode in *each* format to compare. So the multi-format-seed work is
**gated on the decode side landing across formats**, and is the natural capstone once
it does.

Plus YAML + XML codecs (encode+decode) as DynamicValue format adapters (the serializer
roster already names YAML/XML as targets).

## Sibling: C# UoM via the CRTP/HKT trick (already substrate — connect, don't duplicate)

Aaron 2026-06-01: *"i'm pretty sure you can use the c# hkt trick to get uom like
behaviors."* Correct, and **already covered** — captured here only so the thread is
not lost:

- `.claude/rules/numerical-algebra-shaped-into-the-generic-math-interface-per-language-idiom.md`
  — C# `System.Numerics` IWSAM generic-math per-language-idiom.
- `memory/feedback_fbounded_crtp_inumber_tself_is_the_csharp_hkt_monad_hack_*` — the
  F-bounded `INumber<TSelf> where TSelf : INumber<TSelf>` CRTP = the C# HKT hack;
  "fluent-over-it is coming."
- `.claude/rules/attention-as-currency-...-fsharp-uom-...` — F# UOM as the economic
  substrate; the **C# oracle** of that UOM would use the CRTP/phantom-unit trick
  (C#'s analog of F# `[<Measure>]`).
- 081KQTPYE0008QG0R0004H9ZB8 / 081KR50HA0008QG0R000CTEMGQ (F# UoM). The C#-specific UoM-via-CRTP is the C# oracle of these.

No separate row minted (per verify-existing-substrate-before-authoring); the C# UoM
angle belongs with the generic-math + attention-as-currency substrate above.

## Acceptance (umbrella; decompose when the decode side lands)

- [ ] Decode side complete across formats (CBOR ✅-in-progress, JSON, then YAML/XML codecs).
- [ ] Seed expressed in CBOR + JSON + YAML + XML.
- [ ] Cross-validation test: all four decode to the same canonical DynamicValue set; each re-encodes to its canonical bytes.
- [ ] No single seed file is the source of truth — drift in any one is caught by the others.

## Composes with

- **081KRW63S0008QG0R0030F8ZXA** Eve Protocol / dynamic-shape primitive (DynamicValue is its instantiation).
- DynamicValue byte-lock substrate (PRs #6506/#6508/#6509/#6510/#6511 encode; #6512+ decode) + the registry's "Dynamic runtime objects / polymorphic shape" clause.
- The serializer roster (the format adapters — JSON/CBOR/YAML/XML/…).
- The "nothing is single source of truth" / four-oracle / "the compilers don't lie" invariant.
