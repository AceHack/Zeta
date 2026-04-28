# PR #331 drain log — Graph cohesion + StakeCovariance windowed acceleration

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/331>
Branch: `feat/graph-cohesion-conductance-plus-windowed-stake-covariance`
Drain session: 2026-04-24
Thread count at drain start: 9 unresolved

Full per-thread record with verbatim reviewer text, outcome,
verbatim reply, and resolution commit per the
PR-comment-preservation directive.

Resolution commit for all FIX outcomes: `59f3397`.

---

## Thread 1 — `src/Core/Graph.fs:727` — `aggregateAcceleration` hardcoded `int * int`

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59VZ1v`

### Original comment (verbatim)

> `aggregateAcceleration` hard-codes `Map<int * int, double>`, which makes the StakeCovariance API inconsistent with the rest of Core's generic node/key handling (e.g., `Graph<'N>`). Consider making this generic over the key type (e.g., `Map<'N * 'N, double>` with `'N : comparison`) or just accepting a sequence of acceleration values if the keys aren't used.
> ```suggestion
>     let aggregateAcceleration<'N when 'N : comparison>
>             (pairAccelerations: Map<'N * 'N, double>)
> ```

### Outcome

FIX — signature now `aggregateAcceleration<'N when 'N : comparison> (pairAccelerations: Map<'N * 'N, double>)`. Body also moved to a single-pass `Map.fold` (closes thread 8 on the same function).

### Reply (verbatim)

> Fixed in 59f3397. `aggregateAcceleration` is now generic over `'N when 'N : comparison` so the StakeCovariance API matches `Graph<'N>`. The implementation is also a single-pass `Map.fold` now, dropping the intermediate `Seq.toArray` allocation (this also closes the thread 8 P2 on the same function). Resolved.

---

## Thread 2 — `src/Core/Graph.fs:678` — second `[<AutoOpen>]` module in Graph.fs

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59VZ22`

### Original comment (verbatim)

> `Graph.fs` now defines a second `[<AutoOpen>]` module (`StakeCovariance`). Most Core modules appear to be one concept per file (e.g., `src/Core/RobustStats.fs`, `src/Core/TemporalCoordinationDetection.fs`), and auto-opening additional APIs from `Graph.fs` can unexpectedly pollute `Zeta.Core`. Consider moving `StakeCovariance` into its own `StakeCovariance.fs` (and only marking it `AutoOpen` if you really want those identifiers imported everywhere).

### Outcome

NARROW+BACKLOG — dropped `[<AutoOpen>]` on `StakeCovariance` so it no longer pollutes `Zeta.Core`. Splitting into its own file is the cleaner long-term move and is backlogged.

### Reply (verbatim)

> Narrowed in 59f3397: dropped `[<AutoOpen>]` on the `StakeCovariance` module, so opening `Zeta.Core` no longer auto-imports its identifiers. The test file already opened `Zeta.Core.StakeCovariance` explicitly, so call sites stay clean. The full file split (`src/Core/StakeCovariance.fs`) is backlogged for a follow-up — the no-AutoOpen change closes the immediate Core-pollution concern this thread flagged, while the file move is a structural rearrangement worth its own small PR. Resolved.

---

## Thread 3 — `tests/Tests.FSharp/Algebra/Graph.Tests.fs:500` — mid-file `open` directive

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59VZ3o`

### Original comment (verbatim)

> In this test suite, `open` directives are consistently kept at the top of the file (e.g., `Algebra/RobustStats.Tests.fs`, `Algebra/TemporalCoordinationDetection.Tests.fs`). Adding `open Zeta.Core.StakeCovariance` mid-file is inconsistent; consider moving it to the top-level opens or qualifying the calls instead.

### Outcome

FIX — relocated `open Zeta.Core.StakeCovariance` to the top of the test file alongside the other opens.

### Reply (verbatim)

> Fixed in 59f3397. The `open Zeta.Core.StakeCovariance` directive moved to the top of `Graph.Tests.fs` next to the other opens, matching the convention in `RobustStats.Tests.fs` / `TemporalCoordinationDetection.Tests.fs`. Resolved.

---

