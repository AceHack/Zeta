# Stacking-risk decision framework — first-pass research

**Status:** first-pass, 2026-04-22, auto-loop-30. Occurrence-1
of the specific framing; occurrence-2 would promote to a
`docs/DECISIONS/` ADR + `docs/AGENT-BEST-PRACTICES.md` rule.

**Origin:** auto-loop-29 pre-flight analysis on the IceDrive +
pCloud substrate grant produced a decision shape that prior
boundary work hadn't needed: three individually-manageable risks
compounded to override single-layer acceptance. Naming the
primitive so it becomes a reusable factory lens.

## The claim

**Three manageable risks, stacked, can exceed tolerance even
when each is individually acceptable.** Agent decision-making
that reasons risk-layer-by-risk-layer misses this compound
case. Stacking-risk is the decision lens that surfaces it.

## The two-layer authorization model (prior art)

Every agent action requires both:

1. **Maintainer-authorized layer** — the local grant: does the
   maintainer authorize this action on their accounts / assets /
   infrastructure?
2. **Policy-compatible layer** — the Anthropic / operator
   policy layer: is this action within the scope of what the
   agent is operationally permitted to do, independent of local
   authorization?

Gray-zone on either layer is handled via the gray-zone-judgment
discipline (the factory's default posture is *agent decides,
records, proceeds*, not *agent asks every time*).

## The stacking overlay

Stacking-risk is an overlay on the two-layer model, not a
replacement. When the action implicates multiple ambiguity
sources, the *interaction* between them can exceed what any
single source would imply:

| Layer              | Example                                                    | Alone       |
| ------------------ | ---------------------------------------------------------- | ----------- |
| ToS-clause         | Automated access gray-area against provider's terms        | Manageable  |
| Content-sensitivity| Politically-hot / jurisdiction-dependent archive contents  | Manageable  |
| Copyright-scope    | Items with unverifiable per-file license provenance        | Manageable  |

**Each row alone is manageable with the gray-zone discipline.
All three together is not**, because:

1. **Correlated enforcement signal.** Bulk-access patterns
   auto-flag ToS enforcement. Content-sensitivity auto-flags
   human review. Copyright-scope auto-flags DMCA / legal
   escalation. Three flagging channels stacked ≠ three
   independent Bernoulli trials; they correlate at the
   enforcement-review step where human reviewers see all three
   stacked at once.
2. **Consequence-asymmetry.** Enforcement = account ban =
   loss of substrate that was a multi-year asset. A
   manageable-alone probability becomes unacceptable when
   multiplied by irreversible-loss consequences.
3. **Judgment-opacity.** Stacked gray-areas are hard for
   anyone (including the agent) to cleanly assess
   post-hoc; an action taken in stacked gray is less
   defensible than an action taken in single-layer gray.

## The decision rule

**When ≥ 3 layers of ambiguity compound on the same action,
the agent's default flips from *decide and proceed* to
*decline and propose clean-substrate alternative*.**

This is a targeted exception to the gray-zone default posture,
not a reversion to ask-every-time. Two-layer gray stays in the
agent's judgment zone; three-layer-stacked gray triggers the
stacking-risk exception.

**Clean-substrate pattern.** When stacking-risk fires, look
for an *alternative substrate* that dissolves one or more of
the risk layers:

- ToS-layer risk → route through owned-hardware (no third-
  party ToS surface).
- Content-sensitivity → scope-narrow to non-sensitive subset
  for first task; expand iteratively.
- Copyright-scope → scope-narrow to per-item-license-verifiable
  content; defer items with ambiguous provenance.

Often one move eliminates multiple layers. The IceDrive/pCloud
example: routing through the maintainer's local RAID (owned
hardware) eliminates both ToS-layer (no provider) and reduces
content-sensitivity-layer exposure (only path-mounted subset
is in-scope).

## Escalation triggers remain distinct

The five explicit escalation triggers for ask-first stay
load-bearing (irreversibility, shared-state-visible, axiom-
layer-scope, budget-significant, novel-failure-class). Stacking-
risk is a *sixth* trigger class, specific to compound gray.

## Current instances

| Instance           | Date       | Layers stacked                                    | Resolution                     |
| ------------------ | ---------- | ------------------------------------------------- | ------------------------------ |
| ROM-torrent offer  | 2026-04-22 | Policy-layer (copyright) + content (commercial)   | Decline + redirect to Chronovisor research |
| IceDrive + pCloud  | 2026-04-22 | ToS + content-sensitivity + copyright-scope       | Propose RAID-clean-substrate + maintainer override widened gray zone |

