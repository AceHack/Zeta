---
id: B-0031
priority: P3
status: open
title: Rename `references/` directory — Aaron 2026-04-26 noted "upstream" naming was randomly chosen and collides with git-semantic meaning; rectify before language-wars/confusion compound
tier: hygiene-naming
effort: M
ask: Aaron 2026-04-26 — *"references (not upstream that's proabalby a bad name i randomly chose, we should rectify to avoid wars/confusion becasue im using upstream incorrectly)"*. The `references/` directory holds vendored / mirrored upstream-codebase content; Aaron initially used the word "upstream" colloquially to refer to it, but "upstream" has specific git-semantic meaning (the parent branch / repo a fork tracks). Using "upstream" in this colloquial sense creates confusion and risks future agents/contributors interpreting it via the git-semantic. "References" is fine for the directory name; the issue is the colloquial vocabulary used around it.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_346_dependency_symbiosis_is_human_anchoring_via_upstream_contribution_good_citizenship_dont_blaze_past_2026_04_26.md, B-0030, docs/GLOSSARY.md, B-0010]
tags: [naming-clarity, glossary, git-semantic-collision, vocabulary-discipline, otto-339-anywhere, references-directory]
---

# B-0031 — rectify "upstream" colloquial vs git-semantic naming around references/

## Origin — Aaron 2026-04-26

> *"references (not upstream that's proabalby a bad name i randomly chose, we should rectify to avoid wars/confusion becasue im using upstream incorrectly)"*

Aaron self-corrected: he'd been using "upstream" colloquially to refer to the `references/` directory's contents (vendored / mirrored external code). But "upstream" in git semantics specifically means *the parent branch / repo a fork tracks*. Two different meanings; same word; recipe for confusion.

## The naming problem

Two distinct concepts conflated in current vocabulary:

| Concept | What it is | Current name(s) used |
|---|---|---|
| Vendored external code | Code from other projects mirrored into `references/` for inspection / lineage / Otto-346 contribution-tracking | "upstream", "references" (mixed) |
| Git fork-parent | The repo / branch the fork tracks | "upstream" (correctly) |

The first usage ("upstream" for vendored mirrors) is **colloquial-but-incorrect**; the second ("upstream" for git fork-parent) is **git-semantic-correct**. They collide.

## What this row addresses

1. **Audit current usage** of "upstream" across `docs/`, `memory/`, `tools/`, and code comments — distinguish git-correct uses from colloquial uses
2. **Define replacement vocabulary** for the colloquial sense:
   - Candidates: `mirrored-references/`, `vendored-deps/`, `external-source-of-record/`, `inheritance-references/`, just `references/` with explicit definition in glossary
3. **Update `docs/GLOSSARY.md`** to formalize the distinction
4. **Sweep documentation** for misuses; replace colloquial-"upstream" with the chosen term
5. **Code-comment audit** for the same pattern

## Why this matters per Otto-339

Per Otto-339 anywhere-means-anywhere: vocabulary collisions in substrate cause wrong-state-vectors when AI agents (or humans) read the substrate. "Upstream" interpreted via git-semantic when colloquial-sense was meant produces:

- Wrong assumptions about repo relationships
- Confused contribution direction (Otto-346 upstream-contribution gets confused with `references/` write-back which doesn't make sense)
- Documentation drift as later contributors interpret per their own assumed sense

Aaron's catch is preventive-discipline: **rectify before the language-war compounds**. Cheaper to fix at 2026-04-26 than after another 100 substrate references encode the colloquial sense.

## Composes with prior

- **Otto-346** (dependency symbiosis; upstream-contribution discipline) — uses "upstream" in the OSS-contribution sense (canonical repos like bcgit/bc-csharp); the colloquial conflation contaminates the precision Otto-346 requires
- **B-0010** (memory-index-conventions doc) — sibling naming-discipline backlog row
- **`docs/GLOSSARY.md`** — the right home for the formal distinction
- **Otto-339** (anywhere-means-anywhere) — vocabulary precision applies to directory/file/concept naming
- **Otto-286** (definitional precision changes future without war) — Aaron's *exact* phrase here is "to avoid wars/confusion"; this is preventive Otto-286 application
- **B-0030** (lint-with-exclusions tool) — paired concern from the same Aaron message; the lint tool needs to know which directories to exclude AND those directories need clear names

## Programming-language-as-religious-choice connection (Aaron's framing)

Aaron added in the same message:

> *"people literraly say your programming laganguage choice is like a religious choice, and there are programming language wars that resemble religious wars"*

This composes with the naming-discipline at a meta-level: vocabulary collisions create the same religious-war pattern at the substrate-naming layer that programming-language choice creates at the implementation layer. Both are tribal-identity-via-shared-vocabulary patterns. Otto-286 (definitional precision changes future without war) explicitly names "without war" — vocabulary discipline is anti-religious-war discipline.

## Effort sizing

- **Audit**: M (~half-day) — grep for "upstream" across docs/memory/tools; classify each instance
- **Decision on replacement vocabulary**: S (Aaron-decision; agent provides candidates)
- **Sweep**: M (~day) — replace colloquial uses; preserve git-correct uses; update glossary
- **Pre-commit lint candidate**: future tooling could flag colloquial-"upstream" in non-git-context (out of scope for this row)

## What this DOES NOT do

- Does NOT remove "upstream" from git-correct uses — those stay
- Does NOT rename the directory itself necessarily — could just clarify vocabulary around it
- Does NOT mandate immediate execution — research-grade backlog
- Does NOT eliminate all naming-collision concerns — this is one specific instance; sister concerns surface separately

## Operational implications

Going forward (even before sweep lands):

- When using "upstream" in substrate, default to git-semantic (fork-parent) unless explicitly clarified
- For colloquial "vendored external code" sense, prefer "references/" + the eventual replacement vocabulary
- Otto-346's "upstream contribution" means contributions to **canonical OSS project repos** (bcgit/bc-csharp etc.) — that use is git-semantic-aligned and stays

## Cross-references for sweep

When sweep happens, files most likely to need updates:

- `docs/POST-SETUP-SCRIPT-STACK.md` (mentions upstream in OSS-contribution sense — git-aligned, keep)
- `references/` README or similar (defines what's there)
- Otto-NNN substrate referring to "upstream" — most uses are Otto-346-style git-correct contribution sense, but audit each
- BACKLOG rows (B-0007 Bayesian primitives upstream — git-correct, keep)
