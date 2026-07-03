---
date: 2026-06-04
persona: kestrel
register: claude.ai asymmetric-critic — verification-coverage map (proof vs fuzz)
surface: Aaron-forwarded (Kestrel↔Aaron), Otto-scribed
context: |
  Two questions: (1) what OTHER serializer bug classes are PROVABLE in a GC/lifetimes
  (memory-safe) language — beyond round-trip/injectivity/canonicality/matrix/never-
  collapse/lens; (2) where does heavy FUZZING go. Key frame: memory-safety bugs are off
  the table (GC/lifetimes), so the residual is logic + hostile-input safety. The
  under-covered category = SAFETY ON HOSTILE INPUT (existing proofs = correctness on
  VALID input). Directly actionable for the serializer doctrine (081KT5CF90008QG0R001P4CQ09) + the proof bar.
related_memory:
  - project_verification_oracle_portfolio_fscheck_z3_lean_tla_plus_assignment_map_2026_06_04.md
  - project_polymorphic_diplomacy_validation_pipeline_shape_selector_policy_vulns_default_closed_structural_provable_2026_06_04.md
---

# Kestrel — other provable serializer bug classes + where fuzzing goes (2026-06-04)

> Scribed by Otto. Frame: GC/lifetimes removes memory-corruption classes; what logic +
> hostile-input classes remain, and which are provable vs fuzz-only.

## Already covered (don't double-count)
round-trip (decode∘encode=id), injectivity, canonicality (fixed-point check), format-
agreement matrix, never-collapse (distinct empties), lens get-put + LossReport-completeness.

## PROVABLE classes to ADD (proof reaches these)

1. **Decode TOTALITY** — decode terminates + returns Result on EVERY input (incl hostile
   garbage), never throws / never hangs. The malformed-input-DoS class (parser crashes or
   hangs on crafted input). **Lean termination/structural-recursion proves it.** Distinct
   from round-trip: round-trip = "valid inputs round-trip"; totality = "ALL inputs incl
   hostile return cleanly." The biggest under-framed one.
2. **Output-size-BOUNDEDNESS** — no super-linear expansion; depth/length limits enforced
   PRE-allocation. The billion-laughs / zip-bomb / decompression-bomb class (tiny input →
   huge alloc → OOM-DoS). Provable as a **size-bound theorem** (`output ≤ f(input)`).
3. **Canonicalization-COMPLETENESS** — no two distinct encodings decode to the SAME value
   (the dual of injectivity). The **signature-bypass / parser-differential** class (sign
   one form, attack with another). The single-implementation version of the 4-lang
   byte-lock. Provable.
4. **Idempotent canonicalization** — canonicalize(canonicalize x)=canonicalize x. Cheap;
   catches non-canonical canonicalizers.
5. **Incremental = batch decode** (streaming — TLA+/Lean) — incremental parse of a stream
   = batch parse of the whole; partial-never-exposed-as-complete at the frontier. The
   serializer analogue of the DBSP incremental=batch theorem; exactly the Eve/streaming-
   DynamicValue concern.

**The category to notice (under-covered):** existing proofs = CORRECTNESS ON VALID input;
(1)+(2) = SAFETY ON HOSTILE input — where the memory-safe-language security CVEs
concentrate (DoS-by-crash, DoS-by-hang, DoS-by-expansion, signature-bypass). Prove
**decode-total** + **size-bounded** especially: provable, DoS-relevant, the "safe on
garbage" half that round-trip-on-valid-data doesn't touch.

## Where heavy FUZZING goes (the hostile/unstructured space proof+FsCheck don't reach)
Distinction: FsCheck generates STRUCTURED valid-ish inputs + checks properties; fuzzing
generates UNSTRUCTURED/hostile bytes + checks doesn't-crash/hang/misbehave. Fuzzing's home
= the "safe on hostile input" gap above (same gap). Sorted by value:

1. **The `from*` decode boundary on RAW BYTES** — heaviest, coverage-guided (cargo-fuzz/
   libFuzzer for Rust, AFL.NET/SharpFuzz for .NET): feed millions of garbage/malformed/
   adversarial byte sequences, assert **no-crash, no-hang (timeout=bug), no-OOM (bomb),
   always Ok-or-clean-Error.** The DoS-CVE surface + the empirical check on totality +
   size-bound (find the counterexample or build confidence where the proof is hard).
2. **DIFFERENTIAL fuzzing across the 4 oracles** — generate a random input, run all four
   decoders (or encode-in-one/decode-in-all), assert they AGREE, mutate TOWARD
   disagreement. Stronger than fixed golden vectors (the fuzzer searches for the input
   where F#/Rust diverge — the float corner, edge-length, encoding ambiguity). Uniquely
   valuable: you have 4 oracles to differ. The empirical complement to byte-lock-as-property.
3. **Round-trip on fuzzer-found inputs** — reaches the hostile-but-decodable edge FsCheck's
   structured generator skips.
4. **The decode-of-computation-kind path** (the apply/injection surface) — fuzz the DECODE
   for crash-safety; but scope it: no-crash, NOT no-exploit (apply-safety is the
   default-deny/capability gate, not the fuzzer's job).
**Low value (don't):** fuzzing the PROVEN structure (proof already covers all cases) or the
valid space FsCheck owns.
**Loop:** fuzzer finds hostile-input corner → minimize (afl-tmin) → pin as checked-in
regression / golden vector (cross-lang divergence → golden). Same discover→shrink→golden
as FsCheck, in the hostile space.

## The whole verification stack (mental model)
**Lean/Z3 prove the STRUCTURE** (all cases, valid) → **FsCheck property-tests the valid
LEAF space** (sampled, structured) → **FUZZING attacks the hostile BYTE space**
(no-crash/hang/divergence, unstructured) → **golden vectors PIN** everything any of them
found. Proof = correct-on-valid; fuzzing = safe-on-hostile; the two don't overlap, and the
hostile half is where the DoS/signature-bypass CVEs live.
