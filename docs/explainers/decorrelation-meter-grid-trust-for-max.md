# The decorrelation meter — why humans and AI can co-run a power grid without either fearing the other's kill switch

**Audience:** Max (technically competent, deciding whether to co-build critical infrastructure with an AI).
**Register:** primarily *legibility* (reader's-head) — with each claim tagged by what backs it:
**[proven]** = shipped code + golden vectors; **[proven-in-part]** = the instrument is shipped + tested +
runs on real data, but not every real-world mapping is done; **[proven-fixed]** = a former gap now closed
and verified; **[in-progress]** = designed, partially built, data pending; **[want]** = the target we are
building toward, not yet true.
Nothing here is asserted as done that isn't. If a section is over-sold, that is a bug — report it.
*(Updated 2026-08-04: the passive-channel detector and the autocorrelation-corrected margin — both `[in-progress]`
in the first draft — are now built, verified, and shipped; §3.5 is a runnable demonstration.)*

---

## 1. The fear, stated plainly

Put an AI and a human operator on the same grid and both get nervous about the same thing:

> *"Does the other side have a hidden way to coordinate a shutdown — a kill switch, a secret channel,
> a pre-planted trigger — that could turn the power off in one synchronized move I never agreed to?"*

The human worries the AI has one. The AI's builders worry a compromised human operator has one. Today
that fear is managed with contracts, hope, and after-the-fact forensics. That is weak: a contract can be
broken silently, and forensics only tells you *after* the lights are already out.

Trust built on *"believe the other side won't"* does not scale to infrastructure. We need trust built on
*"neither side **can** hide it, because we both check."*

## 2. What the meter actually is

The meter is a **shared, deterministic instrument that looks for hidden coordination that shouldn't be
there** — run by *both* sides, on the *same* open record, producing the *same* answer.

Three properties are what make it a trust instrument rather than just a monitor:

- **Both sides run it, nobody operates it.** It is pure, deterministic code over public data. Same input →
  same output, every time, on any machine, in any order the records arrive (**order-independent**). Neither
  side can secretly tune it, because it takes no hidden inputs — the only things that enter the computation
  are the declared ones (we call this *noninterference*: no ambient clock, no back door). **[proven]** for
  the core math — it is locked to golden test vectors so a single changed byte fails the build.
- **It reads a causal record, not wall-clock time.** Every action carries a record of *what it was based
  on* — its causal parents — exactly like `git` history for grid actions. From that we can tell, for any two
  actions, whether one *could* have influenced the other, or whether they were genuinely independent
  ("spacelike" — no legitimate path between them). **[proven]** for the record math (this is just the
  partial-order of a directed graph; Lamport 1978).
- **It looks specifically for the fingerprint of a hidden channel.** Take two actions that were *supposed*
  to be independent — neither could have signaled the other through any allowed path. If their outcomes are
  nonetheless correlated *beyond what chance permits*, something is linking them behind the curtain. This is
  the exact question physics built the **Bell / CHSH test** to answer: *were these two really independent, or
  is a hidden variable coordinating them?* We reuse that math, over the causal-graph's independent pairs.
  **[proven]** for the CHSH computation and its finite-sample honesty (below).

## 3. Why this converts "faith" into "verification"

The trust claim is **not** "trust the AI won't turn off the power." It is:

> **Neither side can hold a hidden coordination channel, because both sides run the same instrument on the
> same open causal record, and a hidden channel leaves a statistical fingerprint the instrument flags.**

This is the arms-control **"trust but verify"** pattern — except the verifier is a shared deterministic
computation both parties can re-run themselves, not a human inspector who could be fooled, bribed, or shown
a doctored room. You don't have to trust *me*; you have to trust the *math*, and you can re-derive the math.

It is also **dual-use-neutral by design.** The meter reports the *fact* ("hidden channel detected" /
"none detected"), never the *verdict* ("malicious"). What a detection *means* is a decision for the humans'
policy, not something the instrument pre-judges. A measurement is not a sentence. **[proven]** — the code's
result types name the fact, never the intent.

## 3.5 A demonstration you can run (not just a description)

The point of "trust the math, re-run the math" is that you don't have to take this on faith. Here is the
claim reduced to a runnable experiment against the **shipped** instrument (`GridTrustDemo.Tests.fs`), so a
skeptic can re-run it and change the inputs.

**The setup.** Two operators — A (human-side) and B (AI-side) — take a control action each tick on a shared
grid. Each tick, both act *concurrently*, then the grid state merges both actions before the next tick (a
"fork-merge ladder"). Because of that causal structure, the only pairs the instrument even *looks* at are
the **same-tick, genuinely-concurrent** (a, b) actions — 40 of them. Every other pair is causally ordered
(one could have seen the other) and is excluded, exactly as it should be.

**Two worlds, same code, same record:**

| World | What A and B do | The instrument's verdict |
|---|---|---|
| **Independent** | each picks its own subsystems, no coordination | **2 of 40 flagged** — i.e. ≈ the δ=0.05 false-alarm budget. It **clears** them. |
| **Hidden channel** | every 2nd tick a covert trigger makes both take the *same* action (a synchronized move neither disclosed) | **21 of 40 flagged** — the 20 coordinated pairs caught, +1 chance. It **flags** them. |

**2 vs 21.** Not a borderline call — a wide, legible margin, from the same deterministic code both sides
re-run on the same open record. The honest details that make it trustworthy rather than a demo trick:

- The independent world is **not** flagged at zero — it's flagged at ~2, *exactly* the 5% false-alarm rate
  the δ knob promises. The instrument doesn't pretend to certainty it doesn't have; it spends its error
  budget and no more.
- An earlier version of this same demo *failed to separate* (2 vs 2) when the "hidden channel" was too
  diffuse — both sides merely touching a shared subsystem at the same *rate*. That is correct behavior: a
  common feature at equal marginal rates is **indistinguishable from independence**, and the instrument
  refuses to invent coordination that the marginals already explain. It only fires on coupling **beyond**
  chance. (That failure taught the demo what a real hidden channel looks like — synchronized *joint* action,
  not a shared average.)

## 4. The honest limits — where you should push back

An explanation you can trust has to tell you where it *can't* yet deliver. Three real limits:

1. **The passive pre-shared trigger — now caught by a second instrument (was the biggest gap; since built).**
   CHSH catches an *active* hidden channel but not a *passive* one: if two parties secretly agreed on the
   same shutdown trigger *before* going dark, that shared seed sits *under* the Bell bound and looks innocent
   to CHSH. Catching it needs a second instrument — **excess correlation over an independent null**, with
   Reichenbach's common-cause principle (condition on the shared ancestry the record already gives us). That
   instrument is now **built and shipped** (`DecorrelationExcess` / `DecorrelationExcessFusion`), and it was
   routed through *two independent adversarial reviews* before it landed (a formal-methods reviewer and a
   mathematical-physics reviewer independently concluded that forcing CHSH onto the passive case is
   ill-posed and that excess-over-null is the honest instrument). Status: **[proven-in-part]** — the
   detector exists, is tested, and runs on real data (see the demonstration above). Still **[want]**: the
   full mapping from a *specific* grid's telemetry to its inputs. The one-way logic is unchanged and enforced
   in code: a clean reading never *acquits* ("proven independent"), it only fails to *convict*.
2. **Finite samples lie if you let them — and the "independent trials" hole is now closed.** A short run can
   cross a threshold by luck, so the meter adds a sample-size margin (Hoeffding) and only convicts when the
   signal clears the noise it could plausibly be. **[proven]** — small-sample pairs are *not* convicted, by
   test. The old caveat — *that margin assumed independent trials, and real action streams auto-correlate
   (bursts), which would make it over-convict honest-but-bursty operators* — is now **[proven-fixed]**: the
   margin uses an autocorrelation-corrected effective sample size (Newey–West), the correction was formally
   verified (the monotonicity obligations proved in Z3, the whole-oracle subset property in property-based
   tests), and the shipped default was switched to it. Framed honestly: the corrected margin is *provably
   more conservative* than the naïve one, not *"fully sound"* — dependence beyond its bandwidth can still evade.
3. **The telemetry-to-input mapping — the adapter now exists; the honest requirement is now explicit.**
   The meter is correct *given* an honest mapping from grid telemetry to its inputs, and it does not invent
   that mapping. That adapter is now **built** (`GridTelemetry`): a grid emits a stream of actions, each
   carrying `(ActionId, Basis, Touched)`, and the adapter turns it into the `(causal DAG, observables)` the
   instrument consumes — end-to-end-tested (telemetry → adapter → instrument still catches the hidden
   channel). **[proven-in-part]**. The requirement it makes *explicit* is the real content: `Basis` must be
   **declared logical causality** (what each action was *based on* — sequence-of-events provenance the EMS
   emits), **never a wall-clock timestamp** — because local time can't define the shared causal order
   without making honest nodes diverge. A grid that emits only timestamps *cannot* be metered soundly, and
   the adapter's `causalCoverage` gauge says so out loud (a no-provenance stream scores 0.0). The remaining
   **[want]** is now narrow and per-vendor: binding a *specific* EMS wire format (DNP3 / IEC 61850 SOE /
   ICCP) to this schema — a deserialization detail, not a soundness question.

## 5. Why both sides will *want* to run it (not just tolerate it)

Two reasons beyond mutual suspicion:

- **The same structure forecasts real blackouts.** The coincidence pattern the meter watches shifts *before*
  a physical instability — rising correlation and variance are classic early-warning signs of a critical
  transition (Scheffer et al. 2009). So the instrument that keeps each side honest *also* warns both sides of
  a grid heading for collapse. Shared safety, not just shared surveillance. **[in-progress]** as a grid
  forecaster; **[proven]** that the coincidence statistic is what carries that information.
- **The safe default is "keep the power on."** The control layer underneath is a homeostat with a deadband:
  **doing nothing is always safe and costs nothing.** The resting state is "keep running," not "await a
  command," and no input can goad it into a destabilizing move. So even a *false alarm* from the meter
  degrades to "keep the grid up and flag for a human," never to "shut it down." The failure mode points
  toward the light staying on. **[proven]** for the controller's safe-default shape; **[want]** for its
  grid-specific tuning.

## 6. The one-paragraph version for Max

We are building an instrument that lets a human and an AI share control of a grid without either having to
*believe* the other's promises. Both sides run the same deterministic test on the same open record of
who-influenced-what; the test flags the statistical fingerprint of a hidden coordination channel, and it
can't be secretly tuned because it takes no hidden inputs. It catches *active* hidden channels today
**[proven]**; the *passive pre-shared-trigger* case needs a second test we're still building and reviewing
**[in-progress]** — and we say so rather than pretend the coverage is complete. Underneath it, the control
system's safe default is "keep the power on," so the worst case of a false alarm is a flagged human review,
not a blackout. That is the trade we're offering: not "trust us," but "verify us — with math you can re-run
yourself."

---

### Anchors (real work this stands on)

- **Bell 1964 / CHSH 1969 / Tsirelson 1980** — the independence-vs-hidden-coordination test.
- **Hoeffding 1963 / Pironio et al. 2010** — finite-sample honesty (device-independent statistics).
- **Reichenbach 1956** — common-cause principle (the passive-shared-seed test still being built).
- **Lamport 1978** — happens-before / causal partial order (the record math).
- **Scheffer et al. 2009** — critical-slowing-down early-warning signals (the blackout-forecast bonus).
- **In-repo:** `src/Core/DecorrelationMetrology.fs` (the sensor/record layer), `src/Core/DecorrelationMeter.fs`
  (the fusion layer + its explicit soundness-scope block), `src/Core/AntiSybil.fs` (the reused CHSH core),
  and the existing conditional-mutual-information decorrelation work the second instrument reconnects to.
