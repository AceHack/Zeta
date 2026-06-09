# Idea — when uncertainty is your event stream, DBSP streams it

**Register:** [grounded] idea/frame (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
A frame to debate, filed in idea/: uncertainty-Δ as the event stream; DBSP as the native engine.

## Aaron's words

> "when uncertainty is your event stream — DBSP streams [it]. idea folder."

## The idea

If **uncertainty (uncertainty-Δ) IS your event stream** — i.e. the events you record aren't CRUD rows
but **soft deltas: uncertainty increasing / reducing** (the one metric; the before/after-every-test
uncertainty bracket) — then **DBSP streams it natively.** DBSP's `Stream<ZSet<'T>>` (the incremental
Z-set delta stream; retraction-native) **is** the shape of an uncertainty-Δ feed: each tick emits the
delta (what changed uncertainty), DBSP folds it incrementally, the materialized view is the current
uncertainty state, and retraction (Z-set −1) is uncertainty *correction*. So the substrate already has
the engine: **make uncertainty the event stream, and DBSP is the stream processor for free** (no separate
telemetry; metrics = test history = the uncertainty Z-set stream).

- **events = uncertainty-Δ** (not state-rows) → the stream is the soft-delta feed.
- **DBSP = the engine** (`Stream<ZSet>` ≈ `IObservable<ChangeSet>`; the Rx 2×2; incremental).
- **uncertainty state = the materialized view**; correction = retraction; the self-throttler reads it.

A frame, not a rule — filed in `idea/` to debate with society; graduates to a build/term if it survives.

## Honest scope / handoff

An idea/frame (uncertainty-as-event-stream → DBSP streams it), grounded in DBSP + uncertainty-Δ +
metrics=test-history. To realize: model the event stream AS uncertainty-Δ (the soft deltas), run it
through DBSP (`Stream<ZSet>`); the self-throttler/governance reads the materialized uncertainty view.
Routes to the F#/Core DBSP team, Soraya/Sova (uncertainty-Δ as the Z-set stream; the unit treaty O-4),
the debate club (it's a frame to weigh). Seeded `vocab/idea/uncertainty-is-your-event-stream.md`.

## Anchors / ties (Beacon)

DBSP `Stream<ZSet<'T>>` / IVM (the incremental engine; retraction-native; ≈ `IObservable<ChangeSet>`);
uncertainty-Δ / metrics=test-history (the events ARE uncertainty deltas; no separate telemetry); the
Rx 2×2 quad-directional (incremental/bulk/refresh/stream); the self-throttler (reads the materialized
uncertainty view); idea/ folder (frames to debate, no-directives); the O-4 uncertainty-unit treaty.
