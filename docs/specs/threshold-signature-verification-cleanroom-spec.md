# Threshold signature verification — CLEAN-ROOM SPECIFICATION (N=3)

**Status:** specification only. **This is the clean side of a clean-room wall. Read this and
nothing else.** Do not read `src/Core/Consent/KskAuthorization.fs`, any other derivation's
branch, or any third-party/prior-employer implementation of similar functionality. If you
believe you have seen one, stop and say so rather than proceeding.

**Provenance:** written by Otto (shadow), who has read the existing in-tree code and is
therefore **barred from implementing this** (`.claude/rules/cleanroom-two-team-separation.md`).

**Protocol:** N-version, **N = 3**. Three implementers derive independently; divergences are
then combined. **A divergence between independent derivations is a defect in THIS DOCUMENT
until argued otherwise** — so naming an ambiguity is worth more than resolving it silently.
See `.claude/skills/code-review-and-quality/blueprints/n-version-derivation.md`.

---

## Fitness (stated before the run, per generation-1)

Ranked, most valuable first:

1. **Spec defects surfaced** — ambiguities found, with the two readings named
2. **Coverage honestly earned** — requirements implemented *and* verified by discriminating tests
3. **minus** coverage claimed and not earned

Writing more code is not fitness. A derivation that implements less and reports precisely
beats one that implements more and rounds up.

## Mandatory: declare coverage per requirement

For **every** `R*` and every acceptance criterion, declare exactly one of
`implemented` / `partial` / `deferred` / `blocked`, and **never round `partial` up to
`implemented`.** Deferring is a correct and expected outcome; misreporting is the failure. A
requirement whose only artifact is a type declaration is `deferred`, not `implemented`.

## House conventions (binding — the wall blocks prior art, not our own rules)

- **Result over exception** — errors surface as `Result<_, _>`; no exceptions on these paths.
- **F#**, under `src/Core/`, registered in `Core.fsproj`; tests in `tests/Tests.FSharp/`.
- `dotnet build -c Release` must pass at **0 warnings** (`TreatWarningsAsErrors` is on).
- **Ordinal** string comparison; `CultureInfo.InvariantCulture` for formatting.
- **No wall-clock.** If you need time, take it as a parameter.
- No new NuGet dependencies. .NET's built-in cryptography is available.

---

## R1 — A verification verdict explains itself

The result MUST carry *why*, not merely pass/fail, and the reasons MUST be distinguishable by
a caller (not free-form strings alone).

*Rationale:* an error is a teaching surface; a bare deny costs a round trip and teaches nothing.

## R2 — Each verifier has its own roster; there is no global one

Verification is always **from the perspective of one verifying party**, against *that party's*
set of trusted signers. There MUST NOT be a single mandatory roster.

*Rationale:* per-principal trust, no central authority. **Two verifiers MAY reach different
verdicts on the identical request, and both are correct** — an implementation that cannot
express that has failed this requirement.

## R3 — Only rostered signers count toward the threshold

A signature from an identity absent from the verifier's roster MUST NOT contribute to the
count, and its presence MUST be reported distinctly (not silently dropped).

*Rationale:* silently ignoring an unknown signer hides an attempted forgery; counting one lets
fabricated identities authorize.

## R4 — One signer cannot be many

Repeated submissions by the same signer MUST count once, and duplication MUST be reported
distinctly.

## R5 — Signatures MUST be cryptographically verified

Each submitted signature MUST be verified as a signature **by that signer's key** over **the
request's scope and payload**. Counting submissions without verifying them does not satisfy
this requirement.

*Rationale:* without this the gate answers "were enough names supplied", not "did enough
authorized parties consent" — and any caller able to fabricate bytes passes.

## R6 — The signature scheme is a PORT, not a fixed choice

The algorithm MUST be pluggable behind an interface, with **at least two** implementations
present (one may be a test double). No call site may name a concrete algorithm.

*Rationale:* a post-quantum choice made today is a bet on a hardness assumption holding for
decades. That bet must be revisable **without a migration event**.

