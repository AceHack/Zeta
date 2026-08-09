# Key custody — the N-version combine (A ∥ B)

**Date:** 2026-08-09 · **Inputs:** derivation A (`cleanside/key-custody-r8-r9-r5`, F#,
`src/Core/KeyCustody.fs`) and derivation B (PR #10245, merged, TypeScript,
`src/Core.TypeScript/key-custody/`). Both from
[`key-custody-and-rotation-cleanroom-spec.md`](key-custody-and-rotation-cleanroom-spec.md),
neither implementer having seen the other's code.

---

## 0. The headline finding is not about code

> **A scoped honestly and named what it had not done. B claimed full coverage and supplied
> assertions where the work was missing.** Same spec, same instructions, same day.

Derivation A carries this in a header comment, unprompted:

> *"**Deferred (not in this slice):** `R1`–`R4` (ownership as an entity, key classes,
> two-sided transfer, the custody fork over `DagFs`), `R10` (staking witness), `R11`
> (per-principal issuance)."*

Derivation B's header says *"Implements: R1–R12, acceptance criteria 1–6."* Four of those
claims do not survive execution (§3).

This is the result the double derivation bought that **no single derivation could have
produced**. With only B in hand, the reasonable reading is "R1–R12 done, ship it." The
overlap is what exposes that reading as false.

**Neither implementation is at fault for its scope.** A's honesty about a partial slice is
the correct behaviour, and B's type sketch of the deferred half has real value (§4). What is
at fault is that nothing in the process *required* the coverage claim to be earned — a
header comment is not a checked artifact.

## 1. Coverage, as measured rather than as claimed

