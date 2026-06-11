# triggers/ — triggers (act-on-condition), at root

`triggers/` holds **triggers** — **act-on-condition** units: when a condition is met, an action fires. A
root-level folder. The trigger is the same shape everywhere in Zeta:

- **Cheat-Engine triggers** — Aaron's debugging praxis (conditional breakpoints / act-when-a-value-hits;
  "how I write triggers in Cheat Engine"). The lived origin of the primitive.
- **Finalizer `ReKick`** — the runtime trigger: a tick condition → merge-to-main → next wave
  (`FinalizerRuntime`). A trigger over git + Reticulum.
- **Zeta update trigger** — fires a Zeta/equipment update (see `updates/`): on a condition (new release,
  schedule, drift), trigger the update + re-kick.

A trigger is **idempotent + bounded** (shape A — terminates; no fork-bomb), DST-replayable (the condition +
action are pure/injected). Triggers compose with `updates/` (what they fire) and the finalizer (the engine).

## Pointers

- `updates/` — what update triggers fire.
- `src/Core/FinalizerRuntime.fs` (ReKick = the runtime trigger) · `FinalizerRuntimeLive.fs` (live triggers,
  gate-respecting). · The Cheat-Engine / antecedent-tracing capture (the trigger origin).