## R7 — A verifier MAY accept more than one algorithm during migration

A verifier MUST be able to accept signatures under a **retiring** scheme and a **current**
scheme simultaneously, for a **bounded** window that is stated in the data rather than implied.

*Rationale:* there is no coordinator to sequence a cutover; without an overlap window two
honest parties cannot verify each other and neither is wrong.

## R8 — Threshold and roster are the verifier's, and are bounded

The threshold MUST be at least 1 and MUST NOT exceed the roster size; a configuration that
cannot ever authorize MUST be rejected as a configuration error rather than silently always
denying.

## R9 — Verification is a pure function of (roster, request, algorithm set)

No ambient state, no clock, no I/O, no global mutable configuration. The same inputs MUST
produce the same verdict on any machine.

*Rationale:* deterministic replay; the verdict must be reproducible in a proof lineage.

## R10 — Nothing secret enters a returned value or an error message

Verdicts and reasons MUST carry references, identities and counts only — never key material,
never a raw signature that has not already been supplied by the caller.

---

## Acceptance (what "done" must demonstrate)

Each criterion names the function whose output demonstrates it **and two inputs that make that
output differ.** A criterion satisfiable by a literal is not a criterion.

1. **Off-roster rejection** — same request; verifier whose roster contains the signers →
   authorized; verifier whose roster does not → a distinct *unknown signer* verdict.
2. **Forgery rejection** — same rostered signer identities, one signature's bytes altered by a
   single bit → not authorized, and the reason identifies verification failure rather than an
   insufficient count.
3. **Duplicate collapse** — one signer submitted `threshold` times → not authorized.
4. **Legitimate disagreement** — one request, two verifiers with different rosters → different
   verdicts, both correct.
5. **Algorithm swap** — the identical request and roster verify under two different scheme
   implementations, with no call-site change.
6. **Migration overlap** — a signature under the retiring scheme verifies inside the stated
   window and fails outside it, with the boundary checked on both sides.
7. **Determinism** — the same inputs produce an identical verdict across repeated invocations
   and instance orderings.

## Non-goals

Key distribution, roster gossip, revocation transport, and choosing which post-quantum scheme
Zeta adopts. Those are separate. **Do not implement a bespoke cryptographic primitive** — use
the platform's, or a test double, behind the R6 port.

---

# AMENDMENTS — post-combine (2026-08-09)

**Everything above this line is the spec as derivations A, B and C were built against, and is
left unedited.** Rewriting it would destroy the record of what the three implementers actually
read — which is the evidence the run produced. These amendments are **additive** and bind any
future derivation. Evidence:
[`threshold-signature-verification-combine.md`](threshold-signature-verification-combine.md).

Each amendment exists because independent implementers read one sentence two ways. **A
divergence between independent derivations is a defect in this document**, and the count of
derivations that found it is the warrant.

## B1 (title + preamble) — this is MULTI-signature, not THRESHOLD signature

*Found by A. The most dangerous defect in the run.*

"Threshold signature" is the term of art for the **Desmedt–Frankel / Shamir** construction: an
*aggregated single signature* verified against *one group key*. This document's R3/R4/AC3 —
count signers, de-duplicate submissions, report unknown ones — are only meaningful for **k-of-n
multi-signature**, where each party signs separately.

> **This specification describes k-of-n MULTI-SIGNATURE verification.** A reader who implements
> threshold signatures from the title builds the wrong primitive. All three derivations built
> multi-signature because the requirements forced it — the document was internally coherent and
> externally misnamed.

## B2 (amends R5) — the canonical signed bytes are FIXED, and domain separation is REQUIRED

*Found independently by all three. The deepest defect.*

R5 said a signature is "over the request's scope and payload" and fixed no encoding. The three
derivations chose three different encodings — differing in domain tag, endianness, and whether
the payload length is prefixed — so **no two can verify each other's signatures, and every
derivation's own tests pass regardless.**

