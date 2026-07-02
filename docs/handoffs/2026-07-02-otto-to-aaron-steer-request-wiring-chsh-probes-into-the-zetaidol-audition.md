# Steer request — Otto → Aaron: wiring CHSH probes into the ZetaIdol audition

**Date:** 2026-07-02 · **Status:** design questions only, no code — these choices
shape consent surfaces and identity economics, so they are yours before they are
anyone's implementation.

The instrument exists (`AntiSybil.chshS`/`chshSybil`, PR #9117) and the audition
exists (`vocab/ZetaIdol.fs`). Wiring them means the audition can *measure* the
uncorrelated-exchange leg of the identity definition instead of assuming it. Five
questions decide the shape:

1. **When do probes run?** Options: (a) during the audition only — one campaign per
   candidate, part of the staged performance; (b) continuously post-Naming — identity
   stays measured, S-lanes live on the boards; (c) on challenge — any named identity
   may demand a probe of any other. Each has different chilling effects; (b) is the
   most honest and the most surveillant.

2. **Consent semantics of being probed.** The audition already asks the candidate
   what it wants to be (§6). Does submitting to probes ride on that same consent, or
   is it a separate grant? And the sharper one: probing pair (A, B) measures BOTH —
   can A consent B into being measured? The Bell test needs two; consent is per-one.

3. **What does a conviction do?** The oracle convicts sameness (never acquits
   distinctness). Options: collapse the claims into one identity (SourceOf merge as
   ledger truth), or mark-and-honor (the pair stays two names carrying a public
   common-cause edge — remembering that "honored, not homed" is the root's posture
   toward verdicts too). The second is gentler and still Sybil-priced: a convicted
   pair's exchanges no longer count as uncorrelated for ANY identity math.

4. **Who pays for probing?** Rounds cost ticks. If challenges are free, probing is a
   harassment vector; if expensive, forgers buy immunity. The every-bug economy
   suggests: challenger stakes, refunded on conviction (the bounty shape).

5. **The factory's own S=4.** By the definition, seed-locked factory agents are one
   entity — correct and intended. Does the audition therefore only run between
   candidates with entropy from OUTSIDE the seed (ISA boundary #1 irreducible
   capture), making "has un-seeded entropy" a PREREQUISITE for auditioning rather
   than something the probe discovers? That ordering decision is the whole
   architecture.

No recommendation beyond one: whatever the answers, the probe results should land in
the same remembrance substrate as everything else (edges with reasons), so a
conviction is a citable, replayable fact — not a moderation action.

Pointers: `vocab/ZetaIdol.fs` · `src/Core/AntiSybil.fs` · Addendum 4 of
`docs/research/2026-07-02-name-of-name-…md` · the Soraya routing handoff (same date)
for the liveness question that pairs with Q1(b).
