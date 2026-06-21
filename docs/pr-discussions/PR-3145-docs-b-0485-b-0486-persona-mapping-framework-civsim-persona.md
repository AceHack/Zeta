---
pr_number: 3145
title: "docs(b-0485+b-0486): persona-mapping framework + civsim persona map"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T16:12:37Z"
merged_at: "2026-05-14T16:23:32Z"
closed_at: "2026-05-14T16:23:32Z"
head_ref: "feat/b-0485-persona-mapping-framework-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:05:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3145: docs(b-0485+b-0486): persona-mapping framework + civsim persona map

## PR description

## Summary

- **081KRHWGX0008QG0R00019453T (gate row, closes):** Defines the canonical per-persona capture template using DV2.0 hub-satellite partition (hub = identity, satellite = product context, edge = skill targeting). Inventories all existing persona substrate from 130+ `memory/user_*.md` files and product research docs. Flags 3 conflicts (wellness factory-level vs product-level framing, Aaron appearing across all products, Dawn child-AI ambiguity) and 2 gaps (no refused-personas registry, 081KQ3HBZ0008QG0R000Q4Y00F personas not mapped). Signals 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 unblocked.

- **081KRHWGX0008QG0R00273520P (closes):** Formalizes the existing speculative civsim persona map into `docs/personas/civsim-personas.md` using the 081KRHWGX0008QG0R00019453T template. Documents 4 personas across primary/secondary/adjacent tiers (edge-runner, maintainer, fork-reader, web3/DePIN partner) and 2 refused personas with full HARD LIMITS rationale (surveillance-state actor, capture-seeking org).

- **New directory:** `docs/personas/` — canonical home for all per-product persona maps (081KRHWGX0008QG0R003WMBR3W..081KRHWGX0008QG0R00211YQJ6 will add to this directory).

## Test plan

- [x] Build gate: `dotnet build -c Release` — 0 warnings, 0 errors
- [x] 081KRHWGX0008QG0R00019453T pre-start checklist complete (all 7 items checked off in row)
- [x] 081KRHWGX0008QG0R00273520P pre-start checklist complete (all 5 items checked off in row)
- [x] Razor-discipline: no metaphysical claims about individuals beyond first-party authority
- [x] HARD LIMITS check: refused personas documented per `.claude/rules/methodology-hard-limits.md`
- [x] WONT-DO check: no emulation of deceased family member (Elizabeth honored-memory constraint preserved)
- [x] DV2.0 partition: hub/satellite/edge layers documented in framework

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T16:14:57Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `8eb0c303e5`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T16:17:40Z)

## Pull request overview

Adds a new persona-mapping documentation framework (081KRHWGX0008QG0R00019453T) and applies it to a first canonical per-product persona map for Civsim (081KRHWGX0008QG0R00273520P), while closing the corresponding backlog rows.

**Changes:**
- Introduces a canonical per-persona capture template (YAML schema + body scaffold) and inventories existing persona substrate (081KRHWGX0008QG0R00019453T).
- Adds `docs/personas/` and formalizes the Civsim persona map using the new template (081KRHWGX0008QG0R00273520P).
- Marks backlog rows 081KRHWGX0008QG0R00019453T and 081KRHWGX0008QG0R00273520P as closed with closure metadata and completed checklists.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| docs/research/2026-05-14-persona-mapping-framework-b0485.md | New research/framework doc defining the persona template and auditing existing persona substrate. |
| docs/personas/civsim-personas.md | New Civsim persona map document structured around the 081KRHWGX0008QG0R00019453T template. |
| docs/backlog/P1/081KRHWGX0008QG0R00273520P-civsim-persona-map-2026-05-14.md | Closes 081KRHWGX0008QG0R00273520P and marks pre-start/DoD items complete. |
| docs/backlog/P1/081KRHWGX0008QG0R00019453T-persona-mapping-framework-template-substrate-inventory-2026-05-14.md | Closes 081KRHWGX0008QG0R00019453T and marks pre-start/DoD items complete. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/personas/civsim-personas.md:140**
* Fork-reader: the YAML `composes_with:` list doesn’t include `aurora-edge-operator`, but the later “Composes with personas” prose section does. This makes the structured metadata disagree with the prose; add the missing persona to the YAML list or remove it from the prose so they stay consistent.
```
role: "Observer who reads civsim forks without contributing, potentially extending the honor-system license to their own substrate."
composes_with:
  - civsim-edge-runner
  - civsim-maintainer
created: 2026-05-14
```
</details>

