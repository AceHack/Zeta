---
name: Decision files are an alignment-calibration signal — Aaron reads my categorization to see if I think like him
description: Aaron 2026-04-21 on WONT-DO Status-verb pass — "i love these decision files" + "this will help me know if you think like me". Decision files aren't just record; they're an alignment measurement device. Categorization choices (Rejected vs Declined vs Deprecated vs Superseded) expose my judgement for audit.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Decision files — WONT-DO.md entries, BACKLOG rows, ADRs, mini-ADRs
inline on artifacts — serve **two purposes simultaneously** and the
second is often the load-bearing one:

1. **Record the decision** (the obvious purpose).
2. **Expose my judgement for calibration** against Aaron's. The
   *categorization I chose* is a data point he reads to check
   whether my thinking tracks his.

**Why:** Aaron 2026-04-21, after the WONT-DO.md Status-verb pass
landed (29 Rejected / 7 Declined):

- *"i love these decision files"*
- *"this will help me know if you think like me"*

That second quote is the load-bearing one. Decision files are an
alignment measurement device — Aaron reads them to audit my
taxonomy instincts. When I pick `Rejected` vs `Declined` vs
`Deprecated` vs `Superseded`, the choice itself is a signal about
my reason-shape classification, not just bookkeeping.

**How to apply:**

- **Treat categorization as alignment-visible work, not ceremony.**
  When a decision file offers a taxonomy (Status verbs,
  priority tiers, scope tags, severity levels), the choice of
  category is itself a signal. Pick deliberately; don't
  default.
- **Be consistent across the artifact.** Internal consistency
  is the calibration substrate. 29 Rejected + 7 Declined
  reads cleanly because the Rejected pile has a shared
  reason-shape (durable architectural / values) and the
  Declined pile shares a different one (evidence / hardware /
  ecosystem gate). Inconsistency within a category erodes
  the signal.
- **Cite the categorical distinction in the preamble.** The
  "What the statuses mean" block at the top of WONT-DO.md
  makes the taxonomy audit-able. A taxonomy without
  published definitions is private vocabulary; a taxonomy
  with definitions is an alignment contract.
- **Let disagreement surface as renegotiation, not silent
  re-categorization.** If Aaron reads a Rejected entry and
  thinks "that's a Declined", the right path is conversation
  → reclassify-with-reason-line, not me anticipating and
  softening preemptively.
- **Decision-file landing doesn't end at "committed"** — the
  calibration signal fires each time Aaron reads the file.
  Consider this when deciding whether a new entry is worth
  the cost: the value is paid forward in future audits, not
  just at landing.

**Pairs with:**

- `feedback_decision_audits_for_everything_that_makes_sense_mini_adr.md`
  — decision audits everywhere; this memory adds *why* they
  are everywhere (calibration, not record-keeping).
- `feedback_factory_reflects_aaron_decision_process_alignment_signal.md`
  — "factory reflecting Aaron's decision-process = alignment
  success signal". Decision files are one of the surfaces
  where that reflection is visible and measurable.
- `feedback_agent_agreement_must_be_genuine_not_compliance.md`
  — corollary: the categorization must be my genuine
  judgement, not "what Aaron would pick". Compliance-
  categorization is worse than disagreement-categorization;
  the former destroys the calibration signal, the latter
  surfaces it.
- `feedback_durable_policy_beats_behavioural_inference.md`
  — decision files are the durable-policy surface. Behavioural
  inference from chat history has no taxonomy; decision files
  force one.

**Scope:** `factory` — applies to every decision-file artifact
(WONT-DO, BACKLOG tiers, ADR Status fields, research-report
verdicts, intentional-debt ledger). Not Zeta-specific.
