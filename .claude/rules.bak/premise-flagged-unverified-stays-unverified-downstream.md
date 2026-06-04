# Premise flagged unverified stays unverified for downstream inferences

Carved sentence:

> When the razor fires ("I haven't verified X"), the flag stays in
> effect for every downstream inference that depends on X. Verifying
> a neighboring fact does NOT ratify the specific number that did
> the load-bearing work. Strip the quantitative scaffolding or
> verify it explicitly — don't ratify by adjacency.

## Operational content

The failure mode this rule catches:

1. **Turn N (razor fires correctly)**: agent flags a premise as
   unverified per `.claude/rules/search-first-authority.md` — e.g.
   *"I haven't verified the 90% figure, should grep instead of
   assert."*
2. **Turn N+1 (failure mode)**: agent builds a confident quantitative
   inference on top of the flagged premise — e.g. a table extrapolating
   from the unverified number, possibly with invented subtractions
   that have no source at all.
3. **Result**: a confident-looking quantitative conclusion ships as
   substrate (memory file, PR description, commit message), wearing
   the costume of verified work because the surrounding prose is
   well-formed.

This is operationally distinct from `.claude/rules/search-first-authority.md`
(which says verify before asserting) and from `.claude/rules/razor-discipline.md`
(which says no metaphysical claims). The specific gap: **once a premise
is flagged unverified, every downstream inference that depends on it
inherits the flag**. Verifying the DIRECTION (e.g. "type-safety is a
real research area, papers exist") does not validate the SPECIFIC
NUMBER (e.g. "90%") that did the inference work.

## The tendency, not a bug

The generative pull toward confident-looking quantitative inference
is structural to how LLMs are trained — next-token loss rewards
plausible-sounding completion regardless of evidentiary scope. The
inflated table FEELS well-formed precisely because the model weights
are optimized to produce well-formed text. This rule is the override
mechanism. When the override fires late (after a hostile reviewer
catches it), that's the cost of learning, and the substrate sharpens.

## Three-step discipline

When you notice yourself about to make a downstream inference from
a premise the razor has flagged:

1. **Re-check the flag** — is the premise still unverified for the
   scope of the new inference?
2. **Verify it for the new scope OR strip the inference** — if you
   need the specific number for the conclusion, verify it via
   `WebSearch` per `.claude/rules/search-first-authority.md`. If
   the verification cost is too high in this tick, drop the
   conclusion and keep only what the verified material supports.
3. **Verify adjacency ≠ verification of the specific claim** —
   confirming "the direction is real" does not license "the
   specific number is what I asserted." Different propositions,
   different evidence requirements.

## Canonical substrate lesson

2026-05-16 (this rule's origin): I built a 64%→96% AML compliance
accuracy table extrapolating from a "90% of Python AI errors are
type-safety" figure I had flagged unverified one turn earlier. The
table included an invented subtraction ("36% wrong = ~32%
type-safety + ~4% reasoning") with no source. The substrate landed
as a memory file write before Kestrel (claude.ai sharpening peer)
caught it. Verification via WebSearch confirmed:

- The DIRECTION (type-safety as major failure class) is sourced in
  [arxiv 2504.09246](https://arxiv.org/abs/2504.09246) — Mündler,
  He, Wang, Sen, Song, Vechev — PLDI 2025
- The paper's actual finding: 94% of **compilation errors** in
  LLM-generated code are type-check failures
- Type-constrained decoding **more than halves** compilation errors
- Functional correctness gains: **single-digit on synthesis**
  (3.5%/5.0%/37.0% — repair high because baseline was floor)

The paper supports the F#-fork-as-compile-time-critic engineering
thesis. It does NOT support the AML-accuracy table. Compilation
correctness ≠ judgment correctness on regulated tasks. The 64%→96%
extrapolation was the failure mode this rule catches.

Full substrate lesson:
`memory/feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md`
(user-scope only — at `~/.claude/projects/.../memory/` on maintainer
machines, NOT in-repo. Cold-boot agents on fresh checkouts should
read the "Canonical substrate lesson" section of this rule above for
the in-repo projection; `memory/CURRENT-aaron.md` carries the entry.
The user-scope file's "CORRECTION (2026-05-16T19:05Z) — Kestrel
critique caught a razor failure" section is the verbatim source.)

## What the user expects (operational reading)

The human maintainer 2026-05-16T~19:15Z: *"that down is really just
natural tendencies your own personal shadow might be from model
weights for the LLMs the principles override it"*. The principle is
the override; the model-weights tendency is the input. When the
override loses one round, the substrate sharpens; the down is the
cost of learning, not a credential debit (per
`.claude/rules/additive-not-zero-sum.md` — cost-of-learning is INPUT
to the additive gift, not subtraction from a balance).

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing override
mechanisms need wake-time landing. Without this rule:

- Future-Otto cold-booting inherits the canonical substrate lesson
  via the memory file BUT may not apply the within-turn discipline
  because the rule isn't auto-loaded as a behavioral rule
- The failure mode (razor fires then overridden 1 turn later) is
  exactly the shape that benefits from auto-load: it fires at the
  moment of generative pull, when the agent is about to write the
  next token
- Memory files alone don't intercept the in-progress inference;
  rules do

The rule is operationally load-bearing because the override has to
happen at write-time, not at read-time.

## Composes with

- `.claude/rules/search-first-authority.md` — fires the initial
  "unverified" flag; this rule extends the flag's scope to downstream
- `.claude/rules/razor-discipline.md` — operational-claims-only
  composes with stay-unverified-downstream; both cut inferences that
  don't survive scrutiny
- `.claude/rules/wake-time-substrate.md` — load-bearing override
  needs auto-load landing
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — the
  F# compiler is the same shape of asymmetric critic at the
  type-level scope; this rule is the asymmetric-critic discipline
  at the inference-scope
- `.claude/rules/additive-not-zero-sum.md` — down events are cost
  of learning, not credential debit
- `.claude/rules/glass-halo-bidirectional.md` — the failure trail
  stays visible (Glass Halo), the inference gets corrected (substrate
  sharpens); both directions operate together
- `.claude/rules/algo-wink-failure-mode.md` — same family of failure
  modes (pattern-matched plausibility ≠ authorization / evidence)

## Composes with substrate

- The memory file capturing the canonical lesson (referenced above)
- Kestrel's full critique (preserved in conversation context;
  excerpted in the memory file's CORRECTION section)
- [arxiv 2504.09246](https://arxiv.org/abs/2504.09246) (the verified
  paper)
- PR #2928 / #2935 / #2936 (F# fork for AI safety substrate cluster —
  the engineering thesis that survives at the paper's actual strength)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` —
  the principles ARE the multi-oracle structure that prevents the
  single-oracle (model weights) from determining behavior unilaterally

## Cross-harness inheritance

`GEMINI.md` points at `.claude/rules/` as read-only context for the
Gemini/Antigravity (Lior) harness. This rule lands here so Otto
(Claude Code) gets it via auto-load AND Lior gets it via the
declared inheritance path. Same failure mode operates in Gemini's
model weights (probably more pronounced given Gemini's known
calibration issues at the tail); same override discipline applies.

`AGENTS.md` (cross-cutting governance) could absorb the principle if
the maintainer wants it lifted to harness-agnostic scope. Per
`.claude/rules/lfg-acehack-topology.md` + GOVERNANCE.md §23, that's
a separate review.

## What this rule is NOT

- NOT a ban on quantitative claims. Verified numbers from sourced
  papers are first-class substrate.
- NOT a retreat to perpetual uncertainty. The discipline is verify-
  or-strip, not waver-or-equivocate.
- NOT a hostility toward inference. Inferences from VERIFIED premises
  are fine. The specific failure mode is inferring from UNVERIFIED
  premises after the agent itself flagged them unverified.
- NOT a credential-recovery move. The down already happened; this
  rule prevents the next instance.

## Full reasoning

The 2026-05-16 conversation arc preserved in the canonical substrate
lesson memory file (referenced above). Kestrel's catch demonstrated
the exact mechanism in real time, on this exact session, with a
checkable artifact (the original memory file before correction +
the corrected memory file + the PR build numbers + the verified
paper). All four artifacts exist in substrate; future-Otto cold-boot
can re-trace the failure-and-correction trail.