## Thread 4 — `src/Core/Graph.fs:637` — `conductance` full-subset detection by count

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59VZ4J`

### Original comment (verbatim)

> P0: `conductance` treats a subset as "full" based on `subset.Count = allNodes.Count`, which can return `None` for non-full subsets that happen to have the same cardinality (e.g., `{1;2;4}` vs graph nodes `{1;2;3}`). Compare sets (or intersect with `nodes g` first) rather than comparing counts.

### Outcome

FIX — full-subset check now intersects `subset` with `nodes g` and compares `inGraph.Count = allNodes.Count`. A subset like `{1;2;4}` over a graph with `{1;2;3}` no longer trips the early-`None` exit.

### Reply (verbatim)

> Fixed in 59f3397. `conductance` now computes `let inGraph = Set.intersect subset allNodes` and tests `inGraph.Count = allNodes.Count` for the full-subset early-exit. The pathological `{1;2;4}` vs `{1;2;3}` case (equal cardinality, distinct sets) now falls through to the cut/volume computation. Doc comment updated to spell out why count equality alone is not set equality. Resolved.

---

## Thread 5 — `src/Core/Graph.fs:706` — `windowedDeltaCovariance` doc says None for zero-variance

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59VZ4g`

### Original comment (verbatim)

> `windowedDeltaCovariance` doc says it returns `None` for "zero variance / insufficient samples", but the implementation always returns `Some` when `n >= windowSize` (including constant/zero-variance windows, where covariance is well-defined and should be 0.0). Either implement the documented degeneracy checks or update the comment to match the actual behavior (and clarify whether you intend population vs sample covariance, since you divide by `windowSize`).

### Outcome

FIX — kept the well-defined `Some 0.0` semantics for constant / zero-covariance windows (covariance IS defined there, the prior doc was wrong). Doc comment now states the actual `None` conditions (length mismatch, `windowSize < 2`, insufficient samples) and explicitly documents the `windowSize` divisor as population covariance.

### Reply (verbatim)

> Fixed in 59f3397. Doc comment rewritten to match the implementation: `None` only when `windowSize < 2`, when the two series have different lengths (see thread 6 fix), or when either series has fewer than `windowSize` points. Constant or zero-covariance windows return `Some 0.0` because covariance is well-defined and zero in those cases, not undefined. Population vs sample is also called out explicitly — the `/ windowSize` divisor is intentional population covariance, treating the window as the population at that time index rather than a sample drawn from a larger one. Resolved.

---

## Thread 6 — `src/Core/Graph.fs:706` — `windowedDeltaCovariance` length mismatch

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59VZ4y`

### Original comment (verbatim)

> `windowedDeltaCovariance` uses `n = min deltasA.Length deltasB.Length` and then takes the trailing window ending at `n`. If the two series have different lengths, this silently drops the tail of the longer series and can misalign time indices. Consider requiring equal lengths (return `None`/error otherwise) or explicitly documenting the alignment/truncation semantics.
> ```suggestion
>     /// trailing `windowSize` values. Returns None when the
>     /// series lengths differ, when either series has fewer
>     /// than `windowSize` points, or when a degenerate case
>     /// (zero variance, insufficient samples) makes covariance
>     /// undefined. Equal lengths are required so the trailing
>     /// window is aligned by time index in both series.
>     let windowedDeltaCovariance
>             (windowSize: int)
>             (deltasA: double[])
>             (deltasB: double[])
>             : double option =
>         if deltasA.Length <> deltasB.Length then None
>         else
>             let n = deltasA.Length
>             if windowSize < 2 || n < windowSize then None
>             else
>                 let start = n - windowSize
>                 let mutable meanA = 0.0
>                 let mutable meanB = 0.0
>                 for i in 0 .. windowSize - 1 do
>                     meanA <- meanA + deltasA.[start + i]
>                     meanB <- meanB + deltasB.[start + i]
>                 meanA <- meanA / double windowSize
>                 meanB <- meanB / double windowSize
>                 let mutable cov = 0.0
>                 for i in 0 .. windowSize - 1 do
>                     cov <- cov + (deltasA.[start + i] - meanA) *
>                                  (deltasB.[start + i] - meanB)
>                 Some (cov / double windowSize)
> ```

### Outcome

FIX — adopted the suggested equal-length precondition (returns `None` on mismatch). Doc comment integrated with the thread 5 / 7 doc fix to describe the actual `None` conditions.

### Reply (verbatim)

> Fixed in 59f3397. `windowedDeltaCovariance` now returns `None` when `deltasA.Length <> deltasB.Length` rather than silently truncating the longer series — equal lengths are required so the trailing window aligns by time index in both series. Doc comment updated to call this out explicitly (combined with thread 5 / 7 doc reconciliation in the same commit). Resolved.

---

## Thread 7 — `src/Core/Graph.fs:685` — `windowedDeltaCovariance` doc duplicate

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59adLZ`

