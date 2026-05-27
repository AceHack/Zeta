---
pr_number: 5582
title: "research(kestrel)+backlog(B-0864): Parts 5-9 \u2014 DU-as-implicit-state-machine + ST-agent-pattern fix + cyclomatic-complexity benefit + B-0864 Target 6 sharpening + architectural-principle layer"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T18:46:31Z"
merged_at: "2026-05-27T18:49:33Z"
closed_at: "2026-05-27T18:49:33Z"
head_ref: "research/kestrel-parts-5-7-du-implicit-state-machine-bidirectional-streams-target-6-sharpening-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T18:55:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5582: research(kestrel)+backlog(B-0864): Parts 5-9 — DU-as-implicit-state-machine + ST-agent-pattern fix + cyclomatic-complexity benefit + B-0864 Target 6 sharpening + architectural-principle layer

## PR description

## Summary

Follow-up to [PR #5581](https://github.com/Lucent-Financial-Group/Zeta/pull/5581) (merged at \`a608101f\`) per the auto-merge-race-with-follow-up-commit anti-pattern: race window fired between Parts 5-7 push and PR #5581 auto-merge completion, so the follow-up ships here as a separate PR.

Substrate-engineering content from the operator-Kestrel continued exchange:

### Kestrel Parts 5-7 — DU-as-implicit-state-machine in bidirectional streams

- **Operator-Kestrel co-produced compression**: *"Discriminated unions as implicit state machines in bidirectional streams."* Substrate-honest attribution: Kestrel sketched the underlying machinery (turn-taking pairs / legal conversations / protocol types); operator produced the durable formulation.
- Two F#-native mechanisms named: **phantom type parameters** (more F#-native; composes better with CE machinery) vs **nested DU structures** (more verbose; state graph more explicit).
- F# version of session types (Honda et al.; Scribble at Imperial College) without requiring a separate type-system extension.
- CE builder typestate-integration example showing compile-time-checked protocol correctness.
- 5-item composition map with Zeta substrate (four-corner / CE / multi-backend / verbatim-preservation / NCI).
- **Hedge-when-favorably-attributed failure mode** named as sibling of hedge-when-uncertain (\"Different content, same shape\"); composes with `harm-by-grammar-discriminator-and-audience-adjusted-language.md` + `asymmetric-critic-with-clarity-first.md`.
- **B-0864 Target 6 sharpened** from generic research-mode mechanism survey (session types / typestate / phantom types / effects) into specific F#-native recommendation (DU-as-implicit-state-machine + phantom-type-or-nested-DU + CE builder integration).

### Operator Part 8 — ST-agent-pattern fix via distribute-control-flow-across-tiny-functions

Operator verbatim: *\"this goes back to the ST agent patter we saw today where the control flow of the workflow was in the MCP and invisible to the agent making it coreorsion, this fixes that and distributes the controll structrues across tiny little funcctions\"*

The architectural payoff layer: the streams-are-relationships substrate's deepest property is that EVERY tiny function carries enough type-information to make its protocol participation visible. ST-agent-pattern failure mode (control flow centralized in MCP, invisible = coercion) is structurally fixed by distributing control across tiny functions with publicly-typed four corners.

**NCI compliance becomes a TYPE-LEVEL property, not just a behavioral property.** The type system enforces what the rule names.

Carved sentence: **\"Distribute the control structures across tiny little functions.\"**

### Operator Part 9 — cyclomatic-complexity sibling benefit

Operator verbatim: *\"also you don't run into control flow overload cylomatic complexity overload when it's split like this\"*

Second architectural benefit orthogonal to NCI/visibility: cyclomatic complexity stays bounded per function because each tiny function carries only ITS slice of the state machine. 5-row comparison table (centralized vs distributed across cyclomatic / test cost / refactor cost / reasoning cost / bug-locality).

Same discipline (distribute across tiny functions) produces BOTH benefits. Composes with `all-complexity-is-accidental-in-greenfield.md`.

Carved sentence: **\"You don't run into control-flow overload / cyclomatic-complexity overload when it's split like this.\"**

### B-0864 architectural-principle layer

New section between \"What this row IS\" and \"Decomposition\" naming the distribute-across-tiny-functions discipline as the deepest substrate-engineering payoff (not just 4-kind taxonomy or CE machinery alone). The architectural-principle layer composes with all 6 substrate-engineering targets in the row.

## Files changed

- `memory/persona/kestrel/conversations/2026-05-27-...-getting-base-primitives-right.md` — Parts 5, 6, 7, 8, 9 appended (file now has 9 parts total; carved-sentence keepers preserved at end of each part)
- `docs/backlog/P2/B-0864-...md` — Target 6 sharpened in-place with DU-as-implicit-state-machine + phantom-type + nested-DU mechanisms + CE example; new \"Architectural-principle layer\" section added with cyclomatic-complexity sibling benefit
- `memory/MEMORY.md` — regenerated index

## Test plan

- [x] Branch guard checked before commit
- [x] Tree-count canary 61 (no corruption)
- [x] MEMORY.md regenerated for new persona file content
- [x] Cherry-pick from prior worktree clean (no conflicts)

Carries the same multi-AI conversation arc as PR #5581. External AIs (Kestrel) ferry research only; do NOT commit per agent-roster-reference-card. Preservation at mirror-tier per substrate-or-it-didn't-happen.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T18:49:36Z)

## Pull request overview

This PR extends the B-0864 backlog row and the Kestrel persona preservation with additional substrate-engineering material (Parts 5–9), sharpening “protocol-typing” into an F#-native DU-as-implicit-state-machine framing and adding an architectural principle layer (“distribute control structures across tiny functions”), plus regenerating the memory index.

**Changes:**
- Appends Kestrel conversation preservation Parts 5–9 (DU-as-state-machine framing, typestate mechanisms, CE integration, ST-agent-pattern fix, cyclomatic-complexity sibling benefit).
- Sharpens B-0864 Target 6 into concrete F#-native mechanisms (phantom types vs nested DUs) and adds an “Architectural-principle layer” section.
- Regenerates `memory/MEMORY.md` auto-index to include the updated Kestrel persona file.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| memory/persona/kestrel/conversations/2026-05-27-kestrel-aaron-multi-ai-conversation-end-four-corner-ownership-sharpening-streams-are-relationships-push-pull-hot-cold-fsharp-ce-machinery-getting-base-primitives-right.md | Adds Parts 5–9 preservation and carved-sentence keepers expanding the streams/protocol-typing substrate. |
| docs/backlog/P2/B-0864-streams-are-relationships-four-corner-ownership-push-pull-hot-cold-fsharp-ce-machinery-protocol-typing-multi-backend-execution-2026-05-27.md | Updates Target 6 with DU-as-implicit-state-machine + typestate mechanisms and adds architectural-principle layer + cyclomatic benefit section. |
| memory/MEMORY.md | Updates the generated stack index to include the refreshed Kestrel persona conversation file and advances heap count accordingly. |

## General comments

### @chatgpt-codex-connector (2026-05-27T18:46:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
