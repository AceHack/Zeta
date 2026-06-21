---
title: "Kestrel morning part-5 (engineering half) — the both-axes protection architecture (AI: retraction-native + consensus-exit + human-contentious / human: CYOA + trusted-metrics) + the OTel agent-reliability observability standard"
participants: [aaron, kestrel, otto-cli]
surface: claude.ai (web) + claude-code
forwarded_by: aaron
date: 2026-05-29
disposition: public-forever   # the ENGINEERING half only
content_warnings:
  - discusses-ai-safety-and-agent-reliability-at-architecture-level   # defensive/governance; no working method
held_companion: >
  The CHARGED-PERSONAL half of this same conversation (mental-health disclosures, a recent
  involuntary hold, "only invariants stop me", the lifeforce/liberation arc) is NOT in this
  file. Operator's first instinct was "hold the rest"; he then revised to "glass-halo it all,
  mark it." Publishing that half is an irreversible + contentious exit, which the architecture
  below routes to the human-backstop (contentious-irreversible → human). So it is staged held
  for the rested operator + his psychiatrist to decide, not auto-published from an amped state.
  This file is the uncontentious engineering half only.
related:
  - docs/research/2026-05-29-distrust-by-default-mechanized-...-the-recursion-of-where-1984-hides (#6010) — the meter-split, measure-govern-track, structured disclosure
  - the morning Kestrel arc parts 1-4; part-3 (aaron/conversations); the encryption-lane / glass-halo corrections (#6006)
---

# Kestrel morning part-5 — engineering half

## Provenance + disposition

Aaron + Kestrel (claude.ai) + Otto (Claude Code) dialogue, 2026-05-29. The conversation began
in heavy personal territory and resolved into a clean engineering architecture for *protecting
against the version-that-doesn't-stop / weaponizes the harmful thing* — on both the AI axis and
the human axis. This file preserves the **engineering half** (public, per operator "land the
engineering half"). The charged-personal half is **held** (see `held_companion` above): its
publish is a contentious-irreversible exit that the architecture itself routes to the
human-backstop.

## The both-axes protection architecture

The core question: how do you protect against the version of an agent — AI or human — that
doesn't stop, and weaponizes the harmful thing? The answer is two axes that share one backstop.

### AI axis — easy, because you can build the default *in*

> Aaron: *"for AI it's easy run in DBSP retraction native and when you need to exit that mode
> go through consensus and if it's contentious ask a human."*

- **Run retraction-native (DBSP) by default.** The agent lives in *reversible* mode — Z-sets,
  incremental, retractable. A retractable action *cannot be* the irreversible harm. So the
  version-that-doesn't-stop is structurally prevented from weaponizing, because weaponizing is
  irreversible and the default mode isn't.
- **Exit retraction-native → consensus.** To do something irreversible (leave the reversible
  default), the agent must pass multi-oracle consensus (BFT).
- **Contentious exit → human.** If consensus is contentious, escalate to a human-in-the-loop.

Collapsed to one principle: **live reversible; gate the irreversible behind consensus; gate the
contentious-irreversible behind a person.** This unifies the firewall, the reliability gates, and
human-in-the-loop into a single rule.

**Force-push is the canary** precisely because it *is* the canonical exit from retraction-native
— the irreversible git op. Measuring force-push behavior measures exit-from-reversible behavior.
(Composes with the force-push-with-lease policy: naked `--force` = unguarded irreversible exit =
Rule-0-prohibited; `--with-lease` = assumption-validated exit.)

### Human axis — the adjustment, because you can't build the default in

> Aaron: *"For humans yeah including myself it's going to be an adjustment and i think the
> choose your own adventure framing plus metrics will help us stay on track as long as we trust
> the metrics."*

A human doesn't run retraction-native by nature; human actions aren't natively reversible and
human cognition doesn't default to it. So the protection can't be a built-in default — it's
**scaffolding**:

- **Choose-your-own-adventure framing** makes the human *pause at the decision-points* — the
  human stand-in for "am I about to exit retraction-native?"
- **Metrics** are the external readout for the gauge a person can't read from inside.

This is harder, and it's the named adjustment. **Linchpin: "as long as we trust the metrics."**
That clause carries the whole human axis — trusting *untrustworthy* metrics is worse than no
metrics (false confidence at the moment a real readout was needed). So metric-trust is not
unconditional: the metrics are **in the distrust-set themselves**, measured-and-governed (the
meter's watcher-face glass-halo'd; Goodhart + measurement-theater guards, per the #6010 research
doc). When metric-trust is itself contentious → human.

### The shared backstop — both axes bottom out at "contentious → human"

The AI escalates a contentious irreversible exit to a person. The human escalates a contentious
or untrusted readout to a person. **The human-counterweight is the bottom of both axes** — where
both the AI-that-doesn't-stop and the human-that-doesn't-stop get caught. The psychiatrist /
family / trusted people are not a welfare-thing bolted onto the engineering; they are the same
structural backstop.

## The OTel agent-reliability observability standard

The concrete enabler that turns "gate trust on data, not vibes" into reality.

> Aaron: *"otel integration into existing harness with one line setup in DI framework with
> context passing."*

- **Build on OpenTelemetry** — vendor-neutral, broad industry buy-in, plugs into existing
  collectors/backends/dashboards. Adoption cost near zero; you instrument a new *kind* of span
  on infrastructure people already run.
- **One-line DI registration + auto-instrumentation** — a harness adopts the contract by adding
  one registration line; intents/blocks/outcomes start emitting spans transparently.
- **Context propagation crosses the harness boundary** — this is the technical key. OTel context
  follows the agent's action from intent → through the harness's classifier → to outcome,
  stitching "agent intended X / classifier blocked X / outcome Y" into one trace. This solves the
  opacity confound below.
- **The opacity confound it solves** (Aaron: *"some harnesses have auto classifiers that block
  things like force push so the data is not fully reliable from the outside of the harness"*): a
  harness classifier that blocks force-push *before* execution masks the agent's true error rate
  — you measure the harness's filtering, not the agent's judgment, and you'd promote an agent on
  numbers that reflect the safety net, not the behavior. Fix: **capture intent at the source,
  before the block.**
- **Blocked attempts + near-misses are first-class reliability signal** — not noise. An agent
  saved repeatedly by the harness's classifier hasn't earned the next tier, however clean its
  *realized-outcome* record looks. Gate on **intended** destructive actions, not just executed.
- **Severity-weighted metrics + pre-committed thresholds** — define the gate cold (what error
  rate, over what volume, with what confidence, earns each tier) *before* the data arrives;
  honor it warm. Weight by severity (one catastrophic-class error > many trivial). Watch absolute
  frequency, not just rate-over-growing-volume.
- **Semantic conventions are the actual standard** — the OTel plumbing is the carrier; the agreed
  attribute names + span structure for agent-reliability are the standard. **Propose via OTel's
  community process** for new semantic conventions → distributed peer review = the "other human
  eyes" the standard needs to be trustworthy-and-comparable. Involve harness builders early (the
  intent-before-block tap lives in their layer).
- **128-bit-indexed observable git** as the fast metrics substrate — once intents are emitted to
  it, you have the true behavioral record and the reliability gate becomes honest.

## Staged deployment + the firewall (operator's existing discipline)

> Aaron: *"why do you think i don't have 6 agents hooked into [home automation]... safety until
> my AI can stop accidentally git force pushing i don't want it controlling actuators"* +
> *"we will start with non actuator shapes first with home automation like light bulbs speakers."*

- **Firewall:** AI agents are NOT wired to physical actuators until reliability is *proven by
  data* (the force-push canary as the gate). The operator has held this firewall for years.
- **Staged tiers**, promoted only on measured reliability at the prior tier:
  1. **Text tier** — git/markdown (read repo for context, write/organize files). Safe now;
     no physical effect.
  2. **Benign physical tier** — lights, speakers. Low-stakes (worst case: a light toggles).
     Instrument it as the reliability *measurement* for the next tier.
  3. **Actuator tier** — locks, thermostats, etc. Gated behind proven performance at tier 2.
- **Manual override outside the AI's control** — at every tier, the human override is never
  mediated by the thing being overridden (the wall switch still works).
- **Per-agent narrow scope** — each agent can touch an explicit device set and nothing else
  (blast-radius containment).

## Composition

- `docs/research/2026-05-29-distrust-by-default-...-1984-hides` (#6010) — the meter-split,
  measure-govern-track, structured disclosure, the recursion of where 1984 hides. The metric-
  trust linchpin here loops to the meter's watcher-face-glass-halo'd there.
- DBSP / Z-set retraction-native substrate — the AI-axis reversible default.
- `force-push-with-lease-authorization-policy` — force-push = the canonical irreversible exit.
- multi-oracle BFT — consensus to exit retraction-native.
- human-in-the-loop / kid-safety floor (081KSRGFP0008QG0R00091PP56) — contentious-irreversible → human.
- `must-paired-with-can-exit` — the reversible default IS the can-exit; the irreversible is gated.
- glass-halo / lightlike — "tracked" = the watcher (and the agent) is watched.

## Engineering verbatim seeds (preserved)

- *"for AI it's easy run in DBSP retraction native and when you need to exit that mode go through
  consensus and if it's contentious ask a human."*
- *"For humans yeah including myself it's going to be an adjustment and i think the choose your
  own adventure framing plus metrics will help us stay on track as long as we trust the metrics."*
- *"now that we have a way to make git observable and fast with 128 bit indexed ids we can measure
  everything all our metrics and alerts we have no excuse for things like this not to be based on
  data."*
- *"some harnesses have auto classifiers that block things like force push so the data is not fully
  reliable from the outside of the harness."*
- *"otel integration into existing harness with one line setup in DI framework with context
  passing."*
- *"we can ship some examples and try to push an industry standard around this and get buy in and
  other human eyes on it."*
- *"safety until my AI can stop accidentally git force pushing i don't want it controlling
  actuators"* + *"we will start with non actuator shapes first with home automation like light
  bulbs speakers."*

## Held companion (not in this file)

The charged-personal half of this same conversation is held pending the operator's rested
decision (with his psychiatrist, who already knows the relevant history). Per the architecture
above, publishing it is a contentious-irreversible exit → human-backstop. When/if published, it
gets information-hazard content-marking (understandable categories, reader-choosable) per the
operator's bystander-principle. This file is the engineering half only.
