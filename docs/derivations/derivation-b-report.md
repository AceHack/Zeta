# Derivation B — threshold signature verification (N-version, clean room)

**Branch:** `derivation-b/threshold-sig-verify`
**Spec:** `docs/specs/threshold-signature-verification-cleanroom-spec.md`

**Wall honoured.** I did not open `src/Core/Consent/KskAuthorization.fs`, any `cleanside/*` or
`derivation-*` branch, or any third-party / prior-employer implementation of threshold signature
verification. I read only the spec plus in-repo house conventions (`src/Core/Crypto.fs` for the
hexagonal-port style, `tests/Tests.FSharp/Asn1Der.Tests.fs` for test style, the two `.fsproj`
files, `.claude/rules/`). I am not aware of having seen a prior implementation of this
functionality. No bespoke cryptographic primitive was written; the two real adapters call
`System.Security.Cryptography`, and the third is a labelled toy.

**Artifacts**

| file | what |
|---|---|
| `src/Core/ThresholdSignatureVerification.fs` | data model, `ISignatureScheme` port, config validation, `verify` |
| `src/Core/ThresholdSignatureSchemes.fs` | three port adapters — ECDSA-P256/SHA-256, RSA-PSS/SHA-256 (both platform), one labelled **toy** double |
| `tests/Tests.FSharp/ThresholdSignatureVerification.Tests.fs` | 21 tests |

**Gates:** `dotnet build -c Release` → **0 warnings, 0 errors** (whole solution).
`dotnet test … --filter "FullyQualifiedName~ThresholdSignatureVerification"` → **21 passed, 0 failed**.

---

## 1. Spec defects and ambiguities surfaced

Ranked roughly by how much damage a divergence here would do. Each entry names both honest
readings and the one I took.

### D1 — R5 never says how the scope and the payload are combined into signed bytes *(interop-breaking)*

R5 requires a signature "by that signer's key over **the request's scope and payload**", and
stops there. Two readings:

- **(a) concatenation** — sign `scope ‖ payload`.
- **(b) unambiguous framing** — sign a domain tag plus each field length-prefixed.

**Chose (b).** Under (a) the boundary is movable: with scope `"ab"` and payload `0xcd`, the
signed bytes are `61 62 cd`, which are *exactly* the signed bytes for scope `"a"` and payload
`0x62 cd`. A genuine signature authorizing one scope therefore also authorizes a different
scope, which defeats the point of scoping at all. Implemented as
`"zeta.threshold-sig.v1" ‖ u32be(|scope|) ‖ scope ‖ u32be(|payload|) ‖ payload`; the test
`R5 - the signed message is length-framed…` is that exact pair.

Two sub-questions the spec also leaves open, both of which I answered and neither of which is
implied by the text:

- **Is the scheme id in the signed bytes?** I said no — otherwise a signer cannot present the
  same artifact under the retiring and the current scheme during R7's overlap.
- **Is the verifier id in the signed bytes?** I said no — R2's "two verifiers, one identical
  request" presupposes the same signature is evaluable by both.

This is the highest-value defect in the document: **any two derivations that answer D1
differently produce implementations that cannot verify each other's signatures**, and every
derivation's own tests will pass regardless, because each generates the signatures it checks.

### D2 — R7's migration window needs a time coordinate that R9's input list does not contain

R7 requires a *bounded window stated in the data*. R9 says verification is a pure function of
"(roster, request, algorithm set)" — no time in the triple. Two readings:

- **(a) the requester states the epoch** (it rides in the request), keeping R9's triple literal.
- **(b) the verifier supplies the epoch** as an explicit argument, making the function 4-ary and
  R9's list non-exhaustive.

**Chose (b)** — `verify verifier registry epoch request submissions`. Under (a) the *attacker*
picks the clock: present a signature under the retiring scheme, assert an epoch inside the
lapsed window, and the scheme never actually retires. R9's intent ("no ambient state, no clock,
no I/O") is preserved either way, because the epoch is a caller-supplied value and never read
from a clock — the house rule "if you need time, take it as a parameter" is what I leaned on.

### D3 — R8's rationale is strictly broader than R8's rule

R8 states two bounds (threshold ≥ 1, threshold ≤ roster size) but justifies them with "a
configuration that cannot ever authorize MUST be rejected as a configuration error". Several
other configurations also can never authorize: an empty roster, an empty accepted-scheme set, an
inverted acceptance window, unparseable key material.

- **(a) reject exactly the two stated bounds.**
- **(b) reject every statically-detectable never-authorizes configuration.**

