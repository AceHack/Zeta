---
id: 081M092W2E7087G0R000KDKHWS
type: bug
state: done
priority: P2
slug: agencysignature-validator-s-failure-text-names-the-wrong-art
title: "agencysignature validator's failure text names the wrong artifact — sends you to fix the commit when it read the PR body"
created: 2026-08-18T00:03:22.183Z
completed: 2026-08-18T13:38:55.707Z
depends_on: []
composes_with: []
---

# agencysignature validator's failure text names the wrong artifact — sends you to fix the commit when it read the PR body

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M092W2E7087G0R000KDKHWS-*.md` glob. -->

## The defect

`.github/workflows/agencysignature-enforcement.yml` runs **one** validator
(`src/Core.TypeScript/hygiene/validate-agencysignature-pr-body.ts`) against **two
different inputs**:

| job | step feeds it |
|---|---|
| `agencysignature (PR body)` | `printf '%s' "$PR_BODY"` — the PR **description** |
| the squash-preimage job | `gh api .../pulls/N/commits --jq '.[].commit.message'` — the **commit messages** |

The tool reads stdin and has no way to know which it got, but `emitParseFailure`
hardcodes one provenance:

```
FAIL: no parseable git trailers found in the PR's COMMIT MESSAGES
  Cause:  no commit on this PR carries a 'Agency-Signature-Version:' line. NOTE:
          this check reads COMMIT MESSAGES, not the PR description — a perfect
          block in the PR description does NOT satisfy it.
  Fix:    append the 10-trailer block ... at the very bottom of the COMMIT
          MESSAGE (not the PR description).
```

When the **PR body** job emits that, every sentence is false for the artifact it
actually read — and it explicitly denies the fix that works.

## Measured cost, twice in one hour (2026-08-17)

1. **PR #11707 → #11710.** Otto followed the message, concluded the commit trailer
   was at fault, found a *real but unrelated* contiguity defect, **closed the PR and
   rebuilt the branch**. The rebuild failed identically. The actual fix was one
   `gh pr edit --body-file`. One wasted branch, one wasted PR number.
2. **PR #11712.** A background research agent hit the same failure within the hour
   and had to be intercepted mid-flight to stop it repeating the rebuild.

Independently found and written up by that agent as §7 of
`docs/research/2026-08-17-path-independence-in-four-costumes-crdt-bell-holonomy-calm-literature-scout-verdict.md`,
which names it correctly: *one validator, two opposite inputs, one shared error
message — it cannot be right for both, so it is evidence for neither.* **The vacuity
class in CI dress**, inside the very tool built to enforce against that class.

## Proposed fix (not implemented — this gates every PR in the repo)

Add a `--source pr-body|commit-messages` option to `ValidatorOptions`, pass it from
each of the two call sites in the workflow, and have `emitParseFailure` name the
artifact it was actually handed. Behaviour unchanged; only the diagnostic moves.

Deliberately **not** done autonomously: this is enforcement tooling on the required
`gate` check, it has its own test suite (`validate-agencysignature-pr-body.test.ts`)
whose expectations are output strings, and no one asked for it. Filing beats
patching a gate at midnight.

## Adjacent, real, and worth keeping separate

The **commit-side** contiguity rule genuinely bites and is not this bug: a blank line
between `Task:` and `Co-authored-by:` ends the trailer paragraph, so
`git interpret-trailers --parse` returns only `Co-authored-by:` and the ten fields
silently degrade to prose. Verify before pushing:

```
git log -1 --format='%B' | git interpret-trailers --parse   # must print all 11
```

Both requirements are real. The bug is that the diagnostic for one names the other.
