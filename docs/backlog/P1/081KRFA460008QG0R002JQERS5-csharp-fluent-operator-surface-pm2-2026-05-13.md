---
id: 081KRFA460008QG0R002JQERS5
priority: P1
status: closed
title: "C# fluent operator surface — Map, Filter, Join, Distinct, Window via idiomatic CSharp API"
type: feature
origin: PM-2 gap-prediction pass (081KR2E4K0008QG0R003VB7ZZR) 2026-05-13
created: 2026-05-13
last_updated: 2026-05-14
closed: 2026-05-14
closed_by: "PR #3120"
depends_on: []
composes_with: [081KRFA460008QG0R001SXP0C2]
tags: [csharp, api-surface, fluent, operator, consumer-ux, dotnet]
---

# 081KRFA460008QG0R002JQERS5 — C# fluent operator surface

## PM-2 signal

The README states "a surface that feels native to both F# and C#."
Current state: `src/Core.CSharp/` contains exactly one file (`Variance.cs`)
— declaration-site variance shims. All operators (`Map`, `Filter`, `Join`,
`Distinct`, `GroupBy`, `Window`) require F# discriminated-union idioms.
The C# sample in `samples/FactoryDemo.Api.CSharp/` calls the F# surface directly.

## What

1. `ZetaCircuitBuilder<T>` — C# fluent class wrapping `Circuit` and `Op<'T>`
   so consumers can write:
   ```csharp
   var result = circuit
       .From(source)
       .Map(x => x.Name)
       .Filter(name => name.Length > 0)
       .Distinct();
   ```
2. Extension methods on `Op<ZSet<K>>` for common operators.
3. XML doc comments on all new public C# symbols (IntelliSense parity).
4. Rewrite `samples/FactoryDemo.Api.CSharp/` to use the new fluent API.

## Why now

The existing CSharp sample builds but uses raw F# discriminated unions,
which is non-idiomatic C#. The fluent API is the minimum viable C# surface
that makes the "native to both F# and C#" README claim true.

## Non-goals

- Does not change operator semantics.
- Does not rewrite the F# core.
- Does not need to cover every operator — the six core ones suffice for v1.

## Acceptance criteria

- [ ] `src/Core.CSharp/` contains fluent builder covering: Map, Filter, Join,
      GroupBy, Distinct, Window (sliding).
- [ ] `samples/FactoryDemo.Api.CSharp/` rewrites its circuit construction
      to use the new fluent API, not raw F# types.
- [ ] All public C# types have `<summary>` XML docs.
- [ ] `dotnet build -c Release` 0 warnings.
- [ ] New `tests/Core.CSharp.Tests/` tests cover the fluent API round-trips.

## Kill criteria

If Aurora / enterprise pitch explicitly targets F# only (no C# consumer),
defer to P2.
