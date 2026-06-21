---
id: 081KR7JY10008QG0R0021T5QTR
priority: P1
status: closed
title: "Split ISemiring into ISemiring (no Negate) and IRing : ISemiring (with Negate axiom) — fix IntervalRing/TropicalSemiring contract violations"
created: 2026-05-10
last_updated: 2026-05-10
closed: 2026-05-10
closed_by: "PR #2391"
depends_on: []
composes_with: [081KR50HA0008QG0R000Z4XCPJ]
classification: buildable-now
type: feature
effort: M
tags: [algebra, semiring, ring, interval, tropical, dbsp, retraction, interface-design]
---

# 081KR7JY10008QG0R0021T5QTR — ISemiring / IRing interface split

## Origin

Codex review on PR #2388 (2026-05-10) identified two contract violations in the semiring implementations shipped by PR #2383:

1. **P1 — IntervalRing.Negate**: `ISemiring<'W>` documents the axiom `Negate a + a = Zero`. `IntervalRing.Negate [a,b] = [-b,-a]` satisfies this axiom ONLY for point intervals `[v,v]`. Non-point intervals violate it: `[1,3] + [-3,-1] = [-2,2] ≠ [0,0]`. Existing tests document this as the "interval dependency problem" (analogous to Spanner TrueTime) — intentional behavior, but the interface contract is violated.

2. **P2 — TropicalSemiring.Negate**: `TropicalSemiring` implements `ISemiring<TropicalWeight>` which advertises a Negate contract, but `Negate` throws `InvalidOperationException` at runtime. The tropical semiring `(R∪{+∞}, min, +)` mathematically has no additive inverse — implementing the interface honestly requires either a separate interface or making this explicit at the type level.

## What

Split `ISemiring<'W>` into two interfaces:

```fsharp
/// Commutative semiring — Add/Mul with identities. No additive inverse required.
type ISemiring<'W> =
    abstract member Zero   : 'W
    abstract member One    : 'W
    abstract member Add    : 'W -> 'W -> 'W
    abstract member Mul    : 'W -> 'W -> 'W

/// Full ring — semiring with additive inverse (ring axiom: Negate a + a = Zero).
/// Required for DBSP retraction (negative weight encoding).
type IRing<'W> =
    inherit ISemiring<'W>
    abstract member Negate : 'W -> 'W
```

Migrations:

- `IntegerRing` → implements `IRing<int64>` (satisfies ring axiom, currently correct)
- `IntervalRing` → implements `IRing<IntervalWeight>` (ring axiom satisfied ONLY for point intervals — document this as a precision/scope limitation, not a bug, since point-interval use-cases are the DBSP retraction target)
- `TropicalSemiring` → implements `ISemiring<TropicalWeight>` only (no `Negate`; the throwing implementation is removed)

ZSet callers that require retraction must be constrained to `IRing`, not `ISemiring`.

## Alternative considered

Change `IntervalRing.Negate` to `[-a,-b]` (satisfies ring axiom for all intervals but produces improper intervals from proper inputs). Rejected because:

- Produces semantically confusing improper intervals as outputs of the negation of proper intervals.
- Breaks existing tests that document the intended "interval dependency problem" behavior.
- The intended DBSP use case for `IntervalRing` is point-interval precision encoding, where the ring axiom holds anyway.

## Acceptance criteria

1. `ISemiring<'W>` interface does NOT include `Negate`.
2. `IRing<'W> : ISemiring<'W>` interface adds `Negate` with documented axiom `Negate a + a = Zero`.
3. `IntegerRing` implements `IRing<int64>`.
4. `IntervalRing` implements `IRing<IntervalWeight>` with doc comment noting axiom holds only for point intervals.
5. `TropicalSemiring` implements `ISemiring<TropicalWeight>` only — no `Negate`, no throwing.
6. All callers of `Negate` (e.g. DBSP retraction paths) are constrained to `IRing<'W>`.
7. All existing semiring tests pass; new tests verify `TropicalSemiring` does not implement `IRing`.
8. `dotnet build -c Release` → 0 warnings 0 errors.

## Evidence

- Codex review thread on PR #2388: `PRRT_kwDOSF9kNM6A3V4A` (IntervalRing P1), `PRRT_kwDOSF9kNM6A3V4B` (TropicalSemiring P2)
- `tests/Tests.FSharp/Algebra/Semiring.Tests.fs` lines 131-147 (interval dependency problem tests)
- `src/Core/Semiring.fs` line 15 (axiom documentation on ISemiring)
- PR #2383 (`claim(081KR50HA0008QG0R000Z4XCPJ): semiring-weight instances`)

## Completion record

Shipped in commit `1121b239` via PR #2391 (2026-05-10).

All acceptance criteria verified:

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `ISemiring<'W>` has no `Negate` | ✓ `src/Core/Semiring.fs:14-18` |
| 2 | `IRing<'W> : ISemiring<'W>` adds `Negate` with axiom doc | ✓ `src/Core/Semiring.fs:20-28` |
| 3 | `IntegerRing` implements `IRing<int64>` | ✓ `src/Core/Semiring.fs:45-46` |
| 4 | `IntervalRing` implements `IRing<IntervalWeight>` with point-interval scope note | ✓ `src/Core/Semiring.fs:115-122` |
| 5 | `TropicalSemiring` implements `ISemiring<TropicalWeight>` only — no `Negate`, no throwing | ✓ `src/Core/NovelMath.fs:66-76` |
| 6 | Retraction callers constrained to `IRing<'W>` | ✓ `IntegerRing.Instance : IRing<int64>`, `IntervalRing.Instance : IRing<IntervalWeight>` |
| 7 | All semiring tests pass; `TropicalSemiring` non-`IRing` test present | ✓ 25/25 tests pass |
| 8 | `dotnet build -c Release` → 0 warnings 0 errors | ✓ confirmed 2026-05-10 |
