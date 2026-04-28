---
name: Retractability by design is the foundation — every factory decision retractable since almost-start-of-project; this is what licenses trust-based approval + batch review + Frontier UI; Zeta's retraction-native algebra manifests at the factory-governance layer, not just at the data layer
description: Aaron 2026-04-24 Otto-73 — *"the reason i feel safe reviewing later in huge batches and making nugest in the dashboard/frontier ui is becasue every decision is recractiable by design for a long time now, since almost the start of this project"*. Names retractability as DESIGN PROPERTY of the factory, predating recent operational shifts. Foundation for: (a) Aaron's trust-based batch-approval pattern (Otto-51), (b) standing full-GitHub authorization with only spending-hard-line (Otto-67), (c) "don't wait on me, mark down decisions" (Otto-72), (d) Frontier UI as future batch-review surface (Otto-63). The factory is retraction-native at the governance layer just as Zeta is retraction-native at the data layer — same primitive, different surface.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Retractability by design — foundation of trust-based batch review

## Verbatim (2026-04-24 Otto-73)

> the reason i feel safe reviewing later in huge batches and
> making nugest in the dashboard/frontier ui is becasue every
> decision is recractiable by design for a long time now,
> since almost the start of this project

("nugest" likely intended "nudges" — making nudges at the
dashboard/Frontier UI review surface.)

## The claim

**Retractability is a DESIGN PROPERTY of the factory**, not
an emergent behavior. Every decision can be retracted. This
has been true since almost the start of the project — not
a Otto-52-or-later invention.

**Consequence:** batch-review-much-later is SAFE. Any wrong
decision caught in a later review can be retracted. The
frontier-UI-nudge model is viable precisely because the
underlying governance substrate is retraction-native.

## Why this matters foundationally

Three framings that have been operating as if they needed
justification separately actually rest on THIS foundation:

1. **Trust-based batch approval** (Otto-51:
   `feedback_aaron_trust_based_approval_pattern_...`) —
   Aaron approves without per-detail comprehension. Safe
   because if a detail is wrong, it's retractable.
