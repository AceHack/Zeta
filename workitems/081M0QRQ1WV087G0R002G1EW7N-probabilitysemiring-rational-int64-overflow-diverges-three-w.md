---
id: 081M0QRQ1WV087G0R002G1EW7N
type: bug
state: backlog
priority: P2
slug: probabilitysemiring-rational-int64-overflow-diverges-three-w
title: "ProbabilitySemiring Rational int64 overflow diverges three ways across the four oracles and no golden vector reaches it"
created: 2026-08-23T16:54:28.507Z
depends_on: []
composes_with: []
---

# ProbabilitySemiring Rational int64 overflow diverges three ways across the four oracles and no golden vector reaches it

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRQ1WV087G0R002G1EW7N-*.md` glob. -->

**Evidence:** `docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-and-the-natural-parameter-embedding-that-does-not-truncate.md` §5.2–§5.3, measured at `6a23b9fc45`.

`ProbabilitySemiring.rat` reduces but does not check overflow. `WireWeight.fs` already records that
honestly. What is **not** recorded is that the four oracles then disagree. Same input
`add(1/4e9, 1/3e9)` and `mul` of the same, verbatim replicas of each oracle's own source:

| oracle | result |
|---|---|
| TypeScript (`number`) | `{n:7, d:12000000000}` / `{n:1, d:12000000000000000000}` — **exact** |
| F# (`int64`, unchecked) | `{Num=-13671875; Den=12591297018963968}` / `{Num=-1; Den=6446744073709551616}` — **a negative probability** |
| Rust release (`i64`) | identical to F# |
| Rust debug (**the `cargo test` default**) | *panic: attempt to multiply with overflow* |
| C# (`long`, no `CheckForOverflowUnderflow`) | inferred same as F#; not separately executed |

`golden-vectors.json` carries no integer of six digits or more and its own header says the seeds stay in
the safe-integer range — so **no vector reaches the divergent path**, which is the same defect class as
the tie-break divergence found in PR #14266.

**The fix and what it costs.** `bigint` rationals, per Aaron 2026-08-23 (*"f# has dotnet bigint as long
as we bitlock it so all our bigints work the same across all language oracles"*) — and `src/Core/WSet.fs`
already uses `bigint` for sequence numbers, so `int64` here was a choice, not a platform limit. The hard
half is cross-oracle:

- **Rust has no std bigint** and no `num-bigint` anywhere under `src/` — a dependency decision, settle first.
- **Division/mod sign: verified**, .NET `BigInteger` and JS `bigint` agree (`-7/2 = -3`, `-7 % 2 = -1`,
  `7 / -2 = -3`, `7 % -2 = 1`; truncate toward zero, `%` takes the dividend's sign). Rust `num-bigint`
  **unverified** — the crate is not in the tree.
- TS must move to `bigint` too: doubles are exact below 2^53 and *round* rather than wrap above it, so TS
  diverges from the int64 oracles in both regimes. `src/Core.TypeScript/algebra/exact-weight.ts` already
  has the bigint rational, for the other WSet.

**Acceptance:** golden vectors that include a negative rational and a gcd reduction that only bites above
2^63 — a vector that stays in the safe range is decoration.
