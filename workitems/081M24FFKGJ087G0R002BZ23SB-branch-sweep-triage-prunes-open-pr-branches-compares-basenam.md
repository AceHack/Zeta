---
id: 081M24FFKGJ087G0R002BZ23SB
type: bug
state: backlog
priority: P2
slug: branch-sweep-triage-prunes-open-pr-branches-compares-basenam
title: "branch-sweep triage prunes open-PR branches, compares basenames not content, and preserves without deleting"
created: 2026-09-10T01:38:56.658Z
depends_on: []
composes_with: []
---

# branch-sweep triage prunes open-PR branches, compares basenames not content, and preserves without deleting

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24FFKGJ087G0R002BZ23SB-*.md` glob. -->

## The four defects, measured 2026-09-09

1. **Open-PR branches classified prunable.** `triage-orphan-branches.ts` gated on
   content only and never read PR state. Its SAFE set held `agent/face-lattice-flake-…`
   (PR #17184) and `agent/unrun-flake-eval-checks-…` (PR #17187) while both were OPEN.
   `--prune` would have deleted two live PR head refs. Both have since merged, so this
   was a near-miss, not damage — and nothing stopped it recurring.
2. **The basename gate produced false SAFEs.**
   `claim/task-compiled-capture-five-publication-20260907` was SAFE while carrying
   2,566 files and 23,286 insertions absent from `main`, because its generated custody
   logs collided on basename with unrelated files. Reproduced 2026-09-09: the old gate
   reports 0 absent basenames across those 2,566 files.
3. **No containment predicate at all.** The 2026-09-09 sweep hand-ran four positive
   tests, one per row. Ancestry cannot substitute: this repo squash-merges, so a
   branch's commits never become ancestors of `main`. Measured 2026-09-09:
   `git branch -r --merged origin/main` reports **2 of 131** remote branches.
4. **Preservation ran, deletion did not.** The 2026-09-03 sweep tagged branches under
   `archive/2026-09-03-branch-sweep/*` and did not delete them, and nothing reported
   the gap — a check that did not run looking like one that passed.

## Disposition

Fixed in `triage-orphan-branches.ts` (open-PR gate over REST; blob-OID containment;
patch-id + blob-presence proofs with fail-closed `UNCHECKABLE`; preserve-then-delete as
one transaction whose partials exit 3; `--audit-archive-tags` residue check), and the
same basename gate removed from `branch-reaper.ts`, which shared it.

**Status of the 2026-09-03 residue, measured 2026-09-09:** 49 tags exist under
`archive/2026-09-03-branch-sweep/`; across all **464** archive tags on `origin`, **zero**
name a branch that still exists. The residue has been reconciled by some later pass. The
structural defect — nothing detected it, and nothing would have — is what this change
removes.