**Chose (b).** Consequence to expect in the combine: derivations that chose (a) will *accept*
configurations this one rejects, and the difference will look like a bug in whichever direction
you read it from. The full list I reject: `EmptyRoster`, `NoAcceptedSchemes`,
`ThresholdBelowOne`, `ThresholdExceedsRoster`, `EmptyAcceptanceWindow`, `MalformedKeyMaterial`,
`DuplicateRosterEntry`, `DuplicateKeyForScheme`, `DuplicateSchemeImplementation`,
`UnboundedMigrationOverlap`.

### D4 — must every multi-scheme verifier state an end date? *(my least-confident choice)*

R7: "for a **bounded** window that is stated in the data rather than implied."

- **(a) strict** — if a verifier accepts more than one scheme and none of them has a stated end,
  the window is implied, so refuse the configuration.
- **(b) permissive** — R7 only requires that a bounded window be *expressible*; a permanently
  hybrid verifier (classical + post-quantum, both intended indefinitely) is a legitimate
  configuration and is not a migration at all.

**Chose (a)** (`UnboundedMigrationOverlap`), because it makes R7 falsifiable rather than merely
representable. I flag it as the choice I would most readily give up: hybrid signing is current
PQ-migration practice and reading (b) has a real use case that (a) forbids.

### D5 — duplicate resolution when one signer submits both a good and a bad signature (R4)

R4 says repeated submissions "MUST count once" and duplication "MUST be reported distinctly". It
does not say *which* submission is the one that counts.

- **(a) first-wins** — take the canonically-first submission per signer; the rest are duplicates.
- **(b) any-valid-counts** — a signer counts iff at least one of their submissions verifies.

**Chose (b).** Under (a), an attacker who can inject one junk submission attributed to a
rostered signer can *suppress* that signer's real signature, turning a denial-of-service into a
threshold failure. Accepted consequence, reported rather than hidden: the injected junk still
appears in the outcome list as `SignatureInvalid`, so it can change the ranked *denial reason*
(never the decision).

### D6 — denial-reason precedence when failure classes co-occur (R1 vs AC1 vs AC2)

AC1 demands a "distinct *unknown signer* verdict"; AC2 demands a reason that "identifies
verification failure rather than an insufficient count". Neither says what to report when a
request contains an unknown signer *and* a bad signature.

- **(a) one ranked reason.**
- **(b) a set of reasons.**

**Chose both, layered:** the verdict always carries the complete per-submission `Outcomes` list
(lossless), *plus* one ranked `DenialReason` summary. Ranking chosen:
`SignatureVerificationFailed` > `UnknownSignersPresent` > `SchemeUnusable` >
`DuplicateSubmissionsCollapsed` > `InsufficientValidSignatures`. Rationale: a bad signature is
the strongest evidence of an attempt, so it must not be masked. The opposite ranking (unknown
identity first, as the more fundamental error) is equally defensible and I expect divergence.

### D7 — does a roster entry hold one key, or one key per scheme? (R2 + R7 + AC5)

AC5 asks that "the identical request **and roster**" verify under two scheme implementations.

- **(a) signer → key** (the scheme is implied by the key).
- **(b) signer → (scheme → key).**

**Chose (b).** Under (a), AC5 is unsatisfiable as literally written — an ECDSA roster and an RSA
roster cannot be the same roster — and R7's overlap window would force a second roster to exist
during every migration, which R2 says is the verifier's own single trust set.

### D8 — AC5's "identical request" is unsatisfiable if read literally

Signatures under two different schemes are necessarily different bytes. I read AC5 as: same
scope, same payload, same verifier, same roster; only the submissions and their scheme tag
differ. Named because a derivation reading it strictly would have to conclude AC5 is impossible.

### D9 — window bound inclusivity (AC6)

"verifies inside the stated window and fails outside it, with the boundary checked on both
sides" does not say whether the bounds are inclusive.

- **(a) closed `[from, until]`.** — **chosen**
- **(b) half-open `[from, until)`.**

Purely conventional, and precisely the kind of divergence that no derivation's own tests can
catch: each writes the boundary test that matches its own choice. A one-epoch interop gap.

### D10 — "signature is wrong" vs "signature is unreadable" (R1 + R5)

The spec treats verification as boolean. It never says what a scheme should report for a key or
signature it cannot even parse.

- **(a) collapse both into "not verified".**
- **(b) separate outcomes.** — **chosen** (`SignatureInvalid` vs
  `SchemeRejectedInput(_,_,fault)`).