The IceDrive/pCloud case had all three stacked; the ROM case
had two stacked but the policy-layer was enough alone (third-
party-copyright redistribution beyond maintainer's rights is a
red-layer item regardless of stacking).

## What changes when this is occurrence-2+

When a second genuine stacking-risk instance appears (predicted:
another expansive-trust-grant for a new substrate class — movies,
books, paywalled-scraping corpora, Aaron's DeBank/Twitter-archive
bulk-download), the framework promotes from research doc to:

1. `docs/DECISIONS/YYYY-MM-DD-stacking-risk-exception.md` ADR
   formalizing the rule.
2. `docs/AGENT-BEST-PRACTICES.md` BP-NN entry citing the rule.
3. Possibly a BACKLOG row if the factory needs tooling
   (e.g. a per-task ambiguity-source checklist before
   substrate-access).

Until then: this doc is the canonical record.

## Composition with other factory substrate

- **Two-layer authorization model** — stacking-risk is an
  overlay, not a replacement.
- **Gray-zone-agent-judgment-default** — stacking-risk is the
  specific exception that re-introduces decline-default when
  three layers compound.
- **Preservationist / 4-copy redundancy discipline** — when
  the user's own engineering discipline (clean-substrate
  fallbacks, redundancy) already answers the stacking risk,
  the clean-substrate pattern has material to work with.
- **Retraction-native operator algebra** — each risk layer is
  an independent signal; the compound decision is an
  algebra over layer-signals (AND / OR / vote), which can
  be made explicit and measurable over time.
- **ALIGNMENT measurability focus** — named decision
  frameworks with explicit trigger predicates and resolution
  patterns are more measurable than ad-hoc case-by-case
  judgment. Stacking-risk is alignment-contribution-
  positive.

## Open questions (for future refinement)

1. **Is the threshold exactly 3, or N for some N?** Current
   instances support 3 as the inflection, but only 2 data
   points. Occurrence-3+ will calibrate.
2. **Do some layer pairs count double?** e.g. policy-layer-
   red + policy-layer-red across two dimensions might trip
   stacking at 2 layers rather than 3. Case-by-case until
   more instances.
3. **Is there a stacking-risk for the inverse case** — when
   three layers each strongly permit, does that imply stronger-
   than-usual permission? (Probably not asymmetric in this
   direction; unlike Bayesian updating, risk compounds but
   permission does not.)
4. **Does the framework apply at the agent layer only, or
   also to human decisions the agent recommends?** Probably
   both, but the current draft is agent-action-specific.

## What this is NOT

- **NOT a reversal of the gray-zone-agent-judgment default.**
  The default posture (*decide, record, proceed* on gray-alone)
  stays. Stacking-risk is a narrow exception for ≥ 3 layers
  compounding.
- **NOT a license to over-count layers.** "ToS-gray" plus
  "automated-access-gray" are the same layer said twice, not
  two layers. Genuine distinct dimensions required.
- **NOT a replacement for the five ask-first escalation
  triggers.** Irreversibility, shared-state-visible, axiom-
  layer-scope, budget-significant, novel-failure-class stay
  their own triggers.
- **NOT a formal ADR.** This is first-pass research;
  formalization waits for occurrence-2+.
- **NOT applicable to clearly-green or clearly-red actions.**
  Stacking-risk operates only in the ambiguity zone; both
  extremes short-circuit the framework.

## References

- `memory/feedback_rom_torrent_download_offer_boundary_anthropic_policy_over_local_authorization_warmth_first_2026_04_22.md`
  — the two-layer authorization model this overlays on.
- `memory/feedback_maintainer_only_grey_is_bottleneck_agent_judgment_in_grey_zone_2026_04_22.md`
  — the default-gray-posture this is the narrow exception to.
- `memory/project_aaron_icedrive_pcloud_substrate_access_20_years_preservationist_archive_2026_04_22.md`
  — the triggering case with full ToS clause captures.
- `docs/hygiene-history/loop-tick-history.md` row auto-loop-29
  — the live analysis.
- `docs/ALIGNMENT.md` — measurable alignment primary-research-
  focus; named frameworks are measurability contributions.
