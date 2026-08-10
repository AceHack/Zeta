# Derivation C — threshold signature verification (N-version, clean room)

**Branch:** `derivation-c/threshold-sig-verify`
**Spec:** `docs/specs/threshold-signature-verification-cleanroom-spec.md`

**Wall:** I did not read `src/Core/Consent/KskAuthorization.fs`, any `cleanside/*` or
`derivation-*` branch, or any third-party / prior-employer implementation of threshold signature
verification. I read only: the spec; `src/Core/Crypto.fs` (our own convention for a hexagonal
crypto port); `src/Core/Core.fsproj` and `tests/Tests.FSharp/Tests.FSharp.fsproj` (registration);
and `tests/Tests.FSharp/AntiSybil.Tests.fs` (test-file shape). I am not aware of having seen an
implementation of this functionality previously.

**Artifacts**

| file | what |
|---|---|
| `src/Core/ThresholdVerification.fs` | the module: R6 port, the verifier, two real scheme impls + one toy double |
| `tests/Tests.FSharp/ThresholdVerification.Tests.fs` | 21 tests, each with its own control case |

**Gates:** `dotnet build -c Release` (whole solution) → **0 warnings, 0 errors**.
`dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --filter
"FullyQualifiedName~ThresholdVerificationTests"` → **21 passed, 0 failed**.

---

## 1. Spec defects and ambiguities surfaced

This is the section the exercise is actually for. Each entry names **both** honest readings, the
one this derivation took, and — where it exists — the concrete input at which two derivations
that read it differently would produce different output.

### A1 — The migration window has no signed time coordinate (highest severity)

R5 binds a signature to **"the request's scope and payload"**. R7 requires a **bounded window**
"stated in the data". A window needs something to be measured against, and the house conventions
forbid a wall clock ("if you need time, take it as a parameter"). So the time coordinate is
necessarily caller-supplied data — and R5 does not put it under the signature.

- **Reading 1 (chosen):** R5 is literal. The epoch is a field on the request, outside the signed
  bytes. Consequence: **an adversarial caller can assert any epoch**, so a retiring-scheme
  signature can be replayed after the window closes simply by claiming an in-window epoch. Under
  this reading the window disciplines an *honest* caller and is not a security boundary.
- **Reading 2:** "scope and payload" is loose for "the request", and the epoch is signed. The
  window then genuinely binds — but R5's stated coverage is then wrong, and every signer must
  commit to an epoch at signing time, which is a different and heavier protocol.

I took reading 1 because R5 is explicit about what is covered and I would rather surface the
weakness than quietly widen a cryptographic binding. **The spec should say what the window is
measured against and whether that value is signed.** As written, R7's rationale ("there is no
coordinator to sequence a cutover") is not achieved by R7's mechanism.

### A2 — "scope and payload" has no canonical byte encoding

R5 says a signature is over the scope and the payload; it never says how the two are combined.
Naive concatenation is **ambiguous**: `("ab", "c")` and `("a", "bc")` produce identical bytes, so
a signature authorizing one authorizes the other.

- **Chosen:** 4-byte big-endian length of the UTF-8 scope, then the scope, then the payload
  (`canonicalMessage`). Endian-explicit so the bytes are identical on every machine.
- **Alternative:** any other canonical form — domain-separated hashing, a delimiter, TLV.

This is a **byte-level interoperability divergence the spec cannot arbitrate**: two derivations
can both be correct against the text and still refuse each other's signatures. Pinned by
``R5 binding: scope and payload are length-prefixed…``.

### A3 — "roster size" in R8 is either people or key bindings

R8 bounds the threshold by "the roster size". During a migration one signer legitimately holds a
key under both schemes, so the two counts differ.

- **Chosen:** distinct **signers**. A threshold counts consenting parties.
- **Alternative:** roster **entries**. Under that reading a two-key signer could meet a
  threshold of 2 alone, which defeats R4 in spirit while satisfying it in letter.

Pinned by ``R8 roster size counts distinct SIGNERS, not key bindings``.

### A4 — One denial reason, or all findings?

Acceptance criterion 2 says the reason must "identify verification failure rather than an
insufficient count".

- **Reading 1:** exactly one reason, and it is the cryptographic one.
- **Reading 2 (chosen):** all findings are reported (R1's rationale is that an error is a
  teaching surface), **ordered** so the specific findings precede the count shortfall. `List.head`
  therefore satisfies reading 1's observable requirement while nothing is thrown away.

Divergence point: a derivation under reading 1 returns a single reason; mine returns five in the
worst case. Pinned by ``R1 reasons are matchable values…``.

