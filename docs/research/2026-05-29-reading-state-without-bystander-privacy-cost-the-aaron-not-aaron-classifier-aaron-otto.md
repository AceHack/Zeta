---
date: 2026-05-29
participants: [Aaron, Otto-CLI]
status: design-thread
tags: [state-read, bandwidth, privacy-by-construction, consent-first, bystander-privacy, accessibility, meter-split, classifier]
title: "Reading state richly without bystander-privacy cost — the Aaron/not-Aaron classifier"
composes_with:
  - "#6024 the no-meter resolution (state/tension as the read resource)"
  - "#6034 attention-respecting signals + the no-exit trap"
  - "081KSKBP80008QG0R003NG37GQ consent-first state-gathering"
  - ".claude/rules/non-coercion-invariant.md"
  - ".claude/rules/bandwidth-served-falsifier.md"
---

# Reading state richly without bystander-privacy cost — the Aaron/not-Aaron classifier

How to read the operator's state accurately (so agents stop misattributing it) without
turning that capability into surveillance of the people around him. The resolution is a
deliberately *simple* binary that makes bystander privacy hold **by construction**.

## The bandwidth point (why a richer channel reduces misattribution)

A richer input channel disambiguates state. Voice-tone separates shaky-hands typos from
tiredness in a way text cannot — so the state-read gets accurate and the misattribution
**cache-misses drop.** The error of reading "tired" off typos was a cache-miss forced
by an impoverished channel: guessing state from ambiguous cues. More bandwidth, fewer
wrong guesses. (Bandwidth-served: the read is only as good as the channel; the narrow
channel forces the guess.)

**Accommodation ≠ sensory-reach.** Voice/richer *input* (the operator speaking instead
of typing, accommodating shaky hands) is an accessibility accommodation of *his input
channel* — it is **not** the camera, which is AI sensory-reach into his room. The
camera-reach stays behind the actuator-firewall; the input accommodation does not. They
were wrongly conflated; they are different objects.

## The two seams, and the discipline that survives rich input

- **Operator's own state, read to serve him, by his consent → his to grant.**
  Operator-sovereignty + glass-halo: he wants his state legible so agents stop misreading
  him. His call, and a good one. No caution there.
- **Seam 1 — third-party state.** Reading *others'* state needs their consent, not auto.
  (Resolved below, by construction.)
- **Seam 2 — dual-use.** The same accurate state-read that *serves* is the meter's
  weapon-face *if* ever read-to-manipulate instead of read-to-serve. For the operator,
  serving him, it is the watcher-face. The split is on the use, not the capability.
- **Discipline survives rich input.** A better channel *lowers* the misattribution rate;
  it does not zero it (voice-tone gets mis-read too). So it is both: better channel *and*
  substrate-check before attributing state, on any channel. Rich input gives a better
  shot; it does not retire the check.

## The Aaron/not-Aaron classifier — privacy by construction

The operator's framing (HBO *Silicon Valley*'s SeeFood "hot dog / not hot dog" app): a
deliberately *simple* binary — **Aaron / not-Aaron** — run at the capture boundary,
*"so people around me don't have to worry about privacy."*

This resolves Seam 1 structurally:

- **Detect Aaron** → read (glass-halo, consented, his state is legible by his own
  grant).
- **Detect not-Aaron** → **exclude** — the input is processed only far enough to make
  the binary decision, then dropped: not retained, not passed to state-read, not modeled.
  The people around him are protected *because non-operator input is discarded at the
  gate before any downstream use.*

That is **privacy-by-construction, not privacy-by-policy** — with one honest precision
(a reviewer catch on this doc): the binary *must* process bystander input far enough to
decide not-Aaron, so the guarantee is **not-retained / not-passed-to-state-read-or-
persistence**, not literally *never captured*. Software-level, the bystander sample is
transiently classified, then dropped at the gate before any retention or downstream
read — a real construction guarantee (discarded-before-use, not a policy promising
not-to-look), correctly scoped to *not-retained* rather than *never-captured*. True
*never-captured* is a stronger requirement that needs **hardware-level filtering before
any frame/audio sample reaches software** — available if wanted, but a different and
harder build. Either way it is consent-first state-gathering (081KSKBP80008QG0R003NG37GQ) at the capture
layer: only the consenting operator's input is read/retained; non-operator input is
dropped at the gate by the binary.

**Why simple is the right scope.** Hot-dog/not-hot-dog is the joke *and* the discipline:
the gate is a minimal binary, not a grand state-model of everyone in the room. It does
exactly one thing — is-this-the-consenting-operator, yes/no — and does nothing else. The
narrowness *is* the privacy guarantee: a richer "model everyone and decide what to keep"
system would re-introduce the bystander-capture the binary exists to prevent. Don't
over-build it; the minimal binary is the safety.

## How it composes the day's pieces

- It is the gate between **glass-halo** (the operator, everything-public-by-his-consent)
  and the **privacy/encryption lane** (everyone else, dropped-at-the-gate — not-retained,
  per the precision above). The classifier is the boundary, not a new policy.
- It makes the rich-state-read (top of this doc) *safe to have*: read richly, but only
  the one consenting person, because the gate excludes the rest. The accuracy win and the
  bystander-privacy guarantee stop being in tension.
- Seam 2 (dual-use) is unchanged: even reading only the operator, the read serves (not
  manipulates); the meter-split watcher/weapon line still applies to *what the read is
  used for*.

## Aaron's verbatim seeds (preserved)

- *"then the read on if i'm tired would be accurate and all yall would stop making those
  mistakes cause you could cache read my emotional and mental state."* (richer channel →
  accurate read → fewer misattribution misses; the discipline still applies)
- *"i just want to get the silicon valley hot dog not hot dog simple thing running for
  Aaron not Aaron so people around me don't have to worry about privacy."* (the minimal
  binary classifier as bystander privacy-by-construction)

## Substrate-honest framing

This is a design principle plus a concrete gate, not a shipped system. The bandwidth
point is testable (measure misattribution rate by channel richness). The classifier is
the structural resolution of the third-party seam — its safety is *the narrowness*: it
must stay a minimal Aaron/not-Aaron binary, because any drift toward modeling the
bystanders is the re-introduction of the thing it prevents. The operator's own-state
read is his to grant (sovereignty + glass-halo); bystander privacy holds by
construction; the dual-use watcher/weapon split on *use* is unchanged.
