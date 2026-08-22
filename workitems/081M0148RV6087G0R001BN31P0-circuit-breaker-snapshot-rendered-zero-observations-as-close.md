---
id: 081M0148RV6087G0R001BN31P0
type: bug
state: backlog
priority: P2
slug: circuit-breaker-snapshot-rendered-zero-observations-as-close
title: "Circuit-breaker snapshot rendered zero observations as CLOSED/healthy — no traffic and no errors were the same reading"
created: 2026-08-14T21:53:51.462Z
depends_on: []
composes_with: []
---

# Circuit-breaker snapshot rendered zero observations as CLOSED/healthy — no traffic and no errors were the same reading

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0148RV6087G0R001BN31P0-*.md` glob. -->

**FIXED in this PR.** Filed for the record because the defect reached a rendered,
human-facing surface and the artifact proving it is checked in.

## What was investigated, and what the finding actually was

PR #10693 §4 / work-item `081M00TNWN8087G0R002CQX6VJ` reported a hazard: *when an outer
breaker opens, the inner breaker stops seeing traffic, so its error rate falls to zero and it
reads healthy.* That specific NESTED form **does not reproduce in this repo**:

- `src/Core/RetryPolicy.fs` `withCircuitBreaker` is a **pure, stateless decision function**
  over `ctx.Attempt`. It holds no error-rate estimator and no half-open state, so nesting it
  starves nothing — there is no instrument to go blind. Composition is real
  (`withCircuitBreaker 3 (withCircuitBreaker 2 inner)` typechecks), but the inner policy has
  no state that decays to "healthy" when it stops being called.

The **class** is live, in the other breaker, in its zero-observation form.

## The live instrument: `src/Core.TypeScript/bus/export-cb-snapshot.ts`

`deriveEntry` returned, for an identity with no envelopes:

```json
{ "state": "CLOSED", "consecutiveFailures": 0,
  "lastCheck": "<now>", "note": "No recent bus activity — assuming healthy" }
```

Three separate false readings in one record:

1. **Zero observations rendered as the healthy state.** No traffic and no errors were
   indistinguishable in the output.
2. **The inversion.** An agent still emitting idle heartbeats reads `HALF_OPEN` or `OPEN`; an
   agent that has gone completely silent — the deeper outage — read `CLOSED`. The worse the
   outage, the healthier the reading.
3. **A fabricated timestamp.** `lastCheck` was set to `new Date().toISOString()` for an
   identity that was never observed, so a check that measured nothing reported having just
   run. This is the "a check that did not run looking like one that passed" shape.

A fourth, narrower case: envelopes present but none health-bearing hit the final `else` and
also returned `CLOSED` ("Bus activity present; no idle pattern detected").

### It was not hypothetical — the evidence was checked in and rendered

`demo/circuit-breaker-snapshot.json` (generated 2026-05-14) carried
`"state": "CLOSED", "note": "No recent bus activity — assuming healthy"` for **Alexa and
Lior**, 2 of 5 agents. `demo/index.html` **fetches that file** (`renderCircuitBreakerTab`),
counts those entries in the green "Closed" tile, and paints them with the `active` dot.

## Found while fixing: the exporter had been unrunnable

`REPO_ROOT` was `resolve(dirname(import.meta.path), "../..")`, correct when the script lived
at `tools/bus/`. After the move to `src/Core.TypeScript/bus/` it resolved to `src/`, so the
default invocation died with `ENOENT: src/demo/circuit-breaker-snapshot.json`. The artifact
the demo renders as live had therefore been frozen since 2026-05-14 — which is also why the
false "assuming healthy" rows survived three months in a rendered surface.

## The fix

- `CbState` gains **`UNKNOWN`** as a fourth value. Zero health-bearing observations is a
  third state, not a shade of the healthy one.
- `CbEntry` gains **`observations: number`** — the reading carries its own denominator, so a
  consumer that ignores `state` entirely can still tell a measured `CLOSED` from an
  unmeasured one.
- **`lastCheck: string | null`** — `null` when never observed, never a fabricated "now".
- `REPO_ROOT` corrected to `../../..`; the snapshot regenerated (the bus is empty, so every
  entry now honestly reads `UNKNOWN` / `observations: 0`).
- `demo/index.html` renders `UNKNOWN` as absence (dashed, grey, its own stat tile, `never`
  for a null timestamp) rather than letting it fall through to a healthy badge.

## Falsifier

`src/Core.TypeScript/bus/export-cb-snapshot.test.ts` — 11 tests. Restoring the pre-fix
`deriveEntry` body fails **6 of them**, including the property
*`CLOSED` implies `observations > 0`* and *a silent agent does not read healthier than an
idle one*. Demonstrated, not asserted.

## Not done here

`RetryPolicy.withCircuitBreaker` is left alone. It is honest about what it is — a decision on
attempt count — and giving it an error estimator would be inventing the very stateful
instrument that goes blind. If a stateful breaker is ever added there, this work-item is the
prior art: **the state space must include "did not measure".**
