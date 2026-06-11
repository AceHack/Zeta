# spawn/ — the continuation ledger (run forever, five minutes at a time)

Aaron 2026-06-11: *"It can run forever — each loop has 5 minutes, but can schedule its own continuation
by committing to main before it's done, under `/spawn`."* / *"We can arrow-throttle-ferry it."*

## The rule

**No lap runs past its budget; no chain needs to end.** A `SimLoop` lap that hits a budget rail
(lap/tick/5-minute clock) emits a **continuation token** — and the runner COMMITS it to main under
`spawn/` *before* the lap closes. The next runner (any runner — scale-free) picks the token up,
**through the ferry throttle** (the arrow: spawn pickups ride the bounded queue with a DoP knob, so a
spawn storm cannot stampede the fleet), and runs the next lap. Infinity is reached by CHAINING finite
links, never by an unbounded run:

- each link **finite** (the SimLoop rails are unremovable by construction);
- each link **visible** (a commit on main = the heartbeat-via-commit discipline generalized — the
  chain's pulse IS the git log);
- each link **consented** (a chain continues only if a runner picks the token up; stopping a runaway =
  stop picking up — no kill switch needed, the chain simply isn't continued);
- each link **idempotent** (tokens are keyed by `<loop-id>` — re-committing a lap's token upserts;
  pickup-twice resumes the same state, applies-once by key).

```
spawn/<loop-id>.token     one live continuation (text, one line — the treaty register)
```

Format: `SimLoop.encodeContinuation` / `parseContinuation` (loop-id · next lap N · ticks spent ·
budget · the resume-state pointer — state itself lives in `saves/` as a recording, reference-not-copy).
Token consumed (deleted in the pickup commit) when its lap completes and either closes or re-spawns.

## Why this shape (the ζ-discipline, completed)

The no-infinity rule said: never RUN the infinity. This adds: **you may still HAVE the infinity** — as
a chain of measured, committed, finite laps, each lap's `mea` banked before its `cut`. The git log of
spawn commits is the analytic continuation: meaning assigned lap by lap, no Deep Thought run required.

## Pointers

- `src/Core/SimLoop.fs` — the bounded lap + `continueAfter`/`encodeContinuation` (the token mint).
- `saves/` — where a continuation's resume state lives (RecordedSource recording; reference-not-copy).
- `src/Core/FourCorner.fs` + the FerryThrottler — the arrow the pickups ride ("arrow throttle ferry").
- `.claude/rules/` heartbeat-via-commit — the discipline this generalizes; `tick-must-never-stop` —
  the autonomous loop is itself a spawn chain (this README names the pattern it already lives).