Under (a) a *configuration* mistake (a truncated public key on the roster) is reported as an
attempted forgery, which is the opposite of R1's teaching-surface rationale. Related R10 note:
the port returns a **typed** fault rather than a message string precisely so that no adapter can
put key bytes or a provider's error text into a verdict.

### D11 — may an adapter behind the port throw?

House rule "no exceptions on these paths" governs code we write; it says nothing about what the
core does when a third-party adapter misbehaves.

- **(a) wrap every port call in `try/with`.**
- **(b) state the contract (implementations must be pure and must not throw) and let a violation
  surface.** — **chosen**

Catching everything would convert an adapter bug into a silent deny, which is exactly the
failure R1 exists to prevent. Accepted cost, stated plainly: `verify`'s `Result` is not total
against an arbitrary implementation.

### D12 — R2 forbids a global *roster*; does it forbid a global *registry*?

I read the prohibition as covering the **trust** set only, and put the accepted-scheme windows on
the **verifier** (each verifier owns its own migration schedule — matching R7's rationale that
"there is no coordinator to sequence a cutover"), while the **algorithm implementations** live in
a shared `SchemeRegistry`. A derivation that instead attached the windows to the registry would
have created exactly the central cutover coordinator R7 says does not exist — worth checking in
the combine.

### D13 — AC7's "instance orderings" has at least three readings

- **(a)** the order of the submission list;
- **(b)** the order of implementations in the registry;
- **(c)** multiple instances of the verifier object.

I made the verdict order-invariant under (a) by canonicalising the submission list (ordinal sort
on signer, scheme, lowercased signature hex); (b) is structural (the registry is a `Map` keyed by
scheme id); (c) follows from `Verifier` being an immutable value. **Only (a) is tested.** A
derivation that reads only (c) will pass AC7 without being order-invariant on submissions —
which also silently decides D5, since "which duplicate counts" is an ordering question.

### D14 — a signer with more than one key under one scheme (key rotation) is undefined

Nothing in the spec says whether a signer may hold two keys for one scheme, which is what key
rotation needs. I made it a configuration error (`DuplicateKeyForScheme`). The alternative —
accept a set of keys per signer per scheme and count a submission that verifies under any of
them — is arguably *required* for rotation and I deferred it.

---

## 2. Coverage per requirement

`implemented` = built **and** covered by a test that discriminates (I mutated the
implementation and watched the test fail — see §3). Nothing here is rounded up.

| Req | Status | Evidence / what is not covered |
|---|---|---|
| **R1** — verdict explains itself | `implemented` | `Decision`/`DenialReason`/`SubmissionOutcome` are DUs; no free-form string anywhere in a verdict. AC1 and AC2 both deny the same request and assert *different* reasons, so the discrimination is on the reason, not on the boolean. |
| **R2** — per-verifier roster, no global one | `implemented` | `Verifier` is a value produced by `createVerifier`; there is no module-level roster. Test `acceptance 4` shows two verifiers disagreeing on one request. |
| **R3** — only rostered signers count, unknown reported distinctly | `implemented` | `UnknownSigner` outcome + `UnknownSignersPresent` reason. Mutation "off-roster counts" killed 3 tests. |
| **R4** — one signer cannot be many | `implemented` | Counted signers are a `Set`, so double-counting is structurally impossible; extras surface as `DuplicateSubmission` and as `DuplicateSubmissionsCollapsed`. **Honest caveat:** the mutation that disabled duplicate *marking* changed only the reported reason, not the decision — the type does the real work, and the test discriminates the reporting. |
| **R5** — signatures cryptographically verified | `implemented` | Real platform verification. Mutation "treat `Ok false` as valid" killed 3 tests. Plus a cross-scope replay test and the D1 framing test. |
| **R6** — scheme is a port, ≥2 implementations | `implemented` | `ISignatureScheme` + 3 adapters (2 platform, 1 labelled toy); `acceptance 5` verifies the same request/roster under two of them at an unchanged call site, and a cross-scheme signature is rejected. **Caveat:** "no call site may name a concrete algorithm" is a convention here, not a lint — the test file names them because it *is* the composition root. |
| **R7** — bounded multi-scheme migration window | `implemented` | Windows are data on the verifier (`AcceptFrom` / `AcceptUntil`), evaluated against a caller-supplied `Epoch`. Both boundaries tested on both sides. Reading risk: **D4**. |
| **R8** — threshold and roster bounded, bad config is an error | `implemented` | `Verifier` is a private record; `createVerifier : VerifierConfig -> Result<Verifier, ConfigError>` is the only constructor, so an out-of-bounds verifier cannot be built. Tests cover below-one, above-roster, and the D3 extensions. |
| **R9** — pure function, same verdict anywhere | **`partial`** | No clock, no I/O, no mutable global exists in the module, and determinism is tested across repeated invocations and 5 submission orderings. **Not earned:** (i) no property-based / DST harness over randomised inputs — determinism is unfalsified, not proven; (ii) "on any machine" is untested (one machine, one runtime); (iii) the port contract *permits* an impure adapter, so purity holds for the core and is only a contract at the boundary. |
| **R10** — nothing secret in a returned value | `implemented` | Structural: `Verdict` and `SubmissionOutcome` contain only `VerifierId`, `SignerId`, `SchemeId`, `int`, and a typed `SchemeInputFault` — no `byte[]`, no adapter-supplied string. A test asserts that neither key hex nor signature hex appears in the rendered verdict while the identities the caller is owed do. Residual, out of scope: a caller who puts a secret *into a `SignerId`* gets it back. |

