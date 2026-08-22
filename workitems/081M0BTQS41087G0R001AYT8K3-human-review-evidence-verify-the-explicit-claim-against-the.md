---
id: 081M0BTQS41087G0R001AYT8K3
type: task
state: backlog
priority: P2
slug: human-review-evidence-verify-the-explicit-claim-against-the
title: "Human-Review evidence: verify the explicit claim against the forge; propose the attested-unverifiable enum + pointer form (v2)"
created: 2026-08-19T01:38:56.257Z
depends_on: []
composes_with: []
---

# Human-Review evidence: verify the explicit claim against the forge; propose the attested-unverifiable enum + pointer form (v2)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0BTQS41087G0R001AYT8K3-*.md` glob. -->

## The finding

`Human-Review` is called "THE accountability claim" by `agencysignature-block.ts`'s own
`GOVERNANCE_KEYS` table, and the only thing enforcing it — `validateReviewConsistency` —
checked that the claim was internally consistent **with itself**. Nothing queried whether a
review happened. With `required_pull_request_reviews: null` and CODEOWNERS inert, the trailer
was the sole record of human accountability, written by its own subject and merged by that
same actor under auto-merge.

## Shipped

- `src/Core.TypeScript/hygiene/human-review-evidence.ts` — resolves `pr-review` and
  `pr-comment` against the forge; independence filter (no self-review, no bots, no
  PENDING/DISMISSED, no reviews of commits that history rewriting removed).
- Four outcomes on three exit codes: `verified`/`not-claimed`/`unverifiable` → 0,
  `absent` → 1, `indeterminate` → 2. **Fail closed on the claim, not on the tooling** — a
  failed API call never reads as either a pass or a refutation.
- `verify-human-review` job + a `pull_request_review` trigger so the gate re-evaluates when
  its evidence arrives.
- 37 falsifiers; three mutations run against the shipped code each kill 4–5 tests.

## Open — needs a human call (spec §10 governance gate: enum change ⇒ version bump)

1. **`attested-unverifiable` evidence class.** Measured: 501 of 501 well-formed `explicit`
   claims on `main` cite `chat`, which no forge query can resolve. An explicitly-unverifiable
   attestation category beats an `explicit` nobody can falsify.
2. **Evidence as a pointer** (`pr-review#<review-id>`) rather than a genre label. §5.3 calls
   the field an "evidence pointer"; the shipped enum is a genre label. Zero migration cost for
   the 501 existing v1 blocks (the version key discriminates); ~8 in-repo producers move.

Analysis + full proposal:
`docs/research/2026-08-18-human-review-explicit-was-self-certifying-the-verification-half-and-the-v2-vocabulary-proposal.md`

3. **Illegal values already on `main`** (not repaired here, per Aaron 2026-08-16 "correcting
   old bad data is a nice to have bonus"): 77 × `Human-Review: pending`, 11 × `aaron-*` free
   text, 18 × `Human-Review-Evidence: pr`, 15 × free-text sentences.
