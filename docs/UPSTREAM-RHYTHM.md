# Upstream rhythm — Zeta's fork-first PR cadence

This doc is **Zeta-specific** project configuration for the
`fork-pr-workflow` skill. The skill itself is factory-generic
and defers the upstream-cadence choice to project-level
configuration (see
`.claude/skills/fork-pr-workflow/SKILL.md` §"Optional
overlay: batched upstream rhythm"). This doc is that
configuration for Zeta.

## Terminology — three surfaces, two vocabularies

Zeta has **three surfaces**, each named in its own canonical
vocabulary. No invented labels.

Two of the three come from git (the repo axis):

- **upstream** — `Lucent-Financial-Group/Zeta`. The parent
  repo. Where releases, stable URLs, issue numbers, the
  canonical commit history, and the social / governance
  edge live. GitHub's API confirms the relation:
  `POST /repos/AceHack/Zeta/merge-upstream` pulls *from*
  LFG *into* AceHack.
- **fork** — `AceHack/Zeta`. The fork the human maintainer
  develops on day-to-day. The downstream copy where the
  daily agent loop lands intermediate PRs so the billed
  upstream surfaces (Copilot coding-agent, Actions minutes,
  paid seats) aren't charged per-PR. Lower CI cost, faster
  iteration.

The third comes from testing/QA vocabulary (the role axis):

- **system under test (SUT)** — the Zeta product itself:
  `src/**`, `openspec/specs/**`, `tools/tla/specs/**.tla`
  (the TLA+ formal specs the product must satisfy — SUT
  by role even though they live under `tools/`), tests,
  libraries, the retractable-contract ledger. Distinct from
  the **factory** (the tooling that builds and tests the SUT:
  `.claude/**`, agents, skills, most of `tools/**`,
  `docs/hygiene-history/**`). Both upstream and fork contain
  SUT content and factory content; the SUT/factory distinction
  is *not* about which repo or directory hosts the bits but
  about what role the bits play. (Worked example: TLA+ specs
  live under `tools/` by location but are SUT by role; most
  of the rest of `tools/` is factory by role.)

The three surfaces compose: SUT and factory both live inside
either upstream or fork; the rhythm described in this doc
governs only the **upstream ↔ fork** cadence, not the
**SUT ↔ factory** boundary (that lives in
`docs/FACTORY-METHODOLOGIES.md` and the people-optimizer
notes).

The fork exists to feed into upstream. When fork-vs-upstream
disagree on anything (scope, contents, governance), upstream
wins.

Operationally, the agent loop *targets* the fork for most PRs
(see next section); that is a cost-optimization, not a
redefinition. Upstream is still the repo-of-record.

Lineage: this section adapts AceHack commit `268100a` (Round 44 — *"3 surfaces, not 2"*) into the upstream LFG version per the option-c rewrite-into-current-architecture sync discipline (`docs/sync/acehack-to-lfg-cherry-pick-audit-2026-04-26.md`). The AceHack commit's substantive contribution was the three-surfaces vocabulary; this version preserves LFG's existing wording around upstream/fork while adding the SUT/factory orthogonality framing.

## Zeta's choice: batched fork-first rhythm

**Default PR target for daily agent work:** the fork
(`AceHack/Zeta:main`) — **not** upstream
(`Lucent-Financial-Group/Zeta:main`).

Agents develop on fork feature branches, open PRs against the
fork's `main`, auto-merge there. The fork's free-tier CI
minutes run the gate. Once `AceHack/Zeta:main` is ~10 commits
ahead of `Lucent-Financial-Group/Zeta:main`, **one** bulk sync
PR lifts all accumulated work into upstream.

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
  LFG has budget caps. The caps protect the human
  maintainer's wallet; the risk they don't protect against
  is *build-grinds-to-a-halt when the free allowance
  exhausts.*
- **Poor-man's setup.** The human maintainer's framing
  2026-04-22: *"This is the poor mans setup got to bet money
  concious"*. The batched rhythm is an explicit
  cost-amortization overlay, not a discipline failure.

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
gh api /repos/AceHack/Zeta/compare/main...Lucent-Financial-Group:main \
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
#
# NOTE: use --merge (not --squash) for the bulk sync PR.
# Squash rewrites history so LFG/main is no longer a
# descendant of AceHack/main, which breaks the subsequent
# forward-sync step (it cannot be a true fast-forward and
# may fail under stricter branch settings). A merge commit
# preserves the ancestry relationship the forward-sync
# needs and keeps ahead/behind counts accurate for the
# cadence monitor.
gh pr merge <N> --repo Lucent-Financial-Group/Zeta --auto --merge
```

### Forward-sync AceHack/main from LFG/main (after a bulk sync)

After the bulk sync merges to LFG, sync AceHack/main forward
so the two mains match:

```bash
# GitHub's fork-upstream sync API — fast-forward AceHack's
# main from its parent (LFG/Zeta). Because the bulk-sync PR
# above used --merge (not --squash), LFG/main remains a
# descendant of AceHack/main and this call is a true
# fast-forward.
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
3. **Human maintainer explicit request** — *"push this one
   direct to LFG"* overrides the rhythm. (AceHack-side
   wording: "Aaron explicit request" — same rule, named
   maintainer.)
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
> `gh api /repos/AceHack/Zeta/compare/main...Lucent-Financial-Group:main`
> and flag if AceHack is >15 commits ahead (over-threshold) or
> >30 days since last sync (stale-threshold).

Not yet filed; flag in a later round if the rhythm proves
unstable in practice.

## Provenance

The rhythm derives from maintainer direction captured in
per-user agent memory (not checked into the repo; see
`docs/CONTRIBUTOR-PERSONAS.md` on the memory split between
in-repo artifacts and per-user agent state). The load-bearing
decisions — "bulk-sync every ~10 PRs," "cost-model of paid vs
free surfaces," "poor-man's setup posture" — all traced back
to 2026-04-21 / 2026-04-22 maintainer clarifications that
collapsed earlier per-PR-to-LFG defaults into the batched
shape described above.

## Source memories

*(AceHack-side: explicit memory-file references for the
underlying directives. LFG-side keeps these out of the
in-repo doc per the per-user-agent-memory split described in
Provenance above; preserved here so the memory pointers are
not lost during sync.)*

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
