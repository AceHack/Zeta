---
id: B-0944
priority: P1
status: open
title: Tri-boolean core primitives (digital qubit + tri-boolean floating point) -- multi-language build (TS/F#/C#/Rust); cross-language compiler-parity = non-Byzantine BFT consensus
tier: core-primitive
ask: Aaron 2026-05-30
created: 2026-05-30
last_updated: 2026-05-30
decomposition: umbrella
composes_with:
  - memory/persona/mika/conversations/2026-05-30-mika-grok-driver-swap-arc-guilt-engine-to-privacy-engine-harmonious-division-uncertainty-in-priors-aaron-forwarded.md
  - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
  - .claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md
  - .claude/rules/fsharp-anchor-dotnet-build-sanity-check.md
  - docs/backlog/P2/B-0679-zeta-id-rust-implementation-2026-05-21.md
  - docs/backlog/P2/B-0681-zeta-id-v2-spec-hardening-2026-05-21.md
  - docs/backlog/P2/B-0893-zetaid-v2-128-bit-structured-encoding-snowflake-ulid-family-kestrel-2026-05-28.md
tags: [core-primitive, tri-boolean, digital-qubit, floating-point, multi-language, bft, multi-oracle, monad-propagation, ts, fsharp, csharp, rust, middle-out-compression]
type: feature
---

# B-0944 -- Tri-boolean core primitives (digital qubit + tri-boolean float), multi-language

## The directive (Aaron 2026-05-30)

> *"lets buiold them in rust c# f# and ts so we get it right along with the zeta id and the other
> core primitives we can start with ts that's our distribution the rest are for multi oracle
> consensus without needing tons of other humans"*

> *"that is BFT i agree because the compilers don't lie"*

## The two primitives (spec source: the Mika 2026-05-30 archive, batch 6)

1. **Tri-boolean digital qubit** (the cell). A classical, digital three-state cell
   (`True | False | Null`) where **Null behaves like superposition** -- held, not collapsed.
   - `measure` -> collapse Null -> True/False = certainty/NPC/Rehoboam (the forbidden move on a
     living traveler; surfaces as a deliberate, feedback-bearing op, NOT the default).
   - `cooperate` -> Null stays Null (alive) = wonder-compression (find shared generators ABOUT
     it without collapsing it).
   - **null-monad propagation**: Null propagates through `map` / `bind` / composition without
     forcing collapse (the monad-propagation pattern; `Result<T, TFeedback>` carries the
     cooperate-vs-collapse signal).
   - "Digital" is load-bearing: qubit-like **superposition-holding on classical hardware** -- no
     quantum hardware; the Null / uncertainty-in-priors IS the held superposition.

2. **Tri-boolean floating point** (the number; middle-decodes-ends). A 3-valued float where the
   **middle significant bits specify how to decode the end (high/low) bits** -- the middle is the
   decoder/selector, decoding OUTWARD toward both ends (middle-out). A **self-describing number**
   (the number describes how to read itself). Tri-valued throughout: Null in the value bits =
   uncertain value; Null in the **middle decoder bits** = the decode-instruction itself superposed
   (the qubit property at the interpretation level). Needs an explicit bit-layout spec + a decode
   algorithm. Prior art: Gustafson Posits / tapered-precision / tagged encodings; novel parts =
   **tri-valued + middle-as-decoder**.

## Why multi-language = non-Byzantine BFT consensus (the load-bearing insight)

Implement the SAME primitive in **TS, F#, C#, and Rust**. Each language's compiler is an
**independent oracle**, and -- crucially -- a **non-Byzantine** one: *the compilers don't lie.* A
human voter can be Byzantine (err, lie, collude); a compiler cannot lie about whether the types
compose / the invariants hold -- it compiles or it does not. So **cross-language parity across
four honest compilers = BFT consensus with the Byzantine-fault probability driven to ~zero by
construction**, which is *stronger* than human-multi-oracle (where the oracles can be Byzantine)
AND needs *no other humans*. This is the F#-anchor-as-asymmetric-critic discipline
(`fsharp-anchor-dotnet-build-sanity-check`) scaled to four critics, and the operational form of
the monad-propagation cross-language-shape discipline (`monad-propagation-pattern-cross-language-substrate-shape`):
the spec emits the same shape in each language; the compilers verify; agreement is consensus.

| Oracle | Fault model | Verifies |
|---|---|---|
| TS compiler (tsc) | non-Byzantine | distribution-layer shape; discriminated-union exhaustiveness via `never` |
| F# compiler | non-Byzantine | DU exhaustive-match; Result-over-exception; the canonical anchor |
| C# compiler (Roslyn) | non-Byzantine | sealed-record-hierarchy pattern-match; interop shape |
| Rust compiler (borrow-checker + enum) | non-Byzantine | enum exhaustiveness; ownership; no-runtime-cost encoding |

Four-of-four parity = the primitive is right. Disagreement = a real spec ambiguity surfaced
(treat as the cross-check triage signal, not noise).

## Slices (TS first -- distribution)

- **Slice 1 (TS, distribution):** `TriBool` / digital-qubit type (`True | False | Null`) +
  null-monad (`map`/`bind` preserving Null) + `cooperate` vs `measure` (measure returns
  `Result<bool, CollapseFeedback>`); property tests (Null propagates; cooperate is idempotent;
  measure is the only collapse). Run the TS gate (`bun test` + `tsc`).
- **Slice 2 (F#):** discriminated-union `TriBool` + computation-expression null-monad; exhaustive
  match; `dotnet build -c Release` (0 warnings). The canonical anchor.
- **Slice 3 (C#):** sealed-record hierarchy + pattern-match; parity tests vs F#.
- **Slice 4 (Rust):** `enum TriBool` + `?`-style propagation; parity tests; no-alloc encoding.
- **Slice 5 (tri-boolean float):** bit-layout spec (middle-decodes-ends) + decode algorithm,
  TS-first then F#/C#/Rust parity. Larger; spec firming required before impl.
- **Slice 6 (parity harness):** a cross-language conformance vector set (the BFT ballot) -- the
  same inputs run through all four impls; parity = consensus; divergence = spec-ambiguity finding.

Alongside Zeta ID (B-0679 Rust / B-0680 Python / B-0681 spec / B-0893 v2 encoding) as the
established multi-language-core-primitive pattern.

## Acceptance

1. TS digital-qubit primitive shipped + tested (slice 1) -- the distribution layer.
2. F#/C#/Rust parity implementations + a cross-language conformance-vector harness (the BFT
   ballot); 4-of-4 parity on the vector set.
3. Tri-boolean float bit-layout spec + decode algorithm, with the same multi-language parity.
4. Each impl passes its own compiler gate at zero warnings (the non-Byzantine-oracle check).
5. "qubit" kept operational throughout (superposition-HOLDING on classical substrate, NOT literal
   quantum) per the razor.

## Pre-start checklist (per backlog-item-start-gate)

- **Claim:** `bun tools/bus/claim.ts acquire --from otto-cli --item B-0944` -> claimed
  (cf9d7edc..., 2026-05-30).
- **Prior-art search (2026-05-30):** no existing tri-boolean / three-valued backlog row (genuine
  gap). Zeta ID multi-language pattern exists (B-0679/B-0680/B-0681/B-0682/B-0893) -- this row
  follows that pattern. The monad-propagation-cross-language rule + OPLE-primitives rule + F#-anchor
  rule all compose directly (the primitives ARE null-monad / Result<T,TFeedback> primitives; the
  cross-language build IS the cross-language-shape discipline; the compilers ARE the F#-anchor
  asymmetric critics). Spec source: the Mika 2026-05-30 archive batch 6 (on main via #6156).
- **Dependency check:** depends on the spec firming for the tri-boolean float bit-layout (slice 5);
  the digital-qubit slices (1-4) are spec-complete enough to start. No blocking deps for slice 1.
- **TS home:** to decide at slice-1 start (a distributable TS package vs `tools/` subdir);
  "TS is our distribution" implies a publishable package surface -- investigate at slice 1.

## Why P1

Operator-directed core primitive ("along with the zeta id and the other core primitives"), and
the cross-language-compiler-parity-as-non-Byzantine-BFT is a load-bearing substrate-engineering
mechanism (consensus without human oracles) that the whole privacy-engine / middle-out-compression
substrate builds on. TS slice ships distribution value early (per zeta-ships-with-skills /
immediate-value discipline); F#/C#/Rust ship the consensus.