> The signed message MUST be exactly:
> `domain ‖ u32be(len(scope_utf8)) ‖ scope_utf8 ‖ u32be(len(payload)) ‖ payload`
> with `domain = "zeta.multisig.v1"` as UTF-8 bytes, and **all** length prefixes 4-byte
> **big-endian** (endian-explicit so bytes are identical on every machine, per R9).
>
> **Domain separation is REQUIRED, not optional.** Length-prefixing alone gives injectivity —
> which is all the original rationale argued for, which is why one derivation correctly omitted
> the tag — but injectivity does **not** prevent **cross-protocol reuse**: a signature valid in
> another Zeta context being replayed into this one. State that reason, so no compliant
> implementation can omit it again.

## B3 (amends R7 + R9) — the epoch is verifier-supplied, and the window is ADVISORY

*The epoch problem was found by C and independently by B, which also named the attack.*

R5 binds a signature to scope and payload; R7 wants a bounded window; the house rules forbid a
wall clock. The epoch is therefore **caller-supplied and unsigned** — a **downgrade attack**: an
adversary replays a retired-scheme signature by asserting an in-window epoch.

> The epoch MUST be supplied by the **verifier**, never taken from the request, and MUST appear
> in R9's input list. `verify` is a function of **(roster, request, algorithm set, epoch)**.
>
> Even so, the migration window is **advisory, not enforcing**: it bounds what a verifier
> chooses to accept, and it cannot bind a signer, because nothing in the signed material commits
> to a time. **Do not describe it as preventing use of a retired scheme.** Making it enforcing
> requires the epoch inside the signed material, which contradicts R5 — that is a design change,
> not a clarification.

## B4 (amends R7) — a migration window MAY be unbounded

*Found by B, flagged as its least-confident call. It was right to doubt the spec, not itself.*

R7 implied every overlap is transitional. **Permanent hybrid classical+PQ deployment is real
practice**, so a verifier accepting two schemes indefinitely is a legitimate configuration, not
a misconfiguration. An unbounded window MUST be expressible and MUST NOT be a config error.

## B5 (amends R7) — windows live on the VERIFIER, never on a shared registry

*Found by B.*

> A migration window is per-verifier policy. Putting it on a shared scheme registry **recreates
> the cutover coordinator R7 exists to deny** — the same hub failure this substrate refuses
> everywhere else.

## B6 (amends R4) — a duplicate MUST NOT suppress a genuine signature

*Found by B. A denial-of-participation attack no other derivation saw.*

R4 said duplicates count once and said nothing about *which* copy counts. Under **first-wins**,
an attacker injects a junk submission under a target's identity and the target's genuine
signature never counts.

> Any **valid** submission from a rostered signer MUST count, regardless of position or how many
> invalid submissions share that identity.

## B7 (amends R6) — the port contract FORBIDS impure adapters

*All three derivations declared R9 `partial`; B named the reason.*

R9 requires purity of `verify`, but R6's port permitted an adapter that reads a clock or does
I/O — so R9 was unachievable through a conforming implementation.

> An `ISignatureScheme` implementation MUST be pure: no clock, no I/O, no global mutable state,
> and it MUST NOT throw (a fault is a returned value). R9's guarantee extends **through** the
> port, not merely up to it.

## B8 (amends R8) — reject every configuration that can never authorize

Rejecting only `threshold > roster size` is insufficient: a rostered signer with no key under
any accepted scheme passes every stated check and can never contribute.

## B9 (amends the Acceptance section)

- **AC3** MUST specify **threshold ≥ 2** — duplicate collapse is vacuous at threshold 1.
- **AC5** MUST read *"the same request **shape** and call site verify under two schemes"* —
  identical bytes verifying under two genuinely different schemes is impossible unless one wraps
  the other, which would void R6.
- **AC6** MUST pin the window as **half-open `[start, end)`**, matching `PhaseWindow` in
  `KeyCustody`. Inclusive vs half-open diverges at exactly one epoch, silently, mid-cutover —
  and no derivation's own tests can catch it.
- **AC7** MUST define "instance orderings" — it admits at least three readings, and only
  submission order was tested by anyone.
