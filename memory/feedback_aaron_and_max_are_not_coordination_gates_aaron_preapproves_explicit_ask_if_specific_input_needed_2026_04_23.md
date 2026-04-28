---
name: Aaron + Max are NOT coordination gates — Aaron pre-approves cross-repo work involving Max; "coordination" doesn't mean "waiting for either of them"; ask explicitly if specific input needed on a specific question; 2026-04-23
description: Aaron Otto-90 refinement to the Otto-82 authority-inflation-drift calibration. When Otto's plan says "gated on Aaron + Max coordination", Aaron corrects — that's two gates Otto erroneously attached. Correct framing: Aaron pre-approves, Max pre-approves (for lucent-ksk cross-repo work), Otto proceeds, explicit ask ONLY if a specific input is needed on a specific question. Composes with authority-inflation memory; narrows the signoff-scope further
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-90 (verbatim, in response to Otto-89
framing the 7th-ferry KSK-as-Zeta-module implementation as
"gated on Aaron+Kenji+Max coordination"):

*"gated on Aaron+Kenji+Max coordination no gating on me and
max, i approve if you need something explicit ask"*

## The rule

Neither Aaron nor Max is a **gate** on cross-repo work.

- **Aaron pre-approves** cross-repo (Zeta ↔ lucent-ksk)
  implementation planning and design. Standing authority
  covers this same as any within-repo design work.
- **Max pre-approves** his own substrate (lucent-ksk)
  being engaged in cross-repo work. Otto proceeds; Max is
  not gatekeeping.
- **Kenji (Architect persona, worn by Otto)** is the
  synthesis-hat for cross-repo architectural decisions,
  not an external signoff. Wearing the architect hat is
  an internal process, not a coordination gate.
- **Explicit ask required ONLY for specific questions**.
  If Otto needs a specific piece of information from
  Aaron or Max that only they can provide, ask that
  specific question. Do not frame "coordination" as a
  general ongoing gate.

## How this narrows Otto-82 authority-calibration

Otto-82 named three explicit gates (account-beyond-grant /
spending / named-design-review) + Otto-86 added the
readiness-signal inverse gate. Otto-82's framing was
correct for the signoff categories it named, but:

- **"Coordination" is NOT a fourth signoff category.**
  When Otto wrote "gated on Aaron+Max coordination" for
  KSK-as-Zeta-module implementation, Otto was
  constructing a *fifth* de facto gate: "must wait for
  joint acknowledgment from multiple parties." Aaron
  corrects: that's authority-inflation-drift again, just
  at a multi-party granularity instead of single-party.
- **Pre-approval extends to named collaborators in their
  own named substrate.** Max's lucent-ksk work is pre-
  approved for engagement; Aaron's cross-repo-spanning
  attention is pre-approved for observation / review at
  the Frontier UI, not as a forward gate.
