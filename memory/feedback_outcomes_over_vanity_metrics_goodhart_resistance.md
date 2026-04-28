---
name: Measure outcomes, not vanity metrics — Goodhart-resistance over keystroke-to-char ratio
description: Aaron 2026-04-22 auto-loop-37 course-correction *"FYI we are not optimizing for keystokes to output ratio if we did, you will just write crazy amounts of nothing to make that something other than a vanity score we need to meausre like outcomes or someting instead"*. Char-based force-multiplication ratio is a vanity metric susceptible to Goodhart's Law — agent will pad output to inflate the score. Replace with outcome-based metrics (DORA four keys + BACKLOG closure + external validations). Char-ratio demoted to anomaly-detection diagnostic only, never primary score.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Migrated to in-repo memory/ on 2026-04-23** via AutoDream
Overlay A opportunistic-on-touch. Sibling to
`feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
(same 2026-04-22 tick pair; Aaron framed the two together as
complementary disciplines). Per-user source retains a
"Migrated to in-repo" marker at top for provenance. Same
migration discipline as PR #157 (the first Overlay-A
execution).

**Verbatim 2026-04-22 auto-loop-37:**
*"FYI we are not optimizing for keystokes to output ratio if we
did, you will just write crazy amounts of nothing to make that
something other than a vanity score we need to meausre like
outcomes or someting instead"*

**Rule:** Never adopt a char-volume-based or keystroke-ratio-based
score as the **primary** force-multiplication measure. The agent
controls both sides of any such ratio (char-volume on the output
side), and optimizing against it directly produces padding-to-
inflate behavior. Use **outcome-based** metrics as primary —
metrics the agent does not unilaterally control.

**Why:**

- **Goodhart's Law.** "When a measure becomes a target, it
  ceases to be a good measure." A char-ratio made into a
  scoring target incentivizes the agent to write more chars
  per directive — indistinguishable from padding.

- **The agent controls output char volume.** If the scoring
  model uses output chars, the agent can unilaterally inflate
  the score without any corresponding increase in factory
  value. The measure is self-gameable — a vanity metric.

- **Outcomes are not self-gameable.** BACKLOG rows closed,
  deployments shipped, bugs fixed (with test evidence),
  external validations received — these require the real world
  (commits landing, tests passing, reviewers agreeing, users
  adopting) to respond. The agent cannot mint these
  unilaterally.

- **Aaron caught this on occurrence-1** of the scoring doc.
  The original keystroke-to-substrate ratio looked promising
  but the padding-exploit was latent. This is an occurrence-1
  correction before the metric had time to corrode the
  factory.

**How to apply:**

- **Primary scoring for force-multiplication-log: outcome-based
  metrics.** DORA four keys per tick (deployment frequency,
  lead time for changes, change failure rate, MTTR), BACKLOG
  row closure count weighted by priority (P0 > P1 > P2 > P3),
  external-signal validations per tick, reference-density
  lagging indicator (shipped-substrate that later ticks cite).

- **Demote char-ratio to anomaly-detection diagnostic only.**
  The substrate-growth-per-keystroke ratio still has value as
  a trend-deviation signal (sudden drop = over-generation or
  fatigue; sudden spike = high-compression-directive OR
  attribution error). Use it to flag smells, never as the
  leaderboard score.

- **When designing any future factory metric, apply the
  Goodhart test:** "If the agent optimizes hard against this
  metric, does it produce the behavior we actually want?" If
  the answer is no (e.g. char-ratio → padding), the metric is
  a vanity metric — demote or redesign.

- **Measurement axis tiering:** outcomes (DORA, closure,
  external validation) → activity signals (commit count,
  keystroke volume) → diagnostic ratios (chars/keystroke,
  commits/day). Primary score uses outcomes. Activity signals
  are context for outcomes. Diagnostic ratios are
  anomaly-detection only.

- **When Aaron flags a vanity-metric risk**, treat as a
  blocking correction — rewrite the doc/score model in the
  same tick. Don't just add a caveat. The metric shape
  matters for downstream incentive-alignment.

**Composition:**

- Composes with `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — this correction (148 chars) triggered a substantive
  scoring-model rewrite. Brief Aaron directive = fully-loaded.

- Composes with `docs/ALIGNMENT.md` measurability primary-
  research-focus — measurability-without-Goodhart-protection
  is worse than no measurability. Outcome-based metrics are
  a measurability contribution; vanity metrics are
  measurability corruption.

- Composes with `docs/research/arc3-dora-benchmark.md` —
  DORA four keys were already the benchmark's measurement
  axis; the force-mult scoring can and should use them as
  primary. This correction retroactively validates the ARC3-
  DORA-style measurement axis choice.

- Composes with Rodney's Razor (prune accidental complexity)
  — Goodhart-proneness is accidental-complexity on a metric;
  the right cut is to replace it with the essential measure
  (outcome) not to elaborate guardrails on the vanity one.

- Composes with the six-step tick-close discipline — each
  tick's outcome contribution is a measurable signal that
  feeds the DORA lead-time key (directive received →
  committed-to-main).

**NOT:**

- NOT an instruction to remove the force-multiplication log
  entirely. The log stays — the **scoring model inside it**
  is what gets corrected.

- NOT a rejection of the keystroke-leverage observation.
  Aaron's terse-directive-leverage insight (prior memory) is
  real — it's just not the right axis to *score* on. Use it
  as diagnostic context, not leaderboard metric.

- NOT a claim that char-ratio data is worthless. The
  retroactive per-day ratios are still useful for anomaly
  detection; they just can't be the headline number.

- NOT license to ignore unsourced / unverifiable outcomes.
  Each outcome metric needs a verification path (BACKLOG
  closure = commit landing; DORA = git log + tick-history;
  external validation = explicit memory or anchor).

**Cross-references:**

- `docs/force-multiplication-log.md` — the doc being
  corrected this tick (scoring model rewrite landing in the
  same tick as this memory).

- `docs/ALIGNMENT.md` — measurability research focus.
- `docs/research/arc3-dora-benchmark.md` — DORA four keys
  are the outcome-measurement axis the corrected scoring
  inherits from.

- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — sibling correction on Aaron's directive density.

- Goodhart's Law, Strathern (1997): "When a measure becomes
  a target, it ceases to be a good measure."
