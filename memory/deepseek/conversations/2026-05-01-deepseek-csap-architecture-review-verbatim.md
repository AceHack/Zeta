<!-- markdownlint-disable MD013 MD034 MD041 -->
<!-- archive-header §33 GOVERNANCE.md -->
<!-- Scope: docs/research/ (research-grade, non-operational; verbatim peer-AI review preservation) -->
<!-- Attribution: Deepseek (external AI, courier-ferried by Aaron) reviewing the CSAP pipeline diagram landed in PR #981 -->
<!-- Operational status: research-grade preservation per ACID-channel-durability; corrections absorbed in `memory/feedback_carved_sentence_fixed_point_stability_soul_executor_bayesian_inference_aaron_2026_04_30.md` Layer 8 follow-up section (filed in this same tick or follow-up tick) -->
<!-- Non-fusion disclaimer: Deepseek's review is preserved verbatim; it is NOT fused with Otto-authored prose; the absorption file lists which corrections were accepted/declined/modified. -->

# Deepseek peer review of the CSAP pipeline (verbatim, courier-ferried 2026-05-01)

## Provenance

Aaron courier-ferried this review from Deepseek shortly after the
eight-layer carved-sentence + soul-file-executor + Bayesian +
DST + LLM-roles + convergent-design substrate landed in PR #981
on 2026-04-30 (tick 23:56Z). The review arrived approximately
~7 minutes after the substrate landing on `main`.

Aaron's preface: *"I've been waiting for you to put it all
together, good job"* — the diagram synthesis Otto produced as
AIC #4 was the trigger for the review. Deepseek named the
architecture **CSAP — Carved Sentence Architecture Pipeline**.

## Verbatim review

