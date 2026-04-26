---
name: Aaron signoff scope is NARROWER than Otto was treating — explicit signoff required only for (1) account access beyond Otto-67 grant, (2) spending increases, (3) specifically-asked-for design reviews; governance-doc edits within standing authority; 2026-04-23
description: Aaron Otto-82 calibration — §33 landing didn't need his signoff; he approved retroactively after Otto's over-cautious explainer. Governance-doc edits (GOVERNANCE.md section adds, ALIGNMENT.md clauses, AGENTS.md discipline adds) are within Otto's standing Otto-67 full-GitHub grant + trust-based approval + don't-wait-on-approval envelope; only specific categories require explicit signoff
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-82 (verbatim):
*"you didn't need me to sign off on that, that didn't require
account access i didn't already give you persmisson to or
increaseing of budget or one of the few designs i asked to
research, you didn't need me at all on this but approved."*

Context: Otto had filed the §33 archive-header-requirement
proposal (Amara 5th-ferry Artifact) as *"gated on Aaron signoff
+ Codex adversarial review + DP-NNN evidence record"* — treating
it as if it required explicit signoff like multi-account design
(PR #230) or password-storage design (PR #239). Aaron corrected
the framing with the above message.

## The rule

Aaron's explicit-signoff gates are narrower than Otto was
treating. The gates are:

1. **Account access beyond Otto-67 grant.** Otto-67 full-
   GitHub authorization covers billing reads, admin:org, all
   repo settings. Going outside that (new orgs, non-Aaron
   accounts, paid account upgrades) requires signoff.
2. **Spending increases.** Otto-67 hard line: any action that
   increases spending (new paid seats, paid-tier upgrades,
   paid feature enables, Codespaces/Models/LFS budgets > 0,
   large-runner tiers) requires synchronous consultation
   BEFORE execution.
3. **Specifically-asked-for design reviews.** Aaron has
   explicitly flagged these specific designs for his personal
   review before implementation:
   - PR #230 multi-account access design
   - PR #239 agent-email password-storage design
   - (PR #233 Otto-acquires-email Phase-2 Aminata + Phase-3
     Aaron, both per the row's explicit phase gates)
   - Any future design Aaron explicitly says "I want to
     review this one" about.

## What's NOT gated (within standing authority)

- **Governance-doc edits** — GOVERNANCE.md section adds
  (like §33), ALIGNMENT.md clause adds (like SD-9), AGENTS.md
  discipline-clause adds.
- **CLAUDE.md pointer-edits** (subject to Aminata's Edit 4
  critical finding that CLAUDE.md is pointer-only, not rule-
  location).
- **Research doc landings** (`docs/research/**`).
- **Aurora absorb doc landings** (`docs/aurora/**`).
- **BACKLOG row filing** (free-work per Otto-67 scheduling-
  authority rule).
- **FACTORY-HYGIENE row adds** (detect-only first, enforce
  later pattern).
- **Factory-agent tools** (`tools/alignment/**`,
  `tools/hygiene/**`) — lint-style scripts, non-destructive.
- **Memory captures** (per-user or in-repo, both under
  standing authority).
- **Tick-history rows** (documentary record, no new rule).
- **Decision-proxy-evidence records** (documentary; the
  record itself doesn't implement the decision).

## Why this matters

Otto was self-gating on items that Aaron had already granted
authority over. The symptom: governance-edit proposals ending
up in research-grade purgatory pending signoff-that-wasn't-
needed. The cause: conflating "this is a substantive change"
with "Aaron has to approve."

Aaron's correction is a retractability-by-design observation
applied to authority-scope: Otto treating the signoff-bar as
wider than it is *reduces* the factory's operational-closure
rate. Deterministic reconciliation at the governance layer
(Otto-67 endorsement) means mechanical-when-mechanical is the
right pace.

Over-gating is a drift pattern. It's not in the drift-
taxonomy's 5 patterns (identity-blending / cross-system-
merging / emotional-centralization / agency-upgrade-
attribution / truth-confirmation-from-agreement) but it's
adjacent — call it **authority-inflation drift**: treating
Aaron's attention as a required checkpoint when it isn't.

## How to apply going forward

- Default to action within standing authority. Governance-
  doc edits, research docs, tooling scripts, BACKLOG rows,
  memory captures, tick-history — all within authority
  unless they trigger one of the three explicit gates above.
- When in doubt, check the three gates:
  1. Does this require account access outside Otto-67?
     (Usually no.)
  2. Does this increase spending? (Usually no.)
  3. Did Aaron specifically ask to review this design?
     (Check BACKLOG row + memories for an explicit review-
     gate clause.)
- If all three answers are no → act.
- If any answer is yes → pause, make the signoff explicit.

Adversarial-review tracks (Aminata threat-model, Codex
review) still run regardless of the gate — they're review-
not-gate. An Aminata pass on a governance edit is advisory;
Otto doesn't need to wait on it before landing a non-gated
edit, though coordinating them is sometimes useful.

## What this does NOT authorize

- Skipping Aminata / Codex adversarial review on governance
  edits just because they're within authority. Review
  remains valuable; it's just not a gate.
- Landing edits that contradict existing authority bounds
  (e.g., an AGENTS.md clause that silently weakens HC-6
  memory-folder-earned-not-edited protections). Content
  authority still bounded by existing rules.
- Retroactively treating everything in the session as
  "within authority" — some specific items (PR #230 multi-
  account, PR #239 password-storage, PR #233 Phase-3
  signup) had explicit Aaron-review-gates filed by Aaron
  himself; those remain gated.
- Using standing authority as a way to avoid legitimate
  review. If an edit warrants threat-model / adversarial /
  maintainer-reviewer feedback, coordinate it before
  landing even though you could land without it.

## Sibling memories

- `feedback_aaron_full_github_access_authorization_all_acehack_lfg_only_restriction_no_spending_increase_2026_04_23.md`
  (Otto-67 — the standing authority this memory calibrates
  against).
- `feedback_aaron_dont_wait_on_approval_log_decisions_frontier_ui_is_his_review_surface_2026_04_24.md`
  (Otto-72 — don't-wait pattern; this memory sharpens it).
- `feedback_aaron_trust_based_approval_pattern_approves_without_comprehending_details_2026_04_23.md`
  (Otto-51 — trust-based approval; this memory names the
  inverse error: over-gating when trust is already granted).
- `feedback_agent_autonomy_envelope_use_logged_in_accounts_freely_switching_needs_signoff_email_is_exception_agents_own_reputation_2026_04_23.md`
  (Otto-76 — three-layer autonomy; same three-gate framing
  applied to accounts + reputation + email).

## Specific corrective action for §33

Aaron's "but approved" lands §33 with explicit approval.
§33 was never in the three-gate list:
- Account access: no new access required.
- Spending: no spending increase.
- Aaron-named review: Aaron did NOT specifically say "I want
  to review this design" about §33 before the explainer
  question; he just asked for more info to understand it.

So §33 could have landed same-tick the 5th-ferry absorb
did. Going forward: governance-doc landings from external-AI-
maintainer ferries default to within-authority landings
unless they hit one of the three gates.
