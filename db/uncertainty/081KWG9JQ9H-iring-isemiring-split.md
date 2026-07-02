# ΔU: 081KWG9JQ9H — the IRing/ISemiring split

- **measure:** the bug class "retraction attempted on an inverse-less algebra"
  moved from runtime-throw-if-you're-lucky (InvalidOperationException inside a
  DBSP fold) to DOES-NOT-COMPILE, across six surfaces (F#, C#, TS, Python, Q#,
  Go) and the byte-locked IR treaty (ring.ir.json).
- **ΔU > 0 because:** the semiring/ring distinction is now metered at the
  cheapest gate (the type system) instead of the most entropic one (production
  runtime). Two shipped lies deleted: TropicalSemiring's throwing Negate (the
  impossibility is classical — Vandiver 1934, Golan 1999) and IntervalRing's
  false ring claim (demoted with the on-file exception; Moore 1966
  sub-distributivity witnessed in SemiringRing.Laws.Tests.fs).
- **witnessed by:** the law pack (#9103, landed BEFORE the change per Ilyana
  condition 1) + Z3/CVC5 cross-checked lemma + 3777 F# / 385 C# / 284 TS tests
  green under the split.
- **lineage:** found via the distributed-seed review pattern (Fable 5, 2026-07-02);
  reviews: Soraya TOWER-NEEDS-CHANGES → incorporated; Kira adversarial → 6-oracle
  atomicity; Ilyana APPROVE-WITH-CONDITIONS → all five conditions met.
