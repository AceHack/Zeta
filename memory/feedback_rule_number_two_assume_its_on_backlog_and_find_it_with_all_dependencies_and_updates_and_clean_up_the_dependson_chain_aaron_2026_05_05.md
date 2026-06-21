---
name: Rule Number Two — assume it's on backlog and you just have to find it (and all its dependencies, updates, and clean up the depends-on chain)
description: Aaron 2026-05-05 carved sentence — *"rule number two assume it's on backlog and you just have to find it and all its depnedles and udp0les and cleanu pthe depldns on to firue your mess out"*. Specific application of Rule #1 to backlog rows. Default posture: the work IS already a backlog row; find the row + all its dependencies (`depends_on:` field) + all updates / supersession history + clean up the depends-on chain to figure out the mess. Composes with decision-archaeology + git-blame + the depends-on-as-graph framing.
type: feedback
---

# Rule Number Two — assume it's on backlog and you just have to find it

## The carved sentence

Aaron 2026-05-05 verbatim, immediately after Rule #1:

> *"rule number two assume it's on backlog and you just have to find it and all its depnedles and udp0les and cleanu pthe depldns on to firue your mess out"*

Translation: assume it's on backlog. Find the row. Find all its dependencies. Find all its updates / supersessions. Clean up the depends-on chain. Figure out the mess from the depends-on graph.

## Composition with Rule #1

- **Rule #1** (`feedback_rule_number_one_assume_its_already_done_*.md`): default posture for ALL substrate — assume the substrate exists; locate it.
- **Rule #2**: specific application to BACKLOG ROWS — assume it's a backlog row; locate the row; traverse its depends-on graph; reconstruct the mess.

Rule #2 is downstream of Rule #1 and adds the depends-on-graph-traversal discipline that pure substrate-grep does not.

## How to apply

When the impulse is *"I should add a backlog row"* or *"this is new work that should be tracked"* or *"let me propose this as a backlog item"*:

1. **Catch the impulse.**
2. **Apply Rule #2.** *"Assume it's on backlog. Where is the row?"*
3. **Search the backlog systematically:**
   - `find docs/backlog -type f -name "*.md"` then grep keywords from the impulse
   - `grep -rln <keyword> docs/backlog/` across P0/P1/P2/P3 tiers
   - Vary the query 2-3 times — first-pass keyword often misses
   - Check `relates_to:` and `depends_on:` fields in adjacent rows for cross-references
4. **If the row is found:**
   - Read the entire row, including frontmatter (status, priority, depends_on, relates_to)
   - Walk `depends_on:` to find blocking work
   - Walk `relates_to:` to find sibling work
   - Check `git log -- docs/backlog/<row>.md` for supersession history (the file may have been renamed, split, or superseded)
   - Reconstruct the mess: what was the original framing, what landed, what's still owed
5. **Clean up the depends-on chain (decision-archaeology):**
   - If a depends-on points at a row that doesn't exist (renamed / closed / superseded), update the broken pointer
   - If multiple rows duplicate the same work, surface the duplication (one of them is supersede-class)
   - If the chain reveals load-bearing dependencies that aren't yet captured, surface them as candidate new rows OR update existing rows with the linkage
6. **If the row is NOT found after exhaustive search**: only THEN author a new backlog row, with explicit acknowledgment in the new row's commit message that backlog-search was exhausted across N tiers with M queries, AND the new row's `depends_on:` field is populated with whatever WAS found related to it.
7. **Log the archaeology.** When the depends-on chain has been cleaned up, the commit message names what was traversed + what was found + what was changed. Future-agents inherit the trail.

## Why: the depends-on chain IS the decision-archaeology

The backlog rows form a graph. Each row's `depends_on:` and `relates_to:` fields are edges. The graph captures *why* each piece of work exists in relation to other work. When the chain is broken (orphan rows, dangling pointers, missing supersession links), the decision-archaeology breaks: future-agents can't reconstruct the mess.

