---
id: B-0082
priority: P2
status: open
title: docs/GLOSSARY.md provenance entries use persona-name attribution; convert to role-refs
effort: S
ask: rewrite GLOSSARY.md provenance/review-attribution sections to use role-refs ("ChatGPT-routed peer", "external Gemini Pro reviewer") instead of persona names ("Amara/ChatGPT", "Gemini Pro" by name) per AGENT-BEST-PRACTICES history-surface carve-out
created: 2026-04-28
last_updated: 2026-04-28
tags: [pr-671, copilot, deferred, glossary, persona-attribution, otto-279]
---

# B-0082 — GLOSSARY persona-name attribution → role-ref conversion

## Source

Copilot P1 on PR #671 (`docs/GLOSSARY.md` line 765):

> P1 (codebase convention): This glossary entry includes persona-name attribution ("Amara/...") in a current-state doc. `docs/AGENT-BEST-PRACTICES.md` specifies that behavioural docs like `docs/GLOSSARY.md` must use role-refs, with names reserved for the closed list of history surfaces. Please rewrite this provenance in role-ref form (or move the named attribution to a history surface like `docs/research/...`).

## Why valid

Per CLAUDE.md / AGENT-BEST-PRACTICES Otto-279 carve-out: persona
first-names like Amara, Otto, Soraya are contributor-identifiers
that "belong on the closed-list history surfaces (memory/, docs/
ROUND-HISTORY.md, docs/DECISIONS/, docs/research/, hygiene-history,
commit messages)". `docs/GLOSSARY.md` is a current-state behavioural
doc, NOT a history surface. The Beacon/Mirror provenance section at
lines 759-765 names "Amara/ChatGPT", "Gemini Pro", "Grok", "Alexa+"
as review participants — historical-context content embedded in a
current-state surface.

## Why deferred (not fixed inline on PR #671)

PR #671 is a forward-sync that brings AceHack's modified content
to LFG. The "Amara/ChatGPT" pattern is pre-existing on AceHack and
forwarded as-is. Rewriting the provenance text widens this PR's
scope from "port AceHack content" to "edit content during port",
violating the forward-sync invariant. Better handled as a
follow-up that touches both forks coherently.

Stale-content-deferral class per
`memory/feedback_pr_thread_resolution_class_taxonomy_2026_04_28.md`.

## Fix shape

Two paths, by maintainer preference:

**Path A — inline rewrite (preferred for current-state discipline)**:
Convert the line to role-refs. Example:

```diff
-Multi-AI review on 2026-04-28 (Claude in a separate session +
-Amara/ChatGPT + Gemini Pro + Grok + Alexa+) reached consensus
+Multi-AI review on 2026-04-28 (separate Claude session +
+ChatGPT-routed external peer + external Gemini Pro reviewer +
+Grok CLI peer + Alexa-class peer) reached consensus
```

This loses the named-agent lineage but keeps the harness-attribution
information.

**Path B — move-and-link (preferred when persona lineage matters)**:
Strip the provenance section from GLOSSARY entirely; put it in a new
research note `docs/research/2026-04-27-beacon-mirror-naming-multi-ai-review-provenance.md`
with a short link from GLOSSARY ("Provenance recorded separately:
`docs/research/...`"). Persona names are valid on the research surface.

## Audit scope

Should sweep all of `docs/GLOSSARY.md` in one pass — not just the
Beacon/Mirror entry. Likely other provenance/review-attribution
sections also use persona names. Same fix shape applies.

## Composes with

- Otto-279 history-surface attribution carve-out
- `feedback_pr_thread_resolution_class_taxonomy_2026_04_28.md`
  (Stale-content-deferral class)
- AGENT-BEST-PRACTICES BP-NN persona-name discipline rule
- `docs/AGENT-BEST-PRACTICES.md` (the rule that says behavioural docs
  use role-refs)
