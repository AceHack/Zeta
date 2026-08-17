---
id: 081KZMCBDK208QG0R000YE008C
type: bug
state: backlog
priority: P2
slug: derivation-b-key-custody-gaps-ac-3-vacuous-retraction-ignore
title: "Derivation B key-custody gaps — AC#3 vacuous, retraction ignored by fold, grant span unbounded"
created: 2026-08-09T23:04:59.234Z
depends_on: []
composes_with: []
---

# Derivation B key-custody gaps — AC#3 vacuous, retraction ignored by fold, grant span unbounded

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZMCBDK208QG0R000YE008C-*.md` glob. -->


## What this is

**Combine inputs for the N-version key-custody derivation.** Four gaps in derivation B
(PR #10245, merged, `src/Core.TypeScript/key-custody/`), each **confirmed by execution**
rather than by reading. Filed rather than fixed: patching B would make the reviewer a third
derivation touching the second, destroying the independence the N-version protocol buys.

The execution probe was a session scratchpad and is not preserved in this repository; the
reproducible findings are retained below without claiming a durable source path.

| Gap | Requirement | Confirmed behaviour |
|---|---|---|
| **AC#3 vacuous** | Acceptance #3 — a custody fork leaves the prior custodian able to read pre-fork and **unable** to read post-fork content | No exported function answers the question. The property is a literal field `priorCustodianRetainsPreFork: true`, true by construction. `validateTransfer` returns `allowed=true` with `keysInvalidatedPostFork: []`. |
| **Retraction ignored by fold** | R6 — retraction rather than deletion **changes the fold's result** | `rotateKey` emits a `key-retracted` event; `foldEvents` has no case for it (falls to `default: break`). Deleting the retraction events leaves the folded state **byte-identical** — so the retraction is decorative. |
| **Grant span unbounded** | R8 — the **default MUST be bounded** rather than indefinite | `expiresAtPhase: Number.MAX_SAFE_INTEGER` is constructible and still live at phase 1e15. The type forces the *field* to exist but never bounds the *span*, so indefinite authority is reachable — the capture R8 exists to prevent. |
| **Deny cites wrong grant** | R12 — an authorization result carries the reason | With grants expiring at 5 and 100, `authorize` at phase 200 reports *"expired at phase 5"* — `matching[0]`, not the longest-lived. Outcome correct, explanation misleading. |

## The AC#3 one is the serious one

It is the **vacuity class** PR #10229 ("make nothing vacuous") was cleaning up, and it is on
`main`. A criterion satisfied by a boolean literal that cannot be false is not tested by any
test that asserts it — the assertion passes because the field's type is `true`.

## Divergence signal (why the double derivation paid)

Derivation A appears to close three of the four independently: an enforced `MaxSpan = 65536L`
with `tryWindow -> Result<PhaseWindow, WindowError>` (R8), `Result<_, RotationError>` instead
of `throw` (repo Result-over-exception convention), and `explainAuthz` (R12). A is still
running; that comparison is provisional until it lands.

**Where A and B diverge, the spec was ambiguous.** The largest divergence found so far is the
**phase model**: B takes `currentPhase: number` (opaque scalar); A derives phase from a
`TravelerFrame.Frame` observation via `Versionstamp`/`PhaseWindow`. The spec said "agreed
phase" and never pinned which. That is a spec defect, not an implementation defect, and
fixing the spec is the higher-value output.

## Done when

The combine pass has ruled on each of the four, and the spec has been amended where the
divergence showed it was ambiguous (phase model first).

## Progress 2026-08-17 — two of four closed in derivation B

Both were **re-verified live on `main` before any change** (these rows are 8 days old and
stale items are common). Neither had been fixed: `git log` shows exactly one commit ever
touching `src/Core.TypeScript/key-custody/` (#10245, the original).

| Gap | Status | Evidence |
|---|---|---|
| **AC#3 vacuous** | **closed** | Vacuity proven mechanically: the falsifying input `priorCustodianRetainsPreFork: false` does not compile (`TS2322: Type 'false' is not assignable to type 'true'`). Field replaced by `priorCustodian: Ownership`; `evaluateForkRead` decides against content lineage. Pre-fork ref → allowed, post-fork ref → denied. |
| **Retraction ignored** | **closed** | Confirmed by execution first: folded state was byte-identical with and without retractions, and a grant retracted at phase 4 still authorized at phase 100. `foldEvents` now consumes `key-retracted` + `grant-expired`. |
| **Grant span unbounded** | **closed** (2nd pass) | `MAX_GRANT_SPAN_PHASES = 65536` stated; `Grant` branded so a literal will not type-check (`TS2741: Property '[grantBrand]' is missing`), making indefinite authority unconstructible rather than merely undefaulted. `tryIssueGrant` returns `Result`. The event stream is not a bypass — the fold refuses over-long grants and records the refusal. |
| **Deny cites wrong grant** | **closed** (2nd pass) | `authorize` cites the longest-lived matching grant; citation no longer depends on stream order, and a not-yet-issued grant is no longer described as "expired". |

**AC#4 — closed in the 2nd pass, and the original diagnosis was partly wrong.** The filed
claim (and the combine doc) said `validateTransfer` "cannot return `false` for any
`CustodyTransfer` that type-checks". Checked by construction, two of its three guards were
unreachable (`witness: undefined`, `voluntary: false`) but the third was **live**
(`resource: ""` type-checks and did deny). The serious defect was one no guard covered:
nothing checked the witness was a party *other than the two transacting*, so the prior
custodian could witness her own transfer away and the beneficiary could witness the transfer
to himself — both returned `allowed: true`. `voluntary` is now `boolean` so a compelled stake
is representable and refusable; distinctness from both custodians is enforced.

Scope, exactly: this checks a transfer *record*. No attestation is signed and no stake is
escrowed, held, or slashed. Which resources count as socially-conferred and non-purchasable
is a policy roster, deliberately not invented here.

**Honest scope of the AC#3 fix:** `evaluateForkRead` is an authorization *decision*, not an
enforcement mechanism. Nothing in this module is cryptographic — no signature is produced or
verified, no content is encrypted, no key is revoked. "Prior custodian cannot read post-fork"
is now a decision the module *returns*, not an impossibility it *enforces*.

**Open question for the maintainer** (not decided here, per no-directives — this is a policy
call, not an implementation gap): should a custody transfer be *required* to invalidate at
least one key across the fork boundary? R4 says "no key is valid across the fork in both
directions", and today `keysInvalidatedPostFork: []` is accepted by `validateTransfer`. A
degenerate fork of an empty custody legitimately has zero keys, so requiring ≥1 is a policy
choice with a real false-positive, and it was left unmade rather than guessed.
