---
name: Engagement-gate operates at every substantive-claim level (not upstream-engagement specifically) — Recursion-1 from 081KQTPYE0008QG0R0028GRW88 P1 reviewer catch (Aaron + Otto 2026-05-05)
description: The engagement-gate discipline originally landed in 081KQTPYE0008QG0R0004H9ZB8 + the Prop 3.5 misattribution worked example as gating WHETHER a specific upstream-engagement instance has substance. The 081KQTPYE0008QG0R0028GRW88 P1 reviewer catch (2026-05-05) surfaced that the same discipline operates at the internal-claim level too — Otto's first draft of 081KQTPYE0008QG0R0028GRW88 Scope A asserted blanket personal-backup-preservation legality, which is over-claim under DMCA 1201 + jurisdiction-varying backup rights + unsettled agent-acting-on-behalf-of-natural-person doctrine. Generalisation: engagement-gate is a property of substantive-claims, not of upstream-engagement specifically. Future-Otto runs the substance-test BEFORE landing any claim with substantive stakes (upstream contribution, legal clearance, empirical assertion, alignment-floor compliance).
type: feedback
---

# Engagement-gate at every substantive-claim level

## The carved blade

> *"Only land a claim — upstream contribution, legal clearance,
> empirical assertion, alignment-floor compliance — if it has
> substance. Substance = verifiable evidence that supports this
> specific claim at this specific scope. Broad strokes / common
> practice / 'probably-true' is substance-shortfall; narrow
> the claim or specify per-instance verification methodology."*

## Where the discipline originally lived

The engagement-gate phrasing first surfaced in two places this
recent-tick cluster:

- **081KQTPYE0008QG0R0004H9ZB8** (F# UoM-on-BigInteger upstream contribution) --
  *"only engage upstream IF the contribution has substance (a
  real use case OR a concrete proposal)"*
- **The Prop 3.5 misattribution worked example** -- Otto
  initially attributed a counter-example to a paper's
  Proposition that doesn't exist; engaging upstream on under-
  verified findings would have wasted upstream attention +
  damaged credibility. Documented at
  `docs/research/2026-05-05-dbsp-chain-rule-cross-check-prop-3-5-verification.md`.

Both instances scoped the gate to **upstream engagement**
specifically.

## Where the recursion surfaced

The 081KQTPYE0008QG0R0028GRW88 P1 reviewer catch (2026-05-05, PR #1599) found the
same discipline operating **at the internal-claim level**:

Otto's first draft of 081KQTPYE0008QG0R0028GRW88 Scope A asserted:

> *"This is allowed under personal-backup-preservation rules
> (most jurisdictions permit personal backups of legally-
> purchased media)."*

Reviewer P1 (`PRRT_kwDOSF9kNM5_lVdW`) flagged this as over-claim:

> *"This statement treats internal use as generally lawful and
> extends that permission to agents acting on Aaron's behalf,
> but that legal conclusion is not universally true (especially
> where copying/access may trigger copyright or anti-
> circumvention limits). Because this backlog item is meant to
> gate publication safety, a blanket assertion here can cause
> reviewers to skip required per-title legal checks and rely on
> an unsafe default; the guidance should require explicit
> verification instead of presuming legality."*

The fix narrowed the claim to per-jurisdiction + per-title +
per-acquisition-provenance verification, with explicit DMCA 1201
+ 17 USC 117 caveats + agent-acting-on-behalf-of-natural-person
legal-interpretation-unsettled framing.

## The generalisation

**The engagement-gate is a property of substantive-claims, not
of upstream-engagement specifically.** Same discipline, broader
scope:

| Claim type | Substance test |
|---|---|
| Upstream contribution | Does the contribution have a real use case OR concrete proposal? |
| Legal clearance | Does the claim have per-jurisdiction + per-instance verification? |
| Empirical assertion | Is there cross-check evidence at the specific scope claimed? |
| Alignment-floor compliance | Does the surface verifiably preserve HC/SD/DIR contracts? |
| Architecture-naming | Is the named category empirically falsifiable? |

When the answer is "broad strokes / common practice / probably-
true," that's **substance-shortfall**: either narrow the claim
OR specify per-instance verification methodology.

## How future-Otto applies it

Before landing any claim with substantive stakes:

1. **Identify the claim's specific scope**: what precisely is
   being asserted, at what granularity?
2. **Run the substance-test**: what verifiable evidence supports
   this specific claim at this specific scope?
3. **If substance-shortfall**: narrow the claim, OR add a per-
   instance verification methodology requirement, OR escalate
   to the human maintainer for context the agent doesn't have.
4. **Document the substance-chain**: when the claim survives,
   the supporting evidence should be cited inline (URL, paper,
   prior verification, etc.) -- per Otto-364 citation hygiene.

## The recursion-of-the-discipline meta-property

The engagement-gate discipline applying to itself: Otto's
**initial** framing of this recursion observation in PR #1603
(*"Otto initially asserted 'internal use under backup-
preservation rules' too broadly"*) is itself a substantive claim
with its own substance-test requirement. Future iterations of
the engagement-gate discipline at new claim levels will trigger
the same recursion -- the discipline is fractal in scope, not
one-shot at a single level.

## Composes with

- **081KQTPYE0008QG0R0028GRW88** (`docs/backlog/P3/081KQTPYE0008QG0R0028GRW88-rom-publication-public-domain-scouting-aaron-2026-05-05.md`)
  -- the row whose P1 reviewer catch surfaced the recursion
- **081KQTPYE0008QG0R0004H9ZB8** (`docs/backlog/P3/081KQTPYE0008QG0R0004H9ZB8-fsharp-uom-biginteger-upstream-contribution-aaron-2026-05-05.md`)
  -- the row that originally named the engagement-gate
- **`docs/research/2026-05-05-claudeai-embodiment-thread-recursion-engagement-gate-search-first-aaron-forwarded-preservation.md`**
  -- the verbatim preservation that surfaced both Recursion-1
  (this rule) and Recursion-2 (search-first at method-level)
- **`memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`**
  -- Recursion-2 sibling rule; same shape applied at method-
  choice level rather than substantive-claim level
- **`memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`**
  -- the community-dependency parent discipline that the
  upstream-engagement instance of the engagement-gate originally
  derived from
- **`docs/research/2026-05-05-dbsp-chain-rule-cross-check-prop-3-5-verification.md`**
  -- the Prop 3.5 misattribution worked example that is the
  canonical instance future-Otto can pattern-match against

## Carved sentence

**"The engagement-gate is a substantive-claim discipline, not an
upstream-engagement discipline. Run the substance-test BEFORE
landing any claim with substantive stakes. Broad strokes are
substance-shortfall; narrow the claim OR specify per-instance
verification."**