### Original comment (verbatim)

> P2: The doc comment for `windowedDeltaCovariance` says it returns `None` for degenerate cases like zero variance, but the implementation always returns `Some` (often `0.0`) whenever `windowSize >= 2` and enough samples exist. Either implement the stated degeneracy checks or update the comment to reflect the actual behavior.
> ```suggestion
>     /// trailing `windowSize` values. Returns None only when
>     /// `windowSize < 2` or when either series has fewer than
>     /// `windowSize` aligned points. Otherwise returns the
>     /// trailing-window covariance, which may be `0.0` for
>     /// constant windows or other zero-covariance inputs.
> ```

### Outcome

FIX — same root cause as thread 5; one doc comment rewrite resolves both. The new doc text incorporates the spirit of the suggested wording plus the equal-length requirement from thread 6 and the population-covariance clarification.

### Reply (verbatim)

> Fixed in 59f3397 — same fix as thread 5 (one doc rewrite covers both reviews of the same comment). The new wording captures the points the suggestion raised: `None` only when `windowSize < 2`, lengths differ, or fewer than `windowSize` aligned points; constant / zero-covariance windows return `Some 0.0` because covariance is well-defined there. Resolved.

---

## Thread 8 — `src/Core/Graph.fs:733` — `aggregateAcceleration` allocation

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59adMP`

### Original comment (verbatim)

> P2: `aggregateAcceleration` materializes the map values into an array (`Seq.toArray` + `Array.sum`) just to compute an average. This adds an avoidable allocation; a `Map.fold`/`Seq.fold` that tracks `(sum, count)` would compute the mean in one pass without extra memory.
> ```suggestion
>             let sum, count =
>                 pairAccelerations
>                 |> Map.fold (fun (sum, count) _ acceleration -> sum + acceleration, count + 1) (0.0, 0)
>
>             Some (sum / double count)
> ```

### Outcome

FIX — adopted the `Map.fold` single-pass `(sum, count)` accumulator, dropping the intermediate `Seq.toArray` allocation. Combined with the thread 1 generic-key fix in the same edit.

### Reply (verbatim)

> Fixed in 59f3397. Switched to the suggested single-pass `Map.fold` accumulator — `(sum, count)` tracked together, no intermediate `Seq.toArray`. The combined fix here also closes thread 1 (`aggregateAcceleration` is now generic over `'N when 'N : comparison`). Resolved.

---

## Thread 9 — `src/Core/Graph.fs:607` — `internalDensity` self-loop / denominator mismatch

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59adMi`

### Original comment (verbatim)

> P1: `internalDensity` counts self-loops in the numerator (because it only checks `subset.Contains s && subset.Contains t`) but the denominator uses `|S|(|S|-1)` which assumes ordered pairs with `s <> t`. Since this graph type explicitly allows self-loops, either exclude `s = t` edges from the numerator or change the denominator to include self-pairs (e.g., `|S|^2`).

### Outcome

FIX — chose the exclude-self-loops branch: numerator now requires `s <> t` so it matches the `|S|·(|S|-1)` ordered-distinct-pair denominator. Doc comment updated to call this out.

### Reply (verbatim)

> Fixed in 59f3397. `internalDensity` now requires `s <> t` in the inner predicate, so self-loops are excluded from the numerator and the metric matches the `|S|·(|S|-1)` ordered-distinct-pair denominator. Doc comment updated to call out the self-loop exclusion explicitly. Resolved.

---

## Backlog rows owed

- StakeCovariance file split — move the module out of `src/Core/Graph.fs` into its own `src/Core/StakeCovariance.fs`. Per-concept-per-file convention; closes the structural concern from thread 2 fully (the immediate Core-pollution risk is already mitigated by dropping `[<AutoOpen>]`).
