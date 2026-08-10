# Derivation C — threshold signature verification (N-version, clean room)

**Branch:** `derivation-c/threshold-sig-verify`
**Spec:** `docs/specs/threshold-signature-verification-cleanroom-spec.md`
**Wall:** I did not read `src/Core/Consent/KskAuthorization.fs`, any `cleanside/*` or
`derivation-*` branch, or any third-party / prior-employer implementation of threshold
signature verification. I read only: the spec, `src/Core/Crypto.fs` (house convention for
crypto ports), `src/Core/Core.fsproj` / `tests/Tests.FSharp/Tests.FSharp.fsproj` (registration),
and `tests/Tests.FSharp/AntiSybil.Tests.fs` (test-shape convention). I am not aware of having
previously seen an implementation of this functionality.

**Artifacts:**
- `src/Core/ThresholdVerification.fs` — the module (port + verifier + two scheme impls)
- `tests/Tests.FSharp/ThresholdVerification.Tests.fs` — the discriminating tests

> Status: **IN PROGRESS** — written incrementally as each requirement resolves.

---

## 1. Spec defects / ambiguities surfaced

*(filled in as found — this section is the highest-value output)*

---

## 2. Coverage table

*(filled in as each requirement resolves)*
