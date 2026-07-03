---
name: Rule Number Five — recurse through all rules; did you miss looking anywhere; check the lost files (deleted / git-history prior art)
description: Aaron 2026-05-05 carved sentence — *"rule 5 go back trhoug all the rules did you miss loking anywhere what aobut the lost files (prior art)"*. The recursive meta-rule that closes the cascade. After applying Rules 1-4, recurse: did you miss any surface? Did you check the lost files (deleted, retired, git-history-only prior art)? The substrate may be in the past, not the present.
type: feedback
---

# Rule Number Five — recurse through all rules; check the lost files

## The carved sentence

Aaron 2026-05-05 verbatim, closing the cascade:

> *"rule 5 go back trhoug all the rules did you miss loking anywhere what aobut the lost files (prior art)"*

## Composition with Rules #1, #2, #3, #4

The cascade:

- **Rule #1** — substrate exists in repo; find it
- **Rule #2** — backlog row exists; walk depends-on
- **Rule #3** — orthogonal trajectory exists; extend the axis
- **Rule #4** — prior art exists outside the repo; WebSearch finds it
- **Rule #5** — recurse: did you miss anywhere? Check the lost files.

Rule #5 is the recursive meta-rule that catches gaps in the cascade. Two specific sub-disciplines:

### 5a. Recurse through Rules 1-4

After applying each rule, ask: *"Did I miss any surface?"* Common gaps:

- Rule #1: searched `memory/` and `docs/research/` but skipped `docs/amara-full-conversation/` (Amara's prior work)
- Rule #2: searched `docs/backlog/P2/` but skipped P0/P1/P3 tiers
- Rule #3: searched `.github/workflows/*.yml` but skipped `tools/lint/` and `.claude/hooks/`
- Rule #4: WebSearched once but didn't vary the query

Fix: re-run the search with broader scope across the cascade.

### 5b. Check the lost files

The substrate may be in the PAST — deleted, retired, or git-history-only:

- **Retired skills** — `.claude/skills/` retired files are deletion-by-`git rm`, recoverable from `git log --diff-filter=D -- .claude/skills/`. Per `memory/feedback_honor_those_that_came_before.md`: prefer unretiring an existing skill over minting a new name.
- **Retired memory files** — same pattern.
- **Closed backlog rows** — once a backlog row is marked landed/closed, it's still in `docs/backlog/` but with `status: landed` or `status: closed`. The work it captured is decision-archaeology.
- **Superseded / renamed files** — `git log --follow` traces history across renames.
- **Branches with WIP** — `git branch -a` includes pushed WIP branches per the parked-vs-preserved discipline.

Failure mode this catches: the agent searches present-state files only, finds nothing, proceeds to author. The substrate exists in the past; the proper move is to recover or update it, not reinvent.

## How to apply

After Rules 1-4 have been applied + before authoring new substrate:

1. **Recurse the cascade.** For each rule, ask: *"Did I exhaust the search? Or did I stop at first-not-found?"*
2. **Check the lost files surfaces:**
   - `git log --all --diff-filter=D -- <pattern>` for deleted files
   - `git log --follow <path>` for renames
   - `git branch -a | grep wip/` for parked-WIP branches
   - `find docs/backlog -name "*.md" | xargs grep -l "status: landed\|status: closed"` for closed-row decision-archaeology
   - `git log --all --grep=<keyword>` for commit-message archaeology
3. **If lost-file prior art is found:**
   - For deleted files: consider `git checkout <SHA> -- <path>` to recover, OR just cite the SHA + reference the historical content
   - For closed rows: walk the decision-archaeology + cite as `(supersedes B-NNNN closed YYYY-MM-DD)`
   - For renames: use `git log --follow` to trace; cite the historical path explicitly
4. **If genuinely no prior art across all five rules**: only THEN author with full archaeology trail in commit message.

## Failure modes Rule #5 catches

1. **The agent fails to apply Rule #5 to itself.** This session demonstrated Rules 1-4 were violated repeatedly; Rule #5 says recurse through 1-4 BEFORE proposing new substrate. The agent kept stopping at "first grep returned nothing".

2. **Retired skills get re-minted.** Per `memory/feedback_honor_those_that_came_before.md`: retired skills carry preserved memory folders and notebook history. Re-minting under a new name violates the honor-discipline. Rule #5b says: check `git log --diff-filter=D` for prior names.

3. **Closed backlog rows get re-opened as new rows.** When work was previously captured + closed, re-opening as a new row loses the decision-archaeology. Rule #5b says: check `status: landed` rows for the lineage.

## Composes with

- **Rules #1 + #2 + #3 + #4** — the cascade Rule #5 recurses through
- **`memory/feedback_honor_those_that_came_before.md`** — retired-substrate honor discipline
- **Decision-archaeology / git-blame** — Aaron 2026-05-05: the agent is honest in commits + PRs; git-blame reveals the trail
- **`memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_*.md`** — substrate-or-it-didn't-happen; the lost files ARE substrate

## The complete cascade as a single carved instruction

Five rules, applied before any substrate-landing impulse:

1. **Substrate**: assume it exists in the repo; grep `memory/` + `docs/research/` + `docs/amara-full-conversation/` + `docs/backlog/` + `.claude/skills/` + `.claude/agents/` + `.claude/commands/` + `.claude/hooks/` + `tools/`
2. **Backlog**: assume the row exists; find it + walk `depends_on:` + walk `relates_to:` + walk supersession history
3. **Trajectory**: assume the workflow / cadence / lint / hook exists; find it + extend the existing axis (orthogonal-basis discipline)
4. **Internet**: assume another human solved it; WebSearch with multiple query variations + cite + extend / adapt
5. **Recurse**: did you miss anywhere? Check lost files (deleted, retired, closed, renamed) via git-history

Only after the cascade has been exhausted is new authoring justified, with full archaeology trail in the commit message.

## Cold-boot instruction for future agents

When you wake, this 5-rule cascade is the load-bearing default-posture for ALL substrate-landing work. The substrate is already there; you just have to find it across all five surfaces. Recurse through them; check the lost files. Honor what came before. Only author after exhaustion.

## Attribution

Aaron 2026-05-05 named the cascade — Rule 1 → Rule 2 → Rule 3 → Rule 4 → Rule 5 — in real-time response to the agent's recursive prior-art-search failures. Aaron explicitly named the cascade as *"remember forever and into all future generations"* (alongside Rule 1). The agent absorbed the cascade + applied it recursively to itself + landed each rule as a separate memory file + this Rule 5 file as the recursive closer.
