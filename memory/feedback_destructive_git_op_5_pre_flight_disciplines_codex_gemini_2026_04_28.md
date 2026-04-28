---
name: Five pre-flight disciplines for destructive git operations (Codex + Gemini caught Otto missing them, Aaron 2026-04-28)
description: Aaron 2026-04-28T18:18Z — Codex + Gemini's cross-CLI verification on a proposed AceHack→LFG hard-reset surfaced 5 risks Otto missed. These ARE Otto's functionality (not external concerns); future-Otto MUST run these 5 checks before EVERY destructive git operation. Tree-diff ≠ history-preservation; timestamp-newer is weak evidence (need per-blob subsumption); commit messages / PR refs / AgencySignature provenance count as content; force-push needs --force-with-lease=ref:exact-old-sha; freshness risk requires fresh-fetched refs not cached state. Composes with Otto-347 (cross-CLI verify on destructive ops) — these 5 disciplines are what the cross-CLI check VERIFIES.
type: feedback
---

# Five pre-flight disciplines for destructive git operations

## The rule (Aaron verbatim 2026-04-28T18:18Z)

> *"update the substrate to protect yourself better i the future?
> Risks I missed (per Codex): ... These are your functonality."*

The 5 risks Codex flagged on my AceHack→LFG hard-reset proposal are
NOT external concerns — they are Otto's own functionality. Future-Otto
must run all 5 checks BEFORE proposing any destructive git operation
(force-push, hard-reset, branch-delete, history-rewrite).

## The 5 pre-flight disciplines

### 1. Tree-diff ≠ history preservation

**Failure mode**: I framed the hard-reset as "content-safe" because the
file-level tree-diff showed only 24 M files of divergence. But the
146-commit history on AceHack contains intermediate substrate
(memory blobs, research-doc snapshots, partial WIP commits) that
exists in the COMMIT HISTORY but not necessarily in the TIP TREE.
A hard-reset destroys the history while preserving only the tip.

**Discipline**: Before any destructive op that rewrites history:
- Run `git log <branch> ^<target> --all --format="%H %s"` to enumerate
  every commit that would be lost.
- For each commit, classify its substrate value (PRESENT-on-target /
  INTENTIONALLY-SUPERSEDED / DISPOSABLE).
- Tree-state convergence is a NECESSARY but NOT SUFFICIENT condition
  for "content-safe."

### 2. Timestamp-newer is weak evidence

**Failure mode**: I categorized files as "LFG-newer" or "AceHack-newer"
based on `git log -1 --format=%at` timestamps and treated "LFG-newer"
as "LFG canonical, AceHack will gain on reset." But timestamp-newer
does NOT imply "newer fully contains older's content." Two
independent commits at different times can produce divergent content
that requires manual merging.

**Discipline**: Per-blob subsumption proof, not just timestamp:
- For each modified file, diff AceHack's version against LFG's version.
- Determine if LFG's content CONTAINS AceHack's substantive content
  (additive case) or REPLACES it (overwrite case).
- For overwrite cases, manually verify what was lost and whether
  it's intentional.
- For content-level subsumption: there's no single git primitive
  that proves "blob B contains the substantive content of blob A".
  Use:
  ```bash
  git show <ace-commit>:<path> > /tmp/ace.txt
  git show <lfg-commit>:<path> > /tmp/lfg.txt
  diff -u /tmp/ace.txt /tmp/lfg.txt
  ```
  For append-only files all changes should be `+` lines (LFG adds);
  for overwrite-style files manually verify substantive overlap.
  The often-misused `git merge-base --is-ancestor` is for COMMITS,
  not blobs — don't reach for it here. NOT `git log -1 --format=%at`.

### 3. Commit messages / PR refs / AgencySignature provenance count as content

**Failure mode**: I treated "content" as "file tree state." But Zeta's
git-as-experiment-substrate framing means commit MESSAGES carry
load-bearing content too: PR numbers, AgencySignature trailers,
review-context narrative, decision attribution. Squash-merging on
LFG often DOES preserve the substantive commit message; but
hard-reset destroys the AceHack-side commit graph entirely,
including any commit messages that didn't squash-mirror.

**Discipline**: When auditing a destructive op, also enumerate:
- Commit messages that contain unique decision-attribution prose.
- AgencySignature trailers that aren't already on the target side.
- PR numbers / review-context references that wouldn't survive squash.
- Co-Authored-By trailers that document agent contribution.

