---
pr_number: 3619
title: "backlog(081KRMEXM0008QG0R000ARAR7P): 081KRHWGX0008QG0R001XFRAHC ID collision \u2014 renumber sweep (Riven cursor-terminal \u2192 next ID)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T22:59:52Z"
merged_at: "2026-05-15T23:01:41Z"
closed_at: "2026-05-15T23:01:41Z"
head_ref: "backlog/b0545-b0498-collision-renumber-sweep-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-16T00:14:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3619: backlog(081KRMEXM0008QG0R000ARAR7P): 081KRHWGX0008QG0R001XFRAHC ID collision — renumber sweep (Riven cursor-terminal → next ID)

## PR description

## Summary

- **Real ID collision** caught by `copilot-pull-request-reviewer` on PR #3604 (tick shard 2217Z thread):
  - `docs/backlog/P1/081KRHWGX0008QG0R001XFRAHC-riven-cursor-terminal-*-2026-05-15.md` (from merged #3603)
  - `docs/backlog/P2/081KRHWGX0008QG0R001XFRAHC-substrate-evolution-algebra-*-2026-05-14.md` (pre-existing)
- Per `b0451_per_collision_renumber_procedure`: first-merged-wins → P2 (2026-05-14) keeps 081KRHWGX0008QG0R001XFRAHC; P1 (2026-05-15) renumbers to next free (081KRMEXM0008QG0R00278KS63).
- This row IS the filed-correction surface; implementation in a follow-up PR.
- P2 priority — collision exists but no active break; address within 1-2 weeks.

## Test plan

- [x] Verified via `git ls-tree origin/main -- docs/backlog/` — both files exist
- [x] Rule discipline confirmed via memory file lookup
- [x] 081KRMEXM0008QG0R000ARAR7P ID allocated via on-disk + in-flight check (081KRMEXM0008QG0R002YSPW1X/0544 in #3614; 081KRMEXM0008QG0R000ARAR7P free)
- [ ] Implementation PR (renumber sweep) to follow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-15T23:02:31Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `b0bcac6436`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T23:03:16Z)

## Pull request overview

Adds a new P2 backlog row (081KRMEXM0008QG0R000ARAR7P) to document and track the discovered 081KRHWGX0008QG0R001XFRAHC ID collision, and to define the intended renumber target/sweep scope for a follow-up implementation PR.

**Changes:**
- Introduces backlog row 081KRMEXM0008QG0R000ARAR7P describing the 081KRHWGX0008QG0R001XFRAHC collision (P1 vs P2 rows) and the “first-merged-wins” renumber procedure reference.
- Captures proposed renumber target (081KRMEXM0008QG0R00278KS63) and a checklist of cross-reference updates to perform in the implementation sweep.
- Records rationale for P2 priority and scope-bounds (filed-correction surface only).


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:47**
* P1: The example command `gh pr list --search "B-NNNN" --state all` won’t actually enumerate the in-flight IDs you list below (it searches for the literal string `B-NNNN`). Use a concrete search term/pattern that matches real PR titles (e.g., the specific IDs, or a prefix like `B-054`), or reword this to describe the check without giving a non-functional command.
```
## Next free ID

At time of filing (2026-05-15T22:55Z), `git ls-tree origin/main` plus `gh pr list --search "B-NNNN" --state all` shows:

- 081KRMEXM0008QG0R0001HY6M6 last on main
- 081KRMEXM0008QG0R002YSPW1X/081KRMEXM0008QG0R003YWZC21 taken in flight (PR #3614, OPEN)
- 081KRMEXM0008QG0R000ARAR7P — THIS ROW, claimed
- **081KRMEXM0008QG0R00278KS63** — next free for the renumber target
```
**docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:70**
* P1: `tick-shards-are-immutable` is referenced as if it’s a named rule, but there’s no such rule/doc in the repo; this reads like a dead xref. Consider linking to an existing authority that states shard immutability (e.g., `docs/hygiene-history/ticks/README.md`, which describes shards as immutable events) or rename this to the actual rule/document name.
```
- Update `id:` frontmatter inside the moved file
- Update any `depends_on:` / `composes_with:` fields in OTHER backlog rows that pointed at 081KRHWGX0008QG0R001XFRAHC in the Riven sense
- Update tick shards that QUOTE the Riven 081KRHWGX0008QG0R001XFRAHC: PER `tick-shards-are-immutable` discipline, do NOT in-place-edit; instead, append a correction note in a new shard OR add a glossary entry in the renumber row
- Update any tools/scripts: rename references via `grep -rln "081KRHWGX0008QG0R001XFRAHC-riven\|081KRHWGX0008QG0R001XFRAHC.*riven" memory/ docs/ .claude/ tools/`
```
**docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:88**
* P2: In the “Composes with” section, `claim-acquire-before-worktree-work.md` and `refresh-before-decide.md` are referenced as bare filenames, but the canonical paths are under `.claude/rules/…`. Consider linking them with their full repo paths (as other backlog rows do) so readers can navigate unambiguously.
```
## Composes with

- The `b0451_per_collision_renumber_procedure` memory (2026-05-14) — same shape, second instance
- The `claim-acquire-before-worktree-work.md` rule's "ID allocation discipline" section — this collision is an instance the discipline is meant to prevent
- `refresh-before-decide.md` invariant at ID-allocation scope — both surfaces (merged + in-flight) must be checked; the Riven-cursor row at 2026-05-15 likely skipped the on-disk 081KRHWGX0008QG0R001XFRAHC P2 check
```
</details>

## Review threads

### Thread 1: docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:66 (unresolved)

**@chatgpt-codex-connector** (2026-05-15T23:02:31Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace wildcard destination in rename command**

The documented sweep command uses a wildcard in the destination (`git mv ... 081KRMEXM0008QG0R00278KS63-riven-*`), which is unsafe in Bash because unmatched destination globs are passed literally; running this as written can rename the file to a path containing a `*` character instead of the intended concrete filename. In the renumber workflow, that would leave the backlog row under an invalid/unexpected name and likely break follow-up references/indexing, so the command should name the exact target file (or compute it programmatically) rather than using a wildcard destination.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:7 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T23:03:16Z):

P1: This backlog row frontmatter is missing the required `last_updated` field (the backlog schema requires it and it should be updated on every content edit). Add `last_updated: 2026-05-15` (or the correct date) to the YAML frontmatter to keep the row schema-compliant.

This issue also appears in the following locations of the same file:
- line 40
- line 67
- line 84
