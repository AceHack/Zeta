---
id: 081KSV2WD0008QG0R002K85NP0
priority: P3
status: open
title: Tri-boolean float FromValue mode-search hangs for wide decoders (biased-exponent impls F#/C#/Rust; TS radix-point unaffected) — bound the scan analytically or cap widths, consistently
tier: core-primitive
ask: Codex P2 review on PR #6186 (2026-05-30)
created: 2026-05-30
last_updated: 2026-05-30
decomposition: leaf
composes_with:
  - docs/backlog/P1/081KSV2WD0008QG0R00051XS0N-tri-boolean-core-primitives-digital-qubit-floating-point-multi-language-build-compiler-parity-non-byzantine-bft-aaron-2026-05-30.md
  - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
  - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
tags: [core-primitive, tri-boolean, floating-point, fromvalue, performance, dos-hardening, cross-language-parity, biased-exponent, v0-hardening]
type: bug
---

# 081KSV2WD0008QG0R002K85NP0 — Tri-boolean float `FromValue` mode-search hangs for wide decoders

## The finding (Codex P2 on PR #6186, 2026-05-30)

`FromValue` (the biased-exponent canonical encoder) scans the decoder mode linearly from `0` to
`2^decoderWidth - 1`, computing `V = value / 2^(mode - bias)` at each step until `V` is a
non-negative integer fitting the value field. For the default 4/3/4 shape this is 8 iterations —
trivial. But `FloatShape` is **public** and `FromTrits` accepts **arbitrary** decoder widths, and:

- `bias = 2^(decoderWidth - 1)`, so for `decoderWidth >= ~20` the bias is ~10^6+; the first mode
  whose `V` drops below `2^valueBits` is around `bias`, while the loop starts at `0`.
- Result: a call like `FromValue(1.0, FloatShape(4, 32, 4))` scans ~2.1 **billion** iterations
  before finding an ordinary value — an **effective hang** instead of returning feedback.

## Affects the biased-exponent impls (F#/C#/Rust) — NOT TS (radix-point)

**Correction (Codex P2 on #6188):** the hang is specific to the **biased-exponent** decoder. In
biased-exponent, mode 0 gives the *largest* scaling (`V = value · 2^bias`, astronomically large for
wide decoders → skipped), so ordinary values aren't found until mode ≈ bias — hence the
~2.1-billion-iteration scan. The three biased-exponent impls — **F# (`int64`), C# (`long`), Rust
(`u64`)** — share this exactly (same `0..maxMode` loop). **TS's `fromValue` is radix-point**
(`V = value · 2^mode`): mode 0 gives the *smallest* scaling, so a normal value like `1.0` is found
**immediately at mode 0** and returns — TS does **not** share this hang. (TS would only inherit it
if/when it adopts the ratified biased-exponent decoder as canonical.)

So among the three biased-exponent impls the behavior is **consistent — not a parity divergence**:
the 2026-05-30 int64/long widening (PRs #6183 F# / #6186 C#) made the integer widths uniform; it did
not create the hang (a pre-existing v0 limitation of the biased-exponent mode-search). The fix **must
be applied identically across the three biased-exponent impls** (a C#-only point-fix would *introduce*
divergence — backwards for a BFT-parity primitive), and across TS too whenever TS's canonical
decoder flips to biased-exponent.

## Fix options (operator/design decision on policy)

1. **Analytic mode window** (preferred — pure improvement, parity-preserving): derive the smallest
   mode where `V < 2^valueBits` from `log2(value)` (`mode_lo ≈ bias - valueBits + log2(value)`,
   clamped to `[0, maxMode]`), then scan only the ~`valueBits`-wide window, breaking once `V < 1`
   (V decreases monotonically as mode rises). Same results for every currently-terminating shape;
   no hang. Risk: the `log2`/floor/ceil edge cases must be computed **identically** across f64 in
   all four languages, or a new conformance divergence appears — verify with a shared vector.
2. **Cap widths** (Codex's alternative — simpler, changes the contract): reject f64-non-meaningful
   shapes up front with `NotRepresentable` feedback (e.g. `valueBits > 52` or `decoderWidth` whose
   `bias` exceeds f64's exponent range), before the loop. Easy + uniform, but narrows the API.

Either way: land the SAME choice in the biased-exponent impls (F#/C#/Rust) — and in TS whenever its
canonical decoder flips to biased-exponent — + add a conformance vector (the slice-6 ballot) that
exercises a wide-decoder shape and asserts bounded-time feedback rather than a hang.

## Acceptance

1. `FromValue` returns in bounded time (no multi-billion-iteration scan) for any public shape, in
   the biased-exponent impls (F#/C#/Rust; TS too if/when it adopts biased-exponent).
2. The chosen policy (analytic-window vs width-cap) is identical across the biased-exponent impls.
3. A conformance vector covers a wide-decoder shape; parity across the affected impls.
4. Existing default-shape behavior unchanged (the per-language vectors still pass).

## Why P3

Latent — only pathological public shapes (decoderWidth ≥ ~20) hit it; no realistic usage
(default decoderWidth = 3) is affected, and v0 is an explicitly PROPOSED design-starter. Raise to
P2 if/when a consumer needs wide-decoder shapes. The Copilot P1 test-gap on the same PR (untested
past 31 bits of *value* width) was fixed in #6186 directly; this row tracks the *decoder*-width
mode-search hang separately.

## Pre-start checklist (per backlog-item-start-gate)

- **Prior-art search (2026-05-30):** the mode-search lives in 081KSV2WD0008QG0R00051XS0N slice 5 pt2 (`FromValue` in
  each `Core.*.TriBoolean` float). No existing row covers the wide-decoder hang. Composes with the
  slice-6 conformance harness (the BFT ballot) where the wide-shape vector belongs.
- **Dependency check:** depends on 081KSV2WD0008QG0R00051XS0N slice 5 pt2 (the float impls — F#/C#/Rust merged via
  #6183/#6184+#6186/#6185). Slice 6 (conformance harness) is the natural home for the wide-shape
  parity vector.
- **Empirical anchor:** Codex P2 thread on [PR #6186](https://github.com/Lucent-Financial-Group/Zeta/pull/6186).
