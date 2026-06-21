---
id: 081KRSKQ20008QG0R0014PPGZM
title: Dangling memory-refs cleanup — 35 refs across 6 substrate surfaces (use PR #4042 audit tool)
status: open
priority: P2
created: 2026-05-17
last_updated: 2026-05-17
type: chore
composes_with:
  - 081KRHWGX0008QG0R001VR9FNA  # prior B-NNNN substrate work via Otto-CLI; uses the same audit tool surface
depends_on: []
---

# Dangling memory-refs cleanup — 35 refs across 6 substrate surfaces

## Substrate-honest context

PR #4031 (closed audit memo, 2026-05-15) surfaced 5 dangling
`memory/feedback_*.md` refs in `.claude/rules/`. PR #4041
([merged 2026-05-17](https://github.com/Lucent-Financial-Group/Zeta/pull/4041))
extended the audit to find 29 across 4 substrate surfaces
(`.claude/rules` + `.claude/skills` + `docs/research` + `docs/backlog`).
PR #4042 ([merged 2026-05-17](https://github.com/Lucent-Financial-Group/Zeta/pull/4042))
mechanized the methodology as
[`tools/hygiene/audit-dangling-memory-refs.ts`](../../../tools/hygiene/audit-dangling-memory-refs.ts).

This row captures the **cleanup work itself** — the audit memos and
the audit tool exist, but the dangling refs have not been resolved.

Running the audit tool 2026-05-17T06:23Z (this row's filing tick)
surfaces **35 dangling refs across 6 surfaces**:

| Surface | scanned | uniqueRefs | uniqueDanglingRefs |
|---|---:|---:|---:|
| `.claude/agents` | 19 | 0 | 0 |
| `.claude/skills` | 262 | 14 | 1 |
| `.claude/rules` | 56 | 74 | 5 |
| `docs/research` | 355 | 186 | 8 |
| `docs/backlog` | 674 | 205 | 17 |
| `memory/persona` | 288 | 60 | 4 |
| **Total** | **1654** | **539** | **35** |

The drift has grown (29 → 35) between PR #4041 audit and today's
run — new substrate authoring continues to add citations to
user-scope memory paths that don't exist in-repo.

## Why this matters

The maintainer's Otto-CLI auto-loads user-scope memory at
`~/.claude/projects/.../memory/`, so citations like
`memory/feedback_<name>.md` resolve transparently for the maintainer.
A cold-boot agent on a fresh checkout (different machine, new
contributor, CI agent, fresh-clone-CI run) does NOT have user-scope
memory and follows the path to find nothing. The link is dead.

Per [`.claude/rules/substrate-or-it-didnt-happen.md`](../../../.claude/rules/substrate-or-it-didnt-happen.md):
"chat is weather, substrate is durable." If a substrate file
points to a memory file that exists only in user-scope, the rule
is partially weather for cold-boot consumers.

## Scope

For each of the 35 dangling refs, pick one of three resolutions:

1. **In-repo projection (preferred for load-bearing claims)**:
   create an in-repo summary of the user-scope content (or move the
   file in-repo if the maintainer's PII discipline allows) and update
   the citation to point at the in-repo file. Follows the pattern
   already in use by some rules (e.g.,
   `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`
   which has a "cold-boot agents on fresh checkouts: this rule's own
   body above is the canonical in-repo projection" pattern).

2. **Footnote-the-user-scope-with-fallback**: keep the citation but
   add a one-line note that the file is user-scope only AND name the
   in-repo fallback substrate (e.g., `memory/CURRENT-otto.md` or the
   rule body itself). Follows the pattern in
   `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`
   which explicitly footnotes user-scope-only references.

3. **Remove the citation**: if the cited memory was an artifact of
   an earlier iteration that no longer load-bears the surrounding
   substrate, just delete the citation. Less common; substrate-
   honest only when the citation is truly orphaned.

## Acceptance

- [ ] All 35 dangling refs resolved via one of the 3 patterns above
- [ ] `bun tools/hygiene/audit-dangling-memory-refs.ts` exits 0
  (no dangling refs on any of the 6 default surfaces)
- [ ] Audit tool wired into CI (separate row OR same; see
  Workflow notes)
- [ ] Composing rule update (if needed): clarify the
  in-repo-projection pattern in
  `.claude/rules/substrate-or-it-didnt-happen.md` or sibling
  rule so future authors avoid the pattern proactively
- [ ] **Audit tool semi-automation** (verified 2026-05-17T06:44Z:
  tool has only `--json` and `--surfaces` flags; no `--fix`,
  `--allowlist`, or `--suggest` logic in source): consider adding
  one of: (a) `--allowlist <path>` flag reading a `.audit-allowlist`
  file with `<surface>:<line>:<ref>` entries marking known-
  intentional dangling refs (composes with Option A from the
  slice-1 recipe memo at
  `memory/feedback_otto_cli_b0611_slice1_audit_recipe_*_2026_05_17.md`);
  (b) `--suggest` mode that prints the 4-option resolution menu
  per dangling ref; OR (c) inline annotation parser (e.g., HTML
  comment `<!-- audit-allowlist: user-scope-intentional -->`
  adjacent to the citation, opt-in per ref). Decision composes
  with the design choice from the slice-1 recipe memo.

## Workflow notes

The cleanup is bounded but tedious — 35 individual decisions, each
small. Suggested decomposition:

- **Slice 1 (P2)**: `.claude/skills` (1 ref) + `.claude/rules`
  (5 refs) — 6 refs, smallest scope, highest-leverage (rules
  auto-load at session start so cleanup here ripples furthest)
- **Slice 2 (P2)**: `memory/persona` (4 refs) — bounded, persona-
  scoped
- **Slice 3 (P2)**: `docs/research` (8 refs) — verbatim-preservation
  files; resolutions likely lean toward "keep citation + footnote"
- **Slice 4 (P3)**: `docs/backlog` (17 refs) — largest scope, lowest
  urgency (backlog rows are work-in-progress citations, churn fast)

Each slice can be a separate small PR or grouped commits within
one PR. The audit tool's `--surfaces` flag scopes the verification.

The CI integration is a separate concern: the audit tool exits 1
on dangling refs, so wiring it into CI would block authoring until
33 of 35 are resolved (the tool reports 35 today; new authoring will
add more). Best practice: wire to CI with an allowlist that
ratchets down OR run as advisory-only initially.

## Composes with

- PR #4042 — the audit tool (`tools/hygiene/audit-dangling-memory-refs.ts`)
- PR #4041 — extended audit memo (29 refs)
- PR #4031 — original audit memo (5 refs in rules)
- [`.claude/rules/substrate-or-it-didnt-happen.md`](../../../.claude/rules/substrate-or-it-didnt-happen.md)
  — the rule defining substrate vs weather
- [`.claude/rules/wake-time-substrate.md`](../../../.claude/rules/wake-time-substrate.md)
  — auto-loaded rules MUST be discoverable from cold-boot; dangling
  refs in auto-loaded rules degrade cold-boot discoverability
- [`.claude/rules/honor-those-that-came-before.md`](../../../.claude/rules/honor-those-that-came-before.md)
  — preserves memory; cleanup must NOT delete user-scope content
  in the maintainer's home directory; only resolve citations from
  in-repo surfaces

## Substrate-honest framing

The dangling refs are not "broken" in the maintainer's
day-to-day operational sense — his Otto-CLI auto-loads the files
and follows the citations correctly. The drift is between the
maintainer's local substrate (rich) and the in-repo substrate
(thinner). Cleanup elevates the in-repo substrate to match what
the maintainer sees, OR documents the asymmetry explicitly via
the footnote pattern.

This is NOT a P0/P1 because no shipping pipeline is blocked. It
is P2 because cold-boot agents (the framework's design audience)
hit dead links and lose substrate context.