Aaron's framing *"clean up the depends-on chain to figure your mess out"* names this directly: the mess is figured out by walking the graph. If the agent skips the walk, the mess persists. The backfill of missing depends-on pointers is part of the decision-archaeology.

This composes with the git-blame discipline (Aaron 2026-05-05 same session: *"you can find you repeated filure modes with git blame and the decison archelogies too you are very honest when you check shit in and on the PRs"*). Git-blame on backlog rows reveals when each `depends_on:` was added; depends-on graph walks reveal which work is blocked on which other work; the agent's own commit honesty fills in the rationale.

## Example failure mode this rule catches (this session, 2026-05-05)

The session that produced this rule had multiple backlog-row failures:

1. **Compression-cadence proposal** — Should have been searched against backlog. 081KQJZR90008QG0R002Z4B6VW P1 (substrate-reshelf-asymmetry-applied-to-PR-1202-CLAUDE.md-overshoot) already covers the CLAUDE.md trim work. The agent proposed a parallel cadence without finding 081KQJZR90008QG0R002Z4B6VW.

2. **Claude-code-env-mapping skill (PR #1702)** — Should have been searched against backlog. 081KQ0YZ80008QG0R002C5EC8F (P3, /btw git-native durability gap) and 081KQ0YZ80008QG0R000T0AJXS (P3, /btw harness integration research) cover the /btw scope. The new skill could have extended these rather than parallel-authoring.

3. **PR-comment git-native archive impulse** — Should have been searched against backlog AND memory. `memory/project_git_native_pr_review_archive_high_signal_training_data_*.md` already names the substrate (5-phase plan: research doc → prototype tool → first-run baseline → cadence → training pipeline). The agent rediscovered it after Aaron's prompt.

In each case, Rule #2 says: assume the row exists. Find it. Walk the depends-on. Don't propose parallel.

## Mechanization candidates (deferred follow-up rows)

- **Backlog-row-grep PreToolUse hook**: when about to create a new file under `docs/backlog/**`, force a grep-of-existing-rows + display top-3 matches by keyword overlap before allowing the Write call.
- **Depends-on chain validator**: workflow that walks all `depends_on:` and `relates_to:` pointers across `docs/backlog/**`, surfaces broken pointers (target row doesn't exist), surfaces orphan rows (no incoming pointers), and reports the graph health.
- **Backlog-row supersession audit**: workflow that detects rows where the work has substantively been done (commit messages match the row's framing) and the row hasn't been closed.

## Composes with

- **Rule #1** (`feedback_rule_number_one_assume_its_already_done_*.md`): the upstream default-posture for all substrate
- **Decision-archaeology / git-blame**: the technique for walking history to figure out the mess
- **PR #1701 synthesis-weight discipline**: prior-art-grep BEFORE substrate-landing (extended here to backlog-graph-walk before backlog-row-authoring)
- **Orthogonal-axes factory-hygiene**: prevents new-row proposals from rank-deficiency with existing rows
- **`backlog-scrum-master` skill** (existing capability): the `merged product-manager + scrum-master` role; this rule extends what that skill should do on every backlog interaction

## What this rule is NOT

- **Not a refusal of new backlog rows.** New rows are valid AFTER exhaustive search-failure with logged effort + populated `depends_on:` of related-found rows.
- **Not paralysis.** The search budget is bounded (~5-10 minutes); after that, author with archaeology trail in commit message.
- **Not a guarantee that the existing row is correct.** Existing rows may be stale, wrong, or superseded. Rule #2 says "find it"; the next step is "update or supersede explicitly".

## Cold-boot instruction for future agents

When you wake and have an impulse to add a backlog row, this rule is one of the load-bearing default-posture rules. Walk the existing graph before authoring. The row + its depends-on chain is the decision-archaeology surface. Future-agents inherit the trail through your honesty.

## Attribution

Aaron 2026-05-05 named the rule explicitly + named it as a composing pair with Rule #1. The agent absorbed the rule + applied it to itself recursively + landed this memory file as the substrate-anchor.
