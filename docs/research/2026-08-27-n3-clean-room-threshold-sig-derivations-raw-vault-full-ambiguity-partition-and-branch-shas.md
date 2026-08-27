# The N=3 clean-room threshold-signature run — the raw vault, the full ambiguity partition, and the branch SHAs

**Date:** 2026-08-27 · **Author:** shadow · **Register:** Beacon (outward-facing; the
experiment's findings must stand without the branches)

---

## 0. Why this document exists, and what it is *not*

This document was opened on a second-hand claim that the N=3 clean-room experiment
"exists only as three branches" and that "there is no report document on `main`."

**That claim is wrong, and saying so first is the point.** `main` already carries:

| artifact | path | state |
|---|---|---|
| the shared spec | `docs/specs/threshold-signature-verification-cleanroom-spec.md` | present, **and amended** (B1–B9) from the run's own findings |
| the combine | `docs/specs/threshold-signature-verification-combine.md` | present, 240 lines, including a post-merge CORRECTION section |
| **the shipped synthesis** | `src/Core/MultiSignatureVerification.fs` + its test suite | present — "synthesised from derivation A, with amendments B1–B9 from the combine applied" |
| **the consumer** | `src/Core/Consent/KskAuthorization.fs` | present — now delegates every decision to the synthesis |

So the experiment's *headline* findings were preserved and **acted on** — the spec was
amended in `8144a7966e1d8db84dc4c4b95905429835c6817e` ("amend the multi-signature spec from
the N=3 combine (B1–B9)", #10271), a synthesis was built from the combine's recommended
disposition, and `KskAuthorization` was moved onto it. That last step closed a real hole: the
KSK override gate — the highest-authority path in the system — previously **counted distinct
rostered names and verified no signatures at all**, so any caller able to fabricate bytes
passed. This document does not restate the combine and does not supersede it.

**What is genuinely unpreserved, and is what this document adds:**

1. **The three raw per-derivation reports** (836 lines total) exist *only* on the branches.
   The combine is a synthesis; under
   [`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md)
   the reports are the **raw vault** — a single version of the facts — and a synthesis is not
   a substitute for them.
2. **The branch SHAs are recorded nowhere.** The combine names the three *branch names*. Branch
   names are mutable refs; once deleted, an unrecorded SHA is unrecoverable. §1 fixes that.
3. **The complete ambiguity partition.** The combine reports a 4-row co-discovery table and,
   in its correction section, a handful of B-only findings. The three reports together contain
   **46 recorded ambiguity entries**. The full partition — which theme was found by all three,
   by two, by one — is in §3, and it **corrects the combine in four places** (§4).

---

## 1. The SHAs — the recoverability record

Recorded so the raw derivations survive deletion of the branches. **Do not delete these
branches on the strength of this document**; that is a separate decision for the maintainer.

| derivation | branch | tip SHA | report path (on branch) |
|---|---|---|---|
| **A** | `derivation-a/threshold-sig-verify` | `06b7b32b05f3e0c21c9d56b4e86eaa48a5690239` | `docs/derivations/derivation-a-report.md` |
| **B** | `derivation-b/threshold-sig-verify` | `9c527259bd6e7d8922e998ef57dc270d39203d0b` | `docs/derivations/derivation-b-report.md` |
| **C** | `derivation-c/threshold-sig-verify` | `63cf97e93b6569a7b1bdb9492f4b293ee1bbcdf3` | `docs/derivations/derivation-c-report.md` |

Recovery from a SHA after branch deletion, while the object survives in the repo or any clone:

```
git show 06b7b32b05f3e0c21c9d56b4e86eaa48a5690239:docs/derivations/derivation-a-report.md
```

**Honest limit:** a SHA is only a recovery path while the object is reachable. After branch
deletion these commits become unreachable and are eligible for garbage collection. If the
intent is durable preservation rather than a recovery hint, the reports must be **copied onto
`main`** or the tips **tagged**. This document records the SHAs; it does not by itself make
the objects permanent.

**Artifact sizes** (all present and verified, `git diff --stat` against `origin/main`):

| | report | implementation | tests | total |
|---|---|---|---|---|
| **A** | 286 lines | 429 (`ThresholdSignatureVerification.fs`) | 437 (22 tests) | 1154 |
| **B** | 284 lines | 446 + 88 (`…Verification.fs` + `…Schemes.fs`) | 527 (21 tests) | 1348 |
| **C** | 266 lines | 485 (`ThresholdVerification.fs`) | 708 (21 tests) | 1461 |

---

## 2. Verification of the second-hand claim

| claim | verdict |
|---|---|
| three branches `derivation-{a,b,c}/threshold-sig-verify` exist | **true** |
| each holds an independent derivation of threshold-signature verification | **true** — three separate F# modules, three separate test suites, no shared code |
| each records spec ambiguities | **true** |
| "14–15 ambiguities each" | **partly wrong.** B recorded **14**, C recorded **15**, **A recorded 17**. |
| "there is no report document on `main`" | **wrong** — see §0 |
| the experiment is at risk of being lost | **mostly false** — the *raw reports and the three implementations* are branch-only; the findings, the amended spec, and a shipped synthesis are all on `main`. Deleting the branches would lose the raw vault, not the experiment. |

Each report opens with an explicit **wall declaration** naming what the author did and did not
read — the `cleanroom-two-team-separation` discipline executed rather than asserted. The spec
was written by Otto, who had read `KskAuthorization.fs` and was therefore barred from
implementing it (PR #10265). That is the dirty-side/clean-side split working as designed.

---

## 3. The full ambiguity partition — 46 entries, 9 themes found by all three

**The partition is the primary result.** A theme found independently by all three is evidence
of a **spec defect**; a theme found by one is evidence about that **reading** (or about that
implementer's thoroughness). Read §5 before treating the all-three column as strong evidence.

Cross-walk key: A's entries are `D1–D17`, B's are `D1–D14`, C's are `A1–A15`.

### 3a. Found by ALL THREE — spec defects

| # | theme | A | B | C |
|---|---|---|---|---|
| 1 | **The canonical signed bytes are never specified.** R5 says "over the request's scope and payload" and stops. Naive concatenation is non-injective: `("ab","c")` and `("a","bc")` sign identical bytes. | D2 | D1 | A2 |
| 2 | **R7's window needs a time coordinate the spec never sources.** House rules forbid a wall clock, so the epoch must be supplied — and the spec never says by whom. | D4 | D2 | A1 |
| 3 | **Window boundary inclusivity is unstated.** Inclusive vs half-open differ at **exactly one epoch**, silently, mid-cutover. | D4 | D9 | A8 |
| 4 | **R9's input list is incomplete.** "(roster, request, algorithm set)" omits the epoch (A), the threshold and the scheme policy (C); B states the list is non-exhaustive. | D9 | D2 | A12 |
| 5 | **AC5's "the identical request" is unsatisfiable as literally written.** Two genuinely different schemes cannot verify identical bytes; if they could, one wraps the other and R6 is void. | D13 | D8 | A7 |
| 6 | **AC7's "instance orderings" is undefined** — at least three candidate readings (submission order, registry/roster insertion order, multiple verifier instances). | D7 | D13 | A13 |
| 7 | **R8's rule is strictly narrower than R8's rationale.** The stated bounds are threshold ≥ 1 and ≤ roster size; the rationale says *any* configuration that can never authorize is an error. | D10, D11 | D3 | A10 |
| 8 | **R4's duplicate resolution is underspecified.** "MUST count once" does not say *which* submission counts, whether a duplicate vetoes, or what a valid+invalid pair from one signer means. | D8 | D5 | A5 |
| 9 | **R6's "no call site may name a concrete algorithm" has no stated scope.** Something must name the algorithm or none can be chosen; all three land on "the composition root is exempt", none could read that from the text. | D14 | R6 caveat | closing note |

**Entanglement, stated rather than smoothed over:** themes 2 and 4 are separable in A (D4/D9)
and C (A1/A12) but **fused in B** (D2 makes one entry of both). Counting them as two themes is
a judgement; counting them as one would leave 8 all-three themes rather than 9. Both readings
are defensible and the row is marked so a later reader can re-cut it.

### 3b. Found by TWO

| theme | who |
|---|---|
| **Roster shape** — `signer → key` or `signer → (scheme → key)`; and does "roster size" count people or key bindings? | B:D7, C:A3 |
| **Denial-reason precedence** — one ranked reason or the full finding set, and what order when failure classes co-occur | B:D6, C:A4+A6 |
| **Key rotation is undefined** — may a signer hold two keys under *one* scheme? Both made it a config error and both flagged that rotation arguably requires the opposite. | A:D12, B:D14 |
| **R10's carve-out permits echoing.** "never a raw signature *that has not already been supplied by the caller*" implies a supplied one may be echoed. Both chose the stricter line — echo nothing. | A:D16, C:A14 |
| **Where the migration window lives** — per-scheme, per-verifier, or on a shared registry. B's framing is the sharp one: putting windows on a shared registry **recreates the cutover coordinator R7 exists to deny.** | A:D5, B:D12 |
| **Is the scheme id bound into the signed bytes?** Both said no; A recorded the algorithm-confusion risk that answer leaves open. | A:D3, B:D1-sub |
| **When is a scheme problem a config error vs a per-submission rejection?** C's split is the finer one: *current* scheme unimplemented ⇒ config error, *retiring* scheme unimplemented ⇒ per-submission outcome. | A:D17, C:A9 |

### 3c. Found by ONE — the informative singletons

| theme | who | why it matters |
|---|---|---|
| **The title names a different cryptographic object than the requirements.** "Threshold signature" is the term of art for Desmedt–Frankel/Shamir — one aggregated signature against one group key. R3/R4/AC3 (count signers, de-duplicate, report unknown signers) are only meaningful for **k-of-n multi-signature**. | **A:D1** | The combine calls this the most dangerous defect found, and it is a *naming* error: internally coherent, externally misnamed. Fixed by amendment B1. |
| **AC3 and AC7 are in tension and the resolution is forced.** Which copy of a duplicate "counted" is a function of submission order, so a per-submission verdict satisfies AC3 and fails AC7. | **A:D6** | A spec-internal contradiction, not an implementation divergence. B's D13 note reaches the adjacent observation ("reading only (c) silently decides D5") without naming the contradiction. |
| **Is a failed verification an `Error` or `Ok { Authorized = false }`?** | **A:D15** | Under the `Error` reading, R1's self-explanation lives entirely in the error channel and the verdict type collapses to a unit. |
| **Must a multi-scheme verifier state an end date?** B refused an unbounded overlap; **flagged as its own least-confident call**, noting permanent hybrid classical+PQ is real practice. | **B:D4** | B was right to doubt it. Amendment **B4 went the other way** — a migration window MAY be unbounded. The self-flagged low-confidence call was the one that got overturned. |
| **First-wins duplicate handling enables signer SUPPRESSION.** Inject junk under a target's identity; if the first copy wins, the target's genuine signature never counts. | **B:D5 reasoning** | A denial-of-participation attack no other report named. Fixed by amendment B6. |
| **"Signature is wrong" vs "signature is unreadable."** A truncated roster key reported as an attempted forgery inverts R1's teaching-surface rationale. | **B:D10** | A hit the same wall *empirically* — a 40-byte P1363 signature returns `false` rather than raising — and recorded it as a platform behaviour in its mutation log, not as a spec ambiguity. **Same fact, one register apart.** |
| **May an adapter behind the port throw?** House rules govern code we write, not third-party adapters. | **B:D11** | B declined to wrap the port in `try/with` because that converts an adapter bug into a silent deny. Fixed by amendment B7. |
| **Is the verifier id in the signed bytes?** | **B:D1-sub** | Answered no, because R2's "two verifiers, one identical request" presupposes one signature evaluable by both. |
| **AC3 is vacuous at threshold 1.** "One signer submitted `threshold` times → not authorized" is *false* at threshold 1. | **C:A5-sub** | The vacuity class in an acceptance criterion — it silently assumes threshold ≥ 2. Fixed by amendment B9. |
| **May a roster carry an entry under a scheme the policy does not accept?** C allowed it: pre-staging keys under a future scheme is how a migration begins. | **C:A11** | |
| **Does an off-roster signature deny, or merely not count?** | **C:A15** | A and B both *implemented* "does not veto" without recording it as a choice. AC1 cannot discriminate it, because there the second verifier knows none of the signers. **A silent agreement is not a checked one.** |

---

## 4. Four corrections to the combine

The combine on `main` was written before B reported, and its correction section added B's
findings without re-walking the earlier attributions. Four claims in it are superseded by the
raw reports.

### 4.1 AC5 is a THREE-way co-discovery, not "C only"

The combine's §2c heads "Acceptance criterion 5 is unsatisfiable as written **(C only)**".
All three found it independently — A:D13, B:D8, C:A7 — each stating the same argument (two
different schemes cannot verify identical bytes). This moves AC5 from the weakest evidence
class to the strongest.

### 4.2 AC7's "instance orderings" is a three-way co-discovery absent from the combine entirely

A:D7, B:D13 and C:A13 each independently found the term undefined and each enumerated
overlapping-but-different candidate readings. The combine does not mention it. It belongs in
the co-discovery table.

### 4.3 R8's narrow-vs-broad reading is three-way, not two-way

The combine's §1 table credits A (D10) and C (A10). B's D3 — "R8's rationale is strictly
broader than R8's rule" — is the same finding, with the broadest rejection list of the three
(ten conditions).

### 4.4 "No implementation can fix R7 from inside R5's stated coverage" is over-stated

The combine's §2b concludes that R7's mechanism cannot achieve R7's rationale and that no
implementation can fix it. **Two of the three did fix the load-bearing half**, and the fix is
visible in the code, not just the prose:

| | where the epoch comes from | adversary can assert an in-window epoch? |
|---|---|---|
| **A** | `verify … (epoch: int64)` — a parameter to `verify` | **no** |
| **B** | `verify verifier registry (epoch: Epoch) …` — a parameter to `verify` | **no** |
| **C** | `request.Epoch` — **a field on the request** | **yes**, and C says so |

The replay hole is closed by making the epoch **verifier-supplied**; it never needed to be
signed. Only C's design — which puts the epoch on the request — has the weakness the combine
generalises to all three. C named the weakness itself and marked R7 `partial` for exactly this
reason, which is the coverage discipline working.

**The spec agrees with this correction:** amendment **B3** reads "the epoch is
verifier-supplied, and the window is ADVISORY" — i.e. it adopted A's and B's design. The
combine's own sentence is superseded by the amendment the combine produced.

---

## 5. The independence caveat — why the all-three column is weaker than it looks

**Anchor: Knight & Leveson (1986), "An Experimental Evaluation of the Assumption of
Independence in Multiversion Programming"** (*IEEE TSE* SE-12(1)). Twenty-seven independently
written versions of one specification failed on **correlated** inputs far more often than the
independence assumption predicts. The consequence for us: **agreement between independent
implementations is weaker evidence than it appears**, because the correlation in their errors
is not modelled by the independence assumption N-version programming rests on.

**Anchor: Avizienis** — N-version programming as a design-diversity technique (Avizienis &
Chen 1977; Avizienis, "The N-Version Approach to Fault-Tolerant Software", *IEEE TSE* SE-11(12),
1985).

Both anchors are cited here as **read summaries, not as checked entailments** — the argument
below relies on the standard statement of the correlated-failure result, not on a re-derivation
of Knight & Leveson's data.

**This run's independence is materially weaker than Knight & Leveson's setting**, and the
weakening runs in a direction that inflates the all-three column:

- Knight & Leveson's programmers were separate people from two universities. **These three
  derivations are instances of the same model family**, prompted from the same repository.
- All three read **the same house-conventions surface** — the spec's §"House conventions" and
  `.claude/rules/`. Each report says so in its wall declaration. Convergent choices traceable to
  a shared rules file are not independent discoveries.
- All three read **one spec written by one author**. A defect obvious to that author's phrasing
  is obvious to all three readers of it.
- The clean-room wall blocks *prior art and each other's code*. It does not, and cannot, remove
  shared priors.

So the honest reading of §3a is: **nine themes were found by three readers who share most of
their priors.** That is still the best evidence available, and it is materially weaker than
"three independent observers agreed."

**Where this bites hardest — the silent agreements.** The three *disagreed* on the canonical
encoding, which is why that defect is unmissable. They *agreed*, without any of them recording
it as a choice, that an off-roster signature does not veto (only C:A15 recorded it) — and
agreement nobody noticed making is exactly the failure mode the correlated-failure result
predicts. **The disagreements in this run are more trustworthy than the agreements.**

A cheap improvement for generation 2, following directly from this: **derive at least one
version under a materially different prior** — a different model, a different language, or an
implementer who has not read `.claude/rules/`. Without that, "all three found it" and "the
shared prior produced it" are not distinguishable.

---

## 6. Substantive divergences — where the three genuinely differ

Style is excluded. These are differences that change behaviour on some input.

### 6.1 The three canonical encodings are mutually incompatible (verified in code)

| | domain tag | length prefix | payload length prefixed? |
|---|---|---|---|
| **A** | `"zeta.threshold-signature.v1"` | 4-byte **little**-endian | **yes** |
| **B** | `"zeta.threshold-sig.v1"` | 4-byte **big**-endian (`u32be`) | **yes** |
| **C** | **none** | 4-byte **big**-endian | **no** (payload trails) |

**No two produce the same signed message**, so no derivation can verify another's signatures.
Each derivation's own tests pass regardless, because each generates the signatures it checks —
B predicted precisely this from inside its isolation and said the combine should start there.

### 6.2 C omits domain separation — a real weakness, and fully spec-compliant

A and B both added a domain tag. C reasoned only about **injectivity**, which is the only
property the spec's rationale argues for, and length-prefixing alone achieves it. **C is
correct against the text and materially weaker in practice**: domain separation is what stops
a signature valid in another Zeta context being replayed into this one. A two-way A ∥ B run
would have shown two tagged encodings and looked settled. The absent third opinion was the
informative one. **This is a correctness difference, not taste.**

### 6.3 C's epoch is requester-supplied — a real replay exposure

See §4.4. A and B take the epoch as a parameter to `verify`; C reads `request.Epoch`. An
adversarial requester can therefore replay a retired-scheme signature against C by asserting an
in-window epoch, and cannot against A or B. **Correctness difference, not taste** — and C
disclosed it rather than rounding R7 up.

### 6.4 C closed the R8 hole A explicitly left open

A's D10 identifies that a policy can satisfy `threshold ≤ |roster|` and still be unable to
authorize (a rostered signer holding no key under any accepted scheme), and **A left it open
and marked R8 `partial` rather than closing it silently.** C's `RosterCannotReachThreshold` is
exactly that check, so C marks R8 `implemented`. B's `EmptyRoster`/`NoAcceptedSchemes` set
covers adjacent cases but not this one. **A real capability difference — and A's `partial` is
the honest register, not a defect.**

### 6.5 Divergence in severity, on one shared observation

All three found R7's epoch problem. **A treated it as a completeness gap** (add `epoch` to
R9's input list), **C treated it as a security hole** (named the replay, marked R7 `partial`),
**B treated it as a security hole and shipped the mitigation** (verifier-supplied, naming it a
downgrade attack). Same observation, three severity readings. That divergence is only visible
with more than one report to compare, and it is itself a finding.

### 6.6 Verdict shape

A reports **per signer** (forced by its D6 analysis of the AC3/AC7 contradiction). B reports
**both** — a lossless per-submission `Outcomes` list plus one ranked `DenialReason`. C reports
**all findings, ordered**, so `List.head` satisfies AC2's observable while nothing is discarded.
Three readings of R1; none contradicts the text.

---

## 7. Reintegration, not reconvergence

Per [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
and the raw-vault rule, this document **does not pick a winner**. The combine already recorded
a *disposition* recommendation — adopt A as the base, graft C's R7 analysis and the AC5/AC3
corrections, keep B's test battery — and that recommendation **was executed**:
`MultiSignatureVerification.fs` says "synthesised from derivation A, with amendments B1–B9
applied."

A shipped synthesis is a *business-vault* artifact: one version of the truth, chosen for a
purpose. It does not discharge the obligation to keep the facts. What this document adds is the
insistence that **all three paths remain recorded**:

- **A** is the most conservative on coverage — two `partial`s where it could have claimed
  `implemented`, and the D10 hole named rather than closed. It found the naming defect nobody
  else saw.
- **B** carries the deepest attack analysis (suppression, downgrade) and the sharpest
  architectural argument (D12: windows on a shared registry recreate the coordinator R7
  denies). Its self-flagged least-confident call (D4) is the one the spec overturned.
- **C** is the weakest artifact on two named counts (§6.2, §6.3) and the strongest on two others
  (§6.4 R8; the 1440-permutation determinism test, plus the only report that explicitly asserts
  which surface is order-*sensitive*). **C is not the "wrong" one to discard** — its tagless
  encoding is what proved the spec permitted omitting domain separation, which is the single
  most valuable thing the run produced.

Retaining C's *weaknesses* on the record is the point. Collapsing to the strongest
implementation would delete the evidence that the spec permitted the weak one.

---

## 8. What remains open

1. **Durable preservation.** §1 records SHAs; it does not make the objects permanent. If the
   maintainer wants the raw reports durable, copy them to `main` under `docs/derivations/` or
   tag the three tips. **Unresolved, and a decision for Aaron — no branch should be deleted
   until it is made.**
2. ~~Nothing consumes the result.~~ **Closed — and it was the reason to check rather than
   assume.** An earlier draft of this section asserted that the run produced an amended spec
   and no shipped verifier. That was wrong: `src/Core/MultiSignatureVerification.fs` is on
   `main`, synthesised from derivation A with B1–B9 applied, and `KskAuthorization` delegates
   to it. **None of the three derivation modules is on `main` under its own name**, which is
   what a file-existence check shows and is what misled the draft — the synthesis carries a
   third name. The finding is recorded rather than silently deleted because it is the same
   defect class the run exists to study: a check that looked like it answered the question
   and did not.
3. **The generation-2 diversity fix** (§5) — derive at least one version under a materially
   different prior, or the all-three column stays uninterpretable.
4. **The generation-2 reporting fix** already recorded in the combine's §4 — append each
   ambiguity to the report *at the moment it is resolved*, not in a final section. A skeleton
   proves intent and preserves nothing.

---

## Anchors (Beacon)

- **A. Avizienis & L. Chen**, "On the implementation of N-version programming for software
  fault tolerance during program execution" (COMPSAC 1977); **A. Avizienis**, "The N-Version
  Approach to Fault-Tolerant Software", *IEEE TSE* SE-11(12), 1985 — the origin of design
  diversity as a fault-tolerance technique. **Cited as a read summary, not a checked entailment.**
- **J. C. Knight & N. G. Leveson**, "An Experimental Evaluation of the Assumption of
  Independence in Multiversion Programming", *IEEE TSE* SE-12(1), 1986 — independently written
  versions fail on correlated inputs; the independence assumption does not hold. **The result
  §5 leans on. Cited as a read summary, not a checked entailment.**
- **Y. Desmedt & Y. Frankel**, "Threshold cryptosystems" (CRYPTO '89); **A. Shamir**, "How to
  share a secret" (CACM 1979) — the construction the spec's *title* named and its
  *requirements* did not, which is A:D1 and amendment B1.
- [`cleanroom-two-team-separation`](../../.claude/rules/cleanroom-two-team-separation.md) — the
  wall this run executed: whoever looked may not build.
- [`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md)
  — raw vault: a single version of the facts, never a single version of the truth.
- [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — all three ran mutation checks before claiming `implemented`, and all three named a
  `toy`-prefixed scheme double.
- `.claude/skills/code-review-and-quality/blueprints/n-version-derivation.md` — the blueprint
  this run was the first generation-1 execution of.

## Pointers

- `docs/specs/threshold-signature-verification-cleanroom-spec.md` — the shared spec, amended B1–B9
- `docs/specs/threshold-signature-verification-combine.md` — the combine (§4 corrects four claims in it)
- `docs/history/pr-reviews/PR-10265-*` — the spec PR; `PR-10242…PR-10251` — generation 0 (key custody)
