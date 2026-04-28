---
name: Aaron — "don't wait on me approved, mark down your decisions; I'll review at the frontier UI once it's there" — operational shift; Otto should act under standing authority + log in decision-proxy-evidence, not sit on BLOCKED PRs waiting for per-PR approval
description: Aaron 2026-04-24 Otto-72 — *"i told you don't wait on me approved and just mark down you decisons, i'll review the the frontier ui once it's there"*. Correction to Otto's recurring framing that "queue saturated = I should stop opening PRs". Aaron's actual posture: act under standing authority (Otto-67 full-GitHub grant), log decisions in decision-proxy-evidence YAML (PR #222 schema), don't self-throttle on his approval cadence. Review happens at the Frontier UI surface (Otto-63 burn-rate-UI-adjacent; not-yet-built) in batch, not per-PR. Resolves the "BLOCKED queue = I'm over capacity" tension. BLOCKED means "awaiting automated conversation-resolution + CI green"; Aaron's human click isn't part of the gate Otto should wait for.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Don't wait on approval — log decisions, Frontier UI is Aaron's review surface

## Verbatim (2026-04-24 Otto-72)

Otto-71 closing text had framed reviewer capacity as:

> Opening another PR this tick would have been rush-framing.
> Reviewer capacity is saturated; Aaron's approval cadence
> is unpredictable...

Aaron's correction:

> i told you don't wait on me approved and just mark down
> you decisons, i'll review the the frontier ui once it's
> there

## The rule

**Don't self-throttle on Aaron's approval cadence.** He
approves in batches or at surfaces that don't exist yet
(the Frontier UI). The PR-by-PR "is Aaron about to
approve" framing was my invention; he explicitly doesn't
work that way.

What "BLOCKED" actually means in the PR state:

- All CI green → waiting for **automated** conversation-
  resolution and/or review requirements to clear
- Aaron's personal click is NOT part of the gate Otto
  should wait for
- When conversations resolve (Codex/Copilot findings
  addressed + threads marked resolved) and CI is green,
  auto-merge fires without Aaron touching anything

## Operational shift

Before Otto-72, my pattern:

1. Open PR → hits BLOCKED → "queue saturated" → reduce
   new PR opens → feel constrained by Aaron's unclicked
   approvals

After Otto-72:

1. Open PR → address automated-reviewer findings →
   resolve conversations → let auto-merge fire
2. **Continue shipping substantive work** — the BLOCKED
   count is normal operation, not a saturation signal
3. **Log each decision** in `docs/decision-proxy-evidence/
   DP-NNN.yaml` (PR #222 schema) so when Aaron reviews
   via the Frontier UI (Otto-63), he sees the trail
   without per-PR context-load

## How to apply

### For PR throughput

- Open PRs when the substantive work warrants
- Don't count BLOCKED-on-conversation-resolution as a
  reason to stop
- DO count "Codex/Copilot findings unaddressed" as work
  I should finish before opening more

### For decision logging

When a PR does something Aaron would want to know about
retrospectively (settings change, branch-shaping, scope
claim, etc.), write a `DP-NNN.yaml` at
`docs/decision-proxy-evidence/` same PR or adjacent PR.
That's the mark-down discipline.

### For Frontier UI review expectation

The Frontier UI (Otto-63 burn-rate-UI-adjacent) is
Aaron's future review dashboard. It should surface:

- Decision-proxy evidence records (PR #222 format)
- Burn-rate + cost awareness (Otto-63)
- PR-archive excerpts (Otto-57 archive)
- Hygiene-cadence fire logs
- Memory drift metrics (Amara-ferry-derived)

Each of those substrate items is already being built or
named. The Frontier UI is the aggregation surface. Its
absence today = Aaron reads directly from git + chat;
its presence future = Aaron reads from a dashboard in
batch-review.

### For "don't wait" boundary cases

What DOES warrant asking Aaron synchronously:

- Spending increases (Otto-67 hard line)
- Novel failure classes requiring judgment
- Actions with irreversibility risk beyond routine
  (destructive-ops discipline)
- Explicit maintainer-facing decisions where Aaron
  explicitly wants to be in the loop

Everything else: act under standing authority; log
in decision-proxy-evidence; move on.

## Composes with

- `feedback_aaron_trust_based_approval_pattern_approves_
  without_comprehending_details_2026_04_23.md` (Otto-51)
  — Aaron batches; this directive sharpens: Otto stops
  pre-emptively slowing to match imagined batch cadence
- `feedback_aaron_long_term_solutions_are_quick_enough_
  no_need_for_quick_fix_category_2026_04_23.md`
  (Otto-59) — baseline pace is already fine; this
  directive removes the rationalization-to-slow-down
- `feedback_aaron_full_github_access_authorization_all_
  acehack_lfg_only_restriction_no_spending_increase_
  2026_04_23.md` (Otto-67) — the standing authority Otto
  is told to exercise; "just mark down" IS how to
  exercise it responsibly
- `feedback_codex_as_substantive_reviewer_teamwork_
  pattern_address_findings_honestly_aaron_endorsed_
  2026_04_23.md` (Otto-51) — Codex/Copilot are the
  substantive reviewers to engage with; they ARE the gate
  that matters
- `project_frontier_burn_rate_ui_first_class_git_native_
  for_private_repo_adopters_servicetitan_84_percent_
  2026_04_23.md` (Otto-63) — Frontier UI is the review
  surface Aaron names here explicitly for the first time
- `docs/decision-proxy-evidence/` (PR #222) — the
  logging format; "mark down your decisions" has a place
  to land

## What this directive is NOT

- **Not license to skip substantive work.** The "don't
  wait" applies to Aaron's approval cadence, NOT to
  quality. Codex findings still get addressed; ratchets
  still apply.
- **Not permission to ignore queue size.** If I'm
  opening 10 PRs/tick and reviewer agents can't keep
  up, that's a real throughput problem. Aaron's
  directive is about his OWN cadence, not about
  unbounded volume.
- **Not retraction of the reviewer-capacity heuristic.**
  The 10-PR soft cap (from split-attention memory) was
  specifically about "Aaron's batch-click bandwidth".
  Aaron's Otto-72 directive dissolves THAT specific
  worry. The concern shifts: the limit is now Codex /
  Copilot review throughput + my own ability to address
  findings substantively, not Aaron's clicks.
- **Not authorization for spending.** Otto-67 hard line
  still applies: spending increases require synchronous
  consultation.
- **Not a claim the Frontier UI exists today.** It
  doesn't. But Aaron is naming it as the intended
  review surface, which tells Otto to build SUBSTRATE
  for that surface rather than waiting for per-PR
  chat-approval.

## Attribution

Aaron (human maintainer) corrected Otto's self-throttling
framing Otto-72. Otto (loop-agent PM hat) absorbed + filed
this memory. Future-session Otto inherits: act under
standing authority; log decisions; ship substantively;
Frontier UI is Aaron's intended batch-review surface, not
a per-PR chat cadence.
