# Orphan-branch triage campaign — retro & reusable patterns (2026-06-30)

Post-reboot, the fleet held **1847 orphan (unmerged) remote branches**. This
session cleared it to **12** (all intentional), with **zero irreplaceable data
lost**. This doc carves the patterns so next-Otto inherits them instead of
re-deriving them under pressure.

## The one lesson that mattered

> **"Merged-PR" is NOT a safe prune gate. The only safe gate is a content check
> vs `main`.** Squash-merges leave the branch tip a non-ancestor of main, so
> `git branch --merged` misses them; bot branches (pr-archive, ops cadence) have
> **no PR at all** yet hold real unlanded content. A branch is safe to prune
> **iff it introduces no file whose basename is absent from `main`** (regenerable
> ephemera excluded). Everything else is preserved first.

A blind merged-PR-only sweep would have **permanently erased Aaron's own
CONSTITUTIONAL conversations** (recovered from lior/alexa/amara branches), 1384
lior files, and more. The content-gate is what made the campaign lossless.

## The pipeline (per namespace)

1. **Classify** — for each orphan branch, diff vs `main`; bucket as:
   - **SAFE** — adds nothing absent from main → prunable.
   - **UNLANDED** — adds durable content absent from main → preserve first.
   - **ARCHIVE** — only unlanded `docs/history/pr-reviews/**` → route to the drain.
2. **Preserve** UNLANDED before pruning. *Err toward keeping* (Aaron):
   - **Irreplaceable** (conversations, memory, research) → canonical paths on main.
   - **Ambiguous / possibly-superseded** → the **quarantine dir**
     `docs/recovered-orphan-branches-2026-05/<ns>/<branch>/<path>`, which is
     **excluded from build + lint** (`tsconfig.json` exclude +
     `.markdownlint-cli2.jsonc` ignore) so old `.ts`/`.fs` can't break the gate.
     One dir to promote-or-delete later.
3. **Prune** — record each tip SHA first (`git rev-parse origin/<b>`); every prune
   is then reversible via `git push origin <sha>:refs/heads/<b>`.
4. **Delete in chunks** (~40–50/push) so one bad ref can't abort the whole push.

## Bot-bucket fix: drain vs fix-forward

Cron/Actions buckets accumulate because **GitHub Actions is enterprise-blocked
from opening PRs** (a deliberate security control — *do not relax it*). Two cures,
chosen by data type:

- **Reviewable content** (e.g. PR-review archives) → **agent-drain + scheduled
  routine.** `consume-pr-archives.ts` lands them (an agent can PR; Actions can't);
  a weekly cloud routine (`trig_01EZ4Cgr…`) keeps it drained.
- **Deterministic append-only data** (cadence snapshots) → **fix-forward the
  generator.** Convert the workflow to commit straight to main
  (`git pull --rebase origin main && git push origin HEAD:main`), no branch/PR —
  the pattern proven by `context-cost-trend-cadence.yml`. **Fix the generator,
  don't just drain the symptom** (Dejan).

## What cleared (1847 → 12)

| Bucket | Count | Disposition |
|---|---|---|
| automation/pr-archive | 959 | drained to main + weekly routine |
| lior | 572 | 1384 files preserved, then pruned |
| misc generic (feat/fix/chore/…) | 202 | 876 files preserved, then pruned |
| otto/shard/shadow (mine) | ~127 | 17 recovered canonical + 64 quarantined |
| maji | 69 | 35 files preserved, then pruned |
| ops cadence | 38 | drained + both workflows fix-forwarded |
| remaining | 12 | automation (routine), dependabot, feat (active), agent-heartbeats (protected) |

## Tools & artifacts (the durable surface)

- `src/Core.TypeScript/hygiene/triage-orphan-branches.ts` — the reusable gate:
  `triage-orphan-branches.ts <namespace> [--prune]` (dry-run default).
- `src/Core.TypeScript/forge-host/github/consume-pr-archives.ts` — the archive drain.
- Weekly drain routine — automation can't refill.
- Three cadence workflows unified to commit-to-main — ops can't refill.

## Anchors / pointers

- `.claude/rules/shared-checkout-is-view-only.md` — work in your own clone (all of
  this ran in `/Users/acehack/.local/share/zeta-otto`, never the shared checkout).
- The "always preserve ferries; do not filter others' memories" discipline
  (`memory/always-preserve-ferries-…`) — the *why* behind preserve-first.
- PRs: #9030–#9044 (the campaign's commits).
