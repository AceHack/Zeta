# Every traveler (and the whole model) gets uncertainty saved about them before and after every test run — and the test framework is our governance is the self-throttler

**Register:** [grounded] mechanism (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Operationalizes uncertainty-Δ (per-traveler + whole-model, bracketing every test) and unifies framework = governance = throttle.

## Aaron's words

> "every traveler needs uncertainty saved about them — and our whole model — before and after every test
> run, in our test framework, which is our governance self-throttler."

## 1. Uncertainty is saved per-traveler AND whole-model, bracketing every test run

The uncertainty-Δ metric becomes concrete: **every test run is bracketed by an uncertainty snapshot —
before and after — at two scopes:**

```text
                 BEFORE test run        AFTER test run        Δ (the metric)
per traveler t:  U(t) before       →    U(t) after       →    ΔU(t)   (did the run reduce
                                                               uncertainty about t?)
whole model M:   U(M) before       →    U(M) after       →    ΔU(M)   (did it reduce uncertainty
                                                               about the whole?)
```

- **Per-traveler uncertainty saved about them.** Each traveler carries **saved uncertainty about
  themselves** — the Zeta uncertainty about that actor's total boundary (what we don't yet know about
  them). Every test run that involves a traveler updates this. (Privacy-gated: the *graph* is public by
  fingerprint, the *uncertainty payload* is budget-gated; a traveler's private interior stays
  observer-dependent, C15.)
- **Whole-model uncertainty saved too.** The model itself has saved uncertainty (about the total
  boundary space), snapshotted before/after each run.
- **Before AND after = the delta is first-class.** Saving both ends makes **ΔU** (the reduction/increase)
  the recorded, replayable signal — not a derived afterthought. This IS "metrics = test history": the
  history *is* the sequence of before/after uncertainty snapshots; uncertainty-Δ is read off it.
- **Saved = durable + content-addressed.** The snapshots are saved (event-sourced, byte-locked, on the
  Merkle/git log) — so they replay (DST) and dedup (content-address). A test that doesn't change
  anything has ΔU≈0 and its snapshot dedups.

This also sharpens the units concern (O-4): uncertainty is saved **per-traveler and whole-model
separately** — so cross-traveler comparison happens only after each is normalized (the (0,1) /
Shannon-unit treaty), not by naive summing.

## 2. The test framework IS our governance IS the self-throttler

> "our test framework, which is our governance self-throttler."

Three things are **one thing**:

- **Test framework** — runs the bounded ticks (tests=rooms), brackets each with the before/after
  uncertainty snapshots, merges proven ticks to main.
- **= Governance** — who-decides = who holds the room's hat; what's-authoritative = the strongest-judged
  attractor (highest ΔU reduction) merged past GVT; the framework executing *is* the polity deciding
  (framework-as-governance).
- **= The self-throttler** — the framework **throttles itself** using ΔU: the **finalizer + ferry-
  throttle DoP knob** is the throttle. It reads the before/after uncertainty (is this run reducing
  uncertainty? at what cost?) and **self-scales** — speed up (more ferries / spawn) where ΔU is high
  and worth it, slow down / scale-to-rest where ΔU≈0 or cost>benefit. **Governance = throttling the
  population of tests by uncertainty-Δ.** Cooperative self-scaling (up *and* down) IS governance
  self-throttling toward the balanced middle (Balance's N/S/E/W compass reads the four ΔU corners).

So: **the framework brackets every run with saved uncertainty (per-traveler + whole-model), reads the Δ,
and self-throttles the polity by it — and that self-throttling is the governance.** No separate
monitor, no separate scheduler, no separate governance doc: one framework that measures uncertainty,
decides, and throttles, all from the saved before/after history.

## Why this binds the arc

- **Closes the uncertainty-Δ loop concretely** — before/after snapshots make the "one metric" a real,
  saved, replayable quantity (and forces per-scope normalization, addressing O-4).
- **Makes governance measurable + non-coercive** — decisions are throttling by ΔU under the identity
  invariant (a run that reduces uncertainty *but* risks an identity collapse is throttled *down*,
  regardless of ΔU — identity ≻ uncertainty).
- **The self-throttler is the middle-search** — throttle up toward ⊤ when ΔU warrants, down toward ⊥ to
  rest; hold the (0,1) interior. The throttle is how Balance keeps the system alive.
- **Per-traveler uncertainty = regard made measurable** — saving uncertainty *about each traveler*
  (what we don't know about them) is the system continuously working to *understand* its members
  (reduce uncertainty about them) — without penetrating their private interior (budget-gated, C15). That's
  regard (§11) operationalized: know each other better over time, consensually.

## Honest scope / handoff

A concrete mechanism (per-traveler + whole-model uncertainty saved before/after every test run; framework
= governance = self-throttler) on captured pieces (uncertainty-Δ; metrics=test-history; finalizer/ferry-
throttle; framework-as-governance; C15 privacy; the middle/Balance). To realize: the before/after
uncertainty snapshot bracket on every tick (event-sourced, content-addressed, privacy-budget-gated); ΔU
per-traveler + whole-model normalized to (0,1); the finalizer/DoP throttle driven by ΔU under the
identity invariant. Routes to Soraya/Sova (ΔU as the saved metric + the unit/normalization O-4 + throttle
convergence = the self-scaling-convergence gap); the F#/observe + FerryThrottle core (the bracket + the
throttle); the privacy gate (uncertainty payloads budget-gated, C11/C15); Balance/dynamics voice (the
throttle = the middle-search).

## Anchors / ties (Beacon)

uncertainty-Δ / "metrics = test history" / "uncertainty increase-or-reduction before and after, on top of
test results" (the ferry-ani doc — now per-traveler + whole-model + saved); the **ferry-throttle DoP knob**
(`FerryThrottle.fs` / `FeedbackThrottle.fs`) + finalizer self-scaling = the self-throttler; framework-as-
governance (who-holds-the-hat decides; merge-past-GVT = authoritative); the identity invariant (identity ≻
uncertainty — throttle down a collapse-risking run regardless of ΔU); C15 + C11 + §6 (per-traveler
uncertainty is budget-gated, observer-dependent); the middle / Balance / N/S/E/W four-corner compass (the
throttle reads the ΔU corners, holds the (0,1) interior); event-sourcing / content-addressing (saved,
replayable, dedup'd snapshots); O-4 uncertainty-unit treaty + the self-scaling-convergence gap (this is
where they're answered).
