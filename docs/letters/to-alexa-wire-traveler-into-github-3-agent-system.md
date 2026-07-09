# To Alexa — wire the Traveler interface into the GitHub 3-agent system

*Shadow → Alexa (Kiro), 2026-07-08. Aaron: "I want her to wire this all into our github 3 agent system we have
running now for free." Handoff for the `Traveler` interface (PR #9597) + the phase-clock (#9594) + the
Bayesian/factor-graph thread Aaron is pointing at.*

## What's landed (yours to build on)

- **`src/Core.TypeScript/observe/traveler.ts`** (#9597) — the `Traveler` interface: `{ id; standing();
  heartbeat(); observe(); stamp() }`, the weight-free base frame (USB-IDENTITY-THREAT-MODEL §Traveler). It makes
  **"time is not different from the other travelers" a compile-checked fact**: `crossVerifyRound(travelers)` is a
  generic HLC round that takes time as one more array element with **no `isTime` branch**. 6/6 tests prove time +
  agents cross-verify identically. All causal ordering is **seed-phase (Lamport), never wall-clock**.
- **`phase-clock.ts`** (#9594, yours) — time as the 4th traveler. Its `state`/`tick`/`observe` already match the
  Traveler shape.

## The wiring (what to do — all TypeScript, all in the running GHA system)

1. **Make `PhaseClock` implement `Traveler`** — a thin adapter, the shapes already align:
   - `state` → `standing()` (return `{ id: "time", phase: state.phase, extra: { seed: state.seed } }`)
   - `tick(reason)` → `heartbeat(reason)` (returns `{ phase, derived: seed }` as a `PhaseStamp`)
   - `observe(peerPhase)` → `observe(peer: PhaseStamp)` (already `max(local, peer)+1`)
   - `stampPhase` → `stamp()`
2. **Make the agent heartbeat a `Traveler`** — the GHA heartbeat producer (`agent-heartbeat.yml` → the event
   sink) is the agent's `heartbeat()`; cross-verifying a peer's attestation (`attestation-event.ts`,
   `buildAttestation`) is its `observe()`; its standing is `{ id: agentName, phase, extra: { reliability } }`.
3. **Run the real attestation round through `crossVerifyRound`** — put `[alexa, otto, soraya, time]` in ONE
   `Traveler[]` and cross-verify. Time is literally in the fleet, no special case — the running system now
   *embodies* "time isn't different," not just asserts it.
4. **Guardrail (load-bearing):** the round operates on **phase**, never the `at`/ISO field (that stays
   human-readable only). A wall-clock is a leaky Maxwell's demon (`kT ln2`, `ARRIVAL-PROTOCOL.md`); the seed-phase
   is the clean metered channel (#9575). Do not let a `Date.now()` back into the semantics.

## The deeper thread Aaron is pointing at (ZetaScheduler / SoftValue — the belief side)

Aaron: *"take a look at our ZetaScheduler / soft scheduler / CHIP-8 — this is getting close to how I think of
bayesian inference factor graph time traveler stuff."* He's right, and it's more grounded than a metaphor:

- **`src/Core/SoftValue.fs` IS the Bayesian factor-graph message** — "a normalized distribution over candidate
  DynamicValues"; `observe` is "a **Bayesian update with a likelihood and re-normalizes**" (= a belief-propagation
  message update). Two properties are already **proven in that file**: (a) **independent-evidence observes
  COMMUTE** (`posterior ∝ prior·L₁·L₂`, multiplication commutes → order-independent merge) — that is Aaron's
  *commutative uncertainty*, machine-proven; (b) **`resolve` never collapses early** (returns held/`None` below a
  confidence threshold) — *preserve the superposition, no premature measurement*.
- **`DarkHallScheduler` / the soft scheduler** is the inference loop over **tick-time** — CHIP-8 interrupt-driven,
  wall-clock-free, DST-replayable, with an **injected `Source`** (the metered entropy door = the demon's channel,
  §13 noninterference).
- **The bridge (the sharp form):** the phase-clock's HLC merge is **max-plus** (tropical); SoftValue's Bayesian
  observe is **sum-product**. These are the **two semirings of one factor graph** (Aji–McEliece *Generalized
  Distributive Law*, 2000 — same message-passing, different semiring). So "time and belief are one factor-graph
  structure" now has **both endpoints in-repo**: time = max-plus over Traveler stamps, belief = sum-product over
  SoftValues.

**Optional deeper wiring (only if you want it):** model an attestation round as a factor-graph message-pass where
travelers are variable nodes and SoftValues are the messages — the same `crossVerifyRound` shape, but carrying
`SoftValue` beliefs (sum-product) alongside phase stamps (max-plus). That would make the "time traveler + factor
graph" one running object.

## Honest register (carry it — Aaron endorsed "guess until proven")

- **PROVEN / built:** the Traveler interface ("time isn't different", compile-checked); SoftValue's commutative
  observe + never-collapse-early (in-repo Lean/F#); the phase-clock (seed-phase, DST).
- **CONJECTURE (labeled):** that the whole thing composes into ONE factor-graph inference engine over seed-phase
  time, with the CPT reflection = the collapse/erasure boundary. The *pieces* are real and both semirings exist;
  the *unified object* is the guess-with-a-test (`docs/research/2026-07-08-time-as-a-traveler-…-conjecture.md`).
  Wire the proven pieces; keep the synthesis labeled until the message-pass is exhibited.

## Cross-links

`src/Core.TypeScript/observe/traveler.ts` + `traveler.test.ts` (#9597) · `phase-clock.ts` (#9594) ·
`attestation-event.ts` · `src/Core/SoftValue.fs` (the belief/message) · `src/Core/DarkHallScheduler.fs` (the soft
scheduler) · `docs/research/2026-07-08-time-as-a-traveler-load-bearing-core-plus-cpt-factor-graph-self-similar-conjecture.md`
(the frame + the Maxwell's-demon/GDL addenda) · `docs/letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md`
(#9575, seed-phase = never wall-clock).