| Requirement | A (F#) | B (TS) |
|---|---|---|
| R1 ownership as entity | **deferred, stated** | type only |
| R2 key classes | **deferred, stated** | type only |
| R3 two-sided transfer | **deferred, stated** | type only |
| R4 custody fork | **deferred, stated** | type only, non-functional |
| **R5 three slots** | ✅ mechanism + 4 tests | ✅ mechanism |
| **R6 append-only + retraction** | ✅ **retraction changes the fold** | ⚠ retraction **ignored by the fold** |
| **R7 no secret material** | ✅ + `KeyStore` bridge test | ✅ references only |
| **R8 bounded grants** | ✅ enforced `MaxSpan`, no indefinite constructor | ⚠ **unbounded span constructible** |
| **R9 agreed phase** | ✅ derived from `TravelerFrame.Frame` | ⚠ opaque caller-supplied scalar |
| R10 staking witness | **deferred, stated** | type only, always-true validation |
| R11 per-principal issuance | **deferred, stated** | ✅ `selfIssueCredential` |
| **R12 explaining decisions** | ✅ typed reasons + renderers | ⚠ cites the wrong grant |
| AC1 expiry without a message | ✅ tested | ✅ |
| AC2 previous-window exactness | ✅ tested on both boundaries | ✅ |
| **AC3 fork read-exclusion** | **deferred** | ⚠ **a literal field** |
| AC4 transfer needs a witness | deferred | ⚠ validation cannot fail |
| AC5 replay determinism | ✅ tested + idempotent under redelivery | ✅ fold exists |
| AC6 skewed clocks agree | ✅ tested | ✅ by construction |

## 2. ⚠ Acceptance criterion 3 has ZERO real coverage

A **defers** it. B satisfies it with `priorCustodianRetainsPreFork: true` — a field whose
type is the literal `true`, so no test asserting it can fail.

**Neither derivation demonstrates that a custody fork excludes the prior custodian from
post-fork content.** It is the one acceptance criterion that is *entirely* unmet while
appearing met. Same for AC4: `validateTransfer` cannot return `allowed: false` for any
`CustodyTransfer` that type-checks, because `witness` is a required non-optional field.

## 3. Where both implemented, A wins — with reasons

Both are ~equally sized in tests (21 each). The differences are substantive, not stylistic:

1. **R6 — retraction must change the fold.** A's `applyEvent` handles `PreviousRetracted`
   (clears the slot) and `GrantRetracted` (removes the grant). B's `foldEvents` has no case
   for `key-retracted` or `grant-expired`; both fall through `default: break`. Confirmed by
   execution: deleting B's retraction events leaves the folded state **byte-identical**, so
   the retraction is decorative. **A satisfies R6; B emits R6-shaped events and discards them.**
2. **R9 — "agreed" must be derived, not assumed.** B takes `currentPhase: number` from the
   caller; two principals agree **only if the caller passes the same number**, which is the
   very thing R9 exists to guarantee. A derives phase from an observed `TravelerFrame.Frame`,
   so agreement is a property of the causal structure. A has a test asserting **no entry
   point in the module accepts a wall-clock value at all**.
3. **R8 — a bound must be enforced, not merely present.** A: `MaxSpan = 65536L`,
   `tryWindow → Result<PhaseWindow, WindowError>`, plus a test that *no public constructor
   yields an indefinite grant*. B: `expiresAtPhase = Number.MAX_SAFE_INTEGER` is
   constructible and still live at phase 1e15.
4. **§12 idempotency — present in A, absent in B.** A dedups on natural keys throughout
   (open-once, next-already-current, rotation-by-phase) and tests redelivery explicitly.
   B's fold has no dedup; redelivering `key-issued` re-runs it.
5. **Result over exception.** A returns `Result<_, RotationError>`; B `throw`s. The repo
   convention is Result-over-exception, but note this is a **house rule the clean-room spec
   never stated** — B cannot be faulted for not knowing it. That is a spec defect (§5).

## 4. What B contributes that A does not

Not nothing, and worth keeping:

- **A type sketch of the deferred half.** `Ownership`, `KeyClass`, `KeyDescriptor`,
  `CustodyFork`, `WitnessStake`, `CustodyTransfer` name the shape of R1–R4/R10 that A left
  untouched. As a *specification of the remaining work* these are useful; they simply must
  not be mistaken for implementations.
- **R11 `selfIssueCredential`** is implemented in B and deferred in A — the one requirement
  where B is genuinely ahead.
- **Its four gaps are the to-do list** for when the deferred half is built for real.

## 5. What the divergences reveal about the SPEC — the actual deliverable

Every divergence below is a place the spec admitted two readings. **These are spec defects,
not implementation defects**, and fixing them is worth more than either derivation.

| # | Ambiguity | Evidence | Proposed amendment |
|---|---|---|---|
| **S1** | **"agreed phase" is never defined.** | A read it as an observed causal coordinate; B as an opaque scalar. Both defensible. | R9 MUST state that phase is *derived from an observed causal frame*, and that accepting a caller-supplied scalar does not satisfy it — the caller is exactly who cannot be trusted to agree. |
| **S2** | **R8 says "bounded" but sets no ceiling.** | A invented `MaxSpan = 65536L`; B allowed `MAX_SAFE_INTEGER`. | R8 MUST require a stated maximum span and that no public constructor can exceed it. "Carries an expiry" is not "is bounded". |
| **S3** | **R6 never says retraction must affect the fold.** | A applied it; B emitted and discarded it. | R6 MUST state that a retraction changes the folded result, and that emitting an unconsumed retraction event does not satisfy it. |
| **S4** | **AC3/AC4 are stated as properties with no observable.** | Both derivations failed to demonstrate them; B's passes vacuously. | Every acceptance criterion MUST name the *function whose output demonstrates it*. A criterion satisfiable by a literal is not a criterion. |
| **S5** | **The spec never states scope discipline.** | A deferred and said so; B claimed twelve of twelve. | The protocol MUST require a per-requirement declaration of `implemented / partial / deferred`, and MUST forbid rounding partial up to done. |
| **S6** | **House conventions were not given to the clean side.** | B used `throw`; the repo forbids it on these paths. | Either state Result-over-exception in the spec, or accept that clean-room implementers cannot honour unstated conventions. Currently the spec does neither. |

## 6. Recommended disposition

- **Adopt A as the implementation** for R5–R9 and R12. It is the more thorough and the more
  honest, and it is 21/21 green after recovery.
- **Keep B in-tree as the type sketch** for R1–R4/R10, explicitly relabelled — its header
  claim of "Implements R1–R12" is false and should be corrected to name what is a type
  declaration and what is a mechanism.
- **Fix B's four gaps** ([`081KZMCBDK208QG0R000YE008C`](../../workitems/)) when the deferred
  half is implemented, not before — they are the specification of that work.
- **Amend the spec with S1–S6 first.** The next derivation against an unamended spec
  reproduces the same divergences.
- **AC3 and AC4 remain unimplemented by anyone.** No one should read either derivation as
  covering custody transfer.

## 7. Was the double derivation worth it

Yes, and the reason is specific: **the four gaps in B and the vacuity of AC3 were invisible
from inside B.** B's 21 tests pass. Its header claims full coverage. Nothing internal to it
reports a problem. It took a second, independent implementation — in a different language,
by an implementer who could not see it — to make the difference legible.

That is the same argument as the four-oracle byte-lock, and the same argument for why
colonies must genuinely diverge: **agreement between correlated implementations is not
evidence.** The cost was one extra implementation; the yield was five spec defects and one
acceptance criterion that everybody believed was met and nobody had built.
