# Checked vs unchecked arithmetic — when safety is free and when it costs throughput

**Subject:** production-dotnet
**Level:** applied (default) + theoretical (opt-in)
**Audience:** contributors already comfortable with F# types,
spans, and Z-set basics; moving from "it compiles" to "it runs
fast *and* correctly under adversarial input"
**Prerequisites:** an onboarding-tier Z-set foundation — of the
planned onboarding modules (zset-basics, retraction-intuition,
operator-composition, semiring-basics), `retraction-intuition`
ships on main today as `subjects/zeta/retraction-intuition/`;
the other three are in-flight PRs. Also assumes BenchmarkDotNet
literacy.
**Next suggested:** `subjects/production-dotnet/zero-alloc-hot-loops/`
(forthcoming — stubbed in the per-tier README)

---

## The anchor — a loop that sums 100 million `int64`s

You're writing a Z-set aggregation. Somewhere in the hot path
you have this:

```fsharp
let sumWeights (span: ReadOnlySpan<ZEntry<'K>>) : int64 =
    let mutable total = 0L
    for i in 0 .. span.Length - 1 do
        total <- Checked.(+) total span.[i].Weight
    total
```

On a 100-million-entry span this loop runs ~40-60 ms on a
modern laptop. Drop `Checked.` and the same loop runs in ~10-
15 ms — a 3-4× throughput improvement. On a hotter workload
(SIMD-vectorisable, tight inner) the gap widens further
because `Vector<int64>` does not exist with checked semantics.

**But if you drop `Checked.` carelessly, a cumulative weight
sum can sign-flip your entire multiset** (this is the
canonical Zeta hazard documented at `src/Core/ZSet.fs:227-230`).
The production-tier question is never "checked vs. unchecked
in the abstract" — it is "can we prove the bound, and if yes,
does the measurement earn the demotion?"

---

## Applied track — the decision framework

### F# defaults (know these cold)

- F# operators `+`, `-`, `*` on integer types are **unchecked
  by default** — silent wraparound on overflow.
- `Checked.(+)`, `Checked.(-)`, `Checked.(*)`, `Checked.( ~-)`
  from `Microsoft.FSharp.Core.Operators.Checked` opt in to
  `OverflowException` on overflow.
- There is no `checked { }` / `unchecked { }` block in F# —
  the choice is per-call-site via qualifier.
- The project-wide `<CheckForOverflowUnderflow>` MSBuild
  property exists but we do not use it. Explicit-opt-in per
  site is our discipline.
- `Unchecked.defaultof<'T>` is **unrelated** — it asks the
  type system for a zero value. Do not confuse it with
  unchecked arithmetic.

### The six-class site decision matrix

Classify every arithmetic site into one of six classes before
deciding whether to use `Checked.`:

| Class | Definition | Default |
|---|---|---|
| **Bounded-by-construction** | The type system or a compile-time constant proves overflow impossible (e.g. `byte + byte → int32`). | unchecked (F# default) |
| **Bounded-by-workload** | A **hard**, stated invariant of the running system proves the sum cannot reach `MaxValue` — e.g. a loop counter with a known iteration cap, a cell count multiplied by a per-cell cap. "Unlikely within a reasonable lifetime" is not a bound; it is a vibe. | unchecked + comment stating the numeric cap |
| **Bounded-by-pre-check** | A cheap upstream guard makes overflow impossible inside the hot loop (the guard is outside the loop). | unchecked inside loop; check at boundary |
| **Unbounded stream sum** | A cumulative value over an unbounded stream — no bound is provable because the stream never ends. | **keep `Checked.`** |
| **User-controlled product** | A product of two caller-provided values that a hostile caller could pick adversarially. | **keep `Checked.`** |
| **SIMD-candidate** | A loop eligible for `Vector<int64>` vectorisation where checked arithmetic is architecturally unavailable. | unchecked with block-boundary overflow detection |

### Decision tree (read top to bottom)

1. Is the bound provable by the **type system** (e.g.
   `byte + byte` cannot overflow `int32`)? → **unchecked.**
2. Is the bound provable by an **upstream pre-check** (e.g. a
   `guard` that refuses inputs past a threshold)? → **unchecked
   inside the loop; keep the pre-check outside.**
3. Is the bound provable by a **workload invariant** (e.g.
   counter monotonic, lifetime < 2^63 ops)? → **unchecked with
   a citing comment pointing at the invariant.**
4. Is the loop **SIMD-vectorisable** and the width would
   materialise a measured speedup? → **unchecked in the inner
   loop; detect overflow with a sound technique at the block
   boundary** — see "Sound SIMD overflow detection" below.
   Sign-flip or sum-of-absolutes pre/post are **not** sound
   (overflow can occur an even number of times mid-block and
   still land on a plausibly-signed, plausibly-small result).
5. Otherwise — `Checked.` stays.

### The measurement gate

Before landing any demotion, produce a BenchmarkDotNet
micro-benchmark comparing the two. The real harness for
this module lives at `bench/Benchmarks/CheckedVsUncheckedBench.fs`;
it uses `[<Params(...)]` + `[<GlobalSetup>]` across three
sizes (1M / 10M / 100M) so the default `dotnet run` does not
force an ~800 MB allocation. The shape is:

```fsharp
[<MemoryDiagnoser>]
type CheckedVsUncheckedOps() =
    [<DefaultValue(false)>] val mutable private data: int64 array

    [<Params(1_000_000, 10_000_000, 100_000_000)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() = this.data <- Array.init this.Size int64

    [<Benchmark(Baseline = true)>]
    member this.SumScalarChecked () =
        let mutable total = 0L
        let d = this.data
        for i in 0 .. d.Length - 1 do
            total <- Checked.(+) total d.[i]
        total

    [<Benchmark>]
    member this.SumScalarUnchecked () =
        let mutable total = 0L
        let d = this.data
        for i in 0 .. d.Length - 1 do
            total <- total + d.[i]
        total
```

A demotion that does not deliver ≥ 5 % measured improvement
at the audit's target size (100 M) is not worth the
correctness risk. Small speedups on cold paths do not
justify giving up overflow detection; in that case the
`Checked.` stays. Read the full harness (including the
unrolled and merge-like scenarios) at the path above before
proposing a new demotion.

### Silent-overflow detection in production

Even with a proved bound, belt-and-braces discipline says you
should be able to catch a bound violation in production
without crashing. F# `assert` is compiled out in Release
builds (and throws when enabled) so it is **not** a production
detection mechanism — what follows are runtime-always checks
that record telemetry rather than abort:

- **Invariant checks at stream boundaries** — when a computed
  total leaves a hot path, test `total >= 0L` (or whatever
  sign invariant holds) with a plain `if` and emit a metric +
  structured log on failure. Do not use `assert`; the check
  must run in Release. Optionally trip a circuit-breaker to
  reject further input until the invariant is re-established.
- **Metric sensors** — emit `max(abs(intermediate))` as a
  per-operator metric. A silent wraparound appears as a
  sudden jump from near-`MaxValue` to deeply-negative.
- **Property tests on the bound** — your FsCheck harness
  should generate inputs at ±2^62 to exercise the boundary
  directly. If the production code ever reaches those
  magnitudes in the wild, the tests have validated the
  behaviour.

### Sound SIMD overflow detection

Sign-flip watching and sum-of-absolutes pre/post are **not**
sound overflow detectors for a block of `int64` additions.
An even number of overflows inside a block can leave the final
scalar inside any range you care to pick, so neither the sign
nor the magnitude tells you whether arithmetic stayed within
`Int64`. Use one of these instead:

- **Wider accumulator per block** — accumulate into `Int128`
  (`System.Int128` on .NET 7+) or two `Int64` halves (a
  carry-propagating pair). The SIMD inner loop stays on
  `Vector<int64>`; the reduce step widens. Overflow is
  impossible until the wider type saturates, and bounds on
  the wider type are far easier to prove.
- **Per-block magnitude cap** — pre-check that the block's
  `max(abs(value))` multiplied by block length cannot reach
  `Int64.MaxValue`. The check runs once per block, not once
  per element; its cost is amortised across the vectorised
  body.
- **Periodic checked reduce** — after every K blocks (K
  chosen so K·blockSize·maxElem < 2^63 stays true) reduce
  the vector accumulator back to a scalar using `Checked.(+)`
  and reset. One scalar `Checked.(+)` per K blocks is
  typically free against the SIMD speedup.

Pick the technique that matches the bound shape you can
actually prove. "Sign-flip check" is a folklore heuristic,
not an overflow detector.

---

## Theoretical track — how to prove a bound

Three techniques, in order of preference.

### 1. Type-system proof (free, always preferred)

If widening makes overflow impossible, demote without
argument:

```fsharp
// byte + byte cannot overflow int32 (max 255 + 255 = 510)
let inline sum2 (a: byte) (b: byte) = int32 a + int32 b
```

### 2. Algebraic bound argument

Cite a workload invariant in a comment. Example
(`Z-set weight sum on a windowed stream with max window size W`):

```fsharp
// Bound: a window holds at most W entries, each with
// |Weight| <= 2^31. Cumulative sum bounded by W * 2^31.
// For W < 2^32 (our configured max), sum stays within int64.
let mutable total = 0L   // unchecked, bound justified above
```

The comment turns a silent assumption into a reviewable
claim. A reviewer who disagrees can challenge the invariant;
a reviewer who agrees has validated the demotion.

### 3. Property-test coverage (FsCheck)

For workload bounds that are not closed-form, a property test
documents the bound operationally:

```fsharp
// Helper mirroring the hot-path shape but over plain int64
// so the bound test stands alone. The real `sumWeights` in
// `src/Core/ZSet.fs` takes `ReadOnlySpan<ZEntry<'K>>` and
// reads `.Weight` per entry; the arithmetic is identical.
let sumInt64s (span: ReadOnlySpan<int64>) : int64 =
    let mutable total = 0L
    for i in 0 .. span.Length - 1 do
        total <- total + span.[i]   // unchecked; see property below
    total

// Length cap + per-element cap must be picked so that
// lengthCap * elemCap < 2^63. With elemCap = 2^40 we need
// lengthCap < 2^23 (8 388 608) to keep the true sum inside
// Int64. The property enforces BOTH caps and verifies the
// unchecked fold agrees with a BigInteger reference fold
// (no wraparound masquerading as a "small" result).
[<Property(MaxTest = 10_000)>]
let ``unchecked sum equals BigInteger sum for bounded inputs``
    (values: NonEmptyArray<int64>) =
    let lengthCap = 1 <<< 20    // ~1M entries
    let elemCap = 1L <<< 40
    let raw = values.Get
    let truncated =
        if raw.Length <= lengthCap then raw
        else raw.[.. lengthCap - 1]
    let bounded =
        truncated
        |> Array.map (fun x -> x % elemCap)
    let sUnchecked = sumInt64s (ReadOnlySpan<int64>(bounded))
    let sReference =
        bounded
        |> Array.fold (fun acc x -> acc + bigint x) 0I
    // Both bounds together guarantee the true sum fits int64
    // (|sum| < 2^60), so equality is the correctness signal.
    bigint sUnchecked = sReference
```

The property codifies the joint bound "length ≤ 2^20 AND per-
element magnitude ≤ 2^40 → true sum fits int64" and cross-checks
the unchecked fold against a wider-type reference. If either
cap is lifted without re-proving the bound, the property will
fire — a silent wraparound would make the `int64` fold disagree
with the `bigint` reference. A demotion to unchecked is justified
only under a contract that names both caps; the property is the
contract, not the assertion.

---

## Zeta-specific choice — what the audit preserves

The canonical `Checked.` site in Zeta is here:

```fsharp
// src/Core/ZSet.fs:227-230
// `Checked.(+)` — Z-set weights are int64 but nothing
// stops a stream from running forever; silent wraparound
// on overflow would turn a +2^63 multiset into a -2^63
// multiset and corrupt every downstream query.
let s = Checked.(+) sa.[i].Weight sb.[j].Weight
```

This site is class **Unbounded stream sum** — the bound is
not provable because nothing in the DBSP contract bounds
stream lifetime. A production-grade Zeta deployment
processing 1 B retractions/s would reach `Int64.MaxValue` in
~292 years; that is long but not ∞, and a correct-by-
construction library should not have a silent time-horizon
bug. **This site stays `Checked.`**.

Candidate sites from the same neighbourhood that merit per-
site analysis under the audit (`docs/BACKLOG.md` § "P2 —
Production-code performance discipline") — exact line numbers
drift as the surrounding code evolves; treat the file-level
references as the invariant and re-locate by symbol name:

- `src/Core/ZSet.fs` merge-inner loop around the
  `Checked.(+) sa.[i].Weight sb.[j].Weight` site —
  **SIMD-candidate**. Loop-unrolled partial sums;
  `Vector<int64>` could replace the scalar adders at 2-4×
  throughput under a **sound** block-boundary overflow
  technique (see "Sound SIMD overflow detection" above).
  Sign-flip heuristics do not qualify.
- `src/Core/NovelMath.fs` KLL `Add` counter — **Unbounded
  stream sum**. `KllSketch.Add` has no hard iteration cap;
  it is called once per ingested item on an unbounded
  stream. "Longer than the universe" is not a bound — the
  same argument retires `Checked.` from `ZSet.fs:227-230`,
  which we explicitly refuse to do. **Keep `Checked.`**.
- `src/Core/CountMin.fs` cell-increment site — **Unbounded
  stream sum**. `CountMinSketch.Add` takes a caller-supplied
  `int64 weight` with no numeric cap and is called once per
  stream item. Sketch accuracy parameters bound *error*,
  not *counter magnitude* — a single adversarial weight
  plus enough calls reaches `Int64.MaxValue`. **Keep
  `Checked.`** pending a separately-proved ingest-rate /
  weight-magnitude contract the code actually enforces.
- `src/Core/Aggregate.fs` group-sum site — **Unbounded
  stream sum**. Keep `Checked.` — class matches
  `ZSet.fs:227-230`.

Sites that remain plausible demotion candidates need a hard
numeric bound, not a plausibility argument. The audit's job
is to produce that bound (or keep `Checked.`), not to demote
on aesthetic grounds.

**The audit is not "demote everything"; it is "classify
every site and demote only what passes the measurement gate."**
Over half the sites will keep `Checked.` on correctness
grounds. That is the correct outcome.

---

## Composes with

- `subjects/zeta/retraction-intuition/` — the onboarding-
  tier module on main that introduces signed weights; the
  canonical "Z-set weight" vocabulary this module builds on.
- `subjects/zeta/zset-basics/` (in-flight via PR #200) —
  the foundational Z-set introduction once it merges; you
  need to know what a Z-set weight *is* before reasoning
  about its overflow behaviour.
- `subjects/zeta/operator-composition/` (in-flight via
  PR #203) — establishes why weight-sum correctness is
  load-bearing for every downstream operator.
- `docs/BACKLOG.md` § "P2 — Production-code performance
  discipline" — the two BACKLOG rows this module supports
  (audit + Craft production-tier ladder).
- `src/Core/ZSet.fs:227-230` — the canonical rationale
  comment; this module is the pedagogical expansion of that
  comment.
- **Out-of-repo** (per-user memory, not yet in-repo)
  factory-generic memory
  `feedback_samples_readability_real_code_zero_alloc_2026_04_22.md`
  — the samples-vs-production discipline this production
  tier extends to pedagogy (candidate for Overlay-A migration
  when that memory is promoted in-repo).
- `docs/BENCHMARKS.md` "Allocation guarantees" section — the
  sibling surface where the audit's measurement deliverables
  land.

---

## What this module is NOT

- **Not a mandate to demote every `Checked.` site.** The
  canonical stream-weight-sum case stays Checked on
  correctness grounds; roughly half the audit's sites will
  land in the "keep Checked" column.
- **Not authorisation to disable `CheckForOverflowUnderflow`
  project-wide.** Our discipline is explicit opt-in per call
  site, not a project-flag flip.
- **Not a substitute for property tests.** Every demotion
  demands an FsCheck property asserting the claimed bound.
  Demoting without the test is a latent regression.
- **Not onboarding material.** A reader who does not yet
  understand what a `ZEntry<'K>` is will not benefit from
  this module — they will return to
  `subjects/zeta/zset-basics/` first.
- **Not micro-optimisation for its own sake.** The
  measurement gate (≥ 5 % improvement) is load-bearing. A
  demotion that saves 1 % on a cold path is not worth the
  correctness risk; the `Checked.` stays.

---

## Self-check — did this module work for you?

After reading, a production-tier reader should be able to:

1. Name the six site classes and give a one-line criterion
   for each.
2. Write a BenchmarkDotNet harness comparing `Checked.(+)` to
   `(+)` on a hot loop.
3. Recognise the `src/Core/ZSet.fs:227-230` site as an
   **unbounded stream sum** and explain why it stays
   `Checked.`
4. Propose a concrete demotion candidate in Zeta with an
   accompanying FsCheck property and a bound-argument comment.

If any of those four are shaky, the module failed on that
axis. Open a GitHub issue (or propose a revision PR) — the
Craft discipline (bidirectional alignment) treats your
confusion as evidence the module needs work, not evidence
that you do. `docs/WONT-DO.md` is the curated list of
explicitly declined features — not an issue tracker; use
GitHub issues for the report itself, reserve `WONT-DO.md`
for declined-with-reason entries once triage concludes.
