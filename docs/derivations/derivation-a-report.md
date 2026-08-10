# Derivation A — threshold signature verification (N-version, clean room)

**Branch:** `derivation-a/threshold-sig-verify`
**Spec:** `docs/specs/threshold-signature-verification-cleanroom-spec.md`

**Wall honoured.** I did not open `src/Core/Consent/KskAuthorization.fs`, any `cleanside/*` or
`derivation-*` branch, or any third-party / prior-employer implementation of threshold or
multi-signature verification. I am not aware of having previously read one. For house conventions
only I read `src/Core/AntiSybil.fs`, `tests/Tests.FSharp/AntiSybil.Tests.fs`, `src/Core/Crypto.fs`
(headers), `Directory.Build.props` and the two `.fsproj` files — unrelated functionality, permitted
by the handoff.

**Artifacts**
- `src/Core/ThresholdSignatureVerification.fs` (module `Zeta.Core.ThresholdSignatureVerification`)
- `tests/Tests.FSharp/ThresholdSignatureVerification.Tests.fs` (22 tests, all passing)

**Gates**
- `dotnet build -c Release` (whole solution): **Build succeeded, 0 Warning(s), 0 Error(s)**
- `dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --filter
  "FullyQualifiedName~ThresholdSignatureVerification"`: **22 passed, 0 failed**

---

## 1. Spec defects and ambiguities surfaced

This is the section that matters. Each entry names the two honest readings, the one I took, and
what a derivation taking the other reading would produce.

### D1 — "threshold signature" names two different cryptographic objects (highest severity)

- **Reading A (multi-signature / k-of-n):** *n* signers each produce an independent ordinary
  signature; the verifier counts how many distinct rostered signers produced a valid one and
  compares to *k*.
- **Reading B (threshold signature proper, Desmedt–Frankel / Shamir):** the signing key is
  secret-shared; *k* shareholders collaborate to emit **one** aggregated signature that verifies
  against a **single group public key**. There are no per-signer submissions at the verifier.

