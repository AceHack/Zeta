# F# research experiments

Source-owned, bounded experiments compiled into the F# test executable. They are not
part of the database runtime assembly.

## Chronological rendered-signal prediction

The [registered beacon experiment](../../docs/research/2026-09-06-rendered-signal-predictor-protocol.md)
freezes a source-owned CHIP-8 frame boundary, lag-two sequence law, learned
and count-based controls, rendering nuisances, independent replay and cost
receipts before measurement. This is a passive prediction experiment;
no action return or ARC policy promotion follows from it.

The [measured result](../../docs/research/2026-09-06-rendered-signal-predictor-results.md)
retains all seeds and independent replay. Every RNN beats bigram but fails
the frozen improvement criterion against order-two; the simpler control
remains the next acting-carrier candidate. The report indexes complete
prediction/detection/cost receipts, the verdict and its admission-repair witness.

## Simplex belief comparison

See [the report](../../docs/research/2026-09-06-simplex-wset-comparison-and-stack-verdicts.md)
for assumptions, measurements, negative controls, and claims not established.

```sh
dotnet build src/Core/Core.fsproj -c Release
dotnet fsi --warnaserror src/Research.FSharp/run-simplex-belief-comparison.fsx
dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --filter FullyQualifiedName~SimplexBeliefComparison
```

Regenerate `simplex-belief-comparison.json` from the runner's stdout. The JSON is a
measured report, not an independent reference implementation. Exact predictions
are checked against dense propagation and separate closed-form predictors in code.

## Learned and factored predictive models

The [preregistered comparison](../../docs/research/2026-09-06-factored-predictive-protocol.md)
and [result report](../../docs/research/2026-09-06-factored-predictive-results.md)
cover observation-only HMM learning, matched binary64 inference, allocation
repair, likelihood-ratio change detection, and shared versus projected factors.
The report indexes all raw receipts, independent replays, and the permanent
archive tag preserving pre-measurement protocol and measured source versions.
