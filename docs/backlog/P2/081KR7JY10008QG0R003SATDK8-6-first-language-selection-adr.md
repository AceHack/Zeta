---
id: 081KR7JY10008QG0R003SATDK8
priority: P2
status: open
title: "081KR7JY10008QG0R003SATDK8 — First language selection ADR: evidence-based pick of pilot language + community outreach plan"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR50HA0008QG0R002TN3JX2]
classification: research-now
type: research
effort: XS
decomposition: atomic
---

# 081KR7JY10008QG0R003SATDK8 — First language selection ADR

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR50HA0008QG0R002TN3JX2 (anchor set tells us how much precision the translation must preserve, which affects language complexity)

## What

Produce `docs/DECISIONS/ADR-i18n-first-language-YYYYMMDD.md` documenting:

1. **Language candidate evaluation** — score the 14 candidate languages from 081KQ0YZ80008QG0R002HWBHKJ's initial set against:
   - Native-speaker population size (absolute reach).
   - Existing AI/F#/OSS community size in that language.
   - Structural distance from English (affects translation error rate for precision terms).
   - Availability of volunteer reviewers in Zeta's contributor network.
   - Aaron's framing: *"meeting humans at their starting point"* — weight toward underserved populations.

2. **First language decision** — document the chosen language with rationale.

3. **Community outreach plan** — GitHub Discussions post draft, open-source community channels to notify, acknowledgment scheme for volunteer translators.

4. **Rollout cadence** — per Otto-291 deployment discipline: pace (one language at a time), document (this ADR), order (P0 substrate first), migration paths (monolingual readers aren't displaced), retractability (how to pull a bad translation).

## Why

Language selection affects everything downstream (tooling character sets, right-to-left layout for Arabic, Traditional vs Simplified Chinese split, etc.). A documented decision prevents ad-hoc choices that are hard to reverse. Per largest-mechanizable-backlog discipline, the community-outreach plan seeds the volunteer pipeline for all future languages.

## Acceptance criteria

1. ADR committed with scoring table for candidate languages and documented choice.
2. GitHub Discussions draft (as a markdown file, not yet posted) committed alongside the ADR.
3. Retractability protocol documented: if first-language pilot fails review, how is it reverted without affecting English sources.
4. `dotnet build -c Release`: 0 warnings, 0 errors (no code changes needed; pure docs).
5. PR body includes: language scoring table excerpt, chosen language, and rationale summary.

## Out of scope

- Actually posting to GitHub Discussions (requires maintainer sign-off per risky-action rule).
- Second language selection (081KR7JY10008QG0R00016GT9R handles subsequent languages after pilot validates the process).
- Translation work itself (081KR7JY10008QG0R0022YWDVZ pilot).
