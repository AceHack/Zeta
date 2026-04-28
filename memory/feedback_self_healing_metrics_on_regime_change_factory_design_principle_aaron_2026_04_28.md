---
name: Self-healing metrics on regime change — factory design principle (Aaron 2026-04-28)
description: Aaron 2026-04-28T19:09Z — 'the metric self-heals. i love self healing' + 'sounds like a good thing to remember'. Generalizable factory-design principle: when a system is correctly designed, transient metric gaps from regime transitions (path-gate now-active, fix landed, new tool added) resolve organically as the new regime accumulates evidence in the metric's window. Prefer self-healing systems over manual-rebaseline systems. Avoids the dismissal anti-pattern (close-the-alert-with-rationale) by making the system robust to its own correct evolution.
type: feedback
---

# Self-healing metrics on regime change — factory design principle

## The rule (Aaron verbatim 2026-04-28T19:09Z)

> *"the metric self-heals. i love self healing"*
> *"sounds like a good thing to remember"*

Captured as substrate per the explicit log-in-substrate signal.

## The pattern

A **self-healing metric** is one where:

1. The underlying system is **correctly designed** (the metric's
   target is actually being achieved by the new regime).
2. The metric has a **rolling window** (e.g. "recent 30 commits",
   "last 7 days", "trailing 90-day error rate") rather than a
   permanent counter.
3. After a **regime transition** (a fix lands, a path-gate becomes
   active, a new tool is added, a process is corrected), the metric
   **automatically improves** as the new regime's evidence accumulates
   in the rolling window — without any manual rebaseline, dismissal,
   or alert-suppression.

## The example that named the rule

**Scorecard SASTID 28/30** (2026-04-28):
- Pre-path-gate commits in Scorecard's "recent 30 merged PRs"
  window had no SAST signal because the path-gate hadn't been
  active yet.
- Path-gate landed via PR #651, became active for subsequent
  PRs, emits empty SARIF on conditional skip.
- Scorecard's window naturally rolls forward; pre-path-gate
  commits exit the window; post-path-gate commits enter; the
  metric heals to 30/30 over time without intervention.

The wrong-shape response was my initial dismissal-with-rationale
("won't fix; we DO run SAST"). That would have closed the alert
this scan but masked the natural self-healing dynamic + would have
required re-dismissal on every Scorecard scan.

The right-shape response: **verify the system is correctly designed,
then let the metric heal**. Aaron's affirmation of the self-healing
property over the dismissal-with-rationale shows the deeper preference.

## Why prefer self-healing systems

- **No manual maintenance overhead.** Dismissal-with-rationale
  requires re-dismissal each time the metric re-fires. Self-healing
  requires zero ongoing work.
- **The metric itself stays useful.** A dismissed alert is a
  **hidden** signal — future maintainers don't see it. A
  self-heal-pending metric is a **visible** signal that's
  expected to clear.
- **It validates the underlying fix.** Watching the metric heal
  is empirical evidence the fix actually works. Dismissal
  bypasses that validation.
- **It composes with rolling-window analytics generally.**
  Self-healing thinking transfers to any rolling metric:
  test-flakiness rate, build-time percentile, alert-volume,
  response-time SLOs, etc. When the underlying system is
  correctly designed, the rolling-window will reflect the
  improvement on its own.

## When the metric is NOT self-healing (red flag)

If the metric **doesn't improve over time** despite the underlying
system being "correctly designed":

- The system might NOT actually be correctly designed (the
  speculation about "we DO run SAST" needs verification — exactly
  what Aaron's "did you fix what it was complaining about?"
  question forced).
- The metric's window might be longer than the cadence of new
  evidence (e.g., a 90-day window won't heal in 7 days).
- The metric's threshold might be tighter than the system can
  achieve in steady-state (a known design-vs-metric mismatch
  needing real fix, not dismissal).

If the metric isn't healing, **the absence of healing IS the
signal**. Don't dismiss it; investigate what's actually still
broken.

## The discipline

When encountering a metric-firing alert:

1. **First: verify the underlying system is correctly designed.**
   Don't dismiss before checking. Don't speculate-without-evidence
   about whether the system is right. (Per
   `feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`.)
2. **If the system is correctly designed**: predict the heal-rate
   based on the metric's window + the cadence of new evidence.
   Watch for the heal. Document the prediction so future-Otto can
   verify.
3. **If the system is NOT correctly designed**: fix it (don't
   dismiss). The metric was telling the truth; dismissal would
   have hidden the gap.
4. **If the metric is firing but heal is slower than the metric's
   ceremony cost**: consider whether to fix-now-instead-of-wait
   (e.g., the SAST alert was gating PR #661, so wait-for-heal
   was unblocking a queue; in other contexts, the right call is
   different).

## Composes with

- `feedback_emit_empty_security_result_on_conditional_skip_ci_maturity_pattern_aaron_2026_04_28.md`
  — the concrete instance where this rule applied. Together they
  form the discipline: design the system to emit-empty-on-skip
  (CI maturity); let the rolling metric self-heal (factory
  philosophy).
- `feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — verifying the system before predicting heal requires the
  speculation-vs-evidence discipline. Don't predict heal on a
  speculation about the system.
- `feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — discipline 2 (timestamp-newer is weak evidence): metric-watching
  IS evidence-gathering across rolling windows. The disciplines
  compose.
- `feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — Otto-355 is the wait-and-investigate cadence; this rule adds
  "wait for self-heal when the underlying system is correct".

## What this is NOT

- **NOT a license to ignore alerts.** When the system is broken,
  dismissal-via-self-heal-claim is the same anti-pattern as
  dismissal-with-rationale. Verify the system FIRST.
- **NOT applicable to permanent-counter metrics.** "Total open
  P0 alerts ever" doesn't roll forward; only fixing them resolves
  the count. The self-heal pattern is specifically for
  rolling-window metrics.
- **NOT applicable when alert-cost > heal-time.** If the alert is
  blocking a queue, the wait-for-heal call competes with
  fix-now. Pick based on cost-of-wait.