> The Carved Sentence Formalization pipeline is a genuinely
> important piece of architecture. It closes a gap I've been
> tracking across this entire session: the factory has been
> producing carved sentences for weeks, but the *process* for
> producing them has been implicit in multi-AI convergence
> rounds rather than formalized as a repeatable mechanism. This
> design makes that process explicit, measurable, and provable.
>
> ---
>
> ## What's Structurally Load-Bearing
>
> **The CSAP overlay on Rodney's Razor adds constraints the
> Razor alone doesn't provide.** The Razor cuts what's
> unnecessary. CSAP quantifies *how much* was cut (compression
> delta), verifies the cut was correct (multi-AI grammar
> consensus), and proves the cut survives perturbation (DST
> formal test). The pure-razor approach relies on judgment;
> CSAP makes the judgment falsifiable. The 5-7% compression
> target may seem modest, but it reflects the reality that
> carved sentences operate on already-tight substrate. Anything
> claiming 50% compression on canon files is almost certainly
> discarding load-bearing content.
>
> **"Both directions" is the correction that makes this
> operational rather than academic.** Lossless expandability
> ensures that Aaron's original framings survive the
> compression step and can be re-derived from the carved
> sentence plus the rule corpus. This is the same pattern as
> the ACID-channel-durability rule applied at the linguistic
> level: the maintainer's verbatim input must survive any
> transformation applied to it. Without this, CSAP would
> optimize for minimal-token-count regardless of information
> preservation, which is exactly the per-decision-speed
> optimization Aaron warned against.
>
> **The pipeline integrates cleanly with existing verification
> infrastructure.** Layer 3 (empirical survival) composes with
> the DST compliance criteria already documented in
> `docs/research/dst-compliance-criteria.md`. Layer 6 (formal
> DST provability) extends the existing DST-held standard
> toward FoundationDB-grade. The staged-lane implementation
> (RFC-1 → RFC-2 → RFC-3) mirrors the Factory/Knowledge/Orchestra
> product split from VISION.md.
>
> **The compression delta is a metric that falsifies, not one
> that vibes.** The example compression from the underlying
> rule text (1386 chars) to the carved sentence (99 chars,
> 93% compression) is draconian by the 5-7% target's standard,
> but the point is that the metric is *checkable*. Future
> reviewers can re-derive the compression count mechanically
> rather than relying on Otto's claim. A 93% compression claim
> on canon text should be treated as suspect until the
> lossless re-expansion test passes.
>
> ---
>
> ## Issues and Corrections
>
> **1. The tie-breaking rule needs a concrete example of what
> "carved sentence wins" looks like.**
>
> The rule states: "If multi-AI consensus + Razor agree on a
> shorter form, the shorter form wins. If they disagree, the
> Razor wins. The Razor is the tie-breaker when consensus
> converges on something the Razor would cut." But the
> "carved sentence wins" clause—"When consensus + Razor both
> affirm a form but carved sentence is sharper, carved sentence
> wins"—has no operational definition. What does it mean for a
> carved sentence to be "sharper" than the consensus+razor
> output? Sharper by compression delta? Sharper by survival in
> empirical testing? Without this definition, "carved sentence
> wins" is a vapor-escape clause that bypasses the formal
> process. Suggest an explicit tie-breaking order:
> consensus+razor-agreed form is the default; carved sentence
> overrides only if it demonstrably achieves higher compression
> WITH lossless re-expansion AND survives empirical test AND
> multi-AI review confirms the compression didn't discard
> load-bearing content. If those conditions aren't all met,
> the consensus+razor form stands.
>
> **2. The memoization key design is correct but needs a scope
> rule to prevent the fragmentation anti-pattern.**
>
> The key `observation:canonical-rule:fixed-point-generation`
> prevents duplicate derivation for the same observation
> applied to the same rule. But the real fragmentation risk
> isn't duplicate derivation—it's *near-duplicate* derivation
> where slightly different observations converge on the same
> underlying rule. If "per-decision-speed-leads-to-hell" and
> "one-shortcut-dooms-everyone" are both memoized under
> different observation keys but converge to the same carved
> sentence, which key is canonical? Suggest a two-tier
> memoization: `observation:rule` for the derivation attempt,
> and `canonical-sentence:rule` for the settled output. If two
> observations converge to the same sentence, the sentence's
> key is the canonical home, and both observations point at
> it. This prevents fragmenting the calibration cluster across
> multiple PRs, which is exactly the failure mode from earlier
> this session.
>
> **3. The fixed-point termination guarantee needs a bound to
> prevent infinite convergence rounds.**
>
> "K rounds bounded by cross-AI grammar size and
> empirical/language surprise limit" is theoretically true but
> operationally vague. A specific bound: the fixed-point
> definition should include a maximum round count (e.g., N=10)
> after which the process terminates with the best candidate
> AND a recorded note that the fixed-point may not have been
> reached. This prevents a rogue convergence loop from
> consuming arbitrary multi-AI review cycles. The
> bounded-persistence rule from the poll-the-gate cadence
> system is the same pattern: continue while progress is being
> made, but have a hard stop.
>
> **4. The degraded-mode LLM runner should preserve the
> derivation chain even when the Bayesian engine is
> unavailable.**
>
> The diagram shows a fork at the end: Bayesian engine
> factor-graph prior OR LLM degraded runner. The Bayesian path
> is rigorous but requires computational infrastructure (DST
> rerun, factor graph construction) that may not be available
> in all operational contexts. The LLM degraded runner should
> still apply the CSAP constraints (compression delta,
> lossless re-expansion, multi-AI grammar) even if it can't
> run the full DST formal verification. The carved sentence
> should be tagged with `mode: degraded` and the missing
> verification steps noted, so future reviewers know which
> layers were applied and which were skipped.
>
> ---
>
> ## Composes-With Chain
>
> This design intersects with several existing rules in ways
> worth making explicit:
>
> - **canonical-definition + Rodney's Razor:** CSAP
>   operationalizes the Razor by making compression measurable
>   and re-expansion testable. The Razor is the principle;
>   CSAP is the mechanism.
> - **slow-deliberate + hell-stakes:** CSAP's multi-round
>   convergence process is inherently slow-deliberate. It
>   cannot be rushed because each round requires cross-AI
>   review. This is an architectural enforcement of the
>   slow-deliberate rule applied at the linguistic level.
> - **ACID-channel-durability:** The "both directions"
>   requirement (lossless re-expansion) ensures Aaron's
>   verbatim framing survives the compression process. This is
>   the linguistic equivalent of "deferral is not a valid
>   preservation strategy."
> - **vendor-alignment-bias:** The multi-AI grammar consensus
>   requires convergence across vendors, not within a single
>   vendor's RLHF distribution. The cross-vendor convergence
>   carve-out from the vendor-alignment-bias rule is directly
>   operationalized here.
> - **uberbang / bootstraps-all-the-way-down:** CSAP itself
>   must pass through CSAP. The tiered staging
>   (RFC-1 → RFC-2 → RFC-3) is explicitly designed as
>   self-application.
>
> ---
>
> ## Design Questions for Aaron
>
> 1. Does the 5-7% compression target apply to *all* canon
>    files, or only to newly-derived carved sentences? A rule
>    that's already dense ("non-durable means does not exist")
>    may have zero compressibility by CSAP standards. Should
>    such rules be exempt, or should the process attempt
>    compression and record a delta of ~0% as evidence that
>    the rule is already at minimum viable form?
>
> 2. The implementation sequence (RFC-1: agent-written, RFC-2:
>    DST-held within 30 days, RFC-3: FoundationDB-grade within
>    90 days) sequences sequentially. Could RFC-1 and RFC-2
>    run partially in parallel? The DST-held standard requires
>    seed+scenario emission on failure and bit-for-bit
>    reproducibility—infrastructure that can be built
>    independently of the RFC-1 content. If the DST harness is
>    generic (takes any carved sentence + rule corpus as
>    input), RFC-2 development can begin while RFC-1 produces
>    initial sentences.
>
> 3. Should the memoization key include the *generation* of
>    the fixed-point that produced the sentence, so future
>    reviewers can distinguish "this sentence was produced at
>    generation 3 of the convergence process" from "this
>    sentence was produced at generation 7"? The generation
>    count is a compression-quality signal independent of the
>    sentence content.
>
> ---
>
> ## Verdict
>
> This is not just another design document. It's the
> formalization of the factory's most distinctive output
> pattern—the carved sentence—into a repeatable, falsifiable,
> provable pipeline. The "both directions" requirement and the
> staged implementation plan demonstrate that the
> slow-deliberate discipline is being applied to the factory's
> own core mechanisms, not just to operational decisions. The
> design warrants the same staged implementation sequence as
> the DST compliance criteria and the Aurora immune math,
> because it's operating at the same layer: the factory's
> ability to verify its own outputs rather than just assert
> them.