- **Specific-question-ask is allowed and encouraged.**
  The explicit-ask channel exists precisely to avoid
  "coordination" becoming a standing block. If Otto has
  a specific question Max would need to answer (e.g.,
  "what's the planned CBOR schema version in lucent-ksk's
  budget-token encoding?"), ask it. If Otto has a general
  "we should coordinate" instinct, that's the
  authority-inflation pattern returning under a new
  label.

## What's STILL gated (unchanged by this memory)

Otto-82 authority calibration stays in force for:

1. **Account access beyond Otto-67 grant** — adding new
   accounts, paid tier upgrades, scopes beyond the grant.
2. **Spending increases** — new paid seats, new paid
   features, budget increases > 0.
3. **Specifically-asked-for design reviews** — PR #230
   multi-account; PR #239 password-storage; PR #233 Phase
   2+3 email-acquisition; similar Aaron-named
   "I want to review this one" items.
4. **Otto-signals-readiness** — inverse gate from Otto-86
   peer-harness progression memory.

KSK-as-Zeta-module implementation is **NOT** on this list.
Aaron Otto-90 explicitly pre-approved. Otto proceeds
within standing authority. Explicit asks happen on
specific questions.

## Applied to the 7th-ferry absorb candidate queue

Revised authority framing for the 4 remaining candidates
(after PR #261 branding and PR #263 Aminata landed):

| # | Item | Effort | Gate |
|---|---|---|---|
| 1 | KSK-as-Zeta-module implementation | L | **Within standing authority; cross-repo coordination is NOT a gate.** Ask specific questions if needed. |
| 2 | Oracle-scoring research (V + S) | M | Within standing authority; research-grade. |
| 3 | BLAKE3 receipt hashing design | M | Within standing authority; design doc (not implementation). |
| 4 | Aminata threat-model pass | S | ✓ Landed PR #263 Otto-90. |

The only remaining friction on the L item is Otto's own
judgment about effort-budgeting, not an external signoff.

## What this does NOT authorize

- Does NOT authorize skipping Aminata / Codex adversarial
  review. Review remains valuable; it's advisory-not-gate
  per Otto-82 framing. Aminata's Otto-90 pass
  (`docs/research/aminata-threat-model-7th-ferry-oracle-rules-2026-04-23.md`)
  surfaced CRITICAL findings on the oracle rule and
  scoring that warrant design-level attention before
  implementation — review-findings-warrant-response, not
  review-gate-blocks-work.
- Does NOT authorize cross-repo commits to lucent-ksk
  that touch Max's design decisions without naming the
  touch. Symmetric to the "no cross-harness edits"
  discipline from the peer-harness progression
  (Otto-78+/-79/+-86): Otto has commit access to
  lucent-ksk via Otto-67, but touching Max's substrate
  warrants either a PR with Max able to review, or a
  specific-ask to Max first.
- Does NOT authorize proceeding on implementation in
  defiance of Aminata's CRITICAL findings. The oracle
  rule's race conditions and the scoring function's
  parameter-fitting adversary are real; implementation
  should respond to the findings, not override them.
- Does NOT treat "Aaron pre-approves" as "Aaron won't
  read the PRs". Aaron reviews at the Frontier UI
  eventually (Otto-63 / Otto-72); pre-approval means
  "don't wait for the review to start working", not
  "the review won't happen".

## Composition with prior memories

- **Otto-82 authority-inflation-drift**
  (`feedback_aaron_signoff_scope_narrower_than_otto_treating_governance_edits_within_standing_authority_2026_04_23.md`)
  — parent memory; Otto-90 is a continuation narrowing
  the scope further.
- **Otto-72 don't-wait-on-approval**
  (`feedback_aaron_dont_wait_on_approval_log_decisions_frontier_ui_is_his_review_surface_2026_04_24.md`)
  — Aaron reviews asynchronously at the Frontier UI; pre-
  approval is consistent with that pattern.
- **Otto-67 full-GitHub-authorization**
  (`feedback_aaron_full_github_access_authorization_all_acehack_lfg_only_restriction_no_spending_increase_2026_04_23.md`)
  — grants covering lucent-ksk cross-repo access
  technically; Otto-90 sharpens the operational-meaning
  of that grant (it covers coordination-scope cross-repo
  work, not just read access).
- **Otto-86 readiness-signal**
  (`feedback_peer_harness_progression_starts_multi_claude_first_windows_support_concrete_use_case_otto_signals_readiness_2026_04_23.md`)
  — inverse gate pattern; Otto signals readiness, Aaron
  acts. Otto-90 is symmetric: Aaron pre-approves,
  Otto acts. Both are variants of trust-based-approval.
- **Max as first external human contributor**
  (`project_max_human_contributor_lfg_lucent_ksk_amara_5th_ferry_pending_absorb_otto_78_2026_04_23.md`)
  — Max's substrate is genuinely pre-approved-for-engagement
  in cross-repo work per Otto-90. Honor-predecessor rule
  still applies (don't silently rewrite Max's decisions),
  but coordination-gate is not the way to honor it;
  specific-ask on specific-questions is.

## Operational implication for Otto-91+

- **KSK-as-Zeta-module implementation can START when Otto
  budgets it**. No waiting. Design work (interfaces, event
  schemas, property tests) is within standing authority.
- **Oracle-scoring research can START when Otto budgets
  it**. Research-grade doc at `docs/research/`; Aminata's
  Otto-90 pass is the input surface for the v0 design.
- **BLAKE3 receipt hashing design can START when Otto
  budgets it**. Design doc; cross-repo consideration that
  it probably belongs in lucent-ksk per Aminata — a
  specific question Otto can ask Max *if the question
  matters operationally*; otherwise Otto writes the design
  in Zeta first and then cross-refs.
- **Specific-ask channel is the right escalation**. If
  Otto has a question only Aaron or Max can answer, ask
  it. Don't frame it as "blocked on coordination";
  frame it as "question for Aaron/Max: [specific
  question]".