The ferry/squash flow IS designed to preserve this content via the
merge commit on the target side; verify the merge commits exist
on LFG before treating the AceHack commit graph as disposable.

### 4. Force-push race risk → --force-with-lease=ref:exact-old-sha

**Failure mode**: Bare `git push --force` overwrites whatever's at
the target ref, even if a concurrent push has updated it. On a
shared remote with auto-merge bots, that race-window is real.
`--force-with-lease` without an explicit SHA still races against
the local cache.

**Discipline**: Always use the exact-SHA form:

```bash
git push --force-with-lease=main:<exact-old-acehack-sha> acehack origin/main:main
```

This makes the force-push fail-safe: if the remote has moved since
my last fetch, the push is rejected (rather than silently
overwriting concurrent changes).

### 5. Freshness risk → fresh-fetched refs, not cached state

**Failure mode**: All my divergence claims (`gh api compare`,
`git log A..B`, file diffs) used local cached refs. If the AceHack
remote advanced between my fetch and my reset, the reset would
destroy newer content I never saw.

**Discipline**: Before any destructive op:

```bash
# Freeze refs at known state. NOTE: `git fetch --prune origin acehack`
# fetches ONLY from `origin` (`acehack` is treated as a refspec, not
# remote name). To fetch BOTH remotes, use one of:
git fetch --multiple --prune origin acehack
# OR sequentially:
git fetch --prune origin
git fetch --prune acehack

LFG_TIP=$(git rev-parse origin/main)
ACE_TIP=$(git rev-parse acehack/main)
echo "LFG: $LFG_TIP | AceHack: $ACE_TIP"
# All audits run AGAINST these specific SHAs, not against
# moving refs.
```

The destructive op then references those frozen SHAs explicitly:
`--force-with-lease=main:$ACE_TIP` ensures it fails if AceHack
has moved.

## When to apply the 5 disciplines

EVERY destructive git operation:

- `git push --force` / `--force-with-lease` (any branch)
- `git reset --hard` against a remote-tracking ref
- `git branch -D <branch>` (deleting unmerged branches)
- `git rebase -i` followed by force-push (history rewrite)
- `git filter-branch` / `git filter-repo`
- Hard-resets of dev-mirror forks back to project-trunk forks
- Any operation that would change the exact-SHA shape of a published
  ref

NOT required for:

- Normal `git push` (fast-forward only)
- Branch creation / merging (additive)
- File-level edits in working tree (no ref change)
- Local-only operations that don't touch remotes

## Composes with

- Otto-347 — cross-CLI verify on hard problems / destructive ops.
  These 5 disciplines are WHAT the cross-CLI check verifies. Without
  this list, the cross-CLI prompt is too vague.
- `feedback_only_pushed_signal_is_aaron_typing_everything_else_is_pull_aaron_2026_04_28.md`
  — same family: don't claim a state without pulling fresh evidence.
- `feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — "content-safe" without per-blob subsumption proof IS speculation
  about the world.
- `docs/AGENT-BEST-PRACTICES.md` — would gain a BP-NN rule citing
  this memory; the rule is essentially "destructive git ops require
  the 5 pre-flight disciplines."
- Otto-238 retractability — destructive ops violate retractability
  by definition; the 5 disciplines minimize what's lost when
  retractability is intentionally given up.

## Future-Otto checklist

Before proposing or executing any destructive git operation, copy
this checklist into the proposal and check each box:

- [ ] **Discipline 1**: Enumerated every commit that would be lost
  (`git log <branch> ^<target> --all --format=%H %s`); classified
  each as PRESENT / SUPERSEDED / DISPOSABLE.
- [ ] **Discipline 2**: For each modified file, verified per-blob
  subsumption (LFG's content contains AceHack's substantive
  content) — NOT just timestamp comparison.
- [ ] **Discipline 3**: Enumerated commit messages / PR refs /
  AgencySignature trailers / Co-Authored-By that exist only on
  the to-be-destroyed history; verified they're preserved on the
  target via squash-merge or are explicitly disposable.
- [ ] **Discipline 4**: Force-push command uses
  `--force-with-lease=<ref>:<exact-old-sha>`, NOT bare `--force`.
- [ ] **Discipline 5**: Refs were freshly fetched immediately
  before the audit; SHAs are frozen and referenced explicitly in
  the destructive command.
- [ ] **Cross-CLI verify (Otto-347)**: At least one peer-CLI
  (Codex / Gemini / Grok) independently verified the 5 disciplines
  pass.

If ALL 6 boxes check, proceed. If ANY don't, pause for human nod.
