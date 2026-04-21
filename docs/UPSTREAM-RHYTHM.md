# Upstream rhythm — Zeta's fork-first PR cadence

This doc is **Zeta-specific** project configuration for the
`fork-pr-workflow` skill. The skill itself is factory-generic
and defers the upstream-cadence choice to project-level
configuration (see
`.claude/skills/fork-pr-workflow/SKILL.md` §"Optional
overlay: batched upstream rhythm"). This doc is that
configuration for Zeta.

## Zeta's choice: batched fork-first rhythm

**Default PR target:** `AceHack/Zeta:main`, not
`Lucent-Financial-Group/Zeta:main`.

Agents develop on fork feature branches, open PRs against
`AceHack/Zeta:main`, auto-merge there. AceHack's free-tier
CI minutes run the gate. Once `AceHack/Zeta:main` is ~10
commits ahead of `Lucent-Financial-Group/Zeta:main`, **one**
bulk sync PR lifts all accumulated work into LFG.

```text
feature-branches (AceHack)
   \ \ \ \ \ \ \ \ \ \
    v v v v v v v v v v
    AceHack/Zeta:main ────────────────────────────┐
    (agent daily loop,                            │
     free CI, free Copilot)                       │
                                                  │ every ~10 PRs
                                                  │ one bulk-sync PR
                                                  v
                                    Lucent-Financial-Group/Zeta:main
                                    (LFG Copilot + Actions
                                     billed ONCE per bulk sync,
                                     not once per PR)
```

## Why Zeta diverges from the industry default

Most OSS projects upstream per-PR. Zeta can't afford that
today because:

- **LFG cost surface.** `Lucent-Financial-Group` is a
  billed GitHub org (Copilot coding-agent, Actions minutes,
  paid seats). Every PR targeting LFG triggers those paid
  surfaces.
- **AceHack is free.** `AceHack/Zeta` is a personal fork on
  a free plan. CI + Copilot on AceHack are zero-cost or
  use free-tier allowances.
- **Budgets are capped, not unlimited.** Per
  `memory/feedback_lfg_budgets_set_permits_free_experimentation.md`,
  LFG has budget caps. The caps protect Aaron's wallet; the
  risk they don't protect against is *build-grinds-to-a-halt
  when the free allowance exhausts.*
- **Poor-man's setup.** Aaron's framing 2026-04-22: *"This
  is the poor mans setup got to bet money concious"*. The
  batched rhythm is an explicit cost-amortization overlay,
  not a discipline failure.

If Zeta ever gets a contributor budget or a sponsor, this
overlay should be re-evaluated. Until then, it stays on.

## Concrete commands

### Default PR (the 90% case)

```bash
# Agent opens a PR from its feature branch to AceHack's main.
gh pr create \
  --repo AceHack/Zeta \
  --head AceHack:<branch> \
  --base main \
  --title "<title>" \
  --body  "<body>"

# Auto-merge on AceHack.
gh pr merge <N> --repo AceHack/Zeta --auto --squash
```

AceHack's CI runs the gate. Merge queue (if enabled on
AceHack) processes the queue. LFG is **not involved**.

### Bulk sync (every ~10 PRs or when explicitly triggered)

```bash
# Precondition: AceHack/Zeta:main is ahead of
# Lucent-Financial-Group/Zeta:main by ~10 commits.
# Check:
gh api /repos/AceHack/Zeta/compare/main...Lucent-Financial-Group:Zeta:main \
  --jq '.status,.ahead_by,.behind_by'
# Expected: "behind" / 0 / N  -- means LFG is behind AceHack by N.

# Open ONE bulk sync PR.
gh pr create \
  --repo Lucent-Financial-Group/Zeta \
  --head AceHack:main \
  --base main \
  --title "Sync: AceHack/Zeta:main → LFG/Zeta:main (batch of N PRs)" \
  --body "$(cat <<EOF
## Summary
Bulk upstream sync per docs/UPSTREAM-RHYTHM.md cadence.

## Included PRs
$(gh pr list --repo AceHack/Zeta --state merged \
    --search 'base:main' --limit 20 \
    --json number,title \
    --jq '.[] | "- #\(.number) \(.title)"')

## Cost rationale
LFG Copilot + Actions run ONCE for this bulk PR instead of
N times for N individual PRs. See docs/UPSTREAM-RHYTHM.md.
EOF
)"

# Auto-merge on LFG (human may manually review; auto-merge
# kicks in once any required reviews are satisfied).
gh pr merge <N> --repo Lucent-Financial-Group/Zeta --auto --squash
```

### Forward-sync AceHack/main from LFG/main (after a bulk sync)

After the bulk sync merges to LFG, sync AceHack/main forward
so the two mains match:

```bash
# GitHub's fork-upstream sync API — fast-forward AceHack's
# main from its parent (LFG/Zeta).
gh api -X POST /repos/AceHack/Zeta/merge-upstream -f branch=main
```

## When to bypass the batched rhythm

Six named exceptions where a change goes direct to LFG
(not through AceHack):

1. **Security P0** — any `docs/BUGS.md` P0-security row,
   any Mateo / Nazar / Aminata finding rated Critical.
   Urgency beats cost.
2. **External-contributor dependency** — a change an
   external contributor is actively waiting on. Zeta is
   pre-v1 so this is rare, but possible.
3. **Aaron explicit request** — *"push this one direct to
   LFG"* overrides the rhythm.
4. **CI-repair to LFG** — when LFG's gate is broken and
   the fix must land on LFG immediately for LFG CI to
   recover.
5. **Bulk-sync PR itself** — the one PR that batches 10
   PRs targets LFG by design.
6. **LFG-only capability experiment** — a deliberate probe
   of a capability that exists on LFG (Copilot Business,
   Teams plan, merge queue, larger Actions runners) but not
   on AceHack. The whole point is to exercise LFG. Cadence
   is throttled per `docs/research/lfg-only-capabilities-
   scout.md`. Not every round.

Outside these cases, default to AceHack. If in doubt, ask.

## Threshold tuning

"~10 PRs" is a suggestion, not a hard rule. Range 5-20 is
reasonable. Factors that move the threshold:

- **Higher** (sync less often): lots of speculative factory
  work that may still churn.
- **Lower** (sync more often): changes that benefit from
  upstream review sooner; risk concentration if the batch
  grows too large to review.

Revisit the threshold every ~5 bulk syncs and record any
change in an ADR under `docs/DECISIONS/`.

## Cadence monitor (proposed)

A candidate FACTORY-HYGIENE row to track:

> Bulk-sync cadence monitor — every round close, run
> `gh api /repos/AceHack/Zeta/compare/main...Lucent-Financial-Group:Zeta:main`
> and flag if AceHack is >15 commits ahead (over-threshold) or
> >30 days since last sync (stale-threshold).

Not yet filed; flag in a later round if the rhythm proves
unstable in practice.

## Source memories

- `memory/feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`
  — 2026-04-22 Aaron correction on misunderstood cost model
- `memory/feedback_fork_upstream_batched_every_10_prs_rhythm.md`
  — original 2026-04-21 "every 10 PRs" directive
- `memory/feedback_fork_based_pr_workflow_for_personal_copilot_usage.md`
  — the underlying fork-PR workflow
- `memory/project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — the cost-reality this rhythm responds to
- `memory/feedback_lfg_budgets_set_permits_free_experimentation.md`
  — budget caps don't make cost invisible
