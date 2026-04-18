# Zeta — an F# implementation of DBSP for .NET 10

**Zeta** is an F# implementation of [Database Stream Processing (DBSP)][paper]
— the algebra of streaming incremental view maintenance — targeting .NET 10
with near-zero per-operation allocations and a surface that feels native to
both F# and C#.

"DBSP" is the algorithm (Budiu et al., VLDB'23); "Zeta" is this library.
Academic references in docs, tests, and proofs stay as DBSP; product and API
references are Zeta. See [docs/NAMING.md](docs/NAMING.md) for the full split.

[paper]: https://arxiv.org/abs/2203.16684

## What DBSP is

DBSP defines a tiny, complete calculus for incremental computation over
changing relations. Three primitives — delay (`z^-1`), differentiation (`D`),
and integration (`I`) — together with lifting (`↑`) let you transform *any*
query `Q` into its incremental form `Q^Δ = D ∘ Q^↑ ∘ I`. Key identities:

- `I ∘ D = D ∘ I = id` (bijection on streams)
- `(Q1 ∘ Q2)^Δ = Q1^Δ ∘ Q2^Δ` (chain rule)
- Linear `Q`: `Q^Δ = Q` (trivial incrementalization)
- Bilinear `Q` (e.g. join): `(a ⋈ b)^Δ = Δa ⋈ Δb + z^-1(I(a)) ⋈ Δb + Δa ⋈ z^-1(I(b))`
- `distinct^Δ`: the paper's `H` function, work bounded by `|Δ|`

See `src/Dbsp.Core/Incremental.fs` for the implementation of these theorems
and `tests/Dbsp.Tests.FSharp/IncrementalTests.fs` for the equivalence proofs
as executable tests.

## Quick tour

```fsharp
open Dbsp.Core

let circuit = Circuit.create ()
let orders = circuit.ZSetInput<string * int64> ()

let totals =
    circuit.GroupBySum(
        orders.Stream,
        System.Func<_,_>(fst),
        System.Func<_,_>(snd))

let view = circuit.Output(circuit.IntegrateZSet totals)

orders.Send(ZSet.ofKeys [ "alice", 100L ; "bob", 50L ])
do! circuit.StepAsync ()

for e in view.Current do
    printfn "%A -> weight %d" e.Key e.Weight
```

And the same thing, C#-side:

```csharp
using Dbsp.Core;

var circuit = new Circuit();
var orders = circuit.ZSetInput<(string, long)>();

var totals = circuit.GroupBySum(orders.Stream,
    t => t.Item1,
    t => t.Item2);

var view = circuit.Output(circuit.IntegrateZSet(totals));

orders.Send(ZSetModule.ofKeys(new[] { ("alice", 100L), ("bob", 50L) }));
await circuit.StepAsync();

foreach (var e in view.Current)
    Console.WriteLine($"{e.Key} -> weight {e.Weight}");
```

## Performance design

| Pattern | Applied | Why |
|---|---|---|
| `ReadOnlySpan<T>` on hot loops | ✓ | JIT elides bounds checks, vectorizes |
| `ArrayPool<T>.Shared.Rent` / `Return` | ✓ | Scratch buffers never hit GC |
| `GC.AllocateUninitializedArray` | ✓ | Skip zero-init for blittable `T` |
| `ImmutableCollectionsMarshal.AsImmutableArray` | ✓ | One alloc per output; no double-copy |
| Struct `IComparer<T>` + `MemoryExtensions.Sort` | ✓ | Monomorphized sort, no delegate alloc |
| `CollectionsMarshal.GetValueRefOrAddDefault` | ✓ | One hash lookup instead of two |
| `IsReferenceOrContainsReferences<T>` | ✓ | JIT-constant-folded `clearArray` |
| `[<InlineIfLambda>]` + `let inline` | ✓ | Monomorphize lambda body at callsite |
| `[<Struct; IsReadOnly>]` everywhere | ✓ | Zero-copy cursors and handles |
| `Channel` / `ConcurrentQueue` for I/O | ✓ | Lock-free many-producer inputs |
| `backgroundTask` CE | ✓ | F#'s library-safe async (no SC capture) |
| `ValueTask.CompletedTask` sync path | ✓ | No state-machine alloc on sync ticks |

## Layout

```
src/Dbsp.Core/            F# core library
├── Algebra.fs            Weight (= int64) and helpers
├── Pool.fs               ArrayPool + exact-size allocation helpers
├── ZSet.fs               Z-set algebra — add, neg, map, filter, join, distinct
├── IndexedZSet.fs        Key-indexed Z-sets for efficient joins
├── Circuit.fs            Op / Stream / Circuit scheduler
├── Primitive.fs          z^-1, integrate, differentiate
├── Operators.fs          Linear/bilinear operators, extension methods
├── Handles.fs            Input/output handles (lock-free)
└── Incremental.fs        Q^Δ = D ∘ Q ∘ I transformation helpers
tests/Dbsp.Tests.FSharp/  F# tests — xUnit v3 + FsUnit + FsCheck
tests/Dbsp.Tests.CSharp/  C# tests — xUnit v3
bench/Dbsp.Benchmarks/    BenchmarkDotNet + MemoryDiagnoser
samples/Dbsp.Demo/        Working example
```

## Building and testing

```bash
dotnet build -c Release
dotnet test  -c Release
dotnet run --project samples/Dbsp.Demo -c Release
dotnet run --project bench/Dbsp.Benchmarks -c Release -- --filter "*"
```

## Running the F# static analyzers

Two analyzer packs are wired in: [G-Research.FSharp.Analyzers][gr] and
[Ionide.Analyzers][ia]. Run them via the
[FSharp.Analyzers.Build][fab] MSBuild target:

```bash
dotnet tool install --global fsharp-analyzers
dotnet msbuild src/Dbsp.Core/Dbsp.Core.fsproj \
  -t:AnalyzeFSharpProject \
  -p:Configuration=Release \
  -p:FSharpAnalyzersExeHost=
```

[gr]: https://github.com/G-Research/fsharp-analyzers
[ia]: https://github.com/ionide/ionide-analyzers
[fab]: https://github.com/ionide/FSharp.Analyzers.Build

## Acknowledgements

Zeta follows the algebra of Budiu, McSherry, Ryzhyk, and Tannen
(arXiv:2203.16684). The Rust reference implementation is
[Feldera](https://github.com/feldera/feldera); Zeta keeps the same
operator surface while leaning hard into .NET-native patterns — `ArrayPool`,
`Span<T>`, struct comparers, `CollectionsMarshal` — instead of mirroring
Rust's trace/spine machinery verbatim.
