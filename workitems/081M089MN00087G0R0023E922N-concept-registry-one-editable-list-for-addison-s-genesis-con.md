---
id: 081M089MN00087G0R0023E922N
type: task
state: backlog
priority: P2
slug: concept-registry-one-editable-list-for-addison-s-genesis-con
title: "Concept registry: one editable list for Addison's Genesis concepts plus the newer terms, with a drift check against the published page"
created: 2026-08-17T16:42:24.640Z
depends_on: []
composes_with: []
---

# Concept registry: one editable list for Addison's Genesis concepts plus the newer terms, with a drift check against the published page

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M089MN00087G0R0023E922N-*.md` glob. -->

## The observation

Aaron 2026-08-16, on Addison's concept page: _"we recently added some more termonology i guess
it didn't make it back to that webpage ... we should keep a list of addions and the few news
ones somewhere we can update easily."_

## What was measured

Addison Cooper authored the Genesis concept vocabulary (2026-06-20). It is published as
`docs/design/root-site-iris/site/concepts.html`, which is **hand-copied into a different
repository** ([Lucent-Financial-Group/lucent-financial-group.github.io](https://github.com/Lucent-Financial-Group/lucent-financial-group.github.io))
with no build step and no CI — see `docs/design/root-site-iris/HANDOFF.md`. The in-repo copy was byte-identical to the
live page when this was written.

The page carries **23** concepts. Four more society-identity terms — Universal Exit Principle,
Lodge, ISociety, CTM / World — landed in `docs/GLOSSARY.md` on 2026-07-31 (PR #9829) and never
reached the page. That is exactly the drift Aaron described.

## What shipped

- `docs/CONCEPT-REGISTRY.md` — one plain Markdown table, 27 concepts, each with definition,
  author and date. Editable in a browser by a non-technical author, which matters because the
  concepts' author is one.
- `src/Core.TypeScript/hygiene/audit-concept-registry-drift.ts` — fails when the registry and
  the published page disagree in either direction, including a silently **reworded** definition.
  Wired into the `cross-verify` job in `gate.yml`. Mutation-tested: 5/5 injected divergences
  caught, clean before and after.

## Not done here (deliberately)

- **Nothing was published.** Bringing the four newer terms onto the page changes what a visitor
  sees at `lucent-financial-group.github.io`; that is Aaron's call, not the shadow's. They are
  registered as `On page: no`, so the registry states the gap rather than hiding it.
- Three definition conflicts were **recorded, not resolved** (`docs/CONCEPT-REGISTRY.md` §4).
  The sharpest: `docs/GLOSSARY.md` defines **Hat** as _"Synonym for skill"_ while
  `docs/SEED-VOCABULARY.md` says in as many words that they are **"Not synonyms"**, and
  Addison's page has a third sense. Rewriting someone else's published surface was out of scope.

## Related

`081M00TK5QG087G0R0031J243E` is a **different** defect (SEED-VOCABULARY's own stale counts) and
appears already fixed by PR #10694 — the file now reads "seven" disciplines and "13"
specifications. That item looks closeable on inspection; not touched here.