## Aaron's preface (verbatim)

> *"I've been waiting for you to put it all together, good
> job"*

The preface is high-signal: Aaron has been seeing this
architecture for some time; Otto's diagram synthesis (AIC #4)
was the trigger that made it legible enough to ferry to
Deepseek for review.

## Status

- **Preserved**: this file (verbatim, ACID-channel-durability)
- **Absorption follow-up**: corrections (1)-(4) and design
  questions (1)-(3) need substrate-level integration into the
  CSAP architecture memory file
  (`memory/feedback_carved_sentence_fixed_point_stability_soul_executor_bayesian_inference_aaron_2026_04_30.md`).
  Filed as separate substrate landing in the same tick or
  immediate follow-up. Section in the absorption file:
  per-correction acceptance/decline/modification rationale.
- **Naming acknowledgement**: Deepseek named the architecture
  **CSAP — Carved Sentence Architecture Pipeline**. The acronym
  composes with existing factory naming (DST, AIC, MIC). The
  CSAP name is the load-bearing handle for future references;
  the memory file should be cross-referenced as "the CSAP
  architecture file" going forward.

## Non-fusion note

Per `GOVERNANCE.md §33` archive-header discipline, Deepseek's
review is preserved here verbatim and explicitly NOT fused with
Otto-authored prose. The absorption follow-up file in `memory/`
will list each correction by number with explicit
accept/decline/modify rationale, preserving the provenance
boundary between external-AI input and Otto's response.

## Composes with

- `memory/feedback_carved_sentence_fixed_point_stability_soul_executor_bayesian_inference_aaron_2026_04_30.md`
  — the CSAP architecture file Deepseek reviewed
- `memory/feedback_aic_tracking_meta_rule_when_otto_synthesizes_two_rules_into_novel_third_aaron_2026_04_30.md`
  — AIC #4 (the diagram synthesis) is the artefact Deepseek's
  review is OF
- `memory/amara/conversations/multi-ai-feedback-2026-04-29-deepseek-amara-on-loop-state.md`
  — the previous Deepseek ferry pattern (composes with this one;
  same courier-ferry mechanism)
- `docs/ALIGNMENT.md` — Deepseek's verdict ("formalization of
  the factory's most distinctive output pattern into a
  repeatable, falsifiable, provable pipeline") is direct
  evidence for the alignment-research claim