**Chosen: A.** R3 ("only rostered signers count toward the threshold"), R4 ("repeated submissions
by the same signer") and AC3 ("one signer submitted `threshold` times") are all meaningless under
B — a true threshold signature has nothing to count or de-duplicate. But the document's *title* is
the term of art for B, and a cryptographer reading only the title would build B. The requirements
and the title disagree. **Fix: retitle to "k-of-n multi-signature verification", or state Reading A
in one sentence at the top.**

### D2 — the canonical signed bytes are never specified (highest operational severity)

R5 says a signature must be over "the request's **scope and payload**" and stops there.

- **Reading A:** concatenate the scope bytes and the payload bytes. Then `scope="ab", payload="c"`
  and `scope="a", payload="bc"` produce **the same** signed message, so a signature authorising one
  request authorises a different one.
- **Reading B:** an injective, domain-separated encoding.

**Chosen: B** — `"zeta.threshold-signature.v1" ‖ u32le(len scope) ‖ scope(UTF-8) ‖ u32le(len payload) ‖ payload`.
Pinned by a test (`R5: the signed bytes bind scope and payload injectively`).

**This is the defect that breaks the N-version exercise itself.** The three derivations will each
invent a different encoding, so signatures produced against derivation A will not verify under
derivations B or C — and the divergence will look like a correctness bug rather than what it is.
**Fix: the spec must state the signed-bytes encoding byte-for-byte (it is a wire format, and a wire
format is a requirement, not expression).**

### D3 — is the scheme identifier bound into the signed bytes?

- **Reading A (literal):** no — R5 says "scope and payload", full stop. Cross-scheme substitution is
  then prevented only by the fact that each scheme has its own key.
- **Reading B (defensive):** bind the `SchemeId` too, so a signature can never be re-labelled as
  being under a different scheme during the R7 overlap window.

**Chosen: A**, the literal reading. Recorded as a risk: a deployment where one signer's key material
happens to be valid under two accepted schemes has an algorithm-confusion surface that B would close.

### D4 — R7's window is measured against *what*? And is the boundary inclusive?

R7 requires a "bounded window … stated in the data". The house rules forbid a wall clock.

- **Reading A:** wall-clock timestamps — excluded by the house conventions.
- **Reading B:** a caller-supplied logical epoch.

**Chosen: B**, an `int64 epoch` parameter to `verify`.

Then, unspecified and consequential: **AC6 says "the boundary checked on both sides" but never says
which side the boundary itself lands on.** `Retiring lastAcceptedEpoch = 100` — is epoch 100
accepted or rejected? **Chosen: inclusive** (accepted while `epoch <= last`). A derivation choosing
exclusive disagrees with this one at exactly one epoch: a silent one-tick divergence in the middle
of a migration cutover, which is the worst possible place for an off-by-one. **Fix: state it.**

### D5 — is the migration window per-scheme or per-verifier?

- **Reading A:** each retiring scheme carries its own `lastAcceptedEpoch`.
- **Reading B:** the verifier has one migration window covering all retiring schemes.

**Chosen: A** — "stated in the data" reads more naturally as a property of the scheme row, and it
permits two overlapping retirements. B is simpler and is a legitimate reading.

### D6 — AC3 and AC7 are in tension; satisfying both forces a design decision

AC3 wants duplicates reported; AC7 wants the verdict invariant across "instance orderings". Under a
naive per-submission verdict these conflict: **which copy of a duplicate is "the one that counted"
is a function of submission order**, so the verdict is order-dependent and AC7 fails.

**Chosen resolution:** the verdict is reported **per signer, not per submission**, and every list in
it is sorted and de-duplicated. `CountedSigners`, `DuplicateSigners` and `Rejections` are then
invariant under any permutation of `Submissions`, of roster insertion order, and of the scheme
registry order — all four pinned by the AC7 test.

A derivation that emits per-submission outcomes in submission order satisfies AC3 and fails AC7 and
will be *right about the requirement it read*. **This is a spec-internal contradiction, not an
implementation divergence.**

### D7 — "instance orderings" (AC7) is undefined

Candidate meanings: (a) order of submissions in the request; (b) insertion order of the roster
`Map` / scheme registry; (c) several *instances* of a verifier object — there is no object here, so
(c) is empty. **Chosen: satisfy (a) and (b), both tested.**

### D8 — a signer who submits one valid and one invalid signature

Spec silent.

- **Reading A:** the signer counts (one valid signature is one valid signature); the extra shows up
  only as a duplicate.
- **Reading B:** the signer does not count — mixed evidence from one identity is an attack signal,
  not a clerical error.

**Chosen: A.** Honest cost of A, stated because it is a real reporting loss: **the invalid
submission's reason is not surfaced at all** — `Rejections` only carries signers that did not count.
A caller sees `alice` in both `CountedSigners` and `DuplicateSigners` and cannot learn that one of
her submissions failed verification.

### D9 — R9 enumerates inputs that cannot satisfy R7

R9: "a pure function of **(roster, request, algorithm set)**". R7 requires a bounded window, which
needs a time-like input that is in none of those three. Options: put the epoch in the request
(attacker-controlled — rejected), in the policy (makes the policy mutate with time — rejected), or
add a fourth parameter (**chosen**). **Fix: R9 should read (roster, request, algorithm set, epoch).**

### D10 — R8's bound does not actually guarantee satisfiability

R8 requires `1 ≤ threshold ≤ |roster|` and that a configuration which "cannot ever authorize" be a
configuration error. Those two are **not the same condition**: under R7 migration a rostered signer
may hold no key under any currently-accepted scheme, so a policy can satisfy `threshold ≤ |roster|`
and still be unable to authorize. **I implemented the literal bound and left the hole open rather
than silently closing it** — see the coverage table, where R8 is `partial` for exactly this reason.

Also unspecified: is `|roster|` the count of rostered identities, or the count of identities with a
usable key? **Chosen: identities.**

### D11 — R8 says "cannot ever authorize" but lists only threshold bounds

I took the *principle* rather than the enumeration and also refuse: an accepted scheme with no
supplied implementation (`UnimplementedScheme`), two implementations sharing an id
(`DuplicateSchemeImplementation`), one signer with two keys for one scheme
(`AmbiguousKeyForSigner`), an empty roster, and an empty accepted-scheme set. Each of these would
otherwise be a silent permanent denial or a silently arbitrary choice — the exact failure R8 names.
**The alternative reading is that only the threshold bounds are configuration errors** and all of
the above are per-signature rejections. A derivation taking that reading returns
`Ok { Authorized = false }` where this one returns `Error`.

### D12 — may a rostered signer hold more than one key per scheme?

Spec silent.

- **Reading A:** no — refuse the configuration as ambiguous (**chosen**).
- **Reading B:** yes — try each and accept if any verifies. B is *friendlier*: it lets a signer
  rotate keys without a roster edit, and it is what a deployment will eventually want. I rejected it
  because "which key verified" then becomes part of the answer and the reject reason stops being a
  function of the signer alone. This is the fork I am least confident about.

### D13 — AC5's "the identical request" is literally impossible

Signature bytes are scheme-specific, so a request cannot be byte-identical across two schemes.
**Chosen reading:** identical *scope, payload, signer set and threshold*; the signature bytes and
key material necessarily differ. Tested through a single shared call site that names no algorithm.

### D14 — R6's "no call site may name a concrete algorithm" — does a `SchemeId` count?

**Chosen:** no. A `SchemeId` is data that a policy carries; the verification path never branches on
its value. The two implementations live in a `Schemes` sub-module that the verification path does
not reference. Under a stricter reading, shipping named implementations beside the port is already
a violation.

### D15 — is a failed verification an `Error`?

**Chosen:** no. `Ok Verdict{Authorized=false}` for "not enough consent"; `Error ConfigError` only for
configuration defects. Under the alternative (denial as `Error`) R1's self-explanation would live
entirely in the error channel and `Verdict` would collapse to a unit.

### D16 — R10's carve-out implies echoing is allowed

"never a raw signature **that has not already been supplied by the caller**" implies a
caller-supplied signature *may* be echoed. **Chosen:** echo nothing at all; the verdict carries only
identities, scheme tags, epochs and counts.

### D17 — an unaccepted scheme claimed by a *submitter*

Spec does not say whether this is a configuration error or a rejection. **Chosen: a rejection**
(`SchemeNotAccepted`) — the submitter chose the scheme, not the verifier, so it is not the
verifier's misconfiguration.

---

## 2. Coverage — declared per requirement

Legend: `implemented` = built **and** pinned by a test that fails when the behaviour is removed.
`partial` = built but the requirement is only partly met or only partly verified. Nothing here is
rounded up.

### Requirements

| Req | Status | Evidence / why not higher |
|---|---|---|
| **R1** verdict explains itself | `implemented` | `RejectReason` DU (6 cases) + `Verdict` counts. Tests: AC1, AC2, `NoKeyForScheme` vs `SignatureDidNotVerify`, `SchemeNotAccepted` vs `RetiringSchemeExpired`, malformed-key fault. Reasons are matched structurally, never string-compared. |
| **R2** per-verifier roster, no global one | `implemented` | `VerifierPolicy` is a parameter; the module holds no mutable or global state. Two verifiers reach different verdicts on the identical request in AC1 and AC4. |
| **R3** only rostered signers count | `implemented` | Off-roster ⇒ `NotOnRoster`, reported not dropped. **Mutation-checked**: replacing `NotOnRoster` with `Valid` fails AC1, AC4 and AC7. |
| **R4** one signer cannot be many | `implemented` | Per-signer aggregation; `DuplicateSigners`. **Mutation-checked**: counting submissions instead of distinct signers fails AC3. |
| **R5** signatures cryptographically verified | `implemented` | Platform ECDSA P-256/SHA-256 over the canonical bytes. **Mutation-checked**: making `Ok false` count fails 5 tests. Scope-binding and payload-binding each pinned. |
| **R6** scheme is a port | `implemented` | `ISignatureScheme`; two implementations (platform ECDSA, explicit `toy` double); `verify` never names one. AC5 exercises both through one call site. |
| **R7** bounded migration overlap | `implemented` | `SchemeStatus.Retiring of lastAcceptedEpoch`, per scheme, in the data. Both sides of the boundary tested; mixed current+retiring request tested. **Mutation-checked**: `>` → `>=` fails AC6. |
| **R8** threshold/roster bounded, no silent always-deny | **`partial`** | The literal bound (`1 ≤ t ≤ |roster|`) and five further unsatisfiable/ambiguous configurations are rejected as `ConfigError`, each with a test. **Not met:** per D10, a policy can pass every check and still be unable to authorize (a rostered signer with no key under any accepted scheme). I did not close that hole. |
| **R9** pure function, no ambient state | **`partial`** | No clock, no I/O, no globals by construction; determinism verified for repeated invocation and for permutation of submissions, roster insertion order and registry order. **Not verified:** "the same verdict **on any machine**" — everything ran in one process on one machine, and there is no mechanical guard (analyzer/test) that would fail if someone later introduced `DateTime.UtcNow` into this module. |
| **R10** nothing secret escapes | `implemented` | Reflection test asserts that no field of `Verdict`, `RejectReason` or `ConfigError` has type `byte[]`, `PublicKey` or `PublicKey list`, and asserts the reflection found fields (non-vacuous). **Honest scope:** this is a *type-level* guarantee, not an information-flow proof; it would not catch a secret smuggled through a caller-supplied `SignerId`. |

### Acceptance criteria

| AC | Status | Test |
|---|---|---|
| **1** off-roster rejection | `implemented` | `AC1 R3: identical request — rostered verifier authorizes, non-rostered verifier reports unknown signers`. Same request object, two policies, distinct verdict shapes. |
| **2** forgery rejection | `implemented` | `AC2 R5: one bit flipped …` — one bit (`sig[7] ^^^ 1`), reason is `SignatureDidNotVerify` and the other signer still counts, so the failure is localized rather than a short count. |
| **3** duplicate collapse | `implemented` | `AC3 R4: one signer submitting threshold-many valid signatures …` — plus the discriminating pair: two *distinct* signers at the same threshold do authorize. |
| **4** legitimate disagreement | `implemented` | `AC4 R2: one request, two partially overlapping rosters …` — one authorizes, one does not, `Assert.NotEqual` on the verdicts. |
| **5** algorithm swap | `implemented` | `AC5 R6: … two scheme implementations, one call site` — a single local `callSite` function used for both runs, plus a cross-scheme negative (ECDSA bytes offered under the toy scheme fail). |
| **6** migration overlap | `implemented` | `AC6 R7: …` — epochs 0/99/**100** accept, 101 rejects with `RetiringSchemeExpired(toy, 100)`; plus a mixed current+retiring request that musters 2 inside the window and 1 outside. |
| **7** determinism | **`partial`** | Verified: repeated invocation, two submission permutations, reversed roster insertion order, reversed registry order — all structurally equal. **Not verified:** "identical … across machines"; single-process only. "Instance orderings" was interpreted (D7) rather than known. |

**Summary: 8 of 10 requirements `implemented`, 2 `partial`; 6 of 7 acceptance criteria
`implemented`, 1 `partial`. Nothing `deferred` or `blocked`.**

---

## 3. Mutation checks (why "implemented" is not self-reported)

Four mutations were applied to the module, rebuilt, and run. Each was killed:

| Mutation | Killed by |
|---|---|
| off-roster signer counted (`NotOnRoster` → `Valid`) | AC1, AC4, AC7 (3 failures) |
| crypto verification bypassed (`Ok false` → `Valid`) | AC2, plus 4 R5/R1 tests (5 failures) |
| threshold measured against submissions, not distinct signers | AC3 |
| retiring window boundary exclusive (`>` → `>=`) | AC6 |

The module was restored from a pre-mutation copy and the full solution rebuilt at 0 warnings
afterwards.

One test was **corrected by reality rather than passing on the first guess**, which is recorded
because it is evidence the tests are load-bearing: I asserted that a 40-byte (wrong-length) P1363
signature would surface as `InputRejectedByScheme MalformedSignature`; the platform returns `false`
instead of raising, so the true reason is `SignatureDidNotVerify`. The test now pins the observed
platform behaviour and says so, and the fault path is exercised separately via malformed key
material in **both** implementations.

---

## 4. Things I could not verify

- **Cross-machine determinism** (R9 / AC7) — untestable from one machine; only same-process
  repetition and ordering invariance were shown.
- **Absence of ambient state as an enforced property** — it holds by inspection today; nothing
  mechanical prevents a future edit from introducing a clock into this module.
- **That the platform ECDSA implementation is itself constant-time / side-channel free** — out of
  scope, and out of my hands: it is `System.Security.Cryptography`.
- **R8's real satisfiability condition** (D10) — knowingly left open.
- **Interoperability with derivations B and C** — impossible under the wall, and per D2 it is
  *unlikely*: without a specified signed-bytes encoding the three derivations almost certainly
  cannot verify each other's signatures. I expect that to be the loudest divergence at combine time,
  and it is a spec defect rather than any derivation's bug.

## 5. Notes for the combine

- The one design decision I would most expect to differ is **D6** (per-signer aggregation vs
  per-submission reporting). It is forced by an internal contradiction in the spec, so whichever way
  the other derivations went, the *spec* is what needs the edit.
- **D4** (inclusive boundary) and **D2** (encoding) are silent divergences — they will not show up
  as a shape mismatch, only as disagreeing verdicts. Check them first.
- **D12** (one key per scheme, or several) is the fork where I am least confident my choice is the
  better one.
