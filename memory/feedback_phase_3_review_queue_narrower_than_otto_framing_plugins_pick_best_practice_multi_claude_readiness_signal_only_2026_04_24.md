---
name: Phase-3 Aaron-review queue is NARROWER than Otto's review-inventory framing — only PR #239 (password-storage) + PR #230 (multi-account Phase-2) need Aaron-design-review signoff; multi-Claude experiment wants Otto-readiness-signal NOT Phase-3-gate; plugin packaging A/B/C is Otto-picks not Aaron-picks; Anthropic + OpenAI marketplace publishability is design constraint; 2026-04-24
description: Aaron Otto-104 three-message burst correcting Otto's review-inventory table filed earlier this tick; direct reinforcement of Otto-82 authority-inflation-drift calibration — second occurrence in one session; refinement narrows the "Phase-3 specifically-asked-for-design-review" gate to the TWO Aaron actually asked for explicitly; multi-Claude peer-harness experiment follows Otto-86 readiness-signal pattern (Otto tells Aaron when ready for Windows-PC test); plugin packaging decision flipped from "Aaron picks A/B/C" to "Otto picks best-practice that fits Anthropic + OpenAI marketplace publication"
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-24 Otto-104 three-message burst (verbatim,
in order):

**Message 1 (review-scope correction):**
*"these are the only two i asked to approve explicitly
  │ 3   │ PR #239 password-storage design         │ (open research doc, Phase-3 gate)                                                │ Signoff on password-storage approach before implementation                                                                          │
  ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4   │ PR #230 multi-account design Phase-2    │ (Phase-1 design authorised, Phase-2 gated on Aaron security review)              │ Account-switching / mixed-tier design authorisation                                                                                 │
       the rest you are overcautious, i just want to know
when the muti agent is resdy for me to run a test on my
windows pc"*

**Message 2 (plugin packaging direction):**
*"figure out what's best practice and fits in with our
stuff and we will pubish via anthropic and openai
marketplaces eventually so whatever makes sense for that"*

