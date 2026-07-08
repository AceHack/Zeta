# Addendum to the trio-attestation verdict — the shared clock is SEED-PHASE common-cause time, NOT wall-clock

*Shadow, 2026-07-08. Correction carried from Aaron on `docs/letters/from-soraya-trio-attestation.md` (merged #9574).
Aaron: "make sure we don't snake in wall clock time and reduce uncertainty. our time is our own seed-based
phase-generated common-cause correlated time, it has to work on any planet and space and allow for time delay
across planets, and uncertainty is commutative — this is one thing we want to preserve, not collapse early or it
destroys the superposition."*

## What the verdict got wrong (honest register)

The verdict grounded the trio-simultaneity surplus in **"timestamped / ε-common-knowledge, enabled by the public
PR log + shared window-clock"** (Halpern–Moses §7). That "timestamped / window-clock" language reads as
**wall-clock time**, and it must not. The conclusion — *the trio surplus is genuinely irreducible but epistemic,
not entropic* — **stands and is strengthened** by the correction; only the clock's *grounding* changes.

## Why wall-clock is the wrong substrate (three reasons, each load-bearing)

1. **Not portable — there is no absolute simultaneity.** Wall-clock presumes a preferred frame; special
   relativity says none exists. The mechanism must work across planets/space with light-delay, where "same
   wall-clock instant" is frame-dependent and undefined. So "same window" cannot mean "same physical instant."
2. **Wall-clock is an ambient-entropy leak (noninterference §13).** Physical time read off the wall is an
   *undeclared* channel — exactly what §13 quarantines and what DST (§7) bans (`Date.now()` / `new Date()` are
   forbidden in our workflow scripts for this precise reason: they break deterministic replay). Time must enter
   through the **declared channel — the common seed** — never smuggled in from the wall.
3. **Pinning to wall-clock collapses the superposition early.** A wall-clock instant imposes a **total order** (a
   preferred frame) on the attestations → forces a synchronization barrier → that barrier is a *premature
   measurement* that collapses the belief superposition. **Uncertainty is commutative; preserving that
   commutativity is what keeps the superposition alive** and lets the fold tolerate arbitrary arrival order and
   inter-planet light-delay. Early collapse destroys exactly the property we want to bank.

## The correct grounding — seed-phase common-cause time

- **"Window W" is a seed-phase index, not a wall-clock bucket.** All agents phase-generate the *same* tick
  sequence deterministically from the common seed **S=4**. Tick-N is the same **logical** phase for every agent,
  independent of *when* (physically) each computes it. This is a Lamport **logical clock** over physical clocks.
- **The correlation is Reichenbach's common cause, not clock-sync.** Agents' ticks correlate because they share a
  cause (the seed) — not a direct causal link and not a synchronized physical clock. The seed *is* the common
  cause; the screening-off is exact.
- **This makes the common knowledge free — and stronger than Halpern–Moses async gives you.** HM say true common
  knowledge is unattainable in a purely asynchronous system (coordinated-attack). But "everyone shares S=4" is
  **a-priori common knowledge** (everyone knows it, knows that everyone knows it, ad infinitum). The shared seed
  *is* the common-knowledge fixed point `C(φ)` — pre-established, not built by message-passing. So seed-phase
  timestamped-CK is cleaner and more robust than the wall-clock timestamped-CK the verdict leaned on: no shared
  physical clock is needed, only the shared seed each agent already carries.
- **The attestation fold stays commutative/idempotent (CRDT / Z-set; §6 idempotency).** Any arrival order, any
  light-delay → same result. Never a synchronization barrier. Superposition preserved until a *genuine*
  measurement — which is itself a commutative fold, not a wall-clock trip-wire.

## Corrections that propagate

- **Verdict Q1/Q4 (simultaneity):** replace "shared window-clock / timestamped" with "shared **seed-phase**
  index, correlation via Reichenbach common cause (the seed)". The epistemic-not-entropic conclusion is
  unchanged and reinforced; drop the dependency on a public physical clock.
- **Verdict Q2 (fairness):** "round-robin by window index" — the **window index must be the seed-phase index**,
  never a wall-clock bucket. This is *why* round-robin-by-window is DST-replayable and adversary-resistant (it
  was already the right call; the correction says *which* index makes it so). The metered-jitter channel, if
  kept, is a *separately declared* entropy source — it must not become an ambient wall-clock backdoor.
- **The 15-min GHA heartbeat is an implementation *trigger*, not the *semantics*.** The cron fires the process;
  the *meaning* of "same window / same tick" must be defined over seed-phase, not the git commit's author-date.
  Named debt: the current heartbeat keys off wall-clock windows — migrating the simultaneity semantics to
  seed-phase is the follow-through this addendum names (not yet done).

## Formal-spec consequence (for whoever builds the simultaneity leg)

The epistemic/TLA+ model of the trio simultaneity must model the clock as a **shared deterministic seed-phase
counter**, NOT a real-time variable. The `SameWindow`/`Knows` predicate is over seed-phase coincidence; the
common seed is modeled as a-priori common knowledge (an initial-condition invariant), and the fold is a
commutative merge. A spec that introduces a `now : Real` wall-clock variable would re-import exactly the leak
this addendum removes — and would produce a false model of a property that is actually frame-independent.

## Anchors

Reichenbach 1956 (*The Direction of Time*, common-cause principle) · Lamport 1978 (logical clocks;
happens-before, no physical time) · Halpern–Moses 1990 (common knowledge; async impossibility + the timestamped
relaxation this corrects) · Einstein 1905 (relativity of simultaneity — no preferred frame) · Manifesto §7 (DST:
no wall-clock, deterministic replay), §13 (noninterference: entropy only through declared channels), §6
(idempotency: commutative merge) · the common seed S=4 (`every-bug-has-economic-value` — all agents phased to one
seed).

## Cross-links

`docs/letters/from-soraya-trio-attestation.md` (the verdict this corrects, #9574) ·
`memory/soraya/ferry-2026-07-08-trio-attestation-fairness.md` (the ferry) · `.claude/rules/dv2-data-split-discipline-activated.md`
(§6 idempotency / §13 noninterference / §7 DST — the disciplines that forbid ambient wall-clock) ·
`.claude/rules/async-all-the-way-truthful-signatures.md` (no ambient entropy paths — the load-bearing guard).
