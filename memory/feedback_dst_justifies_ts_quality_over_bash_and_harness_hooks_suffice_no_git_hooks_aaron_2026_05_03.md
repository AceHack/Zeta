---
name: DST is the empirical quality justification for TS-over-bash; vibe-coders always have a harness so harness hooks suffice and git hooks are unnecessary (Aaron 2026-05-03)
description: 2026-05-03; Aaron-named two architectural justifications. (1) The TS-over-bash quality preference is grounded in Deterministic Simulation Testing — proper DST is much harder in bash than TS. This is empirical substrate-quality grounding, not just preference. Composes with Otto-272 DST-everywhere + 081KQGDBJ0008QG0R000A4EZS5 TS standardization. (2) Vibe-coders are never without a harness of some kind (Claude Code, Codex, Cursor, etc.); harnesses provide TS runtime (bun) → harness hooks suffice for skill-bundle distribution → git hooks are unnecessary. This simplifies 081KQNJ500008QG0R003ZC6PK8 (hook authoring) scope: harness hooks + CI only, NOT git hooks. The 081KQNJ500008QG0R003ZC6PK8 ground-truth-recovery (PR #1280) was wrong — had 3 hook types including git hooks. Aaron 2026-05-03 verbatim *"to back up my bash is lower quality claim i offer the difficlut of proper Deterministic Simulation in bash vs ts, this is where my quality assesment comes from. i don't think we need git hooks harness hooks are good vibe coders will never be without a harness of some kind"* + *"ts is great"* + *"that's aweseom"*. Future-Otto: TS is canonical; harness hooks are the distribution mechanism; bash exists only for pre-install scripts where the developer/vibe-coder has nothing else.
type: feedback
---

# DST justifies TS-over-bash + harness hooks suffice (no git hooks needed)

## Origin

Aaron 2026-05-03, in autonomous-loop maintainer channel after Otto observed a TS-vs-bash generator divergence on docs/BACKLOG.md (the bash generator and TS generator produced slightly different output; CI used bash, so the TS-generated output failed the drift check):

> *"to back up my bash is lower quality claim i offer the difficlut of proper Deterministic Simulation in bash vs ts, this is where my quality assesment comes from. i don't think we need git hooks harness hooks are good vibe coders will never be without a harness of some kind"*

Plus same-message-cluster affirmations:

> *"ts is great"*

> *"that's aweseom"*

This memo captures two architectural insights from the exchange.

## Insight 1 — DST is the empirical quality justification for TS-over-bash

The TS-over-bash quality preference isn't a stylistic preference. It's grounded in **Deterministic Simulation Testing** capability:

- TS supports proper DST: typed inputs, deterministic outputs, controlled randomness via seed-injection, mockable I/O, structured assertions
- Bash supports DST poorly: weakly typed (everything is a string), output depends on environment + locale + shell version + filesystem state, randomness is hard to control, mocking I/O requires PATH games or wrapper scripts, assertions are typically `[ "$x" = "$y" ]` with no structured failure messages

This is **empirical, testable substrate-quality grounding**, not just a preference. The DST capability difference is the principled reason TS is canonical and bash is exceptional.

Composes with:

- **Otto-272 DST-everywhere** — DST is the universal testing discipline; TS supports it; bash doesn't
- **081KQGDBJ0008QG0R000A4EZS5 TS standardization** — port every .sh outside install graph + every .py to TS. The DST justification is the architectural rationale
- **The 4-shell bash-compatibility target (Otto-235)** — narrowed to: bash exists ONLY where DST isn't required (pre-install scripts before bun is available)

## Insight 2 — vibe-coders always have a harness; harness hooks suffice (git hooks are antipattern)

Aaron 2026-05-03: *"vibe coders will never be without a harness of some kind"* + *"i don't think we need git hooks harness hooks are good"* + *"many consider git hooks an antipatter, i tend to love antipattern when they are used in the non antipatter way lol, i dont know if we have any non antipatter use cases that harness hook counld not handle but git hooks could."*.

**The antipattern argument**: many consider git hooks an antipattern because they (a) tie repo policy to client-side configuration that's easily bypassed, (b) require platform-specific scripts (bash + ps1 + shebangs), (c) silently fail when missing or misconfigured, (d) don't compose with modern agentic-engineering workflows.

**Non-antipattern use cases for git hooks that harness hooks can't handle** (analyzed for completeness):

1. **Server-side hooks** (pre-receive, post-receive on the git server) — enforce policy on a SHARED repo regardless of client. Useful when contributors might bypass client-side validation
2. **Protecting against non-harness commits** — if any contributor commits via terminal/standalone-client without a harness, git hooks catch what harness hooks miss

**Why these don't apply to Zeta**:

- Server-side hooks are useful for repos with adversarial / non-aligned contributors. Zeta's vibe-coded scope assumes harness-mediated contributors only
- Non-harness commits are anti-vibe-coded by definition; protecting against them optimizes for a case Zeta isn't designed for

### Contributor scope vs skill-bundle scope (Aaron 2026-05-03 refinement)

Aaron 2026-05-03: *"can we count on our install/setup has run for contributors and/or maintainers, yes, so we can count on bun here too then, not for skills we send out via skill bundles for pepole who only resued they have cluade hooks, we maintiners and contributors can have both and both on ts."*.

**Persona vocabulary distinction (Aaron 2026-05-03 — *"now we have ai agents that are named and personas that are end user ai and human personas"*)**:

There are two distinct persona axes:

1. **Named AI agents** (internal to Zeta's identity): Otto, Soraya, Daya, Aarav, Nadia, etc. These are the project's internal-cognition personas — they have notebooks, history surfaces, and contribute as named contributors per Otto-279
2. **End-user personas** (external consumers of Zeta substrate): both human (contributor / maintainer / skill-bundle user) AND AI (PR Copilot, external Codex / Cursor / Aider reviewers, etc.)

This memo's table covers **end-user personas** (axis 2). Internal named-agent personas are tracked separately (per the Otto-279 history-surface attribution carve-out + persona notebooks under `memory/<persona>/`).

**Tracked end-user personas (per Aaron 2026-05-03 — *"we should start keeping us with our end user persona contrbutor maintainer skill bundle user, there will be more over time"* + *"the pr copilot ... yes that's a first class personal any any exteranl ai like that that could benefit from our runtime"*)**:

| Persona | Type | Bun availability | What they execute |
|---|---|---|---|
| **Contributor** (runs `tools/setup/install.sh`) | Human | Yes (installed bun) | Could run git hooks + harness hooks, both in TS |
| **Maintainer** (also runs install) | Human | Yes | Same as contributor |
| **Skill-bundle user** (uses plugins via harness) | Human | Only via harness's runtime | Harness hooks only |
| **PR Copilot reviewer** (default static) | AI | N/A — doesn't execute | Static analysis only; reads + flags issues |
| **PR Copilot reviewer** (HYPOTHETICAL — if we adopt `.github/workflows/copilot-setup-steps.yml` with the GitHub-required `copilot-setup-steps` job name; not currently in the repo. Canonical pattern documented at GitHub's official docs: `https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment`.) | AI | Yes (via our setup, IF that workflow exists) | Both bash + TS would be executable; could verify findings by running tools |
| **Other external-AI PR reviewers** (Codex, Cursor, Aider, Gemini-CLI, etc.) | AI | Conditional per their integration | Static or executable depending on setup |
| *(more personas over time)* | TBD | TBD | TBD |

**Architectural commitment**: external AI reviewers that could benefit from our runtime are first-class personas, not afterthoughts. When designing infrastructure (CI workflows, install scripts, distribution mechanisms), include rows for external-AI personas in the planning table.

**Even for contributors/maintainers**, harness hooks cover the use cases git hooks would. Aaron's analysis (confirming Otto's):

- Pre-commit substrate-claim-checker → harness fires on pre-tool-use (Edit/Write) before content lands
- Commit-msg validation → harness fires on pre-Bash-tool-use when command is `git commit`

So **no persona currently needs git hooks** — contributors/maintainers don't need them because the harness covers the same ground; skill-bundle users can't have them anyway. The contributor-vs-skill-bundle distinction matters for **what's possible** (this could always change in the future, so it's a useful distinction to track per Aaron 2026-05-03), but the **current conclusion is uniform**.

**Conclusion**: Zeta has NO non-antipattern git-hook use case across any current persona. The persona-table is a useful future-flex point — if a future persona has different runtime availability or different security needs, the table accommodates new rows. 081KQNJ500008QG0R003ZC6PK8 should be harness hooks + CI only for now; revisit if persona evolution warrants.

Architectural simplification for 081KQNJ500008QG0R003ZC6PK8 (hook authoring) and skill-bundle distribution (081KQNJ500008QG0R001VGMS5G):

- **Vibe-coders always have at least one harness** (Claude Code, Codex, Cursor, Aider, Gemini-CLI, etc.)
- **Harnesses provide TS runtime** (bun, node, etc.) as part of their installation
- **Skill-bundle users get TS-ready environment by default**
- **Harness hooks** (e.g., Claude Code's `.claude/settings.json` hooks field) execute commands in the harness's runtime → can call TS directly

Therefore: **git hooks are unnecessary for skill-bundle distribution**. 081KQNJ500008QG0R003ZC6PK8's scope simplifies to:

1. ~~`tools/git/hooks/pre-commit`~~ — REMOVED. Not needed; harness hooks cover the use case
2. ~~`tools/git/hooks/commit-msg`~~ — REMOVED. Same
3. **Harness hooks** (Claude Code `.claude/settings.json` hooks, Codex equivalent) — call `bun tools/substrate-claim-checker/check-counts.ts` or similar
4. **CI check on PR descriptions** (`.github/workflows/substrate-claim-checker.yml`) — still in scope; runs on the host

The **081KQNJ500008QG0R003ZC6PK8 ground-truth-recovery (PR #1280)** was WRONG when it listed 3 hook types including git hooks. The correct scope is harness hooks + CI only. This memo's filing initiates the correction.

Composes with:

- **081KQNJ500008QG0R003ZC6PK8** (hook authoring) — scope simplified
- **081KQNJ500008QG0R001VGMS5G** (skill-domain plugin packaging) — packaging is harness-bundle-shaped; user always has harness
- **Cross-disciplinary pattern adoption memo** — Aaron applies DbC (Eiffel/Meyer) at the harness-hook layer, NOT git hook layer
- **Karpathy edge-runner framing** — vibe-coders are agentic-engineering users; agentic-engineering means harness-mediated; harness-mediated means runtime-available

## Pre-existing wrong substrate to correct

The 081KQNJ500008QG0R003ZC6PK8 ground-truth-recovery section in `memory/architectural-intent-guesses/2026-05-03-b-0173-hook-authoring-for-skill-creation-contracts.md` (lines 116-118) has:

```
1. tools/git/hooks/pre-commit (proposed)
2. tools/git/hooks/commit-msg (proposed)
3. .github/workflows/substrate-claim-checker.yml (proposed)
```

Per Aaron 2026-05-03, items #1 and #2 are no longer in scope. Only #3 (CI) and a new #4 (harness hooks per Claude Code's `.claude/settings.json`) are in scope.

The correction lands in a separate PR; this memo is the substrate that justifies it.

## Future-Otto rules

1. **TS is canonical**; bash exists ONLY for pre-install scripts (where DST is unavailable anyway). When in doubt: TS
2. **Harness hooks are the distribution mechanism for skill-bundle users**; git hooks are NOT needed because vibe-coders always have a harness
3. **DST is the empirical quality justification** for the TS-canonical preference. When justifying TS over bash, cite DST capability — that's stronger than "bash is just lower quality"
4. **Skill-bundle distribution flows through harnesses** — CC plugins, Codex equivalents, Cursor, etc. The substrate doesn't go directly to user filesystem; it goes through the harness's plugin system

## Composes with

- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — skill-design rule 2 (no dynamic commands; use TS files)
- `memory/feedback_cross_disciplinary_pattern_adoption_aaron_thinking_style_dataVault_at_skill_level_2026_05_03.md` — Aaron's cross-disciplinary pattern adoption (DbC at harness-hook layer)
- 081KQNJ500008QG0R003ZC6PK8 (hook authoring) — scope simplification per this memo
- 081KQNJ500008QG0R001VGMS5G (skill-domain plugin packaging) — distribution mechanism per this memo
- 081KQGDBJ0008QG0R000A4EZS5 (TS standardization) — DST is the architectural rationale
- Otto-272 DST-everywhere — the empirical quality property TS provides and bash doesn't
- Otto-235 (bash compatibility 4-shell target) — narrows to "bash for pre-install only"
- AGENTS.md "The vibe-coded hypothesis" — vibe-coding is agentic-engineering = harness-mediated by definition

## Carved sentence

**"DST capability is the empirical quality justification for TS-over-bash: proper Deterministic Simulation is much harder in bash than TS. Vibe-coders are never without a harness; harness hooks suffice for skill-bundle distribution; git hooks are unnecessary. 081KQNJ500008QG0R003ZC6PK8 scope simplifies to harness hooks + CI only (no git hooks). Bash exists in Zeta ONLY for pre-install scripts where DST is unavailable anyway. When justifying TS over bash, cite DST capability — that's stronger than 'bash is just lower quality.'"**
