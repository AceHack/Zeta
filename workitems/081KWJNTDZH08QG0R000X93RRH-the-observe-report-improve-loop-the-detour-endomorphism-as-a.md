---
id: 081KWJNTDZH08QG0R000X93RRH
type: task
state: backlog
priority: P2
slug: the-observe-report-improve-loop-the-detour-endomorphism-as-a
title: "The observe->report->improve loop: the detour endomorphism as a self-instrumentation cycle over our own runtime (Detour<'F>, DORA feed, finalizer meter, chip9-cart search) — mutual-empowerment oracle, never foreign software"
created: 2026-07-03T00:24:54.001Z
depends_on: []
composes_with: ["081KWJE90EZ08QG0R003YDAJJ6"]
---

# The observe->report->improve loop: the detour endomorphism as a self-instrumentation cycle over our own runtime (Detour<'F>, DORA feed, finalizer meter, chip9-cart search) — mutual-empowerment oracle, never foreign software

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWJNTDZH08QG0R000X93RRH-*.md` glob. -->

## Origin

Aaron 2026-07-02: pointed at Microsoft Detours as the anchor for the hook substrate, then framed
the intent — *"we don't want to crack anything, we want to observe and report and improve."* And the
motive, distinguishing it from the crack-for-economic-win posture: *"EMPRESS did for economic win,
I did for mutual empowerment."* This row is that loop, named.

## The loop

**observe -> report -> improve**, run over OUR OWN runtime — the Cheat-Engine method pointed inward:

- **observe** = `Detour.before` / `around` (find-what-writes over our own functions/VM ops).
- **report** = the observation sink feeds the DORA metric stream / the finalizer's uncertainty meter
  / the glass-halo ledger (noninterference: the sink is the one declared, metered channel).
- **improve** = `Detour.mapArg` / `mapResult` (or a fresh detour) deliberately transforms — banked
  as a `measure` (ΔU) per every-bug-has-economic-value.

The mechanism is `Detour<'F> = 'F -> 'F` (landed in `src/Core/Detour.fs`): one weight-free
endomorphism, every hook a composition, monoid under `compose`. **observe cannot alter behaviour**
(read-only by construction); only **improve** does, and its constructors are named so.

## Oracle boundary (load-bearing, not decoration)

The interception mechanism is dual-use and NEUTRAL (dual-use-detection-is-neutral-oracle-decides).
The oracle this loop attaches is **mutual empowerment over our own substrate** — observe/report/improve
on systems we own, for shared benefit (ALIGNMENT.md mutual-benefit register). Foreign / protected
software is OUT OF SCOPE, same boundary as `hooks/README.md` (our own processes, our own PKI). A
detour aimed at someone else's protection is a different oracle and not this work.

## Composition

- `src/Core/Detour.fs` — the endomorphism + observe/report/improve constructors (this row's mechanism).
- `hooks/README.md` — the Detours anchor + the .NET-runtime attach surface (ClrMD/Profiler/EventPipe).
- 081KWJE90EZ08QG0R003YDAJJ6 — chip9-cart captures: detour the VM's write/draw ops generically ->
  superdeterministic find-what-writes over cart-space (the search half of the same loop).
- DORA feed + `src/Core/FinalizerRuntime.fs` (the meter the report path posts to) + glass-halo.
- manifesto §13 noninterference (metered channels) · §6 consent-first (observing our own, transparently).

## Acceptance

A worked observe->report->improve cycle over a real Core function: a detour observes it, the
observation lands in the report ledger (DORA/finalizer), and an improve-detour transforms it, the
delta banked as a measure — all DST-replayable (deterministic sink), zero foreign-software surface.

## Falsifier

If "improve" cannot be expressed as a detour composition (needs ambient mutation / escapes the
metered channel), the endomorphism shape is too weak for the improve half — revisit; observe/report
alone would still stand.