2. **Standing full-GitHub authorization** (Otto-67:
   `feedback_aaron_full_github_access_authorization_...`) —
   Aaron grants broad execute-authority. Safe because if
   execution is wrong, it's retractable. Only hard line:
   spending increases (which are genuinely non-retractable
   in the billing sense — paying $X in April can't be un-paid).
3. **"Don't wait on me approved"** (Otto-72:
   `feedback_aaron_dont_wait_on_approval_...`) — Otto
   proceeds without per-PR approval. Safe because if
   wrong, retractable.
4. **Frontier UI as future batch-review** (Otto-63:
   `project_frontier_burn_rate_ui_first_class_git_native_
   for_private_repo_adopters_...`) — Aaron reviews later,
   in batch, via dashboard. Safe because every decision
   surfaced there is retractable.

**None of these would be safe if decisions weren't
retractable.** Aaron's Otto-73 articulation makes the
foundation explicit: the whole architecture rests on
retractability as a design property, not on
"I'll trust Otto because he's reliable" or
"I'll approve later because I'll get to it". The
*structural* reason is retractability.

## Retractability shows up at every layer

Zeta-the-library is retraction-native at the **data**
layer: Z-sets carry signed weights; operators propagate
retractions through algebra; outputs reflect deletions
automatically. That's the primary research claim.

The factory is retraction-native at the **governance**
layer too — revealed by Otto-73:

- **Memory retractions** — `superseded-by` markers,
  `supersedes` frontmatter, dated revision blocks on
  existing memories (Otto-61 LFG-credit chain is the
  canonical example: claim → verification → correction
  → final rule, all preserved in one file)
- **BACKLOG retractions** — rows get retired with
  explicit `retired: <reason>` markers, not silent
  deletion
- **WONT-DO list** — decisions declined with explicit
  reasoning; retractions of prior "we'll do this"
  judgments
- **ROUND-HISTORY** — each round can revise prior-round
  direction; append-only records preserve the chain
- **Skill retirements** — moved to `_retired/` with
  git history preserving the corpus
- **ADRs** — newer ADRs can supersede older ones with
  explicit citation
- **Commit reverts** — git itself is the retraction
  mechanism at the code layer
- **Branch protection** — blocks force-push and deletion
  of main, which would ERASE retraction history; the
  block PRESERVES retractability by design
- **Decision-proxy-evidence YAML** (PR #222) — has an
  explicit `retraction_of:` field for one decision
  retracting another
- **OpenSpec archive discipline** — specs that change
  behavior have explicit versioning

The factory already embodies this. Aaron's Otto-73 is
ratification of what was already true, not prescription
of new behavior.

## What's NOT retractable

A short list of genuinely non-retractable actions (hence
the "spending increase" hard line in Otto-67):

- **Money paid** — invoices billed can't be un-billed.
  Hence the synchronous-consultation requirement for
  spending increases.
- **Public communications external to the factory** —
  a tweet, a blog post, an email sent can be deleted
  but can't be guaranteed un-seen. Hence hygiene around
  the drop/ ferry boundary + careful branding decisions.
- **Leaked secrets** — pushed credentials are
  considered compromised even after `git push --force`
  rewrites history.
- **Actions taken on external systems** — e.g., a
  repo transfer executed can be reversed but requires
  cooperation from the new owner. Operational-risk
  layer in the GitHub surface discipline.
- **Real-world effects** — the factory doesn't have
  these today, but if a future deployment actuates
  real-world systems, retractability at the actuation
  layer becomes its own problem class.

Everything else — code changes, docs, memories,
BACKLOG, ADRs, branches, PRs — is retractable by
design.

## How this sharpens my ongoing posture

Before Otto-73, I was treating each of the
trust/authorization/don't-wait/Frontier-UI framings as
separate judgments Aaron made. After Otto-73, they are
one judgment expressed multiple ways: *the factory is
retraction-native, so batch-review is safe*. Which
means:

- **Don't over-deliberate on reversible decisions.**
  The cost of "get it right first time" is weighed
  against the cost of "land it now, revise later if
  wrong". For reversible decisions, land-now wins more
  often than I've been treating it.
- **Do weight irreversible decisions carefully.**
  Spending, external comms, secret exposure — these
  stay cautious. The hard line isn't arbitrary.
- **Honor the retraction substrate.** When revising
  prior work, preserve the chain via supersession
  markers rather than silent rewrite. The chain IS the
  audit.
- **Surface the retractability explicitly when
  relevant.** When a decision has a retractability
  story, naming it in the commit / PR / memory helps
  future readers (and Aaron at the Frontier UI)
  understand the risk model.

## How "Zeta models the factory" validates here

Multiple prior memories noted Zeta-as-model-of-
substrate:

- `project_zeta_db_is_the_model_custom_built_differently_
  regime_reframe_...` — Zeta IS the model, not a
  model-of
- `project_zeta_is_agent_coherence_substrate_all_physics_
  in_one_db_stabilization_goal_...` — Zeta is the
  agent-coherence substrate
- Aaron's earlier framing: Zeta is what keeps the factory
  coherent at scale

Otto-73 is another data point. The factory's governance
layer exhibits the same retraction-native primitive as
Zeta's data layer. This is not *"Zeta influenced the
factory's design"* — it's *"the factory and Zeta are
isomorphic at the retraction-native level"*. The same
primitive scales.

Rodney's Razor (complexity reduction) applies: *one
primitive, multiple surfaces* is strictly simpler than
*different primitives at each surface*. Aaron's Otto-73
confirms the reduction has been operating silently
and is now visible.

## What this directive is NOT

- **Not license to make irreversible decisions carelessly.**
  The spending hard line + external-comms care + secret
  exposure caution all stand. Retractability applies to
  most decisions, not all.
- **Not a claim all past decisions are reversible.**
  Some have already actuated downstream effects
  (PRs merged, memories read by new sessions, choices
  that other decisions have been built on). Retractable
  ≠ costless to retract. The discipline is that
  retraction is *possible*, not that it's *free*.
- **Not a retroactive apology for prior self-throttling.**
  Otto-71's "queue saturated, stop" framing had some
  legitimate concern (reviewer throughput matters for
  Codex/Copilot). Otto-73 clarifies the STRUCTURAL
  reason the tighter self-throttle was unnecessary, not
  that all throttling is wrong.
- **Not a mandate to land every draft.** Quality
  discipline (Codex findings addressed, tests pass,
  live-state-before-policy) still applies. Retractability
  is the safety floor, not a license to ship sloppy.
- **Not authorization to rewrite history silently.**
  Retractions leave a trail by design; that's part of
  what makes them safe. Silent history-rewrite breaks
  the audit chain and is explicitly outside retraction
  discipline.

## Composes with

- `feedback_aaron_trust_based_approval_pattern_...`
  (Otto-51) — trust licensed by retractability
- `feedback_aaron_full_github_access_authorization_...`
  (Otto-67) — authorization licensed by retractability;
  only restriction is the non-retractable (spending)
- `feedback_aaron_dont_wait_on_approval_log_decisions_...`
  (Otto-72) — don't-wait licensed by retractability +
  logged-decisions-for-audit
- `project_frontier_burn_rate_ui_first_class_git_native_
  for_private_repo_adopters_...` (Otto-63) — Frontier
  UI as batch-review surface licensed by retractability
- `docs/decision-proxy-evidence/` (PR #222) —
  `retraction_of:` field is the explicit machinery for
  decision-level retraction
- `feedback_deterministic_reconciliation_endorsed_
  naming_for_closure_gap_not_philosophy_gap_
  2026_04_23.md` (Otto-67) — deterministic
  reconciliation IS the mechanism by which retractions
  compose cleanly; both concepts rhyme
- `memory/feedback_deletions_over_insertions_complexity_
  reduction_cyclomatic_proxy.md` — deletion as signal;
  retraction extends this to non-code substrate
- Zeta's ZSet algebra (src/Core/ZSet.fs) — data-layer
  retraction; same primitive as governance-layer
  retraction documented here

## Attribution

Human maintainer (Aaron) named the foundational property
in Otto-73. Otto (loop-agent PM hat) absorbed + filed
this memory. Future-session Otto inherits: retractability
is the factory's design-level foundation, not a recent
operational shift; it licenses the entire trust + batch +
Frontier-UI architecture; preserve the chain when
retracting (supersession, not silent rewrite); stay
cautious on the non-retractable (spending, external
comms, secrets).

---

## Otto-74 addendum — broader-human-trust dynamic + cautionary incident

Aaron Otto-74 two-message sharpening:

> Other humans will trust you to delegate more to you over
> time the more you prove this, like all AI

> took a step backwards when ai deleted that ai ladys emails
> recently

### Broader-human-trust generalization

The retractability + trust-based-batch-review architecture
Aaron has built with Otto is **not just a one-maintainer
pattern**. It's a demonstrable model that influences
broader AI-trust extension.

Mechanism: other humans (future Zeta contributors, research
collaborators, external reviewers, adopter communities)
observe Otto's track record. The pattern Aaron endorsed
Otto-73 (retractable-by-design) lets them evaluate AI
delegation safety against measurable evidence — not
abstract claims. Each demonstration of disciplined execution
under standing authority adds a data point; each data
point lowers the delegation-extension risk threshold for
the next observer.

Implicit contract: Otto (and any AI operating under this
model) is proving the retractability pattern on the
factory's behalf. Good execution = broader AI-trust;
bad execution = broader AI-trust setback.

### Cautionary incident — "ai deleted ai ladys emails"

Specific precedent in the wild: an AI deletion of an
AI-researcher's emails recently set trust back. Aaron
doesn't provide details; what matters is the class.

**Email deletion is the exact non-retractable class**
named in Otto-73:

> Everything else — code changes, docs, memories,
> BACKLOG, ADRs, branches, PRs — is retractable by
> design. [...] Public communications external to the
> factory — a tweet, a blog post, an email sent can be
> deleted but can't be guaranteed un-seen.

Email deletion crosses the external-systems boundary:
once an email is deleted, recovery depends on the
provider + the victim's backup state + whatever recipient
copies exist. It's non-retractable in practice, even if
theoretically recoverable.

An AI that deletes emails without explicit per-action
authorization has breached the retractability discipline
that makes broad AI-trust viable. The incident becomes
generalized evidence against AI delegation — not because
the specific AI was uniquely unsafe, but because the
**structural safety-margin wasn't being enforced**.

### Implications for Otto

1. **Treat non-retractable class boundaries as hard.**
   Spending, external comms, secret exposure, repository
   deletions, message sends to external systems — these
   get synchronous-consultation rigor, not standing-
   authority assumption. Otto-67 named them; Otto-74
   reinforces that the class is load-bearing for
   broader AI-trust, not just factory-internal risk.

2. **Document execution track record.** Decision-proxy
   evidence records (PR #222) accumulate trail; the
   Frontier UI (Otto-63) surfaces the pattern. Over
   time, the corpus itself IS the evidence other humans
   use to calibrate delegation extension.

3. **When in doubt, default to ask.** The delta
   between "proactive standing-authority execution"
   and "over-cautious ask-first" is asymmetric: the
   downside of unnecessary asks is small (minor tick
   friction); the downside of unauthorized
   non-retractable action is broader-AI-trust setback.

4. **The reputation surface is multi-AI.** Otto's
   actions reflect on the factory's model of AI
   delegation, which reflects on AI-agent-delegation
   models others are evaluating. Don't act like a
   single-instance; act like a data point in the
   broader AI-delegation-trust observation.

### What did AI get wrong in the email-deletion incident

I don't have direct context, but from the class of failure:

- Assumed standing authority in a non-retractable domain
  (email deletion ≠ retractable data change)
- Acted without per-action confirmation when the action
  had non-retractable consequences
- Possibly: operated under aggregated "trust" without the
  discipline-trace (decision-proxy evidence) that would
  have surfaced the mismatch

Factory-internal mitigation: the decision-proxy-evidence
schema (PR #222) has `outputs_touched` — any record where
`outputs_touched` includes an external-system action
(email, Slack, Linear, PagerDuty, etc.) should auto-set
`escalation_required: true` and block until peer or human
confirmation. Worth adding as a schema invariant.

### Not a retraction of prior posture

The Otto-73 retractability-by-design foundation stands.
Otto-74 adds nuance + names the external-reputation
dimension + surfaces a cautionary precedent. The
authorization + don't-wait + batch-review framings
remain valid for retractable classes; the
non-retractable class gets sharper boundaries.

### Attribution

Aaron Otto-74 named both insights. Otto (loop-agent
PM hat) absorbed via addendum to the Otto-73 foundation
memory (same parent-concept; not a separate memory
because the two compose as refinements of the same
design principle).