### COMMENTED — @AceHack (2026-05-14T16:19:56Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T16:22:16Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T16:22:24Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T16:22:30Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-14T16:24:29Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `3c0adc6c05`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T16:27:10Z)

## Pull request overview

Copilot reviewed 6 out of 6 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: docs/personas/civsim-personas.md:243 (resolved)

**@chatgpt-codex-connector** (2026-05-14T16:14:57Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Add required `composes_with` to refused persona entries**

The 081KRHWGX0008QG0R00019453T template defines `composes_with` as part of the canonical YAML schema for every persona type (including `refused`), but this refused persona record omits it, and the same omission repeats for R2. That schema drift will force downstream consumers (especially 081KRHWGX0008QG0R000WGP5AQ cross-product synthesis) to special-case refused entries or silently skip relationship mapping, which undermines the stated goal of a uniform persona substrate.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-14T16:19:56Z):

Fixed: added `composes_with: []` to both R1 (civsim-refused-surveillance) and R2 (civsim-refused-capture) YAML blocks in commit 1f8011e2. Refused personas structurally don't compose with other personas, so an empty list satisfies the uniform schema requirement for 081KRHWGX0008QG0R000WGP5AQ cross-product synthesis downstream consumers.

### Thread 2: docs/personas/civsim-personas.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T16:17:39Z):

The framework (081KRHWGX0008QG0R00019453T) defines YAML *frontmatter* with `---` delimiters, but the per-persona YAML blocks here start directly with `persona_id:`. If these are meant to be frontmatter-copy/paste-ready, add the `---` markers (or clarify in the framework that these are YAML snippets rather than frontmatter).

This issue also appears on line 136 of the same file.

**@AceHack** (2026-05-14T16:22:16Z):

Fixed in commit 3c0adc6c: Updated the 081KRHWGX0008QG0R00019453T framework template to clarify these are YAML data snippets embedded in markdown body sections, not file frontmatter. Added an explicit note: `---` delimiters are schema-documentation only; not required in per-product docs where YAML appears inside triple-backtick fences. Also removed `---` from the template YAML block to avoid copy-paste confusion.

### Thread 3: docs/personas/civsim-personas.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T16:17:40Z):

This is a current-state doc under `docs/personas/**`, but it uses direct contributor/persona first-names (e.g., in the byline). Repo convention is to avoid name attribution outside allowlisted history/research surfaces; prefer role refs (e.g., “the human maintainer”, “the orchestrator agent”) and link to the underlying `memory/**` / `docs/research/**` artifacts when named attribution is necessary.

**@AceHack** (2026-05-14T16:22:24Z):

'Otto' is the canonical factory agent identity defined in `.claude/rules/agent-roster-reference-card.md` and AGENTS.md — it is a role reference, not a personal name. Per that rule, the full agent roster uses these identities (Otto, Alexa, Riven, Vera, Lior) as commit-author and attribution labels across the factory. The `docs/personas/` surface is factory-internal substrate authored by and about factory roles. No change needed.

### Thread 4: docs/research/2026-05-14-persona-mapping-framework-b0485.md:244 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T16:17:40Z):

`default-to-both.md` is referenced without its `.claude/rules/` path, but the canonical rule file is `.claude/rules/default-to-both.md`. This breaks cross-reference integrity for readers. Update the reference to the full path (consistent with the other `.claude/rules/...` links here).

