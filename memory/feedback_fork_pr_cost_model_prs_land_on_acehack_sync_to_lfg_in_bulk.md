---
name: Fork-PR cost model — PRs land on AceHack, bulk-sync to LFG only every ~10
description: Aaron 2026-04-22 correction — the "every 10 PRs" rhythm means PRs target AceHack/Zeta:main (free CI, no LFG Copilot billing) and accumulate there; one bulk AceHack/main → LFG/main sync happens every ~10 batches. Agent was opening individual PRs against LFG which triggered LFG Copilot + Actions per PR = the expensive path. Money-conscious factory default: the fork is the work surface; LFG is the publish surface.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule:** Day-to-day agent PRs target
`AceHack/Zeta:<branch> → AceHack/Zeta:main`, not
`AceHack/Zeta:<branch> → Lucent-Financial-Group/Zeta:main`.
AceHack's CI + merge-queue runs on AceHack's free minutes;
LFG's Copilot code-review + LFG Actions billing is paid
once per *bulk sync*, not once per PR.

Bulk sync happens roughly every 10 PRs: one
`AceHack/Zeta:main → Lucent-Financial-Group/Zeta:main` PR
that carries the accumulated work. LFG Copilot + LFG Actions
run on that one sync PR.

**Why:** Aaron 2026-04-22, quoted verbatim:

> "nah so the way you are doing it is still expensive i
> can't thiink of a way to update the factory to have make
> you recgonize you are money inefficent right now. When I
> said every 10 prs. I was thinkg you would be pushing to
> main on AceHack for 10 prs and then all 10 in 1 from main
> to main on LFG. This is the poor mans setup got to bet
> money concious."

And the follow-up clarification on blast-radius:

> "this is not an ememrgency, rmember you can't cost me
> real money the build will just stop working on LFG when i
> run out of free credits."

So the concrete risk is **LFG build grinds to a halt when
free-tier Actions minutes exhaust** — not dollars flowing
out. Budget caps protect Aaron's wallet; the rule protects
the factory's LFG-side *functioning*. Still load-bearing —
a dead LFG CI means PRs can't gate, sync PRs can't validate,
adopters can't see a green build — but it's prudence, not
panic.

And the anchoring cost-reality memory:

- `project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — LFG pays for Copilot + models; AceHack is free. Every PR
  opened against LFG pays; every PR opened against AceHack
  does not.

The agent's prior pattern (PRs 45, 51, 52, 53 all opened
directly against `Lucent-Financial-Group/Zeta:main`) paid the
LFG Copilot + Actions cost *per PR*. Wrong direction. The
"every 10 PRs" rhythm was supposed to amortize LFG cost **by
a factor of 10**.

**How to apply:**

1. **Default PR target is AceHack, not LFG.** When opening a
   PR via the fork-PR workflow, the default command is:
   ```bash
   gh pr create --repo AceHack/Zeta \
     --head AceHack:<branch> \
     --base main \
     --title ...
   ```
   NOT `--repo Lucent-Financial-Group/Zeta`.

2. **Auto-merge on AceHack.** `gh pr merge <N> --repo
   AceHack/Zeta --auto --squash` — AceHack's CI runs the
   gate, AceHack's merge queue processes.

3. **Bulk-sync threshold.** Once `AceHack/Zeta:main` is
   ~10 commits ahead of `Lucent-Financial-Group/Zeta:main`,
   open **one** sync PR:
   ```bash
   # From AceHack/Zeta's main branch
   gh pr create --repo Lucent-Financial-Group/Zeta \
     --head AceHack:main \
     --base main \
     --title "Sync: AceHack/Zeta:main → LFG/Zeta:main (N PRs)" \
     --body "$(cat <<'EOF'
   ## Summary
   Bulk upstream sync per the 10-PR cost-efficiency rhythm.
   
   ## Included PRs
   (listed by `git log LFG/main..AceHack/main --oneline`)
   
   ## Cost rationale
   Bulk sync = LFG Copilot + Actions run once for N PRs'
   worth of work, not N times.
   EOF
   )"
   ```
   LFG Copilot + Actions run *once* on this bulk PR.

4. **Threshold is a suggestion, not a hard rule.** The
   Aaron message says "every 10 prs"; anything from 5-20 is
   reasonable. Urgent fixes (security, P0 bugs) can sync
   sooner. Pure speculative factory work can wait longer.
   The principle is "one-to-many cost amortization", not
   "exactly 10".

5. **When LFG sync is required sooner than 10 PRs:**
   - Security P0 (any Mateo / Nazar / Aminata finding)
   - External contributor depends on the change (rare pre-v1)
   - Aaron explicitly requests the sync

6. **Sunk-cost handling.** If LFG PRs are already open when
   this rule is adopted, let them finish rather than closing
   them — CI has already run, cost is paid. Don't double-pay
   by closing + re-opening on AceHack. *Exception:* if LFG
   CI is red and blocking, consider closing + reopening on
   AceHack to avoid re-running LFG CI on a fix.

7. **Poor-man's setup framing.** Aaron's words: "This is the
   poor mans setup got to bet money concious". The cost
   discipline is load-bearing for the whole factory — without
   it, LFG billing scales linearly with PR count, which
   defeats the fork-based workflow's whole point.

**Cross-reference to existing memories:**

- `feedback_fork_based_pr_workflow_for_personal_copilot_usage.md`
  — the workflow existed; this memory fixes the target
  direction (AceHack, not LFG by default).
- `feedback_fork_upstream_batched_every_10_prs_rhythm.md` —
  already stated "every 10 PRs" but the agent interpreted
  that as "per-PR to LFG with a 10-row ledger somewhere"
  instead of "PRs to AceHack, sync to LFG every 10".
- `feedback_lfg_budgets_set_permits_free_experimentation.md`
  — LFG budgets are set, but budgets aren't free; budget ≠
  cost-invisible.
- `project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — the cost-reality this rule responds to.

**Factory artifacts to update / create:**

- `docs/UPSTREAM-RHYTHM.md` — Zeta-specific upstream-sync
  cadence doc should carry this model as the concrete
  "what PR target goes where" section.
- `.claude/skills/fork-pr-workflow/SKILL.md` — the skill
  must make AceHack-first the default `gh pr create` call,
  with LFG as the bulk-sync exception.
- `docs/FACTORY-HYGIENE.md` — candidate row: "bulk-sync
  cadence monitor" (every N rounds check if AceHack is
  ahead by ~10+ and flag).

**Source:** Aaron direct message 2026-04-22 during round-44
speculative drain. Message triggered by agent opening PRs
#51, #52, #53 all against LFG in sequence — the exact
anti-pattern this rule corrects.
