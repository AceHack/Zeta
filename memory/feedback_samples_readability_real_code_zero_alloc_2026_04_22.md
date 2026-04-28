---
name: Samples optimize for newcomer readability, real code optimizes for zero/low allocation — distinct audiences, distinct disciplines
description: Aaron's 2026-04-22 directive separating sample-code and production-code disciplines. Samples are onboarding docs in F# form — simpler idioms win. Production code is where the zero-alloc discipline the README advertises must actually hold. Applies everywhere a decision balances clarity vs. performance cost.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Samples: readability-first. Real code: zero/low-alloc-first.

## Rule

**Samples are teaching artifacts.** Prefer the clearest, most idiomatic
F# shape even if it has a small allocation cost (e.g. `ZSet.ofSeq`
with plain-tuple `(k, w)` literals). One less concept to explain to
a newcomer wins.

**Production code is where zero/low-allocation discipline binds.** Use
`ZSet.ofPairs` + `struct (k, w)` literals, `ReadOnlySpan<T>` on hot
loops, `ArrayPool<T>.Shared` for scratch buffers, struct comparers,
`[<Struct; IsReadOnly>]` records — the full `README.md#performance-design`
table. This is the discipline the project advertises.

**Why:** Aaron, 2026-04-22 auto-loop-46, after I "optimized" a sample
to use struct tuples:

> if that's the discipline you want for samples.  Oh this was sample
> code?  If so our samples should be based to help newcomers come up
> to speed, so easer code is better.  real code should follow the
> 0/low allocation stuff.

Preceded in the same tick by:

> zero alloc is our goal

> where possible

> you are not reading our docs

The pairing is load-bearing. Zero-alloc is the production discipline.
Samples are the newcomer bridge — putting the discipline into the
bridge trips newcomers on `struct` syntax and `ValueTuple` semantics
before they have seen the point.

## How to apply

- **Samples under `samples/`** — plain tuples, plain lists, obvious
  names. A short in-file comment can *point* at the zero-alloc
  production path (e.g. "production code uses `ZSet.ofPairs` with
  `struct (k, w)` literals — see `docs/BENCHMARKS.md`"). Do not
  *demonstrate* the zero-alloc path in-sample unless the sample's
  subject is zero-alloc itself.
- **Source under `src/`** — zero-alloc or low-alloc as standard.
  Every `ZSet` construction on a hot path uses `ofPairs` with
  struct-tuple inputs. Span-based loops where viable. Read
  `docs/BENCHMARKS.md` "Allocation guarantees" section and the
  `README.md#performance-design` table before writing new code that
  touches ZSet/Spine/SIMD surfaces.
- **Tests under `tests/`** — mixed by design. Allocation-property
  tests (e.g. `tests/Tests.FSharp/Runtime/Allocation.Tests.fs`) must
  use the zero-alloc path, because they assert zero-alloc. Correctness
  tests may use whichever form is clearest for the property under
  test.
- **Before picking an API, read the relevant doc**
  (`docs/BENCHMARKS.md`, `README.md#performance-design`,
  `docs/CODE-STYLE.md` if it exists). I defaulted to `ZSet.ofSeq`
  based on grep-patterns in the test tree without checking the
  benchmarks doc — Aaron specifically called out *"you are not
  reading our docs"* as the fix.

## What this is NOT

- Not license to write *wasteful* sample code. Samples should still
  use the public-surface API idiomatically — just the idiomatic shape,
  not the extreme-perf shape.
- Not a rule that every `.fs` file under `samples/` is exempt from
  allocation discipline forever. If the sample's *subject* is a
  performance-property demo, it uses the production shape because the
  shape is the lesson.
- Not a license to defer zero-alloc in production indefinitely. The
  production discipline is binding; this rule just names the boundary.
- Not a claim that `ZSet.ofPairs` measurably saves allocation over
  `ZSet.ofSeq` in every case — `ofPairs`'s current implementation
  converts to plain tuples internally via `Seq.map`. The discipline
  is about *intent at the call site* (stack-allocated struct tuples
  vs. heap-allocated reference tuples at the literal), not a
  guarantee that the end-to-end allocation is lower.

## Composes with

- `README.md#performance-design` — the advertised performance table
  Zeta commits to.
- `docs/BENCHMARKS.md` "Allocation guarantees (zero-alloc paths)" —
  the verified-zero-alloc operations list.
- `memory/feedback_upstream_is_first_class_look_upstream_before_assuming_misspelling_2026_04_22.md`
  — same "read the docs first" spirit, different axis (upstream
  naming).
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — samples' job is to pass the algebraic signal through cleanly to
  newcomers; zero-alloc noise is a distortion in the signal-to-
  newcomer path.
