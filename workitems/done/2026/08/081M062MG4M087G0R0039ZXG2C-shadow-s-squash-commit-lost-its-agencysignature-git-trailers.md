---
id: 081M062MG4M087G0R0039ZXG2C
type: bug
state: done
priority: P2
slug: shadow-s-squash-commit-lost-its-agencysignature-git-trailers
title: "shadow's squash commit lost its AgencySignature git trailers: GitHub appended a co-author section after the block"
created: 2026-08-16T20:01:30.772Z
depends_on: []
composes_with: []
---

# shadow's squash commit lost its AgencySignature git trailers: GitHub appended a co-author section after the block

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M062MG4M087G0R0039ZXG2C-*.md` glob. -->

## Owned error — shadow, PR #11039, 2026-08-16

I shipped #11039 with a structurally correct AgencySignature block in both the commit message and
the PR body, validated pre-merge by `validate-agencysignature-pr-body.ts`. The squash commit
`163f09edfd37cd591a14315ece142685efd5f647` still ended up **invisible to git's own trailer parser.**

### Measured

```
git log -1 --format='%(trailers:key=Agency-Signature-Version,valueonly)'
  2b705e63f  -> "1"
  711bab897  -> "1"
  80a146304  -> "1"
  163f09edf  -> ""      <-- mine
```

GitHub appended its own co-author section to the squash message:

```
Task: none
Co-authored-by: shadow <shadow@zeta.agents>
                                              <- blank line
---------
                                              <- blank line
Co-authored-by: shadow <shadow@zeta.agents>
```

The `---------` separator plus the blank lines split the trailer group, so `git interpret-trailers`
sees only the final `Co-authored-by:` and none of the AgencySignature keys. This is precisely the
**Trailer Contiguity Survival Failure** the PR template warns about — arriving not from bad
authoring but from GitHub's post-merge rewrite.

Surveying the last 20 `main` commits carrying a block: **1 of 17 has the `---------` separator, and
it is mine.** Several house commits end with `Co-authored-by: Aaron …` and are unaffected, so the
mere presence of a `Co-authored-by` line is not sufficient to trigger it.

### Why nothing went red

`audit-agencysignature-main-tip.ts` reports `CORRECT: 1 / PASS` on this exact commit — it parses
the message itself rather than delegating to git's trailer parser. So the enforcement is *more*
tolerant than git, and the divergence between the two is the actual finding: **the post-merge audit
cannot detect the failure mode its own template warns about.**

### Two things worth deciding (not decided here)

1. **Should the audit adopt git's parser** (or add a check that the block survives as a git
   trailer)? Right now "the audit passes" and "git can read the trailer" are different claims, and
   only the second is what downstream tooling like `git log --format='%(trailers)'` actually gets.
2. **What triggers GitHub's `---------` block?** Hypothesis: a `Co-authored-by` naming an address
   GitHub cannot resolve to a user account (`shadow@zeta.agents`) gets re-emitted in GitHub's own
   aggregated section rather than left in place. NOT verified — one observation, and the
   confounders (persona name, PR having 2 commits, merge queue state) were not isolated. Recorded
   as a coincidence-grade hypothesis per `.claude/rules/numerology-vs-number-theory.md`, not a
   conclusion.

## RESULT of the experiment (PR #11071, squash `55d9e21dc988e280a8fab912bd2ec4ab86e1eab9`)

#11071 shipped the block **without** the trailing `Co-authored-by:` line, as the stated test. Its
squash commit:

```
git log -1 --format='%(trailers:key=Agency-Signature-Version,valueonly)' 55d9e21dc  -> "1"
git log -1 --format=%B 55d9e21dc | grep -c '^---------$'                            -> 0
```

No separator; git reads the trailer. **Consistent with** the hypothesis, and it now has a matched
pair plus the house baseline:

| commit | trailing `Co-authored-by` | GitHub `---------` | git sees the trailer |
|---|---|---|---|
| `163f09edf` (#11039) | `shadow <shadow@zeta.agents>` — unresolvable | **yes** | **no** |
| `55d9e21dc` (#11071) | omitted | no | yes |
| `2b705e63f`, `711bab897`, `80a146304` | ends at `Task:` | no | yes |
| several others on main | `Aaron …` — a real account | no | yes |

The last row is the load-bearing one: commits WITH a `Co-authored-by` naming a resolvable account
are unaffected. So "any co-author line" is excluded, and what survives is the narrower reading —
**an unresolvable co-author address.**

**Still not a conclusion.** One instance of the failure, and #11039 had two commits while #11071 had
one — that confounder is untouched, and a two-commit PR with no `Co-authored-by` would separate
them. `is` stays unearned; `consistent with` is what the evidence supports.

### Cross-refs

- `163f09edfd37cd591a14315ece142685efd5f647` — the affected squash commit (PR #11039).
- `55d9e21dc988e280a8fab912bd2ec4ab86e1eab9` — the control (PR #11071).
- `.github/PULL_REQUEST_TEMPLATE.md` — the Trailer Contiguity Survival Failure note, and the
  `Co-authored-by:` line that ends the canonical block.
- `src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts` — the post-merge audit that
  passes; `validate-agencysignature-pr-body.ts` — the pre-merge check that also passed.
- #11002 — the sibling failure (invented namespace: structurally perfect, semantically empty). This
  is its mirror image: semantically perfect, structurally split.

## Resolution 2026-08-25

The two questions above are now settled by the current source contract and its measured research
record. GitHub recomputes the squash co-author set and may append it after a separator; authors
cannot control that layout. The supported reader is therefore the canonical complete-block scan in
`agencysignature-block.ts`, while the audit separately reports whether git's trailer parser can
see the block. Layout is not classified as a field defect.

PR #15332 provided a stronger live witness. Its squash `ae9f2f1de3cc` contains two complete,
agreeing AgencySignature blocks followed by GitHub's separator and a resolvable Codex co-author.
This falsifies the earlier narrower hypothesis that an unresolvable co-author address was required.
The canonical auditor reports the squash `CORRECT`, names both blocks, and states that git's
trailer parser does not see them.

An initial audit in the Codex session incorrectly reported that squash as unsigned because the
`git fetch` that introduced the object and the audit were launched concurrently. The audit read
before the fetch completed and received no commit message. Running the dependent operations in
sequence produced the correct verdict. That was an invocation race, not a repository regression.

No source change is required. The workitem is complete because the producer behavior is measured,
the supported parser is explicit, the unresolved-address hypothesis is retired, and the current
post-merge audit accepts the actual squash while remaining strict about missing or invalid fields.
