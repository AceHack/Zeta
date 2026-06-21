---
id: 081KRFA460008QG0R002DG8KPZ
priority: P1
status: open
title: "bg-services slice 5 — subscriber-agent architecture design pass (closes the foreground-optional architectural claim)"
tier: factory-infrastructure
effort: M
created: 2026-05-13
last_updated: 2026-05-13
depends_on: [081KR7JY10008QG0R000R503K2, 081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW]
composes_with: [081KR7JY10008QG0R0008NGW95, 081KRFA460008QG0R000CYBGKW]
tags: [multi-agent, background-service, bus, mechanization, subscriber-pattern, foreground-optional]
type: feature
---

# bg-services slice 5 — subscriber-agent architecture

## Origin

`tools/bg/README.md` (after PR #3040 landed 081KRFA460008QG0R00061SXRW slice 3) states:

> The architectural direction from PR #2998 was to make the foreground
> loop **OPTIONAL** by moving substrate-engineering work to durable
> background services. As of 2026-05-13, what has shipped is the
> **first reactive loops** for three failure-mode services:
>
> - detect → publish bus envelope
>
> Subscriber agents that react to those envelopes are **not yet
> shipped** (slice 5+). The current delivered surface does **NOT**
> make the foreground optional — these services **nudge**. They do
> not open PRs, claim backlog rows, perform decomposition, or land
> substrate on their own.

This row is the design-pass for slice 5 across all three services
(081KRFA460008QG0R001KC0VBH standing-by, 081KRFA460008QG0R00229616S backlog-ready, 081KRFA460008QG0R00061SXRW missed-substrate).
Closes the gap between "nudges land on the bus" and "subscriber
agents take action."

## The subscriber-pattern decision

There are three plausible architectures for the subscriber layer:

### Option A — One subscriber per topic

Three independent `tools/bg/<topic>-subscriber.ts` processes:

- `standing-by-subscriber.ts` reads `infinite-backlog-nudge`
- `backlog-ready-subscriber.ts` reads `work-assignment`
- `missed-substrate-subscriber.ts` reads `missed-substrate-cascade`

Each subscriber decides what action to take per envelope.

**Pro**: simple per-topic logic; failure isolation.
**Con**: 3 processes to monitor; duplicated bus-polling boilerplate.

### Option B — One unified subscriber daemon

Single `tools/bg/bus-subscriber.ts` polls all topics + dispatches
to per-topic handlers.

**Pro**: one process; reusable bus-polling logic; can implement
  cross-topic awareness (e.g., suppress `infinite-backlog-nudge`
  while reacting to a `work-assignment`).
**Con**: monolith; one-bug-kills-all-three failure mode.

### Option C — Bus-subscriber is a library; subscribers are short-lived

Library `tools/bus/subscribe.ts` exports `subscribeOnce(topic, handler)`.
Each cron tick (per surface) calls subscribeOnce; the cron IS the
subscriber-loop. No long-running subscriber daemon.

**Pro**: composes with existing cron infrastructure; no new
  long-running process; subscriber is just a regular agent action
  shaped like a function call.
**Con**: subscriber latency = cron tick latency (1min); bursty
  bus traffic gets batched per tick.

### Recommended: Option C

The cron sentinel is already the "agent attention" surface. Making
subscriber-handling a cron-tick function call:

1. **Composes with existing infrastructure** — no new launchd jobs,
   no new daemon process to monitor
2. **Surface-agnostic** — works on CLI, Desktop routine, 081KRFA460008QG0R000CYBGKW
   cloud routine; all 3 surfaces converge per
   `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh)
3. **Failure-isolated by design** — a buggy subscriber handler
   only breaks ONE tick, not a long-running daemon
4. **DST-compatible** — each tick's subscribe call is bounded;
   replayable

The subscriber-handler then runs in step 1 (refresh) of the per-tick
discipline: after `git fetch` + `gh poll-pr-gate`, also poll the bus
for envelopes targeted at the current surface. If envelopes present,
queue work into step 3 (pick speculative work).

## Acceptance criteria (design-pass)

- [ ] Library `tools/bus/subscribe.ts` exports `subscribeOnce(topic, handler)` that:
  - Reads the bus directory (honors `ZETA_BUS_DIR` env var; defaults to
    `/tmp/zeta-bus/` — same configurable convention the existing
    `tools/bus/bus.ts` + `tools/bus/claim.ts` already use, so production
    and tests inject the same way)
  - Filters envelopes by matching topic
  - Filters by `to` field (current surface OR `*`)
  - Calls handler(envelope) for each match
  - Marks-as-consumed via a `seen.json` file per surface in the same
    bus directory (prevents re-processing; honors `ZETA_BUS_DIR`)
- [ ] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce` for each of the three topics
- [ ] Per-topic handlers are STUBS in this slice — they log envelope
      to tick shard but take no action. Subsequent slices flesh out:
  - `infinite-backlog-nudge` handler → triggers decomposition or
    backlog grind (slice 5.1)
  - `work-assignment` handler → claim-and-implement an ambiguous
    item (slice 5.2)
  - `missed-substrate-cascade` handler → open recovery PR (slice 5.3)
- [ ] Tests cover `subscribeOnce` (DST-replayable with fake bus dir)
- [ ] Substrate-honest disclaimer in `tools/bg/README.md` updated:
      "subscribers consume envelopes but actions are STUB; slice 5.N
      flesh out per-topic behavior"

## Why design-pass first

Subscriber-agent behavior is the inflection point between
"foreground nudges" and "foreground optional". Wrong design here
cascades into wrong implementation across all three services. The
design-pass row separates the architectural decision (Option A/B/C)
from the implementation work (per-topic handlers).

Once Option C is adopted (or alternative chosen), three follow-up
rows track per-topic handler implementation:

- 081KRHWGX0008QG0R000TVGDGV — `infinite-backlog-nudge` handler (slice 5.1)
- 081KRHWGX0008QG0R001E9KEJ1 — `work-assignment` handler (slice 5.2)
- 081KRHWGX0008QG0R000JMEYBH — `missed-substrate-cascade` handler (slice 5.3)

(The original draft of this row reserved 081KRFA460008QG0R001QFS6EV/081KRFA460008QG0R00308W7FJ/081KRA5AR0008QG0R0029YWXYW;
those slots were subsequently allocated by the 2026-05-13 collision-
renumber cascade — 081KRFA460008QG0R001QFS6EV to the PM-2 getting-started guide,
081KRFA460008QG0R00308W7FJ to the duplicate-row-id substrate-cleanup, 081KRA5AR0008QG0R0029YWXYW to the
P2 contributor-compliance series. Reservations were aspirational,
not allocated; the slice-5 family is now scheduled at 081KRHWGX0008QG0R000TVGDGV+.)

## Substrate-honest framing

This row is a DESIGN-PASS, not implementation. The implementation
work is bigger than a single tick. The design-pass row itself is
substrate worth landing because:

1. The architectural decision (Option A/B/C) IS substrate; the
   wrong choice cascades into wrong implementation
2. The design rationale belongs in the row, not in a commit
   message buried under implementation
3. Future-Otto cold-booting can read the row + understand WHY
   Option C was chosen (or revise per
   `.claude/rules/future-self-not-bound.md`)

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — substrate)
- 081KRFA460008QG0R001KC0VBH (standing-by detector — publishes `infinite-backlog-nudge`)
- 081KRFA460008QG0R00229616S (backlog-ready notifier — publishes `work-assignment`)
- 081KRFA460008QG0R00061SXRW (missed-substrate cascade detector — publishes `missed-substrate-cascade`)
- 081KRFA460008QG0R000CYBGKW (cloud routines integration — composes with subscriber pattern)
- 081KR7JY10008QG0R0008NGW95 (Zeta shadow-mode CLI — the subscriber library could compose)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (canonical 7-step discipline — where subscriber-call lands in step 1)
- `.claude/rules/dont-ask-permission.md` (subscriber actions are within authority scope)
