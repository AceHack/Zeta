---
id: 081KT7YW00008QG0R0019J8FSX
priority: P2
status: in-progress
title: "Serializer hostile-input SAFETY (the safe-on-garbage half; existing proofs are correct-on-valid) — provable legs: decode TOTALITY (Lean; never throws/hangs on any bytes = malformed-input-DoS), output-size-BOUNDEDNESS (billion-laughs/bomb), canonicalization-COMPLETENESS (no two encodings -> one value = signature-bypass), idempotent-canon, incremental=batch (streaming/TLA+) + a FUZZING harness (coverage-guided on every from* decoder: no-crash/no-hang/no-OOM/clean-Result; DIFFERENTIAL fuzz across the 4 oracles; fuzz->minimize->golden). Enforced in CI not green-by-skip (Kestrel 2026-06-04)"
tier: serializer
effort: L
ask: Kestrel 2026-06-04
created: 2026-06-04
type: task
depends_on: []
---

# 081KT7YW00008QG0R0019J8FSX — Serializer hostile-input safety: provable legs + fuzzing harness

**Priority:** P2 (the serializers + the G-Set full-vertical are shipped/correct on VALID
input; this adds the SAFETY-ON-HOSTILE-INPUT half — where memory-safe-language CVEs live).
**Filed:** 2026-06-04 (Kestrel via Aaron). **Design:**
`memory/kestrel/conversations/2026-06-04-kestrel-provable-serializer-bug-classes-…`.
**Composes:** 081KT5CF90008QG0R001P4CQ09 (serializer doctrine), the verification portfolio (FsCheck/Z3/Lean/TLA+).

Frame: GC/lifetimes removes memory-corruption classes; the residual is logic + hostile-input
safety. Existing proofs (round-trip/injectivity/canonicality/matrix/never-collapse/lens) =
CORRECTNESS ON VALID input. This item is SAFETY ON HOSTILE input (DoS, signature-bypass).

## Provable legs to add (per primitive's codecs)

1. **Decode TOTALITY** — `from*` terminates + returns Result on EVERY byte input (incl
   hostile garbage), never throws / never hangs (the malformed-input-DoS class). Lean
   termination / structural-recursion proof. (Distinct from round-trip: ALL inputs, not
   just valid.)
2. **Output-size-BOUNDEDNESS** — no super-linear expansion; depth/length limits enforced
   PRE-allocation (billion-laughs / zip-bomb / decompression-bomb). Size-bound theorem
   (`output ≤ f(input)`).
3. **Canonicalization-COMPLETENESS** — no two distinct encodings decode to the same value
   (dual of injectivity; signature-bypass / parser-differential). Single-impl version of
   the 4-lang byte-lock.
4. **Idempotent canonicalization** — `canonicalize∘canonicalize = canonicalize` (cheap).
5. **Incremental = batch decode** (streaming — TLA+/Lean) — incremental parse = batch
   parse; partial-never-exposed-as-complete at the frontier (the Eve/streaming concern;
   serializer analogue of the DBSP incremental=batch theorem).

## Fuzzing harness (the hostile/unstructured space proof + FsCheck don't reach)

1. **`from*` decode boundary on raw bytes** — heaviest; coverage-guided (cargo-fuzz/
   libFuzzer for Rust, AFL.NET/SharpFuzz for .NET): assert no-crash / no-hang (timeout=bug)
   / no-OOM (bomb) / always Ok-or-clean-Error. The DoS-CVE surface + empirical check on
   legs 1+2.
2. **DIFFERENTIAL fuzzing across the 4 oracles** — mutate toward disagreement; catches the
   cross-language divergences fixed golden vectors miss (uniquely valuable — 4 oracles to
   differ; empirical complement to byte-lock-as-property).
3. Round-trip on fuzzer-found inputs (hostile-but-decodable edge).
4. Decode-of-computation-kind path (the apply/injection surface) — fuzz DECODE for
   crash-safety only (apply-safety is the default-deny gate per 081KT5CF90008QG0R003TK10FG, NOT the fuzzer).
**Loop:** fuzz → minimize (afl-tmin) → pin as regression / golden vector. **Don't** fuzz
the proven structure or the FsCheck-owned valid space.

## The whole stack (mental model)

Lean/Z3 prove the STRUCTURE (all valid) → FsCheck the valid LEAF space (sampled) → FUZZING
the hostile BYTE space (no-crash/hang/divergence) → golden vectors PIN all. Proof =
correct-on-valid; fuzzing = safe-on-hostile; non-overlapping; the hostile half is where the
DoS / signature-bypass CVEs concentrate (since GC/lifetimes took memory-corruption away).
Connects 081KT2T2J0008QG0R001X9PWKR (z3-in-CI) + the assert-don't-skip discipline: the fuzz harness must be
ENFORCED in CI, not green-by-skip.
