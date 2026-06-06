---
id: B-0453
zetaid: 081KRA5AR0008QG0R0004P7SWS
priority: P2
status: open
title: Cross-reference CONTRIBUTOR-COMPLIANCE.md into AGENTS.md / CONTRIBUTING.md / GOVERNANCE.md
tier: factory-hygiene
effort: S
ask: Onboarding surface per B-0092
created: 2026-05-11
last_updated: 2026-05-14
parent: B-0092
depends_on: [B-0452]
composes_with: [B-0090]
renumbered_from: B-0371
renumbered_reason: "ID collision with B-0371 P1 (pages-seo-metadata-jsonld). Part of the P2 contributor-compliance set renumbered as a unit: B-0370→B-0452, B-0371→B-0453, B-0372→B-0454, B-0373→B-0455. Internal depends_on B-0370 remapped to B-0452. Substrate-cleanup tracked in B-0451."
tags: [contributor-compliance, onboarding, AGENTS.md, renumbered]
decomposition: atomic
classification: buildable-now
---

# B-0453 — Cross-reference integration (renumbered from B-0371)

## Scope (atomic)

- Add pointer + brief in `AGENTS.md` (onboarding section).
- Add to `CONTRIBUTING.md` if exists (or note for creation).
- Optional GOVERNANCE.md §N if rule-like.
- One-sentence "see CONTRIBUTOR-COMPLIANCE.md for public-company MNPI discipline".

## Acceptance

- [ ] AGENTS.md updated with link + context.
- [ ] No duplicate text; points to canonical doc.
- [ ] Build + format check green.

## Why atomic after B-0452

Depends on doc existing (B-0452, renumbered from B-0370); pure integration, prefer edit not new prose.
