---
name: FACTORY UPGRADE — verify subagent claims BEFORE any destructive downstream action; NEVER trust-and-bulk-execute; structural rule: a subagent's audit output feeding a destructive operation (prune, delete, bulk-close, force-push, rm -rf, drop-table) MUST pass an independent-verification gate that samples N candidates from the subagent's "safe" classification and ground-truths each; the gate is MANDATORY, not discretionary; applies factory-wide — worktree pruning, branch deletion, PR bulk-closing, memory-file deletion, doc consolidation, any bulk delete/overwrite; near-miss 2026-04-24 where worktree-audit subagent falsely classified 61 worktrees as "0 commits ahead" and Aaron's "prune when ready" directive would have deleted unmerged content if I'd bulk-executed; Aaron Otto-259 2026-04-24 "make sure the factory is upgraded to handle this in the future so you don't almost accidenlty blow away good stuff"
description: Aaron Otto-259 factory-level directive after a near-miss prune of 61 worktrees based on a wrong audit. Captures the structural rule (verify before destructive execution) + the specific validation gate shape. Partner with Otto-257 (clean-default smell) and Otto-258 (automate mostly-fixable). Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Any subagent output that feeds a DESTRUCTIVE
downstream action (prune / delete / bulk-close /
force-push / rm -rf / drop / overwrite) requires an
INDEPENDENT VERIFICATION GATE before execution.**

The gate is NOT discretionary. "I trust this subagent"
is not a valid skip condition. Even good subagents can
and do overclaim.

Direct Aaron quote 2026-04-24:

> *"make sure the factory is upgraded to handle this
> in the future so you don't almost accidenlty blow
> away good stuff"*

## The triggering near-miss

2026-04-24 — I dispatched an Explore subagent to audit
80+ locked worktrees for lost work. Subagent returned:
*"NO LOST WORK detected. All 76 named-branch worktrees
show zero commits ahead of origin/main AND clean
working trees. 61 safe to prune."*

Aaron said "prune when ready ... you can now if you are
100% sure and don't want to double check."

I sample-checked 3 of the 61 allegedly-safe branches
before running the bulk prune. ALL THREE had 1-2
commits ahead of origin/main — directly contradicting
the subagent's "zero commits ahead" claim.

The subagent's methodology was probably "PR exists and
is merged → branch is LANDED → 0 commits ahead," but
squash-merge leaves commits-ahead because the branch
commits are SHA-unique even when their CONTENT landed
via one squash commit on main. The subagent didn't
run `git log origin/main..HEAD` for each branch.

Had I bulk-pruned based on the subagent's claim, I
would have deleted worktrees (and potentially
abandoned the branches) with UNVERIFIED merge status.
Content might have been irrecoverable — the branch
`feat/anti-consensus-gate-amara-graduation-6` had 2
commits ahead of main with no obvious merge trace at
first glance.

## The gate — what it must do

For any DESTRUCTIVE bulk action driven by a subagent
classification:

1. **Sample N candidates** — N ≥ max(3, sqrt(total)).
   For 61 candidates, sample ≥ 8. Select randomly,
   not first-N.
2. **Ground-truth each sample** via primary sources
   (actual `git log`, actual `gh pr view`, actual
   filesystem state) — NOT by re-reading the
   subagent's report.
3. **Compare** against the subagent's classification.
   If ANY sample disagrees, the subagent's entire
   classification is REJECTED — redo the audit with
   stricter methodology.
4. **Only proceed** if 100% of samples agree.
5. **Even then**, prefer dry-run first if the
   destructive tool supports it (`git worktree prune
   --dry-run`, `rm -nv`, `gh pr close --help` for
   message-only preview).

## Where this applies (non-exhaustive)

- **Worktree pruning** — the triggering case
- **Local branch deletion** — `git branch -D`,
  `git branch -d`
- **Remote branch deletion** — `git push origin
  --delete <branch>`
- **PR bulk-closing** — `gh pr close` in a loop
- **Memory file deletion** — `rm memory/*.md`
- **Doc consolidation** — removing or bulk-replacing
  historical-narrative files
- **Cache invalidation** — `rm -rf node_modules`
  (usually safe, but not always)
- **Database destructive ops** — `DROP TABLE`,
  `DELETE FROM ... WHERE`
- **Force-push** — rewrites remote history
- **`git reset --hard`** — discards uncommitted work
- **`git clean -f`** — removes untracked files (may
  include user in-flight state)
- **CI cache purge** — expensive to recompute

## Factory-level implementation (backlog-owed)

Per Otto-258 structural-fix-over-manual-drain:

- **`tools/hygiene/verify-audit.sh`** — generic gate:
  takes a JSON of (candidate, expected-classification)
  tuples, runs the verification rule for the
  classification class, returns 0 only if all
  agree. Classes = `worktree-safe-to-prune`,
  `pr-safe-to-close`, `branch-safe-to-delete`,
  `memory-safe-to-delete`, etc. Each class maps to
  a primary-source verification function.
- **Subagent prompt template** for destructive-feeding
  audits: REQUIRE the subagent to include the raw
  primary-source output for its classifications (not
  just a summary). "For each branch classified as
  SAFE-TO-PRUNE, paste the `git log origin/main..HEAD`
  output in the report. Trust-but-verify at the prompt
  layer, not at the consumer layer."
- **Otto-259 lint rule** — semgrep or custom script
  that catches patterns like `for x in $(...); do gh
  pr close $x; done` without a preceding verification
  call. Fails pre-commit or CI gate.

## Composition with prior memory

- **Otto-232** bulk-close-as-superseded — Otto-259
  tightens: even bulk-close against cascade-pattern
  needs spot-check verification of content-already-
  landed claim for each PR in the cluster, not
  just the 3-signal pattern-match.
- **Otto-234** don't over-correct after realization —
  Otto-259 is the other side: don't over-trust-
  without-verification on the flip direction either.
- **Otto-238** retractability-as-trust-vector —
  Otto-259 makes destructive actions LESS-easily-
  retractable because verification IS the
  retractability discipline applied before the
  action. Delete + discover-loss + recover is more
  expensive than verify + delete-correctly.
- **Otto-254** roll-forward default — Otto-259
  doesn't contradict: forward-rolling still applies,
  but gate applies to the "delete this branch" kind
  of forward roll just as much as the "revert this
  commit" kind of backward roll. Every destructive
  operation, regardless of direction, requires
  verification.
- **Otto-257** clean-default smell — Otto-259 is the
  execution discipline for the smell detection. The
  smell triggers the audit; Otto-259 governs the
  audit-to-action gate.

## Direct Aaron quote to preserve

> *"make sure the factory is upgraded to handle this
> in the future so you don't almost accidenlty blow
> away good stuff"*

Future Otto: when about to execute a DESTRUCTIVE
action based on ANYONE'S classification (subagent,
tool, external LLM, even past-self), STOP and verify
N samples against ground truth first. A single
disagreement invalidates the entire classification —
redo the audit. Destructive actions are not "trust
the report"; they are "verify-then-act."
