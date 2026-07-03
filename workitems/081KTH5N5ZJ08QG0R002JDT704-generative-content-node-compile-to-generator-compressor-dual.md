---
id: 081KTH5N5ZJ08QG0R002JDT704
type: task
state: backlog
priority: P2
slug: generative-content-node-compile-to-generator-compressor-dual
title: "Generative content node + compile-to-generator compressor (dual materialized/generative, DST-regenerated, ContentHash256-verified)"
created: 2026-06-07T13:51:46.674Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A"]
---

# Generative content node + compile-to-generator compressor (dual materialized/generative, DST-regenerated, ContentHash256-verified)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH5N5ZJ08QG0R002JDT704-*.md` glob. -->

## Purpose

Aaron 2026-06-07: "my compression compresses into a self-bootstrapping compiler that can run common
generator functions" + "compression + generators where the compression regenerates data via deterministic
simulation (like test data generation)." Operationalize Kolmogorov-style compression as a RUNNABLE,
content-verified substrate. Full synthesis:
`docs/research/2026-06-07-compression-as-self-bootstrapping-compiler-over-generators-...md`.

## Build

- The incompressible RESIDUAL is captured as **Bayesian uncertainty** (`SoftValue`), not a failure (Aaron
  2026-06-07): `data = generator(seed,params) ⊕ residual-as-Bayesian-distribution`. The `Generative` arm
  carries an optional uncertainty residual (SoftValue). A better model shrinks the residual; max-entropy
  residual = lossless fallback to materialized bytes. Ties SoftValue/Bayesian + prediction≡compression.
- A dual-representation content node: `Materialized of bytes | Generative of {compilerRef; generatorRef;
  seed; params}`; both content-address to the same `ContentHash256` (regenerate -> hash -> verify).
- A shared library of "common generator functions" (executable codebook; Bonsai expr-trees in DynamicValue),
  referenced by the generative payload.
- A compressor that, where data has generator-capturable structure, emits the generative form when smaller;
  decompress = run the generator under DST + verify the hash.
- Self-bootstrapping compiler/runner = Ace/Nucleus; DST = same seed -> bit-identical output.

## Status — first executable-codebook slice, TS cart context (Otto 2026-07-03, cowork)

`src/Core.TypeScript/chip9-cart/capture.ts` compiler v1.1: identical sprite blobs are
content-addressed into a shared CODEBOOK (stored once, every draw references the shared address)
plus peephole register reuse. This is this item's "shared library of common generator functions"
at its most degenerate — a dictionary, not yet a generator — but it already shows the honest
split the acceptance wants: structured content compresses (dense uniform 64x32: ~1350 -> 453
bytes; synthetic sheet: 1348 -> 566, now smaller than its 1180-byte source PNG), while seeded
noise barely moves (1252 bytes) — incompressible stays incompressible, no false economy. Verify
stays regenerate-and-byte-compare. The real slice (Generative-vs-Materialized node, SoftValue
residual, ContentHash256, pick-smaller) remains open — F#-side, needs dotnet (CI-side from Cowork).

## Acceptance

A node round-trips through the generative path (generator+seed -> regenerate -> hashes to the same
ContentHash256 as the materialized bytes); pick-smaller works; DST replay is bit-identical; falls back to
materialized for incompressible/no-generator data.

## Anchors

- compression-as-self-bootstrapping-compiler research doc · DST (manifesto §7) · Bonsai/behavior-as-data ·
  Ace/Nucleus self-boot · ContentHash256/ContentStore · 081KTGTJC1Q (COW store) · git-as-event-store ·
  Kolmogorov/Solomonoff/Hutter; demoscene .kkrieger; QuickCheck.
