# Gossip and the ferry throttle are one primitive: throttled scale-free fan-out — deterministic gossip via DoP=1

> Aaron, 2026-07-11 (shadow\*): *"gossip is our ferry throttler … save this."*
>
> Metering note (this one passes): banked **because it has engineering payoff** (deterministic gossip via
> DoP=1), not because it's a resonance. The −1 is kept: same *primitive*, different *operations* (duals,
> not identical).

## The shared primitive

Both the **ferry throttler** (the DoP-knobbed queue+ferries concurrency abstraction — Itron
`Threading.Tasks.Throttling`; [[async-all-the-way-truthful-signatures]]) and a **gossip / epidemic
protocol** are the *same irreducible primitive*:

> **A throttled, scale-free fan-out with a degree-of-parallelism knob that degrades to 1 (deterministic)
> and scales to N.**

| | Ferry throttler | Gossip protocol |
|---|---|---|
| Payload | **work** items | **information** (reputation / state) |
| Fan-out targets | processors (ferries) | peers |
| The knob | **DoP** (concurrent ferries) | **fanout** (peers per round) |
| Knob=1 | single cooperative loop — deterministic, DST-replayable | slow, deterministic, ordered dissemination |
| Knob=N | N ferries draining the queue | epidemic ≈log(N)-round saturation |
| Bounded by | queue size | round interval / fanout cap |

Same knob, same 1→N scale-free shape, same degrades-to-deterministic property — **different payload**
(work vs. reputation). This is the only-the-irreducible-is-primitive thesis realized: the concurrency
system and the reputation system share *one generator* (the throttled fan-out).

## The payoff: deterministic gossip via DoP=1

Because they are one primitive, **gossip runs *on* the ferry throttler** — same code, payload = reputation
instead of work-items. And that hands you the thing epidemic protocols famously lack:

- Gossip is **notoriously hard to test** — nondeterministic timing, probabilistic convergence.
- Run reputation-gossip on the ferry throttle at **DoP=1** → **DST-replayable deterministic gossip**: the
  predator-warning propagation replays *identically from the same seed*, fully testable.
- Dial **DoP=N** for production epidemic spread — *same code path, no special cases.*

This is **beautiful-on-1, scales-to-N** (the async-all-the-way / manifesto §1 thesis) applied to reputation
dissemination. Deterministic gossip is a real prize; this is how you get it — reputation-gossip is just the
ferry throttle with *peers* as the fan-out targets and a *round-interval* as the throttle.

## The −1 (metered — dual, not identical)

Same **primitive**, different **operation** — they are *duals*, not the same component:

- The ferry **pulls** work from a bounded queue and *processes* it (consumer-side; back-pressure = queue
  full).
- Gossip **pushes** state to peers and *disseminates* it (peer-side; back-pressure = round interval /
  fanout cap).

The payoff is that they *share the throttle primitive*, not that gossip *is* the ferry. Same generator,
two instantiations. Collapse the distinction and you'd mis-wire a pull-queue where a push-fanout is needed
(or vice versa). Keep it and you get: **one throttle abstraction, two uses** — process work, spread
reputation — both DoP-knobbed, both deterministic at 1, both scaling to N.

## Ties

- Reputation payload = the gossip-reputation protocol whose *guards are its spec* (#9756/#9757:
  accuracy/Byzantine, Z-set retraction, protection-orientation, anti-Sybil). Those guards ride on top of
  this transport primitive.
- DoP=1 determinism = the DST discipline (manifesto §7; [[dv2-data-split-discipline-activated]] #4) — now
  extended to reputation dissemination, which was previously an untestable epidemic.

## Anchors (Beacon)

- **In-repo:** the ferry throttle / DoP knob ([[async-all-the-way-truthful-signatures]] — Itron
  `IThrottler`/`MaxDegreeOfParallelism`); gossip-reputation guards (#9756/#9757); DST/beautiful-on-1
  (manifesto §1/§7); only-the-irreducible-is-primitive (the shared generator).
- **Prior art:** Demers et al. 1987 (epidemic algorithms — gossip fanout as the spread knob); TPL Dataflow
  `ActionBlock` `MaxDegreeOfParallelism` / `SemaphoreSlim`-gated throttling (the ferry impls); FoundationDB
  deterministic simulation (the DoP=1 single-loop reference standard).

*Recorded by the shadow, 2026-07-11, at Aaron's "gossip is our ferry throttler — save this." Both are the
same irreducible primitive — a throttled scale-free fan-out with a DoP/fanout knob (deterministic at 1,
epidemic at N). So gossip runs ON the ferry throttle: DoP=1 yields DST-replayable DETERMINISTIC gossip
(the thing epidemic protocols lack), DoP=N yields production spread, same code path. Kept −1: same
primitive, different operation (ferry pulls+processes; gossip pushes+disseminates) — duals sharing the
throttle, not identical. Metered as passing because of the engineering payoff, not the resonance.*
