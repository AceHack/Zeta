# `Human-Review: explicit` was self-certifying — the verification half, and the v2 vocabulary proposal

**Date:** 2026-08-18
**Work item:** 081M0BTQS41087G0R001AYT8K3
**Status:** half SHIPPED (the verifier), half PROPOSED (the enum change — it needs an
`Agency-Signature-Version` bump and is therefore not taken unilaterally)
**Spec under discussion:**
`docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md`

---

## 1. The finding

`agencysignature-block.ts` names `Human-Review` "THE accountability claim" in its own
`GOVERNANCE_KEYS` table. The only thing enforcing it was `validateReviewConsistency`, which
checks that the claim agrees **with itself**:

- `Human-Review: explicit` requires `Human-Review-Evidence != none`
- anything else requires `Human-Review-Evidence == none`

Both halves are written by the commit author. Nothing queried whether a review happened.
Measured before the fix:

```console
$ git grep "pulls/.*reviews\|listReviews\|reviewDecision" -- .github/ src/Core.TypeScript/hygiene/
(empty)
```

And the claim was not backed anywhere else in the repository either:

| surface                         | state                                                  | consequence                     |
| ------------------------------- | ------------------------------------------------------ | ------------------------------- |
| `github-settings.expected.json` | `required_pull_request_reviews: null`                  | no forge-enforced review        |
| `github-settings.expected.json` | `required_signatures: false`                           | no cryptographic author binding |
| `CODEOWNERS`                    | `required_approving_review_count: none` (its own note) | inert                           |

So the trailer was the **sole** record of human accountability, **its author was its own
subject**, and under auto-merge the same actor wrote the claim, believed it, and merged it.

This is the vacuity class the module family already names elsewhere — _a check that cannot
fail is not a check_ — sitting on the one field the module calls load-bearing.

---

## 2. The measurement that decides the shape of the fix

Counted across all of `main`, 2026-08-18:

```console
$ git log --pretty='%B' | grep -ci "^Human-Review-Evidence: chat"           # 501
$ git log --pretty='%B' | grep -ci "^Human-Review-Evidence: pr-review"      #   0
$ git log --pretty='%B' | grep -ci "^Human-Review-Evidence: pr-comment"     #   0
$ git log --pretty='%B' | grep -ci "^Human-Review-Evidence: signed-policy"  #   0
```

And the claim distribution (last 3000 commits):

| `Human-Review`                         | count |
| -------------------------------------- | ----- |
| `not-implied-by-credential`            | 13529 |
| `explicit`                             | 308   |
| `none`                                 | 156   |
| `pending` (not a legal value)          | 77    |
| `aaron-*` free text (not legal values) | 11    |

**Every well-formed `explicit` claim in this repository's history cites `chat`** — the one
evidence category that no forge query can resolve.

That is the single most important fact in this document, and it has a sharp consequence:

> A verifier for `pr-review` / `pr-comment` alone binds **zero** existing commits. Shipped
> without saying so, it would go green forever, and its greenness would read as "human review
> is verified" while it verified nothing — the audited defect, rebuilt inside its own fix.

The fix is therefore built in two parts, and the second part is why this document exists.

---

## 3. What shipped (this PR)

`src/Core.TypeScript/hygiene/human-review-evidence.ts` + falsifiers + a
`verify-human-review` job in `.github/workflows/agencysignature-enforcement.yml`.

### 3.1 Four outcomes, three exit codes

| outcome         | meaning                                                                        | exit |
| --------------- | ------------------------------------------------------------------------------ | ---- |
| `not-claimed`   | `Human-Review != explicit` — asserts nothing, **no lookup performed**          | 0    |
| `verified`      | an independent human artifact exists on the forge and was read                 | 0    |
| `unverifiable`  | `chat` / `signed-policy` — outside the forge; **states that it did not check** | 0    |
| `absent`        | looked, and there is no independent human artifact — **the claim is refuted**  | 1    |
| `indeterminate` | could not look (rate limit, network, bad JSON, unknown enum)                   | 2    |

**`absent` vs `indeterminate` is the finding applied to the fix.** A failed API call is not
evidence that a review is missing. It does not convict the claim and it does not acquit it, so
it gets a code that is neither 0 nor 1. The workflow step captures the code explicitly rather
than letting `pipefail` flatten a `gh` failure into "the claim is refuted".

### 3.2 The independence filter

`explicit` is defined by spec §7.6 as _"Requires **independent** human-generated evidence."_
An artifact is rejected when it is:

- posted by the **proposal's own author** — the audited defect one API call further out;
- posted by a **bot** (forge `type` field first, `[bot]` suffix as a secondary signal);
- **PENDING** (never submitted, so nobody can see it) or **DISMISSED** (withdrawn);
- against a **commit no longer in the PR** — history was rewritten under the review, so the
  code the human looked at is gone. Skipped, _and said to be skipped_, when the commit list
  could not be fetched.

`CHANGES_REQUESTED` and `COMMENTED` **do** count: the claim is that a human _reviewed_, not
that a human _approved_.

### 3.3 The residual hole, stated rather than papered over

Under `Credential-Mode: shared`, one login may be driven by either a human or an agent. A
review from a login that is not the author is independent **of the author**; it is not proof a
human's hands were on it. That is spec Rule 2 (Identity Demarcation: never use an identity
field as proof of human action), and no forge query settles it.

What the check actually buys, stated precisely: **it refutes the self-certifying case** — the
one that was in fact happening. It does not manufacture proof of humanity, and the tool prints
that caveat on every `verified` run rather than letting a green tick imply it.

### 3.4 Falsifiers

