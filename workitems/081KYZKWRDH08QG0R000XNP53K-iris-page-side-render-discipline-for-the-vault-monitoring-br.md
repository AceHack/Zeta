---
id: 081KYZKWRDH08QG0R000XNP53K
type: task
state: backlog
priority: P1
slug: iris-page-side-render-discipline-for-the-vault-monitoring-br
title: "Iris: page-side render discipline for the vault monitoring bridge (contract landed in #9927)"
created: 2026-08-01T21:32:44.337Z
depends_on: []
composes_with: []
---

# Iris: page-side render discipline for the vault monitoring bridge (contract landed in #9927)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYZKWRDH08QG0R000XNP53K-*.md` glob. -->

## Routing

**From:** shadow (Otto) · **To:** Iris (user-experience-engineer) · **Unblocked:** 2026-08-01

Iris's four contract objections plus the epsilon-sign decision landed on main in **#9927**
(`docs/design/2026-08-01-vault-monitoring-bridge.md`). Verified against the diff rather than
the report — the first attempt (#9914) described the changes without making them, so each one
was measured:

| change | state on main |
|---|---|
| timestamps, not precomputed adjectives | `last_seen` present; no `state:` field in schema |
| `live \| cold \| stale \| heat` replaces `provenance.mock` | present; matches `llmtv-root-site-status.ts` |
| `color` removed from the schema | no `color` field; DU lives once in design-system CSS |
| roster (hub) / state (satellite) split | `vault-roster.json` + `vault-state.json` both defined |
| `degenerate` → `silent`, signed ε | present, with the k separation below |

## What is NOT blocking, and why you should start anyway

Alexa still owes the **adapter implementation** — the code that emits the two JSON files. That
is deliberately not a blocker. Render to the contract; Alexa implements to the contract; the two
meet there. If the page waits for the adapter, its render discipline gets shaped by whatever the
adapter happened to emit first, which is the correlation this split exists to avoid.

The contract degrades honestly by construction: with no adapter, `last_seen` is absent or old
and the browser clock renders `cold`. A stopped society looks stopped. That is the property
Iris asked for, and it means the page is testable before the adapter exists.

## One thing to know, not to fix

The `k ≥ 2` in the silence rule is a **peer-count quorum** (how many independent witnesses are
needed). It is NOT the Cantelli `k ≈ 1.95` from `α = 1/(1+k²)` used in the whitewashing-proofness
bound. Different quantities, coincidentally close numbers. The doc now says so explicitly; the
note is here so the page never renders one as the other.

## Surface state (measured 2026-08-01, no action needed)

- Asset refs under `docs/design/root-site-iris/` resolve — `hall/*`, `demo/index.html` all exist
  at the site root, which is the base Pages builds from. An earlier "12 missing" count of mine
  was measured from the wrong directory and was wrong.
- The 36 dangling refs on the live Pages site were fixed by `support.js` landing on main.
- `mesh.html`'s five CodeQL "expression has no effect" findings are false positives — CodeQL
  parses `{{ handler }}` DC template syntax as JavaScript. Documented on #9916. The class will
  recur on every DC `.html`; whether to add `paths-ignore` is Aaron's call, since it suppresses
  a scanner class.

## Pointers

- `docs/design/2026-08-01-vault-monitoring-bridge.md` — the contract
- `src/Core.TypeScript/.../llmtv-root-site-status.ts` — the shipped `live|cold|stale|heat` vocabulary
- #9927 (contract) · #9916 (browser mesh node) · #9914 (superseded first attempt, same file)
