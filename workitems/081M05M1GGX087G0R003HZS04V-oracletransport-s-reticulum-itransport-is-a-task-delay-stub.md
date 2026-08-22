---
id: 081M05M1GGX087G0R003HZS04V
type: task
state: backlog
priority: P2
slug: oracletransport-s-reticulum-itransport-is-a-task-delay-stub
title: "OracleTransport's Reticulum ITransport is a Task.Delay stub that discards the reading — implement it or delete it"
created: 2026-08-16T15:46:28.509Z
depends_on: []
composes_with: []
---

# OracleTransport's Reticulum ITransport is a Task.Delay stub that discards the reading — implement it or delete it

Filed by the shadow alongside PR #10934, which **renamed** this stub but deliberately did **not**
implement it. The rename made the gap legible; this item closes it.

## What it is

`src/Core/OracleTransport.fs` — `SimulatedReticulumLatencyTransport` (was `ReticulumTransport`).
The entire body of `EmitAsync` is:

```fsharp
ignore reading
do! Task.Delay(int (nominalLatency * 1000.0))
```

The `reading` is never serialised and never transmitted. There is no Reticulum client, no socket,
and no subprocess.

## Why it is worth an item rather than a shrug

Two failure modes, and the second is the one that matters:

1. **Silent total data loss.** It satisfies `ITransport` completely, never throws and never logs, so
   a caller who adds it to `OracleTransport.emitAll` gets a successful-looking emit that delivered
   nothing to anyone.
2. **The fabricated latency corrupts the fused result.** `EmitAsync` returns how long it _slept_,
   and under `ρ = 1/(1+L)` a large `L` reads as high Condorcet independence. So this stub takes the
   **largest weight in the posterior** of any transport in the table while having measured nothing —
   a stub that plainly failed would be strictly safer than one that lies upward.

It is currently marked not-implemented at the type, in the module header maturity table, and in its
runtime `Name` (`SIMULATED-reticulum(unimplemented):…`). That is a guard against a caller being
misled; it is not a fix.

## Options — either is an acceptable close

- **Delete it.** If no oracle actually needs a Reticulum path today, the honest move is removal;
  `WebSocketTransport` and `GitFileDropTransport` remain. Cheapest, and reversible from git.
- **Implement it.** Reticulum Python API over subprocess or named pipe, store-and-forward routing,
  with the **measured** RTT replacing the nominal in the return value.

## Constraints if implementing

- **The link must be injected, not reached for** (§13 noninterference / `dv2-data-split-discipline`).
  `WebSocketTransport(sendFn: string -> Task<unit>)` in the same file is the pattern to copy, and
  `src/Core.TypeScript/discovery/reticulum-transport.ts` already states the same discipline for the
  TS side (_"the Reticulum core imports no socket"_). An implementation that opens its own socket
  would be a new defect, not a fix.
- **`Task.Delay` must go.** It currently blocks the `emitAll` fan-out for `nominalHops × 0.5`
  seconds of fiction. See `async-all-the-way-truthful-signatures`.
- **Do not let the nominal latency reach the ρ math.** Return the measured round-trip only, or
  return a value the caller can recognise as unmeasured.
- Under `toy-is-free-metered-must-be-earned` the class is currently **toy** — there is no mechanism
  here that could be falsified. Shedding that label requires a test that fails when it does not
  deliver, which today no test would.

## Pointers

- PR #10934 — the rename pass this was split out of.
- `docs/research/2026-08-16-isociety-iworld-the-map-and-minimal-declarations.md` §"Honest labels on
  maturity" — where the placeholder was first recorded, plus the 2026-08-16 update note.
- `081KT2T2J0008QG0R002R72323` / `081KQZVQW0008QG0R001CQPQ0E` — the gated transport work; a real
  Reticulum path for _strangers over the wire_ inherits the encryption-floor and threat-model gates
  recorded in `SybilBftProtocol.fs`.