### A5 — Does a duplicate veto, or merely fail to count twice?

R4 says duplicates "MUST count once" and "MUST be reported distinctly". It does not say they deny.

- **Chosen:** duplicates do not veto. `{A, A, B}` at threshold 2 **authorizes**, and A is still
  reported as duplicated.
- **Alternative:** any duplicate is evidence of malfunction or attack and denies.

Criterion 3 does not separate these (it uses only one signer). Pinned by
``R4 duplicates do not veto…``.

**Sub-defect: criterion 3 is vacuous at threshold 1.** "One signer submitted `threshold` times →
not authorized" is false at threshold 1 (one submission from one rostered signer must authorize —
that is the whole point). The criterion silently assumes threshold ≥ 2. I test at threshold 2.

### A6 — Precedence when a submission fails several checks at once

An off-roster signer submitting under an unaccepted scheme fails two checks. The spec fixes no
precedence.

- **Chosen order:** roster membership → scheme acceptance → implementation availability → key
  availability → cryptographic check. R3's "MUST be reported distinctly" is the strongest of the
  reporting requirements, so roster goes first.
- **Alternative:** scheme-acceptance first, which reports `SchemeNotAccepted` for the same input.

Two derivations here agree on the **decision** and differ on the **reason** — precisely the class
of divergence R1 makes observable.

### A7 — Acceptance criterion 5 is unsatisfiable as literally written

"The identical request and roster verify under two different scheme implementations."

- **Literal reading:** the same signature bytes and the same public key verify under both
  schemes. **No two genuinely different signature schemes can do this** — if they could, one is a
  wrapper of the other and R6's point is lost.
- **Chosen reading:** the same request *shape* — scope, payload, signer identities, threshold, and
  **the same call site** — authorizes under either scheme, with key and signature bytes
  necessarily differing.

The load-bearing half of R6 ("no call site may name a concrete algorithm") is what my test pins:
`runUnder` takes the scheme as a value and names none. I am declaring criterion 5 **partial**
rather than implemented because the criterion as written is not what I demonstrated.

### A8 — Are the window endpoints inclusive?

Criterion 6 asks for "the boundary checked on both sides" without saying which side the boundary
epoch itself falls on.

- **Chosen:** closed interval, `first <= e <= last`.
- **Alternative:** half-open `[first, last)`.

These differ at **exactly one epoch**, which makes this the sharpest possible divergence point
between derivations: a single input flips the verdict. Tested at 9 / 10 / 15 / 20 / 21.

### A9 — Missing implementation: configuration error or per-submission outcome?

The spec never says what happens when the algorithm set does not contain an implementation of a
policy scheme. I **split** it:

- current scheme has no implementation → **`ConfigError`** (that verifier could never authorize,
  which is R8's own trigger);
- retiring scheme has no implementation → per-submission `NoImplementationForScheme` (the verifier
  can still authorize under the current scheme, so the configuration is not dead).

### A10 — How far does "a configuration that cannot ever authorize" reach?

- **Narrow reading:** R8 is only about `1 ≤ threshold ≤ rosterSize`.
- **Chosen (broad):** it is a standing obligation. I added `RosterCannotReachThreshold`: if fewer
  signers hold a key under an *ever*-acceptable scheme than the threshold requires, no epoch and no
  set of submissions could reach it, so it is a configuration error.

The narrow reading admits a verifier whose entire roster is keyed under a scheme its policy never
accepts — a silent permanent deny, which is exactly what R8's rationale forbids. Pinned by
``R8 a roster that could never reach its threshold…``.

### A11 — May a roster carry an entry under a scheme the policy does not accept?

Spec silent. **Chosen:** allowed — pre-staging keys under a future scheme is how a migration
begins. **Alternative:** reject as a configuration error. Exercised (not asserted as a
requirement) in ``R1 reasons are matchable values…``, where signer A is pre-staged under the toy
scheme.

### A12 — R9's input list omits the threshold and the scheme policy

R9 says verification is a pure function of "(roster, request, algorithm set)". The **threshold**
and the **scheme policy** also determine the verdict, and R8 explicitly calls the threshold "the
verifier's". I read "roster" as shorthand for the whole verifier configuration; a literal reading
would make the threshold ambient, contradicting R8. **The spec should say (verifier, request,
algorithm set).**

### A13 — "instance orderings" in criterion 7 is undefined

Candidates: order of submissions, of roster entries, of algorithm implementations, or of
separately-constructed verifier values. I tested **all four** (every permutation of 5 submissions
× 2 schemes × 3 roster entries = 1440 verifications) and found one honest boundary worth stating:

> the **decision** and every ordinal-sorted signer/scheme list are order-invariant; the
> **per-submission report** is input-ordered by construction, because its `Index` field refers
> back to the input.

A derivation that sorts the report list would diverge from mine here without either being wrong.
Asserted explicitly (as a multiset equality plus a deliberate `NotEqual` on the ordered list).

### A14 — R10's caller-supplied-signature carve-out

R10 forbids "a raw signature that has **not already been supplied by the caller**", which permits
echoing supplied signatures back. **Chosen:** the stricter line — **no byte material of any kind**
in a verdict or an error. The carve-out buys nothing and the strict rule is mechanically testable
(any `byte[]` anywhere in the verdict graph renders F# byte literals; the test greps for them).

### A15 — Does an off-roster signature deny, or merely not count?

R3 says it "MUST NOT contribute to the count" and must be reported. It does not say it denies.

- **Chosen:** does not veto — threshold-many rostered signers authorize even with a stranger's
  perfectly valid signature also present, and the stranger is reported.
- **Alternative:** presence of an unknown signer denies (a stricter, also-defensible posture).

Criterion 1 does **not** discriminate this, because there the stranger verifier knows *none* of
the signers. Pinned by ``R3 an unknown signer does not veto…``.

### Two smaller notes

- **R6 "no call site may name a concrete algorithm"** — the *library* has no such call site. The
  tests name concrete schemes when building fixtures; that is the composition root, and something
  somewhere has to name the algorithm or none can ever be chosen. The spec would be sharper as
  "no call site *other than the composition root*".
- **Nothing in the spec says the verdict must be reproducible across processes/machines byte for
  byte** (R9 says "the same verdict"), so I did not add a golden-vector byte-lock. Given
  `no-binary-in-proof-lineage` and the four-oracle discipline, a future revision probably wants
  one — and A2 must be settled first, because the canonical message *is* the byte-lock.

---

## 2. Coverage — per requirement

Exactly one of `implemented` / `partial` / `deferred` / `blocked`, never rounded up.

| Req | Status | Evidence (discriminating test) | Notes |
|---|---|---|---|
| **R1** verdict explains itself | `implemented` | ``R1 reasons are matchable values, and the five denial classes are separable`` | `Decision = Authorized \| Denied of DenialReason list`; all five reason classes produced by one input and dispatched on by `match`, no string parsing. |
| **R2** per-verifier roster, no global | `implemented` | ``AC1 off-roster…``, ``AC4 legitimate disagreement…`` | No module-level verifier value, no default roster; `verify` cannot be called without naming a `Verifier`. Two verifiers reach opposite verdicts on the identical request. |
| **R3** only rostered signers count, reported distinctly | `implemented` | ``R3 an off-roster signer never contributes…``, ``R3 an unknown signer does not veto…``, ``AC1…`` | A cryptographically perfect signature from an unrostered signer is reported and contributes 0. See A15 for the reading chosen. |
| **R4** one signer cannot be many | `implemented` | ``AC3 duplicates…``, ``R4 duplicates do not veto…`` | Two *different* valid signature byte-strings from one signer (ECDSA is randomised) still count once — byte-equality dedup would not pass this test. See A5. |
| **R5** signatures cryptographically verified over scope+payload | `implemented` | ``AC2 forgery…``, ``R5 binding: a signature over one scope…``, ``R5 binding: …length-prefixed…`` | Real platform ECDSA; single-bit flip denies; a signature valid for one scope fails for another. The epoch is **not** covered — that is A1, a defect in the spec, not a gap against R5 as written. |
| **R6** scheme is a port, ≥2 impls, no call site names an algorithm | `implemented` | ``AC5 algorithm swap…``, ``R6 the port discriminates…``, ``R6 the port is total…`` | Three impls behind `ISignatureScheme`: ECDSA P-256/SHA-256, ECDSA P-384/SHA-384 (both platform, no bespoke primitive), and a `toy`-named deterministic double. Each rejects the others' signatures; malformed input is a `false` verdict, never an exception. |
| **R7** bounded migration overlap stated in the data | **`partial`** | ``AC6 migration overlap…``, ``R7 the current scheme is accepted at every epoch…``, ``R8 malformed migration policy…`` | The mechanism is implemented and both boundaries are tested. **Not rounded up** because the epoch the window is measured against is caller-supplied and unsigned (A1): the window constrains an honest caller, not an adversarial one. What R7 *asks for* is done; what R7's rationale *wants* is not achieved, and I cannot fix that inside R5's stated signature coverage. |
| **R8** threshold ≥1, ≤ roster size, unauthorizable config rejected | `implemented` | four ``R8 …`` tests | `ThresholdBelowOne`, `ThresholdExceedsRosterSize`, `EmptyRoster`, `DuplicateRosterEntry`, `RosterCannotReachThreshold`, `RetiringWindowInverted`, `RetiringSchemeIsCurrentScheme`, `NoImplementationForCurrentScheme`, `DuplicateSchemeImplementation` — each with a control case that produces a verdict instead. |
| **R9** pure function, no ambient state / clock / I/O / global config | **`partial`** | ``AC7 determinism…`` | Determinism is verified exhaustively (1440 permutations + repeat invocation). **Not rounded up** because *no test would fail if a clock were introduced*: the no-ambient-state half is verified by construction and inspection only (the module opens `System`, `System.Security.Cryptography`, `System.Text`; contains no `DateTime`, no `Random`, no I/O, no module-level mutable state). A mechanical guard — a source-level or IL-level check for forbidden references — is **deferred**. Also see A12: the spec's own input list is incomplete. |
| **R10** nothing secret in a returned value or error | `implemented` | ``R10 the verdict carries identities, counts and indices only…`` | The verdict and error graphs are asserted to render **no F# byte literals at all**, so the test fails the moment any `byte[]` (key, signature) is added back to either. Positive control: identities are present. Stricter than the spec (A14). |

## 3. Coverage — per acceptance criterion

| # | Criterion | Status | Test |
|---|---|---|---|
| 1 | Off-roster rejection | `implemented` | ``AC1 off-roster: the same request authorizes under a roster that knows the signers and returns unknown-signer under one that does not`` — one request, two rosters, distinct `UnknownSignersPresent` verdict. |
| 2 | Forgery rejection (single bit) | `implemented` | ``AC2 forgery: flipping one bit of one signature denies, and the FIRST reason names verification failure rather than an insufficient count`` — control case authorizes; the *first* reason is `InvalidSignaturesPresent`. |
| 3 | Duplicate collapse | `implemented` | ``AC3 duplicates: one signer submitting threshold-many distinct valid signatures counts once and is denied`` — control case with two distinct signers authorizes. (Criterion is vacuous at threshold 1 — see A5; tested at threshold 2.) |
| 4 | Legitimate disagreement | `implemented` | ``AC4 legitimate disagreement: one request, two rosters, two different verdicts, both correct`` — overlapping-but-different rosters, so the disagreement is about *one* signer. |
| 5 | Algorithm swap, no call-site change | **`partial`** | ``AC5 algorithm swap…`` — demonstrated under the only coherent reading (same request *shape* and call site, three different schemes, identical verdict content). **The criterion as literally written — identical bytes verifying under two schemes — is unsatisfiable by any implementation.** See A7. |
| 6 | Migration overlap, boundary on both sides | `implemented` | ``AC6 migration overlap: a retiring-scheme signature verifies inside the stated window and is refused on both sides of it`` — epochs 9 / 10 / 15 / 20 / 21. Endpoint inclusivity is a choice, not a derivation (A8); the window's enforceability is limited by A1. |
| 7 | Determinism across invocations and orderings | `implemented` | ``AC7 determinism: repeated invocations and every permutation of submissions, roster and scheme list give an identical decision`` — 1440 permutations, plus an explicit assertion of the one order-*sensitive* surface (the input-indexed report), so the claim is precise rather than broad (A13). |

## 4. What I could not verify

- **R9's no-ambient-state half.** Verified by reading, not by a failing test. A guard that
  inspects the compiled module for references to `DateTime` / `Random` / I/O types would close it.
- **Cross-derivation byte compatibility.** Because of A2 my `canonicalMessage` is a *choice*.
  Signatures produced against derivation A's or B's message construction will not verify here, and
  that is a spec defect rather than an implementation bug in any of the three.
- **The toy scheme is a double, not security.** It is named `toy-digest-sha256-v1` and is
  keyless-forgeable by anyone who can hash. Per `.claude/rules/toy-is-free-metered-must-be-earned.md`
  it carries the `toy` prefix so it can never be silently promoted. The ECDSA schemes are the
  platform's; **no bespoke primitive was written** (explicit spec non-goal).
- **Nothing here is wired to a caller.** The module is a library with no call sites in the repo
  yet; the "no call site names an algorithm" property is therefore currently a property of a
  surface, not of a deployed system.