**Message 3 (PR #290 row):**
verbatim-quoted PR #290 A/B/C row; implied refile of
"Aaron picks" from review queue to "Otto figures out best
practice per message 2".

## The rule

**Only TWO items on Aaron's Phase-3 specifically-asked-for-
design-review gate (per Otto-82 authority-calibration):**

1. **PR #239 — password-storage design.** Aaron asked for
   signoff on approach before implementation. Phase-3
   BLOCKING.
2. **PR #230 — multi-account design Phase-2.** Phase-1
   design was authorised; Phase-2 gated on Aaron security
   review. Phase-3 BLOCKING.

**Everything else on Otto's earlier review-inventory table
is OVER-GATED:**

- **PR #290 Codex-builtins research / A-B-C packaging
  decision** — NOT on Aaron's review queue. Otto picks
  best-practice-fit per message 2.
- **PR #233 multi-Claude peer-harness experiment** — NOT
  a Phase-3 Aaron-review. Otto-86 readiness-signal pattern
  applies: *"i just want to know when the muti agent is
  resdy for me to run a test on my windows pc"*. Aaron
  waits for Otto's signal; Otto iterates-to-bullet-proof
  solo per Otto-93. No Phase-3 review cycle.
- **PR #292 frontier plugin inventory** — Phase-3 Aaron-
  review was named as LATER (after Phase-1 design doc
  lands) but should be reframed now: Phase-3 for the
  frontier-plugin-inventory arc **also** stays off Aaron's
  queue unless he explicitly asks. Otto picks-what-fits
  per message 2.

## Why: the pattern, second occurrence in one session

**This is the SECOND Otto-82-style authority-inflation-
drift correction this session.** First occurrence:
Otto-82 itself (governance-doc edits / research docs /
factory tools within standing authority; Otto was gating
on Aaron approval that wasn't needed). Second occurrence:
this tick (review-inventory table included items Aaron
never asked to review).

The pattern is now demonstrable: **Otto's default drift is
toward over-gating; Aaron's default correction is toward
narrower scope.** Each correction further narrows; the
direction-of-travel is trust-based-approval-is-default,
gates-are-exceptions, and Otto should PRE-CORRECT toward
narrower rather than wait for Aaron to catch it.

**Composes with:**
- **Otto-82** (governance edits within standing authority)
  — same pattern, different scope surface.
- **Otto-93** (Otto iterates-to-bullet-proof solo; Aaron
  is final validator not design gate) — applies directly
  to multi-Claude experiment and anything in its shape.
- **Otto-86** (peer-harness progression; Otto signals
  readiness, Aaron waits) — ratified again by message 1's
  *"i just want to know when the muti agent is resdy"*.
- **Otto-90** (Aaron + Max not coordination gates) —
  parallel reduction of a different false gate.

## How to apply

**When building a "what does Aaron need to review?" list:**

1. Only include items where Aaron has **explicitly asked**
   for design-review signoff. Filter by direct Aaron
   quote, not by Otto's inference of "big design → Aaron
   would want to see".
2. Multi-step experiments / multi-Claude / peer-harness /
   Windows-PC-test work = Otto-86 readiness-signal
   pattern, NOT Phase-3 gate.
3. Plugin packaging / skill-creator decisions / research-
   doc A-B-C forks = Otto picks best-practice-fit. Aaron
   reviews at Frontier UI in batch per Otto-72.
4. Factory tooling / governance-doc edits / BACKLOG rows
   / tick-history / memory edits = within standing
   authority per Otto-82. Not on review queue.
5. **If uncertain, default to NOT putting on Aaron's
   queue.** Aaron's message 1 explicitly says *"the rest
   you are overcautious"* — Otto's error-side is always
   toward OVER-gating.

**Current active items on Phase-3 Aaron-review queue:**
- PR #239 — password-storage design
- PR #230 — multi-account design Phase-2

**Active items on Aaron-readiness-signal queue (Otto-86
pattern; Aaron waits for Otto):**
- Multi-Claude peer-harness experiment (for
  Windows-PC-test launch)
- Future peer-harness with Codex (end-of-telephone-line
  test)
- Future Windows-support implementation

**Active items on Otto-decides-and-files-at-Frontier-UI
queue (Otto-72 pattern; Aaron reviews in batch):**
- Everything else.

## The plugin-marketplace direction constraint

Message 2 introduces a NEW design constraint:
*"we will pubish via anthropic and openai marketplaces
eventually so whatever makes sense for that"*.

This:
1. **Confirms plugin-packaging direction** — factory
   plugins will eventually be marketplace-distributed,
   not repo-only.
2. **Reinforces in-source discipline** (PR #292 BACKLOG
   row) — marketplace publication requires a canonical
   source-of-truth; harness-local sandbox content cannot
   publish.
3. **Adds a research constraint** — Phase-1 plugin-
   design research (on PR #292 row) must investigate the
   shape of Anthropic + OpenAI marketplace submissions
   (manifest-required fields, icon/readme conventions,
   security reviews, versioning). Factory best-practices
   ADR should derive from marketplace-publishability
   requirements.
4. **Removes PR #290 A/B/C from Aaron's queue** — Otto
   picks whichever of (A) no packaging / (B) in-tree
   `.codex-plugin/plugin.json` / (C) separate
   `LFG/zeta-codex-plugin` repo best fits marketplace
   publishability + factory discipline. Likely answer:
   **B (in-tree manifest)** because marketplace
   publication typically pulls from a source-of-truth
   repo, and factory in-source discipline mandates
   exactly that shape. Otto decides on a subsequent
   tick after reviewing the PR #290 research doc again.

## The multi-Claude readiness-signal contract

Message 1 ratifies Otto-86 + Otto-93 for the multi-
Claude arc:

- **Aaron's only ask:** *"i just want to know when the
  muti agent is resdy for me to run a test on my windows
  pc"*.
- **Otto's role:** iterate on the multi-Claude experiment
  design (via Aminata passes / v2 delta / any further
  drafts) until bullet-proof; THEN signal ready to Aaron.
- **Aaron's role:** wait for Otto's signal, then run a
  single Windows-PC validation test when convenient.
- **Not a Phase-3 design-review gate:** Aaron is not
  reviewing the design; Aaron is VALIDATING the final
  implementation on his Windows PC.

This confirms the Otto-93 pattern: *"Otto writes design,
Aaron reads it nope just keep pushing forward until you
think your testing with it is bullet proof then i'll test
by running on my windows pc"*.

## What this memory does NOT authorize

- **Does NOT** authorize Otto to launch the multi-Claude
  experiment on Aaron's Windows PC unilaterally. Aaron's
  *"i'll test by running on my windows pc"* = Aaron's
  hand-on-keyboard validation; Otto signals readiness but
  does not execute on Aaron's hardware.
- **Does NOT** authorize Otto to bypass Aminata /
  external-harness review on design arcs. Those reviews
  remain advisory per the standing pattern.
- **Does NOT** authorize Otto to declare "bullet-proof"
  prematurely — the 4 IMPORTANT / 3 WATCH findings from
  Aminata Otto-100 on the bullshit-detector, and the
  open 4 items from Aminata's iteration-1 pass on the
  multi-Claude experiment, remain real work.
- **Does NOT** unilaterally ship plugins to marketplaces
  — "publish via Anthropic + OpenAI marketplaces
  eventually" = design constraint, not immediate action.
  Marketplace submission is its own phase-gate; Phase-1
  design doc (per PR #292 BACKLOG row) precedes.
- **Does NOT** authorize removing items from the review
  queue that genuinely have unresolved external-review
  blockers (e.g., Aminata BLOCKING phases on new arcs
  stay BLOCKING until Aminata clears them).

## Specific revision to Otto-104 reply

Otto's Otto-104 reply listed 5 items on Aaron's review
queue; only 2 (#239 + #230) are correct. The revised
table is:

| # | Item | Queue | Why |
|---|---|---|---|
| 1 | PR #239 password-storage | Phase-3 BLOCKING | Aaron explicitly asked |
| 2 | PR #230 multi-account Phase-2 | Phase-3 BLOCKING | Aaron explicitly asked |
| ~~3~~ | ~~PR #290 A/B/C~~ | **Otto picks** | Per msg 2 |
| ~~4~~ | ~~PR #233 multi-Claude~~ | **Readiness-signal (Otto → Aaron)** | Per msg 1 + Otto-86/93 |
| ~~5~~ | ~~PR #292 frontier plugins~~ | Otto decides / Frontier-UI-batch | Per Otto-72 + msg 2 |

## The meta-pattern for future Otto instances

When Otto future-self reads this memory in a later session:

1. Trust-based-approval is the default (Otto-51 / 67 /
   72 / 82).
2. Design-review gates are narrow exceptions, not
   defaults.
3. If uncertain whether something needs Aaron's review,
   default to NOT. Aaron corrects over-gating, not under-
   gating.
4. Check this memory + Otto-82 + Otto-93 + Otto-86 as the
   calibration set for "does this need Aaron?".

## File reference

- PR #292 BACKLOG row filed earlier Otto-104 tick for
  frontier plugin inventory; Phase-3 Aaron-review stays
  off queue per message 2.
- Otto-104 tick also absorbed 9th ferry (Amara Aurora
  initial integration points) per Otto-102 scheduling
  memory.