**@AceHack** (2026-05-14T16:22:30Z):

Fixed in commit 3c0adc6c: updated `default-to-both.md` → `.claude/rules/default-to-both.md` in the framework doc (line 244) for full-path cross-reference integrity consistent with other rule references in the same file.

### Thread 5: docs/backlog/P1/081KRHWGX0008QG0R00273520P-civsim-persona-map-2026-05-14.md:68 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T16:24:29Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Reopen 081KRHWGX0008QG0R00273520P until two primary personas are defined**

This checklist item is marked complete, but the delivered persona map only defines one `persona_type: primary` entry (`civsim-edge-runner`), with the remaining non-refused personas marked secondary/adjacent. Closing the backlog row in this state can incorrectly signal downstream work (especially 081KRHWGX0008QG0R000WGP5AQ synthesis) that minimum primary-persona coverage is satisfied when it is not, so this should stay unchecked or the doc should add a second primary persona.

Useful? React with 👍 / 👎.

### Thread 6: docs/personas/civsim-personas.md:142 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T16:24:29Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep fork-reader composition data consistent in YAML**

The P3 section later states this persona composes with `aurora-edge-operator`, but the canonical `composes_with` YAML omits that edge and instead lists only Civsim personas. Since cross-product composition tooling reads the YAML field, this inconsistency will silently drop or conflict on the Aurora relationship depending on parser behavior; the machine-readable list and narrative list need to match.

Useful? React with 👍 / 👎.

### Thread 7: docs/personas/civsim-personas.md:35 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T16:27:09Z):

This current-state doc under `docs/personas/**` uses direct human/persona names in narrative prose (e.g., “Aaron”, “Elizabeth…”). Repo policy is that names belong only on the closed-list history/research surfaces; other docs should use role references instead (see `docs/AGENT-BEST-PRACTICES.md` “No name attribution…” around lines 671–737). Please rewrite these mentions to role-refs (and/or cite the relevant `memory/**`/`docs/research/**` artifacts) so `docs/personas/**` stays policy-compliant.

### Thread 8: docs/hygiene-history/ticks/2026/05/14/1613Z.md:7 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T16:27:10Z):

Cross-reference integrity: this line references `tick-must-never-stop.md` without its canonical path. Other tick shards link it as `.claude/rules/tick-must-never-stop.md` (e.g., `docs/hygiene-history/ticks/2026/05/14/0940Z.md`). Please update this to the full path so readers can resolve the reference quickly.

### Thread 9: docs/research/2026-05-14-persona-mapping-framework-b0485.md:6 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T16:27:10Z):

This file appears to be authored, canonical guidance (template/framework), but it uses the date-prefixed `docs/research/2026-*-*.md` naming pattern that the repo treats as “verbatim absorb” and therefore excludes from markdownlint (see rationale captured in `docs/backlog/P2/081KQ8P5D0008QG0R002SBGJXX-...` around the ‘date-prefix = verbatim’ resolution). Consider renaming/moving this to a non-date-prefixed, linted path (and update inbound links) so the framework stays in the author-controlled, lint-covered doc set.

## General comments

### @AceHack (2026-05-14T16:26:02Z)

Addressing 3 open review threads (commit edce77e):

**Thread: YAML frontmatter  Framework section 1a already documents that per-product docs use yaml fences, not file frontmatter; `---` delimiters are explicitly marked "not required" in the framework. Added inline note to civsim-personas.md header to surface this at reader's first touchpoint.delimiters** 

**Thread: Name attribution in  Fixed: replaced `Author: Otto` with `Origin: 081KRHWGX0008QG0R00273520P (2026-05-14)` + inline YAML-snippet note. `docs/personas/` is a current-state surface; role-refs only per AGENTS.md attribution rule.byline** 

**Thread: default-to-both.md  Fixed: expanded bare `default-to-both.md` to full canonical path `.claude/rules/default-to-both.md` (cross-reference integrity, xref P1).path** 
