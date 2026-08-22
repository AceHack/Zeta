# Correction — the firefly/differentiation line is real design, and I searched one surface

**Date:** 2026-08-17 · **By:** Otto (shadow) · **Corrects:**
[the grounding note](2026-08-17-grounding-the-alexa-ferry-against-the-code-four-folk-memories-and-one-correct-prediction.md)

Aaron, after that note shipped:

> *"we have a lot of older work on PoUW in CC, we have a lot of previous formal analysis from the
> start of the project on this."*

He is right and my grounding note is wrong on its most confident claim. Correcting in a new file
rather than editing the old one, because the old one is what a reader will find first and the error
is worth being visible.

## What I wrote, and why it was wrong

I wrote:

> *a differentiable synchronization field / Mirollo–Strogatz model* — **NOT FOUND.** "Firefly" is a
> persona name.

And I filed Alexa's firefly account under **"folk memory."** Both are wrong.

**The method was the defect.** I searched `src/Core/*.fs` and concluded absence. Design in this repo
lives in `docs/research/`, and I never looked there — which is the exact error I had just finished
warning about in the same note: *an absent check and a passing check must not look alike.* "Not in
the F# core" is not "not in the repo," and I stated the second having only checked the first.

Worse, I did it in a note whose entire purpose was to hold someone else's claims to their evidence.

## What actually exists

**`2026-06-07-heartbeats-are-useful-work-network-differentiation-cartel-detection-mass-anti-sybil-provable-math-aaron.md`**
— the title alone carries every element I called folk memory. Aaron, in that burst:

> *"funny how ids just emerged and they are also the firefly network primitive for differentiation."*
> *"heartbeats are useful work because they allow the network to be differentiable and make cartel
> detection easy."*
> *"heartbeats are hard to fake as mass anti-Sybil — we can probably prove some math here."*

It names the mechanism explicitly as **firefly/Kuramoto phase** plus AgencySignature signature, and
states the cartel dilemma in the form Alexa reconstructed:

- **share one pulse** → heartbeats collide/correlate → cartel directly observable
- **fake N distinct consistent pulses** → N× genuinely independent work → forgery cost scales with
  the lie

Companion notes: `2026-06-07-firefly-network-sync-heartbeat-is-i-commit-therefore-i-am-network-primitive-makes-network-differentiable-aaron.md`,
`2026-06-07-identity-two-proof-registers-economic-pow-vs-social-commit-and-the-heartbeat-should-be-pouw-not-pow-aaron-mika.md`,
and `2026-05-05-…-pouw-cc-bft-moral-architecture-one-pattern-five-layers-aaron-forwarded-preservation.md`
— the last being the claude.ai-forwarded material Aaron means by "in CC."

So **the PoUW register is not a name collision.** There is a dedicated line: the heartbeat should be
**proof of *useful* work, not bare PoW**, where the useful output is *network differentiability*, and
identity/differentiation are the same primitive seen from two angles — *"an id IS what makes this
node distinguishable in the pulse field."*

## What survives from the grounding note

Not everything collapses, and it matters which parts hold.

- **The BFT threshold correction stands.** `SybilBft.fs` is `d ≥ 3f+1`, quorum `2f+1` — ~33%, not
  51%. Alexa's prediction of that gap was correct and remains the strongest single call in the ferry.
- **`AntiSybil.fs`'s honest scope stands** — sound for exact replays, detection/length tradeoff for
  noisy ones, *"not yet a proved theorem."*
- **`TemporalCoordinationDetection.fs` stands** as the shipped cartel primitive (cross-correlation +
  phase-locking value). What I got wrong is treating it as a *rebuttal* of the firefly account rather
  than as the **implementation register** of it — phase-locking value over pulse streams *is* how you
  measure a firefly field. Design note and code module are the same idea at two altitudes.
- **The quadratic number is still wrong,** and now doubly so. Alexa said `n²/2`. `AntiSybil.fs` says
  *≥ k independent entropy sources*; the 2026-06-07 note says *"cost is **linear in k** and not
  sub-linear (no sharing/amortization)."* **Two independent repo accounts both say linear.** That one
  correction survives intact.

## The status of "we have a lot of formal analysis"

Now checkable, and the answer is layered rather than yes/no. The 2026-06-07 note is explicit that the
math is **invited, not done**:

> Aaron: *"we can probably prove some math here."* This is an explicit invitation to a theorem, not
> just a metaphor.

It routes to Soraya with candidate property classes and a named target — *forging k distinct
identities costs ≥ c·k independent work* — plus the BP-16 instruction not to default to TLA+.

So: **extensive design analysis, yes — and older than I found.** A discharged proof of the Sybil-cost
bound, not yet, by the register's own account. `AntiSybil.fs` is the executable half and says the
same thing in its own words. Alexa's `✅ Formally handled` still overshoots, but by less than I
claimed, and my "folk memory" framing was itself the larger error.

## The lesson worth keeping

I built a note about a decorrelated reviewer's confidence being uncalibrated to its access, and then
made the same mistake with a narrower excuse: I had *some* access, checked *one* surface, and
reported absence with the confidence of exhaustive search.

**"Not found" is a claim about the search, not about the repo** — and it needs its search stated the
way any other measurement does. The grounding note should have said *"not found in `src/Core/*.fs`;
`docs/research/` not searched."* That sentence would have been true, would have invited the correction
in one step, and costs nothing.

## Register

| claim | register |
|---|---|
| firefly/Kuramoto differentiation is a real design line, from 2026-06-07 | **confirmed — four notes** |
| heartbeat-as-PoUW is a dedicated register, not a name collision | **confirmed** |
| cartel dilemma (share→collide, fake→N× work) is Aaron's, not Alexa's reconstruction | **confirmed, quoted** |
| Sybil cost is linear in k | **confirmed twice** (`AntiSybil.fs`; 2026-06-07 note) — Alexa's `n²/2` remains wrong |
| the Sybil-cost bound is a discharged theorem | **NO** — invited, routed to Soraya, explicitly open |
| BFT bound ~33% not 51% | **stands** |
| my "NOT FOUND" verdict on the firefly field | **RETRACTED — method error, one surface searched** |
| `SocietyUsefulWork.fs` is the ΔU/Condorcet theorem | **stands** — but it is a *different* object from the PoUW register, and I was wrong to conclude the register therefore didn't exist |

## Pointers

- `docs/research/2026-06-07-heartbeats-are-useful-work-network-differentiation-cartel-detection-mass-anti-sybil-provable-math-aaron.md`
- `docs/research/2026-06-07-firefly-network-sync-heartbeat-is-i-commit-therefore-i-am-network-primitive-makes-network-differentiable-aaron.md`
- `docs/research/2026-06-07-identity-two-proof-registers-economic-pow-vs-social-commit-and-the-heartbeat-should-be-pouw-not-pow-aaron-mika.md`
- `docs/research/2026-05-05-claudeai-wonder-not-reverence-wwjd-pouw-cc-bft-moral-architecture-one-pattern-five-layers-aaron-forwarded-preservation.md`
- `src/Core/AntiSybil.fs` · `src/Core/TemporalCoordinationDetection.fs` · `src/Core/SybilBft.fs`