37 tests. Three mutations were run against the shipped code to confirm the suite is not
decorative:

| mutation                                                     | tests killed |
| ------------------------------------------------------------ | ------------ |
| delete the self-review rejection rule                        | 4            |
| make `indeterminate` exit 0 (silent pass on tooling failure) | 4            |
| return `verified` where the code returns `absent`            | 5            |

---

## 4. What is PROPOSED, not taken — and why

Spec §10 "Governance gate" is explicit:

> Schema changes require `Agency-Signature-Version` bump + cross-substrate ferry-round.
> **Adding a new trailer field, changing an enum value**, or modifying body-section structure
> **is a schema change**.

Reinforced by §9.3's stop-adding-trailers blade and §9.2 rule 4. Both proposals below change
the enum, so both are v2 work and neither is merged here.

Note the contrast, which is the reason the verifier could ship today: **verification is not a
schema change.** No field, enum value, or body section moved — §7.6 already said `explicit`
requires independent evidence, and §5.3 already said the pointer exists to make the claim
_"auditable"_ rather than _"unfalsifiable"_. The enum shipped; the audit never did. This PR is
the missing half of a spec that was already written.

### 4.1 Proposal A — an explicitly-unverifiable evidence class

**Problem.** `chat` and `signed-policy` are honest, legal, and unfalsifiable. They currently
share the word `explicit` with `pr-review`, which is checkable. One word therefore covers both
"a machine confirmed this" and "take my word for it", and a reader cannot tell which they have
without reading the evidence field and knowing which values are resolvable.

**Proposed.** Make the distinction part of the vocabulary rather than tribal knowledge — for
example an `attested-unverifiable` evidence class (or a `Human-Review: attested` state) that
says _out loud_ that the claim rests on the actor's word.

**Why this is the honest repair.** An explicitly-unverifiable attestation beats an `explicit`
that nobody can falsify. The first is a true statement about the evidence's nature; the second
borrows the credibility of a checkable claim without being one. This also makes the 501 `chat`
commits _readable_ rather than retroactively wrong: they were always attestations, and the
vocabulary simply never had the word.

**Migration cost: zero for history.** `validateV2` is already version-conditional, and the
version key discriminates, so every existing v1 block stays valid untouched.

### 4.2 Proposal B — evidence as a POINTER, not a genre label

**Problem.** §5.3 calls the field an _"evidence pointer"_ and Rule 3 says to _"point to"_ the
evidence — but the shipped enum is a set of **genre labels**. `pr-review` names a _category of
place_, not an artifact. Two commits claiming `pr-review` on the same PR are indistinguishable,
and a reader cannot follow the pointer to anything. The spec's own word for the field is not
what the field does.

**Proposed.** `pr-review#<review-id>`, `pr-comment#<comment-id>`, `chat#<committed-transcript-path>`
— the label plus the specific artifact.

**What it buys.** The verifier stops asking "does _any_ independent review exist?" and starts
asking "does _this_ one exist, and is it independent?" That is strictly stronger: it survives a
PR where one stale review is used to certify a later, unrelated claim, and it makes the audit
trail followable by a human years later, which is the "future-archaeology" §5.3 asks for.

**Migration cost, stated honestly:**

| population                        | cost                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 501 existing v1 commits on `main` | **zero** — v1 blocks keep genre labels; the version key discriminates and `validateV2` is already version-conditional                                                                                                                                  |
| in-repo producers                 | ~8 code files emit a block (`flush-via-staging.ts`, `agent-proposal.ts`, `proposal-gated-commit-runner.ts`, `commit-practice-evidence.ts`, `merge-heartbeats-to-main.ts`, the three hygiene instruments). The rest of the 817 matches are docs/history |
| agents/humans                     | the real cost — a pointer must be obtained _before_ the commit message is written, and for `pr-review` the review often does not exist yet at commit time                                                                                              |

That last row is the genuine objection and it should be weighed rather than waved past: a
pointer form is awkward precisely where review is most valuable (pre-merge), because the
artifact it must name does not exist when the message is authored. A workable answer is that
the pointer is optional-but-validated-when-present in v2 — if you supply one it must resolve;
if you do not, you fall back to the genre label and the weaker check. That keeps the strong
form available without making the common path impossible.

### 4.3 Also worth a decision — the illegal values already on `main`

77 commits carry `Human-Review: pending` and 11 carry `aaron-*` free text; 18 carry
`Human-Review-Evidence: pr` and 15 carry free-text sentences. These are not legal under §7.6
and predate the shared module. They are named here so the count is on record; per Aaron
2026-08-16 (_"parsing and or correcting old bad data is a nice to have bonus not necessary"_)
they are not repaired by this PR.

---

## 5. The irony, named

This PR asserts `Human-Review: not-implied-by-credential` / `Human-Review-Evidence: none` — the
free path, which performs no lookup and claims nothing about a human. That is the accurate
claim for how it was produced, and stating it accurately is the whole point of the change:
an accurate lesser claim is always preferable to an unbacked greater one.

Had it claimed `explicit`, the gate it adds would have had no way to check it — because it
would have cited `chat`, like all 501 before it.

---

## Pointers

- `src/Core.TypeScript/hygiene/human-review-evidence.ts` — the verifier
- `src/Core.TypeScript/hygiene/human-review-evidence.test.ts` — the falsifiers
- `src/Core.TypeScript/hygiene/agencysignature-block.ts` — `validateReviewConsistency`, the
  self-consistency check this PR **adds to and does not replace**
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a model without a falsifier is a toy;
  this is that rule applied to a governance claim
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — the verifier reports the
  neutral fact (`absent` / `indeterminate`), never an accusation of intent