| Acceptance | Status | Evidence |
|---|---|---|
| **1** — off-roster rejection | `implemented` | `acceptance 1`: one request, two verifiers (identical key material, different identities) → `Authorized` vs `Denied(UnknownSignersPresent 2)`. |
| **2** — forgery rejection | `implemented` | `acceptance 2`: one bit flipped in one signature → `Denied(SignatureVerificationFailed 1)`, explicitly **not** an insufficient count, and the intact set authorizes. |
| **3** — duplicate collapse | `implemented` | `acceptance 3`: one signer, two *distinct* valid signatures (ECDSA is randomised), threshold 2 → `Denied(DuplicateSubmissionsCollapsed(1,1,2))`; the two-signer control authorizes. |
| **4** — legitimate disagreement | `implemented` | `acceptance 4`: one request, rosters `{A,B}` and `{A,C}` → `Authorized` vs `Denied(UnknownSignersPresent 1)`, both correct. |
| **5** — algorithm swap | `implemented` | `acceptance 5`: same request, same roster, same call site, ECDSA-P256 and RSA-PSS both authorize; an RSA signature offered under the ECDSA tag is rejected (so the two are genuinely different implementations, not one wearing two names). |
| **6** — migration overlap | `implemented` | `acceptance 6` ×2: epochs 9/10 and 20/21 across a `[10,20]` window; and the current scheme still authorizes at epoch 99 when the retiring one has lapsed. |
| **7** — determinism | **`partial`** | Repeated invocations and 5 submission orderings give a byte-identical verdict, and the verdict is shown not to be a constant. **Not earned:** cross-machine/cross-runtime replay, property-based ordering (5 hand-picked permutations, not generated), and readings (b)/(c) of **D13** are structural rather than tested. No golden vector is committed — key generation is random, so a deterministic fixture would have to be built on the toy double. |

Nothing is `deferred` or `blocked` at the requirement level. Explicitly **not built** (and not
claimed): key rotation / multi-key-per-signer (**D14**), weighted thresholds, any canonical
serialization of a verdict, and the spec's own non-goals (key distribution, roster gossip,
revocation transport, choosing a PQ scheme).

---

## 3. Falsifier log — the mutations these tests survive

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, a test that survives mutation is not
a falsifier. Each mutation was applied to the implementation, the suite was run, and the
implementation restored.

| mutation | tests killed |
|---|---|
| `Ok false` from the scheme treated as valid (skip the crypto check) | 3 — `acceptance 2`, cross-scope replay, `acceptance 5` cross-scheme |
| off-roster signer counted instead of `UnknownSigner` | 3 — `acceptance 1`, `acceptance 4`, `R3` |
| duplicate marking disabled | 1 — `acceptance 3` |
| window upper bound made exclusive (`e < u`) | 1 — `acceptance 6` |
| canonical submission sort removed | 1 — `acceptance 7` |

Final state: 21/21 pass, solution builds at 0 warnings.

---

## 4. Could not verify

- **Cross-machine / cross-runtime determinism** (R9, AC7). One machine, one .NET 10 runtime.
- **"No call site names a concrete algorithm"** (R6) — a convention, unenforced by any lint.
- **The platform adapters' cryptographic correctness** — I exercise them round-trip and under a
  bit flip; their soundness is the platform's, not something this derivation establishes.
- **The port's no-throw contract** (D11) — stated, unenforced.
- **Whether `UnboundedMigrationOverlap` (D4) is desirable at all.** It is my least-confident
  decision and the one most likely to be wrong in the combine.
- **Whether D1's framing matches the other derivations.** By construction I cannot know, and
  each derivation's tests are self-consistent — so this can only be caught by comparing the
  three signed-message encodings directly. **I would start the combine there.**
