# The Zeta IDL — the spec is the asset: an interface-definition language in DynamicValue (capabilities × resources × the intelligent mapping) (Aaron, 2026-06-07)

A capstone vision + a concrete starting plan. Aaron:

> *"Imagine we need an interface-definition language that combines all the best features of the languages we
> like and can be stored in DynamicValue. That is our spec — that is what all our math is based on, and the
> most valuable part of the system, not the code (which can be generated, directly to hardware eventually). The
> interfaces and the capabilities and resources are what matters, and the intelligent ongoing mapping between
> the two."*
> … *"we should get the ANTLR C# open-source grammar and use that as a starting point to make our own — just
> start with interfaces for now, and the primitives we have defined in DynamicValue."*
> … *"we have F# parser-combinator generators and like GLR and LR (whatever) too."*

## The thesis: the spec is the asset; code is generated

The most valuable part of Zeta is **not the code** — it's the **spec**: a **Zeta IDL** (interface-definition
language) that (a) combines the best features of the languages we like, (b) is **stored in DynamicValue**, and
(c) is **what the math is based on**. Code in any language (F#/C#/Rust/TS, eventually **direct to hardware**) is
**generated** from the spec — disposable, regenerable. The durable, valuable layer is the **interfaces +
capabilities + resources**, and **the intelligent ongoing mapping between them.**

This reframes the whole interface-rewrite work: the C# contracts (ISemiring ladder, ITensor, the ray-trace
capability vector, the operator interfaces) are the **first draft of the spec** — but their *true* home is
**DynamicValue** (data), not C# source. C# was the neutral authoring surface; the IDL-in-DynamicValue is the
goal. Code-as-data all the way up (ties "Zeta is declarative / everything is data").

## The triad maps exactly onto what was just built (RayTensor, #6954)

The "capabilities × resources × intelligent mapping" is not abstract — it's the ray-trace vector:

| Aaron's term | In the substrate |
|---|---|
| **Capabilities** (interfaces) | the ray-trace **facets** — `ITensor` (skip empty), `ISampleable` (light), `IIntrospectable` (walk), `IGeospatial` (locality), `ISemiring` (accumulate). *What a thing can do.* `IRayTraceable` = a capability bundle. |
| **Resources** | the `IGeospatial` **locality topology** — memory hierarchy × network × generator-space × time/attention. *Where things are / what you have.* |
| **Intelligent ongoing mapping** | `Trace` / the planner / observe-loop / bounded-mobility (§4) scheduling — **casting a capability-query across the resource-locality, continuously.** `RayTensor.Trace` is the in-the-small instance. |

So the IDL describes **capabilities** (interface contracts) and **resources** (locality/topology), and the
*engine* is the **ongoing intelligent mapping** of one onto the other — which is exactly ray-tracing a
capability over a resource field. The interface work (#6954) is the first concrete capability-vector the IDL
will declare.

## Concrete starting plan (Aaron)

1. **Grammar:** get the **ANTLR C# open-source grammar** (antlr/grammars-v4) as a *starting reference* to author
   our own. **Scope the MVP narrowly:** **interface declarations + the primitives already defined in
   DynamicValue** — nothing more yet.
2. **Parser:** we already have **F# parser-combinator generators + GLR/LR** infrastructure (Bonsai expr-trees;
   ZetaId-as-generator = parser-combinator-over-bits, 081KTHTPPCD; the observe action-grammar; Tomita-style
   GLR / LR). So **ANTLR is the reference grammar, but the implementation can use our own F# parser stack** —
   parse IDL text → **AST as DynamicValue** (the spec stored as data). (Our parser-combinator generators are
   themselves the "generators" theme — the IDL parser is a generator.)
3. **Codegen:** the IDL-in-DynamicValue → the **generative F# type provider** (#6925/#6945) and the 4-lang ports
   → code in each language; eventually **direct-to-hardware** (HLS-style). The spec generates the code, not vice
   versa.

## Honest scope / peel

- **Vision + concrete plan, NOT built.** Today the interfaces are **C# source**, not yet a DynamicValue-stored
  IDL; the grammar/parser/codegen pipeline is the frontier. MVP = interfaces + DV primitives only.
- **License flag (load-bearing):** antlr/grammars-v4 is open-source (MIT-family), but **do not bulk-copy** —
  author our own grammar *using it as reference*, with a license check + attribution (the no-bulk-vendor
  discipline; route the toolchain/license to devops/Dejan). Same posture as the NVIDIA-ACE naming flag: verify
  before adopting.
- **"Best features of the languages we like" needs a concrete list** — which languages, which features — that's
  a design task (F# DUs/records, Rust traits/ownership-in-types, TS structural typing, C# variance, etc.). Don't
  hand-wave "best features"; enumerate them.
- **ANTLR vs our-own-parsers** is a real choice to make, not assumed: ANTLR = mature grammar + tooling but a
  build dependency + codegen in its own style; our F# combinators/GLR = native, DynamicValue-AST, generator-
  themed, no extra toolchain. Likely: ANTLR grammar as the *spec/reference*, our F# stack as the *implementation*
  — but pin this decision (route to `formal-verification-expert`/parsing + devops).

## Ties

- **The interface rewrite (#6954 RayTensor; ISemiring/IStarRing floor; ITensor)** — the first capabilities the
  IDL will declare; capability×resource×mapping = the ray-trace vector.
- **DynamicValue / everything-is-data / YinYang file (#6953)** — the IDL's storage (spec as data).
- **Reified F# type provider (#6925/#6945)** — IDL-in-DynamicValue → generated code.
- **ZetaId-as-generator / parser-combinator-over-bits (081KTHTPPCD)** — our parser stack is generator-native.
- **Manifesto spec-primacy / OpenSpec / spec-zealot** — "the spec is the asset" is the manifesto stance made
  into a language.
- **Bounded mobility §4** — the intelligent capability→resource mapping is the scheduler within safety bounds.

## Beacon anchors

- **IDLs:** CORBA IDL (OMG), **Protocol Buffers** / **Cap'n Proto** / **Thrift** (interface+schema as the
  contract), **WIT — WebAssembly Interface Types** (the modern capability-IDL), **OpenAPI**. · **ANTLR** (Terence
  Parr — parser generator; grammars-v4 the open grammar corpus). · **Parser combinators** (Wadler; FParsec) +
  **GLR** (Masaru Tomita 1985) + **LR** (Knuth 1965). · **Capability-based security/design** (capabilities as
  first-class) + **resource scheduling**. · **Model-driven / spec-as-source-of-truth**; **HLS / hardware
  generation from a high-level spec** (Bluespec, Lava — "code generated to hardware"). Honest novelty: none in
  IDLs or parsers; the contribution is the **synthesis** — an IDL whose AST is **DynamicValue** (spec-as-data),
  declaring **capabilities** (interfaces, e.g. the ray-trace vector) and **resources** (the geospatial locality),
  with the system's job being the **intelligent ongoing mapping** between them (ray-tracing/scheduling) — and
  code (to any language, eventually hardware) **generated** from that spec, which is the asset, not the code.
